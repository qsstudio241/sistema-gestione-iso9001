# Sintesi ISO 3834 — per Studio Mason

**Data:** 20/09/2026  
**Destinatario:** Studio Mason (coordinamento saldatura sulle aziende seguite)  
**Natura del documento:** panoramica di **prodotto e processi** già disponibili nel sistema multi-azienda. **Non** è un audit legale del SGQ Mason né una valutazione di conformità delle aziende clienti.

> Sintesi sullo **stato del prodotto** ISO 3834. Mason è citato nei documenti di lavoro del progetto (feedback, verbali di esempio, decisioni di layout). **Non** c’è nel repository un’anagrafica completa delle aziende Mason: nessun dato inventato su clienti o stabilimenti.

Il perimetro è quello di uno **studio** che segue più aziende sotto ISO 3834: registri WPS/WPQR, qualifiche, visite, prove NDT, certificati materiale, scadenze — tenuti distinti per azienda, con report esportabili dove già previsti.

---

## Tabella 1 — Processi gestiti

| Processo / area | Cosa fa l’app oggi | Stato | Note per Mason |
|-----------------|--------------------|-------|----------------|
| **WPS** | Generazione della procedura da WPQR (flusso principale), export Word Annex A; upload PDF solo come eredità | Operativo | In attesa di un vostro riscontro sul risultato generato; non è bloccato lo sviluppo di base |
| **WPQR** | Registro prove di qualifica procedura, ingest da PDF, collegamento a WPS e commesse | Operativo | Pipeline di import matura; usabile in produzione |
| **Qualifiche saldatori / operatori / NDT** | Patentini 9606 / 14732 / coordinatori 14731 / NDT 9712, idoneità visiva, alert scadenze, ingest AI | Operativo | Registro + scadenze pronti; report Word riepilogo per audit esterno ancora da fare (priorità bassa) |
| **Commesse e riesame tecnico (§5)** | Commesse con checklist riesame 17 punti, traccia data/utente, export Word; livello 2/3/4 in anagrafica | Operativo (gate soft) | La commessa **non** si blocca se la checklist è incompleta (scelta già condivisa); stesso schermo per livelli 2/3/4 — i filtri «meno schermate» arriveranno dopo |
| **Dashboard saldatura** | Cruscotto coordinatore con conteggi e collegamenti a WPS, qualifiche, commesse | Operativo | Semaforo copertura processo per processo (§5–18) ancora da affinare |
| **Welding Book (IOF)** | Libro di fabbricazione legato alla commessa, foto cordone, export Word | Operativo | Usabile come rintracciabilità di fabbricazione, non come verbale di accettazione |
| **Visita / check list ISO 3834 (Audit)** | Checklist visita (standard ISO 3834-2), export Word Quesito / Evidenze / Esito | Operativo | Allineata al modello visita Mason (layout 27/01). Esiti oggi: **C / NC / OSS** — non ancora scala 1–6 |
| **Modulo «RDP» prove in menu Saldatura** | Route tecnica presente; **menu spento** | Non ancora (parcheggiato) | Scelta di prodotto: la visita ispettiva passa dall’**Audit**, non da quel menu. Eventuale «resoconto avanzamento + foto» (modello 23/02) resta in attesa di decisione |
| **CND / verbali NDT** | Verbali VT/MT/PT (e base UT), foto, collegamento opzionale a commessa, Word VT, gate patentino 9712 alla firma | Operativo / Parziale | Ciclo operatore in campo chiuso per i metodi principali; parametri UT e firma grafica ancora aperti; foto offline non in coda sync |
| **Non conformità** | Modulo NC completo; collegamento opzionale alla commessa di saldatura | Operativo | NC generiche ISO 9001; il Welding Book non è ancora «prova» nel registro documenti |
| **Material Compliance (certificati 3.1 / DDT)** | Elenco certificati base e apporto, ingest da scan/PDF, valutazione con conferma umana | Operativo / Parziale | Usabile per materiali e consumabili. Il passaggio automatico nel **Registro documenti** è ancora indefinito (nebbia di prodotto) |
| **Attrezzature e tarature** | Anagrafica strumenti, scadenze calibrazione, uso da Welding Book / CND | Operativo | Isolamento per azienda allineato al resto del modulo saldatura |
| **Libreria norme / fonti** | Libreria gestionale + requisiti normativi per assistente e gap | Operativo | Supporto alle visite e alle domande di conformità; non sostituisce il testo ufficiale UNI acquistato |
| **Assistente AI / Second Brain Ambito** | Chat su norme e contesto azienda/studio; score completezza anagrafica; proposte da registro con conferma | Operativo / Parziale | Utile in riunione e in campo. Collegamento automatico a email/Drive **non** attivo (serve decisione esplicita, rischio alto) |
| **Scadenze / riqualifiche** | Scadenzario unificato + alert patentini e tarature | Operativo | Copre riqualifiche personale e strumenti; destinazione alert per ruolo in anagrafica è altro modulo |
| **Subfornitura saldatura** | Solo voce in checklist riesame + cliente/controparte di commessa | Parziale | Nessun registro «chi salda fuori, con quali WPS/qualifiche» — si apre solo se lo chiedete in campo |
| **PWHT (trattamento termico)** | Solo voce in checklist riesame | Non ancora | Destinato all’evoluzione Material Compliance, non a un registro separato 3834 |

