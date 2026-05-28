import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveSyncQueue } from '../db/dexie';
import './BuildingsPage.css';

function BuildingsPage({ technician }) {
  const [buildings, setBuildings] = useState([]);
  const [filteredBuildings, setFilteredBuildings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', observations: '' });
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBuildings();
  }, []);

  useEffect(() => {
    filterBuildings();
  }, [buildings, searchTerm]);

  const loadBuildings = async () => {
    try {
      const data = await db.buildings.toArray();
      setBuildings(data);
    } catch (error) {
      console.error('Error loading buildings:', error);
    }
  };

  const filterBuildings = () => {
    if (!searchTerm.trim()) {
      setFilteredBuildings(buildings);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = buildings.filter(b =>
      b.name.toLowerCase().includes(term) ||
      b.address.toLowerCase().includes(term)
    );
    setFilteredBuildings(filtered);
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
    
    if (!formData.name.trim()) {
      alert('Nome do prédio é obrigatório');
      return;
    }

    setIsLoading(true);

    try {
      const now = new Date();
      
      if (editingId) {
        // Update
        const building = await db.buildings.get(editingId);
        const updates = {
          ...formData,
          updatedAt: now,
          syncStatus: 'pending'
        };
        
        await db.buildings.update(editingId, updates);
        await saveSyncQueue('building', 'update', editingId, updates);
      } else {
        // Create
        const newBuilding = {
          ...formData,
          createdBy: technician.name,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending'
        };
        
        const id = await db.buildings.add(newBuilding);
        await saveSyncQueue('building', 'create', id, newBuilding);
      }

      setFormData({ name: '', address: '', observations: '' });
      setEditingId(null);
      setShowForm(false);
      await loadBuildings();
    } catch (error) {
      alert('Erro ao salvar prédio');
      console.error('Error saving building:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (building) => {
    setFormData({
      name: building.name,
      address: building.address,
      observations: building.observations
    });
    setEditingId(building.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este prédio?')) {
      return;
    }

    try {
      const building = await db.buildings.get(id);
      await db.buildings.delete(id);
      await saveSyncQueue('building', 'delete', id, { remoteId: building?.remoteId || null });
      await loadBuildings();
    } catch (error) {
      alert('Erro ao deletar prédio');
      console.error('Error deleting building:', error);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', address: '', observations: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleViewCTOs = (buildingId) => {
    navigate(`/buildings/${buildingId}`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Prédios</h1>
      </div>

      <div className="page-content">
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar por nome ou endereço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredBuildings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <div className="empty-state-title">Nenhum prédio encontrado</div>
            <div className="empty-state-text">
              {buildings.length === 0 
                ? 'Comece cadastrando o primeiro prédio'
                : 'Nenhum resultado para sua busca'}
            </div>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              ➕ Novo Prédio
            </button>
          </div>
        ) : (
          <>
            <div className="buildings-list">
              {filteredBuildings.map(building => (
                <div key={building.id} className="card">
                  <div className="card-header">
                    <div onClick={() => handleViewCTOs(building.id)} style={{ cursor: 'pointer', flex: 1 }}>
                      <h3 className="card-title">{building.name}</h3>
                      {building.address && (
                        <p className="card-subtitle">📍 {building.address}</p>
                      )}
                    </div>
                    <span className={`badge badge-${building.syncStatus === 'pending' ? 'warning' : 'success'}`}>
                      {building.syncStatus === 'pending' ? '⟳ Não sincronizado' : '✓ Sincronizado'}
                    </span>
                  </div>

                  {building.observations && (
                    <p className="card-observations">{building.observations}</p>
                  )}

                  <div className="card-actions">
                    <button
                      className="btn btn-primary btn-small"
                      onClick={() => handleViewCTOs(building.id)}
                    >
                      📦 Ver Caixas
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleEdit(building)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(building.id)}
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
                ➕ Novo Prédio
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
                {editingId ? 'Editar Prédio' : 'Novo Prédio'}
              </h2>
              <button className="modal-close" onClick={handleCancel}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nome do Prédio *</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="Ex: Prédio A, Torre Principal"
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Endereço</label>
                <input
                  type="text"
                  name="address"
                  className="form-input"
                  placeholder="Ex: Rua das Flores, 123"
                  value={formData.address}
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

export default BuildingsPage;
