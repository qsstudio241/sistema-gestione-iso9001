/**
 * MaterialCertificatesPage — MC-5 UI certificati EN 10204 (base e apporto).
 * Copia schermata 2 (Qualifiche): card KPI + SgqDataGrid. Dettaglio in pagina.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import apiService from "../services/apiService";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { useRouter, useNavigate } from "../contexts/RouterContext";
import SgqDataGrid from "../components/SgqDataGrid";
import StatusBadge from "../components/StatusBadge";
import AiDisclaimer from "../components/AiDisclaimer";
import { formatDate } from "../utils/dateHelpers";
import { resolveBackendUploadUrl } from "../utils/resolveBackendUploadUrl";
import {
  OUTCOME_LABELS,
  ROLE_LABELS,
  countByOutcome,
  countByRole,
  filterCertificates,
  outcomeRowClass,
  canHitl,
  hitlTitle,
} from "../utils/materialCertificateFilters";
import "./QualificationsPage.css";
import "./MaterialCertificatesPage.css";

const COLUMNS = [
  { id: "ddt_no", label: "N. DDT", sortable: true },
  { id: "ddt_date", label: "Data DDT", sortable: true },
  { id: "certificate_no", label: "N. certificato", sortable: true },
  { id: "material_role", label: "Ruolo", sortable: true },
  { id: "designation", label: "Materiale", sortable: true },
  { id: "heat_or_lot_no", label: "Colata / lotto", sortable: true },
  { id: "product_form", label: "Forma", sortable: true },
  { id: "dimensions", label: "Dimensioni", sortable: true },
  { id: "material_standard", label: "Norma", sortable: true },
  { id: "manufacturer_works", label: "Fornitore / acciaieria", sortable: true },
  { id: "workflow_status", label: "Esito", sortable: true },
];

const PATCH_KEYS = [
  "ddt_no",
  "certificate_no",
  "designation",
  "heat_or_lot_no",
  "product_form",
  "dimensions",
  "material_standard",
  "manufacturer_works",
  "inspection_document_type",
  "ReH",
  "Rm",
  "CEV",
];

function certIdFromPath(path) {
  const m = String(path || "").match(/^\/saldatura\/materiali\/(\d+)/);
  return m ? Number(m[1]) : null;
}

function jsonOf(row) {
  const corrected = row?.corrected_json && typeof row.corrected_json === "object"
    ? row.corrected_json
    : {};
  const extracted = row?.extracted_json && typeof row.extracted_json === "object"
    ? row.extracted_json
    : {};
  return { ...extracted, ...corrected };
}

export default function MaterialCertificatesPage() {
  const { companyId, scopeCompanyName } = useCompanyScope();
  const { path } = useRouter();
  const navigate = useNavigate();
  const selectedId = certIdFromPath(path);
  const fileRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState("");
  const [role, setRole] = useState("");
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState("");
  const [draft, setDraft] = useState({});
  const [uploadRole, setUploadRole] = useState("base");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (companyId) params.company_id = companyId;
      const res = await apiService.getMaterialCertificates(params);
      setRows(res.data || []);
    } catch (err) {
      setError(err.message || "Errore nel caricamento");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getMaterialCertificate(selectedId);
        if (!cancelled) {
          setDetail(res.data);
          setDraft(jsonOf(res.data));
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Certificato non trovato");
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const filtered = useMemo(
    () => filterCertificates(rows, { outcome: outcome || undefined, role: role || undefined }),
    [rows, outcome, role]
  );
  const outcomeCounts = useMemo(() => countByOutcome(rows), [rows]);
  const roleCounts = useMemo(() => countByRole(rows), [rows]);
  const uploadEnabled = Boolean(companyId);
  const status = detail?.workflow_status;

  function toggleOutcome(key) {
    setOutcome((prev) => (prev === key ? "" : key));
  }
  function toggleRole(key) {
    setRole((prev) => (prev === key ? "" : key));
  }

  async function onUpload(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!file || !companyId) return;
    setBusy("upload");
    setError("");
    try {
      const res = await apiService.createMaterialCertificate({
        companyId,
        file,
        materialRole: uploadRole,
      });
      await loadList();
      if (res.data?.id) navigate(`/saldatura/materiali/${res.data.id}`);
    } catch (err) {
      setError(err.message || "Upload non riuscito");
    } finally {
      setBusy("");
    }
  }

  async function runAction(name, fn) {
    if (!detail?.id || detail.id !== selectedId) return;
    setBusy(name);
    setError("");
    try {
      await fn();
      const res = await apiService.getMaterialCertificate(detail.id);
      setDetail(res.data);
      setDraft(jsonOf(res.data));
      await loadList();
    } catch (err) {
      setError(err.message || "Operazione non riuscita");
    } finally {
      setBusy("");
    }
  }

  function onFieldBlur(key) {
    if (!hitlReady || !canHitl("patch", status)) return;
    const current = jsonOf(detail)[key];
    if (String(draft[key] ?? "") === String(current ?? "")) return;
    runAction("patch", () => apiService.patchMaterialCertificate(detail.id, { [key]: draft[key] }));
  }

  const pdfUrl = resolveBackendUploadUrl(detail?.file_url, apiService.baseUrl);
  const hitlReady = Boolean(detail && selectedId && detail.id === selectedId);
  function hitlDisabled(action) {
    return !hitlReady || !canHitl(action, status) || Boolean(busy);
  }

  return (
    <div className="sq-page">
      <header className="sq-header">
        <div>
          <h1 className="sq-title">Materiali</h1>
          <p className="sq-subtitle">
            Certificati EN 10204 (lamiera e filo). Ambito: {scopeCompanyName || "Tutto lo studio"}
          </p>
        </div>
        <div className="sq-header-actions">
          <span className="sq-scope-label" id="mc-upload-role-label">Ruolo</span>
          <div
            className="sq-action-group"
            role="radiogroup"
            aria-labelledby="mc-upload-role-label"
          >
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={uploadRole === key}
                className={`sq-btn-secondary${uploadRole === key ? " sq-stat-active" : ""}`}
                disabled={busy === "upload"}
                onClick={() => setUploadRole(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            ref={fileRef}
            className="mc-hidden"
            type="file"
            accept="application/pdf,.pdf"
            aria-label="File PDF certificato"
            onChange={onUpload}
          />
          <button
            type="button"
            className="sq-btn-new"
            disabled={!uploadEnabled || busy === "upload"}
            title={uploadEnabled ? "Carica un PDF" : "Seleziona un\u2019azienda in Ambito"}
            onClick={() => fileRef.current && fileRef.current.click()}
          >
            Carica certificato
          </button>
        </div>
      </header>

      <div className="sq-stats-bar" role="group" aria-label="Filtri per esito">
        {Object.keys(OUTCOME_LABELS).map((key) => (
          <button
            key={key}
            type="button"
            className={`sq-stat sq-stat-clickable${outcome === key ? " sq-stat-active" : ""}`}
            onClick={() => toggleOutcome(key)}
            aria-pressed={outcome === key}
          >
            <span className="sq-stat-num">{outcomeCounts[key]}</span>
            <span className="sq-stat-lbl">{OUTCOME_LABELS[key]}</span>
          </button>
        ))}
      </div>
      <div className="sq-stats-bar mc-role-bar" role="group" aria-label="Filtri per ruolo">
        {Object.keys(ROLE_LABELS).map((key) => (
          <button
            key={key}
            type="button"
            className={`sq-stat sq-stat-clickable${role === key ? " sq-stat-active" : ""}`}
            onClick={() => toggleRole(key)}
            aria-pressed={role === key}
          >
            <span className="sq-stat-num">{roleCounts[key]}</span>
            <span className="sq-stat-lbl">{ROLE_LABELS[key]}</span>
          </button>
        ))}
      </div>

      {error ? <p className="mc-error" role="alert">{error}</p> : null}

      <SgqDataGrid
        rows={filtered}
        columns={COLUMNS}
        loading={loading}
        emptyMessage="Nessun certificato in questo filtro."
        getRowKey={(row) => row.id}
        rowClassName={(row) => outcomeRowClass(row.workflow_status)}
        onRowClick={(row) => navigate(`/saldatura/materiali/${row.id}`)}
        renderCell={(row, col) => {
          if (col.id === "ddt_date") return formatDate(row.ddt_date) || "\u2014";
          if (col.id === "material_role") return ROLE_LABELS[row.material_role] || row.material_role || "\u2014";
          if (col.id === "workflow_status") {
            return (
              <StatusBadge type="material_certificate" status={row.workflow_status} />
            );
          }
          return row[col.id] || "\u2014";
        }}
      />

      {detail ? (
        <section className="mc-detail" aria-label="Dettaglio certificato">
          <div className="mc-detail-header">
            <h2 className="mc-detail-title">
              {detail.certificate_no || detail.ddt_no || `Certificato ${detail.id}`}
            </h2>
            <button type="button" className="sq-btn-reload" onClick={() => navigate("/saldatura/materiali")}>
              Chiudi
            </button>
          </div>

          <div className="mc-section">
            <h3>1. Identificazione</h3>
            <div className="mc-grid-fields">
              {PATCH_KEYS.map((key) => (
                <div className="mc-field" key={key}>
                  <label htmlFor={`mc-${key}`}>{key}</label>
                  <input
                    id={`mc-${key}`}
                    value={draft[key] ?? detail[key] ?? ""}
                    disabled={hitlDisabled("patch")}
                    title={hitlTitle("patch", status)}
                    onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                    onBlur={() => onFieldBlur(key)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mc-section">
            <h3>2. PDF</h3>
            {pdfUrl ? (
              <iframe className="mc-pdf" title="Anteprima certificato" src={pdfUrl} />
            ) : (
              <p>File non disponibile.</p>
            )}
          </div>

          <div className="mc-section">
            <h3>3. Testo estratto</h3>
            {detail.text_extract_reason ? (
              <p className="sq-subtitle">Motivo testo: {detail.text_extract_reason}</p>
            ) : null}
            <pre className="mc-text">{detail.extracted_text || "Nessun testo."}</pre>
            <AiDisclaimer />
          </div>

          <div className="mc-section">
            <h3>4. Valori laboratorio</h3>
            <p className="sq-subtitle">
              ReH {draft.ReH || jsonOf(detail).ReH || "\u2014"}
              {" \u00b7 "}Rm {draft.Rm || jsonOf(detail).Rm || "\u2014"}
              {" \u00b7 "}CEV {draft.CEV || jsonOf(detail).CEV || "\u2014"}
            </p>
          </div>

          <div className="mc-section">
            <h3>5. Esito Rule Engine</h3>
            <table className="mc-checks">
              <thead>
                <tr>
                  <th>Chiave</th>
                  <th>Livello</th>
                  <th>Richiesto</th>
                  <th>Rilevato</th>
                  <th>Esito</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {(detail.checks || []).length === 0 ? (
                  <tr><td colSpan={6}>Nessun check: esegui Valuta.</td></tr>
                ) : (detail.checks || []).map((c) => (
                  <tr key={`${c.requirement_key}-${c.id || c.source_ref}`}>
                    <td>{c.requirement_key}</td>
                    <td>{c.source_level}</td>
                    <td>{c.required_value || "\u2014"}</td>
                    <td>{c.actual_value || "\u2014"}</td>
                    <td>{c.result}</td>
                    <td>{c.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mc-section">
            <h3>6. Azioni</h3>
            <div className="mc-hitl">
              <button
                type="button"
                className="btn-secondary"
                disabled={hitlDisabled("extract")}
                title={hitlTitle("extract", status)}
                onClick={() => runAction("extract", () => apiService.extractMaterialCertificate(detail.id))}
              >
                Estrai
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={hitlDisabled("evaluate")}
                title={hitlTitle("evaluate", status)}
                onClick={() => runAction("evaluate", () => apiService.evaluateMaterialCertificate(detail.id))}
              >
                Valuta
              </button>
              <button
                type="button"
                className="btn-primary"
                data-testid="mc-approve"
                disabled={hitlDisabled("approve")}
                title={hitlTitle("approve", status) || "Approva conforme (click esplicito)"}
                onClick={() => runAction("approve", () => apiService.approveMaterialCertificate(detail.id))}
              >
                Approva conforme
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={hitlDisabled("reject")}
                title={hitlTitle("reject", status)}
                onClick={() => runAction("reject", () => apiService.rejectMaterialCertificate(detail.id))}
              >
                Conferma non conforme
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={hitlDisabled("archive")}
                title={hitlTitle("archive", status)}
                onClick={() => runAction("archive", () => apiService.archiveMaterialCertificate(detail.id))}
              >
                Archivia
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
