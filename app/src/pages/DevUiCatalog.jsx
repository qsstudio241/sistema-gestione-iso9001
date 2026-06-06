/**
 * DevUiCatalog — Pagina catalogo componenti UI (solo development)
 *
 * Visibile esclusivamente con import.meta.env.DEV === true.
 * Route: /dev/ui-catalog
 */

import React, { useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { LoadingSpinner, Toast, Badge, Card, Tabs, EmptyState, ProgressBar } from "../components/SharedComponents";
import TagChip from "../components/TagChip";
import "./DevUiCatalog.css";

function Section({ title, children }) {
  return (
    <section className="uic-section">
      <h2 className="uic-section__title">{title}</h2>
      <div className="uic-section__body">{children}</div>
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div className="uic-subsection">
      <h3 className="uic-subsection__title">{title}</h3>
      <div className="uic-subsection__body">{children}</div>
    </div>
  );
}

export default function DevUiCatalog() {
  const [activeTab, setActiveTab] = useState("badges");
  const [showToast, setShowToast] = useState(null);

  const tabs = [
    { id: "badges", label: "Badge" },
    { id: "buttons", label: "Pulsanti" },
    { id: "cards", label: "Card" },
    { id: "feedback", label: "Feedback" },
    { id: "tags", label: "Tag/Chip" },
    { id: "misc", label: "Altro" },
  ];

  return (
    <div className="uic-page">
      <header className="uic-header">
        <h1>Catalogo UI — Design System SGQ</h1>
        <p>Componenti disponibili con tutte le varianti e stati.</p>
      </header>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "badges" && (
        <Section title="Badge di stato (StatusBadge)">
          <SubSection title="Stato documento">
            <div className="uic-badge-grid">
              {StatusBadge.getStatuses("document").map((s) => (
                <StatusBadge key={s} status={s} type="document" />
              ))}
            </div>
          </SubSection>

          <SubSection title="Stato audit">
            <div className="uic-badge-grid">
              {StatusBadge.getStatuses("audit").map((s) => (
                <StatusBadge key={s} status={s} type="audit" />
              ))}
            </div>
          </SubSection>

          <SubSection title="Stato NC (Non Conformit\u00e0)">
            <div className="uic-badge-grid">
              {StatusBadge.getStatuses("nc").map((s) => (
                <StatusBadge key={s} status={s} type="nc" />
              ))}
            </div>
          </SubSection>

          <SubSection title="Qualit\u00e0 testo norma">
            <div className="uic-badge-grid">
              {StatusBadge.getStatuses("norm_quality").map((s) => (
                <StatusBadge key={s} status={s} type="norm_quality" />
              ))}
            </div>
          </SubSection>

          <SubSection title="Stato progetto">
            <div className="uic-badge-grid">
              {StatusBadge.getStatuses("project").map((s) => (
                <StatusBadge key={s} status={s} type="project" />
              ))}
            </div>
          </SubSection>

          <SubSection title="Stato utente">
            <div className="uic-badge-grid">
              {StatusBadge.getStatuses("user").map((s) => (
                <StatusBadge key={s} status={s} type="user" />
              ))}
            </div>
          </SubSection>

          <SubSection title="Licenza">
            <div className="uic-badge-grid">
              {StatusBadge.getStatuses("license").map((s) => (
                <StatusBadge key={s} status={s} type="license" />
              ))}
            </div>
          </SubSection>

          <SubSection title="Dimensioni">
            <div className="uic-badge-grid">
              <StatusBadge status="bozza" type="document" size="small" />
              <StatusBadge status="bozza" type="document" />
              <StatusBadge status="bozza" type="document" size="large" />
            </div>
          </SubSection>

          <SubSection title="Badge generico (SharedComponents)">
            <div className="uic-badge-grid">
              <Badge variant="default">Default</Badge>
              <Badge variant="primary">Primary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
            </div>
          </SubSection>
        </Section>
      )}

      {activeTab === "buttons" && (
        <Section title="Pulsanti">
          <SubSection title="Varianti">
            <div className="uic-btn-grid">
              <button className="btn btn-primary">Primario</button>
              <button className="btn btn-secondary">Secondario</button>
              <button className="btn btn-danger">Danger</button>
              <button className="btn btn-primary" disabled>Disabled</button>
            </div>
          </SubSection>

          <SubSection title="Pulsanti esito checklist">
            <div className="uic-btn-grid">
              <button className="status-btn compliant active">C</button>
              <button className="status-btn non-compliant active">NC</button>
              <button className="status-btn partial active">OSS</button>
              <button className="status-btn om active">OM</button>
              <button className="status-btn not-applicable active">NA</button>
              <button className="status-btn not-verified active">NV</button>
            </div>
          </SubSection>
        </Section>
      )}

      {activeTab === "cards" && (
        <Section title="Card">
          <SubSection title="Card base">
            <Card title="Titolo card" actions={<button className="btn btn-secondary">Azione</button>}>
              <p>Contenuto della card con testo di esempio per visualizzare il layout.</p>
            </Card>
          </SubSection>

          <SubSection title="Card senza titolo">
            <Card>
              <p>Card senza header, solo contenuto.</p>
            </Card>
          </SubSection>
        </Section>
      )}

      {activeTab === "feedback" && (
        <Section title="Feedback e stati">
          <SubSection title="Loading Spinner">
            <div className="uic-row">
              <LoadingSpinner size="small" message="Piccolo" />
              <LoadingSpinner size="medium" message="Medio" />
            </div>
          </SubSection>

          <SubSection title="Toast">
            <div className="uic-btn-grid">
              <button className="btn btn-primary" onClick={() => setShowToast("success")}>
                Toast Success
              </button>
              <button className="btn btn-danger" onClick={() => setShowToast("error")}>
                Toast Error
              </button>
              <button className="btn btn-secondary" onClick={() => setShowToast("warning")}>
                Toast Warning
              </button>
            </div>
            {showToast && (
              <Toast type={showToast} message={`Messaggio di tipo ${showToast}`} onClose={() => setShowToast(null)} />
            )}
          </SubSection>

          <SubSection title="Empty State">
            <EmptyState title="Nessun dato" message="Non ci sono elementi da visualizzare." />
          </SubSection>

          <SubSection title="Progress Bar">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ProgressBar value={25} variant="default" />
              <ProgressBar value={60} variant="warning" />
              <ProgressBar value={90} variant="danger" />
            </div>
          </SubSection>
        </Section>
      )}

      {activeTab === "tags" && (
        <Section title="Tag e Chip">
          <SubSection title="TagChip con colori">
            <div className="uic-badge-grid">
              <TagChip tag={{ name: "ISO 9001", color: "#3b82f6" }} />
              <TagChip tag={{ name: "Saldatura", color: "#ef4444" }} />
              <TagChip tag={{ name: "Qualifica", color: "#10b981" }} />
              <TagChip tag={{ name: "Manutenzione", color: "#f59e0b" }} />
              <TagChip tag={{ name: "Rimovibile", color: "#8b5cf6" }} onRemove={() => {}} />
            </div>
          </SubSection>

          <SubSection title="TagChip dimensioni">
            <div className="uic-badge-grid">
              <TagChip tag={{ name: "Small", color: "#6366f1" }} size="small" />
              <TagChip tag={{ name: "Default", color: "#6366f1" }} size="default" />
            </div>
          </SubSection>
        </Section>
      )}

      {activeTab === "misc" && (
        <Section title="Vari">
          <SubSection title="Tabs">
            <Tabs
              tabs={[
                { id: "a", label: "Tab A" },
                { id: "b", label: "Tab B" },
                { id: "c", label: "Tab C", icon: "\u2699" },
              ]}
              activeTab="a"
              onChange={() => {}}
            />
          </SubSection>

          <SubSection title="Variabili CSS disponibili">
            <div className="uic-token-grid">
              {[
                ["--color-primary", "#1e3a5f"],
                ["--color-primary-light", "#2c5282"],
                ["--color-accent", "#3b82f6"],
                ["--color-bg", "#f8fafc"],
                ["--color-surface", "#ffffff"],
                ["--color-border", "#e2e8f0"],
                ["--color-text", "#1e293b"],
                ["--color-text-muted", "#64748b"],
                ["--color-active-bg", "#dbeafe"],
                ["--color-active-text", "#1d4ed8"],
              ].map(([name, value]) => (
                <div key={name} className="uic-token">
                  <span className="uic-token__swatch" style={{ background: value }} />
                  <code className="uic-token__name">{name}</code>
                  <span className="uic-token__value">{value}</span>
                </div>
              ))}
            </div>
          </SubSection>
        </Section>
      )}
    </div>
  );
}
