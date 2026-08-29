/**
 * SALModule — Stato Avanzamento Lavori (ISO 9001/14001/45001)
 * Griglia requisiti × stati di implementazione per azienda cliente.
 * Fase 1–3 — griglia, export/evidenze (Fase 2), hint audit + NC sal_gap (Fase 3).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyScope } from '../contexts/CompanyScopeContext';
import SgqDataGrid from '../components/SgqDataGrid';
import SalEvidenceSection from '../components/SalEvidenceSection';
import SalAiSuggestDialog from '../components/SalAiSuggestDialog';
import NcCreateModal from '../components/NcCreateModal';
import { formatDate } from '../utils/dateHelpers';
import { exportSalTrackerDocx } from '../utils/wordExportSal';
import { parseSalDeepLinkSearch } from '../utils/salDeepLink';
import {
  SAL_STATUS_OPTIONS,
  SAL_STATUS_LABEL,
  SAL_STANDARD_TABS,
  SAL_STANDARD_LABEL,
  SAL_CONFORMITY_HINT_LABEL,
  salStandardBadgeClass,
  buildSalGapActionDescription,
  buildSalGapOriginText,
  clauseRefToSectionCode,
} from '../utils/salConstants';
import './SALModule.css';

const GRID_COLUMNS = [
  { id: 'clauseRef', label: 'Clausola', sortable: true, width: '90px' },
  { id: 'clauseTitle', label: 'Titolo', sortable: true },
  { id: 'standardCode', label: 'Standard', sortable: true, width: '110px' },
  { id: 'status', label: 'Stato', sortable: true, width: '150px' },
  { id: 'conformityHint', label: 'Hint audit', sortable: true, width: '100px' },
  { id: 'notes', label: 'Note', sortable: false },
  { id: 'responsible', label: 'Responsabile', sortable: true, width: '130px' },
  { id: 'dueDate', label: 'Scadenza', sortable: true, width: '110px' },
  { id: '_actions', label: '', sortable: false, width: '150px' },
];

/** Numero massimo di clausole per richiesta AI batch (allineato al backend). */
const AI_BULK_MAX = 25;

function SalConformityHintBadge({ hint }) {
  if (!hint) return <span className="sal-hint-empty">—</span>;
  const label = SAL_CONFORMITY_HINT_LABEL[hint] || hint;
  return (
    <span className={`sal-hint-badge sal-hint-badge--${hint}`} title={`Suggerimento da audit: ${label}`}>
      {hint}
    </span>
  );
}

