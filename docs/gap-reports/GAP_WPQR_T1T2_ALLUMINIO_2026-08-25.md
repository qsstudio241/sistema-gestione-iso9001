# Gap analysis — WPQR: doppi range t1/t2 (FW) + norma alluminio

| Campo | Valore |
|-------|--------|
| **Data** | 2026-08-25 |
| **Modulo** | Saldatura / WPQR (ingest + form + generatore WPS) |
| **Standard** | ISO 15614-1:2017 (acciaio); ISO 15614-2 (alluminio WPQR, **manca in repo**); ISO 9606-2 (patentino alluminio, **manca testo MD**) |
| **Scope** | Segnalazione Mason: (1) giunti angolo con spessori diversi t1/t2; (2) selezione norma UNI EN ISO 9606-2 su WPQR alluminio |
| **Analista** | Cloud Agent (gap-analysis-normativa) |
| **Profondità** | completa su codice + norma 15614-1 presente; documentale su 15614-2 / 9606-2 |

## Dichiarazione fonti (obbligatoria)

| Tipo | Coperto | Mancante / limite |
|------|---------|-------------------|
| Contesto | `PROJECT_CONTEXT.md` (bussola WPQR), roadmap § moduli maturi | — |
| Norma WPQR acciaio | `docs/Normative/Normative NORMA_00019_ UNI EN ISO 15614-1_2017 Rev. 0.md` + estratto `docs/reference/ISO-15614-1-range-validita-WPQR.md` | Colonna Level 1 Tabella 7 già GAP noto |
| Norma WPQR alluminio | — | **ISO 15614-2** assente da `docs/Normative/` e da `SOURCE_PDF_INDEX.md` |
| Norma patentino alluminio | Solo citazioni (3834-5, ISO-TR-15608, ingest classifier) | **ISO 9606-2** assente come MD/JSON digitalizzato |
| Patentino acciaio | `NORMA_00018` ISO 9606-1 + `ISO-9606-1-range-validita-patentino.md` | — |
| Codice | schema `wpqr`, `wpqrIngest.service.js`, `wpsGenerator.service.js`, `WeldingProceduresPage.jsx`, `documentTypeSchemas.js` | — |
| Gap precedenti | `GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md` (range aperto FW, gola, piastra→tubo) | Non chiudeva i **due** range t1/t2 distinti |

**Nota tipografica segnalazione**: «ISO 9660-2» è un refuso (ISO 9660 = file system CD). Norma saldatura corretta: **ISO 9606-2**.

## Executive summary

- **Sì, entrambe le anomalie sono reali** e aggiornabili (non sono «impostazioni» di configurazione: servono campi DB + schema ingest + logica copertura WPS).
- **t1/t2**: la norma ISO 15614-1 Tabella 8 nota (a) impone di calcolare **separatamente** i range dei due spessori del provino se diversi; oggi il modello ha **un solo** `thickness_min`/`thickness_max` — nel caso Mason (t1 3–50 / t2 3–30) resta solo un range (tipicamente 3–30), perdendo il massimo di t1.
- **Alluminio**: su form WPQR la «Norma riferimento» è testo libero (si può scrivere a mano), ma **non** c’è regola/catalogo per ISO 15614-2 né motore range alluminio. ISO 9606-2 compare già nel menu dei **patentini saldatori**, non come standard di procedura WPQR. Per WPQR alluminio la norma di riferimento corretta è **ISO 15614-2**, non 9606-2.
- **Blocco documentale**: senza PDF/MD di **ISO 15614-2** e **ISO 9606-2** non si possono codificare tabelle range alluminio né verificare la fedeltà normativa — si può comunque fare la slice dati/UI t1/t2 su 15614-1 (acciaio) già in repo.

## Matrice gap

