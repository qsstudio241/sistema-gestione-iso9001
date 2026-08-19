# Piano slice — Lettura visiva → WPQR / patentino

> **Destinazione**: l’operatore ritaglia un disegno nell’Assistente; il sistema propone **candidati** WPQR e patentini già in anagrafica (stesso Ambito), con disclaimer visibile. Il VLM descrive e riempie slot; **non** dice «siete coperti». Il verdetto numerico resta `wpsGenerator.service.js` + `qualificationCoverage.js`. Un umano conferma.
> **Spec / ADR**: [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) (AI cita, non certifica) · MR-5 VLM locale · ISO 15614-1 già in `wpsGenerator.service.js` · ISO 9606 in `qualificationCoverage.js`
> **Brief pronto**: [`DEPUTYTASK_FIGURE_WPQR.md`](DEPUTYTASK_FIGURE_WPQR.md) — slice **FW-0**. **Non** APERTO: lanciare solo dopo merge MR-5.
> **Mappa creata**: 19/08/2026 (Lead wayfinder A — Chart the map; nessuna implementazione in questa sessione)
> **Dipende da**: Multimodal RAG MR-5 mergiato

---

## Fuori scope

- Far dire al VLM «sì/no siete qualificati» o certificare WPQR/patentino/WPS
- Secondo motore di copertura (i numeri restano in `wpsGenerator` / `qualificationCoverage`)
- Parser CAD (DWG/DXF)
- Gemini / cloud sui PNG
- Inventare soglie ISO non presenti in Markdown/codice
- Nuova pagina prodotto o layout parallelo all’Assistente
- Scrittura WPQR/WPS/qualifica senza conferma umana
- Mix multi-tenant (org/azienda come oggi)

---

## Non ancora specificato

- Se gli slot visivi arrivano solo dal VLM o anche dal catalogo `weldingSymbols2553.js` (codice simbolo → processo/giunto)
- Se i candidati restano solo in chat o compaiono anche in Procedure di Saldatura
- Soglia di confidenza sotto la quale non si chiama il motore numerico (si misura dopo FW-0)
- Se salvare «proposta vs conferma umana» in `ai_interactions` oltre al log già previsto

---

## Decisioni già prese

- **Riuso, non fork**: `generateWpsFromWpqr` + `loadWpqrRecords` + `computeQualificationCoverage`
- **VLM = ipotesi, motore = numeri**: JSON slot (giunto, processo, spessori se letti, posizione) + testo; mai un booleano di copertura dal modello
- **Stesso Ambito**: `organization_id` dal JWT + `companyId` come MR-5
- **HITL**: l’operatore conferma; l’AI non scrive anagrafiche
- **Dopo MR-5**: niente codice finché `search-by-image` con `reply` è in `main`

---

## Gap vs funzione attesa

| Aspetto | Oggi | Atteso | Slice |
|---------|------|--------|-------|
| Lettura ritaglio | MR-5: testo + tavole citate, disclaimer | Stesso testo **più** JSON slot parsato | **FW-0** |
| Candidati WPQR | Assistente WPS a domande (`generateWpsFromWpqr`) | Stesso motore, input da slot visivi + domande se manca spessore/materiale | **FW-1** |
| Patentino | `qualificationCoverage` vs WPS | Stesso calcolo sui candidati, non sul VLM | **FW-2** |
| UI | Card tavole + testo | Stesso pannello: lista candidati + disclaimer; niente pagina nuova | **FW-3** |

---

## Mappa slice

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo |
|-------|------|------------------------|------------|------|
| **FW-0** | Schema slot visivi + parse VLM (niente WPQR) | `figureVlm.service.js` (JSON nello stesso prompt) + parser testato; risposta `{ reply, slots }` | MR-5 mergiato | AFK |
| **FW-1** | Slot → candidati WPQR | Controller search-by-image chiama `generateWpsFromWpqr` se slot minimi; `need_input` se manca spessore/materiale | FW-0 | AFK |
| **FW-2** | Candidati patentino | `qualificationCoverage.js` sui WPS/WPQR candidati; stesso org/azienda | FW-1 | AFK |
| **FW-3** | UI candidati in Assistente | `AiAssistantPage.jsx` + pannello citazioni esistente; disclaimer visibile | FW-1 | AFK |

**Ordine**: FW-0 → FW-1 → poi FW-2 e FW-3 possono parallellizzarsi (file BE vs FE disgiunti).

**Hello world (FW-0)**: dato un `reply` VLM di prova, esce un oggetto `slots` `{ joint_type?, welding_process?, thickness_a_mm?, thickness_b_mm?, position? }` o `slots: null` se il testo non è strutturabile — senza toccare il DB saldatura.

---

## Allineamento harness

- Una slice = un Cloud Agent. Non eseguire FW-1 nella stessa run di FW-0.
- Deputy: context default/basso. Solo `DEPUTYTASK_FIGURE_WPQR.md` + file della slice.
- Se la slice non chiude: `HANDOFF_TEMPLATE.md` nel brief, stop.
