import * as supabaseService from './supabase';

export const setupRealtimeSync = () => {
  if (!supabaseService.isSupabaseConfigured()) return () => {};

  return supabaseService.setupRealtimeSubscriptions(() => {
    window.dispatchEvent(new CustomEvent('db:updated'));
  });
};
