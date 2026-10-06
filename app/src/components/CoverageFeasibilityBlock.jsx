/**
 * CoverageFeasibilityBlock — «Fattibilità multi-dominio» (COV-5).
 * Accanto al semaforo saldatori di Progetti e Riesame: espone in UI gli esiti del registry
 * capacità (WPQR per ogni WPS, CND a requisito manuale) senza ricalcolare il dominio 9606.
 * DNA: schema sq-cov-panel / sq-cov-body (CoverageVerifyPanel); nessun endpoint nuovo.
 * Le motivazioni del motore (`reasons[]`, `message`) sono mostrate verbatim.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import apiService from "../services/apiService";
import CoverageVerifyPanel, { COVERAGE_STATUS_LABEL } from "./CoverageVerifyPanel";
import {
  MAX_WPS_VERIFY,
  VERIFY_BATCH_SIZE,
  bestMatch,
  hasUsableCriteria,
  wpsRowToWpqrCriteria,
} from "../utils/coverageCriteriaFromWps";

const WPQR_DOMAIN = "wpqr_procedure";
const CND_DOMAIN = "cnd_9712";

const NO_WPS_TITLE = "Nessuna WPS associata alla commessa: nessun requisito da verificare";
const INSUFFICIENT_TEXT = "Requisiti WPS insufficienti per la verifica";

function domainAvailable(domains, key) {
  return (domains || []).some((d) => d.domain === key && d.implemented);
}

function rowsSignature(rows, companyId) {
  const list = Array.isArray(rows) ? rows : [];
  return JSON.stringify([
    companyId ?? null,
    list.map((r) => [
      r?.wps_id,
      r?.welding_process,
      r?.material_group ?? r?.base_material_group,
      r?.thickness_range_min,
      r?.thickness_range_max,
    ]),
  ]);
}

function wpqrLabel(match) {
  if (!match) return "—";
  return match.capability?.wpqr_code
    || (match.capability_id != null ? `#${match.capability_id}` : "—");
}

function ResultCells({ outcome }) {
  if (!outcome) {
    return (
      <>
        <td><span className="sq-cov-muted">Non verificato</span></td>
        <td>—</td>
        <td>—</td>
      </>
    );
  }
  if (outcome.kind === "pending") {
    return (
      <>
        <td><span className="sq-cov-muted">Calcolo…</span></td>
        <td>—</td>
        <td>—</td>
      </>
    );
  }
  if (outcome.kind === "insufficient") {
    return (
      <>
        <td><span className="sq-tag sq-cov-stub">Non verificabile</span></td>
        <td>—</td>
        <td>{INSUFFICIENT_TEXT}</td>
      </>
    );
  }
  if (outcome.kind === "error") {
    return (
      <>
        <td><span className="sq-tag sq-cov-no">Errore verifica</span></td>
        <td>—</td>
        <td>{outcome.message}</td>
      </>
    );
  }
  const { best, total, message } = outcome;
  if (!best) {
    return (
      <>
        <td><span className="sq-tag sq-cov-stub">Nessuna WPQR</span></td>
        <td>—</td>
        <td>{message || "—"}</td>
      </>
    );
  }
  const st = COVERAGE_STATUS_LABEL[best.status] || COVERAGE_STATUS_LABEL.no_match;
  return (
    <>
      <td><span className={`sq-tag ${st.cls}`}>{st.label}</span></td>
      <td>
        {wpqrLabel(best)}
        {" "}
        <span className="sq-cov-muted">({total} valutate)</span>
      </td>
      <td>{(best.reasons || []).join("; ") || "—"}</td>
    </>
  );
}

export default function CoverageFeasibilityBlock({
  rows,
  welderSummary = null,
  companyId = null,
  companyName = "",
}) {
  const [expanded, setExpanded] = useState(false);
  const [domains, setDomains] = useState(null);
  const [domainsError, setDomainsError] = useState(null);
  const [outcomes, setOutcomes] = useState({});
  const [running, setRunning] = useState(false);
  const runIdRef = useRef(0);

  const rowList = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const signature = rowsSignature(rowList, companyId);

  useEffect(() => {
    runIdRef.current += 1;
    setOutcomes({});
    setRunning(false);
  }, [signature]);

  useEffect(() => {
    if (!expanded || domains !== null) return undefined;
    let cancelled = false;
    apiService.getCoverageDomains()
      .then((res) => {
        if (!cancelled) setDomains(res?.domains || []);
      })
      .catch((e) => {
        if (cancelled) return;
        setDomains([]);
        setDomainsError(e?.message || "Errore caricamento domini");
      });
    return () => { cancelled = true; };
  }, [expanded, domains]);

  const truncated = rowList.length > MAX_WPS_VERIFY;
  const prepared = useMemo(
    () => rowList.slice(0, MAX_WPS_VERIFY).map((row) => ({ row, ...wpsRowToWpqrCriteria(row) })),
    [rowList]
  );

  const wpqrReady = domains !== null && domainAvailable(domains, WPQR_DOMAIN);
  const cndReady = domains !== null && domainAvailable(domains, CND_DOMAIN);

  async function handleVerifyProcedures() {
    if (running || prepared.length === 0) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setRunning(true);

    const initial = {};
    const toCall = [];
    prepared.forEach((p, idx) => {
      if (hasUsableCriteria(p.criteria)) {
        initial[idx] = { kind: "pending" };
        toCall.push({ idx, criteria: p.criteria });
      } else {
        initial[idx] = { kind: "insufficient" };
      }
    });
    setOutcomes(initial);

    for (let i = 0; i < toCall.length; i += VERIFY_BATCH_SIZE) {
      const batch = toCall.slice(i, i + VERIFY_BATCH_SIZE);
      // eslint-disable-next-line no-await-in-loop
      const settled = await Promise.allSettled(
        batch.map((b) => apiService.verifyCoverageRequirement({
          domain: WPQR_DOMAIN,
          company_id: companyId || undefined,
          criteria: b.criteria,
        }))
      );
      if (runIdRef.current !== runId) return;
      setOutcomes((prev) => {
        const next = { ...prev };
        settled.forEach((s, j) => {
          const { idx } = batch[j];
          if (s.status === "fulfilled") {
            const matches = s.value?.matches || [];
            next[idx] = {
              kind: "ok",
              best: bestMatch(matches),
              total: matches.length,
              message: s.value?.message || null,
            };
          } else {
            next[idx] = { kind: "error", message: s.reason?.message || "Errore verifica" };
          }
        });
        return next;
      });
    }
    if (runIdRef.current === runId) setRunning(false);
  }

  const noWps = rowList.length === 0;
  const verifyDisabled = running || noWps;
  const verifyTitle = noWps ? NO_WPS_TITLE : running ? "Calcolo in corso" : "";

  const total = welderSummary?.total ?? rowList.length;

  return (
    <div className="sq-cov-panel" data-testid="cov-feasibility">
      <button
        type="button"
        className="sq-cov-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {expanded ? "\u25B2" : "\u25BC"}{" "}
        Fattibilità multi-dominio
      </button>
      {expanded && (
        <div className="sq-cov-body" aria-busy={running}>
          <p className="sq-cov-hint">
            Registro capacità: esiti per dominio, accanto al semaforo saldatori (non lo sostituisce).
            Ambito:
            {" "}
            {companyId ? (companyName || `azienda #${companyId}`) : "tutta l'organizzazione"}
            .
          </p>

          {domains === null && !domainsError && (
            <p className="sq-cov-hint">Caricamento domini…</p>
          )}
          {domainsError && (
            <div className="sq-error" role="alert">
              Registro capacità non disponibile: {domainsError}
            </div>
          )}

          {welderSummary && (
            <div className="sq-cov-section" data-testid="cov-welders">
              <h4 className="sq-cov-section-title">Saldatori (ISO 9606)</h4>
              <p className="sq-cov-summary">
                Semaforo sopra: {welderSummary.covered ?? 0} coperte
                {" · "}
                {welderSummary.partial ?? 0} parziali
                {" · "}
                {welderSummary.uncovered ?? 0} non coperte su {total} WPS
                {" — "}
                non ricalcolato qui
              </p>
            </div>
          )}

          {wpqrReady && (
            <div className="sq-cov-section" data-testid="cov-procedures">
              <h4 className="sq-cov-section-title">Procedure (WPQR)</h4>
              <div className="sq-cov-section-actions">
                <button
                  type="button"
                  className="sq-btn-new"
                  onClick={handleVerifyProcedures}
                  disabled={verifyDisabled}
                  title={verifyTitle}
                  data-testid="cov-verify-procedures"
                >
                  {running ? "Calcolo…" : "Verifica procedure"}
                </button>
                {truncated && (
                  <span className="sq-cov-muted" data-testid="cov-truncated">
                    Verificate le prime {MAX_WPS_VERIFY} WPS su {rowList.length}
                  </span>
                )}
              </div>
              {noWps ? (
                <p className="sq-cov-hint">{NO_WPS_TITLE}</p>
              ) : (
                <table className="sq-cov-table">
                  <thead>
                    <tr>
                      <th>WPS</th>
                      <th>Processo</th>
                      <th>Criteri verificati</th>
                      <th>Esito</th>
                      <th>WPQR</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prepared.map((p, idx) => (
                      <tr key={p.row.wps_id ?? idx} data-testid={`cov-wps-${p.row.wps_id ?? idx}`}>
                        <td><strong>{p.row.wps_code || `#${p.row.wps_id}`}</strong></td>
                        <td>{p.row.welding_process || "—"}</td>
                        <td>{p.verified.length ? p.verified.join(" · ") : "—"}</td>
                        <ResultCells outcome={outcomes[idx]} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {cndReady && (
            <div className="sq-cov-section" data-testid="cov-cnd">
              <h4 className="sq-cov-section-title">Personale CND (ISO 9712)</h4>
              <p className="sq-cov-hint">
                I requisiti CND non sono nei documenti/WPS: inserirli a mano.
              </p>
              <CoverageVerifyPanel
                embedded
                allowedDomains={[CND_DOMAIN]}
                defaultDomain={CND_DOMAIN}
                companyId={companyId}
                companyName={companyName}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
