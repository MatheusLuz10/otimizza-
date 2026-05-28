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
      console.error(`Erro ao sincronizar ${item.type} ${item.entityId}:`, error);
      await updateSyncQueueStatus(item.id, 'error', error.message);
      errorCount++;
    }
  }

  const pullResult = await pullFromSupabase();

  return {
    success: errorCount === 0 && pullResult.success,
    message: `${successCount} enviado(s), ${pullResult.importedCount} recebido(s), ${errorCount + pullResult.errorCount} erro(s)`,
    successCount,
    importedCount: pullResult.importedCount,
    errorCount: errorCount + pullResult.errorCount
  };
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
    const remoteBuilding = await supabaseService.createBuilding(localBuilding);
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
    const remoteCTO = await supabaseService.createCTO(localCTO, remoteBuildingId);
    await markCTOSynced(entityId, remoteCTO);
    return;
  }

  const remoteCTO = await supabaseService.updateCTO(localCTO.remoteId, localCTO, remoteBuildingId);
  await markCTOSynced(entityId, remoteCTO);
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
  } catch (error) {
    console.error('Erro ao importar dados do Supabase:', error);
    errorCount++;
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

let periodicSyncId = null;

export const startPeriodicSync = (intervalMs = 30000) => {
  if (periodicSyncId) return periodicSyncId;

  periodicSyncId = setInterval(async () => {
    if (supabaseService.isOnline() && supabaseService.isSupabaseConfigured()) {
      await syncWithSupabase();
    }
  }, intervalMs);

  return periodicSyncId;
};
