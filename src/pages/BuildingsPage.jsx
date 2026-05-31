import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeLogAudit, describeFieldChanges } from '../db/dexie';
import {
  fetchBuildings, createBuilding, updateBuilding, deleteBuilding, fromSupabaseBuilding
} from '../services/supabase';
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
  const location = useLocation();

  useEffect(() => {
    loadBuildings();
    const handleDbUpdate = () => loadBuildings();
    window.addEventListener('db:updated', handleDbUpdate);
    return () => window.removeEventListener('db:updated', handleDbUpdate);
  }, []);

  useEffect(() => {
    if (location.state?.openForm) {
      setShowForm(true);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    const handleNavNew = () => setShowForm(true);
    const handleNavSearch = () => {
      setTimeout(() => document.querySelector('.search-box input')?.focus(), 100);
    };
    window.addEventListener('bottomnav:new', handleNavNew);
    window.addEventListener('bottomnav:search', handleNavSearch);
    return () => {
      window.removeEventListener('bottomnav:new', handleNavNew);
      window.removeEventListener('bottomnav:search', handleNavSearch);
    };
  }, []);

  useEffect(() => {
    filterBuildings();
  }, [buildings, searchTerm]);

  const loadBuildings = async () => {
    try {
      const data = await fetchBuildings();
      setBuildings(data.map(fromSupabaseBuilding));
    } catch (error) {
      console.error('Erro ao carregar prédios:', error);
    }
  };

  const filterBuildings = () => {
    if (!searchTerm.trim()) {
      setFilteredBuildings(buildings);
      return;
    }
    const term = searchTerm.toLowerCase();
    setFilteredBuildings(
      buildings.filter(b =>
        b.name.toLowerCase().includes(term) ||
        b.address.toLowerCase().includes(term)
      )
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Nome do prédio é obrigatório');
      return;
    }
    setIsLoading(true);
    try {
      if (editingId) {
        const building = buildings.find(b => b.id === editingId);
        await updateBuilding(editingId, {
          ...formData,
          createdBy: building?.createdBy,
          createdAt: building?.createdAt
        });
        await safeLogAudit(
          'update_building', technician.name, technician.registration, editingId, null,
          describeFieldChanges(building, formData, { name: 'Nome', address: 'Endereço', observations: 'Observações' })
        );
      } else {
        const result = await createBuilding({ ...formData, createdBy: technician.name });
        await safeLogAudit(
          'create_building', technician.name, technician.registration, result.id, null,
          `Prédio "${formData.name}" criado`
        );
      }
      setFormData({ name: '', address: '', observations: '' });
      setEditingId(null);
      setShowForm(false);
      await loadBuildings();
    } catch (error) {
      const message = error?.code === '23505'
        ? 'Já existe um prédio com esse nome.'
        : `Erro ao salvar prédio: ${error?.message || 'verifique os dados informados'}`;
      alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (building) => {
    setFormData({ name: building.name, address: building.address, observations: building.observations });
    setEditingId(building.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este prédio?')) return;
    try {
      const building = buildings.find(b => b.id === id);
      await deleteBuilding(id);
      await safeLogAudit(
        'delete_building', technician.name, technician.registration, id, null,
        `Prédio "${building?.name || id}" deletado`
      );
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
                <div
                  key={building.id}
                  className="card"
                  onClick={() => handleViewCTOs(building.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <h3 className="building-name">{building.name}</h3>

                  {building.address && (
                    <p className="building-address">📍 {building.address}</p>
                  )}

                  {building.observations && (
                    <p className="building-obs">{building.observations}</p>
                  )}

                  {building.createdBy && (
                    <p className="building-meta">
                      👤 {building.createdBy}
                      {building.createdAt && (
                        <> · {new Date(building.createdAt).toLocaleDateString('pt-BR')}</>
                      )}
                    </p>
                  )}

                  <div className="building-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-primary btn-small btn-view"
                      onClick={() => handleViewCTOs(building.id)}
                    >
                      📦 Ver Caixas
                    </button>
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => handleEdit(building)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(building.id)}
                      title="Deletar prédio"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky-add-button">
              <button className="btn btn-primary btn-block" onClick={() => setShowForm(true)}>
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
              <h2 className="modal-title">{editingId ? 'Editar Prédio' : 'Novo Prédio'}</h2>
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
                <button type="button" className="btn btn-secondary" onClick={handleCancel} disabled={isLoading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
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
