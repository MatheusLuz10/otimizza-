import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/dexie';
import { isOnline, checkConnectionDetails, isSupabaseConfigured } from '../services/supabase';
import { syncWithSupabase } from '../services/sync';
import './DashboardPage.css';

function DashboardPage({ technician, onLogout }) {
  const [buildingCount, setBuildingCount] = useState(0);
  const [ctoCount, setCTOCount] = useState(0);
  const [online, setOnline] = useState(isOnline());
  const [supabaseStatus, setSupabaseStatus] = useState({
    connected: false,
    message: isSupabaseConfigured() ? 'Verificando Supabase...' : 'Supabase nao configurado'
  });
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
    checkSupabaseStatus();
    const cleanupOnlineListener = setupOnlineListener();

    return cleanupOnlineListener;
  }, []);

  const setupOnlineListener = () => {
    const updateOnlineStatus = () => {
      setOnline(isOnline());
      checkSupabaseStatus();
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  };

  const checkSupabaseStatus = async () => {
    const status = await checkConnectionDetails();
    setSupabaseStatus(status);
  };

  const loadStats = async () => {
    try {
      const buildings = await db.buildings.toArray();
      const ctos = await db.ctos.toArray();
      setBuildingCount(buildings.length);
      setCTOCount(ctos.length);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSync = async () => {
    if (!isOnline()) {
      setSyncStatus({ success: false, message: 'Sem conexão de internet' });
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncWithSupabase();
      setSyncStatus(result);
      await checkSupabaseStatus();
      await loadStats();
    } catch (error) {
      setSyncStatus({ success: false, message: error.message || 'Erro ao sincronizar' });
      await checkSupabaseStatus();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Tem certeza que deseja sair?')) {
      onLogout();
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <button className="btn-logout" onClick={handleLogout}>Sair</button>
      </div>

      <div className="page-content">
        <div className="technician-info">
          <div className="info-item">
            <span className="info-label">Técnico:</span>
            <span className="info-value">{technician.name}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Matrícula:</span>
            <span className="info-value">{technician.registration}</span>
          </div>
        </div>

        <div className="connection-status">
          <div className={`sync-indicator ${online ? 'online' : 'offline'}`}></div>
          <span>{online ? 'Online' : 'Offline'}</span>
        </div>

        <div className="connection-status">
          <div className={`sync-indicator ${supabaseStatus.connected ? 'online' : 'offline'}`}></div>
          <span>{supabaseStatus.message}</span>
        </div>

        {syncStatus && (
          <div className={`sync-status ${syncStatus.success ? 'success' : 'error'}`}>
            {syncStatus.success ? '✓' : '✕'} {syncStatus.message}
          </div>
        )}

        <div className="dashboard-grid">
          <div className="dashboard-card" onClick={() => navigate('/buildings')}>
            <div className="card-icon">🏢</div>
            <div className="card-info">
              <div className="card-number">{buildingCount}</div>
              <div className="card-label">Prédios</div>
            </div>
            <div className="card-arrow">→</div>
          </div>

          <div className="dashboard-card" onClick={() => navigate('/ctos')}>
            <div className="card-icon">📦</div>
            <div className="card-info">
              <div className="card-number">{ctoCount}</div>
              <div className="card-label">Caixas CTO</div>
            </div>
            <div className="card-arrow">→</div>
          </div>
        </div>

        <button 
          className="btn btn-primary btn-block"
          onClick={handleSync}
          disabled={isSyncing || !online}
        >
          {isSyncing ? '⏳ Sincronizando...' : '🔄 Sincronizar Agora'}
        </button>

        <div className="dashboard-actions">
          <button 
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/buildings')}
          >
            ➕ Novo Prédio
          </button>
          <button 
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/ctos')}
          >
            ➕ Nova Caixa CTO
          </button>
        </div>

        <div className="dashboard-help">
          <h3>ℹ️ Informações</h3>
          <ul>
            <li>Os dados são salvos localmente no seu aparelho</li>
            <li>A sincronização ocorre automaticamente quando conectado</li>
            <li>Você pode continuar trabalhando mesmo sem internet</li>
            <li>Clique em "Sincronizar Agora" para forçar a sincronização</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
