import { useState, useEffect } from 'react';
import { safeLogAudit, describeFieldChanges } from '../db/dexie';
import {
  fetchBuildings, fetchCTOs, createCTO, updateCTO, deleteCTO,
  fromSupabaseBuilding, fromSupabaseCTO
} from '../services/supabase';
import './CTOsPage.css';

function CTOsPage({ technician }) {
  const [buildings, setBuildings] = useState([]);
  const [ctos, setCTOs] = useState([]);
  const [filteredCTOs, setFilteredCTOs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '', buildingId: '', ports: '', splitter: '', observations: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadData();
    const handleDbUpdate = () => loadData();
    window.addEventListener('db:updated', handleDbUpdate);
    return () => window.removeEventListener('db:updated', handleDbUpdate);
  }, []);

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
    filterCTOs();
  }, [ctos, searchTerm, filterBuilding]);

  const loadData = async () => {
    try {
      const [buildingsData, ctosData] = await Promise.all([fetchBuildings(), fetchCTOs()]);
      setBuildings(buildingsData.map(fromSupabaseBuilding));
      setCTOs(ctosData.map(fromSupabaseCTO));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const filterCTOs = () => {
    let filtered = ctos;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => c.code.toLowerCase().includes(term));
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
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.buildingId) {
      alert('Código da caixa e prédio vinculado são obrigatórios');
      return;
    }
    setIsLoading(true);
    try {
      const buildingId = parseInt(formData.buildingId);
      const fields = {
        ...formData,
        buildingId,
        ports: formData.ports ? parseInt(formData.ports) : null
      };

      if (editingId) {
        const cto = ctos.find(c => c.id === editingId);
        await updateCTO(editingId, { ...fields, createdBy: cto?.createdBy, createdAt: cto?.createdAt }, buildingId);
        await safeLogAudit(
          'update_cto', technician.name, technician.registration, buildingId, editingId,
          describeFieldChanges(cto, fields, { code: 'Código', splitter: 'Splitter', observations: 'Observações' })
        );
      } else {
        const result = await createCTO({ ...fields, createdBy: technician.name }, buildingId);
        await safeLogAudit(
          'create_cto', technician.name, technician.registration, buildingId, result.id,
          `Caixa ${formData.code} criada`
        );
      }

      setFormData({ code: '', buildingId: '', ports: '', splitter: '', observations: '' });
      setEditingId(null);
      setShowForm(false);
      await loadData();
    } catch (error) {
      const message = error?.code === '23505'
        ? 'Já existe uma CTO com esse código.'
        : `Erro ao salvar caixa CTO: ${error?.message || ''}`;
      alert(message);
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
    if (!confirm('Tem certeza que deseja deletar esta caixa CTO?')) return;
    try {
      const cto = ctos.find(c => c.id === id);
      await deleteCTO(id);
      await safeLogAudit(
        'delete_cto', technician.name, technician.registration,
        cto?.buildingId || null, id,
        `Caixa ${cto?.code || id} deletada`
      );
      await loadData();
    } catch (error) {
      alert('Erro ao deletar caixa CTO');
      console.error(error);
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
              <option key={building.id} value={building.id}>{building.name}</option>
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
                    <span className="badge badge-success">✓</span>
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
                    <button className="btn btn-secondary btn-small" onClick={() => handleEdit(cto)}>
                      ✏️ Editar
                    </button>
                    <button className="btn btn-danger btn-small" onClick={() => handleDelete(cto.id)}>
                      🗑️ Deletar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="sticky-add-button">
              <button className="btn btn-primary btn-block" onClick={() => setShowForm(true)}>
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
              <h2 className="modal-title">{editingId ? 'Editar Caixa CTO' : 'Nova Caixa CTO'}</h2>
              <button className="modal-close" onClick={handleCancel}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Código *</label>
                <input type="text" name="code" className="form-input"
                  placeholder="Ex: CTO-001" value={formData.code}
                  onChange={handleInputChange} disabled={isLoading} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Prédio *</label>
                <select name="buildingId" className="form-input"
                  value={formData.buildingId} onChange={handleInputChange} disabled={isLoading}>
                  <option value="">Selecione o prédio</option>
                  {buildings.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Portas</label>
                <input type="number" name="ports" className="form-input"
                  placeholder="Ex: 8, 16, 32" value={formData.ports}
                  onChange={handleInputChange} disabled={isLoading} />
              </div>
              <div className="form-group">
                <label className="form-label">Splitter</label>
                <input type="text" name="splitter" className="form-input"
                  placeholder="Ex: 1:8, 1:16" value={formData.splitter}
                  onChange={handleInputChange} disabled={isLoading} />
              </div>
              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea name="observations" className="form-input form-textarea"
                  placeholder="Anotações adicionais..." value={formData.observations}
                  onChange={handleInputChange} disabled={isLoading} />
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

export default CTOsPage;
