import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const isSupabaseConfigured = () => {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
};

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

export const isOnline = () => {
  return navigator.onLine;
};

const requireClient = () => {
  if (!supabase) {
    throw new Error('Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_KEY em .env.local.');
  }

  return supabase;
};

const toISOString = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
};

const stripLocalFields = (entity) => {
  const { id, remoteId, syncStatus, syncedAt, ...rest } = entity || {};
  return rest;
};

export const toSupabaseBuilding = (building) => ({
  name: building.name,
  address: building.address || null,
  observations: building.observations || null,
  created_by: building.createdBy || null,
  created_at: toISOString(building.createdAt) || new Date().toISOString(),
  updated_at: toISOString(building.updatedAt) || new Date().toISOString(),
  sync_status: 'synced',
  synced_at: new Date().toISOString()
});

export const fromSupabaseBuilding = (building) => ({
  remoteId: building.id,
  name: building.name,
  address: building.address || '',
  observations: building.observations || '',
  createdBy: building.created_by || '',
  createdAt: building.created_at ? new Date(building.created_at) : new Date(),
  updatedAt: building.updated_at ? new Date(building.updated_at) : new Date(),
  syncStatus: 'synced',
  syncedAt: building.synced_at ? new Date(building.synced_at) : new Date()
});

export const toSupabaseCTO = (cto, remoteBuildingId) => ({
  code: cto.code,
  building_id: remoteBuildingId,
  floor: cto.floor || null,
  power: cto.power || null,
  ports: cto.ports ?? null,
  splitter: cto.splitter || null,
  technical_info: cto.technicalInfo || null,
  observations: cto.observations || null,
  created_by: cto.createdBy || null,
  created_at: toISOString(cto.createdAt) || new Date().toISOString(),
  updated_at: toISOString(cto.updatedAt) || new Date().toISOString(),
  sync_status: 'synced',
  synced_at: new Date().toISOString()
});

export const fromSupabaseCTO = (cto, localBuildingId) => ({
  remoteId: cto.id,
  code: cto.code,
  buildingId: localBuildingId,
  floor: cto.floor || '',
  power: cto.power || '',
  ports: cto.ports ?? null,
  splitter: cto.splitter || '',
  technicalInfo: cto.technical_info || '',
  observations: cto.observations || '',
  createdBy: cto.created_by || '',
  createdAt: cto.created_at ? new Date(cto.created_at) : new Date(),
  updatedAt: cto.updated_at ? new Date(cto.updated_at) : new Date(),
  syncStatus: 'synced',
  syncedAt: cto.synced_at ? new Date(cto.synced_at) : new Date()
});

export const checkConnection = async () => {
  const result = await checkConnectionDetails();
  return result.connected;
};

export const checkConnectionDetails = async () => {
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      message: 'Supabase nao configurado. Confira as variaveis VITE_SUPABASE_URL e VITE_SUPABASE_KEY.'
    };
  }

  if (!isOnline()) {
    return {
      connected: false,
      message: 'Sem conexao com a internet.'
    };
  }

  try {
    const { error } = await requireClient()
      .from('buildings')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return {
        connected: false,
        message: error.message || 'Nao foi possivel consultar a tabela buildings.'
      };
    }

    return {
      connected: true,
      message: 'Supabase conectado'
    };
  } catch (error) {
    return {
      connected: false,
      message: error.message || 'Erro ao conectar ao Supabase.'
    };
  }
};

export const createBuilding = async (building) => {
  const { data, error } = await requireClient()
    .from('buildings')
    .insert([toSupabaseBuilding(stripLocalFields(building))])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateBuilding = async (remoteId, updates) => {
  const { data, error } = await requireClient()
    .from('buildings')
    .update(toSupabaseBuilding(stripLocalFields(updates)))
    .eq('id', remoteId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteBuilding = async (remoteId) => {
  if (!remoteId) return;

  const { error } = await requireClient()
    .from('buildings')
    .delete()
    .eq('id', remoteId);

  if (error) throw error;
};

export const fetchBuildings = async () => {
  const { data, error } = await requireClient()
    .from('buildings')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const createCTO = async (cto, remoteBuildingId) => {
  const { data, error } = await requireClient()
    .from('ctos')
    .insert([toSupabaseCTO(stripLocalFields(cto), remoteBuildingId)])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateCTO = async (remoteId, updates, remoteBuildingId) => {
  const { data, error } = await requireClient()
    .from('ctos')
    .update(toSupabaseCTO(stripLocalFields(updates), remoteBuildingId))
    .eq('id', remoteId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteCTO = async (remoteId) => {
  if (!remoteId) return;

  const { error } = await requireClient()
    .from('ctos')
    .delete()
    .eq('id', remoteId);

  if (error) throw error;
};

export const fetchCTOs = async () => {
  const { data, error } = await requireClient()
    .from('ctos')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const fetchCTOsByBuilding = async (buildingId) => {
  const { data, error } = await requireClient()
    .from('ctos')
    .select('*')
    .eq('building_id', buildingId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};
