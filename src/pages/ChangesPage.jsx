import { useEffect, useMemo, useState } from 'react';
import { getAuditLogs } from '../db/dexie';
import { fetchBuildings, fetchCTOs, fetchAuditLogs, fromSupabaseBuilding, fromSupabaseCTO, isOnline, isSupabaseConfigured } from '../services/supabase';
import './ChangesPage.css';

const ACTION_LABELS = {
  create_building: 'Prédio criado',
  update_building: 'Prédio alterado',
  delete_building: 'Prédio deletado',
  create_cto: 'CTO criada',
  update_cto: 'CTO alterada',
  delete_cto: 'CTO deletada'
};

const ACTION_TYPES = {
  create_building: 'create',
  create_cto: 'create',
  update_building: 'update',
  update_cto: 'update',
  delete_building: 'delete',
  delete_cto: 'delete'
};

const FILTERS = [
  { value: 'all', label: 'Todas' },
  { value: 'update', label: 'Alterações' },
  { value: 'create', label: 'Criações' },
  { value: 'delete', label: 'Exclusões' }
];

function ChangesPage() {
  const [logs, setLogs] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [ctos, setCTOs] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadChanges();
    const handleDbUpdate = () => loadChanges();
    window.addEventListener('db:updated', handleDbUpdate);
    return () => window.removeEventListener('db:updated', handleDbUpdate);
  }, []);

  const loadChanges = async () => {
    try {
      if (isOnline() && isSupabaseConfigured()) {
        const [remoteLogs, buildingsData, ctosData] = await Promise.all([
          fetchAuditLogs(),
          fetchBuildings(),
          fetchCTOs()
        ]);
        const mapped = remoteLogs.map(log => ({
          id: log.id,
          buildingId: log.building_id,
          ctoId: log.cto_id,
          action: log.action,
          technician: log.technician || '',
          registration: log.registration || '',
          details: log.details || '',
          timestamp: new Date(log.timestamp)
        }));
        setLogs(mapped.sort((a, b) => b.timestamp - a.timestamp));
        setBuildings(buildingsData.map(fromSupabaseBuilding));
        setCTOs(ctosData.map(fromSupabaseCTO));
      } else {
        // fallback: apenas logs locais
        const localLogs = await getAuditLogs();
        setLogs(localLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      }
    } catch (error) {
      console.error('Error loading changes:', error);
      const localLogs = await getAuditLogs();
      setLogs(localLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    }
  };

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter(log => ACTION_TYPES[log.action] === filter);
  }, [logs, filter]);

  const todayCount = useMemo(() => {
    const today = new Date().toDateString();
    return logs.filter(log => new Date(log.timestamp).toDateString() === today).length;
  }, [logs]);

  const getEntityName = (log) => {
    if (log.ctoId) {
      const cto = ctos.find(item => item.id === log.ctoId);
      if (cto) return `CTO ${cto.code}`;
    }

    if (log.buildingId) {
      const building = buildings.find(item => item.id === log.buildingId);
      if (building) return building.name;
    }

    return 'Registro removido';
  };

  const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Mudanças</h1>
      </div>

      <div className="page-content">
        <div className="changes-summary">
          <div className="summary-item">
            <span className="summary-value">{logs.length}</span>
            <span className="summary-label">Total</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{todayCount}</span>
            <span className="summary-label">Hoje</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">
              {logs.filter(log => ACTION_TYPES[log.action] === 'update').length}
            </span>
            <span className="summary-label">Alterações</span>
          </div>
        </div>

        <div className="changes-filters" role="tablist" aria-label="Filtro de mudanças">
          {FILTERS.map(item => (
            <button
              key={item.value}
              type="button"
              className={`filter-button ${filter === item.value ? 'active' : ''}`}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">M</div>
            <div className="empty-state-title">Nenhuma mudança registrada</div>
            <div className="empty-state-text">
              As criações, alterações e exclusões feitas no app aparecem aqui.
            </div>
          </div>
        ) : (
          <div className="changes-list">
            {filteredLogs.map(log => (
              <article key={log.id} className="change-card">
                <div className="change-card-header">
                  <div>
                    <h2 className="change-title">
                      {ACTION_LABELS[log.action] || log.action}
                    </h2>
                    <p className="change-entity">{getEntityName(log)}</p>
                  </div>
                  <span className={`change-badge ${ACTION_TYPES[log.action] || 'update'}`}>
                    {ACTION_TYPES[log.action] || 'info'}
                  </span>
                </div>

                {log.details && (
                  <p className="change-details">{log.details}</p>
                )}

                <div className="change-meta">
                  <span>{log.technician || 'Técnico não informado'}</span>
                  <span>{formatDate(log.timestamp)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChangesPage;
