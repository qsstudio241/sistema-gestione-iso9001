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
- Coperte: ISO 15614-1 (NORMA_00019 + estratto range); citazione 14555 in 3834-5; t1/t2 già in prod (mig. 158)
- Mancanti: ISO 14555 (testo MD/PDF) → backlog da_richiedere; processi 4063 stud
- Si parte su: STUD-1 campi UI/DB/schema senza inventare range 14555
```

## Richiesta norma (HITL) — resta aperta per STUD-3

- **Codice / titolo**: UNI EN ISO 14555 (Arc stud welding of metallic materials)
- **Edizione desiderata**: vigente UNI/EN
- **Serve a** (modulo / slice): WPQR Stud Welding — STUD-3 (range di validità)
- **Cosa c’è già in repo**: solo citazione in `NORMA_00008` (3834-5); nessun MD/PDF 14555
- **Cosa NON inventiamo senza PDF**: soglie, clausole, range di validità stud, variabili essenziali 14555
- **Perimetro chiuso in STUD-1**: campi + doppio materiale + P+T su 15614-1 + verbale Mason 001P-21
- **Formato utile**: PDF → skill `pdf-to-json`
- **Dopo digitalizzazione**: aggiornare `NORME_MANCANTI_BACKLOG.md` → STUD-3

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
