import { useState, useEffect } from 'react';
import { db, saveSyncQueue } from '../db/dexie';
import './CTOsPage.css';

function CTOsPage({ technician }) {
  const [buildings, setBuildings] = useState([]);
  const [ctos, setCTOs] = useState([]);
  const [filteredCTOs, setFilteredCTOs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    code: '', 
    buildingId: '', 
    ports: '', 
    splitter: '', 
    observations: '' 
  });
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterCTOs();
  }, [ctos, searchTerm, filterBuilding]);

  const loadData = async () => {
    try {
      const buildingsData = await db.buildings.toArray();
      const ctosData = await db.ctos.toArray();
      setBuildings(buildingsData);
      setCTOs(ctosData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const filterCTOs = () => {
    let filtered = ctos;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.code.toLowerCase().includes(term)
      );
    }

    if (filterBuilding) {
      filtered = filtered.filter(c => c.buildingId === parseInt(filterBuilding));
    }

    setFilteredCTOs(filtered);
  };

  const getBuildingName = (buildingId) => {
    const building = buildings.find(b => b.id === buildingId);
    return building?.name || 'Prédio não encontrado';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.code.trim() || !formData.buildingId) {
      alert('Código da caixa e prédio vinculado são obrigatórios');
      return;
    }

    setIsLoading(true);

    try {
      const now = new Date();
      
      if (editingId) {
        // Update
        const updates = {
          ...formData,
          buildingId: parseInt(formData.buildingId),
          ports: formData.ports ? parseInt(formData.ports) : null,
          updatedAt: now,
          syncStatus: 'pending'
        };
        
        await db.ctos.update(editingId, updates);
        await saveSyncQueue('cto', 'update', editingId, updates);
      } else {
        // Create
        const newCTO = {
          ...formData,
          buildingId: parseInt(formData.buildingId),
          ports: formData.ports ? parseInt(formData.ports) : null,
          createdBy: technician.name,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending'
        };
        
        const id = await db.ctos.add(newCTO);
        await saveSyncQueue('cto', 'create', id, newCTO);
      }

      setFormData({ code: '', buildingId: '', ports: '', splitter: '', observations: '' });
      setEditingId(null);
      setShowForm(false);
      await loadData();
    } catch (error) {
      alert('Erro ao salvar caixa CTO');
      console.error('Error saving CTO:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (cto) => {
    setFormData({
      code: cto.code,
      buildingId: cto.buildingId.toString(),
      ports: cto.ports?.toString() || '',
      splitter: cto.splitter || '',
      observations: cto.observations || ''
    });
    setEditingId(cto.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja deletar esta caixa CTO?')) {
      return;
    }

    try {
      const cto = await db.ctos.get(id);
      await db.ctos.delete(id);
      await saveSyncQueue('cto', 'delete', id, { remoteId: cto?.remoteId || null });
      await loadData();
    } catch (error) {
      alert('Erro ao deletar caixa CTO');
      console.error('Error deleting CTO:', error);
    }
  };

  const handleCancel = () => {
    setFormData({ code: '', buildingId: '', ports: '', splitter: '', observations: '' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Caixas CTO</h1>
      </div>

      <div className="page-content">
        <div className="filters-section">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar por código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select 
            className="form-input"
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
          >
            <option value="">Todos os prédios</option>
            {buildings.map(building => (
              <option key={building.id} value={building.id}>
                {building.name}
              </option>
            ))}
          </select>
        </div>

        {filteredCTOs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">Nenhuma caixa CTO encontrada</div>
            <div className="empty-state-text">
              {ctos.length === 0 
                ? 'Comece cadastrando a primeira caixa CTO'
                : 'Nenhum resultado para sua busca'}
            </div>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              ➕ Nova Caixa CTO
            </button>
          </div>
        ) : (
          <>
            <div className="ctos-list">
              {filteredCTOs.map(cto => (
                <div key={cto.id} className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">🔹 {cto.code}</h3>
                      <p className="card-subtitle">📍 {getBuildingName(cto.buildingId)}</p>
                    </div>
                    <span className={`badge badge-${cto.syncStatus === 'pending' ? 'warning' : 'success'}`}>
                      {cto.syncStatus === 'pending' ? '⟳' : '✓'}
                    </span>
                  </div>

                  <div className="cto-details">
                    {cto.ports && (
                      <div className="detail-item">
                        <span className="detail-label">Portas:</span>
                        <span className="detail-value">{cto.ports}</span>
                      </div>
                    )}
                    {cto.splitter && (
                      <div className="detail-item">
                        <span className="detail-label">Splitter:</span>
                        <span className="detail-value">{cto.splitter}</span>
                      </div>
                    )}
                  </div>

                  {cto.observations && (
                    <p className="card-observations">{cto.observations}</p>
                  )}

                  <div className="card-actions">
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleEdit(cto)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(cto.id)}
                    >
                      🗑️ Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky-add-button">
              <button
                className="btn btn-primary btn-block"
                onClick={() => setShowForm(true)}
              >
                ➕ Nova Caixa CTO
              </button>
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingId ? 'Editar Caixa CTO' : 'Nova Caixa CTO'}
              </h2>
              <button className="modal-close" onClick={handleCancel}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Código da Caixa *</label>
                <input
                  type="text"
                  name="code"
                  className="form-input"
                  placeholder="Ex: CTO-001, CTO-A-01"
                  value={formData.code}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prédio Vinculado *</label>
                <select
                  name="buildingId"
                  className="form-input"
                  value={formData.buildingId}
                  onChange={handleInputChange}
                  disabled={isLoading}
                >
                  <option value="">Selecionar um prédio...</option>
                  {buildings.map(building => (
                    <option key={building.id} value={building.id}>
                      {building.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quantidade de Portas</label>
                <input
                  type="number"
                  name="ports"
                  className="form-input"
                  placeholder="Ex: 16, 24, 48"
                  value={formData.ports}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Splitter</label>
                <input
                  type="text"
                  name="splitter"
                  className="form-input"
                  placeholder="Ex: 1:16, 1:32, PLC"
                  value={formData.splitter}
                  onChange={handleInputChange}
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CTOsPage;
