# Ruoli e licenze — studio, collaboratori e azienda cliente

Proposta di prodotto. **Nessun codice, nessuno script SQL, nessun deploy.** Le decisioni del 17/10/2026 sono approvate, anche le due che prima erano domande aperte: il cliente senza licenza propria consulta soltanto, e l’elenco moduli vuoto continua a significare tutti i moduli per le organizzazioni che esistono già.

Questo testo **modifica** la raccomandazione A3 «cestino e ripristino solo per admin e superadmin» ([A3-tracciabilita-soft-delete.md](A3-tracciabilita-soft-delete.md)). Il soft delete resta: Elimina non cancella la riga dal database. Cambia **chi** può aprire il cestino e ripristinare.

## Decisioni approvate il 17/10/2026

1. Lo **studio** è l’organizzazione. Ha un **proprietario** (admin di studio) e uno **staff di auditor**. Auditor e collaboratore sono la stessa figura. Lo studio fa consulenza a molte aziende clienti e ne gestisce la documentazione del sistema di gestione.
2. Tutti gli auditor dello studio lavorano su **tutte** le aziende dello studio e su **tutti** i moduli acquistati dallo studio, inclusi WPS, WPQR e Commesse. Caricano, modificano ed **eliminano** (soft delete A3).
3. **Cestino e ripristino** anche per gli auditor, solo dentro il proprio studio. Non vedono il cestino di un altro studio.
4. Il **viewer** resta in sola lettura e non elimina nulla.
5. L’**azienda cliente** vede solo i propri contenuti. Se il proprietario dell’azienda **acquista licenze**, diventa **admin della sola propria azienda** (utenti, cestino e documenti propri) e usa **solo** i moduli acquistati. L’azienda resta collegata allo studio: proprietario e auditor dello studio continuano a lavorarci.
6. **Niente bypass** dei moduli non acquistati per gli admin. Oggi l’admin passa sempre dall’API anche se il modulo non è nel suo elenco: questo non resta. Lo studio lavora con le licenze dello studio. L’admin dell’azienda lavora con le licenze dell’azienda. Se un modulo è dello studio ma non dell’azienda, l’auditor dello studio lo usa sui dati di quell’azienda e l’admin azienda no. Se è dell’azienda ma non dello studio, lo usa l’admin azienda e non lo staff dello studio, salvo che lo studio abbia la stessa licenza.
7. Il **cliente senza licenza propria solo consulta**. Non carica e non modifica. Quando acquista, diventa admin della sola propria azienda (decisione 5).
8. **Elenco moduli vuoto = tutti i moduli**, sì, per le organizzazioni che esistono già. Non si inverte questa regola. L’interruttore per accendere e spegnere i moduli di uno studio c’è già ed è del superadmin: è descritto sotto, com’è nel programma oggi. La licenza della singola azienda non c’è ancora.

## Modello in parole semplici

| Figura | Chi è | Cosa fa |
|---|---|---|
| Superadmin | Piattaforma (non uno studio cliente) | Assegna gli studi e le licenze. Sui dati di uno studio non salta i moduli non acquistati da quello studio. |
| Admin di studio | Proprietario dello studio | Tutte le aziende dello studio, tutti i moduli acquistati dallo studio, utenti dello studio, cestino e ripristino dello studio. |
| Auditor (collaboratore) | Staff dello studio | Come il proprietario sul lavoro quotidiano: tutte le aziende, tutti i moduli dello studio, carica, modifica, elimina, cestino e ripristino. Non è il proprietario della piattaforma. |
| Viewer | Utente in sola lettura | Consulta. Non carica, non modifica, non elimina, non apre il cestino. |
| Cliente in consultazione | Azienda senza licenze proprie | Solo i contenuti della propria azienda. Solo consultare: non carica e non modifica. |
| Cliente con scrittura | Figura di oggi (`write` sull’azienda) | Oggi può anche eliminare nella propria azienda. Non è il modello approvato: se acquista, diventa admin d’azienda. |
| Admin d’azienda | Proprietario dell’azienda che ha acquistato | Solo la propria azienda: utenti, documenti e cestino di quella azienda, solo i moduli che l’azienda ha acquistato. Lo studio continua a entrare con le licenze dello studio. |

Non si aggiunge un ruolo nuovo nel database. I ruoli restano `superadmin`, `admin`, `auditor`, `viewer`. L’admin d’azienda è un `admin` legato alla sola azienda. Il cliente senza acquisto è un `viewer` legato alla sola azienda. L’auditor non ha un limite di azienda: vede tutte quelle dello studio.

