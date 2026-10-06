# Piano slice — Copertura scalabile (spettro ampio)

> **Destinazione**: motore di copertura requisito ↔ capacità per dominio plug-in
> (`welder_9606`, `wpqr_procedure`, `cnd_9712`, …), riusabile da Qualifiche /
> Riesame / Commesse, senza `if (welder) else` sparsi.
> **Spirito**: stesso registry di `jointTypeProfiles`.
> **Brief attivo**: [`DEPUTYTASK_COPERTURA.md`](DEPUTYTASK_COPERTURA.md) — COV-3 **APERTO** (adapter `cnd_9712` pieno); COV-1 chiuso ([`DEPUTYTASK.md`](DEPUTYTASK.md)), COV-2 chiuso (PR #704, scontrino nel brief COV-3)
> **Conferma committente (05/10/2026)**: copertura a spettro ampio (9606 + WPQR + CND 9712), non solo patentini.

## Fuori scope

- Generatore WPS (già esiste; non riscrivere)
- Vocabolario JEV nuovo
- Acrobat / rifare ingest
- Migrazioni distruttive
- Regole applicative 78x (4063) su copertura

## Non ancora specificato

- Se/come unificare GET `/qualifications/coverage` (WPS↔saldatori) col nuovo motore
- UI fattibilità multi-dominio su Projects (oltre il pannello Qualifiche)
- Soglie ISO 15613 nel dominio WPQR (nessun catalogo JS: solo etichetta di base finché non c'è fonte MD)
- Stud 14555: sezione/posizione/atmosfera non hanno colonne su `wpqr_records` (non verificate dal match)
- Composizione dei settori industriali ISO 9712 (`m` `r` `a`; `s`/`m` → `w`): l'Annex A.3 la rimanda allo scope dell'ente (HITL in `NORME_MANCANTI_BACKLOG.md`); finché manca, industriale→prodotto = `partial`
- Settore multiplo sullo stesso patentino: `qualifications.ndt_sector` contiene un solo codice (regola ingest: industriale se presente)
- Allineamento codici metodo 9712:2021 (`AT` `LT` `ST` `TT`) vs codici repo (`AE` `TT` `ST` `LT`): slice separata

## Decisioni già prese

- Spettro ampio confermato dal committente (05/10/2026)
- Fetta 1 designazione/validità 9606 già su `main` (`jointTypeProfiles` + colonne prova/validità)
- Nessuna migrazione in COV-1: query su tabelle esistenti
- Riuso `qualificationCoverage.js` (thickness/positions/process) e `isQualificationOperationallyActive`
- COV-3 — adapter `cnd_9712` pieno: settore (Annex A.2/A.3, `s ⊇ m`, industriale→prodotto = `partial`), schema e tecnica (testo libero: mai `no_match`), idoneità visiva riusando `visionStateForPerson` del gate CND-2 (`missing`/`expired` → `no_match`); colonne già esistenti (mig. 032/084/088), nessuna migrazione, nessun campo AI nuovo (esenzione Rielaborazioni)
- COV-2 — adapter `wpqr_procedure` pieno: riuso `wpsGenerator` (`checkThicknessCoverage` / `checkDiameterCoverage` / `checkThroatCoverage` / `jointTypeCompatible`) + regole 15614/14555; dato mancante = `partial`, mai `match` silenzioso; 15613 = etichetta, nessuna soglia (branch `cursor/cov-2-wpqr-adapter-7169`)
- COV-1 — chassis + `welder_9606` + stub WPQR + match minimo CND + UI Qualifiche (branch `cursor/copertura-scalabile-fetta2-098a`)

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| COV-1 | Chassis + adapter `welder_9606` + stub WPQR/CND + UI minimale | `backend/src/services/capabilityCoverage/*`, controller/routes qualifiche, pannello FE Qualifiche, test L1 | — | AFK |
| COV-2 | Adapter `wpqr_procedure` pieno (15614 / 14555 stud / 15613) | adapter WPQR + riuso `wpsGenerator` / regole 15614 | COV-1 | AFK |
| COV-3 | Adapter `cnd_9712` pieno (settore, schema, visione) | adapter CND + `visionFitness` | COV-1 | AFK |
| COV-4 | Ponte commessa: `getCoverage` / Riesame usano il registry | `qualifications.controller`, `caseExtractedCoverage`, ContractReview | COV-1 (+2/3 se servono) | AFK |
| COV-5 | UI fattibilità multi-dominio (Projects / Riesame) | FE DNA + API verify multi-domain | COV-1…4 | AFK |

### COV-1 — DoD (questa sessione)

- [x] Registry ≥3 domini registrati
- [x] `welder_9606`: match/no-match su validità (processo, FW/BW, P/T, spessore, posizioni, Ø tubo, non scaduta)
- [x] Stub tipizzati `wpqr_procedure` + `cnd_9712` (not_implemented o match minimo)
- [x] API verify + domains
- [x] Pannello «Verifica copertura» su Qualifiche (campi requisito; date non al centro)
- [x] Test L1 verdi; nessuna migration

**Nota path:** il motore vive in `backend/src/services/capabilityCoverage/` (non `coverage/`: quella cartella è in `.gitignore` per i report Jest).

### COV-2 — DoD

- [x] `GET /qualifications/coverage/domains` mostra `wpqr_procedure` implementato (`maturity: full`)
- [x] `POST /qualifications/coverage/verify` con `domain: wpqr_procedure`: match / partial / no_match reali, ordinati match → partial → no_match
- [x] Riuso `wpsGenerator.service.js` + `weldingQualificationRules*.js`; nessuna soglia 15613 inventata (15613 solo etichetta)
- [x] `requirementFields` estesi (spessore B, diametro, gola, gruppo B) senza rompere COV-1
- [x] Nessuna WPQR → lista vuota + `message` (FE lo mostra)
- [x] Jest mirato verde (`npx jest src/services/capabilityCoverage`), Vitest `coverageVerifyPanel` + build, `check-harness-boot` OK; nessuna migrazione

### COV-3 — DoD

- [ ] `GET /qualifications/coverage/domains` mostra `cnd_9712` con `maturity: full`
- [ ] `POST /qualifications/coverage/verify` con `domain: cnd_9712`: settore + schema + tecnica + idoneità visiva; match / partial / no_match ordinati
- [ ] Visione via `visionStateForPerson` (nessuna logica copiata); `missing`/`expired` → `no_match`
- [ ] Industriale→prodotto = `partial`; schema/tecnica mai `no_match`; nessuna regola 9712 inventata
- [ ] `requirementFields` estesi senza rompere COV-1; nessuna qualifica NDT → lista vuota + `message`
- [ ] Jest mirato verde (`npx jest src/services/capabilityCoverage src/services/ndtInspectorGate`), `check-harness-boot` + `check-utf8-encoding` OK; nessuna migrazione
