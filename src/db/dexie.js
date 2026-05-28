import Dexie from 'dexie';

export const db = new Dexie('CTOManagerDB');

db.version(1).stores({
  technicians: '++id',
  buildings: '++id, &name, syncStatus',
  ctos: '++id, buildingId, &code, syncStatus',
  syncQueue: '++id, type, entityId, status, timestamp'
});

db.version(2).stores({
  technicians: '++id',
  buildings: '++id, &name, syncStatus',
  ctos: '++id, buildingId, &code, syncStatus',
  syncQueue: '++id, type, entityId, status, timestamp',
  auditLogs: '++id, buildingId, ctoId, timestamp, technician'
});

db.version(3).stores({
  technicians: '++id',
  buildings: '++id, remoteId, &name, syncStatus',
  ctos: '++id, remoteId, buildingId, &code, syncStatus',
  syncQueue: '++id, type, entityId, status, timestamp',
  auditLogs: '++id, buildingId, ctoId, timestamp, technician'
});

// Types
export class Technician {
  id;
  name;
  registration;
  createdAt;
}

export class Building {
  id;
  remoteId;
  name;
  address;
  observations;
  createdBy;
  createdAt;
  updatedAt;
  syncStatus;
  syncedAt;
}

export class CTO {
  id;
  remoteId;
  code;
  buildingId;
  floor;
  power;
  splitter;
  technician;
  technicalInfo;
  observations;
  createdBy;
  createdAt;
  updatedAt;
  syncStatus;
  syncedAt;
}

export class SyncQueue {
  id;
  type;
  operation;
  entityId;
  data;
  status;
  errorMessage;
  timestamp;
  createdAt;
}

export class AuditLog {
  id;
  buildingId;
  ctoId;
  action;
  technician;
  registration;
  details;
  timestamp;
  createdAt;
}

// Utility functions
export const getTechnician = async () => {
  const technicians = await db.technicians.toArray();
  return technicians.length > 0 ? technicians[0] : null;
};

export const setTechnician = async (name, registration) => {
  await db.technicians.clear();
  return db.technicians.add({
    name,
    registration,
    createdAt: new Date()
  });
};

export const saveSyncQueue = async (type, operation, entityId, data) => {
  return db.syncQueue.add({
    type,
    operation,
    entityId,
    data,
    status: 'pending',
    timestamp: new Date(),
    createdAt: new Date()
  });
};

export const getSyncQueue = async () => {
  return db.syncQueue.where('status').anyOf('pending', 'error').sortBy('timestamp');
};

export const updateSyncQueueStatus = async (id, status, errorMessage = null) => {
  return db.syncQueue.update(id, {
    status,
    errorMessage,
    syncedAt: new Date()
  });
};

export const clearSyncQueue = async (id) => {
  return db.syncQueue.delete(id);
};

// Audit Log functions
export const logAudit = async (action, technician, registration, buildingId = null, ctoId = null, details = null) => {
  return db.auditLogs.add({
    buildingId,
    ctoId,
    action,
    technician,
    registration,
    details,
    timestamp: new Date(),
    createdAt: new Date()
  });
};

export const getAuditLogs = async (buildingId = null, ctoId = null) => {
  if (ctoId) {
    return db.auditLogs.where('ctoId').equals(ctoId).toArray();
  }
  if (buildingId) {
    return db.auditLogs.where('buildingId').equals(buildingId).toArray();
  }
  return db.auditLogs.toArray();
};

export const getAuditLogsByBuilding = async (buildingId) => {
  return db.auditLogs.where('buildingId').equals(buildingId).reverse().toArray();
};

export const getAuditLogsByCTO = async (ctoId) => {
  return db.auditLogs.where('ctoId').equals(ctoId).reverse().toArray();
};
