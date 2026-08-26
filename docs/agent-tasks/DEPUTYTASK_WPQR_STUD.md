# DEPUTYTASK_WPQR_STUD — Stud Welding / prigioniero + Piastra–Tubo «entrambi»

**Stato:** CHIUSO — TEST OK  
**Aperto:** 25/08/2026  
**Chiuso:** 26/08/2026 — STUD-1  
**Branch:** `cursor/wpqr-stud-fields-9c6b`  
**PR:** https://github.com/qsstudio241/sistema-gestione-iso9001/pull/585  
**Report:** [`docs/gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md`](../gap-reports/GAP_WPQR_STUD_WELDING_PIASTRA_TUBO_2026-08-25.md)  
**Rischio slice codice:** Medio — migrazione additiva nullable + FE/BE WPQR; **niente** auth/sync/breaking distruttivo  
**Parallelo:** slot `DEPUTYTASK.md` / `DEPUTYTASK1.md` = **CHIUSI** (CND-8 / CND-5a) — hub GUIDA/roadmap aggiornati in questa PR (unica chat codice aperta).

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main` prima di eseguire. **Non** chiedere al committente.

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: ISO 15614-1 (NORMA_00019 + estratto range); t1/t2 già in prod (mig. 158);
  ISO 14555:2025 digitalizzata 26/08 (`NORMA_00033` MD+JSON) — testo disponibile per STUD-3
- Mancanti / non ancora estratti: tabella range 14555 dedicata in docs/reference/ (STUD-3);
  processi 4063 stud catalogo
- Si parte su: STUD-1 campi UI/DB/schema **senza** codificare range 14555 (ancora vietato inventare;
  range solo in STUD-3 dopo estratto revisionato dal MD)
```

## Richiesta norma (HITL) — **EVASA** 26/08/2026

- **Codice / titolo**: BS EN ISO 14555:2025 (Arc stud welding of metallic materials)
- **Stato**: `digitalizzata` → `NORMA_00033` (PDF **non** in Git)
- **Serve a**: STUD-3 (range); STUD-1 chiuso senza range
- **Cosa NON inventiamo senza estratto revisionato**: soglie, clausole, range di validità stud, variabili essenziali 14555
- **Perimetro chiuso in STUD-1**: campi + doppio materiale + P+T su 15614-1 + verbale Mason 001P-21
- **Prossimo**: estratto range da `NORMA_00033` → STUD-3 (+ seed VPS se utile)

## Perché

Segnalazione Mason (post chiusura t1/t2): in inserimento WPQR «Stud Welding» mancano tipologia, componenti (base vs prigioniero), diametro prigioniero, range; su Piastra–Tubo non si selezionano entrambi i tipi prodotto né i range di ognuno. Screenshot verbale 001P-21 vs UI.

## Contesto (non riscrivere)

- t1/t2 FW: **CHIUSO** ([`DEPUTYTASK_WPQR_T1T2.md`](DEPUTYTASK_WPQR_T1T2.md), #558).
- Stud Welding ≠ FW generico: vedi report gap § «Stud Welding vs FW».
- Caso 001P-21 = fillet 135 su prigioniero tubolare sotto 15614-1, non necessariamente qualifica 14555.

---

## Esito STUD-1 (26/08/2026)

**Scelta tipologia:** opzione dedicata `SW` («Stud / prigioniero»), distinta da FW — non sotto-tipo FW (Stud Welding ≠ FW; BW/FW/BW+FW invariati).

| DoD | Esito |
|-----|--------|
| 1. Tipologia SW | OK — form + schema ingest FE/BE |
| 2. Elemento che si qualifica | OK — `qualifying_element` nullable (`base`/`stud`/`both`) |
| 3. Diametro prigioniero | OK — riuso `diameter_*` + label contestuale se SW |
| 4. Doppio materiale | OK — `base_material_group_2` + `base_material_spec_2` |
| 5. product_type P+T | OK — form/schema; WPS: P+T usa regola piastra→tubo se manca diametro; P/T regressione OK |
| 6. No range 14555 / no auth-sync / no t1t2 | OK |
| 7. L1 | OK — backend jest mirati 83 pass; FE vitest 1388; `npm run build` OK |
| 8. Migrazione 159 | OK — SQL + runner VPS; colonne aggiunte su PROD |

**Registro rielaborazioni:** voci `qualifying_element`, `material_group_2`, `base_material_spec_2` (sync whitelist + registry).

**Backlog residuo:** STUD-2 (prompt ingest raffinato), STUD-3 (range 14555 + processi 4063 stud — blocco PDF), PT-1 se serve UX range lato P vs T.

Cloud Agent **non** dichiara «pronta» senza CI + Bugbot + Security Review letti.

> CI rilanciata 26/08 sera: i check required sul commit docs erano in startup_failure (coda runner); push con path `docs/agent-tasks` + `PROJECT_ROADMAP` per rieseguire CI app / harness / smoke.
