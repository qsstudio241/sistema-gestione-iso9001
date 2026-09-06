import React, { useEffect, useState } from "react";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { useNavigate } from "../contexts/RouterContext";
import apiService from "../services/apiService";
import "../pages/QualificationsPage.css";

function parseScopeCompanyId(companyId) {
  const n = parseInt(companyId, 10);
  return Number.isFinite(n) ? n : null;
}

/** Destinazioni SB-5: solo navigazione HITL, nessuna write. Ambito resta nel CompanyScope. */
const NAV_ACTIONS = [
  {
    key: "nc",
    label: "Apri NC",
    buildPath: () => "/nc?status=open",
  },
  {
    key: "qual",
    label: "Qualifiche 30gg",
    buildPath: () => "/qualifiche?situazione=urgenti_30",
  },
  {
    key: "deadlines",
    label: "Scadenze 30gg",
    buildPath: () => "/deadlines?due=soon",
  },
];

export default function AmbitoFactsBar() {
  const { companyId, scopeCompanyName } = useCompanyScope();
  const navigate = useNavigate();
  const scopedId = parseScopeCompanyId(companyId);
  const [facts, setFacts] = useState(null);
  const [error, setError] = useState(null);
  const isStudioScope = scopedId == null;
  const studioReady = facts?.ready === true && (facts.scope === "studio" || facts.companyId == null);
  const companyReady = facts?.ready === true && facts.companyId != null;
  const navEnabled = companyReady || studioReady;
  const gatedTitle = "Seleziona un'azienda nell'Ambito";
  const studioNavTitle = "Apri lista filtrata (tutto lo studio)";

  useEffect(() => {
    let active = true;
    setFacts(null);
    setError(null);
    apiService
      .getAmbitoFacts(scopedId)
      .then((res) => {
        if (!active) return;
        setFacts(res?.data ?? res);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Errore caricamento fatti");
        setFacts(null);
      });
    return () => {
      active = false;
    };
  }, [scopedId]);

  const navRow = (
    <div className="af-nav-actions" role="group" aria-label="Apri moduli collegati">
      {NAV_ACTIONS.map((action) => (
        <button
          key={action.key}
          type="button"
          className="af-nav-btn"
          disabled={!navEnabled}
          title={navEnabled ? (isStudioScope ? studioNavTitle : `Vai a ${action.label}`) : gatedTitle}
          onClick={() => {
            if (!navEnabled) return;
            navigate(action.buildPath());
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );

  if (error) {
    return (
      <div>
        <p className="sq-scope-hint" role="status">
          {error}
        </p>
        {navRow}
      </div>
    );
  }

  if (!facts) {
    return (
      <div>
        <div className="sq-stats-bar" role="status" aria-busy="true">
          <div className="sq-stat sq-stat-grigio" aria-disabled="true">
            <span className="sq-stat-num">{"\u2014"}</span>
            <span className="sq-stat-lbl">NC aperte</span>
          </div>
          <div className="sq-stat sq-stat-grigio" aria-disabled="true">
            <span className="sq-stat-num">{"\u2014"}</span>
            <span className="sq-stat-lbl">Qualifiche 30gg</span>
          </div>
          <div className="sq-stat sq-stat-grigio" aria-disabled="true">
            <span className="sq-stat-num">{"\u2014"}</span>
            <span className="sq-stat-lbl">Documenti 30gg</span>
          </div>
        </div>
        {navRow}
      </div>
    );
  }

  if (facts.ready === false) {
    return (
      <div>
        <div className="sq-stats-bar" role="status">
          <div className="sq-stat sq-stat-grigio" aria-disabled="true">
            <span className="sq-stat-num">{"\u2014"}</span>
            <span className="sq-stat-lbl">NC aperte</span>
          </div>
          <div className="sq-stat sq-stat-grigio" aria-disabled="true">
            <span className="sq-stat-num">{"\u2014"}</span>
            <span className="sq-stat-lbl">Qualifiche 30gg</span>
          </div>
          <div className="sq-stat sq-stat-grigio" aria-disabled="true">
            <span className="sq-stat-num">{"\u2014"}</span>
            <span className="sq-stat-lbl">Documenti 30gg</span>
          </div>
          <p className="sq-scope-hint" style={{ margin: "8px 0 0" }}>
            {"Seleziona un'azienda nell'Ambito"}
          </p>
        </div>
        {navRow}
      </div>
    );
  }

  const c = facts.counts || {};
  const isStudio = facts.scope === "studio" || facts.companyId == null;
  const label = isStudio
    ? "Tutto lo studio"
    : facts.companyName || scopeCompanyName || "Azienda";
  const top = Array.isArray(facts.topCompanies) ? facts.topCompanies : [];

  return (
    <div>
      <div className="sq-stats-bar" role="group" aria-label={`Fatti ${label}`}>
        <div className="sq-stat sq-stat-arancione">
          <span className="sq-stat-num">{c.ncOpen ?? 0}</span>
          <span className="sq-stat-lbl">NC aperte</span>
        </div>
        <div className="sq-stat sq-stat-giallo">
          <span className="sq-stat-num">{c.qualsExpiring30 ?? 0}</span>
          <span className="sq-stat-lbl">Qualifiche 30gg</span>
        </div>
        <div className="sq-stat sq-stat-verde">
          <span className="sq-stat-num">{c.docsExpiring30 ?? 0}</span>
          <span className="sq-stat-lbl">Documenti 30gg</span>
        </div>
      </div>
      {isStudio && (
        <p className="sq-scope-hint" style={{ margin: "0 0 8px" }}>
          Aggregati studio (solo conteggi, senza testi clienti)
        </p>
      )}
      {isStudio && top.length > 0 && (
        <ul className="af-top-companies" aria-label="Top aziende per urgenza">
          {top.map((row) => (
            <li key={row.companyId}>
              <strong>{row.companyName || `Azienda #${row.companyId}`}</strong>
              {` — NC ${row.ncOpen ?? 0}, Qual ${row.qualsExpiring30 ?? 0}, Doc ${row.docsExpiring30 ?? 0}`}
            </li>
          ))}
        </ul>
      )}
      {navRow}
    </div>
  );
}
