# Piano slice — Modulo CND (operatore in campo)

> **Destinazione**: uno studio (Mason) e l’operatore CND chiudono sul telefono il ciclo **incarico → esecuzione in campo → verbale Word + eventuale NC**, riusando qualifiche ISO 9712, strumenti, commesse, foto e PWA già in produzione. Niente app nativa, niente secondo motore, niente tabelle gemelle.
> **Spec / ADR**: [ISO 9712:2022](../reference/ISO_9712_2022_NDT_QUALIFICATION.md) · ADR-004 (auth mobile) · ADR-016 (strumenti trasversali, verbali ≠ Welding Book) · [PLAN ISO 3834](PLAN_3834_SLICES.md) (ISO-1b/ISO-7 fatti; **ISO-9** eseguita qui come CND-2)
> **Brief attivi**: [`DEPUTYTASK.md`](DEPUTYTASK.md) **CND-9 APERTO**; [`DEPUTYTASK1.md`](DEPUTYTASK1.md) **CND-W CHIUSO** (export Word PT/MT). **CND-7** CHIUSO (#574). **CND-6** CHIUSO (#575). **CND-3** CHIUSO (#571).
> **Mappa**: CND-0…CND-4/6/7/11 + **CND-W** su `main` (dopo merge). **Ora**: CND-9 (coda IndexedDB). Stream STUD-1 parallelo (WPQR).
> **Licenza**: modulo `cnd` (bridge: licenza `saldatura` implica `cnd`)
> **Schermate oggi**: `/cnd/verbali` (`NdtReportsPage.jsx`) · `/cnd/strumenti` (`EquipmentPage.jsx`) · Qualifiche tab NDT

## Perché questa mappa (e non un modulo nuovo)

Il CND **c’è già** (giugno 2026, go-live mobile parziale). Il buco non è «manca la pagina»: è che il flusso **da operatore** non è chiuso end-to-end, soprattutto in mobilità.

| Già in produzione | Cosa manca per l’operatore |
|-------------------|----------------------------|
| CRUD verbali VT/MT/PT/UT (+ RT in UI) | Parametri di metodo solo per **VT** (`method_params` JSON già previsto per MT/PT/UT) |
| Numerazione `VT-YYYY-NNN`, stati bozza/completato/approvato | Gate ispettore 9712 + visione (CND-2 / #561): Completa/firma solo con patentino valido per il metodo |
| Strumenti + semaforo taratura, ruoli calibro/luxmetro/lampada | Ruoli strumenti restano da **VT**; UT/MT/PT non hanno sonde/giogo/kit |
| Foto per riga marca, autosave online, NC da difetto R/S | Elenco marche = **tabella larga** (scroll orizzontale): usabile a tavolino, scomodo in officina |
| Word `VT-verbale.docx` | Nessun template MT/PT/UT; verbale **non** entra nel registro documenti |
| Commessa opzionale (ISO-7), `company_access` (ISO-1b) | Nessuna **coda lavori** del giorno; si crea il verbale da zero |
| PWA + voice CND in nav mobile + ADR-004 | `useNdtAutoSave.js` solo localStorage; coda IndexedDB NDT **già** in `syncService` ma non collegata (CND-9) |
| Ingest `cert_ndt` + idoneità visiva | Ingest `report_ndt` (verbali storici) schema AI sì, whitelist pipeline no |
| Qualifiche 9712 in anagrafica | Gate «puoi firmare questo metodo?» **fatto** (CND-2); flag PT/MT **fatti** (CND-3) |

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
  Bozza UUID (come createAudit) + autosave; in officina senza rete → coda sync (CND-9)
        ↓
OUTPUT
  Completa verbale → Word da Template report (scope cnd)
  Se R/S → crea NC (NcCreateModal)
  Nome responsabile / ispettore / cliente (firma grafica = CND-10 parcheggiata)
```

Tracciabilità ISO 3834-3 §8 (personale prove) e §14 (ispezioni): il verbale è la prova; la qualifica 9712 sta **a monte**. Oggi il ponte è implicito.

## Fuori scope

- App nativa Android/iOS (resta PWA)
- Nuovo agente AI / skill GitHub «CND specialist»
- Motore eventi `audit_events` copiato sui CND (si riusa solo la **coda** IndexedDB già prevista per NDT)
- Menu Saldatura→RDP (visita Mason ≠ laboratorio; già spento)
- Radiografia RT/ET complete (tipo in schema; UI RT è etichetta)
- Registro subfornitura NDT dedicato (ISO-11)
- Template Word **per singolo cliente** (i modelli sono dello studio, in Template report; ritocco = duplica template, non una tabella nuova)
- Sostituire `ndt_reports` con checklist audit
- Nuova riga in bussola per «modulo strumenti CND» separato: gli strumenti restano ADR-016 trasversali, route sotto `/cnd/strumenti`
- Pipeline **HTML → PDF** di produzione (PDF = stampa/export dal Word compilato)
- Secondo motore di impaginazione millimetrica (HTML o Cursor design-mode) parallelo al Word
- Sostituire **CND-4** (Template report scope `cnd`) con una preview HTML

## Decisioni HITL 23/08/2026 (committente)

1. **Chi esegue** — Personale **dello studio**, con qualifica 9712 **e** visita medica (idoneità visiva) in corso di validità. Se l’azienda cliente compra la licenza modulo CND, lo **stesso gate** vale sul personale di quell’azienda (`organization_id` / Ambito). Scalabilità: niente anagrafica operatori CND; si riusa Qualifiche + `visionFitness.service.js`.
2. **Metodi** — VT, MT, PT, UT (ecc.) sono **indipendenti**. Un verbale = un metodo. Nessun “prima il VT”. Word Mason 23/08: PT = UNI EN ISO 3452-1 / accettazione 23277; MT = UNI EN ISO 17638 / accettazione 23278.
3. **Offline officina** — Serve una **rete di salvataggio**. Standard già in repo: coda IndexedDB `syncQueue` (ADR-008) con tipi `create_ndt_report` / `update_ndt_report` già nello `syncService`; `useNdtAutoSave.js` oggi ferma a `localStorage`. CND-9 = collegare i due, **non** copiare il motore eventi audit.
4. **Firma grafica** — **No ora**. Basta il **nome**. Firma/controfirma = backlog registrato (CND-10), non questa epic.
5. **Modelli report** — Gestiti in **Template report** (stesso VPS, `GET /report-templates/:id/file`, scope oggi `audit`|`nc`). CND-4 = terzo scope `cnd` + chiave metodo (`VT`/`MT`/`PT`/`UT`). Mason consegna `.doc`/`.docx`: runtime solo **.docx** (come NC/audit). I flag del Word = checkbox in UI = placeholder nel template.
6. **Creazione verbale** — Come gli audit: **crea bozza** (UUID locale) → si compila → sync in coda. Non un form enorme non salvato. Riuso `enqueueNdtReportSync` + `createAudit` come schema mentale, tabelle `ndt_reports` invariate.

### Report: Word, PDF o HTML in Cursor?

**Conferma post-estrazione Word (23/08):** i due modelli Mason **sono già** report Word con FORMCHECKBOX (PT `.docx` 79 checkbox; MT `.doc` OLE). Layout bilingue, tabelle, testata studio, elenco marche. Stessa famiglia degli export audit/NC.

**Scelta di prodotto (CND):** fonte di verità del layout = **Word + placeholder** nel modulo Template report. Non si adotta HTML “design mode” come filiera report.

| Canale | A cosa serve | Perché sì / no per i CND |
|--------|----------------|--------------------------|
| **Word + placeholder** (oggi audit/NC/VT) | Layout dello **studio** (logo, tabella, checkbox, bilingue) | Mason ritocca il `.docx` senza sviluppatore. I flag UI 1:1 con i checkbox. Nomi FORMCHECKBOX **non** sono chiavi (`Controllo2`/`Controllo3` riusati): placeholder semantici tipo `{pt_acc_l2}`. |
| **PDF diretto** | Consegna “non modificabile” al cliente | **Secondo** export / stampa dallo **stesso** Word compilato, **dopo CND-4**. Committente 23/08: il PDF può uscire facilmente **dal Word**. Non un motore parallelo. |
| **Preview HTML + design mode Cursor → PDF** | Bozza **nostra** di una schermata app | OK per disegnare la **UI**. No come pipeline report: Mason non usa Cursor; due layout divergono; i suoi PT/MT sono già Word. |

Quindi: **UI = flag**; **modello grafico = Word in Template report**; **PDF = stampa/export dal Word compilato** (dopo CND-4). Runtime solo `.docx` (convertire il `.doc` MT **una volta** in CND-4).

### Follow-up HITL 23/08 — prova HTML (`CND-PREVIEW`)

Committente 23/08 sera: «ottimo così riesco a vedere il modulo html, conserva la lezione imparata e proseguiamo domani».

**Come vederlo (fatto verificato):** Simple Browser di Cursor su HTML statico locale / `127.0.0.1` → vista sorgente «Pretty-print» o pagina bianca. **Non è file vuoto.** Per il committente: **Chrome/Edge** + [htmlpreview PT](https://htmlpreview.github.io/?https://github.com/qsstudio241/sistema-gestione-iso9001/blob/main/docs/agent-tasks/spike-cnd-pt-preview.html) (PR #548/#550). In VM `python` assente → `python3 -m http.server` (solo locale agente, non per il committente).

**Cosa non è:** lo spike **non è** `/cnd/verbali`. Flag 1:1 col Word Mason; Design Mode **non** modifica il `.docx`. Certificato = Word Template report (**CND-4**, #547); PDF dal Word. **Abort** se due layout da allineare (HTML+Word).

**Fonte layout certificato = Word** in Template report (**invariata**). Nessun HTML→PDF di produzione.

| Gate | Criterio | Azione |
|------|----------|--------|
| **Abort** | Tenere HTML + Word allineati è chiaramente doppio lavoro (due placeholder, due tabelle, due blocchi bilingue) | **CANCELLARE** lo spike; resta solo itera Word («stampo, verifico, ti dico cosa cambiare») |
| **Successo** | HTML è solo **preview dati/flag** (stessi gruppi radio del Word), non un secondo layout stampabile | Si può tenere più avanti un «riepilogo» leggero in-app — **non** HTML→PDF come pipeline |

Artefatto: [`spike-cnd-pt-preview.html`](spike-cnd-pt-preview.html) · nota [`SPIKE_CND_HTML_PREVIEW.md`](SPIKE_CND_HTML_PREVIEW.md). Gate abort/successo: ancora HITL dopo confronto col Word; **non** allineare due layout.

### Handoff (sessione interrotta)

- **Obiettivo**: epic CND operatore in campo; questa sessione = lezione HTML + mappa per domani
- **Stato**: INTERROTTA
- **Fatto** (file + commit): spike visibile via htmlpreview (#548/#550); CND-1 #549, CND-4 #547, CND-11 #546 su `main`. Committente ha visto il modulo HTML.
- **Manca** (un solo prossimo passo): dopo deploy Netlify di CND-1 (può lag), **una slice** — CND-2 gate 9712+visione **oppure** CND-3 flag PT/MT (stesso JSX). Non entrambe.
- **Non toccare**: `NdtReportsPage.jsx` per riaprire CND-1; due layout HTML+Word; firma CND-10; catalogo flag in GUIDA
- **Test**: L1 già su main per CND-1/4/11; spike = htmlpreview (non Simple Browser)
- **Rischi / Bugbot**: Netlify lag ≠ codice assente; spike ≠ `/cnd/verbali`
- **Brief**: nessuno APERTO — non riaprire [`DEPUTYTASK.md`](DEPUTYTASK.md) CND-1
- **Branch / PR**: `cursor/cnd-lezione-htmlpreview-handoff-d554` (questa PR docs)
- **Lezione GUIDA**: Simple Browser Pretty-print ≠ file vuoto; Chrome + htmlpreview
- **Roadmap** (1 riga «sessione più recente»): CND-1/4/11 mergiati; spike visibile via htmlpreview; prossimo una slice CND-2 o CND-3

## Non ancora specificato (nebbia residua)

- UT / RT: nessun Word Mason in questa consegna — parametri UT restano CND-5 quando arriverà un modello.
- Esito prova HTML (`CND-PREVIEW`): committente **vede** lo spike via htmlpreview; abort vs riepilogo flag — dopo confronto HTML + Word, senza allineare due layout.
- PDF come bottone «Consegna cliente» accanto a Word: CND-4 è su `main`; se serve, sempre dal Word, non da HTML.

## Decisioni già prese (codice + ADR, non da ridiscutere)

- Verbali su tabelle dedicate `ndt_reports` / `ndt_report_items` / `ndt_report_instruments` — non sul motore audit
- Estensione metodi = `report_type` + `method_params` JSON (lezione 20/06/2026)
- Strumenti = `equipment_assets` trasversale (ADR-016), non duplicati nel CND
- Isolamento azienda = `companyAccess.service.js` (ISO-1b, PR #439)
- Commessa = `project_id` opzionale (ISO-7, PR #474)
- Auth mobile = localStorage (ADR-004)
- Verbali CND: bozza locale + coda `syncQueue` (stessi tipi già in `syncService`); `useNdtAutoSave.js` oggi solo `localStorage` — CND-9 allinea allo standard audit **senza** `audit_events`
- RDP Mason = visita ispettiva (Audit id 6), **non** verbale di laboratorio
- Gate personale = Qualifiche 9712 + idoneità visiva (`visionFitness.service.js`), tenant studio **o** azienda con licenza CND
- Template CND = stesso modulo Template report; scope `cnd` (CND-4, 23/08): tab CND, resolve `standard_key` VT|MT|PT|UT, runtime solo `.docx`; placeholder semantici, non nomi FORMCHECKBOX
- Catalogo flag PT/MT = appendice sotto, estratto dai file Mason 23/08 (non inventato)
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
| Word | modulo Template report + `vtWordExport.js` (resolve come NC/audit) | HTML design-mode, PDF engine parallelo, `.doc` runtime |
| PWA / camera | permessi Netlify + `NdtItemAttachments` | Cordova/Capacitor |
| Gap norme metodo | skill `gap-analysis-normativa` + Markdown in `docs/Normative/` | Soglie inventate |

## Mappa slice

Ogni slice è un **tracciante verticale** (un passaggio del flusso), non «tutto il DB poi tutta la UI».

| Slice | Tema | Perimetro (file/layer) | Dipende da | Tipo | Parallelo |
|-------|------|------------------------|------------|------|-----------|
| **CND-0** | Questa mappa | `PLAN_CND_SLICES.md`, bussola, ISO-9 puntatore | — | AFK docs | *chiusa* |
| **CND-PREVIEW** | Spike HTML specchio flag PT (timebox, usa-e-getta) | `docs/agent-tasks/spike-cnd-pt-preview.html` + `SPIKE_CND_HTML_PREVIEW.md` | — | HITL | **non** sostituisce CND-4; vietato `NdtReportsPage` / `vtWordExport` |
| **CND-1** | Verbale VT usabile in tasca (marche a scheda, non tabella da scroll) | `NdtReportsPage.jsx` / `.css`, riuso `status-btn` (`ChecklistModule.css`) + `NdtItemAttachments` | — | AFK | *chiusa* (#549) — **non riaprire** lo stesso JSX |
| **CND-2** | Gate ispettore: 9712 valida **e** visita medica/visione (`visionFitness.service.js`); stesso codice per studio e per azienda con licenza | `NdtReportsPage.jsx`, `ndtReports.controller.js`, `ndtInspectorGate.service.js` (GET qualifiche + visione già in DB; **niente** colonna `inspector_qualification_id`) | CND-1 (stesso JSX) | ✅ 25/08 | = ISO-9; **non** aprire da PLAN 3834 |
| **CND-3** | UI flag PT **e** MT da modelli Mason → `method_params` JSON (metodi indipendenti, nessuna tabella nuova) | `NdtReportsPage.jsx` sezioni metodo; catalogo in appendice | CND-1+CND-2 (stesso JSX) | ✅ 26/08 | [`DEPUTYTASK.md`](DEPUTYTASK.md) CHIUSO; parallelo NG-4 (file disgiunti) |
| **CND-4** | Scope `cnd` in Template report + upload modelli Mason `.docx` + resolve per `report_type` | `ReportTemplatesAdminPage.jsx`, `reportTemplate.service.js` / controller, `vtWordExport.js` resolve VPS (come NC) | — | ✅ 23/08 | *chiusa* (#547) |
| **CND-5** | Parametri UT + ruoli strumento non-VT (sonda/giogo) su anagrafica esistente | `NdtReportsPage.jsx`, `EquipmentPage.jsx` (etichette ruolo) | CND-3 | AFK | serializzare con CND-3 sullo stesso JSX; EquipmentPage può partire in parallelo a CND-2 se **solo** CSS/etichette ruoli |
| **CND-6** | Foto + NC da marca in campo (hardening mobile del già fatto) | `NdtItemAttachments.jsx`, hint `NcCreateModal` | CND-1 | ✅ 26/08 | [`DEPUTYTASK1.md`](DEPUTYTASK1.md) CHIUSO (#575); parallelo CND-7 |
| **CND-7** | Completa verbale → posa nel registro documenti (`report_ndt` / cartella 9.3) | `ndtReports.controller.js`, pattern posa ingest | CND-4 utile | ✅ 26/08 | [`DEPUTYTASK.md`](DEPUTYTASK.md) CHIUSO (#574); parallelo CND-6 |
| **CND-8** | Crea verbale come audit: bozza UUID → form → coda sync (niente nuova entità “incarico”) | `NdtReportsPage` lista + `enqueueNdtReportSync` / create | CND-9 utile | AFK | dopo CND-9 se tocca la stessa coda; filtro «oggi» è lo stesso elenco |
| **CND-9** | Rete di salvataggio officina: `useNdtAutoSave` → IndexedDB `syncQueue` (tipi NDT **già** in `syncService`) | `useNdtAutoSave.js`, eventuale gancio foto | — | AFK **APERTO** | [`DEPUTYTASK.md`](DEPUTYTASK.md); parallelo CND-W |
| **CND-W** | Export Word PT/MT: `method_params` → placeholder semantici (dopo CND-3+CND-4) | `vtWordExport.js` | CND-3+CND-4 | ✅ 26/08 | [`DEPUTYTASK1.md`](DEPUTYTASK1.md) CHIUSO; `buildPtMtPlaceholderData` ☑/☐; resolve CND-4 invariato |
| **CND-10** | Firma grafica / controfirma | — | HITL 23/08: **parcheggio** | HITL | non aprire |
| **CND-11** | Ingest verbali PDF storici (`report_ndt`) | whitelist pipeline + schema FE `documentTypeSchemas.js` (schema AI BE già c’è); **non** crea righe `ndt_reports` | — | AFK | *chiusa* (#546) |
| **CND-12** | RT/ET oltre l’etichetta | `method_params` + UI | modello Mason assente | HITL | dopo MT/PT/UT se servono |

### Onde di parallelismo (file disgiunti)

```
Su `main` (23/08 sera):
  CND-1  *chiusa* #549 — non riaprire `NdtReportsPage.jsx`
  CND-4  *chiusa* #547
  CND-11 *chiusa* #546
  CND-PREVIEW spike visibile via htmlpreview (#548/#550)

Ora (26/08, post CND-6 #575 + CND-7 #574 + CND-W):
  CND-9  (coda IndexedDB) — APERTO su DEPUTYTASK.md
  CND-W  (export Word PT/MT) — CHIUSO su DEPUTYTASK1.md
  STUD-1 (WPQR) — stream APERTO, file disgiunti

Dopo merge CND-9:
  CND-8  (crea bozza come audit)

Dopo CND-W (chiusa):
  CND-5  (UT quando c’è modello)
```

Due deputy **mai** sullo stesso `NdtReportsPage.jsx` o sullo stesso controller.

## Gap per passaggio del flusso → slice

| Passaggio | Gap | Slice |
|-----------|-----|-------|
| Input: chi ispeziona | Gate 9712 + visione **fatto** (#561); match sul nome | CND-2 *chiusa* |
| Input: cosa ispezionare | Si crea da zero; allineare a bozza-audit | CND-8 |
| Input: con quali mezzi | Strumenti VT-centrici | CND-5 |
| Esecuzione: marche in campo | Tabella 10 colonne | CND-1 *chiusa* |
| Esecuzione: parametri metodo | Solo lux VT; PT/MT da Word Mason | CND-3 *chiusa* |
| Esecuzione: evidenza fotografica | C’è; touch/camera da irrobustire | CND-6 |
| Esecuzione: rete assente | localStorage; coda NDT non agganciata | CND-9 |
| Output: certificato | Word VT + resolve CND-4; flag PT/MT → placeholder = **CND-W chiusa** | CND-4 *chiusa*; CND-W *chiusa* |
| Output: fascicolo SGQ | Verbale fuori registro | CND-7 *chiusa* (#574) |
| Output: difetto | NC già collegabile | CND-6 *chiusa* (#575) |
| Output: storico cartaceo | Schema `report_ndt` in whitelist pipeline + form FE | CND-11 *chiusa* |
| Output: firma grafica | Non richiesta ora | CND-10 parcheggiata |

## Qualità della mappa

- Prima demo: **CND-1** — operatore Mason apre un verbale VT dal telefono, marca un giunto, scatta una foto, salva.
- Nessun numero di migrazione riservato. CND-2: colonna nullable `inspector_qualification_id` solo se il GET qualifiche non basta in JSON esistente; il deputy la dichiara **prima** di creare il file in `database/migrations/`.
- Logica normativa (9712, accettazione 5817): L1 verde dello stesso deputy **non** basta — gate Bugbot + Security Review; skill `gap-analysis-normativa` se si toccano soglie.
- Aggiornare questa tabella a slice chiusa (spunta in Decisioni, non duplicare il diario in GUIDA se c’è parallelo).

## Appendice — campi/flag dai Word Mason (estratti 23/08/2026)

Fonte file (non inventario a memoria):

| File | Formato | Titolo | Norma esame | Accettazione |
|------|---------|--------|-------------|--------------|
| `PT-2026.docx` | OOXML, 79 FORMCHECKBOX | RAPPORTO D'ESAME LIQUIDI PENETRANTI | UNI EN ISO 3452-1 | UNI EN ISO 23277 |
| `MTxxx-2026.doc` | OLE `.doc` (Word 97–2003) | RAPPORTO D'ESAME PARTICELLE MAGNETICHE | UNI EN ISO 17638 | UNI EN ISO 23278 |

**Chiavi:** i nomi FORMCHECKBOX **non** sono unici. Sul PT: 48 checkbox senza nome, 27 `Controllo2`, 3 `Controllo3`, 1 `Controllo4`. Bookmark solo `Controllo2/3/4`. In UI e nel `.docx` di runtime usare placeholder **semantici** (`{pt_acc_l2}`), mai il nome del controllo Word. Gruppi esclusivi = radio / `status-btn`. Default Word (☑ nel modello) = preset UI, non vincolo.

CND-4: convertire **una volta** `MTxxx-2026.doc` → `.docx`; runtime solo `.docx`.

Testata comune (già sul verbale): oggetto, cliente, ordine, commessa, materiale, disegno. Firme = **solo nome** (IL RESPONSABILE / L'ISPETTORE / IL CLIENTE). Firma grafica = CND-10.

### PT — liquidi penetranti

Header: `PT xx/2026` rev. 0 · scheda `S-729P9-01` 09/2002. Consumabili esempio in modello: PENTRIX 100 lotto 3416, METACLEAN 300 lotto 3515, RIVELEX 200 lotto 3030. Illuminamento ~600 lux, temperatura 15 °C, % controllo 100. Pulizia post-test con solvente (testo fisso).

| Gruppo (un valore) | Opzioni (default Word) | Placeholder |
|--------------------|------------------------|-------------|
| Accettazione 23277 | L1 ☑ (lin. l≤2 / n.lin. d≤4); L2 (l≤4 / d≤6); L3 (l≤8 / d≤8) | `{pt_acc_l1}` `{pt_acc_l2}` `{pt_acc_l3}` |
| Superficie | come saldato / molato / lav. macchina / forgiato | `{pt_sup_asw}` `{pt_sup_grd}` `{pt_sup_mac}` `{pt_sup_frg}` |
| Pulizia | molatura ☑ / spazzolatura ☑ / sabbiatura | `{pt_cln_gr}` `{pt_cln_br}` `{pt_cln_sb}` |
| Applicazione | spray ☑ / immersione / pennello | `{pt_app_spray}` `{pt_app_dip}` `{pt_app_brush}` |
| % controllo | testo | `{inspection_pct}` |
| Consumabili | penetrante, solvente, rilevatore + lotti | `{pt_pen}` `{pt_pen_lot}` `{pt_sol}` `{pt_sol_lot}` `{pt_det}` `{pt_det_lot}` |
| Lux / °C | numeri | `{pt_lux}` `{pt_temp}` |
| Esito finale | SI ☑ / NO soddisfacente | `{pt_final_ok}` `{pt_final_ko}` |
| Date | controllo, emissione | `{pt_date_insp}` `{pt_date_iss}` |
| Nomi | responsabile, ispettore, cliente | `{pt_name_resp}` `{pt_name_insp}` `{pt_name_cli}` |

**Difetti PT (ISO 6520)** — due sotto-gruppi per riga: presenza `sì`\|`NA`; esito `A`\|`NA`\|`S`. `A` = accettabile, `S` = scarto; `NA` ≠ giudizio R del VT.

| Codice | Voce | Presenza nel modello | Esito nel modello | Placeholder (es.) |
|--------|------|----------------------|-------------------|-------------------|
| 100–104 | Cricche | sì / NA | A / NA / S | `{pt_d_100_yn}` `{pt_d_100_a}` … |
| 2017 | Porosità superficiale | sì / NA | A / NA / S | `{pt_d_2017_*}` |
| 401 | Mancata fusione | sì / NA | A / NA / S | `{pt_d_401_*}` |
| 402 | Mancata penetrazione | sì / NA | A / NA / S | `{pt_d_402_*}` |
| 5011–5012 | Incisione marginale | sì / NA | A / NA / S | `{pt_d_5011_*}` |
| 5013 | Incisione al vertice | sì / NA | A / NA / S | `{pt_d_5013_*}` |
| 502 | Sovrametallo eccessivo | **solo NA** | **solo NA** | `{pt_d_502_na}` |
| 503 | Convessità eccessiva | solo NA | solo NA | `{pt_d_503_na}` |
| 504 | Eccesso di penetrazione | solo NA | solo NA | `{pt_d_504_na}` |
| 5041 | Sgocciolamento | solo NA | solo NA | `{pt_d_5041_na}` |
| 506 | Traboccamento | solo NA | solo NA | `{pt_d_506_na}` |
| 507 | Slivellamento | solo NA | solo NA | `{pt_d_507_na}` |
| 509 | Avvallamento | solo NA | solo NA | `{pt_d_509_na}` |
| 511 | Riempimento incompleto | solo NA | solo NA | `{pt_d_511_na}` |
| 512 | Asimmetria eccessiva | solo NA | solo NA | `{pt_d_512_na}` |
| 515 | Insellamento al vertice | solo NA | solo NA | `{pt_d_515_na}` |
| 517 | Ripresa difettosa | sì / NA | A / NA / S | `{pt_d_517_*}` |
| 601 | Colpo d’arco | sì / NA | A / NA / S | `{pt_d_601_*}` |
| 602 | Spruzzi | sì / NA | A / NA / S | `{pt_d_602_*}` |

502–515 nel modello Mason sono **spesso solo NA** (nessun sì/A/S). CND-3: in UI si possono comunque offrire sì/A/S; il template lascia NA se il pezzo non è saldatura a piena penetrazione. Non inventare altri codici.

### MT — particelle magnetiche

Header: `MT xx/2026` rev. 1 · scheda `S-729P9-01` 09/2002. Apparecchio esempio: MAGISCOP YOKE MP S.N.17896; lacca CGM V42 VECOPLAST; veicolo CGM LK35. Giunto esempio: saldatura ad angolo passata singola. Materiali esempio: UNI EN ISO 10025-2, UNI EN ISO 10210 / EN 10219-1.

| Gruppo | Opzioni (default Word) | Placeholder |
|--------|------------------------|-------------|
| Tracciante | secco / umido ☑ / fluorescente | `{mt_tr_dry}` `{mt_tr_wet}` `{mt_tr_flu}` |
| Magnetizzazione | puntali / giogo / bobina | `{mt_mag_prod}` `{mt_mag_yoke}` `{mt_mag_coil}` |
| Modo | diretta ☑ / residua | `{mt_mag_dir}` `{mt_mag_res}` |
| Passo poli | testo (es. 150÷180 mm sul giogo) | `{mt_pole_pitch}` |
| Corrente | tipo (es. CA), intensità, campo Asp/m | `{mt_curr_type}` `{mt_curr_a}` `{mt_field}` |
| Smagnetizzazione | sì / no ☑ | `{mt_demag_yes}` `{mt_demag_no}` |
| Superficie (*) | S come saldato, U macchina, G grezza, M molato, L laminato | `{mt_surf}` |
| % controllo | testo | `{inspection_pct}` |
| Giudizio (***) | A accettabile / R da riparare / S scarto | `{mt_judg}` — stessa famiglia A/R/S delle marche VT |
| Nomi / date | responsabile, ispettore, cliente, date | `{mt_name_*}` `{mt_date_*}` |

**Difetti MT (**) UNI EN ISO 6520** — codice sulla marca (presenza), **non** la griglia A/NA/S del PT. Nel modello **manca il codice 8**.

| Codice | Voce IT | EN nel Word |
|--------|---------|-------------|
| 1 | cricche affioranti | cracks |
| 2 | ripiegature | laps |
| 3 | sfogliature | flakings |
| 4 | ricalcature / sigillature | upsettings |
| 5 | porosità / risucchi | porosity |
| 6 | soffiature | gas inclusion |
| 7 | incisioni marginali | undercuts |
| 9 | sfondamento | burn-through |
| 10 | altro | other |

Elenco marche (stessa idea CND-1): pos, codice, q.tà, descrizione, parte, superficie (es. M/S), % controllo, difetti, giudizio (es. NESSUNO / ACC.).

PT e MT **non** condividono i flag di tecnica: `method_params.pt` vs `method_params.mt`. Un verbale = un `report_type`. UT/RT: nessun Word in questa consegna (nebbia).
