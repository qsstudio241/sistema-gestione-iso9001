# Gap analysis — WPQR: Stud Welding + Piastra–Tubo (doppi materiali / prodotti)

| Campo | Valore |
|-------|--------|
| **Data** | 2026-08-25 |
| **Modulo** | Saldatura / WPQR (form + ingest + generatore WPS) |
| **Standard** | ISO 15614-1:2017 (acciaio, in repo); ISO 14555 (stud / prigionieri, **assente**); ISO 4063 (catalogo processi **senza** codici stud) |
| **Scope** | Segnalazione Mason post t1/t2: (1) tipologia Stud Welding / prigioniero; (2) componenti giunto e diametro prigioniero; (3) range di validità; (4) WPQR Piastra–Tubo: selezionare entrambi i tipi prodotto e i range di ciascuno |
| **Analista** | Cloud Agent (gap-analysis-normativa) |
| **Profondità** | completa su codice + 15614-1 presente; **documentale** su ISO 14555 e soglie stud |
| **Screenshot** | confronto verbale WPS/WPQR 001P-21 vs UI (allegato sessione) |

## Dichiarazione fonti (obbligatoria — 3 righe)

```text
Fonti Markdown:
- Coperte: ISO 15614-1 (NORMA_00019 + docs/reference/ISO-15614-1-range-validita-WPQR.md); citazione ISO 14555 in NORMA_00008 (3834-5); simboli ISO 2553 surface_joint «prigionieri/stud»; catalogo processi 4063 (senza 78x)
- Mancanti: testo ISO 14555 (MD/PDF); processi ISO 4063 stud (783/…) nel catalogo JS; nessuna sezione 15614 dedicata allo stud welding
- Si parte su: gap funzionale del modello attuale (BW/FW, P/T, diameter=tubo, un solo gruppo materiale) vs verbale Mason 001P-21; range automatici stud = blocco HITL fino a PDF 14555
```

**Non inventare soglie** di validità per stud / ISO 14555.

## Executive summary

