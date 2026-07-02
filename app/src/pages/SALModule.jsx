/**
 * SALModule — Stato Avanzamento Lavori (ISO 9001/14001/45001)
 * Griglia requisiti × stati di implementazione per azienda cliente.
 * Fase 1 MVP — motore dati gapAnalysis.service.js (Fase 0).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiService from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import SgqDataGrid from '../components/SgqDataGrid';
import SalEvidenceSection from '../components/SalEvidenceSection';
import { formatDate } from '../utils/dateHelpers';
import { exportSalTrackerDocx } from '../utils/wordExportSal';
import {
  resolveInitialSalCompanyScope,
  persistSalCompanyScope,
} from '../utils/salCompanyScope';
import {
  SAL_STATUS_OPTIONS,
  SAL_STATUS_LABEL,
  SAL_STANDARD_TABS,
  SAL_STANDARD_LABEL,
  salStandardBadgeClass,
} from '../utils/salConstants';
import './SALModule.css';

const GRID_COLUMNS = [
  { id: 'clauseRef', label: 'Clausola', sortable: true, width: '90px' },
  { id: 'clauseTitle', label: 'Titolo', sortable: true },
  { id: 'standardCode', label: 'Standard', sortable: true, width: '110px' },
  { id: 'status', label: 'Stato', sortable: true, width: '150px' },
  { id: 'notes', label: 'Note', sortable: false },
  { id: 'responsible', label: 'Responsabile', sortable: true, width: '130px' },
  { id: 'dueDate', label: 'Scadenza', sortable: true, width: '110px' },
  { id: '_actions', label: '', sortable: false, width: '72px' },
];

function SalEditModal({ row, companyId, saving, onClose, onSave }) {
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
  const { user } = useAuth() || {};

  const [companies, setCompanies] = useState([]);
  const [companyScope, setCompanyScope] = useState(() => resolveInitialSalCompanyScope());
  const [standardFilter, setStandardFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    apiService.getCompanies?.().then((res) => {
      const list = res?.data || res?.companies || res || [];
      setCompanies(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const access = user?.company_access;
    if (Array.isArray(access) && access.length === 1 && !companyScope) {
      const onlyId = String(access[0].company_id);
      setCompanyScope(onlyId);
      persistSalCompanyScope(onlyId);
    }
  }, [user, companyScope]);

  const scopeCompanyName = useMemo(() => {
    if (!companyScope) return '';
    const match = companies.find((c) => String(c.id) === String(companyScope));
    return match?.name || `Azienda #${companyScope}`;
  }, [companyScope, companies]);

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

  const handleCompanyScopeChange = useCallback((value) => {
    setCompanyScope(value);
    persistSalCompanyScope(value);
  }, []);

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
          <button
            type="button"
            className="sal-btn-edit"
            onClick={() => setEditRow(row)}
            title="Modifica dettagli"
          >
            Modifica
          </button>
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
          {companies.length > 0 && (
            <label className="sal-scope-label">
              Ambito:
              <select
                className="sal-scope-select"
                value={companyScope}
                onChange={(e) => handleCompanyScopeChange(e.target.value)}
                aria-label="Ambito SAL per azienda"
              >
                <option value="">— Seleziona azienda —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
          )}
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

      {!companyScope ? (
        <div className="sal-empty-scope">
          <span className="sal-empty-scope-icon" aria-hidden="true">🏢</span>
          <p>Seleziona un&apos;azienda nell&apos;ambito per visualizzare la matrice requisiti.</p>
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
                onClick={() => setStandardFilter(tab.code)}
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
        />
      )}
    </div>
  );
}

export { SAL_STATUS_LABEL, SAL_STATUS_OPTIONS };
