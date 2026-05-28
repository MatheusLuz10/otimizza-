import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, logAudit, saveSyncQueue } from '../db/dexie';
import './BuildingDetailPage.css';

function BuildingDetailPage({ technician }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [building, setBuilding] = useState(null);
  const [ctos, setCTOs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCTOForm, setShowCTOForm] = useState(false);
  const [editingCTOId, setEditingCTOId] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    floor: '',
    power: '',
    splitter: '',
    technicalInfo: '',
    observations: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const buildingData = await db.buildings.get(parseInt(id));
      const ctosData = await db.ctos.where('buildingId').equals(parseInt(id)).toArray();
      
      setBuilding(buildingData);
      setCTOs(ctosData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Error loading data:', error);
      navigate('/buildings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveCTO = async (e) => {
    e.preventDefault();
    
    if (!formData.code.trim()) {
      alert('Código da caixa é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const buildingId = parseInt(id);

      if (editingCTOId) {
        // Update
        const ctoData = {
          ...formData,
          updatedAt: now,
          syncStatus: 'pending'
        };

        await db.ctos.update(editingCTOId, ctoData);
        await saveSyncQueue('cto', 'update', editingCTOId, ctoData);
        await logAudit(
          'update_cto',
          technician.name,
          technician.registration,
          buildingId,
          editingCTOId,
          `Caixa ${formData.code} atualizada`
        );
      } else {
        // Create
        const newCTO = {
          ...formData,
          buildingId,
          createdBy: technician.name,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending'
        };

        const ctoId = await db.ctos.add(newCTO);
        await saveSyncQueue('cto', 'create', ctoId, newCTO);
        await logAudit(
          'create_cto',
          technician.name,
          technician.registration,
          buildingId,
          ctoId,
          `Caixa ${formData.code} criada`
        );
      }

      setFormData({
        code: '',
        floor: '',
        power: '',
        splitter: '',
        technicalInfo: '',
        observations: ''
      });
      setEditingCTOId(null);
      setShowCTOForm(false);
      await loadData();
    } catch (error) {
      alert('Erro ao salvar caixa');
      console.error('Error saving CTO:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditCTO = (cto) => {
    setFormData({
      code: cto.code,
      floor: cto.floor || '',
      power: cto.power || '',
      splitter: cto.splitter || '',
      technicalInfo: cto.technicalInfo || '',
      observations: cto.observations || ''
    });
    setEditingCTOId(cto.id);
    setShowCTOForm(true);
  };

  const handleDeleteCTO = async (ctoId, ctoCode) => {
    if (!confirm(`Deletar caixa ${ctoCode}?`)) {
      return;
    }

    try {
      const cto = await db.ctos.get(ctoId);
      await db.ctos.delete(ctoId);
      await saveSyncQueue('cto', 'delete', ctoId, { remoteId: cto?.remoteId || null });
      await logAudit(
        'delete_cto',
        technician.name,
        technician.registration,
        parseInt(id),
        ctoId,
        `Caixa ${ctoCode} deletada`
      );
      await loadData();
    } catch (error) {
      alert('Erro ao deletar caixa');
      console.error('Error deleting CTO:', error);
    }
  };

  const handleCancelForm = () => {
    setFormData({
      code: '',
      floor: '',
      power: '',
      splitter: '',
      technicalInfo: '',
      observations: ''
    });
    setEditingCTOId(null);
    setShowCTOForm(false);
  };

  if (isLoading) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-back" onClick={() => navigate('/buildings')}>← Voltar</button>
          <h1 className="page-title">Carregando...</h1>
        </div>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="page">
        <div className="page-header">
          <button className="btn-back" onClick={() => navigate('/buildings')}>← Voltar</button>
          <h1 className="page-title">Prédio não encontrado</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/buildings')}>← Voltar</button>
        <h1 className="page-title">{building.name}</h1>
      </div>

      <div className="page-content">
        <div className="building-info-card">
          <h2 className="building-name">{building.name}</h2>
          {building.address && (
            <p className="building-address">📍 {building.address}</p>
          )}
          {building.observations && (
            <div className="building-observations">
              <h4>Observações</h4>
              <p>{building.observations}</p>
            </div>
          )}
          <div className="building-meta">
            <div className="meta-item">
              <span className="meta-label">Técnico</span>
              <span className="meta-value">{building.createdBy}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Data de criação</span>
              <span className="meta-value">
                {new Date(building.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Caixas</span>
              <span className="meta-value">{ctos.length}</span>
            </div>
          </div>
        </div>

        <div className="ctos-section">
          <div className="section-header">
            <h3 className="section-title">Caixas CTO</h3>
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setShowCTOForm(true)}
            >
              ➕ Nova Caixa
            </button>
          </div>

          {ctos.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-title">Nenhuma caixa CTO</div>
              <div className="empty-state-text">
                Adicione a primeira caixa para este prédio
              </div>
            </div>
          ) : (
            <div className="ctos-grid">
              {ctos.map(cto => (
                <div key={cto.id} className="cto-card">
                  <div className="cto-header">
                    <div className="cto-code">{cto.code}</div>
                    <span className={`badge badge-${cto.syncStatus === 'pending' ? 'warning' : 'success'}`}>
                      {cto.syncStatus === 'pending' ? '⟳' : '✓'}
                    </span>
                  </div>

                  <div className="cto-info">
                    {cto.floor && (
                      <div className="info-row">
                        <span className="info-label">Andar:</span>
                        <span className="info-value">{cto.floor}</span>
                      </div>
                    )}
                    {cto.power && (
                      <div className="info-row">
                        <span className="info-label">Potência:</span>
                        <span className="info-value">{cto.power}</span>
                      </div>
                    )}
                    {cto.splitter && (
                      <div className="info-row">
                        <span className="info-label">Splitter:</span>
                        <span className="info-value">{cto.splitter}</span>
                      </div>
                    )}
                  </div>

                  {cto.technicalInfo && (
                    <div className="technical-info">
                      <div className="tech-label">Informações Técnicas:</div>
                      <div className="tech-content">{cto.technicalInfo}</div>
                    </div>
                  )}

                  {cto.observations && (
                    <div className="observations">
                      <div className="obs-label">Observações:</div>
                      <div className="obs-content">{cto.observations}</div>
                    </div>
                  )}

                  <div className="cto-actions">
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => handleEditCTO(cto)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => handleDeleteCTO(cto.id, cto.code)}
                    >
                      🗑️ Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCTOForm && (
        <div className="modal-overlay" onClick={handleCancelForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCTOId ? 'Editar Caixa CTO' : 'Nova Caixa CTO'}
              </h2>
              <button className="modal-close" onClick={handleCancelForm}>✕</button>
            </div>

            <form onSubmit={handleSaveCTO}>
              <div className="form-group">
                <label className="form-label">Código da Caixa *</label>
                <input
                  type="text"
                  name="code"
                  className="form-input"
                  placeholder="Ex: CTO-03, CTO-07B"
                  value={formData.code}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  autoFocus
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Andar</label>
                  <input
                    type="text"
                    name="floor"
                    className="form-input"
                    placeholder="Ex: 7º andar, Térreo"
                    value={formData.floor}
                    onChange={handleInputChange}
                    disabled={isSaving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Potência</label>
                  <input
                    type="text"
                    name="power"
                    className="form-input"
                    placeholder="Ex: -18 dBm"
                    value={formData.power}
                    onChange={handleInputChange}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Splitter</label>
                <input
                  type="text"
                  name="splitter"
                  className="form-input"
                  placeholder="Ex: 1:8, 1:16, 1:32"
                  value={formData.splitter}
                  onChange={handleInputChange}
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Técnico Responsável</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={technician.name}
                  disabled
                  defaultValue={technician.name}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Informações Técnicas</label>
                <textarea
                  name="technicalInfo"
                  className="form-input form-textarea"
                  placeholder="Fibra principal ativa, Reserva disponível, Porta 04 ocupada, etc..."
                  value={formData.technicalInfo}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  rows="4"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  name="observations"
                  className="form-input form-textarea"
                  placeholder="Anotações adicionais..."
                  value={formData.observations}
                  onChange={handleInputChange}
                  disabled={isSaving}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelForm}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : editingCTOId ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BuildingDetailPage;