- Il verbale Mason **001P-21** dichiara giunto **FILLET WELD**, processo **135** (MAG), geometria prigioniero cilindrico (D₁=51, t₁=8) su piastra (t₂=10), materiali S235J2H + S355J2 (entrambi gruppo 1.2). L’UI lo collassa in FW + P + un gruppo + spessore 8–10 — perde diametro prigioniero, secondo materiale/spec, e la semantica «elemento che si qualifica».
- **Stud Welding ≠ FW generico.** FW = saldatura d’angolo tra due pezzi (15614-1). Lo **stud welding** tipico (prigioniero saldato a scarica/arco, ISO **14555**) è una famiglia di processo/norma diversa; il caso Mason è un fillet 135 su prigioniero tubolare — va modellato come tipologia dedicata **oppure** come FW con componenti stud+base, senza forzare le regole tubo 15614 §8.3.3 sul diametro del prigioniero.
- **ISO 14555 assente** dal repo → non si possono codificare range di validità stud. Si può comunque fare una **slice 1 campi** (UI/DB/schema) senza motorino range inventato.
- **Piastra–Tubo «entrambi»**: `product_type` ammette solo `P`|`T`; non esiste `P+T` né range diametro/spessore per lato prodotto. La regola piastra→tubo Level 2 è già in codice (`describePlateCoversPipeDiameterLevel2`) ma non sostituisce la dichiarazione esplicita «entrambi» richiesta dall’operatore.
- t1/t2 duali (mig. **158**, PR #558) **già chiusi** — non rifare; qui il problema residuo è tipologia stud + diametro + doppio materiale/prodotto.

## Matrice gap

| Modulo | Clausola / requisito | Fonte | Stato app oggi | Gap | Tipo | Priorità | Evidenza |
|--------|----------------------|-------|----------------|-----|------|----------|----------|
| WPQR tipologia | Tipologia giunto per prigioniero / stud | Verbale Mason + 3834-5 → ISO 14555; UI solo BW/FW/BW+FW | Parziale — FW usato come surrogato | Manca voce SW/stud (o flag) distinta da FW | Funzionale | **P0** | `WeldingProceduresPage.jsx` select joint_type; schema `wpqr` |
| WPQR componenti | Due genitori: base + prigioniero; quale elemento si qualifica | Verbale (Parent Metal 1/2 + disegno D₁/t₁/t₂) | Parziale — un `product_type` P/T; niente «membro qualificato» | Ignora il prigioniero come pezzo di prova; non si seleziona cosa si qualifica | Funzionale | **P0** | form WPQR; `product_type` NVARCHAR(5) |
| WPQR diametro | Diametro del **prigioniero** (D₁), non diametro tubo §8.3.3 | Verbale D₁=51; ISO 15614-1 §8.3.3 = tubo/branch | Parziale — campi `diameter_min/max` etichettati «Diametro tubo» | Semantica sbagliata per stud; rischio confusione con Tabella 9 | Funzionale | **P0** | label form; `documentTypeSchemas.js` wpqr |
| WPQR range stud | Range di validità tipici ISO 14555 | ISO 14555 (**manca**) | Assente | Nessuna regola/range stud | **Documentale** | **P0** (blocco) | assenza MD; backlog |
| WPQR materiali | Due specifiche / gruppi genitori sul verbale | Verbale PM1+PM2; Tabella 5 15614-1 (copertura a runtime) | Parziale — un solo `base_material_group` + `base_material_spec` | Non si memorizzano entrambi i genitori; in UI «tipo materiale» non consente entrambi | Funzionale | **P1** | form; colonne WPQR |
| WPQR P/T | Dichiarare copertura piastra **e** tubo con range | 15614-1 §8.3.3 (L1: forma non essenziale; L2: diametro + regola P→T) | Parziale — enum P\|T; regola P→T nel generatore | Manca `P+T` / range per lato; UI non espone «entrambi» | Funzionale (+ normativo L2) | **P1** | `product_type`; `wpsGenerator.checkDiameterCoverage` |
| Catalogo 4063 | Processi stud (es. famiglia 78x) se usati | ISO 4063 + 14555 | Assente dal catalogo JS | Solo 111…311; niente stud | Funzionale / Documentale | P2 | `weldingProcesses4063.js` |
| Ingest AI | Estrazione stud / D₁ / doppio materiale | schema wpqr attuale | Parziale | Prompt non guida stud vs FW; diameter = tubo | Funzionale | P1 | `documentTypeSchemas.js` (FE+BE) |

## Dettaglio — Stud Welding vs FW (parole semplici)

| | **FW (fillet)** | **Stud welding (senso stretto)** | **Caso Mason 001P-21** |
|--|-----------------|----------------------------------|-------------------------|
| Cosa è | Cordone d’angolo tra due pezzi | Prigioniero (stud) saldato sulla base, spesso con processo dedicato | Fillet 135 di un pezzo cilindrico (prigioniero/tubolare) sulla piastra |
| Norma tipica | ISO 15614-1 | ISO **14555** (citata in 3834-5) | Verbale cita **15614-1**; geometria «stud-like» |
| In app oggi | Opzione FW | Nessuna | Viene salvato come FW + Piastra |

Conclusione operativa: non basta «mettere FW». Serve una tipologia (o sotto-tipologia) che conservi **base + prigioniero**, **D prigioniero**, e — solo dopo PDF 14555 — i range corretti. Finché manca 14555, **non** calcolare range stud in automatico.

## Dettaglio — cosa c’è già nel codice

| Layer | Comportamento attuale |
|-------|------------------------|
| DB | `joint_type`, `product_type` (P/T), `diameter_min/max`, `thickness_*` + **t1/t2** (mig. 158), un `base_material_group`, un `base_material_spec` |
| UI form WPQR | Joint: BW / FW / BW+FW; Prodotto: P / T; label «Diametro tubo»; un gruppo materiale |
| Schema ingest | `joint_type: BW\|FW\|BW+FW`; `product_type: P\|T`; diameter = tubo se dichiarato |
| Regole 15614 | Tabella 5/7/8/9 + piastra→tubo Level 2; **nessuna** regola stud/14555 |
| Processi 4063 | 111–311 tipici; **niente** 783/stud |
| Simboli | `surface_joint` in `weldingSymbols2553.js` menziona prigionieri (solo disegno, non WPQR) |

## Limiti documentali — richiesta al committente (HITL)

| Norma | Uso | Priorità | Stato backlog |
|-------|-----|----------|---------------|
| **UNI EN ISO 14555** (ed. vigente) | Qualifica / range saldatura prigionieri (stud) | **P0** per chiudere i range | `da_richiedere` |
| Catalogo / estratto **ISO 4063** processi stud (78x) se non già nel Patrimonio | Codici processo UI/ingest | P2 | opzionale con 14555 |

**Già sufficienti per slice 1 (campi, senza range inventati):** ISO 15614-1 in repo + verbale Mason come fixture UX.

## Slice consigliate

| ID | Titolo | PDF necessario? | Note |
|----|--------|-----------------|------|
| **STUD-1** | Campi WPQR stud/prigioniero + doppio materiale + `P+T` (UI/DB/schema) | No | Nessun motorino range 14555; label diametro contestuale; DoD nel brief |
| **STUD-2** | Ingest AI: estrarre D₁, componenti, doppia spec | No (prompt) | Dopo STUD-1 |
| **STUD-3** | Regole range ISO 14555 + processi 4063 stud | **Sì, 14555** | Solo dopo digitalizzazione |
| **PT-1** | UX «entrambi» P+T + range lato (15614-1 L2) | No (15614 già in repo) | Può stare in STUD-1 o slice dedicata |

## Verdetto per risposta a Mason

| Richiesta | Possibile ora? | Nota |
|-----------|----------------|------|
| Tipologia Stud / prigioniero in UI | Sì (slice campi) | Senza inventare range 14555 |
| Selezionare elemento che si qualifica | Sì (slice campi) | Nuovo campo semantico |
| Diametro = prigioniero | Sì (label + semantica) | Non riusare ciecamente Tabella 9 tubo |
| Range validità stud automatici | **No** | Serve PDF ISO 14555 |
| Piastra–Tubo entrambi + range | Parziale | Enum + UI; regola P→T già in generatore |
| Doppio materiale sul form | Sì (slice campi) | Due spec/gruppi; copertura Tabella 5 già a runtime WPS |

## Riferimenti consultati

- [x] `docs/Normative/Normative NORMA_00019_ UNI EN ISO 15614-1_2017 Rev. 0.md` (§8.3.2–8.3.3)
- [x] `docs/reference/ISO-15614-1-range-validita-WPQR.md`
- [x] `docs/Normative/Normative NORMA_00008_ UNI EN ISO 3834-5_2021 Rev. 0.md` (riga ISO 14555)
- [x] `app/src/pages/WeldingProceduresPage.jsx`, `documentTypeSchemas.js`, `weldingProcesses4063.js`
- [x] `backend/src/services/wpsGenerator.service.js`, `wpqrIngest.service.js`
- [x] Gap precedenti: `GAP_WPQR_T1T2_ALLUMINIO_2026-08-25.md`, `GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md`
- [x] ISO 14555 — `NORMA_00033` (26/08) + estratto range [`docs/reference/ISO-14555-2025-range-validita-WPQR.md`](../reference/ISO-14555-2025-range-validita-WPQR.md) (STUD-3-A; codice range = STUD-3-B dopo HITL)
