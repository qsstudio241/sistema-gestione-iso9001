/**
 * DocumentRegistry — Registro universale documenti SGQ
 * Sprint 1: UX redesign con approccio Apple
 *
 * Tab "Priorità" (default): mostra solo ciò che richiede azione immediata
 * Tab "Catalogo": griglia completa con filtri e export CSV
 * Inline confirmation: niente window.confirm
 * Wizard form: 2 passi per nuovi documenti
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import DocumentForm from "./DocumentForm";
import DocFileDialog from "./DocFileDialog";
import "./DocumentRegistry.css";

// ─── Costanti ────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: "", label: "Tutti i tipi" },
  { value: "procedura",        label: "Procedura" },
  { value: "istruzione",       label: "Istruzione operativa" },
  { value: "modulo",           label: "Modulo / Registrazione" },
  { value: "manuale",          label: "Manuale" },
  { value: "qualifica",        label: "Qualifica personale" },
  { value: "wps",              label: "WPS (Procedura saldatura)" },
  { value: "wpqr",             label: "WPQR (Qualifica procedura)" },
  { value: "dichiarazione_ce", label: "Dichiarazione CE" },
  { value: "taratura",         label: "Certificato taratura" },
  { value: "altro",            label: "Altro" },
];

const DOC_TYPE_LABELS = Object.fromEntries(
  DOC_TYPES.filter((t) => t.value).map((t) => [t.value, t.label])
);

const DOC_STATUS_LABELS = {
  vigente:          "Vigente",
  in_revisione:     "In revisione",
  in_approvazione:  "In approvazione",
  obsoleto:         "Obsoleto",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "—";
  // Estrae YYYY-MM-DD evitando problemi di timezone/parsing ISO
  const s = typeof dateStr === "string" ? dateStr : String(dateStr);
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return `${d}/${m}/${y}`;
  }
  // Fallback per formati non standard
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

function getExpiryClass(doc) {
  if (doc.status === "obsoleto") return "expiry-obsoleto";
  if (doc.is_expired)     return "expiry-scaduto";
  if (doc.expiring_soon)  return "expiry-warning";
  return "";
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportToCSV(documents) {
  const headers = ["Codice", "Titolo", "Tipo", "Revisione", "Stato", "Emissione", "Scadenza", "Responsabile", "Azienda", "Norma", "Paragrafo", "Note"];
  const rows = documents.map((d) => [
    d.doc_code || "",
    d.title,
    DOC_TYPE_LABELS[d.doc_type] || d.doc_type,
    d.revision || "",
    DOC_STATUS_LABELS[d.status] || d.status,
    formatDate(d.issue_date),
    formatDate(d.expiry_date),
    d.responsible || "",
    d.company_name || "",
    d.standard_code || "",
    d.clause_ref || "",
    d.notes || "",
  ]);

  const csvContent = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const BOM = "\uFEFF"; // BOM UTF-8 per Excel italiano
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `documenti_sgq_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Scheda documento (tab Priorità) ─────────────────────────────────────────

function PriorityCard({ doc, onEdit, onArchive, archiveId, onConfirmArchive, onCancelArchive }) {
  const days = daysUntil(doc.expiry_date);
  const isConfirming = archiveId === doc.id;

  return (
    <div className={`priority-card priority-card-${doc.is_expired ? "red" : "orange"}`}>
      <div className="pcard-left">
        <span className={`pcard-dot dot-${doc.is_expired ? "red" : "orange"}`} />
        <div className="pcard-info">
          <span className="pcard-title">{doc.title}</span>
          <span className="pcard-meta">
            {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
            {doc.doc_code && ` · ${doc.doc_code}`}
            {doc.company_name && ` · ${doc.company_name}`}
          </span>
          <span className={`pcard-expiry ${doc.is_expired ? "text-red" : "text-orange"}`}>
            {doc.is_expired
              ? `Scaduto il ${formatDate(doc.expiry_date)}`
              : `Scade tra ${days} giorn${days === 1 ? "o" : "i"} — ${formatDate(doc.expiry_date)}`}
          </span>
        </div>
      </div>

      <div className="pcard-actions">
        {isConfirming ? (
          <div className="inline-confirm">
            <span className="inline-confirm-text">Archiviare come obsoleto?</span>
            <button className="btn-confirm-yes" onClick={() => onConfirmArchive(doc.id)}>Sì</button>
            <button className="btn-confirm-no" onClick={onCancelArchive}>No</button>
          </div>
        ) : (
          <>
            <button className="btn-icon-sm" title="Modifica" onClick={() => onEdit(doc)}>✏️ Modifica</button>
            {doc.status !== "obsoleto" && (
              <button className="btn-icon-sm btn-icon-sm-muted" title="Archivia" onClick={() => onArchive(doc.id)}>
                🗄️ Archivia
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Tab Priorità ─────────────────────────────────────────────────────────────

function PriorityView({ stats, expiredDocs, expiringDocs, revisionDocs, loading, onEdit, onArchive, archiveId, onConfirmArchive, onCancelArchive, onNewDoc }) {
  const total = expiredDocs.length + expiringDocs.length + revisionDocs.length;

  if (loading) {
    return (
      <div className="docregistry-loading">
        <div className="loading-spinner-sm" />
        <span>Caricamento...</span>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="priority-all-ok">
        <span className="ok-icon">✅</span>
        <h3>Tutto in ordine</h3>
        <p>Nessun documento scaduto o in scadenza entro 60 giorni.</p>
        <button className="btn-primary" onClick={onNewDoc}>+ Aggiungi documento</button>
      </div>
    );
  }

  return (
    <div className="priority-view">
      {/* Scaduti */}
      {expiredDocs.length > 0 && (
        <section className="priority-section">
          <div className="priority-section-header priority-section-red">
            <span>⚠️ Scaduti — {expiredDocs.length}</span>
            <span className="ps-hint">Da rinnovare o archiviare</span>
          </div>
          {expiredDocs.map((doc) => (
            <PriorityCard
              key={doc.id}
              doc={doc}
              onEdit={onEdit}
              onArchive={onArchive}
              archiveId={archiveId}
              onConfirmArchive={onConfirmArchive}
              onCancelArchive={onCancelArchive}
            />
          ))}
        </section>
      )}

      {/* In scadenza */}
      {expiringDocs.length > 0 && (
        <section className="priority-section">
          <div className="priority-section-header priority-section-orange">
            <span>🟡 In scadenza nei prossimi 60 giorni — {expiringDocs.length}</span>
            <span className="ps-hint">Pianifica il rinnovo</span>
          </div>
          {expiringDocs.map((doc) => (
            <PriorityCard
              key={doc.id}
              doc={doc}
              onEdit={onEdit}
              onArchive={onArchive}
              archiveId={archiveId}
              onConfirmArchive={onConfirmArchive}
              onCancelArchive={onCancelArchive}
            />
          ))}
        </section>
      )}

      {/* In revisione */}
      {revisionDocs.length > 0 && (
        <section className="priority-section">
          <div className="priority-section-header priority-section-blue">
            <span>🔵 In revisione — {revisionDocs.length}</span>
            <span className="ps-hint">In attesa di approvazione</span>
          </div>
          {revisionDocs.map((doc) => (
            <PriorityCard
              key={doc.id}
              doc={doc}
              onEdit={onEdit}
              onArchive={onArchive}
              archiveId={archiveId}
              onConfirmArchive={onConfirmArchive}
              onCancelArchive={onCancelArchive}
            />
          ))}
        </section>
      )}
    </div>
  );
}

