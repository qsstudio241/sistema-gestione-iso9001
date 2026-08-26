# DEPUTYTASK1 — STUD-3-A: estratto range ISO 14555 da NORMA_00033 (solo docs)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 26/08/2026  
**Chiuso:** 26/08/2026  
**Stream:** [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) (STUD-1 **CHIUSO** #585; PDF 14555 digitalizzato #584 → `NORMA_00033`)  
**Report:** [`docs/gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md`](../gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md)  
**Dipende da:** `NORMA_00033` MD+JSON su `main` (#584)  
**Rischio:** Basso — solo documentazione / estratto; **zero** codice app/backend, **zero** seed VPS in questa slice  
**Parallelo a:** STUD-2 su [`DEPUTYTASK.md`](DEPUTYTASK.md) — **file disgiunti**.

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: docs/Normative/Normative NORMA_00033_ BS EN ISO 14555_2025 Rev. 0.md (+ .json);
  modello editoriale docs/reference/ISO-15614-1-range-validita-WPQR.md
- Mancanti: tabella range dedicata in docs/reference/ (QUESTO deliverable — fatto);
  processi 4063 stud in catalogo JS = FUORI (STUD-3-B / slice codice dopo HITL)
- Si parte su: estrarre SOLO ciò che è leggibile nel MD/JSON; marcare GAP dove l’OCR
  è ambiguo; VIETATO inventare soglie o «ricostruire» numeri non presenti
```

## Perché

STUD-1 non ha range. STUD-3 codice (UI/DB/regole) non parte senza un estratto revisionabile. Questa slice produce l’estratto operativo (come per 15614-1), pronto per HITL committente/Mason prima di qualsiasi motorino.

## DoD

1. Creare `docs/reference/ISO-14555-2025-range-validita-WPQR.md` (nome allineato allo stile 15614-*), con:
   - header fonte → path `NORMA_00033` (+ nota PDF non in Git);
   - tabelle/regole di **range di validità** / variabili essenziali stud **solo se** ricavabili dal MD/JSON;
   - ogni cella dubbia etichettata **GAP** (come nell’estratto 15614-1);
   - sezione esplicita «Non ancora codificato in JS / non seedare».
2. Aggiornare `docs/reference/NORME_MANCANTI_BACKLOG.md`: 14555 resta `digitalizzata`; nota «estratto range STUD-3-A» (path).
3. Opzionale minimo: 1 riga in `docs/gap-reports/GAP_WPQR_STUD_...` o `SOURCE_PDF_INDEX` che punta all’estratto — senza riscrivere NORMA_00033.
4. **Niente** modifiche a `weldingQualificationRules*`, ingest, form WPQR, migrazioni, seed VPS.
5. Brief **CHIUSO — TEST OK** (verifica = file presente + citazioni clausole/path MD; niente inventati).

## File previsti

- `docs/reference/ISO-14555-2025-range-validita-WPQR.md` (**nuovo**)
- `docs/reference/NORME_MANCANTI_BACKLOG.md`
- `docs/agent-tasks/DEPUTYTASK1.md` (questo brief)
- `docs/agent-tasks/DEPUTYTASK_WPQR_STUD.md` (riga backlog STUD-3-A)
- opzionale: `docs/gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md` o `docs/Normative/SOURCE_PDF_INDEX.md` (1 riga link)

## Cosa NON toccare

- `DEPUTYTASK.md` / STUD-2 / `wpqrIngest*` / `documentTypeSchemas.js` / `WeldingProceduresPage.jsx`
- Riscrivere per intero `NORMA_00033` MD/JSON (sola lettura)
- Catalogo `weldingProcesses4063.js`, WPS generator, seed `norm_requirements` VPS
- Auth / CND / GUIDA / roadmap § Stato attuale (parallelo — sync **dopo merge**)

## Verifica

- [x] Estratto creato; ogni numero ha citazione/path nel MD fonte o è marcato GAP
- [x] Nessun file `app/` o `backend/src/` nel diff
- [x] Brief CHIUSO — TEST OK

## Esito (26/08/2026)

Deliverable: [`docs/reference/ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md).

Regole **OK** (prosa §10.2.8, pdfplumber pag. 21–22): durata/prova annuale; fabbricante; parametri fornitore; materiali simili 1/2 + 13 mm / 8–10 / 2.1; dissimili b–c (100 ms / 10 ms); spessore parent «tutti se pWPS»; through-deck lastra più spessa → più sottili; sezione stud (una prova / due prove); posizioni soglia 100 ms; attrezzatura; preriscaldo; CF/SG/NP.

**GAP** (non inventati, HITL sul PDF): Tabella 1 pag. 20; §4.1 simboli; §10.2.8.5 (a); heading OCR 11.1; §10.2.8.11 numerazione; Tabella B.1 formule 0,25×d e status normativo; definizione through-deck «3 mm»; codici 4063 stud.

## Dopo questa slice (non ora)

- HITL revisione estratto (committente/Mason)
- STUD-3-B: codifica range + eventuali processi 4063 stud (brief nuovo, dopo OK HITL)

## Bozza hub (dopo merge)

- Roadmap: «estratto 14555 STUD-3-A pronto; range codice dopo HITL»
- Backlog stream STUD: STUD-3-A fatto; STUD-3-B in coda
