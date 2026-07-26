# Piano slice — Cataloghi riferimento normativi per ingest saldatura

> **Stato**: RC-0/RC-1/RC-2 ✅ mergiati (PR #213, #248). RC-3 gas ✅ · RC-5/RC-6 parziali (GAP documentati). RC-8 ✅ (17/07/2026, ISO 14732). RC-9 temperature ✅ (ISO 13916). RC-10 WPS contenuto ✅ (ISO 15609-1/-2, 25/07/2026). RC-11 fili ISO 14341 ✅ (26/07/2026).  
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
| RC-3 | ISO 14175 | `shielding_gas` | `ISO-14175-gas-protezione.md` | `shieldingGases14175.js` | ✅ (25/07/2026) |
| RC-4 | ISO 14343 / 18274 | `filler_material_group` | `ISO-FM-gruppi-apporto.md` | `fillerMaterialGroups.js` | ⏳ |
| RC-5 | ISO 9606-1 | designazione, range validità, date | `ISO-9606-1-range-validita-patentino.md` | `weldingQualificationRules9606.js` | 🔶 parziale (vedi nota) |
| RC-6 | ISO 15614-1 | campi WPQR | `ISO-15614-1-range-validita-WPQR.md` | non codificato (solo doc, vedi nota) | 🔶 parziale (vedi nota) |
| RC-7 | ISO 9712 | cert NDT (metodo/livello) | `ISO-9712-ndt.md` | `ndtMethods9712.js` | ⏳ backlog |
| RC-8 | ISO 14732 | `qualifica_14732` (validità operatori) | `ISO-14732-operatori-saldatura.md` | schema arricchito in `documentTypeSchemas.js` (no catalogo dedicato) | ✅ |
| RC-9 | ISO 13916 | `preheat_temp` / `interpass_temp` | `ISO-13916-temperature-saldatura.md` | `weldingTemperatures13916.js` (solo prompt/regole) | ✅ (25/07/2026) |
| RC-10 | ISO 15609-1/-2 | contenuto WPS (variabili §4) | `ISO-15609-WPS-contenuto.md` | solo schema/prompt (no catalogo simboli) | ✅ (25/07/2026) |
| RC-11 | ISO 14341 | `filler_material` (designazione filo GMAW) | `ISO-14341-consumabili-filo.md` | `fillerWire14341.js` (solo prompt/regole) | ✅ (26/07/2026) |

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

### RC-3 — Gas ISO 14175 — ✅ 25/07/2026

Fonte: PDF ISO 14175:2008 (PDF→MD→JSON locale). Digitalizzazione completa in
`docs/Normative/Normative NORMA_00012_ UNI EN ISO 14175_2008 Rev. 0.md` (+ `.json`).
**Non** aggiunta a `import-norms-from-markdown.js` (catalogo classificazione, non SGQ).

**DoD**

- [x] Estratto `docs/reference/ISO-14175-gas-protezione.md`
- [x] `shieldingGases14175.js` (app + backend) + test L1
- [x] Prompt ingest `buildShieldingGasPromptSection` in `importAiExtraction.service.js` (patentino/WPS/WPQR)
- [x] Hint/schema `shielding_gas` in `documentTypeSchemas` (patentino + WPS)
- [ ] Select UI dedicata su `QualificationForm` (opzionale: oggi text + placeholder)

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

### RC-8 — ISO 14732 (operatori/preparatori saldatura automatica/meccanizzata) — ✅ 17/07/2026

Fonte: PDF **scansionato** (nessun livello testo) fornito dal committente, convertito con OCR locale Tesseract 5.4 (installato per l'occasione, pacchetto lingua italiana incluso — mai dati caricati su cloud). Qualità ottima sulle clausole normative (28/28 pagine con testo utile), rumore solo su copertina/copyright.

Risolve punto 4 del feedback Studio Mason: "operatori 6" = rivalidazione ISO 14732 opzione a) ogni **6 anni** (contro 3 anni di ISO 9606-1 per saldatori manuali) — non un errore di battitura del cliente.

**DoD**

- [x] Estratto `docs/reference/ISO-14732-operatori-saldatura.md` (metodi qualificazione §4.1, variabili essenziali automatico/meccanizzato §4.2.2/4.2.3, validità §5 con differenze vs 9606-1, bibliografia ufficiale §2)
- [x] Schema `qualifica_14732` arricchito (app + backend `documentTypeSchemas.js`): da 6 campi stub a schema completo (ente, tipo saldatura, processo, posizioni, conferma/rivalidazione, metodo qualificazione)
- [x] Fix bug `qualifica_operatore` → `qualifica_14732` in `importAiExtraction.service.js` (il doc type reale non riceveva mai la sezione prompt processo/posizioni)
- [x] `qualifica_14732` aggiunto a `SUPPORTED_DOC_TYPES` in `documentIngestPipeline.service.js` (gap: la pipeline unificata regole+AI+confidenza non copriva questo tipo documento)
- [x] Extractor euristico `extractQualifica14732Fields` in `ruleFieldExtractors.js` (fallback/cross-check, riusa utility esistenti)
- [x] Hint `expiry_date` di `patentino_saldatore` corretto (non più genericamente "6 mesi operatori": ora distingue 3/2 anni saldatori vs 6/3 anni operatori)

**Non in scope (per decisione prodotto futura)**: integrazione `qualifica_14732` nella tabella `qualifications` con alert/conferma semestrale/scadenzario come già fatto per `patentino_saldatore` (ADR pattern "Anagrafica personale ↔ qualifiche") — oggi resta nel registro documentale generico. Da valutare se il cliente userà in volume questo tipo di certificato.

### RC-9 — Temperature ISO 13916 — ✅ 25/07/2026

Fonte: PDF BS EN ISO 13916:2025 (PDF→MD→JSON locale). Digitalizzazione in
`docs/Normative/Normative NORMA_00013_ UNI EN ISO 13916_2025 Rev. 0.md` (+ `.json` revisionato).
**Non** in `import-norms-from-markdown.js` (norma di misura, non SGQ a clausole).

Complementa campi già presenti in WPS/libro saldatura (`preheat_temp` / `interpass_temp`).
Non è un catalogo di simboli discreti come 14175: modulo JS = solo costanti Tp/Ti/Tm + codici attrezzatura + prompt AI.

**DoD**

- [x] Estratto `docs/reference/ISO-13916-temperature-saldatura.md`
- [x] `weldingTemperatures13916.js` (app + backend) + test L1
- [x] Prompt ingest `buildWeldingTemperaturePromptSection` in `importAiExtraction.service.js` (WPS/WPQR)
- [x] Campi `preheat_temp` / `interpass_temp` in schema AI WPS (app + backend) e WPQR (backend)
- [ ] Select UI dedicata (non necessaria: campi testo libero °C)

### RC-10 — Contenuto WPS ISO 15609-1/-2 — ✅ 25/07/2026

Fonte: PDF BS EN ISO 15609-1:2019 (arco) e 15609-2:2019 (gas), PDF→MD→JSON locale.
Digitalizzazione: `docs/Normative/Normative NORMA_00014_ UNI EN ISO 15609-1_2019 Rev. 0.*`
e `…NORMA_00015…15609-2…` (00013 riservato a ISO 13916).
**Non** in `import-norms-from-markdown.js` (checklist contenuto WPS, non SGQ a clausole).

Allinea lo schema ingest `wps` alle variabili §4 (processo, materiale/gruppo, spessore/OD,
posizioni, consumabile, gas 14175, Tp/Ti, heat input / parametri fiamma). Nessun catalogo JS
di simboli: riusa RC-1/2/3/9.

**DoD**

- [x] Estratto unico `docs/reference/ISO-15609-WPS-contenuto.md` (sezioni Parte 1 / Parte 2)
- [x] Schema AI + campi form WPS arricchiti in `documentTypeSchemas.js` (app + backend)
- [x] Mapping review `wpsIngest.service.js` per i nuovi campi estratti
- [ ] Select UI dedicate (opzionale: text + cataloghi già esistenti per processo/posizione/gas)

### RC-11 — Consumabili filo ISO 14341 — ✅ 26/07/2026

Fonte: PDF ISO 14341:2020 (PDF→MD→JSON locale). Digitalizzazione in
`docs/Normative/Normative NORMA_00016_ UNI EN ISO 14341_2020 Rev. 0.md` (+ `.json`).
**Non** in `import-norms-from-markdown.js` (catalogo classificazione, non SGQ).

Campo ingest: `filler_material` (designazione tipo `G 42 4 M21 3Si1`).
**Non** è un catalogo di simboli discreti chiusi come 14175: le combinazioni resistenza×impatto×gas×chimica sono troppe.
Modulo JS = struttura designazione + esempi §11 + prompt AI (pattern RC-9).
Distinto da RC-4 (`filler_material_group` FM1–FM6).

**DoD**

- [x] Estratto `docs/reference/ISO-14341-consumabili-filo.md`
- [x] `fillerWire14341.js` (app + backend) + test L1
- [x] Prompt ingest `buildFillerWire14341PromptSection` in `importAiExtraction.service.js` (WPS/WPQR)
- [x] Hint/schema `filler_material` in `documentTypeSchemas` (WPS/WPQR)
- [ ] Select UI dedicata (non necessaria: text libero + designazione)

**GAP**: Tabella 3A/3B composizione chimica parzialmente illeggibile nell’estrazione PDF — non inventare simboli oltre esempi §11.

---

## Feedback cliente reale — Studio Mason (16/07/2026)

Primo utilizzo in campo del modulo patentini saldatori (upload batch WQ). 6 punti di feedback, tutti risolti o proposti su branch `fix/feedback-studio-mason-patentini` (PR successiva a #249):

| # | Punto cliente | Stato | Fix |
|---|----------------|-------|-----|
| 1 | ODC mancanti (TEC Eurolab, Sideius) | ✅ Risolto | Aggiunti a `issuing_body` select (`documentTypeSchemas.js`) + normalizzazione backend (`textEncodingRepair.js`) |
| 2 | Patentini reali riportano il gruppo padre (1, 8…), non solo il sottogruppo (1.2, 8.1) | ✅ Risolto | `materialGroups15608.js` (app+backend): aggiunte le opzioni di gruppo padre come selezionabili accanto ai sottogruppi (`PARENT_GROUP_ENTRIES`), senza rimuovere questi ultimi |
| 3 | Serve il simbolo ≥ per spessori/diametri senza limite superiore + precisione decimale | ✅ Risolto | `weldingDesignation.js` (app+backend) e `deriveRangeString` (`importJobs.controller.js`, `qualifications.controller.js`) mostrano "≥Xmm" quando è noto solo il minimo; il campo numerico UI accetta già decimali (`step="any"`) |
| 4 | Label "Data scadenza (2 anni da Esame)" errata per 9606-1 (3 anni, non 2) | ✅ Risolto | Label generica "Data di scadenza" in `documentTypeSchemas.js`, dettaglio norma spostato nell'hint |
| 5 | Auto-testo validità diametro per piastre in posizione rotante (≥500mm / ≥75mm) | 🟡 Proposta (non auto-fill DB) | Funzione advisory `describePlateOnlyRotatingPositionDiameterNote` in `weldingQualificationRules9606.js` (app+backend) + nota in `ISO-9606-1-range-validita-patentino.md` marcata **NON verificata su copia integrale norma, fonte: feedback cliente** — non si inseriscono valori numerici non confermati direttamente in automatico nel DB |
| 6 | "Errore Sconosciuto" su upload singola WQ | ✅ Rinforzato (non riproducibile senza il file originale) | Nuova utility `backend/src/utils/ingestErrorMessage.js` (`describeIngestFileError`) applicata a tutti i catch dei batch upload (qualifiche, WPQR, WPS, norme) + logging con stack trace in `documentIngestPipeline.service.js` |

**Lezione**: il feedback di un cliente reale in produzione è la fonte di verità più affidabile per i GAP normativi non ancora coperti (punto 2 sembrava in contraddizione con la regola scritta a mano in RC-0, ma il cliente ha ragione: ISO 9606-1 qualifica per gruppo intero, non per sottogruppo — la regola RC-0 valeva solo per il caso "sottogruppo noto e specifico", non doveva escludere il gruppo padre). **Azione futura**: quando si documenta una regola normativa in `docs/reference/*.md` dedotta solo da analisi di codice/norma senza controfirma di un caso reale, marcarla esplicitamente come "da confermare su campione reale" per evitare di bloccare opzioni valide nel form.

---

## File sorgente utili (Patrimonio / upload)

| File | Uso slice |
|------|-----------|
| `ISO-TR-15608-2013-Testo Inglese.md` | RC-0 ✅ |
| `UNI EN ISO 15614-1_2019.pdf` | RC-6 |
| ISO 9606-1 (edizione in vigore) | RC-5 |
| ISO 4063 / ISO 6947 / ISO 14175 | RC-1…RC-3 (estratti tabellari) |
| ISO 13916:2025 (temperature) | RC-9 ✅ |
| ISO 15609-1/-2:2019 (contenuto WPS) | RC-10 ✅ |
| ISO 14341:2020 (fili GMAW / filler_material) | RC-11 ✅ |

---

## Comando deputy (slice corrente)

```
Leggi docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md — esegui la prima slice ⏳.
Chiudi con TEST OK o FIX NON APPLICABILI.
```

**Prossima slice attiva**: RC-4 (gruppi apporto FM) o completamento GAP RC-5/RC-6 (Tabelle numeriche 9606-1/15614-1) se si procura una fonte più leggibile. RC-3 gas ✅ · RC-9 temperature ✅ · RC-10 WPS 15609 ✅ · RC-11 fili 14341 ✅.
