# Piano slice — Modulo CND (operatore in campo)

> **Destinazione**: uno studio (Mason) e l’operatore CND chiudono sul telefono il ciclo **incarico → esecuzione in campo → verbale Word + eventuale NC**, riusando qualifiche ISO 9712, strumenti, commesse, foto e PWA già in produzione. Niente app nativa, niente secondo motore, niente tabelle gemelle.
> **Spec / ADR**: [ISO 9712:2022](../reference/ISO_9712_2022_NDT_QUALIFICATION.md) · ADR-004 (auth mobile) · ADR-016 (strumenti trasversali, verbali ≠ Welding Book) · [PLAN ISO 3834](PLAN_3834_SLICES.md) (ISO-1b/ISO-7 fatti; **ISO-9** eseguita qui come CND-2)
> **Brief attivi**: [`DEPUTYTASK.md`](DEPUTYTASK.md) — **CND-1** · [`DEPUTYTASK1.md`](DEPUTYTASK1.md) — **CND-11** · [`DEPUTYTASK2.md`](DEPUTYTASK2.md) — **CND-4** (template, file disgiunti)
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
| PWA + voice CND in nav mobile + ADR-004 | `useNdtAutoSave.js` solo localStorage; coda IndexedDB NDT **già** in `syncService` ma non collegata (CND-9) |
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

## Decisioni HITL 23/08/2026 (committente)

1. **Chi esegue** — Personale **dello studio**, con qualifica 9712 **e** visita medica (idoneità visiva) in corso di validità. Se l’azienda cliente compra la licenza modulo CND, lo **stesso gate** vale sul personale di quell’azienda (`organization_id` / Ambito). Scalabilità: niente anagrafica operatori CND; si riusa Qualifiche + `visionFitness.service.js`.
2. **Metodi** — VT, MT, PT, UT (ecc.) sono **indipendenti**. Un verbale = un metodo. Nessun “prima il VT”. Modelli Mason PT e MT confermano testate diverse (ISO 3452 / 23277 vs ISO 17638 / 23278).
3. **Offline officina** — Serve una **rete di salvataggio**. Standard già in repo: coda IndexedDB `syncQueue` (ADR-008) con tipi `create_ndt_report` / `update_ndt_report` già nello `syncService`; `useNdtAutoSave.js` oggi ferma a `localStorage`. CND-9 = collegare i due, **non** copiare il motore eventi audit.
4. **Firma grafica** — **No ora**. Basta il **nome**. Firma/controfirma = backlog registrato (CND-10), non questa epic.
5. **Modelli report** — Gestiti in **Template report** (stesso VPS, `GET /report-templates/:id/file`, scope oggi `audit`|`nc`). CND-4 = terzo scope `cnd` + chiave metodo (`VT`/`MT`/`PT`/`UT`). Mason consegna `.doc`/`.docx`: runtime solo **.docx** (come NC/audit). I flag del Word = checkbox in UI = placeholder nel template.
6. **Creazione verbale** — Come gli audit: **crea bozza** (UUID locale) → si compila → sync in coda. Non un form enorme non salvato. Riuso `enqueueNdtReportSync` + `createAudit` come schema mentale, tabelle `ndt_reports` invariate.

### Report: Word, PDF o HTML in Cursor?

**Scelta di prodotto (CND):** restano i **template Word** nel modulo Template report (come audit e NC). Non si adotta HTML “design mode” come editor di layout per Mason.

| Canale | A cosa serve | Perché sì / no per i CND |
|--------|----------------|--------------------------|
| **Word + placeholder** (oggi audit/NC/VT) | Layout dello **studio** (logo, tabella, checkbox, bilingue) | Mason già lavora così; può ritoccare il `.docx` senza sviluppatore. I flag UI riempiono i placeholder. L’auditor ISO rivede l’impaginazione; per un certificato CND il layout è **fisso** e i checkbox devono combaciare 1:1. |
| **PDF diretto** | Consegna “non modificabile” al cliente | Utile **dopo**, come secondo export dallo **stesso** template compilato (stampa PDF / conversione). Non sostituisce il modello: altrimenti ogni ritocco grafico torna in codice. |
| **Preview HTML + design mode Cursor → PDF** | Bozza **nostra** di una schermata app | Va bene per disegnare la **UI** del verbale. Non va bene come filiera report: Mason non apre Cursor; due layout (HTML e Word) divergono; i suoi PT/MT sono già Word con FORMCHECKBOX. |

Quindi: **UI = flag**; **modello grafico = Word in Template report**; **PDF = eventuale stampa del Word compilato** (slice dopo CND-4, non al posto). Nessun secondo motore HTML→PDF.

## Non ancora specificato (nebbia residua)

