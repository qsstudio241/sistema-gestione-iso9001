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
  ISO 14555:2025 digitalizzata (`NORMA_00033`); estratto range STUD-3-A
  `docs/reference/ISO-14555-2025-range-validita-WPQR.md`
- Mancanti: catalogo 4063 stud solo se arriva fonte (HITL: niente 78x inventati; 4063 = indicazione processo)
- Coperte in codice: range §10.2.8 + Tabella 2 (STUD-3-B CHIUSO)
- Si parte su: STUD-2/3-A/3-B **CHIUSI**
```

## Richiesta norma (HITL) — **EVASA** 26/08/2026

- **Codice / titolo**: BS EN ISO 14555:2025 (Arc stud welding of metallic materials)
- **Stato**: `digitalizzata` → `NORMA_00033` (PDF **non** in Git)
- **Serve a**: STUD-3 range; STUD-1 chiuso senza range; STUD-3-A estratto fatto (HITL prima del codice)
- **Cosa NON inventiamo senza HITL sull'estratto**: soglie ancora GAP (Tabella 1, B.1 formule, §10.2.8.5 a)
- **Perimetro chiuso in STUD-1**: campi + doppio materiale + P+T su 15614-1 + verbale Mason 001P-21
- **STUD-3-B:** eseguito 29/08 — range §10.2.8 + Tabella 2 in codice (`weldingQualificationRules14555`).

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

**Backlog residuo (29/08 — STUD-3-B CHIUSO):**

| Slice | Slot | Scope |
|-------|------|--------|
| **STUD-2** | [`DEPUTYTASK.md`](DEPUTYTASK.md) **CHIUSO — TEST OK** [#590](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/590) | Ingest AI SW / P+T / PM2 / qualifying_element (no range) |
| **STUD-3-A** | [`DEPUTYTASK1.md`](DEPUTYTASK1.md) **CHIUSO — TEST OK** [#589](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/589) | Estratto docs [`ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md) |
| **STUD-3-B** | [`DEPUTYTASK.md`](DEPUTYTASK.md) **CHIUSO — TEST OK** 29/08 | Codifica range §10.2.8 + accettazione boiler pins Tabella 2 (8→40, 10→60, 12→85 Nm; §12.3 OR Table 2). 4063 = solo indicazione processo (niente 78x inventati) |
| PT-1 | opzionale | UX range lato P vs T (15614) |

Cloud Agent **non** dichiara «pronta» senza CI + Bugbot + Security Review letti.
