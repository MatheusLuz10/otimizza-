import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Building2, Package, ChevronRight, RefreshCw, ClipboardList, BarChart3, Info } from 'lucide-react';
import { isOnline, checkConnectionDetails, isSupabaseConfigured, fetchBuildings, fetchCTOs } from '../services/supabase';
import './DashboardPage.css';

function DashboardPage({ technician, onLogout }) {
  const [buildingCount, setBuildingCount] = useState(0);
  const [ctoCount, setCTOCount] = useState(0);
  const [online, setOnline] = useState(isOnline());
  const [supabaseStatus, setSupabaseStatus] = useState({
    connected: false,
    message: isSupabaseConfigured() ? 'Verificando Supabase...' : 'Supabase não configurado'
  });
  const [refreshStatus, setRefreshStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
    checkSupabaseStatus();
    const cleanupOnlineListener = setupOnlineListener();

    const handleDbUpdate = () => loadStats();
    window.addEventListener('db:updated', handleDbUpdate);

    return () => {
      cleanupOnlineListener();
      window.removeEventListener('db:updated', handleDbUpdate);
    };
  }, []);

  const setupOnlineListener = () => {
    const update = () => {
      setOnline(isOnline());
      checkSupabaseStatus();
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  };

  const checkSupabaseStatus = async () => {
    const status = await checkConnectionDetails();
    setSupabaseStatus(status);
  };

  const loadStats = async () => {
    if (!isOnline() || !isSupabaseConfigured()) return;
    try {
      const [buildings, ctos] = await Promise.all([fetchBuildings(), fetchCTOs()]);
      setBuildingCount(buildings.length);
      setCTOCount(ctos.length);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshStatus(null);
    try {
      await loadStats();
      await checkSupabaseStatus();
      window.dispatchEvent(new CustomEvent('db:updated'));
      setRefreshStatus({ success: true, message: 'Dados atualizados' });
    } catch (error) {
      setRefreshStatus({ success: false, message: error.message || 'Erro ao atualizar' });
    } finally {
      setIsRefreshing(false);
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

        {refreshStatus && (
          <div className={`sync-status ${refreshStatus.success ? 'success' : 'error'}`}>
            {refreshStatus.success ? <Check size={16} /> : <X size={16} />} {refreshStatus.message}
          </div>
        )}

        <div className="dashboard-grid">
          <div className="dashboard-card" onClick={() => navigate('/buildings')}>
            <Building2 className="card-icon" size={28} strokeWidth={1.75} />
            <div className="card-info">
              <div className="card-number">{buildingCount}</div>
              <div className="card-label">Prédios</div>
            </div>
            <ChevronRight className="card-arrow" size={18} />
          </div>

          <div className="dashboard-card" onClick={() => navigate('/ctos')}>
            <Package className="card-icon" size={28} strokeWidth={1.75} />
            <div className="card-info">
              <div className="card-number">{ctoCount}</div>
              <div className="card-label">Caixas CTO</div>
            </div>
            <ChevronRight className="card-arrow" size={18} />
          </div>
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={handleRefresh}
          disabled={isRefreshing || !online}
        >
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> {isRefreshing ? 'Atualizando...' : 'Atualizar Dados'}
        </button>

        <div className="dashboard-actions">
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/buildings')}>
            <Building2 size={16} /> Ver Prédios
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/ctos')}>
            <Package size={16} /> Ver Caixas CTO
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/changes')}>
            <ClipboardList size={16} /> Ver Mudanças
          </button>
          <button className="btn btn-secondary btn-block" onClick={() => navigate('/report')}>
            <BarChart3 size={16} /> Ver Relatório
          </button>
        </div>

        <div className="dashboard-help">
          <h3><Info size={15} /> Informações</h3>
          <ul>
            <li>Todos os dados são carregados diretamente do Supabase</li>
            <li>Alterações aparecem em tempo real em todos os dispositivos</li>
            <li>Conexão com internet é necessária para usar o sistema</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