- UT / RT: nessun Word Mason in questa consegna — parametri UT restano CND-5 quando arriverà un modello.
- PDF come bottone “Consegna cliente” accanto a Word: dopo CND-4, se serve.

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
- Template CND = stesso modulo Template report; scope `cnd` da aggiungere (oggi solo `audit` / `nc`)
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
| **CND-0** | Questa mappa | `PLAN_CND_SLICES.md`, bussola, ISO-9 puntatore | — | AFK docs | *questa sessione* |
| **CND-1** | Verbale VT usabile in tasca (marche a scheda, non tabella da scroll) | `NdtReportsPage.jsx` / `.css`, riuso `status-btn` (`ChecklistModule.css`) + `NdtItemAttachments` | — | AFK | brief in `DEPUTYTASK.md` |
| **CND-2** | Gate ispettore: 9712 valida **e** visita medica/visione (`visionFitness.service.js`); stesso codice per studio e per azienda con licenza | `NdtReportsPage.jsx`, `ndtReports.controller.js`, GET qualifiche + gap visione già esistenti | CND-1 (stesso JSX) | AFK | = ISO-9; **non** aprire da PLAN 3834 |
| **CND-3** | UI flag PT **e** MT da modelli Mason → `method_params` JSON (metodi indipendenti, nessuna tabella nuova) | `NdtReportsPage.jsx` sezioni metodo; catalogo in appendice | CND-1 (stesso JSX) | AFK | dopo CND-1; **non** parallelo a CND-1 |
| **CND-4** | Scope `cnd` in Template report + upload modelli Mason `.docx` + resolve per `report_type` | `ReportTemplatesAdminPage.jsx`, `reportTemplate.service.js` / controller, `vtWordExport.js` resolve VPS (come NC) | — | AFK | **parallelo a CND-1 e CND-11** (niente `NdtReportsPage`) |
| **CND-5** | Parametri UT + ruoli strumento non-VT (sonda/giogo) su anagrafica esistente | `NdtReportsPage.jsx`, `EquipmentPage.jsx` (etichette ruolo) | CND-3 | AFK | serializzare con CND-3 sullo stesso JSX; EquipmentPage può partire in parallelo a CND-2 se **solo** CSS/etichette ruoli |
| **CND-6** | Foto + NC da marca in campo (hardening mobile del già fatto) | `NdtItemAttachments.jsx`, hint `NcCreateModal` | CND-1 | AFK | dopo CND-1; file allegati **disgiunti** da CND-2 se non si tocca la pagina verbale |
| **CND-7** | Completa verbale → posa nel registro documenti (`report_ndt` / cartella 9.3) | `ndtReports.controller.js`, pattern posa ingest | CND-4 utile | AFK | overlap controller con CND-2 → **dopo** CND-2 |
| **CND-8** | Crea verbale come audit: bozza UUID → form → coda sync (niente nuova entità “incarico”) | `NdtReportsPage` lista + `enqueueNdtReportSync` / create | CND-9 utile | AFK | dopo CND-9 se tocca la stessa coda; filtro «oggi» è lo stesso elenco |
| **CND-9** | Rete di salvataggio officina: `useNdtAutoSave` → IndexedDB `syncQueue` (tipi NDT **già** in `syncService`) | `useNdtAutoSave.js`, eventuale gancio foto | — | AFK | overlap con CND-1 se si tocca la pagina; **dopo CND-1** oppure solo hook/coda se CND-1 non tocca l’hook |
| **CND-10** | Firma grafica / controfirma | — | HITL 23/08: **parcheggio** | HITL | non aprire |
| **CND-11** | Ingest verbali PDF storici (`report_ndt`) | whitelist pipeline + schema FE `documentTypeSchemas.js` (schema AI BE già c’è); **non** crea righe `ndt_reports` | — | AFK | brief in `DEPUTYTASK1.md`; **parallelo a CND-1** |
| **CND-12** | RT/ET oltre l’etichetta | `method_params` + UI | modello Mason assente | HITL | dopo MT/PT/UT se servono |

### Onde di parallelismo (file disgiunti)

```
Ora (dopo merge mappa):
  CND-1  (NdtReportsPage marche mobile)
  CND-4  (Template report scope cnd)     ← parallelo
  CND-11 (ingest report_ndt)             ← parallelo

Dopo merge CND-1:
  CND-9  (useNdtAutoSave → syncQueue)    ← hook, dopo CND-1 se CND-1 non tocca l’hook
  CND-2  (gate 9712+visione, stesso JSX)
  CND-6  (NdtItemAttachments)            ← parallelo a CND-2 se file disgiunto

Dopo merge CND-2:
  CND-3  (flag PT/MT, stesso JSX)
  CND-7  (posa registro, controller)
  CND-8  (crea bozza come audit)         ← dopo CND-9

Dopo merge CND-3 + CND-4:
  CND-5  (UT quando c’è modello)
```

Due deputy **mai** sullo stesso `NdtReportsPage.jsx` o sullo stesso controller.

## Gap per passaggio del flusso → slice

