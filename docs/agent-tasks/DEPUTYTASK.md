# DEPUTYTASK — COV-1: Chassis copertura scalabile + adapter welder_9606

**Stato:** APERTO  
**Aperto:** 05/10/2026  
**Piano:** [`PLAN_COPERTURA_SCALABILE_SLICES.md`](PLAN_COPERTURA_SCALABILE_SLICES.md) § COV-1  
**Rischio:** Medio — BE additivo + UI minimale; niente auth/JWT/sync; nessuna migrazione  
**Branch:** `cursor/copertura-scalabile-fetta2-098a`  
**Slot precedente:** Alert #3 CHIUSO su `origin/main` — sovrascrittura consentita  
**Parallelo:** nessun altro `DEPUTYTASK*` APERTO su `origin/main` al lancio

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

---

## Perché

Il committente conferma copertura a **spettro ampio** (9606 + WPQR + CND 9712). Serve un motore plug-in per dominio, non logica saldatori sparsa. COV-1 consegna lo chassis e il primo adapter completo sulla colonna **validità**.

## Obiettivo verificabile

1. Chassis: `Requirement`, `CapabilityMatch`, `DomainAdapter` + registry
2. Adapter `welder_9606` completo (validità)
3. Hook/stub `wpqr_procedure` e `cnd_9712` registrati
4. API + UI minimale «Verifica copertura» su Qualifiche
5. Test L1: match/no-match welder; registry ≥3; FE campi per dominio

## File previsti

- `docs/agent-tasks/PLAN_COPERTURA_SCALABILE_SLICES.md`
- `docs/agent-tasks/DEPUTYTASK.md` (questo)
- `backend/src/services/capabilityCoverage/**`
- `backend/src/controllers/qualifications.controller.js` (endpoint additivi)
- `backend/src/routes/qualifications.routes.js`
- `backend/scripts/deploy-manifest.json`
- `app/src/components/CoverageVerifyPanel.jsx` (+ CSS se serve, preferire classi `sq-*`)
- `app/src/pages/QualificationsPage.jsx` (montaggio pannello)
- `app/src/services/apiService.js` (client API)
- `PROJECT_CONTEXT.md` (riga bussola se nasce modulo)
- test L1 BE/FE collegati

## Cosa NON toccare

- Generatore WPS, ingest, migrazioni SQL, auth/sync
- `jointTypeProfiles` (solo riuso)
- Altri `DEPUTYTASK*` CHIUSI / epic parallele
- Acrobat / JEV / regole 78x

## DoD

- [ ] Registry ≥3 domini
- [ ] welder match + no-match testati
- [ ] Stub WPQR/CND con status tipizzato
- [ ] UI mostra/nasconde campi per dominio
- [ ] L1 FE + build; Jest coverage chassis
- [ ] PR draft; nessuna migration VPS
- [ ] `bugbot run` una volta a slice chiusa
