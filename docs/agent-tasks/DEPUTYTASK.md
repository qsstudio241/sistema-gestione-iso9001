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
| 1 | Login con utente Camellini | Dashboard carica audit | | |
| 2 | Vai su "Checklist personalizzate" → apri/crea una con flag "Abilita valutazione esito" attivo | Checklist visibile con pulsanti C/OSS/NC/OM/NV/NA per ogni domanda | | |
| 3 | Apri la checklist da dentro un audit esistente | Sezione checklist personalizzata appare nell'accordion | | |
| 4 | Clicca C su domanda 1, NC su domanda 2, OSS su domanda 3, OM su domanda 4 | Pulsanti evidenziati con colore corretto | | |
| 5 | Salva (o attendi auto-save) → ricarica pagina (F5) | Esiti persistenti dopo ricarica | | |
| 6 | Esporta Word → apri il documento | Tabella checklist custom con colori (verde=C, rosso=NC, giallo=OSS, blu=OM) | | |
| 7 | Verifica riepilogo Word | Contatori NC/OSS/OM corretti nel riepilogo | | |

---

## Definition of Done

- [ ] Tutti i 7 passi completati con esito positivo
- [ ] Nota data e ambiente nella tabella
- [ ] Aggiorna roadmap: P1 smoke L3 ✅

Chiudi con **TEST OK** o elenca i passi falliti con descrizione del problema.
