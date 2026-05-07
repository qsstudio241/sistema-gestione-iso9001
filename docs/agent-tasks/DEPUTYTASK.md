# DEPUTYTASK — NESSUN TASK ATTIVO (07/05/2026 sera)

> Migration 050 completata (TEST OK). Nessun task attualmente delegato al deputy.
> Prossima sessione: leggere `docs/agent-tasks/RIPRESA_SESSIONE_2026-05-07-B.md`.

---

<!-- archivio Migration 050 — norm_excerpt ISO 14001 — COMPLETATA -->
# [ARCHIVIATO] Migration 050: norm_excerpt ISO 14001:2015 (stralci normativi per Word export)

> **Data**: 07/05/2026  
> **Autore**: Lead Agent  
> **Tipo**: DB migration VPS + verifica export Word  
> **Branch**: nuovo branch `cursor/norm-excerpt-iso14001-XXXX` da `main`  
> **Nessuna migrazione schema** (colonna già presente). Solo popolamento dati.  
> **Chiusura attesa**: TEST OK

---

## Contesto

La colonna `norm_excerpt NVARCHAR(MAX)` esiste già in `checklist_questions`.  
Il codice di rendering nel Word export è già implementato (`wordExportHelpers.js` → `buildClauseTableOoxml`).  
Il frontend (`ExportPanel.jsx`) già fetcha i testi e li passa al builder.

**Problema**: tutti gli stralci sono `NULL`. Il Word export ISO 14001 quindi mostra domande senza stralcio normativo.

**Goal**: popolare `norm_excerpt` per le 53 domande ISO 14001 (question_id 223–275, standard_id=2).

---

## Mapping question_id → clausola → testo da estrarre