## Oggi e proposta

Legenda breve. **Blocco Import** = l’utente riceve 403 prima della pagina, perché il controllo «solo admin» di Import PDF è montato su tutte le chiamate che vengono dopo (`importJobs.routes.js`). Non è una regola di prodotto. **Cestino** = vedere le righe eliminate e ripristinarle.

| Ruolo | Modulo | Oggi | Proposta |
|---|---|---|---|
| Superadmin | Qualifiche, WPS, WPQR, Commesse, NC, Documenti | Vede e modifica in tutte le organizzazioni. L’API non controlla se il modulo è acquistato. | Sui dati di uno studio vale la licenza di quello studio. Assegnare le licenze resta suo. |
| Superadmin | Cestino | Sì, nell’organizzazione in cui è entrato | Sì, nella stessa organizzazione, senza saltare i moduli |
| Admin di studio | Qualifiche | Vede, carica, modifica, elimina (revoca oppure cestino) in tutto lo studio | Uguale, solo se il modulo Qualifiche è acquistato dallo studio |
| Admin di studio | WPS, WPQR, Commesse | Vede, carica, modifica, elimina nel cestino | Uguale, solo se il modulo Saldatura è acquistato dallo studio |
| Admin di studio | NC | Vede, carica, modifica, elimina nel cestino, anche le NC non legate a un audit | Uguale, solo se il modulo NC è acquistato dallo studio |
| Admin di studio | Documenti | Vede, carica, modifica. Eliminare li segna obsoleti: non finiscono nel cestino | Eliminare li mette nel cestino dello studio (serve un passo successivo: oggi la tabella documenti non ha il cestino) |
| Admin di studio | Cestino | Sì, tutto lo studio | Sì, tutto lo studio, solo i moduli acquistati |
| Auditor | Qualifiche | Vede, carica, modifica e **può eliminare** in tutta l’organizzazione. Il cestino no | Vede, carica, modifica, elimina e **cestino/ripristino** su tutte le aziende dello studio |
| Auditor | WPS, WPQR, Commesse | **Blocco Import**: non le vede nemmeno. Senza quel blocco potrebbe anche eliminarle | Come l’admin di studio: tutte le aziende, modulo Saldatura dello studio, elimina e cestino |
| Auditor | NC di un audit | Vede, carica, modifica, elimina. Cestino no | Come l’admin di studio, cestino compreso |
| Auditor | NC non di audit | No, solo l’admin | Sì, come il resto della documentazione dello studio |
| Auditor | Documenti | Vede, carica, modifica, può segnarli obsoleti | Come l’admin di studio, cestino compreso quando i documenti ci entreranno |
| Auditor | Cestino | No | **Sì, solo il proprio studio.** È il cambio rispetto ad A3 |
| Viewer | Qualifiche, NC di audit, Documenti | Vede. Non carica, non modifica, non elimina | Resta solo consultazione, su tutte le aziende dello studio, solo i moduli dello studio |
| Viewer | WPS, WPQR, Commesse | **Blocco Import**: non le vede | Le consulta. Non carica, non modifica, non elimina |
| Viewer | NC non di audit | Non le vede | Le consulta, senza modifiche |
| Viewer | Cestino | No | No |
| Cliente read | Qualifiche, NC, Documenti | Solo la propria azienda, senza modifiche, dove il filtro azienda c’è già | Solo la propria azienda, solo consultazione, solo i moduli che lo studio le lascia vedere finché non acquista |
| Cliente read | WPS, WPQR, Commesse | **Blocco Import** se non è admin | Solo consultazione della propria azienda, se il modulo è tra quelli che lo studio le lascia vedere |
| Cliente read | Cestino | No | No |
| Cliente write | Qualifiche, NC di audit, Documenti | Solo la propria azienda, ma **può eliminare** | Non è la figura approvata. Finché non acquista resta in consultazione. Se acquista, diventa admin d’azienda |
| Cliente write | WPS, WPQR, Commesse, Cestino | Blocco Import oppure niente cestino | Stessa regola: o consulta, o è admin d’azienda |
| Admin d’azienda | Qualifiche, WPS, WPQR, Commesse, NC, Documenti | Non esiste come figura distinta. Un admin vede tutto lo studio e l’API non guarda l’elenco moduli | Solo la propria azienda. Carica, modifica, elimina. Solo i moduli **acquistati dall’azienda**, anche se lo studio ne ha altri |
| Admin d’azienda | Cestino | Un admin oggi vede il cestino di tutto lo studio | Solo le righe della propria azienda, e può ripristinarle |

