/**
 * NormLibraryPage — Gestione → Libreria (LN-1 + LN-2)
 * Due sezioni: catalogo fonti ingerite + richieste mancanti (backlog).
 * LN-2: deep-link riga → Documenti + CTA NormUpload (riuso).
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
import backlogSnapshot from "../data/normeMancantiBacklog.json";
import "./NormLibraryPage.css";

/** Tipi già tipizzati usati come fonti di riferimento (LN-1 — niente libro/quaderno nuovi). */
export const LIBRARY_REFERENCE_DOC_TYPES = ["norma", "manuale", "altro"];

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
};

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
  { id: "doc_code", label: "Codice", width: "120px", sortable: true },
  { id: "title", label: "Titolo", width: "1fr", sortable: true },
  { id: "doc_type", label: "Tipo", width: "120px", sortable: true },
  { id: "meta", label: "Vigore / data pubbl.", width: "150px", sortable: false },
  { id: "actions", label: "", width: "130px", sortable: false },
];

const BACKLOG_COLUMNS = [
  { id: "code", label: "Codice / titolo", width: "1.4fr", sortable: true },
  { id: "impact", label: "Impatto", width: "1fr", sortable: true },
  { id: "status", label: "Stato", width: "120px", sortable: true },
  { id: "priority", label: "Priorità", width: "80px", sortable: true },
  { id: "notes", label: "Note", width: "1.2fr", sortable: false },
];

export function NormLibraryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const backlogItems = useMemo(
    () => (Array.isArray(backlogSnapshot?.items) ? backlogSnapshot.items : []),
    []
  );

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
      return DOC_TYPE_LABELS[row.doc_type] || row.doc_type || "\u2014";
    }
    if (colId === "meta") {
      if (row.doc_type === "norma") {
        return <ValidityBadge status={resolveValidityStatus(row)} />;
      }
      const pub = resolvePublicationDate(row);
      return pub ? formatDate(pub) : <span className="nl-muted">{"\u2014"}</span>;
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
    if (colId === "notes") {
      return <span className="nl-notes">{row.notes || "\u2014"}</span>;
    }
    return row[colId] ?? "\u2014";
  }, []);

  if (!isAdmin) {
    return (
      <div className="nl-access-denied">
        <h3>Accesso riservato</h3>
        <p>La Libreria è accessibile solo agli amministratori dello studio.</p>
      </div>
    );
  }

  const documentsCatalogHref = buildDocumentRegistryPath({ tab: "catalog" });

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
          <NormUploadButton onUploadComplete={loadCatalog} />
          <Link to={documentsCatalogHref} className="btn-secondary nl-header-cta">
            Apri Documenti
          </Link>
        </div>
      </header>

      <section className="nl-section" aria-labelledby="nl-catalog-heading">
        <div className="nl-section-head">
          <h3 id="nl-catalog-heading">1. Catalogo ingerito</h3>
          <p>
            Dati dal Registro Documenti (tipi già tipizzati). Norme: stato di vigore.
            Non-norma: data di pubblicazione (<code>issue_date</code>) se presente.
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
            non inventare soglie/clausole. Sola lettura dal backlog piattaforma;
            i PDF restano una richiesta HITL al committente.
          </p>
        </div>
        <SgqDataGrid
          rows={backlogItems}
          columns={BACKLOG_COLUMNS}
          loading={false}
          emptyMessage="Nessuna richiesta nel backlog."
          theme="plain"
          renderCell={renderBacklogCell}
          getRowKey={(row, idx) => row.code || String(idx)}
          className="nl-grid"
          initialSortCol="priority"
          initialSortDir="asc"
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
  VALIDITY_LABELS,
};
