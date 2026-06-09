/**
 * DeadlinesPage — Griglia scadenzari importati da file (ADR-013 §6)
 * Route: /deadlines
 *
 * Mostra tutti i deadline_items dell'org con filtri tipo/file/azienda/stato.
 * Usa DataGridExportable come primo banco prova del componente standard.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DataGridExportable from '../components/DataGridExportable';
import apiService from '../services/apiService';
import { formatDate } from '../utils/dateHelpers';
import './DeadlinesPage.css';

// ?? Semaforo ????????????????????????????????????????????????????????????????

function getSemaforoClass(daysUntilDue) {
  if (daysUntilDue < 0)  return 'dl-red';
  if (daysUntilDue <= 7) return 'dl-red';
  if (daysUntilDue <= 30) return 'dl-orange';
  return 'dl-green';
}

function Semaforo({ daysUntilDue }) {
  const cls  = getSemaforoClass(daysUntilDue);
  const icon = daysUntilDue < 0   ? '\uD83D\uDD34'
             : daysUntilDue <= 7  ? '\uD83D\uDD34'
             : daysUntilDue <= 30 ? '\uD83D\uDFE0'
             : '\uD83D\uDFE2';
  const label = daysUntilDue < 0
    ? `Scaduto da ${Math.abs(daysUntilDue)} gg`
    : `Tra ${daysUntilDue} gg`;
  return (
    <span className={`dl-semaforo ${cls}`} title={label} aria-label={label}>
      {icon}
    </span>
  );
}

// ?? Definizione colonne DataGrid ?????????????????????????????????????????????

const COLUMNS = [
  { id: 'semaforo',             label: '',            width: '44px',  sortable: false, exportSkip: true },
  { id: 'title',                label: 'Oggetto',     width: '1fr',   sortable: true  },
  { id: 'due_date',             label: 'Scadenza',    width: '110px', sortable: true  },
  { id: 'days_until_due',       label: 'Giorni',      width: '80px',  sortable: true  },
  { id: 'category',             label: 'Categoria',   width: '110px', sortable: true  },
  { id: 'source_document_title',label: 'File origine',width: '160px', sortable: true  },
  { id: 'company_name',         label: 'Azienda',     width: '130px', sortable: true  },
  { id: 'status',               label: 'Stato',       width: '100px', sortable: true  },
  { id: 'azioni',               label: '',            width: '80px',  sortable: false, exportSkip: true },
];

const STATUS_LABEL = {
  active:               'Attivo',
  completed:            'Completato',
  dismissed:            'Archiviato',
  expired_acknowledged: 'Preso in carico',
};

// ?? Componente principale ????????????????????????????????????????????????????

function DeadlinesPage() {
  const [items,     setItems]     = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sources,   setSources]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Filtri locali
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('active');
  const [filterSource,  setFilterSource]  = useState('');

  // Stato azioni inline
  const [completing, setCompleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, companiesRes] = await Promise.all([
        apiService.getDeadlineItems({ limit: 500 }),
        apiService.getCompanies(),
      ]);
      const all = itemsRes.data || [];
      setItems(all);
      setCompanies(companiesRes.data || []);

      // Ricava elenco file sorgente unici
      const srcMap = new Map();
      all.forEach(i => {
        if (i.source_document_id && i.source_document_title) {
          srcMap.set(i.source_document_id, i.source_document_title);
        }
      });
      setSources([...srcMap.entries()].map(([id, title]) => ({ id, title })));
    } catch (err) {
      setError(err.message || 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtri applicati lato client
  const filtered = useMemo(() => {
    return items.filter(i => {
      if (filterCompany && String(i.company_id) !== filterCompany) return false;
      if (filterStatus  && i.status !== filterStatus)              return false;
      if (filterSource  && String(i.source_document_id) !== filterSource) return false;
      return true;
    });
  }, [items, filterCompany, filterStatus, filterSource]);

  const handleComplete = useCallback(async (item) => {
    setCompleting(item.id);
    try {
      await apiService.completeDeadlineItem(item.id);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'completed' } : i));
    } catch (err) {
      alert('Errore: ' + err.message);
    } finally {
      setCompleting(null);
    }
  }, []);

  // Renderer celle
  const renderCell = useCallback((row, col) => {
    switch (col.id) {
      case 'semaforo':
        return <Semaforo daysUntilDue={row.days_until_due} />;
      case 'due_date':
        return <span className={`dl-date ${getSemaforoClass(row.days_until_due)}`}>{formatDate(row.due_date)}</span>;
      case 'days_until_due':
        return (
          <span className={`dl-days ${getSemaforoClass(row.days_until_due)}`}>
            {row.days_until_due < 0 ? `${row.days_until_due} gg` : `+${row.days_until_due} gg`}
          </span>
        );
      case 'status':
        return (
          <span className={`dl-status-badge dl-status--${row.status}`}>
            {STATUS_LABEL[row.status] || row.status}
          </span>
        );
      case 'azioni':
        if (row.status !== 'active') return null;
        return (
          <button
            className="dl-complete-btn"
            onClick={() => handleComplete(row)}
            disabled={completing === row.id}
            title="Segna completato"
          >
            {completing === row.id ? '...' : '\u2713 OK'}
          </button>
        );
      default:
        return row[col.id] ?? '-';
    }
  }, [handleComplete, completing]);

  // Export: valore grezzo per colonne speciali
  const getExportValue = useCallback((row, col) => {
    if (col.id === 'due_date')       return row.due_date ? formatDate(row.due_date) : '';
    if (col.id === 'days_until_due') return row.days_until_due;
    if (col.id === 'status')         return STATUS_LABEL[row.status] || row.status;
    return row[col.id];
  }, []);

  // Filtri per DataGridExportable
  const filters = [
    {
      id: 'status',
      label: 'Stato',
      value: filterStatus,
      onChange: setFilterStatus,
      options: [
        { value: '',               label: 'Tutti gli stati' },
        { value: 'active',         label: 'Attivi' },
        { value: 'completed',      label: 'Completati' },
        { value: 'dismissed',      label: 'Archiviati' },
        { value: 'expired_acknowledged', label: 'Presi in carico' },
      ],
    },
    {
      id: 'company',
      label: 'Azienda',
      value: filterCompany,
      onChange: setFilterCompany,
      options: [
        { value: '', label: 'Tutte le aziende' },
        ...companies.map(c => ({ value: String(c.id), label: c.name })),
      ],
    },
    ...(sources.length > 1 ? [{
      id: 'source',
      label: 'File origine',
      value: filterSource,
      onChange: setFilterSource,
      options: [
        { value: '', label: 'Tutti i file' },
        ...sources.map(s => ({ value: String(s.id), label: s.title })),
      ],
    }] : []),
  ];

  // Stats rapide
  const statsActive   = items.filter(i => i.status === 'active').length;
  const statsExpired  = items.filter(i => i.status === 'active' && i.days_until_due < 0).length;
  const statsSoon     = items.filter(i => i.status === 'active' && i.days_until_due >= 0 && i.days_until_due <= 30).length;

  return (
    <div className="dl-page">
      <div className="dl-page-header">
        <h1 className="dl-page-title">Scadenzari da file</h1>
        <p className="dl-page-subtitle">
          Scadenze importate dai file Excel/CSV nel Registro Documenti
        </p>
      </div>

      {/* Stats bar */}
      <div className="dl-stats-bar">
        <div className="dl-stat">
          <span className="dl-stat-num">{statsActive}</span>
          <span className="dl-stat-lbl">Attive</span>
        </div>
        <div className="dl-stat dl-stat--red">
          <span className="dl-stat-num">{statsExpired}</span>
          <span className="dl-stat-lbl">Scadute</span>
        </div>
        <div className="dl-stat dl-stat--orange">
          <span className="dl-stat-num">{statsSoon}</span>
          <span className="dl-stat-lbl">In scadenza 30gg</span>
        </div>
        <div className="dl-stat dl-stat--gray">
          <span className="dl-stat-num">{items.filter(i => i.status === 'completed').length}</span>
          <span className="dl-stat-lbl">Completate</span>
        </div>
      </div>

      {error && (
        <div className="dl-error">Errore: {error} <button onClick={load}>Riprova</button></div>
      )}

      <DataGridExportable
        columns={COLUMNS}
        data={filtered}
        filters={filters}
        exportFileName="scadenzario"
        loading={loading}
        emptyMessage="Nessuna scadenza trovata. Importa un file Excel dal Registro Documenti."
        renderCell={renderCell}
        getExportValue={getExportValue}
        rowClassName={row => getSemaforoClass(row.days_until_due) === 'dl-red' ? 'dl-row--urgent' : ''}
      />
    </div>
  );
}

export default DeadlinesPage;
