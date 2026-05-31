import { db, getSyncQueue, updateSyncQueueStatus, clearSyncQueue } from '../db/dexie';
import * as supabaseService from './supabase';

const markBuildingSynced = async (localId, remoteBuilding) => {
  await db.buildings.update(localId, {
    remoteId: remoteBuilding.id,
    syncStatus: 'synced',
    syncedAt: new Date()
  });
};

const markCTOSynced = async (localId, remoteCTO) => {
  await db.ctos.update(localId, {
    remoteId: remoteCTO.id,
    syncStatus: 'synced',
    syncedAt: new Date()
  });
};

const getLocalBuildingByRemoteId = async (remoteId) => {
  if (!remoteId) return null;
  return db.buildings.where('remoteId').equals(remoteId).first();
};

const getLocalCTOByRemoteId = async (remoteId) => {
  if (!remoteId) return null;
  return db.ctos.where('remoteId').equals(remoteId).first();
};

const getRemoteBuildingId = async (localBuildingId) => {
  const building = await db.buildings.get(localBuildingId);
  return building?.remoteId || null;
};

export const syncWithSupabase = async () => {
  if (!supabaseService.isOnline()) {
    return { success: false, message: 'Offline - sincronizacao adiada' };
  }

  if (!supabaseService.isSupabaseConfigured()) {
    return { success: false, message: 'Supabase nao configurado' };
  }

  const queue = await getSyncQueue();
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const item of queue) {
    try {
      switch (item.type) {
        case 'building':
          await syncBuilding(item);
          successCount++;
          break;
        case 'cto':
          await syncCTO(item);
          successCount++;
          break;
        default:
          throw new Error(`Tipo de sincronizacao desconhecido: ${item.type}`);
      }

      await updateSyncQueueStatus(item.id, 'synced');
      await clearSyncQueue(item.id);
    } catch (error) {
      const errorMessage = formatSyncError(error);
      console.error(`Erro ao sincronizar ${item.type} ${item.entityId}:`, error);
      await updateSyncQueueStatus(item.id, 'error', errorMessage);
      errors.push(`${getQueueItemLabel(item)}: ${errorMessage}`);
      errorCount++;
    }
  }

  const pullResult = await pullFromSupabase();

  return {
    success: errorCount === 0 && pullResult.success,
    message: buildSyncMessage(successCount, pullResult.importedCount, errorCount + pullResult.errorCount, errors),
    successCount,
    importedCount: pullResult.importedCount,
    errorCount: errorCount + pullResult.errorCount,
    errors
  };
};