| question_id | Clausola | Stralcio da usare (testo breve, max ~300 car.) |
|-------------|----------|------------------------------------------------|
| 223 | §4.1 | "L'organizzazione deve determinare i fattori esterni ed interni rilevanti per le sue finalità e che influenzano la sua capacità di conseguire gli esiti attesi per il proprio sistema di gestione ambientale. Tali fattori devono includere le condizioni ambientali che sono influenzate o in grado di influenzare l'organizzazione." |
| 224 | §4.2 | "L'organizzazione deve determinare: a) le parti interessate rilevanti per il sistema di gestione ambientale; b) le esigenze e aspettative (cioè i requisiti) rilevanti di tali parti interessate; c) quali di queste esigenze e aspettative diventano suoi obblighi di conformità." |
| 225 | §4.3 | "L'organizzazione deve determinare i confini e l'applicabilità del sistema di gestione ambientale per stabilirne il campo di applicazione. Il campo di applicazione deve essere mantenuto come informazione documentata ed essere disponibile alle parti interessate." |
| 226 | §4.3 | "Nel determinare il campo di applicazione, l'organizzazione deve considerare: a) i fattori di cui al punto 4.1; b) gli obblighi di conformità di cui al 4.2; c) le unità organizzative, funzioni e confini fisici; d) attività, prodotti e servizi; e) autorità e abilità ad esercitare controllo e influenza." |
| 227 | §4.4 | "L'organizzazione deve stabilire, attuare, mantenere e migliorare in modo continuo un sistema di gestione ambientale, compresi i processi necessari e le loro interazioni, in conformità ai requisiti della norma." |
| 228 | §4.4 | "L'organizzazione deve considerare la conoscenza che deriva dai punti 4.1 e 4.2 quando stabilisce e mantiene il sistema di gestione ambientale." |
| 229 | §4.4 | "Tutte le attività, tutti i prodotti e tutti i servizi dell'organizzazione che rientrano nel campo di applicazione devono essere compresi nel sistema di gestione ambientale." |
| 230 | §5.1 | "L'alta direzione deve dimostrare leadership e impegno: accettando di rendere conto dell'efficacia del SGA; assicurando che siano stabiliti politica e obiettivi ambientali; assicurando la disponibilità delle risorse necessarie; comunicando l'importanza di una gestione ambientale efficace." |
| 231 | §5.1 | "L'alta direzione deve: assicurare che il SGA consegua gli esiti attesi; guidare e sostenere le persone affinché contribuiscano all'efficacia del SGA; promuovere il miglioramento continuo; supportare gli altri rilevanti ruoli gestionali." |
| 232 | §5.2 | "L'alta direzione deve stabilire, attuare e mantenere una politica ambientale che: a) sia appropriata alle finalità e al contesto; b) costituisca un quadro per fissare gli obiettivi ambientali; c) comprenda un impegno alla protezione dell'ambiente, inclusa la prevenzione dell'inquinamento." |
| 233 | §5.2 | "La politica ambientale deve comprendere un impegno a soddisfare i propri obblighi di conformità e un impegno per il miglioramento continuo del SGA. Deve essere mantenuta come informazione documentata, comunicata all'interno dell'organizzazione e disponibile alle parti interessate." |
| 234 | §5.3 | "L'alta direzione deve assicurare che le responsabilità e le autorità per i ruoli pertinenti siano assegnate e comunicate all'interno dell'organizzazione." |
| 235 | §5.3 | "L'alta direzione deve assegnare le responsabilità e autorità per: a) assicurare che il SGA sia conforme ai requisiti della norma; b) riferire all'alta direzione sulle prestazioni del SGA, compresa la prestazione ambientale." |
| 236 | §5.3 | "L'alta direzione deve supportare gli altri rilevanti ruoli gestionali nel dimostrare come attuare la propria leadership nelle rispettive aree di responsabilità." |
| 237 | §6.1.1 | "L'organizzazione deve stabilire, attuare e mantenere il(i) processo(i) necessario(i) per determinare rischi e opportunità correlati ai suoi aspetti ambientali, obblighi di conformità e altri fattori identificati ai punti 4.1 e 4.2. Deve mantenere informazioni documentate dei rischi e opportunità e dei processi richiesti." |
| 238 | §6.1.1 | "All'interno del campo di applicazione definito per il SGA, l'organizzazione deve determinare potenziali situazioni di emergenza, comprese quelle che possono avere un impatto ambientale." |
| 239 | §6.1.2 | "L'organizzazione deve determinare gli aspetti ambientali delle proprie attività, prodotti e servizi, considerando una prospettiva di ciclo di vita. Nel determinare gli aspetti ambientali deve tenere conto del cambiamento e delle condizioni anomale e di situazioni di emergenza ragionevolmente prevedibili." |
| 240 | §6.1.2 | "L'organizzazione deve determinare gli aspetti ambientali significativi utilizzando criteri stabiliti, comunicarli fra i diversi livelli e funzioni e mantenere informazioni documentate degli aspetti ambientali, dei criteri di valutazione e degli aspetti significativi." |
| 241 | §6.1.3 | "L'organizzazione deve: a) determinare e avere accesso agli obblighi di conformità relativi ai propri aspetti ambientali; b) determinare come questi obblighi si applicano; c) tenerli in conto nell'istituzione, attuazione, mantenimento e miglioramento del SGA. Deve mantenerne informazione documentata." |
| 242 | §6.1.4 | "L'organizzazione deve pianificare: a) di intraprendere azioni per affrontare i propri aspetti ambientali significativi, obblighi di conformità e rischi e opportunità; b) come integrare e attuare le azioni nei processi del SGA e come valutarne l'efficacia." |
| 243 | §6.2.1 | "L'organizzazione deve stabilire obiettivi ambientali relativi alle funzioni e ai livelli pertinenti, tenendo conto degli aspetti ambientali significativi e degli obblighi di conformità. Gli obiettivi devono essere: coerenti con la politica, misurabili, monitorati, comunicati, aggiornati. Devono essere mantenuti come informazione documentata." |
| 244 | §6.2.1 | "L'organizzazione deve stabilire obiettivi ambientali considerando i propri rischi e opportunità, gli aspetti ambientali significativi e gli obblighi di conformità associati." |
| 245 | §6.2.2 | "Nel pianificare come raggiungere i propri obiettivi ambientali, l'organizzazione deve determinare: a) cosa sarà fatto; b) quali risorse saranno richieste; c) chi ne sarà responsabile; d) quando sarà completato; e) come saranno valutati i risultati, compresi gli indicatori per monitorare il progresso." |
| 246 | §6.2.2 | "L'organizzazione deve considerare in che modo le azioni per il raggiungimento degli obiettivi ambientali possono essere integrate nei processi di business." |
| 247 | §7.1 | "L'organizzazione deve determinare e fornire le risorse necessarie per l'istituzione, l'attuazione, il mantenimento e il miglioramento continuo del sistema di gestione ambientale." |
| 248 | §7.2 | "L'organizzazione deve: a) determinare le competenze necessarie per le persone che svolgono attività lavorative con impatto ambientale o sull'adempimento degli obblighi di conformità; b) assicurare che tali persone siano competenti sulla base di istruzione, formazione o esperienza appropriate; c) determinare le esigenze di formazione." |
| 249 | §7.2 | "L'organizzazione deve, ove applicabile, intraprendere azioni per acquisire le necessarie competenze e valutare l'efficacia delle azioni intraprese. Deve conservare appropriate informazioni documentate quale evidenza delle competenze." |
| 250 | §7.3 | "L'organizzazione deve assicurare che le persone siano consapevoli: a) della politica ambientale; b) degli aspetti ambientali significativi associati alla loro attività; c) del proprio contributo all'efficacia del SGA; d) delle implicazioni derivanti dal non essere conformi ai requisiti del SGA." |
| 251 | §7.4 | "L'organizzazione deve attuare e mantenere il(i) processo(i) necessario(i) per le comunicazioni interne ed esterne pertinenti al SGA, includendo: cosa vuole comunicare; quando comunicare; con chi comunicare; come comunicare. Deve tenere conto degli obblighi di conformità e assicurare coerenza dell'informazione ambientale comunicata." |
| 252 | §7.4.2 | "L'organizzazione deve: a) comunicare internamente informazioni pertinenti al SGA fra i diversi livelli e funzioni, compresi i cambiamenti al SGA; b) assicurare che i propri processi di comunicazione consentano alle persone che svolgono attività lavorative di contribuire al miglioramento continuo." |
| 253 | §7.4.3 | "L'organizzazione deve comunicare esternamente informazioni pertinenti al SGA, come stabilito dai processi di comunicazione e come richiesto dai propri obblighi di conformità." |
| 254 | §7.5.1 | "Il SGA dell'organizzazione deve comprendere: a) le informazioni documentate richieste dalla presente norma; b) le informazioni documentate che l'organizzazione determina siano necessarie per l'efficacia del SGA." |
| 255 | §7.5.2 | "Nel creare e aggiornare le informazioni documentate, l'organizzazione deve assicurare appropriata: a) identificazione e descrizione; b) formato e supporto; c) riesame e approvazione in merito all'idoneità e all'adeguatezza." |
| 256 | §7.5.3 | "Le informazioni documentate richieste dal SGA devono essere tenute sotto controllo per assicurare che: a) siano disponibili e idonee all'utilizzo, dove e quando necessario; b) siano adeguatamente protette. Le attività di controllo comprendono: distribuzione, accesso; archiviazione e preservazione; tenuta sotto controllo delle modifiche; conservazione ed eliminazione." |
| 257 | §7.5.3 | "Le informazioni documentate di origine esterna, ritenute necessarie per la pianificazione e il funzionamento del SGA, devono essere identificate e tenute sotto controllo." |
| 258 | §8.1 | "L'organizzazione deve stabilire, attuare, tenere sotto controllo e mantenere i processi necessari per soddisfare i requisiti del SGA, stabilendo i criteri operativi per i processi e attuando il controllo dei processi in conformità ai criteri operativi." |
| 259 | §8.1 | "L'organizzazione deve tenere sotto controllo le modifiche pianificate e riesaminare le conseguenze dei cambiamenti involontari, intraprendendo azioni per mitigare ogni effetto negativo, per quanto necessario." |
| 260 | §8.1 | "L'organizzazione deve assicurare che i processi affidati all'esterno siano tenuti sotto controllo. Deve adottare una prospettiva di ciclo di vita: stabilire controlli per progettazione e sviluppo, determinare requisiti ambientali per l'approvvigionamento, comunicarli ai fornitori esterni e considerare la necessità di fornire informazioni sui potenziali impatti ambientali significativi dei propri prodotti e servizi." |
| 261 | §8.2 | "L'organizzazione deve stabilire, attuare e mantenere il(i) processo(i) necessario(i) per prepararsi a come dovrà affrontare e rispondere alle potenziali situazioni di emergenza. Deve prepararsi pianificando azioni per prevenire o mitigare impatti ambientali negativi e rispondere alle situazioni di emergenza reali." |
| 262 | §8.2 | "L'organizzazione deve: d) sottoporre periodicamente a prova le azioni di risposta pianificate, ove praticabile; e) riesaminare e revisionare periodicamente i processi e le azioni di risposta pianificate, in particolare dopo che si sono verificate situazioni di emergenza o di prova." |
| 263 | §8.2 | "L'organizzazione deve: f) fornire informazioni e formazione pertinenti in relazione alla preparazione e risposta alle emergenze, per quanto appropriato, alle parti interessate pertinenti, comprese le persone che svolgono attività lavorative sotto il suo controllo." |
| 264 | §9.1.1 | "L'organizzazione deve determinare: a) cosa è necessario monitorare e misurare; b) i metodi per il monitoraggio, la misurazione, l'analisi e la valutazione; c) i criteri rispetto ai quali l'organizzazione valuterà la propria prestazione ambientale e gli indicatori appropriati; d) quando il monitoraggio e la misurazione devono essere eseguiti; e) quando i risultati devono essere analizzati e valutati." |
| 265 | §9.1.1 | "L'organizzazione deve assicurare che l'attrezzatura di sorveglianza e misurazione tarata o verificata sia utilizzata e sottoposta a manutenzione. Deve valutare la propria prestazione ambientale, comunicare pertinenti informazioni internamente ed esternamente e conservare informazioni documentate quale evidenza dei risultati." |
| 266 | §9.1.2 | "L'organizzazione deve istituire, attuare e mantenere il(i) processo(i) per valutare l'adempimento dei propri obblighi di conformità. Deve: a) determinare con che frequenza valutare la conformità; b) valutare la conformità e intraprendere azioni se necessario; c) mantenere conoscenza e comprensione del proprio stato di conformità. Deve conservare informazioni documentate dei risultati della valutazione." |
| 267 | §9.2 | "L'organizzazione deve condurre, ad intervalli pianificati, audit interni allo scopo di fornire informazioni per accertare se il SGA: a) è conforme ai requisiti propri dell'organizzazione e ai requisiti della norma; b) è efficacemente attuato e mantenuto." |
| 268 | §9.2.2 | "L'organizzazione deve stabilire, attuare e mantenere un programma di audit interno comprensivo di frequenza, metodi, responsabilità, requisiti di pianificazione e reporting. Deve definire criteri e campo di applicazione per ciascun audit; selezionare auditor garantendo obiettività e imparzialità; riportare i risultati al pertinente livello direzionale e conservare informazioni documentate." |
| 269 | §9.3 | "L'alta direzione deve, a intervalli pianificati, riesaminare il SGA per assicurarne la continua idoneità, adeguatezza ed efficacia. Il riesame deve includere considerazioni su: stato azioni precedenti; cambiamenti nei fattori interni/esterni, obblighi di conformità, aspetti ambientali significativi, rischi e opportunità; grado di realizzazione degli obiettivi; prestazione ambientale (NC, monitoraggio, conformità, audit); adeguatezza delle risorse; comunicazioni delle parti interessate." |
| 270 | §9.3 | "Gli output del riesame di direzione devono comprendere: conclusioni sulla continua idoneità, adeguatezza ed efficacia del SGA; decisioni relative alle opportunità di miglioramento continuo; decisioni relative a ogni necessità di modifiche al SGA, comprese le risorse; azioni se gli obiettivi non sono stati raggiunti. L'organizzazione deve conservare informazioni documentate dei risultati dei riesami." |
| 271 | §10.1 | "L'organizzazione deve determinare opportunità di miglioramento (vedere punti 9.1, 9.2 e 9.3) e intraprendere le azioni necessarie al conseguimento degli esiti attesi del proprio sistema di gestione ambientale." |
| 272 | §10.2 | "Quando si verifica una non conformità, l'organizzazione deve: a) reagire alla non conformità e intraprendere azioni per tenerla sotto controllo e correggerla; b) affrontarne le conseguenze, compresa la mitigazione di impatti ambientali negativi; c) valutare l'esigenza di azioni per eliminare le cause della non conformità e attuare ogni azione necessaria." |
| 273 | §10.2 | "L'organizzazione deve: d) riesaminare l'efficacia di ogni azione correttiva intrapresa; e) effettuare, se necessario, modifiche al sistema di gestione ambientale. Le azioni correttive devono essere adeguate all'importanza degli effetti delle non conformità riscontrate, compresi gli impatti ambientali." |
| 274 | §10.2 | "L'organizzazione deve conservare informazioni documentate quale evidenza: della natura delle non conformità e di ogni successiva azione intrapresa; dei risultati di ogni azione correttiva." |
| 275 | §10.3 | "L'organizzazione deve migliorare in modo continuo l'idoneità, l'adeguatezza e l'efficacia del sistema di gestione ambientale per migliorare la prestazione ambientale." |

