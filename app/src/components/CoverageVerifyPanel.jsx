/**
 * CoverageVerifyPanel — Verifica copertura requisito↔capacità (COV-1).
 * DNA: classi sq-* di QualificationsPage; campi per dominio dal registry API.
 * Date non al centro: focus su dimensioni di validità del requisito.
 */

import React, { useEffect, useMemo, useState } from "react";
import apiService from "../services/apiService";
import "./CoverageVerifyPanel.css";

export const COVERAGE_STATUS_LABEL = {
  match: { label: "Coperto", cls: "sq-cov-ok" },
  partial: { label: "Parziale", cls: "sq-cov-partial" },
  no_match: { label: "Non coperto", cls: "sq-cov-no" },
  not_implemented: { label: "Non implementato", cls: "sq-cov-stub" },
};

/** Campi visibili per il dominio selezionato (esportato per test). */
export function visibleFieldsForDomain(domains, domainKey) {
  const d = (domains || []).find((x) => x.domain === domainKey);
  return d?.requirementFields || [];
}

/** Filtra i domini del registry con una whitelist di chiavi (assente/vuota = tutti). */
export function filterCoverageDomains(domains, allowedDomains) {
  const list = domains || [];
  if (!Array.isArray(allowedDomains) || allowedDomains.length === 0) return list;
  return list.filter((d) => allowedDomains.includes(d.domain));
}

/**
 * @param {object} props
 * @param {string[]} [props.allowedDomains] whitelist chiavi dominio (assente = tutti)
 * @param {string} [props.defaultDomain] dominio iniziale (default welder_9606)
 * @param {boolean} [props.embedded] corpo sempre visibile, senza toggle
 */
export default function CoverageVerifyPanel({
  companyId = null,
  companyName = "",
  allowedDomains,
  defaultDomain = "welder_9606",
  embedded = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const open = embedded || expanded;
  const [domains, setDomains] = useState([]);
  const [domain, setDomain] = useState(defaultDomain);
  const [criteria, setCriteria] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open || domains.length > 0) return undefined;
    let cancelled = false;
    apiService.getCoverageDomains()
      .then((res) => {
        if (cancelled) return;
        const list = filterCoverageDomains(res?.domains || [], allowedDomains);
        setDomains(list);
        if (list.length && !list.some((d) => d.domain === domain)) {
          setDomain(list[0].domain);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Errore caricamento domini");
      });
    return () => { cancelled = true; };
    // domains.length / domain: evita loop; reload solo alla prima apertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fields = useMemo(
    () => visibleFieldsForDomain(domains, domain),
    [domains, domain]
  );

  function handleDomainChange(next) {
    setDomain(next);
    setCriteria({});
    setResult(null);
    setError(null);
  }

  function handleField(key, value) {
    setCriteria((prev) => ({ ...prev, [key]: value }));
  }

  async function handleVerify() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiService.verifyCoverageRequirement({
        domain,
        company_id: companyId || undefined,
        criteria,
      });
      setResult(data);
    } catch (e) {
      setError(e.message || "Errore verifica");
    } finally {
      setLoading(false);
    }
  }

  const verifyDisabled = !domain || loading;
  const verifyTitle = !domain
    ? "Seleziona un dominio di copertura"
    : loading
      ? "Calcolo in corso"
      : "";

  return (
    <div className="sq-cov-panel">
      {!embedded && (
        <button
          type="button"
          className="sq-cov-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? "\u25B2" : "\u25BC"}{" "}
          Verifica copertura
        </button>
      )}
      {open && (
        <div className="sq-cov-body">
          <p className="sq-cov-hint">
            Confronta un requisito di giunto/commessa con le capacit{"\u00e0"} in anagrafica
            (validit{"\u00e0"}, non i dati di prova). Ambito:
            {" "}
            {companyId ? (companyName || `azienda #${companyId}`) : "tutta l'organizzazione"}
            .
          </p>

          <div className="sq-cov-form">
            <label className="sq-cov-field">
              <span>Dominio</span>
              <select
                className="sq-select"
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                data-testid="cov-domain"
              >
                {domains.length === 0 && (
                  <option value={domain}>{domain}</option>
                )}
                {domains.map((d) => (
                  <option key={d.domain} value={d.domain}>
                    {d.label}
                    {!d.implemented ? " (stub)" : d.maturity === "minimal" ? " (minimo)" : ""}
                  </option>
                ))}
              </select>
            </label>

            {fields.map((f) => (
              <label key={f.key} className="sq-cov-field" data-testid={`cov-field-${f.key}`}>
                <span>{f.label}</span>
                {f.type === "select" ? (
                  <select
                    className="sq-select"
                    value={criteria[f.key] ?? ""}
                    onChange={(e) => handleField(f.key, e.target.value)}
                  >
                    <option value="">—</option>
                    {(f.options || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="sq-search"
                    type={f.type === "number" ? "number" : "text"}
                    value={criteria[f.key] ?? ""}
                    onChange={(e) => handleField(f.key, e.target.value)}
                    placeholder={f.hint || ""}
                  />
                )}
              </label>
            ))}

            <button
              type="button"
              className="sq-btn-new"
              onClick={handleVerify}
              disabled={verifyDisabled}
              title={verifyTitle}
              data-testid="cov-verify"
            >
              {loading ? "Calcolo..." : "Verifica"}
            </button>
          </div>

          {error && <div className="sq-error" role="alert">{error}</div>}

          {result && (
            <div className="sq-cov-result" data-testid="cov-result">
              {!result.implemented && (
                <p className="sq-cov-stub-msg">
                  Dominio registrato ma match completo in una fetta successiva.
                </p>
              )}
              {result.summary && (
                <p className="sq-cov-summary">
                  Esito: {result.summary.match} coperti
                  {" · "}
                  {result.summary.partial} parziali
                  {" · "}
                  {result.summary.no_match} esclusi
                  {result.summary.not_implemented
                    ? ` · ${result.summary.not_implemented} stub`
                    : ""}
                </p>
              )}
              {result.message && (
                <p className="sq-cov-hint" data-testid="cov-message">{result.message}</p>
              )}
              <table className="sq-cov-table">
                <thead>
                  <tr>
                    <th>Capacit{"\u00e0"}</th>
                    <th>Stato</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.matches || []).map((m, idx) => {
                    const st = COVERAGE_STATUS_LABEL[m.status] || COVERAGE_STATUS_LABEL.no_match;
                    const name = m.capability?.person_name
                      || m.capability?.wpqr_code
                      || (m.capability_id != null ? `#${m.capability_id}` : "—");
                    return (
                      <tr key={`${m.capability_id || "x"}-${idx}`}>
                        <td>{name}</td>
                        <td><span className={`sq-tag ${st.cls}`}>{st.label}</span></td>
                        <td>{(m.reasons || []).join("; ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
