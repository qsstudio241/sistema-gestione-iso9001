# DEPUTYTASK — stato al 21/06/2026

## Ultimo task completato
**Modulo CND (Controlli Non Distruttivi)** — completato e in produzione

### PR mergiate in questa sessione
| PR | Contenuto |
|----|-----------|
| #133 | fix: `-AlsoRestartTest` in deploy script |
| #134 | feat: Modulo CND completo (slice 1-6) |
| #135 | feat: CND mobile responsive |
| #136 | fix: auto-calcolo prossima taratura |
| #137 | fix: VT gaps (ruolo strumenti, inspector, strumenti vuoti) |
| #138 | feat: gestione difetti VT (note per riga, riepilogo, NC link) |
| #139 | fix: AutoTextarea, NcCreateModal pre-compilata, auto-save |
| #140 | feat: foto saldature per riga Elenco Marche |
| #141 | fix: VT/CND nel bottom navigation mobile |

### Stato produzione
- DB: migrazioni 104-108 eseguite su `SGQ_ISO9001`
- Backend: `sgq-backend` aggiornato, health OK
- Frontend: Netlify live con bundle aggiornato
- Licenze: `cnd` abilitato per org 1003 (MASON_Srl) e 1004 (ERAM)

### PR preesistenti da triaggiare (non urgenti)
- #124 — feat: selettore azienda Riesame Direzione (OPEN)
- #105, #103, #102 — DRAFT/OPEN non correlate a CND

## Prossimi task backlog
- MT/PT/UT: aggiungere sezione parametri specifica per metodo (solo `NdtParams*.jsx` + template Word)
- Foto offline: le foto richiedono connessione — per cantieri senza WiFi serve queue offline
- Export Word MT/PT/UT: template separato per ciascun metodo