| Passaggio | Gap | Slice |
|-----------|-----|-------|
| Input: chi ispeziona | Nome libero; manca gate 9712 + visita medica | CND-2 |
| Input: cosa ispezionare | Si crea da zero; allineare a bozza-audit | CND-8 |
| Input: con quali mezzi | Strumenti VT-centrici | CND-5 |
| Esecuzione: marche in campo | Tabella 10 colonne | CND-1 |
| Esecuzione: parametri metodo | Solo lux VT; PT/MT da Word Mason | CND-3 |
| Esecuzione: evidenza fotografica | C’è; touch/camera da irrobustire | CND-6 |
| Esecuzione: rete assente | localStorage; coda NDT non agganciata | CND-9 |
| Output: certificato | Solo Word VT in `public/templates` | CND-4 |
| Output: fascicolo SGQ | Verbale fuori registro | CND-7 |
| Output: difetto | NC già collegabile | CND-6 (UX) |
| Output: storico cartaceo | Schema `report_ndt` inerte | CND-11 |
| Output: firma grafica | Non richiesta ora | CND-10 parcheggiata |

## Qualità della mappa

- Prima demo: **CND-1** — operatore Mason apre un verbale VT dal telefono, marca un giunto, scatta una foto, salva.
- Nessun numero di migrazione riservato. CND-2: colonna nullable `inspector_qualification_id` solo se il GET qualifiche non basta in JSON esistente; il deputy la dichiara **prima** di creare il file in `database/migrations/`.
- Logica normativa (9712, accettazione 5817): L1 verde dello stesso deputy **non** basta — gate Bugbot + Security Review; skill `gap-analysis-normativa` se si toccano soglie.
- Aggiornare questa tabella a slice chiusa (spunta in Decisioni, non duplicare il diario in GUIDA se c’è parallelo).

## Appendice — campi/flag dai Word Mason (23/08/2026)

Fonte: `PT-2026.docx`, `MTxxx-2026.doc` (Andrea Mason). I **flag** Word (FORMCHECKBOX) sono mutuamente esclusivi per gruppo: in UI = `status-btn` o radio; nel template = placeholder `{pt_livello_2}` → ☑/☐. Non sono “on/off liberi”. Testata (oggetto, cliente, ordine, commessa, materiale, disegno) è comune e già sul verbale.

### PT — liquidi penetranti (ISO 3452-1, accettazione ISO 23277)

| Gruppo flag (un valore) | Opzioni | Placeholder tipo |
|-------------------------|---------|------------------|
| Criterio accettazione | livello 1 / 2 / 3 (ISO 23277: lineare/non lineare) | `{pt_acc_l1}` `{pt_acc_l2}` `{pt_acc_l3}` |
| Condizione superficiale | come saldato / molato / lav. macchina / forgiato | `{pt_sup_*}` |
| Pulizia | molatura / spazzolatura / sabbiatura | `{pt_pul_*}` |
| Applicazione | spray / immersione / pennello | `{pt_app_*}` |
| % controllo | testo (es. 100) | `{inspection_pct}` |
| Consumabili | penetrante, solvente, rilevatore + lotto | `{pt_pen}`, `{pt_pen_lotto}`, … |
| Lux / temperatura | numeri | già in `method_params` VT-like |
| Ogni difetto ISO 6520 | presenza sì\|NA + esito A\|NA\|S | `{d_cricche_si}`, `{d_cricche_A}`, … |
| Esito finale | SI / NO soddisfacente | `{final_ok}` `{final_ko}` |
| Date + nomi | controllo, emissione, responsabile, ispettore, cliente | già in testata verbale |
| Allegato fotografico | foto marche | `NdtItemAttachments` |

Difetti elencati nel PT: cricche 100-104, porosità 2017, mancata fusione 401, mancata penetrazione 402, incisione marginale 5011-12, al vertice 5013, sovrametallo 502, convessità 503, eccesso penetrazione 504, sgocciolatura 5041, traboccamento 506, slivellamento 507, avvallamento 509, riempimento incompleto 511, asimmetria 512, insellamento 515, ripresa 517, colpo d’arco 601, spruzzi 602. `A` = accettabile, `S` = scarto; `NA` su esito = non applicabile a quella voce (non è il giudizio R del VT).

### MT — particelle magnetiche (ISO 17638, accettazione ISO 23278)

| Gruppo flag | Opzioni | Note |
|-------------|---------|------|
| Tecnica | secco / umido / fluorescente | mutuamente esclusivo |
| Magnetizzazione | puntali / giogo / bobina | + diretta / residua |
| Corrente | tipo (es. CA), intensità, passo poli, campo | testo/numero |
| Smagnetizzazione | sì / no | |
| Superficie (*) | S come saldato, U macchina, G grezza, M molato, L laminato | |
| % controllo | testo | |
| Difetti (**) ISO 6520 | 1 cricche … 10 altro | presenza, non la griglia A/NA/S del PT |
| Giudizio (***) | A accettabile / R riparare / S scarto | allineato alle marche VT già in UI |
| Apparecchio / polveri / lampada | da anagrafica strumenti | ruoli MT (giogo, lampada UV) in CND-5 |
| Elenco marche | pos, codice, descrizione, parte, superficie, %, difetti, giudizio | stessa tabella CND-1 |

PT e MT **non** condividono i flag di tecnica: due blocchi `method_params.pt` e `method_params.mt`. Un verbale ha un solo `report_type`.
