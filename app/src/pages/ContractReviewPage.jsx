/**
 * ContractReviewPage - Riesame requisiti contratto (commercial cases) + analisi AI capitolato
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import apiService, { ApiError } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { useStorage } from '../contexts/StorageContext';
import { getSelectedStandardEntries } from '../data/standardsRegistry';
import { useRouter, useNavigate } from '../contexts/RouterContext';
import AiSuggestionInline from '../components/AiSuggestionInline';
import AiDisclaimer from '../components/AiDisclaimer';
import {
  STATUS_LABELS,
  TERMINAL_STATUSES,
  DETAIL_SLIDES,
  INBOX_KIND_LABELS,
  COUNTERPARTY_LABELS,
  DIRECTION_LABELS,
  formatCommercialDocMetaBadge,
} from '../utils/contractReviewLabels';
import { hydrateDrawingRequirements } from '../utils/drawingExtractionHydrate';
import './ContractReviewPage.css';

// Ruoli documento di commessa (riusati dal form "Collega da registro" e da "Carica allegato caso").
const DOC_ROLE_OPTIONS = [
  { value: 'order', label: 'Ordine' },
  { value: 'rfq', label: 'RFQ' },
  { value: 'capitolato', label: 'Capitolato' },
  { value: 'quote', label: 'Offerta' },
  { value: 'drawing', label: 'Disegno' },
  { value: 'other', label: 'Altro' },
];

/**
 * CoveragePanel — verifica copertura saldatori per una commessa collegata al riesame.
 * Mostra un selettore di progetto + tabella di copertura WPS/qualifiche.
 */