---

## Cosa fare

### FASE 1 — Crea il migration script `run-migration-050-vps.js`

Crea `backend/scripts/run-migration-050-vps.js` con questo pattern (identico a run-migration-049-vps.js):

```javascript
'use strict';
const { query } = require('/var/www/sgq-backend/src/config/database');

// Array: [question_id, norm_excerpt_text]
const excerpts = [
  [223, "L'organizzazione deve determinare i fattori esterni ed interni rilevanti..."],
  // ... tutti i 53 valori dalla tabella sopra
];

(async () => {
  console.log('=== Migration 050: norm_excerpt ISO 14001:2015 ===\n');
  let updated = 0;
  for (const [qid, text] of excerpts) {
    const escaped = text.replace(/'/g, "''");
    await query(`UPDATE checklist_questions SET norm_excerpt=N'${escaped}', updated_at=GETDATE() WHERE question_id=${qid} AND standard_id=2`);
    updated++;
  }
  console.log(`norm_excerpt aggiornati: ${updated}`);

  // Verifica
  const r = await query("SELECT COUNT(*) AS tot, SUM(CASE WHEN norm_excerpt IS NOT NULL AND norm_excerpt <> '' THEN 1 ELSE 0 END) AS filled FROM checklist_questions WHERE standard_id=2 AND is_active=1");
  console.log('Stato finale:', JSON.stringify(r.recordset));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
```