| Modulo | Clausola / requisito | Fonte | Stato app oggi | Gap | Tipo | Priorità | Evidenza |
|--------|----------------------|-------|----------------|-----|------|----------|----------|
| WPQR FW | Tabella 8 nota (a): con spessori diversi, range di **entrambi** i spessori del provino calcolati separatamente | NORMA_00019 §8.3.2.2 / Tabella 8 | Parziale — un solo pair min/max; warning FW se range assente | Non si memorizzano range t1 e t2 distinti; copertura WPS applica lo stesso range a entrambi i genitori | Funzionale + Normativo | **P0** | `wpqr_records.thickness_min/max`; `checkThicknessCoverage()`; schema `wpqr` fields |
| WPQR FW | Range materiale dichiarato sul verbale (es. t1 3–50, t2 3–30) | Verbale Mason + Annex B | Parziale — ingest/UI collassano in un range | Perdita dati sul massimo più alto | Funzionale | **P0** | screenshot revisione ingest; `documentTypeSchemas.js` wpqr |
| WPQR / WPS | Entrambi i genitori entro i limiti qualificati (§8.3.2) | NORMA_00019 §8.3.2 | Parziale — `thicknessA`/`thicknessB` vs **un** range | Con t1≠t2 il check può essere troppo stretto o troppo largo | Funzionale | **P0** | `wpsGenerator.service.js` `checkThicknessCoverage` |
| WPQR alluminio | Specifica/qualifica procedura alluminio | ISO 15614-2 (manca) | Assente (regole = solo 15614-1) | Nessun supporto normativo dedicato alluminio su WPQR | Documentale + Funzionale | **P1** | `SOURCE_PDF_INDEX.md`, assenza NORMA |
| Patentino alluminio | Qualifica saldatori Al | ISO 9606-2 (manca MD) | Parziale — tipo `iso9606_2` + opzione select; regole JS = 9606-1 | Menu sì, motore range alluminio no | Documentale + Funzionale | **P1** | `documentTypeSchemas.js` patentino; assenza `weldingQualificationRules9606_2` |
| Chiarimento UX | Norma su form WPQR | schema wpqr `standard_reference` type text | Implementato come testo libero | Mason chiede «selezione» 9606-2: su WPQR non c’è select chiuso; su patentino 9606-2 c’è già | Funzionale (UX) | P2 | `WeldingProceduresPage.jsx`, ingest schema |

## Dettaglio tecnico — anomalia 1 (t1 / t2)

### Cosa dice la norma (testo in repo)

ISO 15614-1:2017, Tabella 8 (Level 2), nota (a):

> *In case of different material thicknesses, the range of qualification of both thicknesses of the test pieces shall be calculated separately.*

Figura 3 del provino T-joint usa esplicitamente **t1** e **t2** come spessori dei due pezzi.

### Cosa fa l’app oggi

| Layer | Comportamento |
|-------|----------------|
| DB | `wpqr_records.thickness_min`, `thickness_max`, `thickness_max_unlimited` (mig. 089 / 139) — **nessuna** colonna t1/t2 |
| Schema ingest / UI | Un solo «Spessore materiale base — minimo/massimo» |
| Ingest | `resolveThicknessRange()` sa che i FW non vanno calcolati con Tabella 7 BW; se manca il range → warning manuale; **non** estrae due range |
| Generatore WPS | `checkThicknessCoverage(wpqr, thicknessA, thicknessB)` verifica *entrambi* gli spessori di produzione contro lo **stesso** `[min, max]` |

### Caso Mason (da PDF)

- Tipo giunto: FW fillet weld plate and pipe  
- Dichiarato: **t1** = 3,0–50,0 mm · **t2** = 3,0–30,0 mm  
- In form: un solo massimo (es. 30) → il 50 di t1 non viene gestito

### Aggiornamento possibile (sì)

Slice verticale proposta (dopo conferma + fonti):

1. Colonne additive nullable: es. `thickness_t1_min/max`, `thickness_t2_min/max` (o `thickness_a_*` / `thickness_b_*`) + eventuale flag unlimited per lato.  
2. Schema FE/BE `wpqr` + mapping ingest + form revisione + form Modifica WPQR.  
3. Prompt AI: estrarre i due range quando il verbale li dichiara (FW / spessori diversi).  
4. `checkThicknessCoverage`: assegnare spessore produzione A→range t1, B→range t2 (con regola fallback se un solo range presente, per non rompere WPQR già caricate).  
5. Test L1: regole + round-trip sentinella + caso fixture Mason-like.

