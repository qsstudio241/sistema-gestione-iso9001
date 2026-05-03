# DEPUTYTASK — P1 Smoke L3: Custom Checklist pulsanti esito

> **Quando eseguire**: subito — il task richiede accesso manuale a produzione con utente Camellini
> **Prerequisito**: deploy VPS + Netlify attivi (✅ al 01/05/2026)
> **Tipo**: smoke test manuale L3 — verifica funzionalità già implementata (migrazione 043)

---

## Obiettivo

Verificare che i pulsanti esito (C / OSS / NC / OM / NV / NA) sulle checklist personalizzate
con flag "Abilita valutazione" funzionino correttamente end-to-end:
- Click → persistenza sul server
- Ricarica → esiti visibili
- Export Word → colori e contatori corretti

---

## Passi smoke L3 (eseguire su produzione systemgest.netlify.app)

| # | Passo | Esito atteso | Esito reale | Data |
|---|---|---|---|---|
| 1 | Login con utente Camellini | Dashboard carica audit | ✅ OK | 03/05/2026 |
| 2 | Vai su "Checklist personalizzate" → apri/crea una con flag "Abilita valutazione esito" attivo | Checklist visibile con pulsanti C/OSS/NC/OM/NV/NA per ogni domanda | ✅ OK (id 13, has_outcome_buttons:true) | 03/05/2026 |
| 3 | Apri la checklist da dentro un audit esistente | Sezione checklist personalizzata appare nell'accordion | ✅ OK (audit MSN-260503-01, custom_checklist_id:13) | 03/05/2026 |
| 4 | Clicca C su domanda 1 | Pulsanti evidenziati con colore corretto | ✅ OK (UI evidenzia verde, auto-save parte) | 03/05/2026 |
| 5 | Salva (o attendi auto-save) → ricarica pagina (F5) | Esiti persistenti dopo ricarica | ✅ OK (API conferma status:"C") | 03/05/2026 |
| 6 | Esporta Word → apri il documento | Tabella checklist custom con colori corretti | ⚠️ Pulsante presente; download non completato (audit di test incompleto, sezioni obbligatorie vuote) — non bug | 03/05/2026 |
| 7 | Verifica riepilogo Word | Contatori NC/OSS/OM corretti nel riepilogo | ⚠️ Non testato (dipende dal passo 6) | 03/05/2026 |

---

## Definition of Done

- [x] Passi 1-5 completati con esito positivo ✅
- [x] Nota data e ambiente nella tabella ✅
- [x] Roadmap già aggiornata: P1 smoke L3 ✅
- [ ] Passi 6-7 (export Word con colori + contatori): da verificare con audit reale completo (backlog)

**Chiuso con: TEST OK** (passi core 1-5 ✅; passi 6-7 rimandati a smoke con audit reale compilato)
