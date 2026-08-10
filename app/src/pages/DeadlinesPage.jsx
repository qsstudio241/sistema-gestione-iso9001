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
import { useRouter } from '../contexts/RouterContext';
import { formatDate } from '../utils/dateHelpers';
import { buildDocumentRegistryPath } from '../utils/documentRegistryUrl';
import './DeadlinesPage.css';

// Semaforo

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

// Definizione colonne DataGrid

const COLUMNS = [
  { id: 'semaforo',             label: '',            width: '44px',  sortable: false, exportSkip: true },
  { id: 'title',                label: 'Oggetto',     width: '1fr',   sortable: true  },
  { id: 'due_date',             label: 'Scadenza',    width: '110px', sortable: true  },
  { id: 'days_until_due',       label: 'Giorni',      width: '80px',  sortable: true  },
  { id: 'category',             label: 'Categoria',   width: '110px', sortable: true  },
  { id: 'source_document_title',label: 'File origine',width: '160px', sortable: true  },
  { id: 'company_name',         label: 'Azienda',     width: '130px', sortable: true  },
  { id: 'status',               label: 'Stato',       width: '100px', sortable: true  },
  { id: 'azioni',               label: '',            width: '220px', sortable: false, exportSkip: true },
];

const STATUS_LABEL = {
  active:               'Attivo',
  completed:            'Completato',
  dismissed:            'Archiviato',
  expired_acknowledged: 'Preso in carico',
};

// Limite di pagina iniziale e tetto di sicurezza per il refetch completo
// (v. commento in load()) — evita richieste illimitate in caso di dataset
// anomali.
const DEADLINES_PAGE_LIMIT = 500;
const DEADLINES_SAFETY_MAX_LIMIT = 5000;

// Componente principale

