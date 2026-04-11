/**
 * ModuleLocked — Schermata standard per moduli non ancora attivati
 *
 * Approccio Apple: non mostrare una pagina vuota o un errore.
 * Mostrare cosa il modulo fa, quando sarà disponibile, e come attivarlo.
 */

import React from "react";
import "./ModuleLocked.css";

const MODULE_INFO = {
  documents: {
    icon: "📄",
    title: "Registro documenti",
    description:
      "Catalogo documenti, revisioni, scadenze ed export. Richiede licenza modulo Documenti.",
    features: [
      "Stati documento e responsabili",
      "Alert scadenze in sidebar",
      "Allegati e versioni file",
    ],
    sprint: "Sprint 1",
    eta: "Contatta l'amministratore",
  },
  reclami: {
    icon: "📢",
    title: "Reclami e fornitori",
    description:
      "Registro reclami clienti (ISO 9001 §8.2.1) e valutazione fornitori (§8.4).",
    features: [
      "Workflow reclami e alert >30 giorni",
      "Anagrafica fornitori e valutazioni",
    ],
    sprint: "Sprint 7",
    eta: "Contatta l'amministratore",
  },
  nc: {
    icon: "🚨",
    title: "Non conformità",
    description:
      "Vista registro NC cross-audit, azioni correttive e workflow stati.",
    features: [
      "Filtri stato, severità, scadenze",
      "Azioni correttive strutturate",
    ],
    sprint: "Sprint 5",
    eta: "Contatta l'amministratore",
  },
  notifications: {
    icon: "🔔",
    title: "Notifiche email",
    description:
      "Configurazione SMTP organizzazione, template alert e invio di prova.",
    features: ["Server mail e mittente", "Alert scadenze documenti e qualifiche"],
    sprint: "Sprint 3",
    eta: "Contatta l'amministratore",
  },
  qualifiche: {
    icon: "🎓",
    title: "Qualifiche Personale",
    description: "Gestisci le qualifiche del personale con scadenze automatiche: patentini ISO 9606 (saldatori), certificazioni NDT (ISO 9712), abilitazioni RWC (ISO 14731) e qualsiasi altra qualifica con data di scadenza.",
    features: [
      "Registro qualifiche con semaforo scadenze",
      "Alert email automatici 60/30/7 giorni prima della scadenza",
      "Collegamento a WPS e commesse (ISO 3834)",
      "Storico rinnovi e documenti allegati",
    ],
    sprint: "Sprint 2",
    eta: "Prossimamente",
  },
  rischi: {
    icon: "⚠️",
    title: "Rischi & Obiettivi",
    description: "Registro rischi e opportunità secondo ISO 9001 §6.1 e obiettivi misurabili §6.2. Matrice probabilità × impatto, piani di trattamento, monitoraggio avanzamento.",
    features: [
      "Matrice rischi con valutazione P×I",
      "Obiettivi con KPI e avanzamento",
      "Collegamento a NC e azioni correttive",
      "Report per riesame direzione",
    ],
    sprint: "Sprint 6",
    eta: "Prossimamente",
  },
  azioni: {
    icon: "✅",
    title: "Azioni Correttive & Preventive",
    description: "Workflow completo per la gestione delle azioni: dall'apertura alla verifica efficacia. Collegate direttamente alle NC degli audit, ai rischi e ai reclami.",
    features: [
      "Workflow aperta → assegnata → in corso → verificata → chiusa",
      "Assegnazione responsabile con email notifica",
      "Collegamento a NC audit, rischi, reclami",
      "Dashboard KPI: % chiuse, ritardi",
    ],
    sprint: "Sprint 3",
    eta: "Prossimamente",
  },
  sal: {
    icon: "📊",
    title: "SAL — Riesame Direzione",
    description: "Stato Avanzamento Lavori per il riesame della direzione. Griglia requisiti × stati con codifica colori (discusso / in corso / completato). Export verbale Word.",
    features: [
      "Griglia requisiti ISO 9001/14001/45001",
      "Stati: Discusso / In corso / Completato / Non applicabile",
      "Collegamento automatico a NC, obiettivi, audit recenti",
      "Export verbale riesame direzione in Word",
    ],
    sprint: "Sprint 4",
    eta: "Prossimamente",
  },
  saldatura: {
    icon: "🔧",
    title: "Modulo Saldatura ISO 3834",
    description: "Gestione completa per coordinatori di saldatura: WPS e WPQR, qualifiche saldatori (ISO 9606), personale NDT (ISO 9712), commesse con riesame requisiti.",
    features: [
      "Registro WPS/WPQR con allegati PDF",
      "Qualifiche saldatori con alert scadenza",
      "Personale NDT (VT, MT, PT, UT, RT)",
      "Gestione commesse con riesame iniziale e tecnico",
    ],
    sprint: "Sprint 5",
    eta: "Prossimamente",
  },
};

function ModuleLocked({ module, lockedByLicense = false }) {
  const info = MODULE_INFO[module] || {
    icon: "🔒",
    title: "Modulo non disponibile",
    description: "Questo modulo è in fase di sviluppo.",
    features: [],
    sprint: "—",
    eta: "Prossimamente",
  };

  return (
    <div className="module-locked">
      <div className="module-locked-card">
        {/* Icona e badge */}
        <div className="module-locked-icon-wrap">
          <span className="module-locked-icon">{info.icon}</span>
          <span className="module-locked-badge">
            {lockedByLicense ? "Non incluso nel piano" : "In arrivo"}
          </span>
        </div>

        {/* Titolo e descrizione */}
        <h2 className="module-locked-title">{info.title}</h2>
        <p className="module-locked-desc">{info.description}</p>

        {/* Funzionalità incluse */}
        {info.features.length > 0 && (
          <div className="module-locked-features">
            <p className="features-label">Cosa include questo modulo:</p>
            <ul>
              {info.features.map((f, i) => (
                <li key={i}>
                  <span className="feature-check">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ETA */}
        {!lockedByLicense && (
          <div className="module-locked-eta">
            <span className="eta-label">Rilascio previsto</span>
            <span className="eta-value">{info.sprint} — {info.eta}</span>
          </div>
        )}

        {/* CTA */}
        <div className="module-locked-cta">
          <p className="cta-note">
            {lockedByLicense
              ? "Il modulo non è abilitato per la tua organizzazione. Chiedi a un amministratore di attivarlo in Impostazioni → Licenze moduli."
              : "Questo modulo sarà disponibile come parte del piano di sviluppo. Contatta QS Studio per informazioni sull'attivazione anticipata."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ModuleLocked;