// ─── Tab Catalogo ─────────────────────────────────────────────────────────────

function CatalogView({
  documents, total, totalPages, page, setPage,
  loading, error, onEdit, onArchive, archiveId, onConfirmArchive, onCancelArchive,
  onNewDoc, onReload,
  filters, setFilter, onExport,
  companies, onFileDialog,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="catalog-view">
      {/* Toolbar */}
      <div className="catalog-toolbar">
        <div className="catalog-search-wrap">
          <input
            className="catalog-search"
            type="text"
            placeholder="🔍 Cerca titolo o codice..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </div>
        <button
          className={`btn-filter-toggle${filtersOpen ? " active" : ""}`}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          ⚙️ Filtri {filtersOpen ? "▲" : "▼"}
        </button>
        <button className="btn-export" onClick={onExport} title="Esporta lista in CSV (apribile con Excel)">
          ⬇️ Esporta CSV
        </button>
        <button className="btn-primary" onClick={onNewDoc}>+ Nuovo</button>
      </div>

      {/* Pannello filtri (collassabile) */}
      {filtersOpen && (
        <div className="catalog-filters">
          <select value={filters.doc_type} onChange={(e) => setFilter("doc_type", e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">Tutti gli stati</option>
            <option value="vigente">Vigente</option>
            <option value="in_revisione">In revisione</option>
            <option value="in_approvazione">In approvazione</option>
            <option value="obsoleto">Obsoleto</option>
          </select>
          {companies.length > 0 && (
            <select value={filters.company_id} onChange={(e) => setFilter("company_id", e.target.value)}>
              <option value="">Tutte le aziende</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <label className="filter-check">
            <input
              type="checkbox"
              checked={filters.expiring_days === 30}
              onChange={(e) => setFilter("expiring_days", e.target.checked ? 30 : null)}
            />
            Solo in scadenza (30gg)
          </label>
          <button
            className="btn-reset"
            onClick={() => { setFilter("doc_type", ""); setFilter("status", "vigente"); setFilter("company_id", ""); setFilter("search", ""); setFilter("expiring_days", null); }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Errore */}
      {error && (
        <div className="docregistry-error">
          ⚠️ {error}
          <button onClick={onReload}>Riprova</button>
        </div>
      )}

      {/* Conteggio */}
      {!loading && !error && (
        <div className="catalog-count">{total} documento{total !== 1 ? "i" : ""}</div>
      )}

      {/* Tabella */}
      {loading ? (
        <div className="docregistry-loading">
          <div className="loading-spinner-sm" />
          <span>Caricamento...</span>
        </div>
      ) : documents.length === 0 ? (
        <div className="docregistry-empty">
          <p>Nessun documento trovato.</p>
          <button className="btn-primary" onClick={onNewDoc}>+ Aggiungi documento</button>
        </div>
      ) : (
        <>
          <div className="docregistry-table-wrap">
            <table className="docregistry-table">
              <thead>
                <tr>
                  <th>Codice</th>
                  <th>Titolo</th>
                  <th>Tipo</th>
                  <th>Rev.</th>
                  <th>Stato</th>
                  <th>Scadenza</th>
                  <th>Azienda</th>
                  <th>Responsabile</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const isConfirming = archiveId === doc.id;
                  return (
                    <tr key={doc.id} className={getExpiryClass(doc)}>
                      <td className="col-code">{doc.doc_code || "—"}</td>
                      <td className="col-title">
                        <span className="doc-title">{doc.title}</span>
                        {doc.clause_ref && (
                          <span className="doc-clause">{doc.standard_code} §{doc.clause_ref}</span>
                        )}
                      </td>
                      <td className="col-type">
                        <span className="doc-type-badge">
                          {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
                        </span>
                      </td>
                      <td className="col-rev">{doc.revision || "—"}</td>
                      <td className="col-status">
                        <span className={`status-badge status-${doc.status}`}>
                          {DOC_STATUS_LABELS[doc.status] || doc.status}
                        </span>
                      </td>
                      <td className={`col-expiry ${getExpiryClass(doc)}`}>
                        {doc.expiry_date ? (
                          <span>
                            {doc.is_expired   && "⚠️ "}
                            {doc.expiring_soon && !doc.is_expired && "🟡 "}
                            {formatDate(doc.expiry_date)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="col-company">{doc.company_name || "—"}</td>
                      <td className="col-responsible">{doc.responsible || "—"}</td>
                      <td className="col-actions" style={isConfirming ? { minWidth: 220 } : {}}>
                        {isConfirming ? (
                          <div className="inline-confirm">
                            <span className="inline-confirm-text">Archiviare?</span>
                            <button className="btn-confirm-yes" onClick={() => onConfirmArchive(doc.id)}>Sì</button>
                            <button className="btn-confirm-no" onClick={onCancelArchive}>No</button>
                          </div>
                        ) : (
                          <>
                            <button className="btn-icon" title="File allegato" onClick={() => onFileDialog(doc)}>📎</button>
                            <button className="btn-icon" title="Modifica" onClick={() => onEdit(doc)}>✏️</button>
                            {doc.status !== "obsoleto" && (
                              <button className="btn-icon" title="Archivia" onClick={() => onArchive(doc.id)}>🗄️</button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="docregistry-pagination">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prec.</button>
              <span>Pagina {page} di {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Succ. →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

function DocumentRegistry() {
  // Tab attiva
  const [activeTab, setActiveTab] = useState("priority"); // "priority" | "catalog"

  // Dati
  const [stats, setStats]         = useState(null);
  const [companies, setCompanies] = useState([]);
  const [standards, setStandards] = useState([]);

  // Documenti priorità (scaduti + in scadenza 60gg + in revisione)
  const [priorityDocs, setPriorityDocs] = useState([]);
  const [loadingPriority, setLoadingPriority] = useState(true);

  // Catalogo
  const [catalogDocs, setCatalogDocs]   = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogPages, setCatalogPages] = useState(1);
  const [catalogPage, setCatalogPage]   = useState(1);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState(null);

  // Filtri catalogo
  const [filters, setFiltersState] = useState({
    search: "", doc_type: "", status: "vigente", company_id: "", expiring_days: null,
  });
  const setFilter = useCallback((key, val) => {
    setFiltersState((f) => ({ ...f, [key]: val }));
    setCatalogPage(1);
  }, []);

  // Modale
  const [modalOpen, setModalOpen]   = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);

  // Inline confirm archiving
  const [archiveId, setArchiveId] = useState(null);
  const [archiveError, setArchiveError] = useState(null);

  // Dialog file allegato
  const [fileDialogDoc, setFileDialogDoc] = useState(null);

  const LIMIT = 20;

  // ─── Caricamento dati ────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const res = await apiService.getDocumentStats();
      setStats(res.data);
    } catch { /* non bloccante */ }
  }, []);

  const loadPriorityDocs = useCallback(async () => {
    setLoadingPriority(true);
    try {
      // Scaduti + in scadenza 60gg
      const [expRes, revRes] = await Promise.all([
        apiService.getDocuments({ expiring_days: 60, status: "vigente", limit: 50 }),
        apiService.getDocuments({ status: "in_revisione", limit: 20 }),
      ]);
      setPriorityDocs([
        ...(expRes.data || []),
        ...(revRes.data || []),
      ]);
    } catch { /* non bloccante */ }
    finally { setLoadingPriority(false); }
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const params = {
        page: catalogPage, limit: LIMIT,
        ...(filters.search       && { search:       filters.search }),
        ...(filters.doc_type     && { doc_type:     filters.doc_type }),
        ...(filters.status       && { status:       filters.status }),
        ...(filters.company_id   && { company_id:   filters.company_id }),
        ...(filters.expiring_days && { expiring_days: filters.expiring_days }),
      };
      const res = await apiService.getDocuments(params);
      setCatalogDocs(res.data || []);
      setCatalogTotal(res.pagination?.total || 0);
      setCatalogPages(res.pagination?.totalPages || 1);
    } catch (err) {
      setCatalogError(err.message || "Errore caricamento");
    } finally {
      setLoadingCatalog(false);
    }
  }, [catalogPage, filters]);

  const loadAuxiliary = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        apiService.getCompanies(),
        apiService.getStandards(),
      ]);
      setCompanies(cRes.data || []);
      setStandards(sRes.data || sRes || []);
    } catch { /* non bloccante */ }
  }, []);

  useEffect(() => {
    loadAuxiliary();
    loadStats();
    loadPriorityDocs();
  }, [loadAuxiliary, loadStats, loadPriorityDocs]);

  useEffect(() => {
    if (activeTab === "catalog") loadCatalog();
  }, [activeTab, loadCatalog]);

  // ─── Azioni ────────────────────────────────────────────────────────────

  const handleNew  = () => { setEditingDoc(null);  setModalOpen(true); };
  const handleEdit = (doc) => { setEditingDoc(doc); setModalOpen(true); };

  const handleArchive        = (id)  => { setArchiveId(id); setArchiveError(null); };
  const handleCancelArchive  = ()    => setArchiveId(null);
  const handleConfirmArchive = async (id) => {
    try {
      await apiService.archiveDocument(id);
      setArchiveId(null);
      await Promise.all([loadStats(), loadPriorityDocs()]);
      if (activeTab === "catalog") await loadCatalog();
    } catch (err) {
      setArchiveError(err.message || "Errore archiviazione");
      setArchiveId(null);
    }
  };

  const handleSaved = async () => {
    setModalOpen(false);
    setEditingDoc(null);
    await Promise.all([loadStats(), loadPriorityDocs()]);
    if (activeTab === "catalog") await loadCatalog();
  };

  const handleExport = async () => {
    try {
      // Esporta fino a 500 righe con i filtri attivi
      const params = {
        page: 1, limit: 500,
        ...(filters.search       && { search:       filters.search }),
        ...(filters.doc_type     && { doc_type:     filters.doc_type }),
        ...(filters.status       && { status:       filters.status }),
        ...(filters.company_id   && { company_id:   filters.company_id }),
        ...(filters.expiring_days && { expiring_days: filters.expiring_days }),
      };
      const res = await apiService.getDocuments(params);
      exportToCSV(res.data || []);
    } catch (err) {
      alert("Errore export: " + err.message);
    }
  };

  // Suddividi documenti priorità in categorie
  const expiredDocs  = priorityDocs.filter((d) => d.is_expired);
  const expiringDocs = priorityDocs.filter((d) => d.expiring_soon && !d.is_expired);
  const revisionDocs = priorityDocs.filter((d) => d.status === "in_revisione");
  const priorityCount = expiredDocs.length + expiringDocs.length + revisionDocs.length;

  return (
    <div className="docregistry-page">
      {/* Header */}
      <div className="docregistry-header">
        <div className="docregistry-title-wrap">
          <h2 className="docregistry-title">Registro Documenti</h2>
          {stats && (
            <span className="docregistry-subtitle">
              {stats.total} documenti · {stats.vigenti} vigenti
            </span>
          )}
        </div>
        <button className="btn-primary" onClick={handleNew}>+ Nuovo documento</button>
      </div>

      {/* Errore archiviazione */}
      {archiveError && (
        <div className="docregistry-error" style={{ marginBottom: 12 }}>
          ⚠️ {archiveError}
          <button onClick={() => setArchiveError(null)}>✕</button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="docregistry-tabs">
        <button
          className={`doc-tab${activeTab === "priority" ? " doc-tab-active" : ""}`}
          onClick={() => setActiveTab("priority")}
        >
          ⚠️ Priorità
          {priorityCount > 0 && (
            <span className="tab-badge">{priorityCount}</span>
          )}
        </button>
        <button
          className={`doc-tab${activeTab === "catalog" ? " doc-tab-active" : ""}`}
          onClick={() => setActiveTab("catalog")}
        >
          📋 Catalogo
          {stats && <span className="tab-count">{stats.total}</span>}
        </button>
      </div>

      {/* Contenuto tab */}
      {activeTab === "priority" ? (
        <PriorityView
          stats={stats}
          expiredDocs={expiredDocs}
          expiringDocs={expiringDocs}
          revisionDocs={revisionDocs}
          loading={loadingPriority}
          onEdit={handleEdit}
          onArchive={handleArchive}
          archiveId={archiveId}
          onConfirmArchive={handleConfirmArchive}
          onCancelArchive={handleCancelArchive}
          onNewDoc={handleNew}
        />
      ) : (
        <CatalogView
          documents={catalogDocs}
          total={catalogTotal}
          totalPages={catalogPages}
          page={catalogPage}
          setPage={setCatalogPage}
          loading={loadingCatalog}
          error={catalogError}
          onEdit={handleEdit}
          onArchive={handleArchive}
          archiveId={archiveId}
          onConfirmArchive={handleConfirmArchive}
          onCancelArchive={handleCancelArchive}
          onNewDoc={handleNew}
          onReload={loadCatalog}
          filters={filters}
          setFilter={setFilter}
          onExport={handleExport}
          companies={companies}
          onFileDialog={setFileDialogDoc}
        />
      )}

      {/* Modale wizard */}
      {modalOpen && (
        <DocumentForm
          doc={editingDoc}
          companies={companies}
          standards={standards}
          onSave={handleSaved}
          onClose={() => { setModalOpen(false); setEditingDoc(null); }}
        />
      )}

      {/* Dialog file allegato */}
      {fileDialogDoc && (
        <DocFileDialog
          doc={fileDialogDoc}
          onClose={() => setFileDialogDoc(null)}
        />
      )}
    </div>
  );
}

export default DocumentRegistry;