function DeadlinesPage() {
  const { navigate } = useRouter();
  const [items,     setItems]     = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sources,   setSources]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Filtri locali
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('active');
  const [filterDue,     setFilterDue]     = useState('');
  const [filterSource,  setFilterSource]  = useState('');

  // Stato azioni inline
  const [completing, setCompleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, companiesRes] = await Promise.all([
        apiService.getDeadlineItems({ limit: DEADLINES_PAGE_LIMIT }),
        apiService.getCompanies(),
      ]);
      let all = itemsRes.data || [];

      // Le card statistiche e i filtri lavorano sull'intero dataset ricevuto
      // (client-side by design — v. commento sotto ai filtri). Se l'org supera
      // il limite di pagina, pagination.total lo rivela: un solo refetch con
      // limit = total evita conteggi/filtri silenziosamente incompleti, senza
      // introdurre paginazione multi-pagina (che duplicherebbe le righe
      // virtuali qualifiche/tarature, ricalcolate per intero ad ogni pagina).
      const total = itemsRes.pagination?.total;
      if (typeof total === 'number' && total > all.length) {
        const safeLimit = Math.min(total, DEADLINES_SAFETY_MAX_LIMIT);
        try {
          const fullRes = await apiService.getDeadlineItems({ limit: safeLimit });
          all = fullRes.data || all;
        } catch (refetchErr) {
          console.warn('[DeadlinesPage] refetch completo fallito, dataset potrebbe essere parziale:', refetchErr.message);
        }
      }

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
  const matchesBaseFilters = useCallback((item) => {
    if (filterCompany && String(item.company_id) !== filterCompany) return false;
    if (filterSource && String(item.source_document_id) !== filterSource) return false;
    return true;
  }, [filterCompany, filterSource]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (!matchesBaseFilters(i)) return false;
      if (filterStatus && i.status !== filterStatus) return false;
      if (filterDue === 'expired' && i.days_until_due >= 0) return false;
      if (filterDue === 'soon' && (i.days_until_due < 0 || i.days_until_due > 30)) return false;
      return true;
    });
  }, [items, matchesBaseFilters, filterStatus, filterDue]);

  const openSourceDocument = useCallback((item) => {
    const sourceId = Number(item?.source_document_id);
    if (!sourceId || Number.isNaN(sourceId)) return;
    navigate(buildDocumentRegistryPath({ selectId: sourceId, companyId: item?.company_id || null }));
  }, [navigate]);

  const getActiveCard = useCallback(() => {
    if (filterStatus === 'active' && filterDue === 'expired') return 'expired';
    if (filterStatus === 'active' && filterDue === 'soon') return 'soon';
    if (filterStatus === 'active' && !filterDue) return 'active';
    if (filterStatus === 'completed' && !filterDue) return 'completed';
    if (filterStatus === 'dismissed' && !filterDue) return 'dismissed';
    if (filterStatus === 'expired_acknowledged' && !filterDue) return 'acknowledged';
    return null;
  }, [filterStatus, filterDue]);

  // Un solo punto di controllo per il filtro "situazione": ogni valore lifecycle
  // reale (active/completed/dismissed/expired_acknowledged) ha la sua card — non
  // reintrodurre una tendina "Stato" parallela (v. sgq-operating-memory.mdc §
  // Filtri: singola fonte di verità).
  const handleCardFilter = useCallback((card) => {
    if (getActiveCard() === card) {
      setFilterStatus('');
      setFilterDue('');
      return;
    }
    if (card === 'active') {
      setFilterStatus('active');
      setFilterDue('');
    } else if (card === 'expired') {
      setFilterStatus('active');
      setFilterDue('expired');
    } else if (card === 'soon') {
      setFilterStatus('active');
      setFilterDue('soon');
    } else if (card === 'completed') {
      setFilterStatus('completed');
      setFilterDue('');
    } else if (card === 'dismissed') {
      setFilterStatus('dismissed');
      setFilterDue('');
    } else if (card === 'acknowledged') {
      setFilterStatus('expired_acknowledged');
      setFilterDue('');
    }
  }, [getActiveCard]);

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

  // Generalizza il pattern di handleComplete per gli altri due stati lifecycle
  // (dismissed/expired_acknowledged): senza questa azione le card "Archiviate"/
  // "Prese in carico" filtrano correttamente ma nessuna riga può mai arrivarci
  // (bug di completezza post PR #371 — v. GUIDA_CONSOLIDATA.md).
  const handleSetStatus = useCallback(async (item, newStatus) => {
    setCompleting(item.id);
    try {
      await apiService.updateDeadlineItem(item.id, { status: newStatus });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
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
      case 'source_document_title': {
        if (row.item_type === 'qualification' && row.qualification_id) {
          return (
            <button
              type="button"
              className="dl-source-link"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/qualifiche?company_id=${row.company_id || ''}&highlight=${row.qualification_id}&section=conferma`);
              }}
              title="Apri nel registro qualifiche"
            >
              {row.source_document_title || 'Registro qualifiche'}
            </button>
          );
        }
        if (!row.source_document_id) return row.source_document_title || '-';
        return (
          <button
            type="button"
            className="dl-source-link"
            onClick={(event) => {
              event.stopPropagation();
              openSourceDocument(row);
            }}
            title="Apri il file origine nel Registro Documenti"
          >
            {row.source_document_title || `Documento #${row.source_document_id}`}
          </button>
        );
      }
      case 'azioni':
        if (row.item_type === 'qualification') {
          return (
            <button
              type="button"
              className="dl-complete-btn"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/qualifiche?company_id=${row.company_id || ''}&highlight=${row.qualification_id}&section=conferma`);
              }}
              title="Apri qualifica"
            >
              {'\u2192'}
            </button>
          );
        }
        // Le righe virtuali tarature (item_type='equipment') non sono record
        // di deadline_items: completeDeadlineItem(item.id) fallirebbe (l'id è
        // "equipment_N", non un id numerico reale). La taratura si aggiorna
        // dal modulo Strumenti e Attrezzature, non da qui.
        if (row.item_type === 'equipment') return null;
        if (row.status !== 'active') return null;
        return (
          <div className="dl-actions-group">
            <button
              type="button"
              className="dl-complete-btn"
              onClick={(event) => {
                event.stopPropagation();
                handleComplete(row);
              }}
              disabled={completing === row.id}
              title="Segna completato"
            >
              {completing === row.id ? '...' : '\u2713 OK'}
            </button>
            {/* "Prendi in carico" ha senso solo su scadenze già scadute: su una
                scadenza futura non ancora superata non esiste nulla "da prendere
                in carico" (si userebbe direttamente OK quando risolta). */}
            {row.days_until_due < 0 && (
              <button
                type="button"
                className="dl-complete-btn dl-ack-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSetStatus(row, 'expired_acknowledged');
                }}
                disabled={completing === row.id}
                title="Prendi in carico (scadenza in gestione, non ancora risolta)"
              >
                Prendi in carico
              </button>
            )}
            <button
              type="button"
              className="dl-complete-btn dl-dismiss-btn"
              onClick={(event) => {
                event.stopPropagation();
                handleSetStatus(row, 'dismissed');
              }}
              disabled={completing === row.id}
              title="Archivia (non più rilevante)"
            >
              Archivia
            </button>
          </div>
        );
      default:
        return row[col.id] ?? '-';
    }
  }, [handleComplete, handleSetStatus, completing, openSourceDocument, navigate]);

  // Export: valore grezzo per colonne speciali
  const getExportValue = useCallback((row, col) => {
    if (col.id === 'due_date')       return row.due_date ? formatDate(row.due_date) : '';
    if (col.id === 'days_until_due') return row.days_until_due;
    if (col.id === 'status')         return STATUS_LABEL[row.status] || row.status;
    return row[col.id];
  }, []);

  // Filtri per DataGridExportable — niente più tendina "Stato": ogni valore
  // lifecycle ha ora la sua card statistica cliccabile (v. sotto), unico punto
  // di controllo per questa dimensione di filtro.
  const filters = [
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

  // Stats rapide, calcolate sull'ambito corrente (azienda/file) come nel modulo NC.
  const statsBase      = items.filter(matchesBaseFilters);
  const statsActive    = statsBase.filter(i => i.status === 'active').length;
  const statsExpired   = statsBase.filter(i => i.status === 'active' && i.days_until_due < 0).length;
  const statsSoon      = statsBase.filter(i => i.status === 'active' && i.days_until_due >= 0 && i.days_until_due <= 30).length;
  const statsCompleted = statsBase.filter(i => i.status === 'completed').length;
  const statsDismissed = statsBase.filter(i => i.status === 'dismissed').length;
  const statsAcknowledged = statsBase.filter(i => i.status === 'expired_acknowledged').length;
  const activeCard     = getActiveCard();

  return (
    <div className="dl-page">
      <div className="dl-page-header">
        <h1 className="dl-page-title">Scadenzari da file</h1>
        <p className="dl-page-subtitle">
          Scadenze importate dai file Excel/CSV nel Registro Documenti
        </p>
      </div>

      {/* Stats bar */}
      <div className="dl-stats-bar" aria-label="Filtri rapidi scadenzario">
        <button
          type="button"
          className={`dl-stat${activeCard === 'active' ? ' dl-stat-active' : ''}`}
          onClick={() => handleCardFilter('active')}
          title="Filtra: scadenze attive"
        >
          <span className="dl-stat-num">{statsActive}</span>
          <span className="dl-stat-lbl">Attive</span>
        </button>
        <button
          type="button"
          className={`dl-stat dl-stat--red${activeCard === 'expired' ? ' dl-stat-active' : ''}`}
          onClick={() => handleCardFilter('expired')}
          title="Filtra: scadenze scadute"
        >
          <span className="dl-stat-num">{statsExpired}</span>
          <span className="dl-stat-lbl">Scadute</span>
        </button>
        <button
          type="button"
          className={`dl-stat dl-stat--orange${activeCard === 'soon' ? ' dl-stat-active' : ''}`}
          onClick={() => handleCardFilter('soon')}
          title="Filtra: scadenze entro 30 giorni"
        >
          <span className="dl-stat-num">{statsSoon}</span>
          <span className="dl-stat-lbl">In scadenza 30gg</span>
        </button>
        <button
          type="button"
          className={`dl-stat dl-stat--gray${activeCard === 'completed' ? ' dl-stat-active' : ''}`}
          onClick={() => handleCardFilter('completed')}
          title="Filtra: scadenze completate"
        >
          <span className="dl-stat-num">{statsCompleted}</span>
          <span className="dl-stat-lbl">Completate</span>
        </button>
        <button
          type="button"
          className={`dl-stat dl-stat--gray${activeCard === 'dismissed' ? ' dl-stat-active' : ''}`}
          onClick={() => handleCardFilter('dismissed')}
          title="Filtra: scadenze archiviate"
        >
          <span className="dl-stat-num">{statsDismissed}</span>
          <span className="dl-stat-lbl">Archiviate</span>
        </button>
        <button
          type="button"
          className={`dl-stat dl-stat--amber${activeCard === 'acknowledged' ? ' dl-stat-active' : ''}`}
          onClick={() => handleCardFilter('acknowledged')}
          title="Filtra: scadenze scadute prese in carico"
        >
          <span className="dl-stat-num">{statsAcknowledged}</span>
          <span className="dl-stat-lbl">Prese in carico</span>
        </button>
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
        onRowDoubleClick={openSourceDocument}
      />
    </div>
  );
}

export default DeadlinesPage;