**Rischio**: Medio (migrazione additiva, logica conformità). Non Alto (niente auth/sync/breaking distruttivo).

## Dettaglio tecnico — anomalia 2 (norma alluminio)

| Domanda | Risposta |
|---------|----------|
| Mason chiede 9606-2 su **WPQR** | 9606-2 = **qualifica saldatore** alluminio. La **procedura** WPQR alluminio è **ISO 15614-2**. |
| 9606-2 già selezionabile? | **Sì** sul tipo documento/form **Patentino saldatore** (`ISO 9606-2` nelle options). **No** come voce di menu chiuso sul form WPQR (lì è testo libero). |
| Si può «solo aggiungere» 9606-2 al WPQR? | Sì come etichetta/opzione, ma sarebbe **semanticamente fuorviante** se usata come standard di procedura. Preferibile: select WPQR con 15614-1 / 15614-2 (+ altre parti se servono) e tenere 9606-2 sui patentini. |
| Regole automatiche alluminio oggi? | No — `weldingQualificationRules15614.js` e riferimenti UI sono centrati su **15614-1** (acciaio/nichel). |

### Aggiornamento possibile (sì, a step)

| Step | Dipende da PDF? | Contenuto |
|------|-----------------|-----------|
| A — catalogo UI WPQR | No | Select `standard_reference` con UNI EN ISO 15614-1 e **15614-2** (+ testo libero Altro) |
| B — motorino range Al | **Sì, ISO 15614-2** | Digitalizzare → estratto operativo → funzioni JS (come per 15614-1) |
| C — patentino Al completo | **Sì, ISO 9606-2** | Digitalizzare → regole range dedicate (oggi si riusa 9606-1) |

## Limiti documentali — richiesta al committente

Serve il PDF (edizione UNI/EN preferita) per:

| Norma | Uso | Priorità |
|-------|-----|----------|
| **UNI EN ISO 15614-2** (ed. vigente) | WPQR / WPS alluminio — range spessore, giunti, gruppi materiale | **P0 per chiudere alluminio su procedure** |
| **UNI EN ISO 9606-2** (ed. vigente) | Patentini saldatori alluminio — range e variabili essenziali | **P1** (menu già presente; manca testo per regole fedeli) |

Opzionale se Mason salda anche altri metalli non-acciaio: ISO 15614-3… (solo se emergono casi reali).

**Già in repo e sufficienti per la slice t1/t2 acciaio**: ISO 15614-1:2017 (`NORMA_00019`).

## Slice consigliate (ordine)

1. **WPQR-T1T2** — doppi range spessore FW (15614-1) → chiude la P0 Mason senza nuove norme.  
2. **WPQR-AL-UI** — select norma 15614-1/15614-2 sul WPQR (a basso rischio, anche prima del PDF 15614-2).  
3. **WPQR-AL-RULES** — dopo ingest `pdf-to-json` di 15614-2.  
4. **QUAL-9606-2-RULES** — dopo ingest di 9606-2.

## Verdetto per risposta a Mason

| Richiesta | Possibile? | Nota operativa |
|-----------|------------|----------------|
| Gestire più spessori / campi d’azione t1 e t2 | **Sì** | Serve sviluppo (DB+UI+ingest+copertura WPS), non un toggle |
| Selezionare UNI EN ISO 9606-2 | **Parziale / chiarire** | Su patentini già sì; su WPQR alluminio va **15614-2**. Confermare se intende patentino o procedura |
| Quando | Dopo conferma slice + (per alluminio) consegna PDF mancanti | t1/t2 partibile subito su 15614-1 |

## Riferimenti codice

- Schema campi: `app/src/data/documentTypeSchemas.js` (`wpqr`)
- Ingest: `backend/src/services/wpqrIngest.service.js`
- Copertura: `backend/src/services/wpsGenerator.service.js` → `checkThicknessCoverage`
- Warning FW: `backend/src/utils/ingestPlausibilityChecks.js` → `checkFilletThicknessRangeNeedsManualVerification`
- Form manuale: `app/src/pages/WeldingProceduresPage.jsx`
- Gap correlato: `docs/gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md`
