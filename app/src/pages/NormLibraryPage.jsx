/**
 * NormLibraryPage — Gestione → Libreria (LN-1…LN-3)
 * Catalogo fonti + richieste mancanti; LN-2 deep-link/NormUpload; LN-3 qualità sola lettura.
 * SoT = document_registry via GET /documents; niente colonne/doc_type nuovi.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "../contexts/RouterContext";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import { DOC_TYPE_LABELS } from "../data/documentTypes";
import { formatDate } from "../utils/dateHelpers";
import {
  buildDocumentDeepLink,
  buildDocumentRegistryPath,
} from "../utils/documentRegistryUrl";
import SgqDataGrid from "../components/SgqDataGrid";
import NormUploadButton from "../components/NormUploadButton";
import StatusBadge from "../components/StatusBadge";
import backlogSnapshot from "../data/normeMancantiBacklog.json";
import {
  addLibraryRequest,
  formatLibraryRequestMarkdownRow,
  loadLibraryRequests,
  mergeBacklogRows,
  removeLibraryRequest,
} from "../utils/libraryBacklogRequests";
import {
  libraryGapCodesMatch,
  parseLibraryGapSearch,
  buildLibraryGapPath,
} from "../utils/libraryGapDeepLink";
import "./NormLibraryPage.css";

/** Tipi già tipizzati usati come fonti di riferimento (LN-1 — niente libro/quaderno nuovi). */
export const LIBRARY_REFERENCE_DOC_TYPES = ["norma", "manuale", "altro"];

/**
 * Label Libreria (LN-4): chiarisce libri/quaderni senza nuovi doc_type.
 * Documenti / form globali restano su DOC_TYPE_LABELS.
 */
export const LIBRARY_DOC_TYPE_LABELS = {
  norma: "Norma tecnica",
  manuale: "Manuale / libro",
  altro: "Altro / quaderno",
};

function libraryDocTypeLabel(docType) {
  if (!docType) return "\u2014";
  return (
    LIBRARY_DOC_TYPE_LABELS[docType] ||
    DOC_TYPE_LABELS[docType] ||
    docType
  );
}

const VALIDITY_LABELS = {
  vigente: "Vigente",
  superata: "Superata",
  da_verificare: "Da verificare",
  ritirata: "Ritirata",
  annullata: "Annullata",
  in_revisione: "In revisione",
};

const BACKLOG_STATUS_LABELS = {
  da_richiedere: "Da richiedere",
  pdf_ricevuto: "PDF ricevuto",
  digitalizzata: "Digitalizzata",
  parcheggio: "Parcheggio",
  open: "Aperta (assistente)",
  in_progress: "In corso",
  digitized: "Digitalizzata",
  closed: "Chiusa (ingest tenant)",
};

/** Mappa riga API library_source_requests → griglia backlog Libreria */
function mapServerRequestToBacklogRow(row) {
  if (!row) return null;
  const reason = row.reason || "";
  const quality = row.quality_notes || row.qualityNotes || "";
  const notes = [reason, quality ? `Qualità: ${quality}` : ""]
    .filter(Boolean)
    .join(" — ");
  const statusMap = {
    open: "da_richiedere",
    in_progress: "pdf_ricevuto",
    digitized: "digitalizzata",
    closed: "closed",
  };
  return {
    id: `srv-${row.id}`,
    serverId: row.id,
    code: row.source_code || row.code,
    impact:
      row.closure_path === "tenant"
        ? "Via tenant (ingest Libreria)"
        : "Via piattaforma (superadmin / Cursor)",
    status: statusMap[row.status] || row.status || "da_richiedere",
    priority: "P1",
    notes: notes || "—",
    source: "assistente",
  };
}

