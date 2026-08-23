# Piano slice — Modulo CND (operatore in campo)

> **Destinazione**: uno studio (Mason) e l’operatore CND chiudono sul telefono il ciclo **incarico → esecuzione in campo → verbale Word + eventuale NC**, riusando qualifiche ISO 9712, strumenti, commesse, foto e PWA già in produzione. Niente app nativa, niente secondo motore, niente tabelle gemelle.
> **Spec / ADR**: [ISO 9712:2022](../reference/ISO_9712_2022_NDT_QUALIFICATION.md) · ADR-004 (auth mobile) · ADR-016 (strumenti trasversali, verbali ≠ Welding Book) · [PLAN ISO 3834](PLAN_3834_SLICES.md) (ISO-1b/ISO-7 fatti; **ISO-9** eseguita qui come CND-2)
> **Brief attivi**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — **CND-1** (APERTO) · [`DEPUTYTASK1.md`](DEPUTYTASK1.md) — **CND-11** (APERTO, file disgiunti)
> **Licenza**: modulo `cnd` (bridge: licenza `saldatura` implica `cnd`)
> **Schermate oggi**: `/cnd/verbali` (`NdtReportsPage.jsx`) · `/cnd/strumenti` (`EquipmentPage.jsx`) · Qualifiche tab NDT

## Perché questa mappa (e non un modulo nuovo)

Il CND **c’è già** (giugno 2026, go-live mobile parziale). Il buco non è «manca la pagina»: è che il flusso **da operatore** non è chiuso end-to-end, soprattutto in mobilità.

| Già in produzione | Cosa manca per l’operatore |
|-------------------|----------------------------|
| CRUD verbali VT/MT/PT/UT (+ RT in UI) | Parametri di metodo solo per **VT** (`method_params` JSON già previsto per MT/PT/UT) |
| Numerazione `VT-YYYY-NNN`, stati bozza/completato/approvato | Ispettore = testo libero, **non** legato al patentino 9712 (ISO-9) |
| Strumenti + semaforo taratura, ruoli calibro/luxmetro/lampada | Ruoli strumenti restano da **VT**; UT/MT/PT non hanno sonde/giogo/kit |
| Foto per riga marca, autosave online, NC da difetto R/S | Elenco marche = **tabella larga** (scroll orizzontale): usabile a tavolino, scomodo in officina |
| Word `VT-verbale.docx` | Nessun template MT/PT/UT; verbale **non** entra nel registro documenti |
| Commessa opzionale (ISO-7), `company_access` (ISO-1b) | Nessuna **coda lavori** del giorno; si crea il verbale da zero |
| PWA + voice CND in nav mobile + ADR-004 | Online-first (`useNdtAutoSave.js`): **niente coda offline** come gli audit |
| Ingest `cert_ndt` + idoneità visiva | Ingest `report_ndt` (verbali storici) schema AI sì, whitelist pipeline no |
| Qualifiche 9712 in anagrafica | Gate «puoi firmare questo metodo?» assente |

**Non si inventa** una quarta pagina, un agente CND, un IndexedDB gemello degli audit, né tabelle `ndt_mt_*`. Si estende `ndt_reports` + `method_params` JSON + UI già copiata da NC / Qualifiche.

## Flusso operativo (input → esecuzione → output)

```
INPUT (studio / coordinatore / commessa)
  Azienda + (opz.) commessa ISO-7
  WPS / materiale / livello ISO 5817 (testo oggi)
  Metodo VT|MT|PT|UT|RT
  Operatore (oggi: nome digitato)
  Strumenti tarati (anagrafica)
        ↓
ESECUZIONE (campo — PWA)
  Sezioni 1–2 testata e strumenti
  Elenco marche: pezzo → % → difetto → giudizio A/R/S
  Foto per riga (dopo primo salvataggio)
  Parametri metodo (oggi solo lux VT)
  Autosave online
        ↓
OUTPUT
  Completa verbale → Word VT
  Se R/S → crea NC (NcCreateModal)
  Firme testo (responsabile / ispettore / cliente)
```

Tracciabilità ISO 3834-3 §8 (personale prove) e §14 (ispezioni): il verbale è la prova; la qualifica 9712 sta **a monte**. Oggi il ponte è implicito.

## Fuori scope

- App nativa Android/iOS (resta PWA)
- Nuovo agente AI / skill GitHub «CND specialist»
- Motore offline IndexedDB degli audit (solo se HITL su CND-9)
- Menu Saldatura→RDP (visita Mason ≠ laboratorio; già spento)
- Radiografia RT/ET complete (tipo in schema; UI RT è etichetta)
- Registro subfornitura NDT dedicato (ISO-11)
- Template Word **per singolo cliente** (finché Mason non consegna un .docx diverso da `VT-verbale.docx`)
- Sostituire `ndt_reports` con checklist audit
- Nuova riga in bussola per «modulo strumenti CND» separato: gli strumenti restano ADR-016 trasversali, route sotto `/cnd/strumenti`

## Non ancora specificato (HITL committente)