Esempio sulle licenze, già deciso. Lo studio ha Saldatura e l’azienda no: l’auditor apre le WPS di quell’azienda, l’admin azienda no. L’azienda ha un modulo che lo studio non ha: lo usa l’admin azienda, lo staff dello studio no. Se lo studio compra lo stesso modulo, lo staff torna a usarlo.

## Cosa va cambiato nel programma (senza farlo in questa PR)

- **Import PDF.** Il controllo «solo admin» vale per tutte le chiamate che arrivano dopo quel file, non solo per l’import. Va limitato alle pagine di import. È un difetto di montaggio, non una regola.
- **Auditor.** Tutte le aziende dello studio, tutti i moduli acquistati dallo studio, soft delete, cestino e ripristino nel proprio studio. Le NC non legate a un audit rientrano in questo lavoro.
- **Viewer.** Sola lettura anche su WPS, WPQR e Commesse, dopo la correzione dell’import. Il controller di quelle pagine oggi non ferma un viewer di studio: va allineato a qualifiche e documenti.
- **Cestino.** Aprire lista e ripristino anche all’auditor, sempre filtrati sull’organizzazione del login. Un altro studio risponde come se la riga non ci fosse.
- **Admin d’azienda.** Stesso ruolo `admin`, ma con il perimetro della sola azienda: utenti, documenti e cestino di quella azienda. Non vede le altre aziende dello studio. Proprietario e auditor dello studio restano abilitati su quell’azienda con le licenze dello studio.
- **Licenze.** Togliere il passaggio automatico di admin e superadmin sulle API dei moduli. Lo studio legge `organizations.licensed_modules`. L’azienda ha un elenco proprio (colonna o tabella nuova, **migrazione additiva in una PR successiva, non in questa**). I documenti, oggi solo «obsoleti», entrano nel cestino solo con un’altra migrazione additiva: la 176 li ha lasciati fuori di proposito. Nessun file SQL in questa PR.
- **Elenco vuoto.** Decisione del 17/10/2026: se l’elenco dell’organizzazione è vuoto, i moduli restano tutti accesi. Vale per le organizzazioni che esistono già. Non si cambia questo comportamento insieme al resto.
- **Licenza d’azienda.** Non esiste oggi. Il passo è descritto sotto e resta una PR successiva, con migrazione additiva. Non in questa.

## Passi, in ordine, prima su TEST

Ogni passo si prova sullo studio di prova. Non si usano i dati di MASON né di ERAM per le prove di scrittura.

1. **Sbloccare WPS e commesse.** Limitare il controllo admin alle sole route di Import PDF. Test: un auditor e un viewer dello studio di prova ricevono 200 sulle liste WPS, WPQR e commesse; un viewer che chiama l’import riceve ancora 403.
2. **Viewer fermo sulle scritture.** Dopo il passo 1, il viewer non deve poter creare, modificare o eliminare WPS, WPQR e commesse. Test: GET 200, POST/PUT/DELETE 403, cestino 403.
3. **Auditor operativo.** Carica, modifica, elimina (soft delete) su tutte le aziende dello studio di prova, e apre cestino e ripristino solo di quello studio. Test: l’auditor vede la riga nel cestino, la ripristina, e una riga di un’altra organizzazione risponde 404. I test che oggi si aspettano «auditor = 403 sul cestino» vanno aggiornati: quella regola A3 non vale più.
4. **Niente bypass admin.** Su uno studio di prova con elenco moduli scritto e senza Saldatura, l’admin riceve 403 sull’API WPS, non solo il menu nascosto. Su uno studio con elenco vuoto i moduli restano tutti: è la regola approvata, non una prova da invertire. Non spegnere moduli a un’organizzazione che oggi ha l’elenco vuoto.
5. **Admin d’azienda e licenze d’azienda.** Dopo la migrazione additiva (PR a parte): l’admin d’azienda vede solo la propria azienda e il cestino di quella azienda; un modulo solo dello studio gli risponde 403 e all’auditor 200; un modulo solo dell’azienda risponde 200 a lui e 403 all’auditor. Lo studio continua a entrare.

## Rischi

