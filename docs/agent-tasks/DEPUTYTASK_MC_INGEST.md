# DEPUTYTASK — Material Compliance ingest (MC-I3)

**Stato:** CHIUSO — TEST OK  
**Aperto:** 19/08/2026 (dopo merge hub MC-I2 [#487](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/487))  
**Chiuso:** 19/08/2026  
**Piano:** [`PLAN_MATERIAL_COMPLIANCE_SLICES.md`](PLAN_MATERIAL_COMPLIANCE_SLICES.md) § MC-I3  
**Spec:** [`MATERIAL_COMPLIANCE_DATA_MODEL.md`](../specs/MATERIAL_COMPLIANCE_DATA_MODEL.md) — DDT = colonne sul certificato, niente anagrafica DDT  
**Rischio:** Medio — classifica extract + gate Valuta; nessuna migrazione; Cloud **non** mergia  
**Stream:** stesso file epic ingest. **Non** sovrascrivere `DEPUTYTASK.md` (SAL S1a CHIUSO).

---

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: EN 10168 = layout del certificato mill; ddt_no/ddt_date già colonne; DDT non è un codice 10168
- Mancanti: schema normativo del DDT (non serve: è bolla, non 3.1)
- Si parte su: classificare il PDF (DDT vs mill) + non copiare colata/norma dal testo della merce; skip split (MC-I4), skip few-shot
```

## Slice unica: MC-I3 — DDT ≠ 3.1

### Obiettivo

Un DDT non è un certificato 3.1. Demo: upload/Estrai su `D.D.T._n._000775RE_…pdf` → n. DDT in colonna, **JSON mill vuoto** (niente colata/norma inventate). Valuta non parte sul DDT.

### Esito

- `document_kind` in JSON (`delivery_note` | `mill_certificate`); filename `D.D.T.`/`bolla` vince sull'AI; `CERTIFICATO`/`3.1` nel nome resta mill
- Sanitize mill a NULL + SQL `SET` se DDT (non solo `COALESCE`)
- Valuta HTTP 409 `NOT_A_CERTIFICATE`; UI: pulsante Valuta visibile, `disabled` + title
- L1: controller 38, filtri + pagina Materiali

### Non toccare (invariato)

- Split busta (MC-I4), `ocrExtractor`, Rule Engine soglie, ISO-4, `DEPUTYTASK.md`
- Niente tabella DDT; il ponte verso le righe mill resta `ddt_no` quando il 3.1 lo stampa (MC-I2)

### DoD

- [x] L1 verdi
- [x] Brief CHIUSO TEST OK
- [x] PR draft; Cloud non mergia

**Dopo merge:** deploy backend, poi Estrai di nuovo su azienda 179 **id 7** (DDT `000775RE`), non id 6. Prossima ingest: **MC-I4**.
