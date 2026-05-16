/**
 * HomePage - Dashboard "Cosa fare oggi"
 *
 * Filosofia Apple: l'utente arriva e in 3 secondi sa cosa richiede attenzione.
 * NON è un menu - è un briefing operativo personalizzato.
 *
 * Sezioni:
 * 1. Saluto contestuale (buongiorno/pomeriggio/sera)
 * 2. Alert urgenti: documenti scaduti, qualifiche scadute, NC in ritardo
 * 3. In scadenza prossimi 30 giorni
 * 4. Prossimi audit pianificati
 * 5. Statistiche rapide per modulo
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import "./HomePage.css";

// ─── Saluto contestuale ───────────────────────────────────────────────────────

function getGreeting(name) {
  const h = new Date().getHours();
  const saluto = h < 12 ? "Buongiorno" : h < 18 ? "Buon pomeriggio" : "Buonasera";
  return `${saluto}, ${name || ""}`;
}

// ─── Componente Alert Card ────────────────────────────────────────────────────

function AlertCard({ icon, title, count, items, color, onAction, actionLabel }) {
  const [expanded, setExpanded] = useState(count <= 3);

  if (count === 0) return null;

  return (
    <div className={`alert-card alert-card-${color}`}>
      <div className="alert-card-header" onClick={() => setExpanded((v) => !v)}>
        <span className="alert-card-icon">{icon}</span>
        <div className="alert-card-meta">
          <span className="alert-card-title">{title}</span>
          <span className={`alert-card-count count-${color}`}>{count}</span>
        </div>
        <span className="alert-card-chevron">{expanded ? "▲" : "▼"}</span>
      </div>
      {expanded && items.length > 0 && (
        <ul className="alert-card-list">
          {items.slice(0, 5).map((item, i) => (
            <li key={i} className="alert-card-item">
              <span className="alert-item-label">{item.label}</span>
              {item.sub && <span className="alert-item-sub">{item.sub}</span>}
            </li>
          ))}
          {items.length > 5 && (
            <li className="alert-item-more">...e altri {items.length - 5}</li>
          )}
        </ul>
      )}
      {onAction && (
        <button className="alert-card-action" onClick={onAction}>
          {actionLabel || "Vedi tutti →"}
        </button>
      )}
    </div>
  );
}

// ─── Componente Stat Box ──────────────────────────────────────────────────────

function StatBox({ icon, label, value, subLabel, onClick, locked }) {
  return (
    <div
      className={`stat-box${onClick && !locked ? " stat-box-clickable" : ""}${locked ? " stat-box-locked" : ""}`}
      onClick={!locked ? onClick : undefined}
      title={locked ? "Modulo non attivo" : undefined}
    >
      <span className="stat-box-icon">{locked ? "🔒" : icon}</span>
      <div className="stat-box-content">
        <span className="stat-box-value">{locked ? "-" : value}</span>
        <span className="stat-box-label">{label}</span>
        {subLabel && !locked && <span className="stat-box-sub">{subLabel}</span>}
        {locked && <span className="stat-box-sub" style={{ color: "#94a3b8" }}>Non attivato</span>}
      </div>
    </div>
  );
}

// ─── Pagina principale ────────────────────────────────────────────────────────

function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [docStats, setDocStats] = useState(null);
  const [ncStats, setNcStats] = useState(null);
  const [recentAudits, setRecentAudits] = useState([]);
  const [expiringDocs, setExpiringDocs] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [docRes, ncRes, auditRes, expiringRes] = await Promise.allSettled([
        apiService.getDocumentStats(),
        apiService.getNonConformitiesStatistics?.() || Promise.resolve(null),
        apiService.getAudits?.({ page: 1, limit: 5, sort: "desc" }) || Promise.resolve(null),
        apiService.getDocuments({ expiring_days: 30, status: "rilasciato", limit: 10 }),
      ]);

      if (docRes.status === "fulfilled") setDocStats(docRes.value?.data || null);
      if (ncRes.status === "fulfilled" && ncRes.value) setNcStats(ncRes.value?.data || null);
      if (auditRes.status === "fulfilled" && auditRes.value) {
        setRecentAudits(auditRes.value?.data || []);
      }
      if (expiringRes.status === "fulfilled") {
        setExpiringDocs(expiringRes.value?.data || []);
      }
    } catch {
      // errori silenziosi - la home mostra quello che riesce a caricare
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Costruzione alert ──────────────────────────────────────────────────

  const expiredDocs = expiringDocs.filter((d) => d.is_expired);
  const soonDocs    = expiringDocs.filter((d) => d.expiring_soon && !d.is_expired);

  const hasAlerts = expiredDocs.length > 0 || (ncStats?.overdue > 0) || (docStats?.scaduti > 0);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="home-page">
      {/* Saluto */}
      <div className="home-greeting">
        <h2 className="greeting-text">
          {getGreeting(user?.full_name?.split(" ")[0] || user?.name?.split(" ")[0])}
        </h2>
        <p className="greeting-sub">
          {loading
            ? "Caricamento in corso..."
            : hasAlerts
            ? "Ci sono elementi che richiedono la tua attenzione."
            : "Tutto in ordine. Nessuna scadenza urgente."}
        </p>
      </div>

      {/* Sezione alert urgenti */}
      {!loading && hasAlerts && (
        <section className="home-section">
          <h3 className="section-title section-title-urgent">⚠️ Richiede attenzione</h3>
          <div className="alerts-grid">
            <AlertCard
              icon="📄"
              title="Documenti scaduti"
              count={docStats?.scaduti || 0}
              color="red"
              items={expiredDocs.map((d) => ({
                label: d.title,
                sub: `Scaduto il ${new Date(d.expiry_date).toLocaleDateString("it-IT")}`,
              }))}
              onAction={() => navigate("/documents")}
              actionLabel="Vai ai documenti →"
            />
            <AlertCard
              icon="✅"
              title="Azioni NC in ritardo"
              count={ncStats?.overdue || 0}
              color="red"
              items={[]}
              onAction={() => navigate("/azioni")}
              actionLabel="Vai alle azioni →"
            />
          </div>
        </section>
      )}

      {/* In scadenza */}
      {!loading && soonDocs.length > 0 && (
        <section className="home-section">
          <h3 className="section-title section-title-warning">🟡 In scadenza nei prossimi 30 giorni</h3>
          <div className="expiring-list">
            {soonDocs.map((doc) => (
              <div key={doc.id} className="expiring-item" onClick={() => navigate("/documents")}>
                <span className="expiring-icon">📄</span>
                <div className="expiring-meta">
                  <span className="expiring-title">{doc.title}</span>
                  <span className="expiring-date">
                    Scade il {new Date(doc.expiry_date).toLocaleDateString("it-IT")}
                    {doc.company_name ? ` - ${doc.company_name}` : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Statistiche rapide per modulo */}
      {!loading && (
        <section className="home-section">
          <h3 className="section-title">📊 Panoramica</h3>
          <div className="stats-grid">
            <StatBox
              icon="📄"
              label="Documenti vigenti"
              value={docStats?.vigenti ?? "-"}
              subLabel={docStats?.in_scadenza_30gg > 0 ? `${docStats.in_scadenza_30gg} in scadenza` : null}
              onClick={() => navigate("/documents")}
            />
            <StatBox
              icon="🎓"
              label="Qualifiche"
              value="-"
              locked
            />
            <StatBox
              icon="⚠️"
              label="Rischi aperti"
              value="-"
              locked
            />
            <StatBox
              icon="✅"
              label="Azioni aperte"
              value={ncStats?.open != null ? ncStats.open : "-"}
              subLabel={ncStats?.overdue > 0 ? `${ncStats.overdue} in ritardo` : null}
              onClick={ncStats?.open != null ? () => navigate("/azioni") : undefined}
              locked={ncStats == null}
            />
          </div>
        </section>
      )}

      {/* Accesso rapido */}
      <section className="home-section">
        <h3 className="section-title">🚀 Accesso rapido</h3>
        <div className="quick-actions">
          <button className="quick-action-btn" onClick={() => navigate("/audit")}>
            <span className="qa-icon">🔍</span>
            <span className="qa-label">Nuovo audit</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate("/documents")}>
            <span className="qa-icon">📄</span>
            <span className="qa-label">Aggiungi documento</span>
          </button>
          <button className="quick-action-btn" onClick={() => navigate("/companies")}>
            <span className="qa-icon">🏢</span>
            <span className="qa-label">Aziende</span>
          </button>
        </div>
      </section>

      {/* Placeholder se tutto è ok */}
      {!loading && !hasAlerts && soonDocs.length === 0 && (
        <div className="home-all-ok">
          <span className="all-ok-icon">✅</span>
          <p>Nessuna scadenza urgente. Il sistema è aggiornato.</p>
        </div>
      )}
    </div>
  );
}

export default HomePage;