- **Elenco vuoto.** La regola resta «tutti i moduli» per le organizzazioni già esistenti. Invertirla spegnerebbe gli studi che oggi non hanno un elenco scritto. Su TEST, lettura del 17/10/2026, l’elenco è vuoto per le organizzazioni 1001, 1002 e 1005.
- **Admin che oggi passano lo stesso.** Se l’elenco dello studio è compilato e manca un modulo che usano solo perché l’API non controlla, dopo il passo 4 quel modulo si chiude anche per il proprietario. Va controllato l’elenco reale prima, sullo studio di prova, non in produzione al buio.
- **Cestino più largo.** Gli auditor vedranno e ripristineranno righe di tutto lo studio, non solo le proprie. È voluto. Non devono vedere un altro studio.
- **Documenti.** Finché non c’è la migrazione additiva, «elimina documento» resta «obsoleto» e non compare nel cestino. Non promettere il cestino documenti nel primo passo.

## Interruttore superadmin, com’è oggi

Verificato nel codice e con una lettura sul database di TEST il 17/10/2026. Nessun login: `last_login` non è stato aggiornato. Nessuna scrittura.

**Sì, l’interruttore c’è.** Si salva nella colonna `organizations.licensed_modules`. È l’unica colonna di licenza moduli nel database. Vuoto o NULL significa tutti i moduli noti. Un elenco JSON significa solo quelle chiavi. Quando il superadmin salva, il modulo Audit resta sempre dentro. La scelta «tutti i moduli» (`use_defaults`) rimette la colonna a NULL.

Lo usa **solo il superadmin**, in due pagine:

- Gestione → Utenti, sezione «Licenze moduli per studio». Una riga di caselle per ogni studio. Il testo in pagina dice: nessuna selezione esplicita = tutti i moduli attivi. La licenza Saldatura include sempre i CND, anche se CND non è spuntato a parte.
- Impostazioni → Licenze moduli (`/settings/licenses`). Il superadmin sceglie lo studio e salva. L’admin dello studio può aprire la pagina e **leggere** le licenze del proprio studio. Non può salvarle.

Le chiamate sono sotto `/api/v1`:

- Lettura del proprio studio: `GET /admin/licenses` (admin e superadmin).
- Scrittura: `PATCH /admin/licenses` e `PATCH /admin/organizations/:id/licenses`. Entrambe solo superadmin.
- Elenco studi: `GET /admin/organizations`, solo superadmin.

**Menu.** Se l’elenco è vuoto, il menu mostra tutti i moduli. Se è scritto, nasconde le voci che non ci sono. L’admin non salta questo filtro del menu, salvo due eccezioni già nel codice: il profilo di conformità e Material Compliance.

**API.** Chi chiama un modulo fuori dall’elenco effettivo riceve 403 con codice `MODULE_NOT_LICENSED`, admin e superadmin compresi (`moduleLicense.middleware.js`, file protetti, coda di ingest). Elenco vuoto o NULL resta tutti i moduli. Il superadmin continua a salvare le licenze. La decisione 6 è applicata sulle API.

Su TEST (database `2026-06-18_SGQ_ISO9001`), il 17/10/2026:

- Elenco vuoto, quindi tutti i moduli: organizzazioni **1001**, **1002**, **1005**.
- Elenco scritto: organizzazioni **1003** e **1004**. Le chiavi salvate sono audit, documents, qualifiche, nc, rischi, reclami, notifications, sal, saldatura, ai_import, ai_assist, ai_norms, ai_review, ai_chat. Non sono scritte: riesame_direzione, cnd, strumenti. I CND restano raggiungibili lo stesso, perché Saldatura li include al momento del controllo, senza scriverli in colonna.

## Licenza della singola azienda

**No. Oggi non esiste.** Non c’è una colonna sulle aziende e non c’è un’altra tabella di moduli per azienda. Il legame persona–azienda (`user_company_access`) è solo il permesso di leggere o scrivere, non un elenco di moduli.

Per estendere lo stesso interruttore, in una PR successiva e senza farlo qui, servirebbe:

- una colonna o una tabella nuova, additiva, con le chiavi modulo **per azienda**;
- la stessa pagina del superadmin, con un secondo livello: prima lo studio, poi l’azienda di quello studio;
- il controllo delle chiamate: lo staff dello studio continua a usare `organizations.licensed_modules`; l’admin d’azienda usa l’elenco della propria azienda;
- il menu della persona azienda filtrato su quell’elenco.

L’assenza di licenza d’azienda **non** va letta come «tutti i moduli». Per l’organizzazione, vuoto = tutti i moduli (decisione 8). Per l’azienda, nessuna licenza propria = solo consultazione, nei moduli che lo studio le lascia vedere (decisione 7). L’elenco d’azienda nasce quando l’azienda acquista.
