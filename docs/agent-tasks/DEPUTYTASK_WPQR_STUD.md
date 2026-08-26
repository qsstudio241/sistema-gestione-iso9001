# DEPUTYTASK_WPQR_STUD — Stud Welding / prigioniero + Piastra–Tubo «entrambi»

**Stato:** APERTO  
**Aperto:** 25/08/2026  
**Branch gap (Lead):** `cursor/gap-wpqr-stud-887f`  
**Report:** [`docs/gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md`](../gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md)  
**Rischio slice codice:** Medio — migrazione additiva nullable + FE/BE WPQR; **niente** auth/sync/breaking distruttivo  
**Parallelo:** slot `DEPUTYTASK.md` / `DEPUTYTASK1.md` = **CND-9** / **CND-W** (aperti 26/08) — **non** toccarli. GUIDA/roadmap: sync **dopo merge** se c’è parallelo.

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: ISO 15614-1 (NORMA_00019 + estratto range); citazione 14555 in 3834-5; t1/t2 già in prod (mig. 158)
- Mancanti: ISO 14555 (testo MD/PDF) → backlog da_richiedere; processi 4063 stud
- Si parte su: STUD-1 campi UI/DB/schema senza inventare range 14555
```

## Richiesta norma (HITL)

- **Codice / titolo**: UNI EN ISO 14555 (Arc stud welding of metallic materials)
- **Edizione desiderata**: vigente UNI/EN
- **Serve a** (modulo / slice): WPQR Stud Welding — STUD-3 (range di validità)
- **Cosa c’è già in repo**: solo citazione in `NORMA_00008` (3834-5); nessun MD/PDF 14555
- **Cosa NON inventiamo senza PDF**: soglie, clausole, range di validità stud, variabili essenziali 14555
- **Perimetro su cui si parte comunque**: STUD-1 (campi + doppio materiale + P+T) su 15614-1 + verbale Mason 001P-21
- **Formato utile**: PDF → skill `pdf-to-json`
- **Dopo digitalizzazione**: aggiornare `NORME_MANCANTI_BACKLOG.md` → STUD-3

## Perché

Segnalazione Mason (post chiusura t1/t2): in inserimento WPQR «Stud Welding» mancano tipologia, componenti (base vs prigioniero), diametro prigioniero, range; su Piastra–Tubo non si selezionano entrambi i tipi prodotto né i range di ognuno. Screenshot verbale 001P-21 vs UI.

## Contesto (non riscrivere)

- t1/t2 FW: **CHIUSO** ([`DEPUTYTASK_WPQR_T1T2.md`](DEPUTYTASK_WPQR_T1T2.md), #558).
- Stud Welding ≠ FW generico: vedi report gap § «Stud Welding vs FW».
- Caso 001P-21 = fillet 135 su prigioniero tubolare sotto 15614-1, non necessariamente qualifica 14555.

---

## Slice 1 (STUD-1) — implementabile subito

**Obiettivo**: conservare i dati del verbale senza calcolare range 14555.

### DoD

1. Tipologia giunto: aggiungere opzione dedicata (es. `SW` / «Stud / prigioniero») **oppure** sotto-tipo su FW — documentare la scelta nel commit; non rompere BW/FW esistenti.
2. Campo «elemento che si qualifica» (base / prigioniero / entrambi) — persistenza nullable.
3. Diametro: se tipologia stud, label e semantica = **diametro prigioniero** (riuso colonne `diameter_*` o colonna dedicata nullable — preferire riuso se non crea ambiguità tubo).
4. Doppio materiale: `base_material_group` + secondo gruppo/spec (nullable) per Parent Metal 1 e 2; form Modifica + schema ingest FE/BE allineati.
5. `product_type`: consentire `P+T` (o equivalente) oltre a P/T; aggiornare schema + form; generatore WPS: non regressione su P-only / T-only; regola piastra→tubo esistente resta.
6. **Vietato**: inventare tabelle range ISO 14555; toccare auth/sync; rifare t1/t2.
7. L1: test mirati regole/schema + `npm run build` in `app/`.
8. Migrazione additiva in coda (numero da dichiarare prima di scrivere il file) + runner VPS se serve.

### File previsti (STUD-1)

- `app/src/pages/WeldingProceduresPage.jsx` (+ CSS solo se necessario)
- `app/src/data/documentTypeSchemas.js` + mirror `backend/src/data/documentTypeSchemas.js`
- `backend/src/controllers/welding.controller.js` (campi WPQR additivi)
- `backend/src/services/wpqrIngest.service.js` (+ test)
- `backend/src/services/wpsGenerator.service.js` (+ test) — solo compatibilità P+T / labels
- `database/migrations/<N>_wpqr_stud_fields.sql` + `run-migration-*-vps.js` se pattern repo
- Eventuale `reprocessableFields` / gate registro se i nuovi campi sono vincolanti in ingest (regola operating-memory)

### Cosa NON toccare

- `auth.middleware`, JWT, `syncService`
- Migrazioni già applicate 158 / 142 (non riscrivere)
- Slot `DEPUTYTASK.md`, `DEPUTYTASK1.md`, PLAN CND/NG
- `docs/GUIDA_CONSOLIDATA.md` / `docs/PROJECT_ROADMAP.md` in questa PR di codice se c’è parallelo — bozza sotto, sync post-merge
- Motore range 14555 (STUD-3)
- Catalogo processi 4063 stud (opzionale con STUD-3)

### Backlog (dopo STUD-1)

| ID | Contenuto | Blocco |
|----|-----------|--------|
| STUD-2 | Prompt ingest: D₁, componenti, doppia spec | — |
| STUD-3 | Range + regole ISO 14555 + processi 4063 stud | PDF 14555 |
| PT-1 | Raffinare UX range lato P vs T se non chiuso in STUD-1 | — |

---

## Bozza sync hub (dopo merge — non in PR codice se parallelo)

- Roadmap § Sessione: «Gap WPQR Stud Welding + Piastra–Tubo; brief STUD APERTO; HITL 14555».
- GUIDA lezione 1 riga: Stud Welding ≠ FW; senza 14555 solo campi, niente range inventati.

## Esito atteso chiusura STUD-1

`Stato: CHIUSO — TEST OK` + link PR. Cloud Agent **non** dichiara «pronta» senza CI + Bugbot + Security Review letti.