const formatSyncError = (error) => {
  return [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(' - ') || 'Erro desconhecido';
};

const getQueueItemLabel = (item) => {
  const entity = item.type === 'building' ? 'Predio' : 'CTO';
  const action = {
    create: 'criar',
    update: 'atualizar',
    delete: 'deletar'
  }[item.operation] || item.operation;

  return `${entity} ${item.entityId} (${action})`;
};

const buildSyncMessage = (sentCount, importedCount, errorCount, errors) => {
  const summary = `${sentCount} enviado(s), ${importedCount} recebido(s), ${errorCount} erro(s)`;
  if (errors.length === 0) return summary;
  return `${summary}: ${errors[0]}`;
};

const syncBuilding = async (queueItem) => {
  const { operation, entityId, data } = queueItem;

  if (operation === 'delete') {
    await supabaseService.deleteBuilding(data?.remoteId);
    return;
  }

  const localBuilding = await db.buildings.get(entityId);
  if (!localBuilding) return;

  if (operation === 'create' || !localBuilding.remoteId) {
    const existingBuilding = await supabaseService.findBuildingByName(localBuilding.name);
    const remoteBuilding = existingBuilding || await supabaseService.createBuilding(localBuilding);
    await markBuildingSynced(entityId, remoteBuilding);
    return;
  }

  const remoteBuilding = await supabaseService.updateBuilding(localBuilding.remoteId, localBuilding);
  await markBuildingSynced(entityId, remoteBuilding);
};

const syncCTO = async (queueItem) => {
  const { operation, entityId, data } = queueItem;

  if (operation === 'delete') {
    await supabaseService.deleteCTO(data?.remoteId);
    return;
  }

  const localCTO = await db.ctos.get(entityId);
  if (!localCTO) return;

  const remoteBuildingId = await getRemoteBuildingId(localCTO.buildingId);
  if (!remoteBuildingId) {
    throw new Error('Predio da CTO ainda nao foi sincronizado');
  }

  if (operation === 'create' || !localCTO.remoteId) {
    const existingCTO = await supabaseService.findCTOByCode(localCTO.code);
    const remoteCTO = existingCTO || await supabaseService.createCTO(localCTO, remoteBuildingId);
    await markCTOSynced(entityId, remoteCTO);
    return;
  }

  const remoteCTO = await supabaseService.updateCTO(localCTO.remoteId, localCTO, remoteBuildingId);
  await markCTOSynced(entityId, remoteCTO);
};

const pullAuditLogs = async () => {
  try {
    const remoteLogs = await supabaseService.fetchAuditLogs();
    for (const remote of remoteLogs) {
      const existing = await db.auditLogs
        .where('timestamp').equals(new Date(remote.timestamp))
        .and(log => log.technician === remote.technician && log.action === remote.action)
        .first();

      if (!existing) {
        await db.auditLogs.add({
          buildingId: remote.building_id || null,
          ctoId: remote.cto_id || null,
          action: remote.action,
          technician: remote.technician || '',
          registration: remote.registration || '',
          details: remote.details || '',
          timestamp: new Date(remote.timestamp),
          createdAt: new Date(remote.created_at)
        });
      }
    }
  } catch {
    // audit_logs table may not exist yet — silent fail
  }
};

export const pullFromSupabase = async () => {
  if (!supabaseService.isSupabaseConfigured() || !supabaseService.isOnline()) {
    return { success: false, importedCount: 0, errorCount: 0 };
  }

  let importedCount = 0;
  let errorCount = 0;

  try {
    const remoteBuildings = await supabaseService.fetchBuildings();

    for (const remoteBuilding of remoteBuildings) {
      const localByRemoteId = await getLocalBuildingByRemoteId(remoteBuilding.id);
      const localByName = localByRemoteId
        ? null
        : await db.buildings.where('name').equals(remoteBuilding.name).first();
      const localBuilding = localByRemoteId || localByName;
      const mappedBuilding = supabaseService.fromSupabaseBuilding(remoteBuilding);

      if (!localBuilding) {
        await db.buildings.add(mappedBuilding);
        importedCount++;
        continue;
      }

      if (localBuilding.syncStatus !== 'pending') {
        await db.buildings.update(localBuilding.id, mappedBuilding);
        importedCount++;
      }
    }

    const remoteCTOs = await supabaseService.fetchCTOs();

    for (const remoteCTO of remoteCTOs) {
      const localBuilding = await getLocalBuildingByRemoteId(remoteCTO.building_id);
      if (!localBuilding) continue;

      const localByRemoteId = await getLocalCTOByRemoteId(remoteCTO.id);
      const localByCode = localByRemoteId
        ? null
        : await db.ctos.where('code').equals(remoteCTO.code).first();
      const localCTO = localByRemoteId || localByCode;
      const mappedCTO = supabaseService.fromSupabaseCTO(remoteCTO, localBuilding.id);

      if (!localCTO) {
        await db.ctos.add(mappedCTO);
        importedCount++;
        continue;
      }

      if (localCTO.syncStatus !== 'pending') {
        await db.ctos.update(localCTO.id, mappedCTO);
        importedCount++;
      }
    }

    // Sincronizar audit_logs remotos para o dispositivo local
    await pullAuditLogs();
  } catch (error) {
    console.error('Erro ao importar dados do Supabase:', error);
    errorCount++;
  }

  if (importedCount > 0) {
    window.dispatchEvent(new CustomEvent('db:updated'));
  }

  return {
    success: errorCount === 0,
    importedCount,
    errorCount
  };
};

export const setupAutoSync = () => {
  window.addEventListener('online', async () => {
    setTimeout(() => {
      syncWithSupabase();
    }, 1000);
  });
};

export const syncAfterLocalChange = async () => {
  window.dispatchEvent(new CustomEvent('db:updated'));

  if (!supabaseService.isOnline() || !supabaseService.isSupabaseConfigured()) {
    return { success: false, message: 'Sincronizacao remota adiada' };
  }

  const result = await syncWithSupabase();
  window.dispatchEvent(new CustomEvent('db:updated'));
  return result;
};

let periodicSyncId = null;

export const setupRealtimeSync = () => {
  if (!supabaseService.isSupabaseConfigured()) return () => {};

  return supabaseService.setupRealtimeSubscriptions(async () => {
    if (supabaseService.isOnline()) {
      await pullFromSupabase();
    }
  });
};

export const startPeriodicSync = (intervalMs = 30000) => {
  if (periodicSyncId) return periodicSyncId;

  periodicSyncId = setInterval(async () => {
    if (supabaseService.isOnline() && supabaseService.isSupabaseConfigured()) {
      await syncWithSupabase();
    }
  }, intervalMs);

  return periodicSyncId;
};
