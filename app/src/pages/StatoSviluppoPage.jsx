/**
 * Cruscotto stato sviluppo — solo superadmin QS Studio.
 * Tre colonne: Fatto / In corso / Prossimo. Le card in alto filtrano la stessa vista.
 */

import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  STATO_COLONNE,
  STATO_SVILUPPO,
  countStatoSviluppo,
} from "../data/statoSviluppo";
import "./BillingDashboardPage.css";
import "./QualificationsPage.css";
import "./StatoSviluppoPage.css";

function formatUpdatedAt(isoDate) {
  const [y, m, d] = String(isoDate || "").split("-");
  if (!y || !m || !d) return isoDate || "";
  return `${d}/${m}/${y}`;
}

export default function StatoSviluppoPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const [filtro, setFiltro] = useState("");
  const counts = countStatoSviluppo();

  if (!isSuperadmin) {
    return (
      <div className="billing-page">
        <h1>Stato dello sviluppo</h1>
        <p className="billing-error">
          Accesso riservato al superadmin della piattaforma.
        </p>
      </div>
    );
  }

  const colonneVisibili = filtro
    ? STATO_COLONNE.filter((c) => c.key === filtro)
    : STATO_COLONNE;

  return (
    <div className="billing-page ss-page">
      <header className="billing-header">
        <div>
          <h1>Stato dello sviluppo</h1>
          <p className="billing-intro">
            {STATO_SVILUPPO.intro} Aggiornato il{" "}
            <strong>{formatUpdatedAt(STATO_SVILUPPO.updatedAt)}</strong>.
          </p>
        </div>
      </header>

      <div className="sq-stats-bar" role="group" aria-label="Filtri rapidi per stato">
        {STATO_COLONNE.map(({ key, label, cls }) => {
          const isActive = filtro === key;
          return (
            <button
              key={key}
              type="button"
              className={`sq-stat sq-stat-clickable ${cls}${isActive ? " sq-stat-active" : ""}`}
              onClick={() => setFiltro((prev) => (prev === key ? "" : key))}
              title={isActive ? "Mostra tutte le colonne" : `Filtra: ${label}`}
              aria-pressed={isActive}
            >
              <span className="sq-stat-num">{counts[key]}</span>
              <span className="sq-stat-lbl">{label}</span>
            </button>
          );
        })}
      </div>

      <p className="ss-hint">
        Tocca una card in alto per vedere solo quella colonna. Tocca di nuovo per
        rivederle tutte.
      </p>

      <div
        className={`ss-board${filtro ? " ss-board-filtered" : ""}`}
        data-testid="ss-board"
      >
        {colonneVisibili.map((col) => (
          <section
            key={col.key}
            className={`ss-col ss-col-${col.key}`}
            aria-labelledby={`ss-col-${col.key}`}
          >
            <h2 id={`ss-col-${col.key}`} className="ss-col-title">
              {col.label}
              {" "}
              <span className="ss-col-count">{STATO_SVILUPPO[col.key].length}</span>
            </h2>
            <ul className="ss-list">
              {STATO_SVILUPPO[col.key].map((item) => (
                <li key={item.id} className="billing-card ss-card">
                  <strong className="ss-card-title">{item.title}</strong>
                  {item.waitForYou ? (
                    <span className="ss-wait">Aspetta una tua decisione</span>
                  ) : null}
                  <p className="ss-card-note">{item.note}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
