# Piano slice — Cataloghi riferimento normativi per ingest saldatura

> **Stato**: RC-0/RC-1/RC-2 ✅ mergiati (PR #213, #248). RC-5/RC-6 parziali (luglio 2026, vedi sotto) — GAP documentati, non risolti forzando dati.  
> **Obiettivo**: estratti operativi da norme tecniche → `docs/reference/*.md` + cataloghi JS → prompt AI, regex, select UI.  
> **Pattern di riferimento**: slice ISO/TR 15608 (chat `bc-a539`, PR catalogo 15608, `materialGroups15608.js`).  
> **Complementa**: [PLAN_INGEST_LEARNING_SLICES.md](PLAN_INGEST_LEARNING_SLICES.md) (IG-1…IG-6 ✅), [ADR-017](../adr/ADR-017-ingest-reference-network.md) (Livello A).

---

## Perché servono

L'ingest patentini/WPQR/WPS usa campi codificati (processo, posizione, gas, gruppo materiale, …). Senza cataloghi strutturati l'AI:

- confonde sigle simili (es. `136` vs `135`, `PA` vs `PE`);
- non normalizza alias da certificati (MIG/MAG/TIG → codice ISO 4063);
- perde campi perché le regex coprono solo un sottoinsieme hardcoded.

**Regola**: ogni catalogo = **guida `.md`** (italiano, senza testo integrale protetto) + **modulo JS** (app + backend mirror) + hook in `importAiExtraction` / `ruleFieldExtractors` / `documentTypeSchemas`.

---

## Inventario

| ID | Norma | Campo ingest | Guida `.md` | Catalogo JS | Stato |
|----|-------|--------------|-------------|-------------|-------|
| RC-0 | ISO/TR 15608:2013 | `material_group` | `ISO-TR-15608-gruppi-materiali.md` | `materialGroups15608.js` | ✅ |
| RC-1 | ISO 4063 | `welding_process` | `ISO-4063-processi-saldatura.md` | `weldingProcesses4063.js` | ✅ |
| RC-2 | ISO 6947 | `welding_positions` | `ISO-6947-posizioni-saldatura.md` | `weldingPositions6947.js` | ✅ |
| RC-3 | ISO 14175 | `shielding_gas` | `ISO-14175-gas-protezione.md` | `shieldingGases14175.js` | ⏳ |
| RC-4 | ISO 14343 / 18274 | `filler_material_group` | `ISO-FM-gruppi-apporto.md` | `fillerMaterialGroups.js` | ⏳ |
| RC-5 | ISO 9606-1 | designazione, range validità, date | `ISO-9606-1-range-validita-patentino.md` | `weldingQualificationRules9606.js` | 🔶 parziale (vedi nota) |
| RC-6 | ISO 15614-1 | campi WPQR | `ISO-15614-1-range-validita-WPQR.md` | non codificato (solo doc, vedi nota) | 🔶 parziale (vedi nota) |
| RC-7 | ISO 9712 | cert NDT (metodo/livello) | `ISO-9712-ndt.md` | `ndtMethods9712.js` | ⏳ backlog |

### Nota RC-5/RC-6 (luglio 2026) — parziale per motivi di qualità fonte, non di tempo

Fonte: PDF reali (`UNI EN ISO 9606-1_2017.pdf`, `BS EN ISO 15614-1-2017...pdf`) convertiti con `pdf_to_json`. **9606-1** ha un font "anti-copia" che corrompe sistematicamente il testo (lezione + fix riutilizzabile in `GUIDA_CONSOLIDATA.md` → `repairFontSubstitutionArtifacts`); **15614-1** ha testo pulito ma layout a due colonne che l'estrazione a volte interfoglia. Risultato:

- **Fatto e verificato**: designazione qualifica (già in `weldingDesignation.js`), conferma semestrale + opzioni rivalidazione (§9), range diametro tubo ISO 9606-1 Tabella 7 (**codificato** in `weldingQualificationRules9606.js::computeQualifiedPipeDiameterRange`), riga t<3 Tabella 8 giunti d'angolo, livelli 1/2 ISO 15614-1 e regola "Level 2 qualifica anche Level 1".
- **GAP volontario (non inventato)**: Tabella 6 ISO 9606-1 (spessore giunti testa a testa — la più usata), matrice posizioni Tabelle 9/10, matrici compatibilità gruppi materiale ISO 15614-1 Tabella 5/6. Documentati come "verifica manuale su copia integrale" nei due estratti `docs/reference/ISO-9606-1-range-validita-patentino.md` e `ISO-15614-1-range-validita-WPQR.md`.
- **Prossimo passo se si vuole chiudere il gap**: procurarsi una copia leggibile (no font anti-copia) o eseguire OCR sulle pagine tabellari specifiche (poche pagine, non l'intero documento) e trascrivere a mano le 2-3 tabelle numeriche mancanti.

---

## Workflow per ogni slice (ripetibile)

1. **Fonte**: PDF o `.md` grezzo dal Patrimonio Studio (upload utente) oppure estratto operativo da norma già in `docs/Normative/`.
2. **Mai** committare testo integrale ISO/UNI con copyright — solo tabelle codici, regole estrazione, alias.
3. Scrivere `docs/reference/ISO-XXX-….md` (regole AI in tabella).
4. Creare `app/src/data/<catalog>.js` + copia `backend/src/data/<catalog>.js`.
5. Test Vitest/Jest: normalizzazione codici, alias, prompt section non vuota.
6. Collegare:
   - `documentTypeSchemas.js` — options select da catalogo;
   - `ruleFieldExtractors.js` — regex da lista codici;
   - `importAiExtraction.service.js` — `build*PromptSection()` nel system prompt;
   - `deploy-manifest.json` se nuovi file backend.
7. Riga in `GUIDA_CONSOLIDATA.md` (Esperienza) al merge.

**Tool conversione PDF→md**: skill `pdf-to-json` / `backend/scripts/pdf_to_json/` (revisione umana del `.md` prima del commit).

---

## Slice sequenziali

### RC-1 — Processi ISO 4063

**DoD**

- [ ] Catalogo ≥ 15 processi comuni (111, 121, 131, 135, 136, 138, 141, 145, 311, …)
- [ ] Alias: MIG→135, MAG→135/136, TIG→141, MMA→111, SAW→121
- [ ] `extractWeldingProcess` usa catalogo (non array hardcoded)
- [ ] Prompt ingest patentini/WPS/WPQR include sezione processi

### RC-2 — Posizioni ISO 6947

**DoD**

- [ ] Catalogo PA…PG + H-L045 / J-L045 + varianti tubo
- [ ] `extractWeldingPositions` in ruleFieldExtractors
- [ ] Select/multiselect patentini da catalogo
- [ ] Prompt ingest con regole posizione (maiuscolo, array)

### RC-3 — Gas ISO 14175

Richiede fonte `.md` o PDF revisionato (M21, I1, C1, …).

### RC-4 — Gruppi apporto FM1–FM6

Collegamento a ISO 14343 (acciaio) / 18274 (alluminio).

### RC-5 — ISO 9606-1 (regole qualifica) — 🔶 parziale

Range spessore/diametro da prova, validità, conferma semestrale, parsing designazione `141 P BW FM1 t10`.

**DoD**

- [x] Estratto `docs/reference/ISO-9606-1-range-validita-patentino.md` (validità §9, designazione §11, continuità processi, range diametro tubo)
- [x] `weldingQualificationRules9606.js` (app+backend): `computeQualifiedPipeDiameterRange`, `computeQualifiedFilletThicknessRange` (solo riga t<3 verificata)
- [x] Prompt AI patentino (`importAiExtraction.service.js`) — sezione regole 9606
- [ ] Range spessore giunti testa a testa (Tabella 6) — **GAP**, richiede fonte più leggibile
- [ ] Matrice posizioni qualificate (Tabelle 9/10) — **GAP**

### RC-6 — WPQR ISO 15614-1 — 🔶 parziale

Allineare schema AI ai campi `wpqr_records`.

**DoD**

- [x] Estratto `docs/reference/ISO-15614-1-range-validita-WPQR.md` (Level 1/2, range spessore Tabella 7/8 con avviso di verifica, campi essenziali WPQR)
- [ ] Codifica JS delle regole (non fatta: valori Tabella 7/8 hanno confidenza media, serve verifica umana prima di trasformarli in logica automatica — vedi avviso nell'estratto)
- [ ] Matrice compatibilità gruppi materiale (Tabella 5/6) — **GAP**

---

## File sorgente utili (Patrimonio / upload)

| File | Uso slice |
|------|-----------|
| `ISO-TR-15608-2013-Testo Inglese.md` | RC-0 ✅ |
| `UNI EN ISO 15614-1_2019.pdf` | RC-6 |
| ISO 9606-1 (edizione in vigore) | RC-5 |
| ISO 4063 / ISO 6947 / ISO 14175 | RC-1…RC-3 (estratti tabellari) |

---

## Comando deputy (slice corrente)

```
Leggi docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md — esegui la prima slice ⏳.
Chiudi con TEST OK o FIX NON APPLICABILI.
```

**Prossima slice attiva**: RC-3 (gas ISO 14175) o completamento GAP RC-5/RC-6 (Tabelle numeriche 9606-1/15614-1) se si procura una fonte più leggibile.
