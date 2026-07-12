# Piano slice — Cataloghi riferimento normativi per ingest saldatura

> **Stato**: RC-1/RC-2 in corso (luglio 2026)  
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
| RC-1 | ISO 4063 | `welding_process` | `ISO-4063-processi-saldatura.md` | `weldingProcesses4063.js` | 🔄 |
| RC-2 | ISO 6947 | `welding_positions` | `ISO-6947-posizioni-saldatura.md` | `weldingPositions6947.js` | 🔄 |
| RC-3 | ISO 14175 | `shielding_gas` | `ISO-14175-gas-protezione.md` | `shieldingGases14175.js` | ⏳ |
| RC-4 | ISO 14343 / 18274 | `filler_material_group` | `ISO-FM-gruppi-apporto.md` | `fillerMaterialGroups.js` | ⏳ |
| RC-5 | ISO 9606-1 | designazione, range validità, date | `ISO-9606-1-qualifica-saldatore.md` | `iso9606QualificationRules.js` | ⏳ |
| RC-6 | ISO 15614-1 | campi WPQR | `ISO-15614-1-wpqr-campi.md` | (estensione schema + regex) | ⏳ |
| RC-7 | ISO 9712 | cert NDT (metodo/livello) | `ISO-9712-ndt.md` | `ndtMethods9712.js` | ⏳ backlog |

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

### RC-5 — ISO 9606-1 (regole qualifica)

Range spessore/diametro da prova, validità 2/3 anni, conferma semestrale, parsing designazione `141 P BW FM1 t10`.

### RC-6 — WPQR ISO 15614-1

Allineare schema AI ai campi `wpqr_records`; utile avere `UNI EN ISO 15614-1_2019.pdf` → md operativo.

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

**Prossima slice attiva**: RC-1 + RC-2 (processi + posizioni).
