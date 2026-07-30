# DEPUTYTASK1 — P2 Export Word WPS (modulo ISO 15609-1 Annex A)

**Stato:** APERTO  
**Priorità:** P2 — chiude il giro Mason (genera → bozza → **documento stampabile/archiviabile**)  
**Branch base:** `main` (P0+P1 già mergiati: #326 / #328)  
**Branch consigliato:** `cursor/wps-export-word-annex-a-<suffix>`  
**Creato da:** Lead 30/07/2026  
**Spec:** [MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md](../specs/MODULO_WPS_GENERAZIONE_SCOPO_E_ROADMAP.md) · [ISO-15609-WPS-contenuto.md](../reference/ISO-15609-WPS-contenuto.md)  
**Norma:** ISO 15609-1:2019 **Annex A** (formato WPS informativo; *«The user of this form is allowed to copy this form»*) — digitalizzato `docs/Normative/Normative NORMA_00014_ UNI EN ISO 15609-1_2019 Rev. 0.md` (Annex A poco leggibile nel PDF → ricostruire layout da §4 + etichette Annex note)

> **Allineamento Git (autonomo)**: `git fetch origin main` + `git pull origin main`. Verificare su `origin/main` che questo file abbia `Stato: APERTO`.

---

## Perché (prodotto)

Senza Word, Mason genera e salva la bozza in app ma **non ha un modulo da firmare / consegnare / archiviare**. Il giro operativo è incompleto. Annex A è il riferimento corretto (non un layout inventato).

---

## Scope v1 (obbligatorio)

1. **Template Word** ispirato ad Annex A 15609-1 (arco), in italiano dove ha senso per Mason, con:
   - intestazione: WPS n°, WPQR n°, produttore/azienda, revisione, data
   - materiali / spessori / giunto / processo / posizioni / filler / gas / Tp / Ti / heat input / corrente-tensione se presenti
   - area sketch giunto / sequenza passate (può restare vuota o placeholder «(da allegare)»)
   - tabella passate (righe vuote o 1 riga se non abbiamo dettaglio run)
   - firma produttore (nome, data, spazio firma)
2. **Export FE** da riga/dettaglio WPS: pulsante **«Esporta Word»** → download `.docx`.
3. **Mapping dati** da record `welding_procedures` (+ WPQR collegata se disponibile): riempire ciò che c’è; lasciare **vuoto** il resto (non inventare parametri).
4. **Test L1**: generazione blob OOXML valida + placeholder sostituiti sui campi noti (caso Mason minimo).
5. Aggiornare spec (P2 ✅ v1) + `DEPUTYTASK1` CHIUSO + riga GUIDA.

### Approccio tecnico consigliato (scegliere uno, non entrambi)

| Opzione | Quando |
|---------|--------|
| **A — Programmatico** (`docx` come `wordExportSal.js`) | Preferita se non serve editabilità del template da non-dev |
| **B — Template + docxtemplater** (`app/public/templates/wps-15609-annex-a.docx`) | Preferita se Mason dovrà ritoccare il layout in Word Offline |

**Consiglio Lead:** **A** per v1 (rapido, ripetibile, niente file binario fragile), layout chiaro a sezioni Annex A. Se il template `.docx` è più naturale per voi, B è accettabile: generare il file con uno script tipo `generateNcTemplate.js` e commitare sotto `app/public/templates/`.

**Niente migrazione DB** in v1.  
**Niente backend obbligatorio** se tutti i campi sono già nel client (`getWPS` / lista): export solo FE = merge più semplice. Se serve join WPQR lato server, aggiungere `GET /welding/wps/:id/export-data` minimo (allora conferma merge backend).

---

## Cosa NON fare in v1

- Non deprecare/nascondere `WpsUploadButton` (resta P2b / backlog).
- Non implementare 15609-2 (gas) separato — se processo 311, riusare stesso modulo con campi gas vuoti/NA.
- Non copiare testo normativo protetto oltre le **etichette** del form Annex A (già dichiarato copiabile).
- Non richiedere sketch obbligatorio né firma elettronica.
- Non allargare schema DB per tutti i campi Annex A (v2 futuro).

---

## Campi da mappare (priorità)

| Sezione Annex A / §4 | Sorgente tipica oggi | Se assente |
|----------------------|----------------------|------------|
| WPS No. | `wps_code` + `revision` | — obbligatorio |
| WPQR No. | `qualification_standard` / `wpqr_ref` / join WPQR | vuoto + nota |
| Manufacturer | nome azienda Ambito / company | vuoto |
| Parent material / group | `material_group` | vuoto |
| Thickness | `thickness_range_min` / `max` | vuoto |
| Joint type | `joint_type` | vuoto |
| Welding process | `welding_process` (4063) | vuoto |
| Position | `position` | vuoto |
| Filler | `filler_material` | vuoto |
| Shielding gas | `shielding_gas` | vuoto |
| Preheat / interpass / heat input / current / voltage | se colonne esistono sul record | vuoto |
| Sketch / run table | — | riquadro vuoto / tabella 3–5 righe vuote |
| Signature | — | riga firma |

Footer discreto: «Modulo ispirato a ISO 15609-1 Annex A (informativo) — SystemGest».

---

## UI

- Tab WPS, su ogni riga (o nel form Modifica): pulsante **«Esporta Word»** / icona download.
- Feedback: download immediato; se WPS incompleta → comunque export (campi vuoti), nessun blocco.
- Encoding: accenti italiani corretti; niente `\u` grezzi in JSX.

---

## Test DoD

- [ ] Vitest: export produce ZIP OOXML (`word/document.xml` contiene codice WPS di fixture)
- [ ] `npm run build` in `app/` OK
- [ ] Caso Mason: WPS bozza con FW/S355/S235 → Word scaricabile con codice + giunto + materiali/spessori se presenti
- [ ] Spec + DEPUTYTASK1 CHIUSO + GUIDA (1 riga)
- [ ] Se solo FE: merge autonomo dopo CI verde; se tocca backend: chiedere conferma merge

---

## Fuori DoD (P2b / v2)

- Nascondere upload batch WPS come flusso primario
- Campi Annex A aggiuntivi in DB/form
- Export WPQR (altro modulo)
- Sketch da allegato immagine nel Word

---

## Riferimenti codice

| Asset | Path |
|-------|------|
| UI WPS | `app/src/pages/WeldingProceduresPage.jsx` |
| Pattern export SAL | `app/src/utils/wordExportSal.js` |
| Pattern template NC | `app/scripts/generateNcTemplate.js` + `wordExport` NC |
| Estratto 15609 | `docs/reference/ISO-15609-WPS-contenuto.md` |

---

## Comando deputy

```
Leggi docs/agent-tasks/DEPUTYTASK1.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
