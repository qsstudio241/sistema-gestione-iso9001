# Piano di rilascio in produzione — ottobre 2026

Lettura fatta il 18 ottobre 2026, solo consultazione. Database `SGQ_ISO9001` sul servizio `sgq-backend` (`sistemi.fr-busato.it`). Nessun backup, nessuna migrazione, nessun deploy, nessun riavvio, nessuna email, nessuna modifica ai dati.

**Questo documento non è il sì.** In produzione non si fa nulla finché il committente non dà un sì separato, per iscritto, su questa finestra.

Finestra consigliata, quando arriverà quel sì: **sera o weekend**, quando MASON e ERAM non stanno compilando verbali, qualifiche o commesse. Tempo complessivo indicativo, se non ci sono intoppi: circa un’ora e mezza, più lo smoke fatto insieme al superadmin del committente.

---

## Stato trovato

### Servizio

- `sgq-backend` è attivo. **MainPID `1000083`**, avviato il 17 ottobre 2026 alle 10:19 UTC. È il numero atteso dalle letture precedenti. Non è una sorpresa e non è un motivo per riavviare.
- Il controllo pubblico `https://sistemi.fr-busato.it:8443/api/v1/health` risponde bene e il database risulta raggiungibile. Il tempo di accensione combacia con quel PID.

### Migrazioni

Non c’è una tabella registro delle migrazioni. Vale lo schema, letto con sole SELECT.

L’attesa era che la 173, 174, 175, 176, 177, 178, 179 e 180 fossero tutte ancora da applicare. **Non è così.**

Già presenti sullo schema (non sono pendenti):

| Migrazione | Cosa si vede |
|---|---|
| 169 (traccia) | Sulle WPQR la colonna `expiry_date` non c’è: è coerente con la 169, che la toglie |
| 170 | Indice allegati dei verbali CND presente |
| 171 | Colonne di input del Riesame Direzione presenti |
| 172 | Tabelle dell’assistente AI presenti |
| **173** | Tabella delle passate WPQR presente. Sulle WPQR ci sono tutte e 32 le colonne di prova |
| **174** | Tabella dei legami WPS–WPQR presente |
| **175** | Tabella del diario modifiche presente |
| **176** | Colonna cestino `deleted_at` presente su qualifiche, WPS, WPQR, passate, legami, saldatori di WPS, commesse, saldatori di commessa, non conformità, allegati, azioni NC, documenti e allegati del riesame |

Ancora assenti (queste sì, pendenti):

| Migrazione | Cosa manca |
|---|---|
| **177** | Colonna fase del verbale CND (`inspection_phase`): colonna assente |
| **178** | Due date della visita oculistica sulle qualifiche: colonne assenti |
| **179** | Collegamento del verbale al patentino (`inspector_qualification_id`): colonna assente |
| **180** | Tabella «controlli previsti» della commessa (`project_inspection_items`): tabella assente |

### Commit in esecuzione

**Backend.** Nella cartella `/var/www/sgq-backend` non c’è un repository git e non c’è un file con lo SHA. Il processo è `node src/server.js`, senza commit nella riga di comando. L’albero non coincide con un solo commit di `main`.

