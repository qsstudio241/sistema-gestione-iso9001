# Piano slice — Copertura scalabile (spettro ampio)

> **Destinazione**: motore di copertura requisito ↔ capacità per dominio plug-in
> (`welder_9606`, `wpqr_procedure`, `cnd_9712`, …), riusabile da Qualifiche /
> Riesame / Commesse, senza `if (welder) else` sparsi.
> **Spirito**: stesso registry di `jointTypeProfiles`.
> **Brief attivo**: [`DEPUTYTASK_COPERTURA.md`](DEPUTYTASK_COPERTURA.md) — COV-2 (COV-1 chiuso: [`DEPUTYTASK.md`](DEPUTYTASK.md))
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
- Estensioni 15614/14555/15613 complete nel dominio WPQR
- Settore industriale / schema ISO 9712 nel dominio CND oltre method+level

## Decisioni già prese

- Spettro ampio confermato dal committente (05/10/2026)
- Fetta 1 designazione/validità 9606 già su `main` (`jointTypeProfiles` + colonne prova/validità)
- Nessuna migrazione in COV-1: query su tabelle esistenti
- Riuso `qualificationCoverage.js` (thickness/positions/process) e `isQualificationOperationallyActive`
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
