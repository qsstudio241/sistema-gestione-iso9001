/**
 * ContractReviewPage — Riesame requisiti contratto (commercial cases) + analisi AI capitolato
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiService, { ApiError } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useRouter, useNavigate } from '../contexts/RouterContext';
import { useAiAssist } from '../hooks/useAiAssist';
import AiSuggestionInline from '../components/AiSuggestionInline';
import './ContractReviewPage.css';

const STATUS_LABELS = {
  DRAFT: 'Bozza',
  INTAKE_REVIEW: 'Verifica acquisizione',
  CLARIFICATION: 'Chiarimenti',
  QUOTE_PREP: 'Preparazione offerta',
  QUOTE_APPROVAL: 'Approvazione offerta',
  QUOTE_SENT: 'Offerta inviata',
  ORDER_RECEIVED: 'Ordine ricevuto',
  FINAL_REVIEW: 'Riesame finale',
  APPROVED: 'Approvato',
  CANCELLED: 'Annullato',
  REJECTED: 'Respinto',
};

const TERMINAL_STATUSES = new Set(['APPROVED', 'CANCELLED', 'REJECTED']);

const ALLOWED_STATUS_TRANSITIONS = {
  DRAFT: ['INTAKE_REVIEW'],
  INTAKE_REVIEW: ['CLARIFICATION', 'QUOTE_PREP', 'DRAFT'],
  CLARIFICATION: ['INTAKE_REVIEW', 'QUOTE_PREP'],
  QUOTE_PREP: ['QUOTE_APPROVAL', 'INTAKE_REVIEW'],
  QUOTE_APPROVAL: ['QUOTE_SENT', 'QUOTE_PREP'],
  QUOTE_SENT: ['ORDER_RECEIVED', 'CANCELLED'],
  ORDER_RECEIVED: ['FINAL_REVIEW'],
  FINAL_REVIEW: ['APPROVED', 'ORDER_RECEIVED'],
};

const BACKWARD_TRANSITION_KEYS = new Set([
  'INTAKE_REVIEW|DRAFT',
  'CLARIFICATION|INTAKE_REVIEW',
  'QUOTE_PREP|INTAKE_REVIEW',
  'QUOTE_APPROVAL|QUOTE_PREP',
  'FINAL_REVIEW|ORDER_RECEIVED',
]);

function parseCaseIdFromPath(pathname) {
  const m = pathname.match(/^\/contract-reviews\/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

function normalizeListPayload(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
}

function rowCase(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    company_id: row.company_id ?? row.companyId,
    external_ref: row.external_ref ?? row.externalRef,
    notes: row.notes,
    updated_at: row.updated_at ?? row.updatedAt,
  };
}

function rowCheck(row) {
  return {
    id: row.id,
    phase: row.phase,
    item_ref: row.item_ref ?? row.itemRef,
    item_text: row.item_text ?? row.itemText,
    answer: row.answer,
    notes: row.notes ?? '',
  };
}

function statusBadgeClass(status) {
  if (status === 'APPROVED') return 'cr-badge cr-badge-final';
  if (status === 'CANCELLED' || status === 'REJECTED') return 'cr-badge cr-badge-negative';
  if (status === 'DRAFT') return 'cr-badge cr-badge-draft';
  return 'cr-badge cr-badge-progress';
}

function requiresTransitionReason(fromStatus, toStatus) {
  if (toStatus === 'CANCELLED' || toStatus === 'REJECTED') return true;
  return BACKWARD_TRANSITION_KEYS.has(`${fromStatus}|${toStatus}`);
}

function tokenize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function overlapScore(textA, textB) {
  const a = new Set(tokenize(textA));
  if (!a.size) return 0;
  let n = 0;
  for (const w of tokenize(textB)) {
    if (a.has(w)) n += 1;
  }
  return n;
}

function mapAssessmentToAnswer(assessment) {
  const a = String(assessment || '').toLowerCase();
  if (a === 'satisfied') return 'yes';
  if (a === 'gap') return 'no';
  return 'partial';
}

function assessmentClass(a) {
  const x = String(a || '').toLowerCase();
  if (x === 'satisfied') return 'cr-assessment-tag cr-assessment-satisfied';
  if (x === 'gap') return 'cr-assessment-tag cr-assessment-gap';
  return 'cr-assessment-tag cr-assessment-verify';
}

function assessmentLabel(a) {
  const x = String(a || '').toLowerCase();
  if (x === 'satisfied') return 'Soddisfatto';
  if (x === 'gap') return 'Gap';
  if (x === 'to_verify') return 'Da verificare';
  return a || '—';
}

function riskClass(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'low') return 'cr-risk-low';
  if (x === 'medium') return 'cr-risk-medium';
  if (x === 'high') return 'cr-risk-high';
  return '';
}

function riskLabel(r) {
  const x = String(r || '').toLowerCase();
  if (x === 'low') return 'Basso';
  if (x === 'medium') return 'Medio';
  if (x === 'high') return 'Alto';
  return r || '—';
}

export default function ContractReviewPage() {
  const { user } = useAuth();
  const { path } = useRouter();
  const navigate = useNavigate();
  const caseId = parseCaseIdFromPath(path);

  const [cases, setCases] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);

  const [companies, setCompanies] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    company_id: '',
    external_ref: '',
  });

  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingCase, setSavingCase] = useState(false);

  const [transitionModal, setTransitionModal] = useState(null);

  const [capitolatoText, setCapitolatoText] = useState('');
  const [aiCompanyContextId, setAiCompanyContextId] = useState('');
  const [applyAiBusy, setApplyAiBusy] = useState(false);

  const {
    suggest,
    suggestion: aiSuggestion,
    loading: aiLoading,
    error: aiHookError,
    clear: clearAi,
  } = useAiAssist();

  const companiesById = useMemo(() => {
    const m = new Map();
    for (const c of companies) {
      m.set(c.id, c.name || `ID ${c.id}`);
    }
    return m;
  }, [companies]);

  const loadCompanies = useCallback(async () => {
    try {
      const params = user?.auditor_org_id ? { auditor_org_id: user.auditor_org_id } : {};
      const res = await apiService.getCompanies(params);
      const list = Array.isArray(res) ? res : res?.data || [];
      setCompanies(list);
    } catch {
      setCompanies([]);
    }
  }, [user?.auditor_org_id]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const raw = await apiService.getContractReviews(statusFilter || undefined);
      setCases(normalizeListPayload(raw).map(rowCase));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Errore caricamento');
      setCases([]);
    } finally {
      setListLoading(false);
    }
  }, [statusFilter]);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    setError(null);
    try {
      const data = await apiService.getContractReview(id);
      const c = rowCase(data.case || data);
      setDetail({
        case: c,
        history: data.history || [],
        checklist: (data.checklist || []).map(rowCheck),
      });
      setEditTitle(c.title || '');
      setEditNotes(c.notes || '');
      const cid = c.company_id != null ? String(c.company_id) : '';
      setAiCompanyContextId(cid);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Errore dettaglio');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadDetail(caseId);
  }, [caseId, loadDetail]);

  useEffect(() => {
    if (!caseId) clearAi();
  }, [caseId, clearAi]);

  async function handleSaveCaseMeta() {
    if (!caseId || !detail?.case) return;
    setSavingCase(true);
    setError(null);
    try {
      await apiService.updateContractReview(caseId, {
        title: editTitle.trim(),
        notes: editNotes,
      });
      await loadDetail(caseId);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Salvataggio fallito');
    } finally {
      setSavingCase(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    try {
      const body = {
        title: createForm.title.trim(),
        external_ref: createForm.external_ref.trim() || undefined,
      };
      if (createForm.company_id) {
        body.company_id = parseInt(createForm.company_id, 10);
      }
      const created = await apiService.createContractReview(body);
      const id = created?.id;
      setCreateOpen(false);
      setCreateForm({ title: '', company_id: '', external_ref: '' });
      await loadList();
      if (id) navigate(`/contract-reviews/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Creazione fallita');
    }
  }

  function openTransition(toStatus) {
    const from = detail?.case?.status;
    if (!from) return;
    if (requiresTransitionReason(from, toStatus)) {
      setTransitionModal({ toStatus, reason: '' });
    } else {
      void commitTransition(toStatus, '');
    }
  }

  async function commitTransition(toStatus, reason) {
    if (!caseId) return;
    setError(null);
    try {
      await apiService.transitionContractReview(caseId, toStatus, reason.trim() || undefined);
      setTransitionModal(null);
      await loadDetail(caseId);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Transizione fallita');
    }
  }

  async function handleGenerateChecklist(phase) {
    if (!caseId) return;
    setError(null);
    try {
      await apiService.generateReviewChecklist(caseId, phase);
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Generazione checklist fallita');
    }
  }

  async function handleSaveChecklistItem(itemId, patch) {
    if (!caseId) return;
    setError(null);
    try {
      await apiService.saveChecklistAnswer(caseId, itemId, patch);
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Salvataggio voce fallito');
    }
  }

  async function handleRunAiAnalysis() {
    const text = capitolatoText.trim();
    if (!text) {
      setError('Incolla o carica il testo del capitolato prima di avviare l’analisi.');
      return;
    }
    const companyIdRaw = aiCompanyContextId || (detail?.case?.company_id != null ? String(detail.case.company_id) : '');
    const companyId = parseInt(companyIdRaw, 10);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      setError('Seleziona un’azienda per il contesto AI (o associa un’azienda al caso).');
      return;
    }
    setError(null);
    await suggest('review_requirements', { capitolatoText: text, companyId });
  }

  async function handleApplyAiToPreliminary() {
    if (!caseId || !detail?.checklist?.length || !aiSuggestion) return;
    const prelim = detail.checklist.filter((c) => c.phase === 'preliminary');
    if (!prelim.length) {
      setError('Genera prima la checklist preliminare.');
      return;
    }
    const reqs = aiSuggestion.identified_requirements;
    if (!Array.isArray(reqs) || !reqs.length) {
      setError('Nessun requisito strutturato da applicare.');
      return;
    }

    setApplyAiBusy(true);
    setError(null);
    try {
      for (const item of prelim) {
        let best = null;
        let bestScore = 0;
        const haystack = `${item.item_text} ${item.item_ref}`;
        for (const r of reqs) {
          const blob = `${r.description || ''} ${r.gap_detail || ''} ${r.suggested_action || ''} ${r.source || ''}`;
          const sc = overlapScore(haystack, blob);
          if (sc > bestScore) {
            bestScore = sc;
            best = r;
          }
        }
        if (!best || bestScore < 1) continue;
        const answer = mapAssessmentToAnswer(best.assessment);
        const noteParts = [best.suggested_action, best.gap_detail].filter(Boolean);
        const notes = noteParts.join(' — ') || item.notes;
        await apiService.saveChecklistAnswer(caseId, item.id, { answer, notes });
      }
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Applicazione AI fallita');
    } finally {
      setApplyAiBusy(false);
    }
  }

  function handleCapitolatoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const t = typeof reader.result === 'string' ? reader.result : '';
      setCapitolatoText(t);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const transitionTargets = useMemo(() => {
    const st = detail?.case?.status;
    if (!st || TERMINAL_STATUSES.has(st)) return [];
    const forward = ALLOWED_STATUS_TRANSITIONS[st] || [];
    const rows = forward.map((to) => ({
      to,
      label: STATUS_LABELS[to] || to,
      danger: false,
    }));
    rows.push(
      { to: 'CANCELLED', label: 'Annulla commessa', danger: true },
      { to: 'REJECTED', label: 'Respingi', danger: true },
    );
    return rows;
  }, [detail?.case?.status]);

  const checklistPreliminary = detail?.checklist?.filter((c) => c.phase === 'preliminary') || [];
  const checklistFinal = detail?.checklist?.filter((c) => c.phase === 'final') || [];

  const aiStructured =
    aiSuggestion &&
    !aiSuggestion.raw &&
    (Array.isArray(aiSuggestion.identified_requirements) || aiSuggestion.summary);

  return (
    <div className="contract-review-page">
      <p className="contract-review-intro">
        Riesame dei requisiti contrattuali e del ciclo commerciale (ISO 9001 §8.2). Gestisci stati,
        checklist preliminare/finale e analisi AI sul capitolato.
      </p>

      {error && <div className="contract-review-error">{error}</div>}

      {!caseId && (
        <>
          <div className="contract-review-toolbar">
            <button type="button" className="cr-btn cr-btn-primary" onClick={() => setCreateOpen(true)}>
              Nuovo Riesame
            </button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtra per stato"
            >
              <option value="">Tutti gli stati</option>
              {Object.entries(STATUS_LABELS).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
          </div>

          {listLoading ? (
            <p>Caricamento…</p>
          ) : (
            <div className="cr-table-wrap">
              <table className="cr-table">
                <thead>
                  <tr>
                    <th>Titolo</th>
                    <th>Stato</th>
                    <th>Azienda</th>
                    <th>Aggiornamento</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Nessun caso. Crea un nuovo riesame.</td>
                    </tr>
                  ) : (
                    cases.map((c) => (
                      <tr
                        key={c.id}
                        className="cr-row-click"
                        onClick={() => navigate(`/contract-reviews/${c.id}`)}
                      >
                        <td>{c.title}</td>
                        <td>
                          <span className={statusBadgeClass(c.status)}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td>
                          {c.company_id != null ? companiesById.get(c.company_id) || `#${c.company_id}` : '—'}
                        </td>
                        <td>
                          {c.updated_at
                            ? new Date(c.updated_at).toLocaleString('it-IT')
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {caseId && (
        <>
          <div className="contract-review-toolbar">
            <button type="button" className="cr-btn" onClick={() => navigate('/contract-reviews')}>
              ← Elenco
            </button>
          </div>

          {detailLoading || !detail ? (
            <p>Caricamento dettaglio…</p>
          ) : (
            <>
              <div className="cr-detail-header">
                <div className="cr-detail-title-block">
                  <h1>{detail.case.title}</h1>
                  <div className="cr-meta">
                    <span className={statusBadgeClass(detail.case.status)}>
                      {STATUS_LABELS[detail.case.status] || detail.case.status}
                    </span>
                    {' · '}
                    Rif. esterno: {detail.case.external_ref || '—'}
                    {' · '}
                    Azienda:{' '}
                    {detail.case.company_id != null
                      ? companiesById.get(detail.case.company_id) || `#${detail.case.company_id}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div className="cr-panel">
                <h2>Dati caso</h2>
                <div className="cr-form-row">
                  <label htmlFor="cr-edit-title">Titolo</label>
                  <input
                    id="cr-edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    disabled={TERMINAL_STATUSES.has(detail.case.status)}
                  />
                </div>
                <div className="cr-form-row">
                  <label htmlFor="cr-edit-notes">Note</label>
                  <textarea
                    id="cr-edit-notes"
                    className="cr-notes-textarea"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    disabled={TERMINAL_STATUSES.has(detail.case.status)}
                  />
                </div>
                {!TERMINAL_STATUSES.has(detail.case.status) && (
                  <button
                    type="button"
                    className="cr-btn cr-btn-primary"
                    disabled={savingCase}
                    onClick={() => handleSaveCaseMeta()}
                  >
                    {savingCase ? 'Salvataggio…' : 'Salva modifiche'}
                  </button>
                )}
              </div>

              {!TERMINAL_STATUSES.has(detail.case.status) && (
                <div className="cr-panel">
                  <h2>Avanza stato</h2>
                  <p className="contract-review-intro" style={{ marginTop: 0 }}>
                    Per annulli, respingimenti o passaggi indietro è richiesta una motivazione.
                  </p>
                  <div className="cr-transition-row">
                    {transitionTargets.map(({ to, label, danger }) => (
                      <button
                        key={to + label}
                        type="button"
                        className={danger ? 'cr-btn cr-btn-danger' : 'cr-btn cr-btn-primary'}
                        onClick={() => openTransition(to)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="cr-panel">
                <h2>Cronologia stati</h2>
                <ul className="cr-timeline">
                  {detail.history.length === 0 ? (
                    <li>Nessun evento.</li>
                  ) : (
                    detail.history.map((h) => (
                      <li key={h.id}>
                        <time>{new Date(h.created_at).toLocaleString('it-IT')}</time>
                        {h.from_status ? STATUS_LABELS[h.from_status] || h.from_status : '(inizio)'} →{' '}
                        {STATUS_LABELS[h.to_status] || h.to_status}
                        {h.reason ? (
                          <>
                            <br />
                            <em>Motivo:</em> {h.reason}
                          </>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="cr-panel">
                <h2>Checklist</h2>
                <div className="cr-transition-row" style={{ marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    className="cr-btn"
                    disabled={TERMINAL_STATUSES.has(detail.case.status)}
                    onClick={() => handleGenerateChecklist('preliminary')}
                  >
                    Genera preliminare
                  </button>
                  <button
                    type="button"
                    className="cr-btn"
                    disabled={TERMINAL_STATUSES.has(detail.case.status)}
                    onClick={() => handleGenerateChecklist('final')}
                  >
                    Genera finale
                  </button>
                </div>

                <div className="cr-checklist-phase">
                  <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Preliminare</h3>
                  {checklistPreliminary.length === 0 ? (
                    <p className="contract-review-intro">Nessuna voce: usa &quot;Genera preliminare&quot;.</p>
                  ) : (
                    checklistPreliminary.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        disabled={TERMINAL_STATUSES.has(detail.case.status)}
                        onSave={(patch) => handleSaveChecklistItem(item.id, patch)}
                      />
                    ))
                  )}
                </div>

                <div className="cr-checklist-phase">
                  <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Finale</h3>
                  {checklistFinal.length === 0 ? (
                    <p className="contract-review-intro">Nessuna voce: usa &quot;Genera finale&quot;.</p>
                  ) : (
                    checklistFinal.map((item) => (
                      <ChecklistItemRow
                        key={item.id}
                        item={item}
                        disabled={TERMINAL_STATUSES.has(detail.case.status)}
                        onSave={(patch) => handleSaveChecklistItem(item.id, patch)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="cr-panel">
                <h2>Analisi AI del capitolato</h2>
                <p className="contract-review-intro" style={{ marginTop: 0 }}>
                  Incolla il testo del capitolato o carica un file .txt. L’analisi usa il profilo
                  azienda selezionato come contesto normativo.
                </p>
                <div className="cr-form-row">
                  <label htmlFor="cr-ai-company">Azienda per contesto AI</label>
                  <select
                    id="cr-ai-company"
                    value={aiCompanyContextId}
                    onChange={(e) => setAiCompanyContextId(e.target.value)}
                  >
                    <option value="">— Seleziona —</option>
                    {companies.map((co) => (
                      <option key={co.id} value={String(co.id)}>
                        {co.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  className="cr-ai-textarea"
                  placeholder="Testo capitolato / richiesta d’offerta…"
                  value={capitolatoText}
                  onChange={(e) => setCapitolatoText(e.target.value)}
                />
                <div className="cr-transition-row">
                  <label className="cr-btn" style={{ cursor: 'pointer', margin: 0 }}>
                    Carica file testo
                    <input type="file" accept=".txt,text/plain" hidden onChange={handleCapitolatoFile} />
                  </label>
                  <button
                    type="button"
                    className="cr-btn cr-btn-primary"
                    disabled={aiLoading}
                    onClick={() => handleRunAiAnalysis()}
                  >
                    {aiLoading ? 'Analisi…' : 'Analisi AI del capitolato'}
                  </button>
                  {aiSuggestion && (
                    <button type="button" className="cr-btn" onClick={() => clearAi()}>
                      Pulisci risultato
                    </button>
                  )}
                </div>

                <AiSuggestionInline
                  loading={aiLoading}
                  error={aiHookError && !aiLoading && !aiSuggestion ? aiHookError : null}
                  suggestion={
                    aiSuggestion && aiSuggestion.raw != null && !aiStructured
                      ? typeof aiSuggestion.raw === 'string'
                        ? aiSuggestion.raw
                        : JSON.stringify(aiSuggestion.raw)
                      : null
                  }
                  onReject={() => clearAi()}
                />

                {aiStructured && (
                  <>
                    <div className="cr-ai-summary-grid">
                      <div className="cr-ai-kpi">
                        <div>Rischio complessivo</div>
                        <div className={riskClass(aiSuggestion.overall_risk)}>
                          {riskLabel(aiSuggestion.overall_risk)}
                        </div>
                      </div>
                      <div className="cr-ai-kpi" style={{ gridColumn: 'span 2' }}>
                        <div>Sintesi</div>
                        <div>{aiSuggestion.summary || '—'}</div>
                      </div>
                    </div>

                    {Array.isArray(aiSuggestion.identified_standards) &&
                      aiSuggestion.identified_standards.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <strong>Norme citate:</strong>{' '}
                          {aiSuggestion.identified_standards.join(', ')}
                        </div>
                      )}

                    <div className="cr-table-wrap" style={{ marginBottom: '1rem' }}>
                      <table className="cr-table">
                        <thead>
                          <tr>
                            <th>Rif.</th>
                            <th>Requisito</th>
                            <th>Valutazione</th>
                            <th>Azione suggerita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(aiSuggestion.identified_requirements || []).map((r, idx) => (
                            <tr key={r.ref || idx}>
                              <td>{r.ref || `—`}</td>
                              <td>
                                {r.description || '—'}
                                {r.source ? (
                                  <>
                                    <br />
                                    <small style={{ color: '#78909c' }}>Fonte: {r.source}</small>
                                  </>
                                ) : null}
                                {r.gap_detail ? (
                                  <>
                                    <br />
                                    <small>Gap: {r.gap_detail}</small>
                                  </>
                                ) : null}
                              </td>
                              <td>
                                <span className={assessmentClass(r.assessment)}>
                                  {assessmentLabel(r.assessment)}
                                </span>
                              </td>
                              <td>{r.suggested_action || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="cr-transition-row">
                      <button
                        type="button"
                        className="cr-btn cr-btn-primary"
                        disabled={applyAiBusy || TERMINAL_STATUSES.has(detail.case.status)}
                        onClick={() => handleApplyAiToPreliminary()}
                      >
                        {applyAiBusy ? 'Applicazione…' : 'Applica suggerimenti alla checklist preliminare'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {createOpen && (
        <div className="cr-modal-overlay" role="presentation" onClick={() => setCreateOpen(false)}>
          <div className="cr-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Nuovo riesame</h3>
            <form onSubmit={handleCreate}>
              <div className="cr-form-row">
                <label htmlFor="cr-new-title">Titolo *</label>
                <input
                  id="cr-new-title"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="cr-form-row">
                <label htmlFor="cr-new-co">Azienda</label>
                <select
                  id="cr-new-co"
                  value={createForm.company_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, company_id: e.target.value }))}
                >
                  <option value="">— Opzionale —</option>
                  {companies.map((co) => (
                    <option key={co.id} value={String(co.id)}>
                      {co.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cr-form-row">
                <label htmlFor="cr-new-ext">Riferimento esterno</label>
                <input
                  id="cr-new-ext"
                  value={createForm.external_ref}
                  onChange={(e) => setCreateForm((f) => ({ ...f, external_ref: e.target.value }))}
                />
              </div>
              <div className="cr-modal-actions">
                <button type="button" className="cr-btn" onClick={() => setCreateOpen(false)}>
                  Annulla
                </button>
                <button type="submit" className="cr-btn cr-btn-primary">
                  Crea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {transitionModal && (
        <div className="cr-modal-overlay" role="presentation" onClick={() => setTransitionModal(null)}>
          <div className="cr-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Motivo transizione</h3>
            <p style={{ fontSize: '0.88rem', color: '#555' }}>
              Passaggio a:{' '}
              <strong>{STATUS_LABELS[transitionModal.toStatus] || transitionModal.toStatus}</strong>
            </p>
            <textarea
              placeholder="Motivazione obbligatoria…"
              value={transitionModal.reason}
              onChange={(e) =>
                setTransitionModal((m) => ({ ...m, reason: e.target.value }))
              }
            />
            <div className="cr-modal-actions">
              <button type="button" className="cr-btn" onClick={() => setTransitionModal(null)}>
                Annulla
              </button>
              <button
                type="button"
                className="cr-btn cr-btn-primary"
                onClick={() =>
                  commitTransition(transitionModal.toStatus, transitionModal.reason || '')
                }
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItemRow({ item, disabled, onSave }) {
  const [notes, setNotes] = useState(item.notes || '');
  useEffect(() => {
    setNotes(item.notes || '');
  }, [item.id, item.notes]);

  const ans = item.answer;

  return (
    <div className="cr-checklist-item">
      <div>
        <span className="cr-checklist-ref">{item.item_ref}</span>
        {item.item_text}
      </div>
      <div className="cr-answer-bar">
        {[
          { v: 'yes', l: 'Sì' },
          { v: 'no', l: 'No' },
          { v: 'na', l: 'N/A' },
          { v: 'partial', l: 'Parziale' },
        ].map(({ v, l }) => (
          <button
            key={v}
            type="button"
            className={ans === v ? 'active' : ''}
            disabled={disabled}
            onClick={() => onSave({ answer: v, notes })}
          >
            {l}
          </button>
        ))}
      </div>
      <textarea
        className="cr-notes-textarea"
        placeholder="Note voce checklist"
        value={notes}
        disabled={disabled}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if ((item.notes || '') !== notes) onSave({ notes });
        }}
      />
    </div>
  );
}