function CoveragePanel({ caseId }) {
  const [expanded,   setExpanded]   = useState(false);
  const [projects,   setProjects]   = useState(null);
  const [projectId,  setProjectId]  = useState('');
  const [coverage,   setCoverage]   = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);

  function handleToggle() {
    if (!expanded && !projects) {
      apiService.getProjects({ limit: 200 })
        .then(r => setProjects(r?.data || []))
        .catch(() => setProjects([]));
    }
    setExpanded(e => !e);
  }

  async function handleCheck() {
    if (!projectId) return;
    setLoading(true); setError(null); setCoverage(null);
    try {
      const data = caseId
        ? await apiService.getCaseExtractedCoverage(caseId, projectId)
        : await apiService.getQualificationsCoverage(projectId);
      setCoverage(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function esitoIcon(esito) {
    if (esito === 'verde') return '\u2705';
    if (esito === 'giallo') return '\u26A0\uFE0F';
    return '\u274C';
  }

  function wpqrStatusLabel(status) {
    if (status === 'ok') return 'Coperto';
    if (status === 'partial') return 'Parziale';
    if (status === 'not_possible') return 'Non coperto';
    if (status === 'need_input') return 'Dati incompleti';
    return 'Non valutato';
  }

  const profile = coverage?.extracted_profile;
  const profileActive = coverage?.extracted_profile_active;
  const advisory = coverage?.advisory;
  const wpqrJoints = advisory?.wpqr_joints;
  const visionFit = advisory?.vision_fitness;

  return (
    <div style={{ marginBottom: 16, borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{ background: '#f0f4ff', border: '1px solid #c7d2fe', borderRadius: 8, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#3730a3' }}
      >
        {expanded ? "\u25B2" : "\u25BC"} {"\uD83D\uDD0D"} Verifica Copertura Saldatori
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {projects === null
            ? <span style={{ fontSize: 13, color: '#6b7280' }}>Caricamento commesse...</span>
            : (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
                <select
                  value={projectId}
                  onChange={e => { setProjectId(e.target.value); setCoverage(null); }}
                  style={{ padding: '7px 10px', border: '1.5px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
                >
                  <option value="">Seleziona commessa...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_code}{p.client_name ? ` \u2014 ${p.client_name}` : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={!projectId || loading}
                  style={{ padding: '7px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: (!projectId || loading) ? 0.5 : 1 }}
                >
                  {loading ? 'Calcolo...' : 'Verifica'}
                </button>
              </div>
            )
          }
          {profileActive && profile && (
            <div style={{ fontSize: 12, color: '#374151', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
              <strong>Requisiti da documenti integrati:</strong>{' '}
              {[
                profile.base_material_group ? `materiale ${profile.base_material_group}` : null,
                profile.thickness_range_min != null
                  ? `spessore ${profile.thickness_range_min}${profile.thickness_range_max != null && profile.thickness_range_max !== profile.thickness_range_min ? `\u2013${profile.thickness_range_max}` : ''} mm`
                  : null,
                profile.welding_process ? `processo ${profile.welding_process}` : null,
                profile.welding_positions ? `posizioni ${profile.welding_positions}` : null,
              ].filter(Boolean).join(' \u00B7 ') || 'profilo tecnico parziale'}
            </div>
          )}
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</div>}
          {coverage && !coverage.has_wps && (
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 10 }}>Nessuna WPS associata alla commessa selezionata.</div>
          )}
          {coverage && coverage.has_wps && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>WPS</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Processo</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Saldatori</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>Esito</th>
                </tr>
              </thead>
              <tbody>
                {coverage.coverage.map(row => (
                  <tr key={row.wps_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{row.wps_code}</td>
                    <td style={{ padding: '8px 10px' }}>{row.welding_process || '\u2014'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {row.qualifiers.length === 0
                        ? <span style={{ color: '#dc2626' }}>Nessuno</span>
                        : row.qualifiers.map(q => <div key={q.id}>{q.person_name}</div>)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      {esitoIcon(row.esito)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* P5 — advisory WPQR + visione (non bloccante) */}
          {coverage && advisory && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Copertura procedure (WPQR) — solo informativo
                </div>
                {(!wpqrJoints?.joints || wpqrJoints.joints.length === 0) ? (
                  <p style={{ margin: 0 }}>
                    Non ci sono abbastanza dati da documenti o WPS per valutare i giunti.
                  </p>
                ) : (
                  <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
                    {wpqrJoints.joints.map((j) => (
                      <li key={j.joint_key} style={{ marginBottom: 6 }}>
                        <strong>{j.label}</strong>
                        {' — '}
                        {wpqrStatusLabel(j.status)}
                        {j.wpqr_code ? ` (WPQR ${j.wpqr_code})` : ''}
                        {j.status === 'need_input' && j.questions?.length > 0 && (
                          <div style={{ marginTop: 2 }}>
                            Dati incompleti:{' '}
                            {j.questions.map((q) => q.question).join(' · ')}
                          </div>
                        )}
                        {j.status === 'not_possible' && j.extensions_needed?.length > 0 && (
                          <div style={{ marginTop: 2 }}>
                            Estensioni segnalate: {j.extensions_needed.join('; ')}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p style={{ margin: 0, fontStyle: 'italic' }}>
                  Questo controllo non cambia il semaforo saldatori.
                </p>
              </div>

              <div style={{ fontSize: 12, color: '#9a3412', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Idoneit{"\u00e0"} visiva (NDT/VT) — solo informativo
                </div>
                {(!visionFit?.gaps || visionFit.gaps.length === 0) ? (
                  <p style={{ margin: 0 }}>
                    {visionFit?.summary?.persons_requiring > 0
                      ? 'Nessun gap: personale NDT/VT con visione in corso di validit\u00e0 (ambito azienda commessa).'
                      : 'Nessun personale NDT/VT che richieda idoneit\u00e0 visiva nell\u2019ambito della commessa.'}
                  </p>
                ) : (
                  <>
                    <p style={{ margin: '0 0 6px' }}>
                      Manca o {"\u00e8"} scaduto il certificato oculistico (acuit{"\u00e0"} + Ishihara) per:
                    </p>
                    <ul style={{ margin: '0 0 6px', paddingLeft: 18 }}>
                      {visionFit.gaps.map((g) => (
                        <li key={`${g.personnel_id || g.person_name}-${g.company_id || 0}`}>
                          <strong>{g.person_name || '—'}</strong>
                          {' — '}
                          {g.vision_state === 'expired' ? 'certificato scaduto' : 'certificato mancante'}
                          {g.requiring_quals?.length
                            ? ` (${g.requiring_quals.length} qualifica/e NDT/VT)`
                            : ''}
                        </li>
                      ))}
                    </ul>
                    <p style={{ margin: 0 }}>
                      Carica il certificato in Qualifiche → Salute mansione. Non blocca la copertura saldatori.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
    commercial_customer_id: row.commercial_customer_id ?? row.commercialCustomerId ?? null,
    commercial_customer_name:
      row.commercial_customer_name ?? row.commercialCustomerName ?? null,
    commercial_customer_ref:
      row.commercial_customer_ref ?? row.commercialCustomerRef ?? null,
    external_ref: row.external_ref ?? row.externalRef,
    notes: row.notes,
    updated_at: row.updated_at ?? row.updatedAt,
    source_import_job_id: row.source_import_job_id ?? row.sourceImportJobId ?? null,
    handoff_ref: row.handoff_ref ?? row.handoffRef ?? null,
    handoff_at: row.handoff_at ?? row.handoffAt ?? null,
    handoff_notes: row.handoff_notes ?? row.handoffNotes ?? null,
  };
}

function companyLabel(companyId, companiesById) {
  if (companyId == null) return null;
  return companiesById.get(companyId) || `#${companyId}`;
}

/** Ruoli controparte ammessi come committente commerciale nel riesame §8.2 */
const COMMITTENTE_COUNTERPARTY_ROLES = new Set(['customer', 'end_customer']);

function filterCommittenteCounterparties(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  return list.filter((cp) => COMMITTENTE_COUNTERPARTY_ROLES.has(cp.role));
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
  return a || '-';
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
  return r || '-';
}

export default function ContractReviewPage() {
  const { user } = useAuth();
  const { currentAudit } = useStorage();
  const { path } = useRouter();
  const navigate = useNavigate();
  const caseId = parseCaseIdFromPath(path);

  const [cases, setCases] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [activeSlide, setActiveSlide] = useState('workflow');
  const [transitionOptions, setTransitionOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [inboxKind, setInboxKind] = useState('assigned_to_me');
  const [newClarMessage, setNewClarMessage] = useState('');
  const [linkDocId, setLinkDocId] = useState('');
  const [attachDocRole, setAttachDocRole] = useState('order');
  const [attachCounterparty, setAttachCounterparty] = useState('customer');
  const [attachDirection, setAttachDirection] = useState('in');
  const [attachSupplierId, setAttachSupplierId] = useState('');
  const [attachAnalysisStarted, setAttachAnalysisStarted] = useState(false);
  // Multi-file upload: progresso e errori parziali (SLICE C)
  const [uploadProgress, setUploadProgress] = useState(null); // { current, total, fileName } | null
  const [uploadPartialErrors, setUploadPartialErrors] = useState([]); // [{ fileName, error }]
  // Polling auto-estrazione: { extractionId: number, attempts: number } | null
  const [analysisPolling, setAnalysisPolling] = useState(null);
  // Banner completamento polling: 'done' | 'error' | null
  const [pollingBanner, setPollingBanner] = useState(null);
  const pollingTimerRef = useRef(null);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoadFailed, setSuppliersLoadFailed] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    company_id: '',
    commercial_customer_id: '',
    commercial_customer_name: '',
    commercial_customer_ref: '',
    external_ref: '',
  });
  const [createCounterparties, setCreateCounterparties] = useState([]);
  const [createCounterpartiesLoading, setCreateCounterpartiesLoading] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editCommercialCustomerId, setEditCommercialCustomerId] = useState('');
  const [editCommercialCustomerName, setEditCommercialCustomerName] = useState('');
  const [editCommercialCustomerRef, setEditCommercialCustomerRef] = useState('');
  const [editCounterparties, setEditCounterparties] = useState([]);
  const [editCounterpartiesLoading, setEditCounterpartiesLoading] = useState(false);
  const [savingCase, setSavingCase] = useState(false);

  const [transitionModal, setTransitionModal] = useState(null);

  const [handoffRef, setHandoffRef] = useState('');
  const [handoffNotes, setHandoffNotes] = useState('');
  const [handoffSaving, setHandoffSaving] = useState(false);

  const [capitolatoText, setCapitolatoText] = useState('');
  const [aiCompanyContextId, setAiCompanyContextId] = useState('');
  const [applyAiBusy, setApplyAiBusy] = useState(false);

  // Stato pannello "Suggerimenti AI da documenti" (SLICE B — pre-popolazione checklist)
  const [aiDocPanelExpanded, setAiDocPanelExpanded] = useState(false);
  const [aiDocSummary, setAiDocSummary] = useState(null);
  const [aiDocLoading, setAiDocLoading] = useState(false);
  const [aiDocError, setAiDocError] = useState(null);
  const [applyExtractedBusy, setApplyExtractedBusy] = useState(false);
  const [analyzeDocsBusy, setAnalyzeDocsBusy] = useState(false);
  const [analyzeDocsResult, setAnalyzeDocsResult] = useState(null);

  // Stato locale AI analisi requisiti (percorso canonico POST /contract-reviews/:id/ai/analyze-requirements)
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHookError, setAiHookError] = useState(null);

  function clearAi() {
    setAiSuggestion(null);
    setAiHookError(null);
  }

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

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await apiService.getSuppliers({ is_active: 'true' });
      const list = Array.isArray(res) ? res : res?.data || [];
      setSuppliers(list);
      setSuppliersLoadFailed(false);
    } catch {
      setSuppliers([]);
      setSuppliersLoadFailed(true);
    }
  }, []);

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
        clarifications: data.clarifications || [],
        documents: data.documents || [],
        attachments: data.attachments || [],
        textAnalysis: data.text_analysis || null,
      });
      // Idrata l'analisi capitolato persistita (slice #2): al riapri il risultato è ancora lì.
      if (data.text_analysis?.suggestion) {
        setAiSuggestion(data.text_analysis.suggestion);
      }
      setEditTitle(c.title || '');
      setEditNotes(c.notes || '');
      setEditCompanyId(c.company_id != null ? String(c.company_id) : '');
      setEditCommercialCustomerId(c.commercial_customer_id != null ? String(c.commercial_customer_id) : '');
      setEditCommercialCustomerName(c.commercial_customer_name || '');
      setEditCommercialCustomerRef(c.commercial_customer_ref || '');
      setHandoffRef(c.handoff_ref || '');
      setHandoffNotes(c.handoff_notes || '');
      const cid = c.company_id != null ? String(c.company_id) : '';
      setAiCompanyContextId(cid);
      try {
        const tr = await apiService.getContractReviewTransitionOptions(id);
        setTransitionOptions(tr?.options || []);
      } catch {
        setTransitionOptions([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Errore dettaglio');
      setDetail(null);
      setTransitionOptions([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const s = await apiService.getContractReviewSummary();
      setSummary(s);
    } catch {
      setSummary(null);
    }
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const res = await apiService.getContractReviewInbox(inboxKind, 15);
      setInbox(res?.items || []);
    } catch {
      setInbox([]);
    }
  }, [inboxKind]);

  useEffect(() => {
    loadCompanies();
    loadSuppliers();
  }, [loadCompanies, loadSuppliers]);

  useEffect(() => {
    loadList();
    loadSummary();
  }, [loadList, loadSummary]);

  useEffect(() => {
    if (!caseId) {
      loadInbox();
      setActiveSlide('workflow');
    }
  }, [caseId, loadInbox]);

  useEffect(() => {
    loadDetail(caseId);
  }, [caseId, loadDetail]);

  useEffect(() => {
    if (!caseId) {
      setAiSuggestion(null);
      setAiHookError(null);
    }
  }, [caseId]);

  // Carica controparti (cliente diretto + committente finale) per il form di modifica caso
  useEffect(() => {
    if (!editCompanyId) {
      setEditCounterparties([]);
      return;
    }
    setEditCounterpartiesLoading(true);
    apiService.getCompanyCounterparties(editCompanyId, { is_active: 'true' })
      .then((res) => {
        const list = filterCommittenteCounterparties(Array.isArray(res) ? res : res?.data || []);
        setEditCounterparties(list);
      })
      .catch(() => setEditCounterparties([]))
      .finally(() => setEditCounterpartiesLoading(false));
  }, [editCompanyId]);

  // Carica controparti per il form di creazione, solo quando il modale è aperto
  useEffect(() => {
    if (!createOpen || !createForm.company_id) {
      setCreateCounterparties([]);
      return;
    }
    setCreateCounterpartiesLoading(true);
    apiService.getCompanyCounterparties(createForm.company_id, { is_active: 'true' })
      .then((res) => {
        const list = filterCommittenteCounterparties(Array.isArray(res) ? res : res?.data || []);
        setCreateCounterparties(list);
      })
      .catch(() => setCreateCounterparties([]))
      .finally(() => setCreateCounterpartiesLoading(false));
  }, [createOpen, createForm.company_id]);

  // Polling auto-estrazione AI: si attiva quando upload restituisce analysis_job_id.
  // Massimo 10 tentativi (30 secondi totali); si ferma appena status !== 'processing'.
  useEffect(() => {
    if (!analysisPolling || !caseId) return;
    const { extractionId, attempts } = analysisPolling;
    if (attempts >= 10) {
      setAnalysisPolling(null);
      return;
    }
    const timerId = setTimeout(async () => {
      try {
        const data = await apiService.getDrawingExtraction(caseId, extractionId);
        if (data.status !== 'processing') {
          setAnalysisPolling(null);
          setPollingBanner(data.status === 'done' ? 'done' : 'error');
          setTimeout(() => setPollingBanner(null), 8000);
          await loadDetail(caseId);
        } else {
          setAnalysisPolling(prev => prev ? { ...prev, attempts: prev.attempts + 1 } : null);
        }
      } catch {
        // In caso di errore di rete, continua a ritentare fino al limite
        setAnalysisPolling(prev => prev ? { ...prev, attempts: prev.attempts + 1 } : null);
      }
    }, 3000);
    pollingTimerRef.current = timerId;
    return () => clearTimeout(timerId);
  }, [analysisPolling, caseId, loadDetail]);

  // Pulizia polling al cambio commessa o unmount
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, [caseId]);

  async function handleSaveCaseMeta() {
    if (!caseId || !detail?.case) return;
    setSavingCase(true);
    setError(null);
    try {
      const updateBody = {
        title: editTitle.trim(),
        notes: editNotes,
        company_id: editCompanyId ? parseInt(editCompanyId, 10) : null,
      };
      if (editCommercialCustomerId) {
        updateBody.commercial_customer_id = parseInt(editCommercialCustomerId, 10);
      } else {
        updateBody.commercial_customer_id = null;
        updateBody.commercial_customer_name = editCommercialCustomerName.trim() || null;
        updateBody.commercial_customer_ref = editCommercialCustomerRef.trim() || null;
      }
      await apiService.updateContractReview(caseId, updateBody);
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
      if (createForm.commercial_customer_id) {
        body.commercial_customer_id = parseInt(createForm.commercial_customer_id, 10);
      } else {
        if (createForm.commercial_customer_name.trim()) {
          body.commercial_customer_name = createForm.commercial_customer_name.trim();
        }
        if (createForm.commercial_customer_ref.trim()) {
          body.commercial_customer_ref = createForm.commercial_customer_ref.trim();
        }
      }
      const created = await apiService.createContractReview(body);
      const id = created?.id;
      setCreateOpen(false);
      setCreateForm({
        title: '',
        company_id: '',
        commercial_customer_id: '',
        commercial_customer_name: '',
        commercial_customer_ref: '',
        external_ref: '',
      });
      await loadList();
      if (id) navigate(`/contract-reviews/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Creazione fallita');
    }
  }

  function openTransitionOption(opt) {
    if (!opt?.allowed) return;
    if (opt.requires_reason) {
      setTransitionModal({ toStatus: opt.to_status, reason: '' });
    } else {
      void commitTransition(opt.to_status, '');
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
      await loadSummary();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TRANSITION_BLOCKED') {
        const missing = err.data?.missing_requirements;
        const msg = Array.isArray(missing) && missing.length
          ? missing.join(' · ')
          : err.message;
        setError(msg);
        try {
          const tr = await apiService.getContractReviewTransitionOptions(caseId);
          setTransitionOptions(tr?.options || []);
        } catch {
          /* ignore */
        }
      } else {
        setError(err instanceof ApiError ? err.message : err.message || 'Transizione fallita');
      }
    }
  }

  async function handleRegisterHandoff(e) {
    e.preventDefault();
    if (!caseId || !handoffRef.trim()) return;
    setHandoffSaving(true);
    setError(null);
    try {
      await apiService.registerContractReviewHandoff(caseId, {
        handoff_ref: handoffRef.trim(),
        notes: handoffNotes.trim() || undefined,
      });
      await loadDetail(caseId);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err.message || 'Registrazione passaggio fallita',
      );
    } finally {
      setHandoffSaving(false);
    }
  }

  async function handleAddClarification(e) {
    e.preventDefault();
    if (!caseId || !newClarMessage.trim()) return;
    setError(null);
    try {
      await apiService.createContractReviewClarification(caseId, {
        message: newClarMessage.trim(),
      });
      setNewClarMessage('');
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Errore chiarimento');
    }
  }

  async function handleResolveClarification(clarId, responseText) {
    if (!caseId) return;
    setError(null);
    try {
      await apiService.updateContractReviewClarification(caseId, clarId, {
        response_text: responseText,
        resolved: true,
      });
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Aggiornamento fallito');
    }
  }

  async function handleLinkDocument(e) {
    e.preventDefault();
    if (!caseId) return;
    const docId = parseInt(linkDocId, 10);
    if (!Number.isFinite(docId) || docId <= 0) {
      setError('Inserire un ID documento registro valido.');
      return;
    }
    setError(null);
    try {
      const linkPayload = {
        document_id: docId,
        doc_role: attachDocRole || 'other',
        direction: attachDirection,
        counterparty: attachCounterparty,
      };
      if (attachCounterparty === 'supplier' && attachSupplierId) {
        linkPayload.supplier_id = parseInt(attachSupplierId, 10);
      }
      await apiService.linkContractReviewDocument(caseId, linkPayload);
      setLinkDocId('');
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Collegamento fallito');
    }
  }

  async function handleUploadAttachment(e) {
    const files = Array.from(e.target.files || []);
    if (!caseId || !files.length) return;
    setError(null);
    setAttachAnalysisStarted(false);
    setUploadPartialErrors([]);
    let anyAnalysis = false;
    let lastAnalysisJobId = null;
    const partialErrors = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
      try {
        const result = await apiService.uploadContractReviewAttachment(caseId, file, {
          doc_role: attachDocRole || 'other',
          direction: attachDirection,
          counterparty: attachCounterparty,
        });
        if (result?.analysis_job_id != null) {
          anyAnalysis = true;
          lastAnalysisJobId = result.analysis_job_id;
        }
      } catch (err) {
        partialErrors.push({
          fileName: file.name,
          error: err instanceof ApiError ? err.message : err.message || 'Upload fallito',
        });
      }
    }
    setUploadProgress(null);
    if (partialErrors.length) {
      setUploadPartialErrors(partialErrors);
      if (partialErrors.length === files.length) {
        setError(`Upload fallito per ${files.length} file. Riprova.`);
      }
    }
    if (anyAnalysis) {
      setAttachAnalysisStarted(true);
      setTimeout(() => setAttachAnalysisStarted(false), 6000);
      setPollingBanner(null);
      if (lastAnalysisJobId != null) {
        setAnalysisPolling({ extractionId: lastAnalysisJobId, attempts: 0 });
      }
    }
    await loadDetail(caseId);
    try {
      const tr = await apiService.getContractReviewTransitionOptions(caseId);
      setTransitionOptions(tr?.options || []);
    } catch {
      /* ignore */
    }
    e.target.value = '';
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
      setError("Incolla o carica il testo del capitolato prima di avviare l’analisi.");
      return;
    }
    if (!caseId) return;
    if (!detail?.case?.company_id) {
      setError("Associa un’azienda SGQ (capacità) al caso prima di avviare l’analisi.");
      return;
    }
    setError(null);
    setAiLoading(true);
    setAiHookError(null);
    setAiSuggestion(null);
    try {
      const standardEntries = getSelectedStandardEntries(
        currentAudit?.metadata?.selectedStandards || []
      );
      const standardCodes = standardEntries.length
        ? standardEntries.map((e) => e.key)
        : undefined;
      const res = await apiService.analyzeContractRequirements(caseId, {
        capitolatoText: text,
        standardCodes,
      });
      setAiSuggestion(res?.suggestion || res);
    } catch (err) {
      let msg = (err instanceof ApiError && err.data?.error) || err.message || "Analisi AI fallita";
      if (err instanceof ApiError && err.status === 429) {
        const waitSec = err.data?.retryAfterMs ? Math.ceil(err.data.retryAfterMs / 1000) : null;
        msg = waitSec
          ? `Troppe richieste al server. Attendi circa ${waitSec} secondi e riprova.`
          : "Troppe richieste al server. Attendi qualche minuto e riprova.";
      }
      setAiHookError(msg);
    } finally {
      setAiLoading(false);
    }
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
        const notes = noteParts.join(' - ') || item.notes;
        await apiService.saveChecklistAnswer(caseId, item.id, { answer, notes });
      }
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Applicazione AI fallita');
    } finally {
      setApplyAiBusy(false);
    }
  }

  async function handleLoadAiDocSummary() {
    if (!caseId) return;
    setAiDocLoading(true);
    setAiDocError(null);
    try {
      const data = await apiService.getExtractedRequirementsSummary(caseId);
      setAiDocSummary(data);
    } catch (err) {
      setAiDocError(err instanceof ApiError ? err.message : err.message || 'Caricamento suggerimenti fallito');
      setAiDocSummary(null);
    } finally {
      setAiDocLoading(false);
    }
  }

  async function handleAnalyzeAllDocuments() {
    if (!caseId) return;
    setAnalyzeDocsBusy(true);
    setError(null);
    setAnalyzeDocsResult(null);
    try {
      const result = await apiService.analyzeCaseDocuments(caseId);
      setAnalyzeDocsResult(result);
      setAttachAnalysisStarted(true);
      setTimeout(() => setAttachAnalysisStarted(false), 8000);
      const firstJob = result?.jobs?.[0];
      if (firstJob?.extraction_id != null) {
        setPollingBanner(null);
        setAnalysisPolling({ extractionId: firstJob.extraction_id, attempts: 0 });
      }
      if (aiDocPanelExpanded) {
        await handleLoadAiDocSummary();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Analisi documenti fallita');
    } finally {
      setAnalyzeDocsBusy(false);
    }
  }

  async function handleApplyExtractedToChecklist() {
    if (!caseId || !detail?.checklist?.length || !aiDocSummary?.requirements?.length) return;
    const targets = detail.checklist.filter(
      (c) => (c.phase === 'preliminary' || c.phase === 'final')
        && (!c.answer || c.answer === 'not_evaluated'),
    );
    if (!targets.length) {
      setError('Genera prima la checklist preliminare o finale.');
      return;
    }
    setApplyExtractedBusy(true);
    setError(null);
    const aiPrefix = '[AI doc] ';
    try {
      for (const item of targets) {
        let best = null;
        let bestScore = 0;
        const haystack = `${item.item_text || ''} ${item.item_ref || ''}`;
        for (const r of aiDocSummary.requirements) {
          const blob = `${r.value_text || ''} ${r.field_key || ''} ${r.req_type || ''}`;
          const sc = overlapScore(haystack, blob);
          if (sc > bestScore) {
            bestScore = sc;
            best = r;
          }
        }
        if (!best || bestScore < 1) continue;
        const rawNotes = best.value_text || '';
        if (!rawNotes) continue;
        const notes = item.notes && String(item.notes).includes(aiPrefix)
          ? item.notes
          : `${aiPrefix}${rawNotes}`;
        await apiService.saveChecklistAnswer(caseId, item.id, { notes });
      }
      await loadDetail(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err.message || 'Applicazione suggerimenti fallita');
    } finally {
      setApplyExtractedBusy(false);
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
    return (transitionOptions || []).map((opt) => ({
      to: opt.to_status,
      label: STATUS_LABELS[opt.to_status] || opt.to_status,
      danger: opt.to_status === 'CANCELLED' || opt.to_status === 'REJECTED',
      allowed: opt.allowed !== false,
      requiresReason: Boolean(opt.requires_reason),
      missing: opt.missing_requirements || [],
    }));
  }, [transitionOptions]);

  const checklistPreliminary = detail?.checklist?.filter((c) => c.phase === 'preliminary') || [];
  const checklistFinal = detail?.checklist?.filter((c) => c.phase === 'final') || [];

  const hasSupplierDocs = useMemo(() => {
    if (!detail) return false;
    const docs = detail.documents || [];
    const atts = detail.attachments || [];
    return (
      docs.some((d) => d.counterparty === 'supplier' || d.supplier_id) ||
      atts.some((a) => a.commercial_counterparty === 'supplier')
    );
  }, [detail]);

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
          {summary && (
            <div className="cr-summary-grid">
              <div className="cr-summary-card">
                <div className="cr-summary-value">{summary.open_count ?? 0}</div>
                <div className="cr-summary-label">Casi aperti</div>
              </div>
              <div className="cr-summary-card">
                <div className="cr-summary-value">{summary.assigned_to_me ?? 0}</div>
                <div className="cr-summary-label">Assegnati a me</div>
              </div>
              <div className="cr-summary-card">
                <div className="cr-summary-value">{summary.pending_approval ?? 0}</div>
                <div className="cr-summary-label">Da approvare</div>
              </div>
            </div>
          )}

          <div className="cr-panel" style={{ marginBottom: '1rem' }}>
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Inbox</h2>
            <div className="contract-review-toolbar" style={{ marginBottom: '0.5rem' }}>
              <select
                value={inboxKind}
                onChange={(e) => setInboxKind(e.target.value)}
                aria-label="Tipo inbox"
              >
                {Object.entries(INBOX_KIND_LABELS).map(([k, lab]) => (
                  <option key={k} value={k}>
                    {lab}
                  </option>
                ))}
              </select>
            </div>
            {inbox.length === 0 ? (
              <p className="contract-review-intro" style={{ margin: 0 }}>
                Nessun elemento in questa inbox.
              </p>
            ) : (
              <ul className="cr-inbox-list">
                {inbox.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="cr-inbox-item"
                      onClick={() => navigate(`/contract-reviews/${item.id}`)}
                    >
                      <strong>{item.title}</strong>
                      <span className={statusBadgeClass(item.status)}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                      <small>
                        {[
                          item.company_name || companyLabel(item.company_id, companiesById),
                          item.commercial_customer_name
                            ? `comm. ${item.commercial_customer_name}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '-'}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
                    <th>Capacità (SGQ)</th>
                    <th>Committente</th>
                    <th>Aggiornamento</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Nessun caso. Crea un nuovo riesame.</td>
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
                          {companyLabel(c.company_id, companiesById) || '-'}
                        </td>
                        <td>
                          {c.commercial_customer_name
                            ? (
                              <>
                                {c.commercial_customer_name}
                                {!c.commercial_customer_id && (
                                  <span className="cr-badge cr-badge-draft" style={{ marginLeft: 5, fontSize: '0.7rem' }} title="Committente salvato come testo — collega una controparte per maggiore precisione">legacy</span>
                                )}
                              </>
                            )
                            : '-'}
                        </td>
                        <td>
                          {c.updated_at
                            ? new Date(c.updated_at).toLocaleString('it-IT')
                            : '-'}
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
                    Rif. esterno: {detail.case.external_ref || '-'}
                    {' · '}
                    Capacità:{' '}
                    {companyLabel(detail.case.company_id, companiesById) || '-'}
                    {' · '}
                    Committente:{' '}
                    {detail.case.commercial_customer_name
                      ? (
                        <>
                          {detail.case.commercial_customer_name}
                          {!detail.case.commercial_customer_id && (
                            <span className="cr-badge cr-badge-draft" style={{ marginLeft: 4, fontSize: '0.7rem' }} title="Committente salvato come testo — collega una controparte per maggiore precisione">legacy</span>
                          )}
                        </>
                      )
                      : '-'}
                    {detail.case.commercial_customer_ref ? (
                      <> (rif. {detail.case.commercial_customer_ref})</>
                    ) : null}
                    {detail.case.source_import_job_id != null && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="cr-origin-link"
                          onClick={() =>
                            navigate(
                              `/settings/import-jobs?job=${detail.case.source_import_job_id}`,
                            )
                          }
                        >
                          {`Origine: Import job #${detail.case.source_import_job_id}`}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <nav className="cr-slide-tabs" aria-label="Sezioni caso">
                {DETAIL_SLIDES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={activeSlide === id ? 'cr-slide-tab active' : 'cr-slide-tab'}
                    onClick={() => setActiveSlide(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {activeSlide === 'workflow' && (
              <>
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
                  <label htmlFor="cr-edit-company">Azienda SGQ (capacità)</label>
                  <select
                    id="cr-edit-company"
                    value={editCompanyId}
                    onChange={(e) => setEditCompanyId(e.target.value)}
                    disabled={TERMINAL_STATUSES.has(detail.case.status)}
                  >
                    <option value="">- Non indicata -</option>
                    {companies.map((co) => (
                      <option key={co.id} value={String(co.id)}>
                        {co.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="cr-form-row">
                  <label htmlFor="cr-edit-comm-select">Committente commerciale</label>
                  {editCounterpartiesLoading ? (
                    <span style={{ fontSize: 13, color: '#6b7280' }}>Caricamento controparti…</span>
                  ) : editCounterparties.length > 0 ? (
                    <select
                      id="cr-edit-comm-select"
                      value={editCommercialCustomerId}
                      onChange={(e) => {
                        setEditCommercialCustomerId(e.target.value);
                        if (e.target.value) {
                          const cp = editCounterparties.find((c) => String(c.id) === e.target.value);
                          if (cp) {
                            setEditCommercialCustomerName(cp.name || '');
                            setEditCommercialCustomerRef(cp.external_ref || '');
                          }
                        }
                      }}
                      disabled={TERMINAL_STATUSES.has(detail.case.status)}
                    >
                      <option value="">— Altro (testo libero) —</option>
                      {editCounterparties.map((cp) => (
                        <option key={cp.id} value={String(cp.id)}>
                          {cp.name}{cp.external_ref ? ` (${cp.external_ref})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {!editCommercialCustomerId && (
                    <>
                      <input
                        id="cr-edit-comm-name"
                        value={editCommercialCustomerName}
                        onChange={(e) => setEditCommercialCustomerName(e.target.value)}
                        placeholder="es. PT.MAIDO"
                        disabled={TERMINAL_STATUSES.has(detail.case.status)}
                        style={editCounterparties.length > 0 ? { marginTop: 6 } : undefined}
                      />
                      <div className="cr-form-row" style={{ marginTop: 6 }}>
                        <label htmlFor="cr-edit-comm-ref" style={{ fontSize: '0.85rem' }}>Rif. committente</label>
                        <input
                          id="cr-edit-comm-ref"
                          value={editCommercialCustomerRef}
                          onChange={(e) => setEditCommercialCustomerRef(e.target.value)}
                          placeholder="Codice cliente / ordine"
                          disabled={TERMINAL_STATUSES.has(detail.case.status)}
                        />
                      </div>
                    </>
                  )}
                  {editCommercialCustomerId && (
                    <div className="cr-form-row" style={{ marginTop: 4 }}>
                      <label htmlFor="cr-edit-comm-ref" style={{ fontSize: '0.85rem' }}>Rif. committente</label>
                      <input
                        id="cr-edit-comm-ref"
                        value={editCommercialCustomerRef}
                        readOnly
                        disabled
                        style={{ color: '#6b7280' }}
                      />
                    </div>
                  )}
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
                    {transitionTargets.map(({ to, label, danger, allowed, missing }) => (
                      <button
                        key={to + label}
                        type="button"
                        className={danger ? 'cr-btn cr-btn-danger' : 'cr-btn cr-btn-primary'}
                        disabled={!allowed}
                        title={
                          !allowed && missing.length
                            ? missing.join('\n')
                            : undefined
                        }
                        onClick={() => {
                          const opt = transitionOptions.find((o) => o.to_status === to);
                          if (opt) openTransitionOption(opt);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {transitionTargets.some((t) => !t.allowed && t.missing.length > 0) && (
                    <ul className="cr-gate-hints">
                      {transitionTargets
                        .filter((t) => !t.allowed && t.missing.length)
                        .map((t) => (
                          <li key={t.to}>
                            <strong>{t.label}:</strong> {t.missing.join(' · ')}
                          </li>
                        ))}
                    </ul>
                  )}
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

              {detail.case.status === 'APPROVED' && (
                <div className="cr-panel">
                  <h2>Passaggio a esecuzione</h2>
                  <CoveragePanel caseId={detail.case.id} />
                  {detail.case.handoff_ref ? (
                    <div className="cr-handoff-summary">
                      <p>
                        <strong>Riferimento commessa:</strong> {detail.case.handoff_ref}
                      </p>
                      {detail.case.handoff_at ? (
                        <p className="cr-muted">
                          Registrato il{' '}
                          {new Date(detail.case.handoff_at).toLocaleString('it-IT')}
                        </p>
                      ) : null}
                      {detail.case.handoff_notes ? (
                        <p>
                          <em>Note:</em> {detail.case.handoff_notes}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterHandoff}>
                      <div className="cr-form-row">
                        <label htmlFor="cr-handoff-ref">Riferimento commessa / ordine</label>
                        <input
                          id="cr-handoff-ref"
                          type="text"
                          maxLength={100}
                          value={handoffRef}
                          onChange={(e) => setHandoffRef(e.target.value)}
                          placeholder="Es. COMM-2026-042"
                        />
                      </div>
                      <div className="cr-form-row">
                        <label htmlFor="cr-handoff-notes">Note (opzionale)</label>
                        <textarea
                          id="cr-handoff-notes"
                          className="cr-notes-textarea"
                          value={handoffNotes}
                          onChange={(e) => setHandoffNotes(e.target.value)}
                          rows={2}
                        />
                      </div>
                      <button
                        type="submit"
                        className="cr-btn cr-btn-primary"
                        disabled={handoffSaving || !handoffRef.trim()}
                      >
                        {handoffSaving ? 'Registrazione…' : 'Registra passaggio'}
                      </button>
                    </form>
                  )}
                </div>
              )}
              </>
              )}

              {activeSlide === 'checklist' && (
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

                {/* Pannello "Suggerimenti AI da documenti" — pre-popolazione assistita SLICE B */}
                <AiDocSuggestionsPanel
                  expanded={aiDocPanelExpanded}
                  loading={aiDocLoading}
                  error={aiDocError}
                  summary={aiDocSummary}
                  applyBusy={applyExtractedBusy}
                  hasChecklist={checklistPreliminary.length > 0 || checklistFinal.length > 0}
                  onToggle={() => {
                    const next = !aiDocPanelExpanded;
                    setAiDocPanelExpanded(next);
                    if (next && !aiDocSummary && !aiDocLoading) handleLoadAiDocSummary();
                  }}
                  onApply={handleApplyExtractedToChecklist}
                />

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
                        highlightSubforniture={hasSupplierDocs}
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
              )}

              {activeSlide === 'clarifications' && (
              <div className="cr-panel">
                <h2>Chiarimenti cliente</h2>
                {!TERMINAL_STATUSES.has(detail.case.status) && (
                  <form onSubmit={handleAddClarification} className="cr-form-row">
                    <label htmlFor="cr-new-clar">Nuova richiesta</label>
                    <textarea
                      id="cr-new-clar"
                      className="notes-textarea"
                      value={newClarMessage}
                      onChange={(e) => setNewClarMessage(e.target.value)}
                      placeholder="Testo richiesta al cliente…"
                    />
                    <button type="submit" className="cr-btn cr-btn-primary">
                      Aggiungi
                    </button>
                  </form>
                )}
                <ul className="cr-clar-list">
                  {(detail.clarifications || []).length === 0 ? (
                    <li>Nessun chiarimento registrato.</li>
                  ) : (
                    detail.clarifications.map((cl) => (
                      <li key={cl.id} className={cl.resolved_at ? 'cr-clar-resolved' : ''}>
                        <p>{cl.message}</p>
                        {cl.response_text ? (
                          <p>
                            <em>Risposta:</em> {cl.response_text}
                          </p>
                        ) : !TERMINAL_STATUSES.has(detail.case.status) ? (
                          <ClarificationReplyRow
                            onSave={(text) => handleResolveClarification(cl.id, text)}
                          />
                        ) : null}
                        {cl.resolved_at ? (
                          <small>Risolto il {new Date(cl.resolved_at).toLocaleString('it-IT')}</small>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              )}

              {activeSlide === 'documents' && (
              <div className="cr-panel">
                <h2>Documenti e allegati</h2>
                {!TERMINAL_STATUSES.has(detail.case.status) && (
                  <>
                    <form onSubmit={handleLinkDocument} className="cr-form-row">
                      <label htmlFor="cr-link-doc">Collega da registro (ID documento)</label>
                      <div className="cr-inline-fields">
                        <input
                          id="cr-link-doc"
                          type="number"
                          min="1"
                          value={linkDocId}
                          onChange={(e) => setLinkDocId(e.target.value)}
                          placeholder="ID document_registry"
                        />
                        <select
                          value={attachDocRole}
                          onChange={(e) => setAttachDocRole(e.target.value)}
                          aria-label="Ruolo documento"
                        >
                          {DOC_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <CommercialDocMetaFields
                          counterparty={attachCounterparty}
                          direction={attachDirection}
                          onCounterpartyChange={(value) => {
                            setAttachCounterparty(value);
                            if (value !== 'supplier') setAttachSupplierId('');
                          }}
                          onDirectionChange={setAttachDirection}
                          supplierId={attachSupplierId}
                          onSupplierIdChange={setAttachSupplierId}
                          suppliers={suppliers}
                          suppliersLoadFailed={suppliersLoadFailed}
                        />
                        <button type="submit" className="cr-btn">
                          Collega
                        </button>
                      </div>
                    </form>
                    <div className="cr-form-row">
                      <label>Carica allegato caso</label>
                      <div className="cr-inline-fields">
                        <select
                          value={attachDocRole}
                          onChange={(e) => setAttachDocRole(e.target.value)}
                          aria-label="Ruolo documento allegato"
                        >
                          {DOC_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <CommercialDocMetaFields
                          counterparty={attachCounterparty}
                          direction={attachDirection}
                          onCounterpartyChange={(value) => {
                            setAttachCounterparty(value);
                            if (value !== 'supplier') setAttachSupplierId('');
                          }}
                          onDirectionChange={setAttachDirection}
                          supplierId={attachSupplierId}
                          onSupplierIdChange={setAttachSupplierId}
                          suppliers={suppliers}
                          suppliersLoadFailed={suppliersLoadFailed}
                        />
                        <input
                          type="file"
                          accept="*/*"
                          multiple
                          disabled={uploadProgress != null}
                          onChange={handleUploadAttachment}
                        />
                      </div>
                      {uploadProgress && (
                        <p className="contract-review-intro" style={{ color: '#2563eb', marginTop: '0.4rem' }}>
                          Caricamento {uploadProgress.current}/{uploadProgress.total}&hellip; {uploadProgress.fileName}
                        </p>
                      )}
                      {uploadPartialErrors.length > 0 && (
                        <div style={{ marginTop: '0.4rem' }}>
                          {uploadPartialErrors.map((pe) => (
                            <p key={pe.fileName} className="contract-review-error" style={{ marginBottom: 2 }}>
                              {pe.fileName}: {pe.error}
                            </p>
                          ))}
                        </div>
                      )}
                      {attachAnalysisStarted && (
                        <p className="contract-review-intro" style={{ color: '#2563eb', marginTop: '0.4rem' }}>
                          Analisi AI avviata in background — i risultati appariranno nel pannello Disegni, Checklist o Analisi AI.
                        </p>
                      )}
                      {(detail.attachments || []).length > 0 && !TERMINAL_STATUSES.has(detail.case.status) && (
                        <div className="cr-form-row" style={{ marginTop: '0.75rem' }}>
                          <button
                            type="button"
                            className="cr-btn cr-btn-primary"
                            disabled={analyzeDocsBusy}
                            onClick={() => handleAnalyzeAllDocuments()}
                          >
                            {analyzeDocsBusy ? 'Analisi in corso\u2026' : 'Analizza documenti commessa'}
                          </button>
                          {analyzeDocsResult && (
                            <p className="contract-review-intro" style={{ marginTop: '0.4rem', marginBottom: 0 }}>
                              Avviati {analyzeDocsResult.started} job
                              {analyzeDocsResult.skipped > 0
                                ? ` (${analyzeDocsResult.skipped} allegati saltati: ruolo/formato non analizzabile)`
                                : ''}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <h3 style={{ fontSize: '0.95rem' }}>Documenti registro</h3>
                {(detail.documents || []).length === 0 ? (
                  <p className="contract-review-intro">Nessun documento collegato.</p>
                ) : (
                  <ul className="cr-doc-list">
                    {detail.documents.map((d) => (
                      <li key={d.id}>
                        {d.document_title || `Doc #${d.document_id}`} — ruolo:{' '}
                        {d.doc_role || '-'}
                        {d.supplier_name ? ` (${d.supplier_name})` : ''}
                        <CommercialDocMetaBadge
                          counterparty={d.counterparty}
                          direction={d.direction}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <h3 style={{ fontSize: '0.95rem' }}>Allegati file</h3>
                {(detail.attachments || []).length === 0 ? (
                  <p className="contract-review-intro">Nessun allegato.</p>
                ) : (
                  <ul className="cr-doc-list">
                    {detail.attachments.map((a) => (
                      <li key={a.attachment_id}>
                        {a.file_name}
                        {a.commercial_doc_role ? ` (${a.commercial_doc_role})` : ''}
                        <CommercialDocMetaBadge
                          counterparty={a.commercial_counterparty}
                          direction={a.commercial_direction}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              )}

              {activeSlide === 'drawing' && (
                <DrawingRequirementsPanel
                  caseId={detail.case.id}
                  attachments={detail.attachments}
                  disabled={TERMINAL_STATUSES.has(detail.case.status)}
                  pollingActive={analysisPolling != null}
                  pollingBanner={pollingBanner}
                  onStartPolling={(extractionId) => setAnalysisPolling({ extractionId, attempts: 0 })}
                />
              )}

              {activeSlide === 'ai' && (
              <div className="cr-panel">
                <h2>Analisi AI del capitolato</h2>
                <p className="contract-review-intro" style={{ marginTop: 0 }}>
                  Incolla il testo del capitolato o carica un file .txt. L&apos;analisi valuta le
                  capacità dell&apos;azienda SGQ del caso rispetto ai requisiti del committente
                  commerciale indicato.
                </p>
                <div className="cr-ai-context-summary" style={{ marginBottom: '1rem', fontSize: '0.92rem' }}>
                  <div>
                    <strong>Capacità di:</strong>{' '}
                    {companyLabel(detail.case.company_id, companiesById) || (
                      <span style={{ color: '#b45309' }}>non indicata — seleziona sotto o in Dati caso</span>
                    )}
                  </div>
                  <div>
                    <strong>Committente:</strong>{' '}
                    {detail.case.commercial_customer_name || (
                      <span style={{ color: '#6b7280' }}>non indicato (opzionale)</span>
                    )}
                    {detail.case.commercial_customer_ref
                      ? ` (rif. ${detail.case.commercial_customer_ref})`
                      : ''}
                  </div>
                </div>
                {detail.case.company_id == null && (
                  <div className="cr-form-row">
                    <label htmlFor="cr-ai-company">Azienda SGQ per contesto AI</label>
                    <select
                      id="cr-ai-company"
                      value={aiCompanyContextId}
                      onChange={(e) => setAiCompanyContextId(e.target.value)}
                    >
                      <option value="">- Seleziona -</option>
                      {companies.map((co) => (
                        <option key={co.id} value={String(co.id)}>
                          {co.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
                    {aiLoading ? 'Analisi…' : 'Analisi AI'}
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
                        <div>{aiSuggestion.summary || '-'}</div>
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
                              <td>{r.ref || `-`}</td>
                              <td>
                                {r.description || '-'}
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
                              <td>{r.suggested_action || '-'}</td>
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
              )}
            </>
          )}
          <AiDisclaimer style={{ marginTop: '1rem' }} />
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
                <label htmlFor="cr-new-co">Azienda SGQ (capacità)</label>
                <select
                  id="cr-new-co"
                  value={createForm.company_id}
                  onChange={(e) => setCreateForm((f) => ({ ...f, company_id: e.target.value }))}
                >
                  <option value="">- Opzionale -</option>
                  {companies.map((co) => (
                    <option key={co.id} value={String(co.id)}>
                      {co.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cr-form-row">
                <label htmlFor="cr-new-comm">Committente commerciale</label>
                {createCounterpartiesLoading ? (
                  <span style={{ fontSize: 13, color: '#6b7280' }}>Caricamento controparti…</span>
                ) : createCounterparties.length > 0 ? (
                  <select
                    id="cr-new-comm-select"
                    value={createForm.commercial_customer_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const cp = createCounterparties.find((c) => String(c.id) === val);
                        setCreateForm((f) => ({
                          ...f,
                          commercial_customer_id: val,
                          commercial_customer_name: cp?.name || '',
                          commercial_customer_ref: cp?.external_ref || '',
                        }));
                      } else {
                        setCreateForm((f) => ({
                          ...f,
                          commercial_customer_id: '',
                          commercial_customer_name: '',
                          commercial_customer_ref: '',
                        }));
                      }
                    }}
                  >
                    <option value="">— Altro (testo libero) —</option>
                    {createCounterparties.map((cp) => (
                      <option key={cp.id} value={String(cp.id)}>
                        {cp.name}{cp.external_ref ? ` (${cp.external_ref})` : ''}
                      </option>
                    ))}
                  </select>
                ) : null}
                {!createForm.commercial_customer_id && (
                  <input
                    id="cr-new-comm"
                    value={createForm.commercial_customer_name}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, commercial_customer_name: e.target.value }))
                    }
                    placeholder="es. PT.MAIDO"
                    style={createCounterparties.length > 0 ? { marginTop: 6 } : undefined}
                  />
                )}
              </div>
              <div className="cr-form-row">
                <label htmlFor="cr-new-comm-ref">Rif. committente</label>
                <input
                  id="cr-new-comm-ref"
                  value={createForm.commercial_customer_ref}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, commercial_customer_ref: e.target.value }))
                  }
                  placeholder="Codice cliente / ordine"
                  readOnly={!!createForm.commercial_customer_id}
                  disabled={!!createForm.commercial_customer_id}
                  style={createForm.commercial_customer_id ? { color: '#6b7280' } : undefined}
                />
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

function CommercialDocMetaFields({
  counterparty,
  direction,
  onCounterpartyChange,
  onDirectionChange,
  supplierId,
  onSupplierIdChange,
  suppliers,
  suppliersLoadFailed,
}) {
  return (
    <>
      <select
        value={counterparty}
        onChange={(e) => onCounterpartyChange(e.target.value)}
        aria-label="Controparte"
      >
        {Object.entries(COUNTERPARTY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        value={direction}
        onChange={(e) => onDirectionChange(e.target.value)}
        aria-label="Direzione"
      >
        {Object.entries(DIRECTION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {counterparty === 'supplier' && onSupplierIdChange ? (
        <select
          value={supplierId || ''}
          onChange={(e) => onSupplierIdChange(e.target.value)}
          aria-label="Fornitore anagrafico"
        >
          <option value="">- Fornitore (opz.) -</option>
          {(suppliers || []).map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
      ) : null}
      {counterparty === 'supplier' && suppliersLoadFailed ? (
        <span className="cr-doc-meta-hint" title="Modulo reclami/fornitori non disponibile">
          Anagrafica non caricata
        </span>
      ) : null}
    </>
  );
}

function CommercialDocMetaBadge({ counterparty, direction }) {
  const cp = counterparty || 'customer';
  const dir = direction || 'in';
  const supplierClass = cp === 'supplier' ? ' cr-badge-doc-supplier' : '';
  return (
    <span
      className={`cr-badge cr-badge-doc-meta${supplierClass}`}
      title={formatCommercialDocMetaBadge(cp, dir)}
    >
      {formatCommercialDocMetaBadge(cp, dir)}
    </span>
  );
}

function ClarificationReplyRow({ onSave }) {
  const [text, setText] = useState('');
  return (
    <div className="cr-clar-reply">
      <textarea
        className="notes-textarea"
        placeholder="Risposta cliente…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="cr-btn"
        disabled={!text.trim()}
        onClick={() => {
          onSave(text.trim());
          setText('');
        }}
      >
        Segna risolto
      </button>
    </div>
  );
}

function ChecklistItemRow({ item, disabled, onSave, highlightSubforniture }) {
  const [notes, setNotes] = useState(item.notes || '');
  useEffect(() => {
    setNotes(item.notes || '');
  }, [item.id, item.notes]);

  const ans = item.answer;
  const p9Highlight = item.item_ref === 'P9' && highlightSubforniture;

  return (
    <div className={`cr-checklist-item${p9Highlight ? ' cr-checklist-item--supplier-evidence' : ''}`}>
      <div>
        <span className="cr-checklist-ref">{item.item_ref}</span>
        {item.item_text}
        {p9Highlight ? (
          <span className="cr-checklist-hint">
            {' '}
            — documenti fornitore collegati al caso
          </span>
        ) : null}
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

const REQ_TYPE_LABELS = {
  dimension: 'Quota',
  tolerance: 'Tolleranza',
  gdt: 'GD&T',
  material: 'Materiale',
  weld_symbol: 'Saldatura',
  surface: 'Superficie',
  note: 'Nota',
  title_block: 'Cartiglio',
};

const REVIEW_STATUS_LABELS = {
  extracted: 'Da rivedere',
  confirmed: 'Confermato',
  rejected: 'Rifiutato',
  edited: 'Modificato',
};

function reviewBadgeClass(status) {
  if (status === 'confirmed') return 'cr-badge cr-badge-final';
  if (status === 'rejected') return 'cr-badge cr-badge-negative';
  if (status === 'edited') return 'cr-badge cr-badge-progress';
  return 'cr-badge cr-badge-draft';
}

function confidenceColor(c) {
  if (c == null) return '#9ca3af';
  if (c >= 0.75) return '#16a34a';
  if (c >= 0.4) return '#d97706';
  return '#dc2626';
}

const REQ_TYPE_SOURCE_LABELS = {
  delivery: 'Consegna',
  legal: 'Legale',
  commercial: 'Commerciale',
  spec: 'Specifiche',
  note: 'Nota',
};

/**
 * AiDocSuggestionsPanel — Pannello collassabile "Suggerimenti AI da documenti".
 * Mostra i requisiti estratti (disegni + testi) raggruppati per tipo e offre
 * un pulsante per pre-popolare le note della checklist preliminare (SLICE B).
 */
function AiDocSuggestionsPanel({ expanded, loading, error, summary, applyBusy, hasChecklist, onToggle, onApply }) {
  const hasReqs = summary?.total > 0;

  return (
    <div style={{ marginBottom: 16, border: '1px solid #e0e7ef', borderRadius: 10, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: '#f0f6ff', border: 'none', cursor: 'pointer',
          fontWeight: 600, fontSize: 14, color: '#1e40af',
        }}
      >
        <span>{expanded ? '\u25B2' : '\u25BC'} {'\uD83E\uDD16'} Suggerimenti AI da documenti</span>
        {summary != null && (
          <span style={{ fontWeight: 400, fontSize: 12, color: '#4b5563' }}>
            {summary.total} requisito{summary.total !== 1 ? 'i' : ''} estratto{summary.total !== 1 ? 'i' : ''}
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ padding: '12px 14px', background: '#fff' }}>
          {loading && (
            <p style={{ fontSize: 13, color: '#6b7280' }}>Caricamento suggerimenti AI&hellip;</p>
          )}
          {error && (
            <div className="contract-review-error" style={{ marginBottom: 8 }}>{error}</div>
          )}
          {!loading && !error && summary != null && !hasReqs && (
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              Nessun requisito estratto disponibile. Carica un disegno, un capitolato o un ordine PDF
              e attendi il completamento dell&apos;analisi AI.
            </p>
          )}
          {!loading && hasReqs && summary.by_type && (
            <>
              {Object.entries(summary.by_type).map(([type, reqs]) => (
                <div key={type} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                      {REQ_TYPE_LABELS[type] || REQ_TYPE_SOURCE_LABELS[type] || type}
                    </span>
                    <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 6 }}>{reqs.length} voci</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
                    {reqs.slice(0, 6).map((r) => (
                      <li key={r.id} style={{ fontSize: 13, color: '#1f2937', marginBottom: 2 }}>
                        {r.value_text || '-'}
                        {r.unit ? <small style={{ color: '#78909c' }}> {r.unit}</small> : null}
                        {r.confidence != null && (
                          <small style={{ color: r.confidence >= 0.75 ? '#16a34a' : r.confidence >= 0.4 ? '#d97706' : '#dc2626', marginLeft: 4 }}>
                            {Math.round(r.confidence * 100)}%
                          </small>
                        )}
                        {r.source && r.source !== 'drawing' && (
                          <small style={{ color: '#9ca3af', marginLeft: 4 }}>({REQ_TYPE_SOURCE_LABELS[r.source] || r.source})</small>
                        )}
                      </li>
                    ))}
                    {reqs.length > 6 && (
                      <li style={{ fontSize: 12, color: '#6b7280' }}>+{reqs.length - 6} altri&hellip;</li>
                    )}
                  </ul>
                </div>
              ))}

              {hasChecklist && (
                <button
                  type="button"
                  className="cr-btn cr-btn-primary"
                  disabled={applyBusy}
                  onClick={onApply}
                  style={{ marginTop: 10 }}
                >
                  {applyBusy ? 'Applicazione\u2026' : 'Applica suggerimenti a checklist §8.2'}
                </button>
              )}
            </>
          )}
          {!loading && !hasChecklist && (
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: hasReqs ? 8 : 0, marginBottom: 0 }}>
              Genera prima la checklist preliminare o finale con i pulsanti sopra.
            </p>
          )}
          <AiDisclaimer style={{ marginTop: 10 }} />
        </div>
      )}
    </div>
  );
}

/**
 * DrawingRequirementsPanel — Estrazione AI requisiti tecnici da un disegno di commessa.
 * Riusa l'integrazione Gemini lato server (provider-agnostic). MVP demo investitori.
 */
function DrawingRequirementsPanel({ caseId, attachments, disabled, pollingActive, pollingBanner, onStartPolling }) {
  const drawings = useMemo(
    () => (attachments || []).filter((a) => a.commercial_doc_role === 'drawing'),
    [attachments],
  );
  const [busyId, setBusyId] = useState(null);
  const [hydrating, setHydrating] = useState(false);
  const [error, setError] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);

  useEffect(() => {
    if (pollingActive || !caseId || drawings.length === 0) {
      if (!caseId || drawings.length === 0) {
        setExtraction(null);
        setReqs([]);
      }
      return undefined;
    }

    let cancelled = false;
    setHydrating(true);

    (async () => {
      try {
        const result = await hydrateDrawingRequirements({
          caseId,
          drawings,
          selectedDocId,
          listDrawingExtractions: (id) => apiService.listDrawingExtractions(id),
          getDrawingExtraction: (id, extId) => apiService.getDrawingExtraction(id, extId),
          onStartPolling: (extractionId) => onStartPolling?.(extractionId),
        });
        if (cancelled) return;
        if (result.targetDocId != null && selectedDocId == null) {
          setSelectedDocId(result.targetDocId);
        }
        setExtraction(result.extraction);
        setReqs(result.reqs);
        setError(result.error);
      } catch {
        /* degrado gestito */
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();

    return () => { cancelled = true; };
  }, [caseId, drawings, selectedDocId, pollingActive, pollingBanner, onStartPolling]);

  async function handleExtract(docId) {
    setSelectedDocId(docId);
    setBusyId(docId);
    setError(null);
    try {
      const res = await apiService.extractDrawingRequirements(caseId, docId);
      setExtraction(res);
      setReqs(res.requirements || []);
      if (res.status === 'error') {
        setError(res.error_message || 'Estrazione non riuscita.');
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e.message || 'Estrazione fallita');
    } finally {
      setBusyId(null);
    }
  }

  function handleSelectDrawing(docId) {
    setSelectedDocId(docId);
    setError(null);
  }

  async function handleReview(reqId, patch) {
    setError(null);
    try {
      const updated = await apiService.reviewExtractedRequirement(reqId, patch);
      setReqs((rs) => rs.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e.message || 'Aggiornamento fallito');
    }
  }

  return (
    <div className="cr-panel">
      <h2>Requisiti da disegno</h2>
      <p className="contract-review-intro" style={{ marginTop: 0 }}>
        Estrazione automatica dei requisiti tecnici (materiale, quote, tolleranze, saldature,
        cartiglio) dai disegni caricati sulla commessa. Carica un allegato con ruolo{' '}
        <strong>Disegno</strong> nella sezione Documenti, poi avvia l&apos;estrazione AI e rivedi i
        risultati.
      </p>

      {error && <div className="contract-review-error">{error}</div>}

      {pollingActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#1d4ed8' }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #93c5fd', borderTopColor: '#1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Analisi AI in corso&hellip; i risultati appariranno automaticamente.
        </div>
      )}
      {!pollingActive && pollingBanner === 'done' && (
        <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#166534' }}>
          Analisi AI completata. I requisiti estratti sono disponibili qui sotto.
        </div>
      )}
      {!pollingActive && pollingBanner === 'error' && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#991b1b' }}>
          Analisi AI non riuscita. Verifica il log o riprova manualmente con &quot;Estrai requisiti&quot;.
        </div>
      )}

      {drawings.length === 0 ? (
        <p className="contract-review-intro">
          Nessun disegno collegato. Carica un allegato con ruolo &quot;Disegno&quot; dalla sezione
          Documenti.
        </p>
      ) : (
        <ul className="cr-doc-list">
          {drawings.map((d) => (
            <li
              key={d.attachment_id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
            >
              <button
                type="button"
                className="cr-btn"
                style={{
                  fontWeight: 600,
                  border: selectedDocId === d.attachment_id ? '2px solid #2563eb' : undefined,
                }}
                disabled={disabled || hydrating}
                onClick={() => handleSelectDrawing(d.attachment_id)}
              >
                {d.file_name}
              </button>
              <button
                type="button"
                className="cr-btn cr-btn-primary"
                disabled={disabled || busyId === d.attachment_id}
                onClick={() => handleExtract(d.attachment_id)}
              >
                {busyId === d.attachment_id ? 'Estrazione…' : 'Estrai requisiti'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hydrating && !extraction && (
        <p className="contract-review-intro" style={{ marginTop: 12 }}>
          Caricamento estrazioni salvate&hellip;
        </p>
      )}

      {extraction && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            Provider: <strong>{extraction.provider || '-'}</strong>
            {' · '}Stato: <strong>{extraction.status || '-'}</strong>
            {' · '}Requisiti: <strong>{reqs.length}</strong>
          </div>

          {reqs.length === 0 ? (
            <p className="contract-review-intro">
              Nessun requisito estratto da questo disegno.
            </p>
          ) : (
            <div className="cr-table-wrap">
              <table className="cr-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Requisito</th>
                    <th>Conf.</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {reqs.map((r) => (
                    <ExtractedRequirementRow
                      key={r.id}
                      req={r}
                      disabled={disabled}
                      onReview={handleReview}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExtractedRequirementRow({ req, disabled, onReview }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(req.value_text || '');

  useEffect(() => {
    setValue(req.value_text || '');
  }, [req.id, req.value_text]);

  const confPct = req.confidence != null ? Math.round(req.confidence * 100) : null;

  return (
    <tr>
      <td>{REQ_TYPE_LABELS[req.req_type] || req.req_type}</td>
      <td>
        {editing ? (
          <textarea
            className="notes-textarea"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={2}
          />
        ) : (
          <>
            {req.value_text || '-'}
            {req.field_key ? (
              <>
                <br />
                <small style={{ color: '#78909c' }}>{req.field_key}</small>
              </>
            ) : null}
            {req.unit ? <small style={{ color: '#78909c' }}> · {req.unit}</small> : null}
          </>
        )}
      </td>
      <td style={{ color: confidenceColor(req.confidence), fontWeight: 600 }}>
        {confPct != null ? `${confPct}%` : '-'}
      </td>
      <td>
        <span className={reviewBadgeClass(req.review_status)}>
          {REVIEW_STATUS_LABELS[req.review_status] || req.review_status}
        </span>
      </td>
      <td>
        {editing ? (
          <div className="cr-transition-row">
            <button
              type="button"
              className="cr-btn cr-btn-primary"
              onClick={() => {
                onReview(req.id, { review_status: 'edited', value_text: value });
                setEditing(false);
              }}
            >
              Salva
            </button>
            <button
              type="button"
              className="cr-btn"
              onClick={() => {
                setValue(req.value_text || '');
                setEditing(false);
              }}
            >
              Annulla
            </button>
          </div>
        ) : (
          <div className="cr-transition-row">
            <button
              type="button"
              className="cr-btn cr-btn-primary"
              disabled={disabled}
              onClick={() => onReview(req.id, { review_status: 'confirmed' })}
            >
              Conferma
            </button>
            <button
              type="button"
              className="cr-btn"
              disabled={disabled}
              onClick={() => setEditing(true)}
            >
              Modifica
            </button>
            <button
              type="button"
              className="cr-btn cr-btn-danger"
              disabled={disabled}
              onClick={() => onReview(req.id, { review_status: 'rejected' })}
            >
              Rifiuta
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
