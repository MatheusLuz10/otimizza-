import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Package, Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { safeLogAudit, describeFieldChanges } from '../db/dexie';
import {
  fetchBuildings, fetchCTOsByBuilding, createCTO, updateCTO, deleteCTO,
  fromSupabaseBuilding, fromSupabaseCTO
} from '../services/supabase';
import './BuildingDetailPage.css';

const EMPTY_ROW = () => ({ code: '', floor: '' });
const EMPTY_SHARED = { power: '', splitter: '', technicalInfo: '', observations: '' };
const EMPTY_EDIT = { code: '', floor: '', power: '', splitter: '', technicalInfo: '', observations: '' };

function BuildingDetailPage({ technician }) {
  const { id } = useParams();
  const buildingId = parseInt(id);
  const navigate = useNavigate();

  const [building, setBuilding] = useState(null);
  const [ctos, setCTOs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCTOForm, setShowCTOForm] = useState(false);
  const [editingCTOId, setEditingCTOId] = useState(null);

  // Formulário de edição — único CTO
  const [editData, setEditData] = useState(EMPTY_EDIT);

  // Formulário de criação — múltiplas linhas
  const [formRows, setFormRows] = useState([EMPTY_ROW()]);
  const [sharedFields, setSharedFields] = useState(EMPTY_SHARED);

  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // { ok, failed }
  const firstCodeRef = useRef(null);

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    const handleDbUpdate = () => loadData();
    const handleNavNew = () => openCreateForm();
    window.addEventListener('db:updated', handleDbUpdate);
    window.addEventListener('bottomnav:new', handleNavNew);
    return () => {
      window.removeEventListener('db:updated', handleDbUpdate);
      window.removeEventListener('bottomnav:new', handleNavNew);
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allBuildings, ctosData] = await Promise.all([
        fetchBuildings(),
        fetchCTOsByBuilding(buildingId)
      ]);
      const found = allBuildings.find(b => b.id === buildingId);
      setBuilding(found ? fromSupabaseBuilding(found) : null);
      setCTOs(ctosData.map(fromSupabaseCTO).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      navigate('/buildings');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Abrir / fechar formulário ──────────────────────────────────── */

  const openCreateForm = () => {
    setEditingCTOId(null);
    setFormRows([EMPTY_ROW()]);
    setSharedFields(EMPTY_SHARED);
    setSaveResult(null);
    setShowCTOForm(true);
    setTimeout(() => firstCodeRef.current?.focus(), 80);
  };

  // Strip "GP" prefix when loading for edit so user only sees the number
  const stripGP = (code) => code?.toUpperCase().startsWith('GP') ? code.slice(2) : (code || '');

  const openEditForm = (cto) => {
    setEditingCTOId(cto.id);
    setEditData({
      code: stripGP(cto.code),
      floor: cto.floor || '',
      power: cto.power || '',
      splitter: cto.splitter || '',
      technicalInfo: cto.technicalInfo || '',
      observations: cto.observations || ''
    });
    setSaveResult(null);
    setShowCTOForm(true);
  };

  const closeForm = () => {
    setShowCTOForm(false);
    setEditingCTOId(null);
    setFormRows([EMPTY_ROW()]);
    setSharedFields(EMPTY_SHARED);
    setEditData(EMPTY_EDIT);
    setSaveResult(null);
  };

  /* ── Gerenciar linhas (criar múltiplas) ─────────────────────────── */

  const addRow = () => setFormRows(prev => [...prev, EMPTY_ROW()]);

  const removeRow = (idx) => {
    if (formRows.length === 1) return;
    setFormRows(prev => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    // Strip any accidental "GP" prefix the user might type in the code field
    const clean = field === 'code'
      ? value.toUpperCase().replace(/^GP/i, '')
      : value.toUpperCase();
    setFormRows(prev => prev.map((row, i) => i === idx ? { ...row, [field]: clean } : row));
  };

  /* ── Salvar (criar múltiplos) ───────────────────────────────────── */

  const handleCreateCTOs = async (e) => {
    e.preventDefault();
    const validRows = formRows.filter(r => r.code.trim());
    if (validRows.length === 0) {
      alert('Informe ao menos um código de caixa.');
      return;
    }
    setIsSaving(true);
    setSaveResult(null);

    const results = await Promise.allSettled(
      validRows.map(async (row) => {
        const fullCode = 'GP' + row.code.trim();
        const cto = await createCTO({
          code: fullCode,
          floor: row.floor.trim().toUpperCase() || null,
          power: sharedFields.power.toUpperCase() || null,
          splitter: sharedFields.splitter.toUpperCase() || null,
          technicalInfo: sharedFields.technicalInfo.toUpperCase() || null,
          observations: sharedFields.observations.toUpperCase() || null,
          createdBy: technician.name
        }, buildingId);
        await safeLogAudit(
          'create_cto', technician.name, technician.registration, buildingId, cto.id,
          `Caixa ${fullCode} criada${row.floor ? ` — ${row.floor}` : ''}`
        );
        return cto;
      })
    );

    const ok = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected');

    setSaveResult({ ok, failed: failed.length });
    setIsSaving(false);

    if (ok > 0) {
      await loadData();
      if (failed.length === 0) closeForm();
      else {
        // Remove linhas que criaram com sucesso, mantém as que falharam
        const failedIndexes = failed.map((_, i) => {
          const rejIdx = results.findIndex((r, ri) => r.status === 'rejected' && ri >= i);
          return rejIdx;
        });
        setFormRows(prev => prev.filter((_, i) => failedIndexes.includes(i)));
      }
    }
  };

  /* ── Salvar (editar único) ──────────────────────────────────────── */

  const handleEditCTO = async (e) => {
    e.preventDefault();
    if (!editData.code.trim()) { alert('Código da caixa é obrigatório'); return; }
    setIsSaving(true);
    try {
      const previousCTO = ctos.find(c => c.id === editingCTOId);
      await updateCTO(editingCTOId, {
        ...editData,
        code: 'GP' + editData.code.trim(),
        floor: editData.floor.toUpperCase() || null,
        power: editData.power.toUpperCase() || null,
        splitter: editData.splitter.toUpperCase() || null,
        technicalInfo: editData.technicalInfo.toUpperCase() || null,
        observations: editData.observations.toUpperCase() || null,
        createdBy: previousCTO?.createdBy,
        createdAt: previousCTO?.createdAt
      }, buildingId);
      await safeLogAudit(
        'update_cto', technician.name, technician.registration, buildingId, editingCTOId,
        describeFieldChanges(previousCTO, editData, {
          code: 'Código', floor: 'Andar', power: 'Potência',
          splitter: 'Splitter', technicalInfo: 'Info técnica', observations: 'Observações'
        })
      );
      closeForm();
      await loadData();
    } catch (error) {
      const message = error?.code === '23505'
        ? 'Já existe uma caixa com esse código.'
        : `Erro ao salvar: ${error?.message || ''}`;
      alert(message);
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Deletar ────────────────────────────────────────────────────── */

  const handleDeleteCTO = async (ctoId, ctoCode) => {
    if (!confirm(`Deletar caixa ${ctoCode}?`)) return;
    try {
      await deleteCTO(ctoId);
      await safeLogAudit(
        'delete_cto', technician.name, technician.registration, buildingId, ctoId,
        `Caixa ${ctoCode} deletada`
      );
      await loadData();
    } catch (error) {
      alert('Erro ao deletar caixa');
    }
  };

  /* ── Render ─────────────────────────────────────────────────────── */

  if (isLoading) return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/buildings')}><ArrowLeft size={16} /> Voltar</button>
        <h1 className="page-title">Carregando...</h1>
      </div>
    </div>
  );

  if (!building) return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/buildings')}><ArrowLeft size={16} /> Voltar</button>
        <h1 className="page-title">Prédio não encontrado</h1>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <button className="btn-back" onClick={() => navigate('/buildings')}><ArrowLeft size={16} /> Voltar</button>
        <h1 className="page-title">{building.name}</h1>
      </div>

      <div className="page-content">
        <div className="building-info-card">
          <h2 className="building-name">{building.name}</h2>
          {building.address && <p className="building-address"><MapPin size={13} /> {building.address}</p>}
          {building.observations && (
            <div className="building-observations">
              <h4>Observações</h4>
              <p>{building.observations}</p>
            </div>
          )}
          <div className="building-meta">
            <div className="meta-item">
              <span className="meta-label">Técnico</span>
              <span className="meta-value">{building.createdBy || '—'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Criado em</span>
              <span className="meta-value">{new Date(building.createdAt).toLocaleDateString('pt-BR')}</span>
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
            <button className="btn btn-primary btn-sm" onClick={openCreateForm}>
              <Plus size={15} /> Nova Caixa
            </button>
          </div>

          {ctos.length === 0 ? (
            <div className="empty-state">
              <Package className="empty-state-icon" size={40} strokeWidth={1.5} />
              <div className="empty-state-title">Nenhuma caixa CTO</div>
              <div className="empty-state-text">Adicione a primeira caixa para este prédio</div>
            </div>
          ) : (
            <div className="ctos-list">
              {ctos.map(cto => (
                <div key={cto.id} className="cto-row">
                  <div className="cto-row-body">
                    <span className="cto-row-code">{cto.code}</span>
                    <div className="cto-row-tags">
                      {cto.floor    && <span className="cto-tag cto-tag-floor"><MapPin size={11} /> {cto.floor}</span>}
                      {cto.splitter && <span className="cto-tag">{cto.splitter}</span>}
                      {cto.power    && <span className="cto-tag">{cto.power}</span>}
                    </div>
                    {(cto.technicalInfo || cto.observations) && (
                      <p className="cto-row-extra">
                        {cto.technicalInfo || cto.observations}
                      </p>
                    )}
                  </div>
                  <div className="cto-row-actions">
                    <button className="icon-btn icon-btn-edit" onClick={() => openEditForm(cto)} title="Editar" aria-label="Editar">
                      <Pencil size={15} />
                    </button>
                    <button className="icon-btn icon-btn-delete" onClick={() => handleDeleteCTO(cto.id, cto.code)} title="Deletar" aria-label="Deletar">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL CRIAR (múltiplas caixas) ── */}
      {showCTOForm && !editingCTOId && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nova(s) Caixa(s) CTO</h2>
              <button className="modal-close" onClick={closeForm}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateCTOs}>
              {/* Linhas de código + andar */}
              <div className="batch-label">Caixas</div>
              <div className="batch-rows">
                {formRows.map((row, idx) => (
                  <div key={idx} className="batch-row">
                    <div className="prefix-input-wrapper batch-code">
                      <span className="input-prefix">GP</span>
                      <input
                        ref={idx === 0 ? firstCodeRef : null}
                        type="text"
                        className="input-after-prefix"
                        placeholder="001"
                        value={row.code}
                        onChange={(e) => updateRow(idx, 'code', e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <input
                      type="text"
                      className="form-input batch-floor"
                      placeholder="Andar"
                      value={row.floor}
                      onChange={(e) => updateRow(idx, 'floor', e.target.value)}
                      disabled={isSaving}
                    />
                    {formRows.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-row"
                        onClick={() => removeRow(idx)}
                        disabled={isSaving}
                        title="Remover linha"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn-add-row"
                onClick={addRow}
                disabled={isSaving}
              >
                <Plus size={14} /> Adicionar andar
              </button>

              {/* Campos comuns */}
              <div className="shared-section-label">Dados comuns (opcionais)</div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Potência</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="EX: -18 DBM"
                    value={sharedFields.power}
                    onChange={(e) => setSharedFields(p => ({ ...p, power: e.target.value.toUpperCase() }))}
                    disabled={isSaving}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Splitter</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="EX: 1:8"
                    value={sharedFields.splitter}
                    onChange={(e) => setSharedFields(p => ({ ...p, splitter: e.target.value.toUpperCase() }))}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Informações Técnicas</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="FIBRA PRINCIPAL ATIVA, RESERVA DISPONÍVEL..."
                  value={sharedFields.technicalInfo}
                  onChange={(e) => setSharedFields(p => ({ ...p, technicalInfo: e.target.value.toUpperCase() }))}
                  disabled={isSaving}
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="ANOTAÇÕES ADICIONAIS..."
                  value={sharedFields.observations}
                  onChange={(e) => setSharedFields(p => ({ ...p, observations: e.target.value.toUpperCase() }))}
                  disabled={isSaving}
                  rows="2"
                />
              </div>

              {saveResult && (
                <div className={`batch-result ${saveResult.failed > 0 ? 'partial' : 'success'}`}>
                  {saveResult.ok > 0 && (
                    <span className="batch-result-line"><Check size={14} /> {saveResult.ok} caixa(s) criada(s).</span>
                  )}
                  {saveResult.failed > 0 && (
                    <span className="batch-result-line"><X size={14} /> {saveResult.failed} falhou (código duplicado?).</span>
                  )}
                </div>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={isSaving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving
                    ? 'Salvando...'
                    : `Criar ${formRows.filter(r => r.code.trim()).length || ''} caixa(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR (único CTO) ── */}
      {showCTOForm && editingCTOId && (
        <div className="modal-overlay" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Editar Caixa CTO</h2>
              <button className="modal-close" onClick={closeForm}><X size={18} /></button>
            </div>

            <form onSubmit={handleEditCTO}>
              <div className="form-group">
                <label className="form-label">Código *</label>
                <div className="prefix-input-wrapper">
                  <span className="input-prefix">GP</span>
                  <input
                    type="text"
                    className="input-after-prefix"
                    placeholder="001"
                    value={editData.code}
                    onChange={(e) => setEditData(p => ({ ...p, code: e.target.value.toUpperCase().replace(/^GP/i, '') }))}
                    disabled={isSaving}
                    autoFocus
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Andar</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="EX: 7º ANDAR"
                    value={editData.floor}
                    onChange={(e) => setEditData(p => ({ ...p, floor: e.target.value.toUpperCase() }))}
                    disabled={isSaving}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Potência</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="EX: -18 DBM"
                    value={editData.power}
                    onChange={(e) => setEditData(p => ({ ...p, power: e.target.value.toUpperCase() }))}
                    disabled={isSaving}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Splitter</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="EX: 1:8, 1:16"
                  value={editData.splitter}
                  onChange={(e) => setEditData(p => ({ ...p, splitter: e.target.value.toUpperCase() }))}
                  disabled={isSaving}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Informações Técnicas</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="FIBRA PRINCIPAL ATIVA..."
                  value={editData.technicalInfo}
                  onChange={(e) => setEditData(p => ({ ...p, technicalInfo: e.target.value.toUpperCase() }))}
                  disabled={isSaving}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="ANOTAÇÕES ADICIONAIS..."
                  value={editData.observations}
                  onChange={(e) => setEditData(p => ({ ...p, observations: e.target.value.toUpperCase() }))}
                  disabled={isSaving}
                  rows="2"
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={isSaving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Atualizar'}
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