function SalEditModal({ row, companyId, saving, onClose, onSave, onCreateAction }) {
  const [form, setForm] = useState({
    status: row.status || 'discussed',
    notes: row.notes || '',
    responsible: row.responsible || '',
    dueDate: row.dueDate || '',
    evidenceDocumentIds: Array.isArray(row.evidenceDocumentIds)
      ? row.evidenceDocumentIds.map(Number)
      : [],
  });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!companyId || !row?.normRequirementId) return;
    setHistoryLoading(true);
    apiService.getGapStatusHistory(companyId, row.normRequirementId)
      .then((res) => {
        const data = res?.data ?? res;
        setHistory(Array.isArray(data?.history) ? data.history : []);
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [companyId, row?.normRequirementId]);

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="sal-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sal-modal sal-modal-wide"
        role="dialog"
        aria-labelledby="sal-edit-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="sal-edit-title">Dettaglio requisito</h3>
        <p className="sal-modal-clause">
          {row.clauseRef} — {row.clauseTitle}
        </p>
        {row.conformityHint && (
          <p className="sal-modal-hint">
            Hint audit (sola lettura):
            {' '}
            <SalConformityHintBadge hint={row.conformityHint} />
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="sal-form-group">
            <label htmlFor="sal-edit-status">Stato</label>
            <select
              id="sal-edit-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {SAL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="sal-form-group">
            <label htmlFor="sal-edit-responsible">Responsabile</label>
            <input
              id="sal-edit-responsible"
              type="text"
              value={form.responsible}
              onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))}
              placeholder="Nome responsabile"
            />
          </div>
          <div className="sal-form-group">
            <label htmlFor="sal-edit-due">Scadenza</label>
            <input
              id="sal-edit-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="sal-form-group">
            <label htmlFor="sal-edit-notes">Note</label>
            <textarea
              id="sal-edit-notes"
              className="notes-textarea"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Note sull'avanzamento"
            />
          </div>

          <SalEvidenceSection
            companyId={companyId}
            value={form.evidenceDocumentIds}
            onChange={(ids) => setForm((f) => ({ ...f, evidenceDocumentIds: ids }))}
            disabled={saving}
          />

          <div className="sal-history-block">
            <h4>Storico revisioni</h4>
            {historyLoading && <p className="sal-history-loading">Caricamento storico…</p>}
            {!historyLoading && history.length === 0 && (
              <p className="sal-history-empty">Nessuna revisione registrata.</p>
            )}
            {!historyLoading && history.length > 0 && (
              <ul className="sal-history-list">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="sal-history-date">
                      {h.changedAt ? formatDate(h.changedAt.slice(0, 10)) : '—'}
                    </span>
                    <span className="sal-history-status">
                      {SAL_STATUS_LABEL[h.status] || h.status}
                    </span>
                    {h.changedByName && (
                      <span className="sal-history-user">{h.changedByName}</span>
                    )}
                    {h.notes && (
                      <span className="sal-history-notes" title={h.notes}>{h.notes}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {onCreateAction && row.status !== 'completed' && row.status !== 'na' && (
            <div className="sal-gap-action-block">
              <button
                type="button"
                className="sal-btn sal-btn-secondary sal-btn-block"
                onClick={() => onCreateAction(row)}
              >
                Crea azione Piano Azioni (gap SAL)
              </button>
            </div>
          )}

          <div className="sal-modal-actions">
            <button type="button" className="sal-btn sal-btn-secondary" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="sal-btn sal-btn-primary" disabled={saving}>
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SALModule() {
  const { user, hasLicensedModule } = useAuth() || {};
  const { companyId: companyScope, setCompanyId, scopeCompanyName } = useCompanyScope();
  const aiEnabled = typeof hasLicensedModule === 'function'
    ? hasLicensedModule('ai_norms')
    : false;

  // Deep link da un altro modulo (es. "Verifica in SAL" da Gap Analysis) — letto
  // una sola volta all'ingresso: precompila azienda/standard e mette in evidenza
  // la macro-clausola indicata. Nessuno stato condiviso: solo query string.
  const [deepLink] = useState(() => parseSalDeepLinkSearch(
    typeof window !== 'undefined' ? window.location.search : ''
  ));
  const deepLinkStandard = SAL_STANDARD_TABS.some((t) => t.code === deepLink.standardCode)
    ? deepLink.standardCode
    : '';
  const [highlightClauseRef, setHighlightClauseRef] = useState(deepLink.clauseRef || null);

  const [standardFilter, setStandardFilter] = useState(deepLinkStandard);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [syncingHints, setSyncingHints] = useState(false);
  const [showNcModal, setShowNcModal] = useState(false);
  const [ncActionRow, setNcActionRow] = useState(null);
  const [ncSuccessMsg, setNcSuccessMsg] = useState(null);
  const [aiSuggestOpen, setAiSuggestOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (deepLink.companyId) setCompanyId(String(deepLink.companyId));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const needsSeed = useMemo(() => {
    if (!summary) return false;
    return summary.total > 0 && summary.not_seeded === summary.total;
  }, [summary]);

  const loadMatrix = useCallback(async () => {
    if (!companyScope) {
      setRows([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getGapMatrix(companyScope, {
        standardCode: standardFilter || undefined,
      });
      const matrix = data?.data ?? data;
      setRows(Array.isArray(matrix?.rows) ? matrix.rows : []);
      setSummary(matrix?.summary ?? null);
    } catch (err) {
      setError(err?.message || 'Errore caricamento matrice SAL');
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyScope, standardFilter]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Scorre fino alla clausola indicata dal deep link, una volta caricata la matrice.
  useEffect(() => {
    if (!highlightClauseRef || loading || !rows.some((r) => r.clauseRef === highlightClauseRef)) return;
    const timer = setTimeout(() => {
      document.querySelector('.sal-row-highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => clearTimeout(timer);
  }, [rows, loading, highlightClauseRef]);

  const updateRowLocal = useCallback((normRequirementId, patch) => {
    setRows((prev) => prev.map((r) => (
      r.normRequirementId === normRequirementId ? { ...r, ...patch } : r
    )));
  }, []);

  const saveStatus = useCallback(async (row, payload) => {
    if (!companyScope || !row?.normRequirementId) return;
    setSavingId(row.normRequirementId);
    setError(null);
    try {
      await apiService.updateGapStatus(companyScope, row.normRequirementId, payload);
      updateRowLocal(row.normRequirementId, {
        status: payload.status,
        notes: payload.notes ?? row.notes,
        responsible: payload.responsible ?? row.responsible,
        dueDate: payload.dueDate ?? row.dueDate,
        evidenceDocumentIds: payload.evidenceDocumentIds ?? row.evidenceDocumentIds,
      });
      setEditRow(null);
      await loadMatrix();
    } catch (err) {
      setError(err?.message || 'Errore aggiornamento stato');
    } finally {
      setSavingId(null);
    }
  }, [companyScope, loadMatrix, updateRowLocal]);

  async function handleSeed() {
    if (!companyScope) return;
    setSeeding(true);
    setError(null);
    try {
      const standardCodes = standardFilter
        ? [standardFilter]
        : undefined;
      await apiService.seedGapMatrix(companyScope, { standardCodes });
      await loadMatrix();
    } catch (err) {
      setError(err?.message || 'Errore seed clausole');
    } finally {
      setSeeding(false);
    }
  }

  function handleInlineStatusChange(row, newStatus) {
    if (!newStatus || newStatus === row.status) return;
    saveStatus(row, {
      status: newStatus,
      notes: row.notes,
      responsible: row.responsible,
      dueDate: row.dueDate,
      evidenceDocumentIds: row.evidenceDocumentIds,
    });
  }

  async function handleExportWord() {
    if (!companyScope || !rows.length) return;
    setExporting(true);
    setError(null);
    try {
      await exportSalTrackerDocx({
        companyName: scopeCompanyName,
        standardFilter: standardFilter || undefined,
        rows,
        summary,
      });
    } catch (err) {
      setError(err?.message || 'Errore export Word SAL');
    } finally {
      setExporting(false);
    }
  }

  async function handleSyncAuditHints() {
    if (!companyScope) return;
    setSyncingHints(true);
    setError(null);
    setNcSuccessMsg(null);
    try {
      const res = await apiService.syncSalAuditHints(companyScope, { monthsBack: 12 });
      const data = res?.data ?? res;
      await loadMatrix();
      const updated = data?.updated ?? 0;
      setNcSuccessMsg(
        updated > 0
          ? `Hint audit aggiornati su ${updated} clausola/e (ultimi 12 mesi).`
          : 'Nessun hint audit da applicare (verifica audit completati recenti).',
      );
    } catch (err) {
      setError(err?.message || 'Errore sincronizzazione hint audit');
    } finally {
      setSyncingHints(false);
    }
  }

  function openNcFromGap(row) {
    setEditRow(null);
    setNcActionRow(row);
    setShowNcModal(true);
  }

  const requestAiSuggestions = useCallback(async (payload, contextLabel) => {
    if (!companyScope) return;
    setAiLoading(true);
    setError(null);
    setNcSuccessMsg(null);
    try {
      const res = await apiService.suggestSalGapStatus(companyScope, payload);
      const data = res?.data ?? res;
      if (data && data.aiAvailable === false) {
        setError(data.message || 'Suggeritore AI non disponibile.');
        return;
      }
      const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
      if (!list.length) {
        setError('Nessun suggerimento AI generato.');
        return;
      }
      setAiSuggestions(list);
      setAiSuggestOpen(true);
    } catch (err) {
      setError(err?.message || `Errore suggerimento AI${contextLabel ? ` (${contextLabel})` : ''}`);
    } finally {
      setAiLoading(false);
    }
  }, [companyScope]);

  function handleAiSuggestRow(row) {
    if (!row?.normRequirementId) return;
    setEditRow(null);
    requestAiSuggestions({ normRequirementId: row.normRequirementId }, row.clauseRef);
  }

  function handleAiSuggestBulk() {
    const ids = rows
      .map((r) => r.normRequirementId)
      .filter(Boolean)
      .slice(0, AI_BULK_MAX);
    if (!ids.length) return;
    if (rows.length > AI_BULK_MAX) {
      setNcSuccessMsg(`Analisi AI limitata alle prime ${AI_BULK_MAX} clausole visualizzate.`);
    }
    requestAiSuggestions({ normRequirementIds: ids }, 'batch');
  }

  const dismissAiSuggestion = useCallback((normRequirementId) => {
    setAiSuggestions((prev) => {
      const next = prev.filter((s) => s.normRequirementId !== normRequirementId);
      if (!next.length) setAiSuggestOpen(false);
      return next;
    });
  }, []);

  async function handleAiAccept(suggestion, finalStatus) {
    const row = rows.find((r) => r.normRequirementId === suggestion.normRequirementId);
    const status = finalStatus || suggestion?.suggestedStatus;
    if (!row || !status) return;
    // Tracciabilita' ISO 7.5: se non ci sono note, registra l'origine AI del cambio stato.
    const aiNote = suggestion.rationale
      ? `Proposto da AI (confidenza ${suggestion.confidence || 'n/d'}): ${suggestion.rationale}`
      : null;
    await saveStatus(row, {
      status,
      notes: row.notes || aiNote || null,
      responsible: row.responsible,
      dueDate: row.dueDate,
      evidenceDocumentIds: row.evidenceDocumentIds,
    });
    dismissAiSuggestion(suggestion.normRequirementId);
  }

  function handleAiReject(suggestion) {
    dismissAiSuggestion(suggestion.normRequirementId);
  }

  function renderCell(row, col) {
    switch (col.id) {
      case 'clauseRef':
        return <span className="sal-clause-ref">{row.clauseRef}</span>;
      case 'clauseTitle':
        return <span className="sal-clause-title" title={row.clauseTitle}>{row.clauseTitle}</span>;
      case 'standardCode':
        return (
          <span className={`sal-std-badge ${salStandardBadgeClass(row.standardCode)}`}>
            {SAL_STANDARD_LABEL[row.standardCode] || row.standardCode}
          </span>
        );
      case 'status':
        return (
          <select
            className={`sal-status-select sal-status-select--${row.status || 'discussed'}`}
            value={row.status || 'discussed'}
            disabled={savingId === row.normRequirementId}
            onChange={(e) => handleInlineStatusChange(row, e.target.value)}
            aria-label={`Stato clausola ${row.clauseRef}`}
          >
            {SAL_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        );
      case 'conformityHint':
        return <SalConformityHintBadge hint={row.conformityHint} />;
      case 'notes':
        if (row.notes) {
          return <span className="sal-notes-preview" title={row.notes}>{row.notes}</span>;
        }
        if (Array.isArray(row.evidenceDocuments) && row.evidenceDocuments.length) {
          return (
            <span className="sal-evidence-badge" title={row.evidenceDocuments.map((d) => d.title).join(', ')}>
              {row.evidenceDocuments.length}
              {' '}
              evidenza/e
            </span>
          );
        }
        return '—';
      case 'responsible':
        return row.responsible || '—';
      case 'dueDate':
        return row.dueDate ? formatDate(row.dueDate) : '—';
      case '_actions':
        return (
          <div className="sal-actions-cell">
            <button
              type="button"
              className="sal-btn-edit"
              onClick={() => setEditRow(row)}
              title="Modifica dettagli"
            >
              Modifica
            </button>
            {aiEnabled && (
              <button
                type="button"
                className="sal-btn-ai"
                onClick={() => handleAiSuggestRow(row)}
                disabled={aiLoading || savingId === row.normRequirementId}
                title="Suggerisci stato dalle evidenze collegate (AI)"
              >
                {'\u2728'} AI
              </button>
            )}
          </div>
        );
      default:
        return row[col.id] ?? '—';
    }
  }

  return (
    <div className="sal-page">
      <div className="sal-header">
        <div>
          <h1 className="sal-title">SAL — Stato Avanzamento Lavori</h1>
          <p className="sal-subtitle">
            Tracker implementazione SGQ requisito per requisito (clausole §4–10)
          </p>
        </div>
        <div className="sal-header-actions">
          {needsSeed && companyScope && (
            <button
              type="button"
              className="sal-btn sal-btn-primary"
              disabled={seeding || loading}
              onClick={handleSeed}
            >
              {seeding ? 'Seed in corso…' : 'Seed clausole'}
            </button>
          )}
          {companyScope && rows.length > 0 && (
            <button
              type="button"
              className="sal-btn sal-btn-secondary"
              disabled={syncingHints || loading}
              onClick={handleSyncAuditHints}
              title="Aggiorna conformity_hint dall'ultimo audit completato per standard"
            >
              {syncingHints ? 'Sync audit…' : 'Sync hint audit'}
            </button>
          )}
          {aiEnabled && companyScope && rows.length > 0 && (
            <button
              type="button"
              className="sal-btn sal-btn-secondary"
              disabled={aiLoading || loading}
              onClick={handleAiSuggestBulk}
              title="Suggerisci lo stato delle clausole visualizzate dalle evidenze collegate (AI)"
            >
              {aiLoading ? 'Analisi AI…' : '\u2728 Suggerisci stato (AI)'}
            </button>
          )}
          {companyScope && rows.length > 0 && (
            <button
              type="button"
              className="sal-btn sal-btn-secondary"
              disabled={exporting || loading}
              onClick={handleExportWord}
              title="Esporta matrice SAL in Word (.docx)"
            >
              {exporting ? 'Export…' : 'Export Word'}
            </button>
          )}
        </div>
      </div>

      {companyScope && (
        <p className="sal-scope-hint">Ambito attivo: {scopeCompanyName}</p>
      )}

      {error && (
        <div className="sal-error" role="alert">{error}</div>
      )}

      {ncSuccessMsg && (
        <div className="sal-success" role="status">{ncSuccessMsg}</div>
      )}

      {!companyScope ? (
        <div className="sal-empty-scope">
          <span className="sal-empty-scope-icon" aria-hidden="true">🏢</span>
          <p>Seleziona un&apos;azienda nell&apos;Ambito in alto per visualizzare la matrice requisiti.</p>
        </div>
      ) : (
        <>
          <div className="sal-tabs" role="tablist" aria-label="Filtro standard">
            {SAL_STANDARD_TABS.map((tab) => (
              <button
                key={tab.code || 'all'}
                type="button"
                role="tab"
                aria-selected={standardFilter === tab.code}
                className={`sal-tab${standardFilter === tab.code ? ' sal-tab-active' : ''}`}
                onClick={() => { setStandardFilter(tab.code); setHighlightClauseRef(null); }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {summary && (
            <div className="sal-summary" aria-label="Riepilogo stati">
              <div className="sal-summary-item">
                Totale clausole
                <strong>{summary.total}</strong>
              </div>
              <div className="sal-summary-item">
                Completati
                <strong>{summary.completed}</strong>
              </div>
              <div className="sal-summary-item">
                In corso
                <strong>{summary.in_progress}</strong>
              </div>
              <div className="sal-summary-item">
                Da validare
                <strong>{summary.to_validate}</strong>
              </div>
              <div className="sal-summary-item">
                Non seedati
                <strong>{summary.not_seeded}</strong>
              </div>
            </div>
          )}

          {highlightClauseRef && (
            <p className="sal-scope-hint">
              Arrivi da Gap Analysis: clausola {highlightClauseRef} evidenziata sotto.
            </p>
          )}

          <SgqDataGrid
            rows={rows}
            columns={GRID_COLUMNS}
            loading={loading}
            emptyMessage={
              needsSeed
                ? 'Nessuna clausola seedata. Usa «Seed clausole» per inizializzare la matrice.'
                : 'Nessun requisito trovato per il filtro selezionato.'
            }
            getRowKey={(row) => row.normRequirementId}
            renderCell={renderCell}
            rowClassName={(row) => (row.clauseRef === highlightClauseRef ? 'sal-row-highlight' : '')}
          />
        </>
      )}

      {editRow && (
        <SalEditModal
          row={editRow}
          companyId={companyScope ? Number(companyScope) : null}
          saving={savingId === editRow.normRequirementId}
          onClose={() => setEditRow(null)}
          onSave={(form) => saveStatus(editRow, form)}
          onCreateAction={openNcFromGap}
        />
      )}

      {aiSuggestOpen && (
        <SalAiSuggestDialog
          open={aiSuggestOpen}
          suggestions={aiSuggestions}
          busy={aiLoading}
          savingId={savingId}
          onAccept={handleAiAccept}
          onReject={handleAiReject}
          onClose={() => setAiSuggestOpen(false)}
        />
      )}

      {showNcModal && ncActionRow && (
        <NcCreateModal
          open={showNcModal}
          onClose={() => {
            setShowNcModal(false);
            setNcActionRow(null);
          }}
          onCreated={(nc) => {
            const clauseRef = ncActionRow.clauseRef;
            setShowNcModal(false);
            setNcActionRow(null);
            setNcSuccessMsg(
              `Azione creata nel Piano Azioni${nc?.nc_number ? ` (${nc.nc_number})` : ''} da gap SAL ${clauseRef}.`,
            );
          }}
          defaultCategory="sal_gap"
          initialDescription={buildSalGapActionDescription(ncActionRow)}
          initialOriginText={buildSalGapOriginText(ncActionRow)}
          initialSectionCode={clauseRefToSectionCode(ncActionRow.clauseRef)}
        />
      )}
    </div>
  );
}

export { SAL_STATUS_LABEL, SAL_STATUS_OPTIONS };
