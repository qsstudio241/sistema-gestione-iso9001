import React, { useEffect, useState } from "react";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import apiService from "../services/apiService";
import "../pages/QualificationsPage.css";

function parseScopeCompanyId(companyId) {
  const n = parseInt(companyId, 10);
  return Number.isFinite(n) ? n : null;
}

export default function AmbitoFactsBar() {
  const { companyId, scopeCompanyName } = useCompanyScope();
  const scopedId = parseScopeCompanyId(companyId);
  const [facts, setFacts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (scopedId == null) {
      setFacts({ ready: false, reason: "seleziona_azienda" });
      setError(null);
      return undefined;
    }
    setFacts(null);
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

  if (error) {
    return (
      <p className="sq-scope-hint" role="status">
        {error}
      </p>
    );
  }

  if (!facts || facts.ready === false) {
    return (
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
    );
  }

  const c = facts.counts || {};
  const label = facts.companyName || scopeCompanyName || "Azienda";

  return (
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
  );
}