Risposte qui sbloccano o parcheggiano le slice CND-8…CND-10. **CND-1 e CND-2 partono senza queste risposte.**

1. **Chi è l’operatore giorno-1?** Tecnico Mason in officina/cantiere cliente, personale NDT del cliente, o entrambi (stesso form, utente diverso)?
2. **Metodi obbligatori per Mason in campo, dopo il VT?** Solo VT (Word già c’è) vs VT+MT+PT vs anche UT.
3. **Offline in officina senza rete:** indispensabile al primo rilascio operatore, o basta autosave + telefono in 4G?
4. **Firma:** basta nome + gate 9712 (CND-2), o serve firma grafica / secondo firmatario Livello 2?
5. **Word:** un template studio (oggi VT) per tutti i clienti, o Mason ha modelli distinti per committente?
6. **Coda lavori:** l’operatore crea il verbale sul posto (come oggi), o lo studio gli assegna i pezzi la mattina (entità incarico — **da discutere prima di crearla**)?

## Decisioni già prese (codice + ADR, non da ridiscutere)

- Verbali su tabelle dedicate `ndt_reports` / `ndt_report_items` / `ndt_report_instruments` — non sul motore audit
- Estensione metodi = `report_type` + `method_params` JSON (lezione 20/06/2026)
- Strumenti = `equipment_assets` trasversale (ADR-016), non duplicati nel CND
- Isolamento azienda = `companyAccess.service.js` (ISO-1b, PR #439)
- Commessa = `project_id` opzionale (ISO-7, PR #474)
- Auth mobile = localStorage (ADR-004)
- Verbali CND = **online-first** + `useNdtAutoSave.js` (non IndexedDB audit)
- RDP Mason = visita ispettiva (Audit id 6), **non** verbale di laboratorio
- Riuso UI: `status-btn` / `notes-textarea` / `AttachmentSection` / sezioni a fasi come drawer NC — DNA in `app/src/design-system/README.md`
- Ingest certificati NDT = schema `cert_ndt` esistente; verbali PDF storici = `report_ndt` nello stesso ingest
- Skill da riusare (non installarne di nuove): `gap-analysis-normativa` (norme metodo), `pdf-to-json` (procedure scritte / verbali cartacei), Assistente di Ambito (ADR-010) se serve un prompt — **nessun secondo agente**

## Riuso obbligatorio (gate Ponytail)

| Bisogno | Già in repo | Vietato |
|---------|-------------|---------|
| Esito A/R/S | `status-btn` in `ChecklistModule.css` (le marche usano già `status-btn`: **stessa famiglia**, non una terza classe) | Nuovi chip/colori |
| Note difetto | `notes-textarea` | Textarea CSS locale nuova |
| Foto riga | `NdtItemAttachments.jsx` (stesso pattern di `AttachmentSection` / RDP) | Uploader nuovo |
| NC da difetto | `NcCreateModal.jsx` | Wizard NC parallelo |
| Lista + KPI | card come Qualifiche / `SgqDataGrid` se si tocca la lista | Griglia nuova |
| Form lungo | sezioni numerate collassabili (già sul verbale; allineare a `.nc-drawer-section` solo se si tocca il markup) | Pagina «CND 2.0» |
| Patentino 9712 | `QualificationsPage` + API qualifiche + ingest `cert_ndt` | Anagrafica operatori CND |
| Taratura | `EquipmentPage` + badge esistente | Inventario strumenti nel verbale |
| Word | `vtWordExport.js` + `VT-verbale.docx` | Libreria Word nuova |
| PWA / camera | permessi Netlify + `NdtItemAttachments` | Cordova/Capacitor |
| Gap norme metodo | skill `gap-analysis-normativa` + Markdown in `docs/Normative/` | Soglie inventate |

## Mappa slice

Ogni slice è un **tracciante verticale** (un passaggio del flusso), non «tutto il DB poi tutta la UI».

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo | Parallelo |
|-------|------|------------------------|------------|------|-----------|
| **CND-0** | Questa mappa | `PLAN_CND_SLICES.md`, bussola, ISO-9 puntatore | — | AFK docs | *questa sessione* |
| **CND-1** | Verbale VT usabile in tasca (marche a scheda, non tabella da scroll) | `NdtReportsPage.jsx` / `.css`, riuso `status-btn` (`ChecklistModule.css`) + `NdtItemAttachments` | — | AFK | brief in `DEPUTYTASK.md` |
| **CND-2** | Gate ispettore ↔ qualifica 9712 (metodo+livello+scadenza+visione) | `NdtReportsPage.jsx`, `ndtReports.controller.js`, GET qualifiche esistente | CND-1 (stesso JSX) | AFK | = ISO-9; **non** aprire da PLAN 3834 |
| **CND-3** | Parametri MT/PT nel JSON già previsto (nessuna tabella nuova) | `NdtReportsPage.jsx` sezioni 2, `method_params` | CND-2 (stesso JSX) | AFK | dopo CND-2 |
| **CND-4** | Word MT/PT clonando `vtWordExport` + template | `vtWordExport.js` (o export condiviso), `app/public/templates/` | CND-3 | AFK | **disgiunto dal JSX** dopo CND-3; in parallelo a CND-5 se CND-3 già mergiata |
| **CND-5** | Parametri UT + ruoli strumento non-VT (sonda/giogo) su anagrafica esistente | `NdtReportsPage.jsx`, `EquipmentPage.jsx` (etichette ruolo) | CND-3 | AFK | serializzare con CND-3 sullo stesso JSX; EquipmentPage può partire in parallelo a CND-2 se **solo** CSS/etichette ruoli |
| **CND-6** | Foto + NC da marca in campo (hardening mobile del già fatto) | `NdtItemAttachments.jsx`, hint `NcCreateModal` | CND-1 | AFK | dopo CND-1; file allegati **disgiunti** da CND-2 se non si tocca la pagina verbale |
| **CND-7** | Completa verbale → posa nel registro documenti (`report_ndt` / cartella 9.3) | `ndtReports.controller.js`, pattern posa ingest | CND-4 utile | AFK | overlap controller con CND-2 → **dopo** CND-2 |
| **CND-8** | Coda «miei verbali / oggi» (filtro lista, niente nuova entità) | lista `NdtReportsPage` + card KPI stile Qualifiche | HITL domanda 6 | HITL | se la risposta è «niente assegnazione», questa slice è solo filtro utente/data — AFK e disgiunta se si tocca **solo** la lista, non il form |
| **CND-9** | Bozza offline campo | estendere `useNdtAutoSave.js`, **non** copiare sync audit | HITL domanda 3 | HITL | Alto: tocca persistenza; conferma prima |
| **CND-10** | Firma grafica / controfirma L2 | solo se esiste già un pattern firma in repo; altrimenti **discutere** | HITL domanda 4 | HITL | non aprire da soli |
| **CND-11** | Ingest verbali PDF storici (`report_ndt`) | whitelist pipeline + schema FE `documentTypeSchemas.js` (schema AI BE già c’è); **non** crea righe `ndt_reports` | — | AFK | brief in `DEPUTYTASK1.md`; **parallelo a CND-1** |
| **CND-12** | RT/ET oltre l’etichetta | `method_params` + UI | HITL domanda 2 | HITL | dopo MT/PT/UT se servono |

### Onde di parallelismo (file disgiunti)

```
Ora (dopo merge mappa):
  CND-1  (verbale JSX/CSS)
  CND-11 (ingest report_ndt)          ← parallelo, file diversi

Dopo merge CND-1:
  CND-2  (JSX verbale + controller NDT)
  CND-6  (NdtItemAttachments only)  ← parallelo se CND-1 non ha lasciato WIP su quel file
  CND-8  (solo lista, se HITL ok)    ← parallelo a CND-2 se NON si tocca il form

Dopo merge CND-2:
  CND-3  (parametri MT/PT, stesso JSX)
  CND-7  (posa registro, controller)

Dopo merge CND-3:
  CND-4  (Word)  ∥  CND-5 (UT + ruoli, JSX+Equipment)
```

Due deputy **mai** sullo stesso `NdtReportsPage.jsx` o sullo stesso controller.

## Gap per passaggio del flusso → slice

| Passaggio | Gap | Slice |
|-----------|-----|-------|
| Input: chi ispeziona | Nome libero, no 9712 | CND-2 |
| Input: cosa ispezionare | Commessa ok; niente coda assegnata | CND-8 (HITL) |
| Input: con quali mezzi | Strumenti VT-centrici | CND-5 |
| Input: secondo quale procedura scritta | Nessun FK a documento procedura | nebbia — riuso registro documenti, **non** nuova tabella finché non si discute |
| Esecuzione: marche in campo | Tabella 10 colonne | CND-1 |
| Esecuzione: parametri metodo | Solo illuminamento VT | CND-3, CND-5 |
| Esecuzione: evidenza fotografica | C’è; touch/camera da irrobustire | CND-6 |
| Esecuzione: rete assente | Autosave fallisce | CND-9 HITL |
| Output: certificato cliente | Solo Word VT | CND-4 |
| Output: fascicolo SGQ | Verbale fuori registro | CND-7 |
| Output: difetto | NC già collegabile | CND-6 (UX) |
| Output: storico cartaceo | Schema `report_ndt` inerte | CND-11 |

## Qualità della mappa

- Prima demo: **CND-1** — operatore Mason apre un verbale VT dal telefono, marca un giunto, scatta una foto, salva.
- Nessun numero di migrazione riservato. CND-2: colonna nullable `inspector_qualification_id` solo se il GET qualifiche non basta in JSON esistente; il deputy la dichiara **prima** di creare il file in `database/migrations/`.
- Logica normativa (9712, accettazione 5817): L1 verde dello stesso deputy **non** basta — gate Bugbot + Security Review; skill `gap-analysis-normativa` se si toccano soglie.
- Aggiornare questa tabella a slice chiusa (spunta in Decisioni, non duplicare il diario in GUIDA se c’è parallelo).