Popola `excerpts` con tutti i 53 valori dalla tabella mapping sopra (question_id 223–275).  
Testo di riferimento: `docs/Normative/Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md`  
I testi sono già estratti nella tabella sopra — usali così come sono.

### FASE 2 — Deploy VPS

```bash
scp -P 1122 -i $KEY backend/scripts/run-migration-050-vps.js spascarella@www.fr-busato.it:/tmp/
ssh -p 1122 -i $KEY spascarella@www.fr-busato.it \
  "cd /var/www/sgq-backend && DB_SERVER=localhost DB_PORT=11043 DB_DATABASE=SGQ_ISO9001 DB_USER=pascarella DB_PASSWORD='#Gestione2025@' NODE_ENV=production node /tmp/run-migration-050-vps.js"
```

Verifica attesa: `norm_excerpt aggiornati: 53` e `filled: 53`.

### FASE 3 — Test L1

```bash
cd app
NODE_ENV=test npm run test:run
npm run build
```

Entrambi devono passare senza errori.

---

## File toccati

| File | Azione |
|------|--------|
| `backend/scripts/run-migration-050-vps.js` | Crea (nuovo) |

**Nessun file frontend. Nessun file backend controller/routes. Nessuna migrazione schema.**

---

## Vincoli

- Non modificare il testo delle domande (`question_text`), solo `norm_excerpt`.
- Il testo del norm_excerpt deve essere estratto letteralmente dalla norma (non parafrasato).
- La tabella di mapping nella sezione "Cosa fare" ha già i testi pronti — usali direttamente.
- `norm_excerpt` per ISO 9001 (standard_id=1, question_id 87–121) è backlog separato — non toccare ora.

---

## Chiusura

Rispondere **TEST OK** con PR aperta + link.  
Aggiornare `docs/PROJECT_ROADMAP.md`: voce "Campo norm_excerpt" → ✅ ISO 14001 (07/05/2026).
