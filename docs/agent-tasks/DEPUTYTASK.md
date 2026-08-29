# DEPUTYTASK — STUD-3-B: range WPQR stud ISO 14555 + accettazione Tabella 2 boiler pins

**Stato:** APERTO  
**Aperto:** 29/08/2026  
**Stream:** [`DEPUTYTASK_WPQR_STUD.md`](DEPUTYTASK_WPQR_STUD.md) (STUD-1 #585, STUD-2 #590, STUD-3-A #589 **CHIUSI**)  
**Report:** [`docs/gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md`](../gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md)  
**Estratto (HITL chiuso 29/08):** [`docs/reference/ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md)  
**Dipende da:** STUD-3-A + HITL extract/Tabella 2 **chiusi**; PR second pass #596 allineata su `main`  
**Rischio:** Medio — motorino regole additivo FE/BE + wiring minimo WPQR; **niente** auth/sync/migrazioni distruttive; **niente** codici 4063 inventati  
**Slot precedente:** STUD-2 CHIUSO (ingest)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.  
> Comando: `Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.`

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: ISO-14555-2025-range-validita-WPQR.md (§10.2.8.1–12, Tabella 2 HITL:
  ø 8→40 Nm, 10→60 Nm, 12→85 Nm; criterio §12.3 OR Table 2); NORMA_00033;
  pattern weldingQualificationRules15614*.js
- Mancanti: catalogo ISO 4063 stud (78x) — FUORI scope (HITL: solo indicazione processo)
- Si parte su: motorino range §10.2.8 + accettazione Tabella 2; VIETATO inventare 783/784/785
```

## Perché

STUD-3-A ha l’estratto; HITL ha chiuso GAP e Tabella 2. Manca il codice: oggi UI/WPS applicano ancora logica 15614 (Tabella 7/9) anche dove non compete a uno stud 14555. STUD-3-B codifica le regole validate.

## Obiettivo

Motorino `weldingQualificationRules14555` (FE + mirror BE) da estratto già validato:

1. **Sezione stud** (§10.2.8.8): una prova → solo quella sezione; due prove → intervallo tra le sezioni (+ tutte le forme).
2. **Spessore parent** (§10.2.8.6): tutti gli spessori se pWPS applicabile — **non** Tabella 7 15614.
3. **Posizione** (§10.2.8.9): ramo `tw > 100 ms` vs `tw ≤ 100 ms`.
4. **Protezione bagno** (§10.2.8.12): CF / SG / NP (NP copre SG, non il contrario).
5. **Materiali** (§10.2.8.4 / 10.2.8.5 a–c) come da HITL (per **a** dissimili: `tw > 100 ms` → qualifica dedicata, nessuna matrice inventata).
6. **Through-deck** (§10.2.8.7 + §3.14): lastra più spessa copre più sottili; soglia lastra **&lt; 3 mm**.
7. **Accettazione boiler pins Tabella 2**: 8→40, 10→60, 12→85 Nm; criterio **§12.3 OR Table 2** (salvo diversa specifica).

Wiring minimo: non applicare range 15614 quando norma = 14555 (e tipicamente `joint_type=SW`); opzione norma 14555 in form WPQR se manca.

## DoD

1. File regole FE+BE sincronizzati + test L1 (FE vitest mirato e/o BE jest) verdi.
2. Nessun codice 4063 stud inventato in `weldingProcesses4063.js`.
3. `deploy-manifest.json` aggiornato se nuovo `.js` in `backend/src/data/`.
4. Build `app/` OK se tocchi FE.
5. Brief **CHIUSO — TEST OK** (o handoff se non chiudi).

## File previsti

- `app/src/data/weldingQualificationRules14555.js` (**nuovo**)
- `backend/src/data/weldingQualificationRules14555.js` (**nuovo**, mirror)
- `app/src/tests/weldingQualificationRules14555.test.js` (**nuovo**)
- `backend/src/data/weldingQualificationRules14555.test.js` (**nuovo**, opzionale se pattern BE)
- `backend/scripts/deploy-manifest.json` (riga data)
- `app/src/pages/WeldingProceduresPage.jsx` (opzione norma 14555 + non applicare calc 15614 su 14555)
- eventuale `backend/src/services/wpsGenerator.service.js` (ramo spessore 14555, minimo)
- `docs/agent-tasks/DEPUTYTASK.md` (questo brief)
- `docs/agent-tasks/DEPUTYTASK_WPQR_STUD.md` (riga STUD-3-B)

## Cosa NON toccare

- Inventare famiglia 78x in `weldingProcesses4063.js`
- Auth / sync / JWT / migrazioni distruttive
- Seed VPS `norm_requirements` (non richiesto)
- CND / NC / Qualifiche / Material Compliance
- Usare Annex B (informative) come range validità al posto di §10.2.8
- GUIDA / roadmap § Stato attuale se parallelo (bozza nel brief; sync dopo merge)
- `DEPUTYTASK1.md`… (altri slot)

## Verifica

- [ ] Test regole: sezione 1/2 prove; spessore «tutti»; posizioni tw; CF/SG/NP; materiali a–c; through-deck; Tabella 2 8/10/12
- [ ] Nessun 783/784/785 nuovo nel catalogo
- [ ] L1 + build se FE
- [ ] PR codice; brief chiuso

## Bozza hub (dopo merge se parallelo)

- Roadmap: «STUD-3-B range 14555 + Tabella 2 in codice»
- Stream STUD: STUD-3-B CHIUSO
