# DEPUTYTASK — ING-5: Agente triage documenti (HITL / wayfinder)

**Stato:** APERTO — HITL (nessun codice applicativo in questa sessione)  
**Aperto:** 02/09/2026  
**Piano:** [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) § ING-5  
**Rischio:** — (solo docs / brief; implementazione = Medio dopo risposte HITL)  
**Branch:** `cursor/ing5-doc-triage-agent-3c54`  
**Dipende da:** ING-1 (#624) + ING-2 (#626) su `main` (mattoni classifica + confidence già presenti)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`  
> **Questa apertura**: deputy **non** implementa — raccoglie HITL. Se le risposte arrivano e il delta è AFK sottile, nuova sessione con file list aggiornata.

---

## Perché HITL (non FIX NON APPLICABILI, non TEST OK codice)

Su `main` dopo #624/#626 esiste già:

| Mattone | Dove |
|---------|------|
| Euristica ruolo da nome/MIME + confidence | `app/src/utils/caseDocCatalog.js` (`suggestCommercialDocRole`, `buildBatchRoleSuggestions`) |
| UI batch + conferma HITL | `ContractReviewPage.jsx` («Classificazione batch — conferma HITL») |
| Gate Analizza catalogo | stesso util + pannello catalogo |

Il PLAN descriveva ING-5 come «classifica + coda HITL» — **già coperto**. Senza delta prodotto si crea duplicato o monolite multi-agente (vietato).

## Domande al committente (copia risposte in chat / aggiorna PLAN)

1. **Delta**: cosa deve fare l’«agente triage» oltre la batch HITL attuale?
2. **Trigger**: upload, bottone, Import Jobs, cron?
3. **Coda**: solo UI vs persistenza (`import_jobs` / staging / nuova tabella)?
4. **Costellazione**: elenco slice-agente successive (una riga ciascuna) dopo triage?
5. **Priorità alternativa**: saltare ING-5 e fare **ponte gap→checklist** (prio #3) oppure **VC-5** (solo Lead)?

## File previsti (dopo HITL — bozza, da riscrivere)

- TBD in base alle risposte (gate Ponytail: riuso `caseDocCatalog` / Import Jobs / ADR-010 — niente secondo storage né auth/sync)
- `docs/agent-tasks/PLAN_VALUTAZIONE_COMMESSE_SLICES.md` (spunta / sotto-slice)
- `docs/agent-tasks/DEPUTYTASK.md` (questo brief)

## Cosa NON toccare (anche dopo sblocco)

- `auth.middleware`, JWT, `syncService`, ADR-008
- Monolite multi-agente / orchestratore unico in una PR
- SAL `gapAnalysis.service.js` come motore di questo flusso
- VC-5 senza conferma Lead
- Rifare ING-1/ING-2 senza delta esplicito

## Ops già fatti (sessione 02/09 — post audit Camellini)

| Voce | Esito |
|------|--------|
| Merge | ING-1 #624, ING-4 #625, ING-2 #626, ING-3 #627, docs #623 — tutti MERGED |
| Health VPS | `healthy` + DB OK |
| Mig **162** | Idempotente OK — tabelle `commercial_checklist_templates` + `_items` presenti |
| Deploy BE #625 | Routes/controller template già su VPS; `GET .../commercial-checklist-templates` → 401 (auth); MainPID attivo — **nessun redeploy** |
| Smoke | Login API 200 OK |

## Esito atteso questa PR docs

- PLAN: ING-1…ING-4 spuntati; ING-5 domande HITL esplicite
- Brief APERTO su slot `DEPUTYTASK.md` (sovrascrive ING-3 CHIUSO)
- **Niente** implementazione codice → chiusura codice = N/A; handoff sotto

## Handoff (sessione docs / HITL)

- **Obiettivo**: sbloccare ING-5 o scegliere alternativa AFK (ponte gap / VC-5 Lead)
- **Stato**: BLOCCATA — attesa HITL
- **Fatto**: ops VPS (mig162, health, login); PLAN allineato; brief ING-5 APERTO
- **Manca**: risposte HITL § domande; poi nuova sessione implementazione **una** slice sottile
- **Non toccare**: auth/sync; duplicare batch HITL
- **Test**: ops smoke OK; L1 codice N/A
- **Brief**: `docs/agent-tasks/DEPUTYTASK.md`
- **Branch / PR**: `cursor/ing5-doc-triage-agent-3c54`
- **Roadmap**: aggiornare «sessione più recente» dopo merge di questa PR docs