function resolveValidityStatus(doc) {
  if (!doc || doc.doc_type !== "norma") return null;
  const raw =
    doc.validity_status ||
    doc.norm_validity_status ||
    doc.type_specific_data?.validity_status ||
    null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

function resolvePublicationDate(doc) {
  if (!doc || doc.doc_type === "norma") return null;
  if (doc.issue_date) return doc.issue_date;
  const tsd = doc.type_specific_data;
  if (tsd && typeof tsd === "object") {
    return tsd.issue_date || tsd.publication_date || null;
  }
  return null;
}

/** Qualità testo da list API (`norm_text_quality`) o TSD — sola lettura LN-3. */
function resolveTextQuality(doc) {
  if (!doc) return null;
  const raw =
    doc.norm_text_quality ||
    doc.text_quality ||
    doc.type_specific_data?.text_quality ||
    null;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

function resolveHasChunks(doc) {
  if (!doc) return false;
  const v = doc.has_chunks;
  return v === true || v === 1 || v === "1";
}

function resolveLastValidityCheck(doc) {
  if (!doc) return null;
  const raw =
    doc.norm_last_check ||
    doc.last_validity_check ||
    doc.type_specific_data?.last_validity_check ||
    null;
  if (raw == null || String(raw).trim() === "") return null;
  return raw;
}

function ValidityBadge({ status }) {
  if (!status) {
    return <span className="nl-muted">{"\u2014"}</span>;
  }
  const label = VALIDITY_LABELS[status] || status;
  return (
    <span className={`norm-validity-inline norm-validity-inline--${status}`}>
      {label}
    </span>
  );
}

const CATALOG_COLUMNS = [
  { id: "doc_code", label: "Codice", width: "110px", sortable: true },
  { id: "title", label: "Titolo", width: "1fr", sortable: true },
  { id: "doc_type", label: "Tipo", width: "110px", sortable: true },
  { id: "meta", label: "Vigore / data pubbl.", width: "140px", sortable: false },
  { id: "quality", label: "Qualità testo", width: "110px", sortable: false },
  { id: "chunks", label: "Chunk RAG", width: "90px", sortable: false },
  { id: "last_check", label: "Ultimo check", width: "110px", sortable: false },
  { id: "actions", label: "", width: "120px", sortable: false },
];

const BACKLOG_COLUMNS = [
  { id: "code", label: "Codice / titolo", width: "1.4fr", sortable: true },
  { id: "impact", label: "Impatto", width: "1fr", sortable: true },
  { id: "status", label: "Stato", width: "120px", sortable: true },
  { id: "priority", label: "Priorità", width: "80px", sortable: true },
  { id: "source", label: "Fonte", width: "100px", sortable: true },
  { id: "notes", label: "Note", width: "1.1fr", sortable: false },
  { id: "studio_actions", label: "", width: "150px", sortable: false },
];

/** LG-3 — coda superadmin gap piattaforma (cross-tenant) */
const PLATFORM_QUEUE_COLUMNS = [
  { id: "source_code", label: "Codice", width: "1.2fr", sortable: true },
  { id: "org", label: "Studio richiedente", width: "1fr", sortable: true },
  { id: "status", label: "Stato", width: "110px", sortable: true },
  { id: "reason", label: "Perché serve", width: "1.4fr", sortable: false },
  { id: "created_at", label: "Creata", width: "110px", sortable: true },
  { id: "queue_actions", label: "", width: "200px", sortable: false },
];

const EMPTY_REQUEST_FORM = {
  code: "",
  impact: "",
  status: "da_richiedere",
  priority: "P2",
  notes: "",
};

export function NormLibraryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperadmin = user?.role === "superadmin";
  const orgId = user?.organization_id;

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [studioRequests, setStudioRequests] = useState([]);
  const [serverRequests, setServerRequests] = useState([]);
  const [platformQueue, setPlatformQueue] = useState([]);
  const [platformQueueLoading, setPlatformQueueLoading] = useState(false);
  const [platformQueueError, setPlatformQueueError] = useState(null);
  const [ackBusyId, setAckBusyId] = useState(null);
  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST_FORM);
  const [requestError, setRequestError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [gapDeepLink, setGapDeepLink] = useState(() =>
    typeof window !== "undefined"
      ? parseLibraryGapSearch(window.location.search)
      : { highlight: null, path: null, prefill: false }
  );

  const platformBacklog = useMemo(
    () => (Array.isArray(backlogSnapshot?.items) ? backlogSnapshot.items : []),
    []
  );

  const backlogItems = useMemo(() => {
    const mappedServer = (serverRequests || [])
      .map(mapServerRequestToBacklogRow)
      .filter(Boolean);
    const base = mergeBacklogRows(platformBacklog, studioRequests);
    // Server (assistente) in testa; evita duplicare stesso codice già in studio locale
    const codes = new Set(mappedServer.map((r) => String(r.code || "").toLowerCase()));
    const filteredBase = base.filter(
      (r) => !codes.has(String(r.code || "").toLowerCase())
    );
    return [...mappedServer, ...filteredBase];
  }, [platformBacklog, studioRequests, serverRequests]);

  const loadServerRequests = useCallback(async () => {
    try {
      const res = await apiService.getLibrarySourceRequests();
      const items = res?.items || res?.data?.items || [];
      setServerRequests(Array.isArray(items) ? items : []);
    } catch {
      setServerRequests([]);
    }
  }, []);

  const loadPlatformQueue = useCallback(async () => {
    if (!isSuperadmin) return;
    setPlatformQueueLoading(true);
    setPlatformQueueError(null);
    try {
      const res = await apiService.getLibraryPlatformQueue();
      const items = res?.items || res?.data?.items || [];
      setPlatformQueue(Array.isArray(items) ? items : []);
    } catch (err) {
      setPlatformQueue([]);
      setPlatformQueueError(
        err?.message || "Errore lettura coda gap piattaforma"
      );
    } finally {
      setPlatformQueueLoading(false);
    }
  }, [isSuperadmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setStudioRequests(loadLibraryRequests(orgId));
    loadServerRequests();
  }, [isAdmin, orgId, loadServerRequests]);

  useEffect(() => {
    if (isSuperadmin) loadPlatformQueue();
  }, [isSuperadmin, loadPlatformQueue]);

  // LG-2: deep-link da Assistente (?highlight=&path=&prefill=)
  useEffect(() => {
    if (!isAdmin) return;
    const parsed = parseLibraryGapSearch(
      typeof window !== "undefined" ? window.location.search : ""
    );
    setGapDeepLink(parsed);
    if (parsed.prefill && parsed.highlight) {
      setRequestForm((f) => ({
        ...f,
        code: parsed.highlight,
        impact:
          f.impact ||
          (parsed.path === "tenant"
            ? "Via tenant (ingest Libreria)"
            : parsed.path === "platform"
              ? "Via piattaforma (superadmin / Cursor)"
              : f.impact),
        notes:
          f.notes ||
          (parsed.path === "tenant"
            ? "Caricare documento in Libreria / Registro del tenant"
            : f.notes),
      }));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!gapDeepLink?.highlight) return;
    const t = window.setTimeout(() => {
      document
        .getElementById("nl-backlog-heading")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [gapDeepLink?.highlight, backlogItems.length]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        LIBRARY_REFERENCE_DOC_TYPES.map((doc_type) =>
          apiService.getDocuments({ doc_type, limit: 100, page: 1 })
        )
      );
      const merged = [];
      const seen = new Set();
      for (const res of results) {
        const rows = res?.data || res?.items || [];
        for (const row of rows) {
          if (!row?.id || seen.has(row.id)) continue;
          seen.add(row.id);
          merged.push(row);
        }
      }
      merged.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || ""), "it")
      );
      setDocs(merged);
    } catch (err) {
      setError(err.message || "Errore nel caricamento del catalogo");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadCatalog();
    else setLoading(false);
  }, [isAdmin, loadCatalog]);

  const renderCatalogCell = useCallback((row, col) => {
    const colId = col?.id;
    const deepLink = buildDocumentDeepLink(row.id);
    if (colId === "doc_code") {
      const code = row.doc_code || row.standard_code || "\u2014";
      if (!row.id) return code;
      return (
        <Link to={deepLink} className="nl-link nl-link--code" title="Apri scheda in Documenti">
          {code}
        </Link>
      );
    }
    if (colId === "title") {
      const title = row.title || "\u2014";
      if (!row.id) return title;
      return (
        <Link to={deepLink} className="nl-link nl-link--title" title="Apri scheda in Documenti">
          {title}
        </Link>
      );
    }
    if (colId === "doc_type") {
      return libraryDocTypeLabel(row.doc_type);
    }
    if (colId === "meta") {
      if (row.doc_type === "norma") {
        return <ValidityBadge status={resolveValidityStatus(row)} />;
      }
      const pub = resolvePublicationDate(row);
      return pub ? formatDate(pub) : <span className="nl-muted">{"\u2014"}</span>;
    }
    if (colId === "quality") {
      const q = resolveTextQuality(row);
      if (!q) return <span className="nl-muted">{"\u2014"}</span>;
      return <StatusBadge type="norm_quality" status={q} size="small" />;
    }
    if (colId === "chunks") {
      return resolveHasChunks(row) ? (
        <span className="nl-chunk nl-chunk--yes">Sì</span>
      ) : (
        <span className="nl-muted">No</span>
      );
    }
    if (colId === "last_check") {
      const d = resolveLastValidityCheck(row);
      return d ? formatDate(d) : <span className="nl-muted">{"\u2014"}</span>;
    }
    if (colId === "actions") {
      return (
        <Link to={deepLink} className="nl-link">
          Apri in Documenti
        </Link>
      );
    }
    return row[colId] ?? "";
  }, []);

  const renderBacklogCell = useCallback((row, col) => {
    const colId = col?.id;
    if (colId === "status") {
      const st = row.status || "";
      return (
        <span className={`nl-backlog-status nl-backlog-status--${st}`}>
          {BACKLOG_STATUS_LABELS[st] || st || "\u2014"}
        </span>
      );
    }
    if (colId === "source") {
      if (row.source === "studio") {
        return <span className="nl-source nl-source--studio">Studio</span>;
      }
      if (row.source === "assistente") {
        return <span className="nl-source nl-source--ai">Assistente</span>;
      }
      return <span className="nl-source nl-source--plat">Piattaforma</span>;
    }
    if (colId === "notes") {
      return <span className="nl-notes">{row.notes || "\u2014"}</span>;
    }
    if (colId === "studio_actions") {
      if (row.source !== "studio") return null;
      return (
        <div className="nl-studio-actions">
          <button
            type="button"
            className="nl-link-btn"
            onClick={async () => {
              const md = formatLibraryRequestMarkdownRow(row);
              try {
                if (navigator?.clipboard?.writeText) {
                  await navigator.clipboard.writeText(md);
                  setCopyFeedback(`Copiata riga Markdown per «${row.code}»`);
                } else {
                  setCopyFeedback(md);
                }
              } catch {
                setCopyFeedback(md);
              }
            }}
          >
            Copia MD
          </button>
          <button
            type="button"
            className="nl-link-btn nl-link-btn--danger"
            onClick={() => {
              const next = removeLibraryRequest(orgId, row.id);
              setStudioRequests(next);
            }}
          >
            Rimuovi
          </button>
        </div>
      );
    }
    return row[colId] ?? "\u2014";
  }, [orgId]);

  const handleAcknowledge = useCallback(
    async (row) => {
      if (!row?.id) return;
      setAckBusyId(row.id);
      setPlatformQueueError(null);
      try {
        await apiService.acknowledgeLibrarySourceRequest(row.id);
        await loadPlatformQueue();
        setCopyFeedback(
          `Presa in carico «${row.source_code || row.id}» (in corso). Digitalizzazione: Cursor (LG-5).`
        );
      } catch (err) {
        setPlatformQueueError(
          err?.message || "Presa in carico non riuscita"
        );
      } finally {
        setAckBusyId(null);
      }
    },
    [loadPlatformQueue]
  );

  const renderPlatformQueueCell = useCallback(
    (row, col) => {
      const colId = col?.id;
      if (colId === "source_code") {
        return row.source_code || row.source_title || "\u2014";
      }
      if (colId === "org") {
        return (
          row.requesting_organization_name ||
          (row.requesting_organization_id
            ? `Org ${row.requesting_organization_id}`
            : "\u2014")
        );
      }
      if (colId === "status") {
        const st = row.status || "";
        return (
          <span className={`nl-backlog-status nl-backlog-status--${st}`}>
            {BACKLOG_STATUS_LABELS[st] || st || "\u2014"}
          </span>
        );
      }
      if (colId === "reason") {
        const notes = [row.reason, row.quality_notes]
          .filter(Boolean)
          .join(" — ");
        return <span className="nl-notes">{notes || "\u2014"}</span>;
      }
      if (colId === "created_at") {
        return row.created_at ? formatDate(row.created_at) : "\u2014";
      }
      if (colId === "queue_actions") {
        const href = buildLibraryGapPath({
          code: row.source_code,
          closurePath: "platform",
          prefill: false,
        });
        return (
          <div className="nl-studio-actions">
            <Link to={href} className="nl-link" title="Evidenzia in Libreria">
              Apri in Libreria
            </Link>
            {row.status === "open" ? (
              <button
                type="button"
                className="nl-link-btn"
                disabled={ackBusyId === row.id}
                onClick={() => handleAcknowledge(row)}
              >
                {ackBusyId === row.id ? "…" : "Segna in corso"}
              </button>
            ) : null}
          </div>
        );
      }
      return row[colId] ?? "\u2014";
    },
    [ackBusyId, handleAcknowledge]
  );

  const handleAddRequest = useCallback(
    async (e) => {
      e.preventDefault();
      setRequestError(null);
      setCopyFeedback(null);
      try {
        // Persistenza server (LG-1) + mirror locale LN-5
        await apiService.createLibrarySourceRequest({
          code: requestForm.code,
          title: requestForm.code,
          reason: requestForm.impact
            ? `Impatto: ${requestForm.impact}`
            : undefined,
          qualityNotes: requestForm.notes || undefined,
          closurePath: "platform",
        });
        addLibraryRequest(orgId, requestForm);
        setStudioRequests(loadLibraryRequests(orgId));
        await loadServerRequests();
        setRequestForm(EMPTY_REQUEST_FORM);
        setCopyFeedback("Richiesta salvata (server). Superadmin notificati se via piattaforma.");
      } catch (err) {
        setRequestError(err.message || "Impossibile salvare la richiesta");
      }
    },
    [orgId, requestForm, loadServerRequests]
  );

  const highlightCode = gapDeepLink?.highlight || null;
  const backlogRowClassName = useCallback(
    (row) =>
      highlightCode && libraryGapCodesMatch(row?.code, highlightCode)
        ? "nl-row-highlight"
        : "",
    [highlightCode]
  );
  const documentsCatalogHref = buildDocumentRegistryPath({ tab: "catalog" });

  if (!isAdmin) {
    return (
      <div className="nl-access-denied">
        <h3>Accesso riservato</h3>
        <p>La Libreria è accessibile solo agli amministratori dello studio.</p>
      </div>
    );
  }

  return (
    <div className="nl-page">
      <header className="nl-header">
        <div>
          <h2>Libreria</h2>
          <p>
            Fonti di riferimento per affidabilità agenti/AI (norme, manuali, altri
            riferimenti) — distinta da Documenti operativi e da Knowledge Health (KPI chunk).
          </p>
        </div>
        <div className="nl-header-actions">
          <NormUploadButton
            onUploadComplete={() => {
              loadCatalog();
              loadServerRequests();
            }}
          />
          <Link to={documentsCatalogHref} className="btn-secondary nl-header-cta">
            Apri Documenti
          </Link>
        </div>
      </header>

      {highlightCode ? (
        <div className="nl-deeplink-banner" role="status">
          {gapDeepLink.path === "tenant" ? (
            <>
              Arrivi dall&apos;Assistente: colma{" "}
              <strong>{highlightCode}</strong> caricando il documento in Libreria
              (via tenant / ingest). Form precompilato sotto se richiesto.
            </>
          ) : gapDeepLink.path === "platform" ? (
            <>
              Arrivi dall&apos;Assistente: richiesta piattaforma per{" "}
              <strong>{highlightCode}</strong> — vedi riga evidenziata nelle
              richieste mancanti (superadmin / Cursor, niente pdf-to-json automatico).
            </>
          ) : (
            <>
              Arrivi dall&apos;Assistente: evidenziata la richiesta{" "}
              <strong>{highlightCode}</strong>.
            </>
          )}
        </div>
      ) : null}

      {isSuperadmin ? (
        <section className="nl-section" aria-labelledby="nl-platform-queue-heading">
          <div className="nl-section-head">
            <h3 id="nl-platform-queue-heading">
              Coda gap piattaforma{" "}
              <span className="nl-sa-badge">superadmin</span>
            </h3>
            <p>
              Richieste via 2 (know-how piattaforma) aperte o in corso, da tutti gli
              studi. Sola lettura e presa in carico leggera — digitalizzazione in
              Cursor (niente pdf-to-json automatico; chiusura LG-5).
            </p>
          </div>
          {platformQueueError ? (
            <div className="nl-error" role="alert">
              <p>{platformQueueError}</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={loadPlatformQueue}
              >
                Riprova
              </button>
            </div>
          ) : null}
          <SgqDataGrid
            rows={platformQueue}
            columns={PLATFORM_QUEUE_COLUMNS}
            loading={platformQueueLoading}
            emptyMessage="Nessun gap piattaforma aperto."
            theme="plain"
            renderCell={renderPlatformQueueCell}
            getRowKey={(row) => row.id}
            className="nl-grid"
            initialSortCol="created_at"
            initialSortDir="desc"
          />
        </section>
      ) : null}

      <section className="nl-section" aria-labelledby="nl-catalog-heading">
        <div className="nl-section-head">
          <h3 id="nl-catalog-heading">1. Catalogo ingerito</h3>
          <p>
            Dati dal Registro Documenti (tipi già tipizzati). Norme: stato di vigore.
            Non-norma: data di pubblicazione (<code>issue_date</code>) se presente.
            Libri e quaderni: tipizzare in Documenti come <strong>Manuale</strong> o{" "}
            <strong>Altro</strong> (niente enum <code>libro</code>/<code>quaderno</code> finché
            non c&apos;è gate ADR-011). Qualità testo / chunk RAG / ultimo check vigore: sola
            lettura per affidabilità agenti (distinto da Knowledge Health KPI aggregati).
          </p>
        </div>
        {error && (
          <div className="nl-error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn-secondary" onClick={loadCatalog}>
              Riprova
            </button>
          </div>
        )}
        <SgqDataGrid
          rows={docs}
          columns={CATALOG_COLUMNS}
          loading={loading}
          emptyMessage="Nessuna fonte di riferimento nel Registro per i tipi norma / manuale / altro. Caricale da Documenti."
          theme="plain"
          renderCell={renderCatalogCell}
          getRowKey={(row) => row.id}
          className="nl-grid"
        />
      </section>

      <section className="nl-section" aria-labelledby="nl-backlog-heading">
        <div className="nl-section-head">
          <h3 id="nl-backlog-heading">2. Richieste mancanti</h3>
          <p>
            Lacune da colmare per aumentare l&apos;affidabilità delle risposte e
            non inventare soglie/clausole. Include richieste dall&apos;assistente AI
            (server) e snapshot piattaforma. Il campo note deve spiegare{" "}
            <strong>perché serve</strong> e eventuali{" "}
            <strong>dubbi di qualità</strong> (secondo passaggio, OCR incerto, tabella
            mancante) — non gergo interno di sviluppo. I PDF per la via piattaforma
            restano HITL del superadmin in Cursor (niente pdf-to-json automatico).
          </p>
        </div>

        <form className="nl-request-form" onSubmit={handleAddRequest}>
          <div className="nl-request-form__row">
            <label>
              Codice / titolo
              <input
                type="text"
                value={requestForm.code}
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, code: e.target.value }))
                }
                required
                placeholder="es. ISO 17660-1"
              />
            </label>
            <label>
              Impatto modulo
              <input
                type="text"
                value={requestForm.impact}
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, impact: e.target.value }))
                }
                placeholder="es. WPQR / MC"
              />
            </label>
            <label>
              Priorità
              <select
                value={requestForm.priority}
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, priority: e.target.value }))
                }
              >
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
              </select>
            </label>
            <label>
              Stato
              <select
                value={requestForm.status}
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="da_richiedere">Da richiedere</option>
                <option value="pdf_ricevuto">PDF ricevuto</option>
                <option value="parcheggio">Parcheggio</option>
                <option value="digitalizzata">Digitalizzata</option>
              </select>
            </label>
          </div>
          <label className="nl-request-form__notes">
            Note (perché serve / dubbi qualità)
            <input
              type="text"
              value={requestForm.notes}
              onChange={(e) =>
                setRequestForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Es. Serve per range piega; OCR tab. 2 da verificare"
            />
          </label>
          {requestError && (
            <p className="nl-request-form__error" role="alert">
              {requestError}
            </p>
          )}
          {copyFeedback && (
            <p className="nl-request-form__ok" role="status">
              {copyFeedback}
            </p>
          )}
          <button type="submit" className="btn-primary">
            Aggiungi richiesta studio
          </button>
        </form>

        <SgqDataGrid
          rows={backlogItems}
          columns={BACKLOG_COLUMNS}
          loading={false}
          emptyMessage="Nessuna richiesta nel backlog."
          theme="plain"
          renderCell={renderBacklogCell}
          getRowKey={(row, idx) => row.id || row.code || String(idx)}
          className="nl-grid"
          initialSortCol="priority"
          initialSortDir="asc"
          rowClassName={backlogRowClassName}
        />
      </section>
    </div>
  );
}

export default NormLibraryPage;

/** Helper esposti per test L1 */
export {
  resolveValidityStatus,
  resolvePublicationDate,
  resolveTextQuality,
  resolveHasChunks,
  resolveLastValidityCheck,
  libraryDocTypeLabel,
  mapServerRequestToBacklogRow,
  VALIDITY_LABELS,
};
