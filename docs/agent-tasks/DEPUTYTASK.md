# DEPUTYTASK — Nessun task deputy attivo — 17/06/2026

**Stato:** **CHIUSO — TEST OK** (nessun brief in esecuzione)

---

## Sessione chiusa — Fix filtri scadenza azioni drawer NC

| Voce | Esito |
|------|-------|
| Anomalia grafica filtri «Tutte» / «In scadenza 7 gg» sovrapposti | ✅ Corretto — `status-btn` 40×40 senza override testuale |
| Verifica committente | ✅ **TEST OK** da mobile |
| PR | [#112](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/112) **mergiata** su `main` (`267d627`) |
| Deploy | Netlify auto-deploy da `main` (~2 min) |

**Doc:** lezione aggiornata in `GUIDA_CONSOLIDATA.md` (sezione pulsanti workflow NC / `.nc-action-due-filters`).

---

## Coda prossimi task

| # | Task | Note |
|---|------|------|
| **1** | **Mason P5** — dropdown fornitori audit 2ª parte | PR [#111](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/111) aperta — preview TEST OK committente, merge in attesa |
| **2** | **Controparti PR2** — select committente in `ContractReviewPage` | PR1 live [#110](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/110). Traccia: [PROJECT_ROADMAP](PROJECT_ROADMAP.md) |

**Per avviare un task:** sovrascrivere questo file con brief Obiettivo/DoD e lanciare:

`Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`