---

## Tabella 2 — Gap (onesti, senza date promesse)

| Gap | Impatto per lo studio / aziende | Priorità | Dipende da Mason? |
|-----|--------------------------------|----------|-------------------|
| **Scala voto 1–6** sulla visita Audit (oggi C/NC/OSS) | Verbali visita non ancora nel formato numerico che usate in campo | Alta | **Sì** — conferma che la scala 1–6 sostituisce C/NC/OSS su quel percorso (decisione prodotto) |
| **Feedback sul generatore WPS** da WPQR | Affinare matcher / Word Annex A sul vostro modo di lavorare | Media | **Sì** — prova su casi reali e ritorno scritto (anche breve) |
| **Ponte offerta / capitolato → commessa** | Oggi riesame contratto e commessa sono due flussi; manca il filo unico | Media | No (lavoro prodotto); utili i vostri documenti tipo se volete guidare il collegamento |
| **Registro subfornitura saldatura** | Tracciabilità di chi salda in outsourcing incompleta | Bassa / su richiesta | **Sì** — solo se lo chiedete in campo |
| **Visita / Welding Book → Registro documenti** come prova firmabile | Registrazioni qualità (§18) ancora parziali su quei tipi | Media | No (prodotto); eventuale naming «verbale visita» da allineare al vostro lessico |
| **Dashboard copertura §5–18** | Vista «quanto manca per processo» ancora grezza | Media | No |
| **Certificati materiale → Registro documenti** | Archivio prove 3.1 non ancora unificato nel registro | Media | No — oggi è **nebbia di prodotto** (non chiusa) |
| **Resoconto avanzamento + foto** (modello tipo 23/02) | Secondo tipo di documento visita non coperto dall’Audit check list | Bassa | **Sì** — se vi serve, decidere formato e se riprendere il modulo prove |
| **Parametri UT / firma grafica CND** | Verbali UT incompleti; firma = solo nome | Bassa / Media | **Sì** per modello UT; firma grafica è backlog consapevole |
| **Email / Drive nell’assistente** | Contesto AI non legge caselle o cartelle private | Bassa (oggi) | **Sì** — opt-in e regole di privacy; **non** attivabile senza decisione esplicita |
| **Filtri UI per livello 3834-2 / -3 / -4** | Stesse schermate per tutti i livelli | Bassa | No — etichetta già in anagrafica; filtri dopo |
| **Licenza dedicata Materiali** (oltre al modulo saldatura) | Contabilizzazione commerciale moduli | Bassa | No (scelta studio / commerciale) |

**Legenda tipologica:** le righe «Dipende da Mason = Sì» sono gap di **documento o decisione cliente**; le altre sono gap di **prodotto** ancora aperti o indefiniti.

---

## Come leggerla in riunione

- **Già usabile oggi:** WPS/WPQR, qualifiche e scadenze, commesse con riesame, visita Audit 3834 con Word, Welding Book con foto e Word, verbali NDT principali, NC collegate alla commessa, certificati materiale con conferma umana, cruscotto e libreria/assistente.
- **In corso o parziale:** Material Compliance verso il Registro documenti; dashboard per processo; ponti offerta→commessa; CND UT/firma/offline foto; Second Brain senza email/Drive.
- **Cosa chiedere a Mason in riunione:** (1) conferma scala voto 1–6 sulla visita; (2) feedback su 1–2 WPS generate da WPQR reali; (3) se serve il registro subfornitura e/o il resoconto tipo 23/02; (4) se i parametri UT e il collegamento certificati→registro sono priorità commerciali.

---

## Fonti (repository)

- Roadmap — stato e priorità: [`docs/PROJECT_ROADMAP.md`](../PROJECT_ROADMAP.md) (§ Stato attuale)
- Piano slice ISO 3834: [`docs/agent-tasks/PLAN_3834_SLICES.md`](../agent-tasks/PLAN_3834_SLICES.md)
- Material Compliance: [`docs/agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md`](../agent-tasks/PLAN_MATERIAL_COMPLIANCE_SLICES.md)
- CND: [`docs/agent-tasks/PLAN_CND_SLICES.md`](../agent-tasks/PLAN_CND_SLICES.md)
- Second Brain / contesto Ambito: [`docs/agent-tasks/PLAN_SECOND_BRAIN_SLICES.md`](../agent-tasks/PLAN_SECOND_BRAIN_SLICES.md)
- Esempi verbali visita Mason (riferimento layout): [`docs/reference/mason-rdp/`](../reference/mason-rdp/)
