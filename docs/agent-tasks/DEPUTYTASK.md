# DEPUTYTASK — stato al 21/06/2026 (sera)

## Sessione completata — TEST OK

### PR mergiate oggi (21/06/2026)
| PR | Contenuto |
|----|-----------|
| #127-#132 | Modulo CND completo (slice 1-6) via #134 |
| #133 | deploy: -AlsoRestartTest |
| #134 | CND go-live: migrazioni 104-108, backend, frontend |
| #135 | mobile responsive form VT |
| #136 | auto-calcolo prossima taratura + scadenziario |
| #137 | VT gaps: ruolo strumenti, inspector auto-fill |
| #138 | difetti VT: note per riga, riepilogo R/S, NC link |
| #139 | AutoTextarea, NcCreateModal pre-compilata, auto-save |
| #140 | foto saldature per riga (ndt_report_item_id) |
| #141 | menu mobile: CND al 4° posto |
| #142 | docs chiusura sessione mattina |
| #143 | foto: pulsante in-row + foto nel Word |
| #144 | accordion chiuse su mobile + 📷 in-row |
| #145 | cliente: select+override (no duplicazione) |
| #146 | nav label: CND |
| #147 | fornitore ispezionato + scenario Mason→Manitou→Fornitore1 |
| #148 | elimina duplicazione committente/cliente |
| #149 | fornitori: select da anagrafica |
| #150 | fornitori: filtrati per company_id cliente |
| #151 | WPS: select dal modulo Saldatura |
| #152 | WPS/WPQR form: company_id da selettore scope |

### Stato produzione
- DB `SGQ_ISO9001`: migrazioni 104-109 eseguite
- Backend: aggiornato, health OK
- Frontend: Netlify live
- Licenze `cnd`: abilitato per MASON_Srl (1003) e ERAM (1004)

### PR preesistenti da triaggiare (non urgenti)
- #124 — selettore azienda Riesame Direzione (OPEN)
- #105, #103, #102, #10 — DRAFT/OPEN non correlate a CND

### Backlog (prossime sessioni)
1. **Batch upload WPS** (nessun endpoint, bassa priorità)
2. **Hardening RBAC welding** (assertCompanyRead mancante, media priorità)
3. **MT/PT/UT**: sezioni parametri specifiche + template Word
4. **Foto offline**: upload asincrono per cantieri senza WiFi
5. **SgqDataGrid** in Welding/CND/Equipment (debito tecnico, bassa priorità)
6. **Nota** `SgqDataGrid` NON è standard universale — solo 3 pagine lo usano