Confronto fatto il 18 ottobre 2026 con `origin/main` = `a8c46231ad021d0f28d8cebd9c058803bbbce68e` (è ancora la punta dopo la #836; `main` non è andato oltre).

- `server.js` coincide con `main`. L’ultima modifica di quel file è del 17 ottobre 2026 (cestino).
- Qualifiche, commesse, WPS/WPQR e il cestino in esecuzione sono fermi ai commit del 17 ottobre 2026 sul cestino. Su `main` ci sono, dopo, le due date oculistiche, il selettore del Riesame Requisiti in commessa, i controlli previsti, il rispetto dei moduli anche per admin e superadmin.
- Il controller dei verbali CND in esecuzione è fermo al 26 agosto 2026 (posa del verbale nel Registro). Su `main` ci sono la fase prima/durante/dopo, l’id del patentino e la tolleranza se la colonna non c’è ancora.
- Il codice delle licenze moduli in esecuzione è fermo al 17 agosto 2026. Su `main` admin e superadmin rispettano l’elenco moduli dello studio (è il pezzo che serve al test «modulo spento → 403»).

In breve: il backend acceso conosce cestino, passate e diario (173–176). Non conosce fase del verbale, patentino sul verbale, due date oculistiche e controlli previsti (177–180).

**Frontend.** Il sito `https://systemgest.netlify.app` pubblica il commit `b65e8f87537800198b1aa7de98bfc2d8926ffe39` (PR #839, tendina patentini), dal 18 ottobre 2026 alle 19:21 UTC. Deploy id `6ad51c1fb56825e4edc67abf`.

Un tentativo successivo di pubblicare `a8c46231` (la #836, solo documentazione) è finito in stato `error` e **non** ha sostituito il sito. L’API di Netlify non riporta un messaggio di errore. Tra `b65e8f87` e `a8c46231` non ci sono file dell’app: solo documenti. Il codice delle pagine pubblicato è quindi lo stesso codice app di `main`, anche se lo SHA del sito non è lo SHA di `main`.

Quel sito contiene già le schermate nuove: Controlli previsti in Commesse, fase e patentino nei Verbali CND, due date oculistiche in Qualifiche, passate e cestino nelle Procedure WPS/WPQR. Il backend acceso e le colonne 177–180 non ci sono. Le pagine possono rispondere male finché backend e migrazioni non arrivano insieme. Non ho aperto le pagine: era vietato lo smoke.

### Moduli di MASON e di ERAM

Le licenze stanno sulla colonna `licensed_modules` delle **organizzazioni**, non sulle schede azienda. Un valore vuoto (`NULL`) significa, per il programma, tutti i moduli accesi.

| Organizzazione | Id | Moduli |
|---|---|---|
| MASON_Srl | 1003 | Elenco esplicito. Ci sono **Riesame Direzione** (`riesame_direzione`) e **Strumenti** (`strumenti`), insieme ad Audit, Documenti, Qualifiche, Non Conformità, Rischi, Reclami, Notifiche, SAL, Saldatura, Import PDF, assistenti AI, Riesame Requisiti, CND |
| ERAM | 1004 | Stesso elenco di MASON **senza** Riesame Direzione e **senza** Strumenti. Il CND c’è |
| Al.project | 1001 | Vuoto: tutti i moduli |
| QS_Studio | 1002 | Vuoto: tutti i moduli |
| GrokBot Studio Test | 1008 | Vuoto: tutti i moduli |
| Fausto Busato | 1007 | Elenco corto: Audit, Documenti, Notifiche, SAL e gli assistenti AI. Senza Qualifiche, Non Conformità, Rischi, Reclami, Saldatura, CND, Riesame Direzione, Strumenti |

Sul prova, a MASON erano stati accesi Riesame Direzione e Strumenti. **In produzione è già così.** ERAM non li ha. Questo piano non accende e non spegne nulla.

Nota a margine, non toccata: in anagrafiche ci sono due schede «ERAM TECHNOLOGIES» e «ERAM-Technologies», con `auditor_org_id` 3 e 4. Quegli id non sono le organizzazioni 1003 e 1004. La licenza letta è quella dell’organizzazione ERAM (1004).

### Conteggi (niente nominativi)

| Dato | Numero | Note per le migrazioni |
|---|---|---|
| Qualifiche | 151 | 143 MASON, 5 ERAM, 3 Al.project. `deleted_at` presente, righe nel cestino: 0. Date oculistiche: colonna assente |
| Verbali CND | 4 | 1 MASON, 3 Al.project, 0 ERAM. Fase: colonna assente. Patentino: colonna assente |
| Commesse | 4 | 1 MASON, 1 ERAM, 2 Al.project. Controlli previsti: tabella assente. `deleted_at` presente, nel cestino: 0 |
| WPQR | 13 | 11 MASON, 2 Al.project, 0 ERAM. Colonne di prova della 173 presenti, ma nessuna WPQR ha un valore compilato. Nel cestino: 0 |
| Passate WPQR | 0 | Tabella presente, vuota |
| WPS | 0 | Tabella presente. Nel cestino: 0 |
| Legami WPS–WPQR | 0 | Tabella presente, vuota |
| Diario modifiche | 0 | Tabella presente, vuota |
| Non conformità | 32 | `deleted_at` presente, nel cestino: 0. Gruppi duplicati che bloccherebbero l’indice unico: 0 |
| Allegati | 341 | `deleted_at` presente, nel cestino: 0 |
| Qualifiche duplicate (stesso certificato attivo) | 0 gruppi | L’indice unico è già quello del cestino |

### Rischio dati, in concreto

Le 177, 178, 179 e 180 **non trovano valori incompatibili**. Aggiungono colonne vuote o una tabella nuova:

- 4 verbali riceverebbero fase e patentino vuoti. Non esiste un valore già scritto che possa violare il vincolo «prima / durante / dopo».
- 151 qualifiche terrebbero la scadenza unica. Le due date nuove nascerebbero vuote.
- 4 commesse resterebbero com’è. La tabella dei controlli previsti nascerebbe vuota.
- 0 WPS, 0 legami, 0 passate, 0 WPQR con dati di prova compilati, 0 righe nel cestino. Non c’è un dato vecchio che collida con il cestino o con «la WPS ignora le WPQR cestinate».

Il rischio concreto è un altro: **il sito pubblicato è più avanti del backend**. Le schermate nuove ci sono già; colonne e codice del server no. Finché non si rilasciano insieme migrazioni 177–180 e backend di `main`, quelle pagine possono fallire. Non è stato misurato cliccandole.

Le 173–176 sono già applicate e le colonne sono vuote. Rifarle non dovrebbe riscrivere righe (gli script controllano se l’oggetto c’è già). **Toglierle sì che rompe il backend acceso**, perché quel codice legge già cestino, passate e diario, anche se oggi le tabelle nuove sono a zero.

---

## Passi ancora non eseguiti

Ordine da tenere, solo dopo il sì separato. Dopo ogni migrazione: una SELECT di verifica, poi si passa alla successiva. Se la verifica fallisce, ci si ferma e si usa il rollback di quel passo. Non si prosegue «tanto poi si sistema».

### 1. Backup del database di produzione

- Cosa: backup SQL Server del database `SGQ_ISO9001`, file con data e ora, sul server. Non un export parziale.
- Tempo: circa 15 minuti.
- Rollback: il backup non si annulla. È il punto a cui si torna se un passo dopo fallisce (ripristino di questo file).
- Rischio: se qualcuno scrive durante il backup, la copia può non essere l’ultimo secondo. Per questo la finestra è sera o weekend.

### 2. Backup della cartella backend

- Cosa: copia di `/var/www/sgq-backend` in una cartella a parte, con data. Si copia, non si sposta. Restano fuori dalla chiacchierata i file di segreti: non vanno in git.
- Tempo: circa 5 minuti.
- Rollback: ricopiare questa copia sopra la cartella di lavoro e riavviare il servizio (passo 13). Controllare che il MainPID cambi e che l’health risponda.
- Rischio: basso. Senza questa copia non si torna indietro dal deploy.

### 3. Migrazione 173 — solo verifica

- Già applicata. Non rilanciarla.
- Verifica: tabella passate presente, 32 colonne di prova presenti, 13 WPQR ancora senza dati di prova compilati (o il numero del momento, se nel frattempo qualcuno ha scritto).
- Tempo: circa 2 minuti.
- Rollback: **non** usare `database/migrations/173_rollback.sql` in questo rilascio. Quel file cancella la tabella delle passate e le 32 colonne, compresi i valori scritti dopo. Il backend acceso le usa già. Servirebbe un sì a parte, il backup, e il ritorno al backend precedente.
- Rischio se la si rilancia lo stesso: gli script sono idempotenti, ma è un gesto inutile sul database vero.

### 4. Migrazione 174 — solo verifica

- Già applicata. Tabella legami presente, oggi 0 righe.
- Tempo: circa 2 minuti.
- Rollback: non usare `174_rollback.sql` in questo rilascio (cancella i legami, anche quelli creati dopo).
- Rischio: come la 173.

### 5. Migrazione 175 — solo verifica

- Già applicata. Diario presente, oggi 0 righe.
- Tempo: circa 2 minuti.
- Rollback: non usare `175_rollback.sql` in questo rilascio (cancella il diario).
- Rischio: come la 173.

### 6. Migrazione 176 — solo verifica

- Già applicata. `deleted_at` presente, oggi 0 righe nel cestino. Indici unici di qualifiche e non conformità già allineati al cestino. Duplicati che bloccherebbero quegli indici: 0.
- Tempo: circa 2 minuti.
- Rollback: non usare `176_rollback.sql` in questo rilascio. Toglie le colonne del cestino. Il backend acceso le legge: le pagine andrebbero in errore anche con il cestino vuoto.
- Rischio: come la 173.

### 7. Migrazione 177 — da eseguire

- Aggiunge la fase del verbale (prima / durante / dopo), vuota, sulle righe già presenti.
- Verifica: la colonna c’è; i verbali esistenti restano senza fase; nessun valore fuori dai tre ammessi.
- Tempo: circa 2 minuti.
- Rollback: togliere il vincolo `CK_ndt_reports_inspection_phase` e poi la colonna. Non esiste un file `177_rollback.sql`. Farlo solo se la 177 di questa finestra è andata storta e nessuno ha già scelto una fase. Se il backend nuovo è già acceso, insieme alla colonna va ripristinato anche il backend del passo 2.
- Rischio: basso sui 4 verbali attuali, perché la colonna nasce vuota. Il vincolo non ha valori vecchi da rifiutare.

### 8. Migrazione 178 — da eseguire

- Aggiunge le due date oculistiche, vuote. La scadenza unica resta.
- Verifica: le due colonne ci sono; le qualifiche esistenti le hanno vuote; la scadenza unica è intatta.
- Tempo: circa 2 minuti.
- Rollback: eseguire `database/migrations/178_rollback.sql`. Toglie le due date e non tocca la scadenza unica. Se nel frattempo qualcuno le ha compilate, quei valori si perdono: per questo il backup viene prima, e il rollback si fa subito se la verifica fallisce, non il giorno dopo.
- Rischio: basso oggi (colonne assenti, 151 righe). Diventa perdita dati solo se si torna indietro dopo che le date sono state scritte.

### 9. Migrazione 179 — da eseguire

- Aggiunge il collegamento al patentino, vuoto, senza vincolo verso le qualifiche. Il nome già scritto sul verbale resta.
- Verifica: la colonna c’è; i verbali esistenti hanno il collegamento vuoto.
- Tempo: circa 2 minuti.
- Rollback: togliere la colonna `inspector_qualification_id`. Non esiste un file `179_rollback.sql`. I nomi già sul verbale non dipendono da questa colonna.
- Rischio: basso sui 4 verbali. Nessun id orfano possibile, perché la colonna nasce vuota e non ha una chiave esterna.

### 10. Migrazione 180 — da eseguire

- Crea la tabella dei controlli previsti, vuota. Non riscrive le 4 commesse.
- Verifica: la tabella c’è, ha 0 righe, le commesse sono ancora 4 (o il numero del momento).
- Tempo: circa 2 minuti.
- Rollback: eliminare la tabella `project_inspection_items` se è ancora vuota. Non esiste un file `180_rollback.sql`. Se qualcuno ha già inserito controlli, il drop li perde: ci si ferma e si usa il backup.
- Rischio: basso finché la tabella è vuota.

### 11. Deploy del backend di `main`

- Solo dopo 177, 178, 179 e 180 verificate. Si pubblica il backend di `origin/main` del momento del sì (il 18 ottobre era `a8c46231`). Prima del gesto: `git fetch origin main`.
- Verifica: health ok; nei file appena copiati compaiono fase del verbale, patentino, date oculistiche, controlli previsti, e il rispetto dei moduli per admin e superadmin.
- Tempo: circa 10 minuti.
- Rollback: ripristinare la copia del passo 2 e riavviare. Il MainPID deve cambiare. Health di nuovo ok.
- Rischio: il backend di `main` senza le colonne 177–180 cerca oggetti che non ci sono. Per questo le migrazioni vengono prima. Lo stesso backend, con i moduli spenti, risponde 403 anche ad admin e superadmin: è il comportamento da provare nello smoke, non da scoprire di lunedì mattina.

### 12. Deploy del frontend di `main` su Netlify produzione

- Il sito vivo è già il codice app di `main` (commit pubblicato `b65e8f87`). La #836 non cambia pagine. Va comunque chiuso il giro: un publish di `main` riuscito, così lo SHA del sito e lo SHA di `main` coincidono.
- Il publish di `a8c46231` del 18 ottobre è fallito e non ha sostituito il sito. Va capito l’errore di build prima di dare per fatto il passo. Se fallisce di nuovo, il sito resta quello di adesso, che per le pagine è lo stesso codice.
- Tempo: circa 5 minuti se la build passa.
- Rollback: su Netlify ripubblicare il deploy `6ad51c1fb56825e4edc67abf` (commit `b65e8f87`).
- Rischio: lasciare il frontend nuovo con il backend vecchio. In questa finestra il frontend è già avanti: il rimedio è il passo 11, non un altro publish isolato.

### 13. Riavvio del servizio

- Dopo il deploy del backend. Verificare che il **MainPID non sia più `1000083`**. Se resta `1000083`, il riavvio non è avvenuto e il codice nuovo non è quello che risponde.
- Tempo: circa 2 minuti, con una breve interruzione.
- Rollback: ripristinare la cartella del passo 2 e riavviare di nuovo. Il PID cambierà ancora. Health ok.
- Rischio: minuti in cui il sito non salva. Per questo la finestra è sera o weekend.

### 14. Smoke di produzione

- Gli stessi percorsi provati sul server di prova, sul sito vero, più il test che sul prova **non** è stato fatto: con il superadmin del committente, spegnere un modulo di prova (o usare uno studio che non lo ha) e verificare che la chiamata risponda **403**. Poi riaccendere ciò che si era spento, tornando all’elenco annotato sopra. Senza quel superadmin lo smoke non è completo.
- Tempo: circa 30 minuti, con il committente disponibile.
- Rollback: lo smoke non scrive lo schema. Se un percorso è rosso, ci si ferma e si torna indietro con i rollback dei passi 11, 13 e, se il guasto è una migrazione di questa finestra, 7–10. Non si corregge il database a mano.
- Rischio: il test del 403 cambia per un attimo l’elenco moduli se lo si fa spegnendo un modulo vero. Meglio uno studio di prova, oppure spegnere e riaccendere subito, con l’elenco di MASON e di ERAM sotto gli occhi. Non lasciare ERAM o MASON con un modulo tolto.

### 15. Controllo moduli di MASON e di ERAM

- Solo lettura, a fine finestra.
- Atteso, se nessuno ha toccato le licenze: MASON ha ancora Riesame Direzione e Strumenti; ERAM non li ha.
- Tempo: circa 5 minuti.
- Rollback: nessuno, è una lettura. Se l’elenco è diverso da quello di questo documento, lo si riporta uguale solo con un sì a parte.

---

## Aggiornamento 19 ottobre 2026

- Dipendenze backend aggiornate su `main` (PR #841): multer `2.4.0`, compression `1.8.2`, nodemailer `10.1.7`. Il deploy è stato fatto solo su TEST. Il backend di produzione non è stato aggiornato e non è stato riavviato.
- Verifica `GEMINI_MODEL` in produzione, sola lettura. Nel processo (MainPID `1000083`) la variabile non c’è: vale il default del codice, `gemini-3.8-flash`. Nel file di ambiente c’è già `gemini-3.8-flash`. Non punta a `3.7` né a `3.5`. Va bene. Non è stato modificato e il servizio non è stato riavviato.

---

## Cosa non fare

- Niente su produzione senza un sì separato. Questo file non è quel sì.
- Non riavviare il servizio adesso. Il MainPID `1000083` è quello atteso.
- Non rilanciare la 173, la 174, la 175 o la 176 «per sicurezza».
- Non eseguire i rollback della 173–176 in questa finestra.
- Non accendere Strumenti o Riesame Direzione su ERAM, e non spegnerli su MASON, dentro questo rilascio.
- Non pubblicare solo il frontend, e non accendere solo il backend nuovo, in due sere diverse.
- Non fare lo smoke di produzione, non mandare email, non applicare migrazioni, finché il sì non c’è.
