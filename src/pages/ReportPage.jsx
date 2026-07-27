import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ClipboardList, Printer, BarChart3 } from 'lucide-react';
import { fetchBuildings, fetchCTOs, fromSupabaseBuilding, fromSupabaseCTO, isOnline, isSupabaseConfigured } from '../services/supabase';
import './ReportPage.css';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function ReportPage() {
  const [buildings, setBuildings] = useState([]);
  const [ctos, setCTOs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterBuilding, setFilterBuilding] = useState('all');
  const [filterTechnician, setFilterTechnician] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(null);

  useEffect(() => {
    loadData();
    const handleDbUpdate = () => loadData();
    window.addEventListener('db:updated', handleDbUpdate);
    return () => window.removeEventListener('db:updated', handleDbUpdate);
  }, []);

  const loadData = async () => {
    if (!isOnline() || !isSupabaseConfigured()) {
      setError('Conecte-se à internet para gerar o relatório.');
      setIsLoading(false);
      return;
    }
    try {
      const [buildingsData, ctosData] = await Promise.all([fetchBuildings(), fetchCTOs()]);
      setBuildings(buildingsData.map(fromSupabaseBuilding));
      setCTOs(ctosData.map(fromSupabaseCTO));
      setError('');
    } catch (err) {
      console.error('Erro ao carregar relatório:', err);
      setError('Erro ao carregar dados para o relatório.');
    } finally {
      setIsLoading(false);
    }
  };

  const technicianOptions = useMemo(() => {
    const names = new Set();
    buildings.forEach(b => b.createdBy && names.add(b.createdBy));
    ctos.forEach(c => c.createdBy && names.add(c.createdBy));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [buildings, ctos]);

  const withinDateRange = (dateValue) => {
    if (!dateFrom && !dateTo) return true;
    const date = new Date(dateValue);
    if (dateFrom && date < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && date > new Date(`${dateTo}T23:59:59`)) return false;
    return true;
  };

  const matchesTechnician = (createdBy) => filterTechnician === 'all' || createdBy === filterTechnician;

  const filteredBuildings = useMemo(() => {
    return buildings
      .filter(b => filterBuilding === 'all' || String(b.id) === String(filterBuilding))
      .filter(b => matchesTechnician(b.createdBy))
      .filter(b => withinDateRange(b.createdAt))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [buildings, filterBuilding, filterTechnician, dateFrom, dateTo]);

  const getCTOsForBuilding = (buildingId) => {
    return ctos
      .filter(c => String(c.buildingId) === String(buildingId))
      .filter(c => matchesTechnician(c.createdBy))
      .filter(c => withinDateRange(c.createdAt))
      .sort((a, b) => a.code.localeCompare(b.code));
  };

  const totalCTOCount = useMemo(() => {
    return filteredBuildings.reduce((sum, b) => sum + getCTOsForBuilding(b.id).length, 0);
  }, [filteredBuildings, ctos, filterTechnician, dateFrom, dateTo]);

  const handleClearFilters = () => {
    setFilterBuilding('all');
    setFilterTechnician('all');
    setDateFrom('');
    setDateTo('');
  };

  const buildReportText = () => {
    const lines = [];
    lines.push('RELATÓRIO DE PRÉDIOS E CTOs');
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);

    const filterParts = [
      `Prédio: ${filterBuilding === 'all' ? 'Todos' : buildings.find(b => String(b.id) === String(filterBuilding))?.name || '-'}`,
      `Técnico: ${filterTechnician === 'all' ? 'Todos' : filterTechnician}`
    ];
    if (dateFrom || dateTo) {
      filterParts.push(`Período: ${dateFrom ? formatDate(dateFrom) : '-'} a ${dateTo ? formatDate(dateTo) : '-'}`);
    }
    lines.push(`Filtros: ${filterParts.join(' | ')}`);
    lines.push('');
    lines.push(`Total de prédios: ${filteredBuildings.length}`);
    lines.push(`Total de CTOs: ${totalCTOCount}`);
    lines.push('');

    filteredBuildings.forEach(building => {
      const ctosForBuilding = getCTOsForBuilding(building.id);
      lines.push('─'.repeat(48));
      lines.push(`PRÉDIO: ${building.name}`);
      if (building.address) lines.push(`Endereço: ${building.address}`);
      lines.push(`Criado por: ${building.createdBy || '-'} em ${formatDate(building.createdAt)}`);
      if (building.observations) lines.push(`Observações: ${building.observations}`);
      lines.push(`CTOs (${ctosForBuilding.length}):`);
      if (ctosForBuilding.length === 0) {
        lines.push('  Nenhuma CTO corresponde ao filtro.');
      } else {
        ctosForBuilding.forEach(cto => {
          const details = [
            cto.floor && `Andar: ${cto.floor}`,
            cto.power && `Potência: ${cto.power}`,
            cto.ports != null && cto.ports !== '' && `Portas: ${cto.ports}`,
            cto.splitter && `Splitter: ${cto.splitter}`
          ].filter(Boolean).join(' | ');
          lines.push(`  - ${cto.code}${details ? ' | ' + details : ''}`);
        });
      }
      lines.push('');
    });

    return lines.join('\n');
  };

  const handleCopy = async () => {
    const text = buildReportText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback({ success: true, message: 'Relatório copiado!' });
    } catch (err) {
      console.error('Erro ao copiar relatório:', err);
      setCopyFeedback({ success: false, message: 'Não foi possível copiar automaticamente.' });
    } finally {
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Relatório</h1>
      </div>

      <div className="page-content">
        {error && <div className="error-message"><AlertTriangle size={16} /> {error}</div>}

        <div className="report-filters">
          <div className="form-group">
            <label className="form-label">Prédio</label>
            <select className="form-input" value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)}>
              <option value="all">Todos os prédios</option>
              {buildings.slice().sort((a, b) => a.name.localeCompare(b.name)).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Técnico</label>
            <select className="form-input" value={filterTechnician} onChange={(e) => setFilterTechnician(e.target.value)}>
              <option value="all">Todos os técnicos</option>
              {technicianOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">De</label>
            <input type="date" className="form-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Até</label>
            <input type="date" className="form-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="report-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
            Limpar filtros
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleCopy} disabled={isLoading || filteredBuildings.length === 0}>
            <ClipboardList size={15} /> Copiar relatório
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} disabled={isLoading || filteredBuildings.length === 0}>
            <Printer size={15} /> Imprimir
          </button>
        </div>

        {copyFeedback && (
          <div className={`report-copy-feedback ${copyFeedback.success ? 'success' : 'error'}`}>
            {copyFeedback.success ? <Check size={15} /> : <AlertTriangle size={15} />} {copyFeedback.message}
          </div>
        )}

        <div className="report-summary">
          <div className="summary-item">
            <span className="summary-value">{filteredBuildings.length}</span>
            <span className="summary-label">Prédios</span>
          </div>
          <div className="summary-item">
            <span className="summary-value">{totalCTOCount}</span>
            <span className="summary-label">CTOs</span>
          </div>
        </div>

        {isLoading ? (
          <div className="empty-state">
            <div className="empty-state-text">Carregando relatório...</div>
          </div>
        ) : filteredBuildings.length === 0 ? (
          <div className="empty-state">
            <BarChart3 className="empty-state-icon" size={40} strokeWidth={1.5} />
            <div className="empty-state-title">Nenhum resultado</div>
            <div className="empty-state-text">Ajuste os filtros para ver prédios e CTOs no relatório.</div>
          </div>
        ) : (
          <div className="report-list">
            {filteredBuildings.map(building => {
              const ctosForBuilding = getCTOsForBuilding(building.id);
              return (
                <div key={building.id} className="card report-card">
                  <div className="report-building-header">
                    <span className="report-building-name">{building.name}</span>
                    {building.address && <span className="report-building-address">{building.address}</span>}
                    <span className="badge badge-primary report-building-count">{ctosForBuilding.length} CTO{ctosForBuilding.length !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="report-building-meta">Criado por {building.createdBy || '-'} em {formatDate(building.createdAt)}</p>
                  {building.observations && <p className="card-observations">{building.observations}</p>}

                  {ctosForBuilding.length > 0 && (
                    <div className="report-cto-list">
                      {ctosForBuilding.map(cto => {
                        const meta = [
                          cto.floor && `Andar ${cto.floor}`,
                          cto.power && `Potência ${cto.power}`,
                          cto.ports != null && cto.ports !== '' && `${cto.ports} portas`,
                          cto.splitter && `Splitter ${cto.splitter}`
                        ].filter(Boolean).join('  ·  ');
                        return (
                          <div key={cto.id} className="report-cto-row">
                            <span className="report-cto-code">{cto.code}</span>
                            {meta && <span className="report-cto-meta">{meta}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportPage;
