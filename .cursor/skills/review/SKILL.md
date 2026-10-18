---
name: review
description: >-
  Revisione di una PR del repo quando Bugbot non è disponibile, o come secondo
  parere. Usare quando l'utente chiede una review, un sostituto di Bugbot, un
  controllo del diff prima del merge, o un parere su bug di logica, permessi,
  licenze, SQL e casi limite. Non usarla per scrivere la funzione o per
  commenti di stile.
---

# Revisione PR — ProgettoISO

Sostituto di Cursor Bugbot, e secondo parere quando Bugbot ha già parlato.
Il codice applicativo non si tocca: si legge, si verifica, si lascia **un**
commento sulla PR. Le correzioni, se servono, sono un compito a parte.

Prima di aprire il diff, leggere sempre il registro
[`casi.md`](casi.md).

## Procedura

1. Allineare `origin/main`. Elencare le PR chieste (unite o aperte) e lo SHA
   del commit da giudicare.
2. Se Bugbot ha già una revisione **conclusa su quello stesso SHA** e il
   compito non chiede un secondo parere, saltare la PR e dirlo. Un check
   «usage limit» o una review su un commit più vecchio **non** contano come
   revisione fatta.
3. Leggere il diff, il codice intorno (non solo le righe cambiate), la
   descrizione della PR e le migrazioni collegate (`database/migrations/` e
   gli script `run-migration-*`).
4. Cercare bug di logica, casi limite raggiungibili, regressioni, permessi,
   licenze, SQL, `null`, sicurezza, test assenti sulla logica nuova. Usare
   la checklist sotto. Niente osservazioni di stile, nomi o formattazione.
   L'apostrofo al posto dell'accento nel testo che l'utente legge (`e'`,
   `piu'`) si segnala: è encoding, non stile.
5. **Verifica, prima di pubblicare.** Per ogni problema: rileggere il codice
   e confermare che sia reale e raggiungibile da un utente o da due operazioni
   vicine. Indicare file, righe e il percorso. Se resta un dubbio, o se un
   test documenta quel comportamento come voluto, **scartare**. Meglio un
   commento corto che un falso allarme.
6. Pubblicare **un solo** commento (formato sotto). Non aprire una seconda
   review, non modificare il codice, non fare push, merge, né toccare server,
   database, TEST o PROD.

## Quando Bugbot è disponibile

Revisione doppia. Il confronto si registra in [`casi.md`](casi.md).

1. Fare prima la revisione con questa skill **senza** aprire i commenti né il
   check di Bugbot. Salvare l'elenco (file, righe, gravità, percorso).
2. Solo dopo, leggere i commenti e il check di Bugbot **su quello stesso SHA**.
3. Classificare ogni problema: trovato da entrambi, solo Bugbot, solo noi,
   falso allarme (nostro o di Bugbot). Un commento di un giro precedente, se
   il codice di questo SHA non fa più quella cosa, è un falso allarme: non è
   un problema ancora aperto.
4. Per ogni problema visto solo da Bugbot, scrivere perché la skill non lo
   ha visto (controllo mancante, migrazione o default non letti, regola vicina
   non riesaminata).
5. Aggiornare `casi.md` (sezione «Confronto con Bugbot» e, se serve, un caso)
   e la checklist, se la regola vale per le PR successive.
6. Se Bugbot ha più giri sulla stessa PR, ripetere i passi 1–4 su **ogni**
   SHA precedente alla correzione, non solo sul primo. Un giro successivo è
   un diff diverso: le varianti (regex, ripristino, secondo filtro) non si
   ereditano dal giro precedente.

## Gravità

| Livello | Quando usarlo |
|---|---|
| **Alta** | Il programma autorizza un'azione vietata, attribuisce un documento alla persona sbagliata, o tratta come valido un dato scaduto o di un'altra azienda. L'utente non ha un modo semplice per accorgersene. |
| **Media** | Il caso si raggiunge con un uso normale o con due operazioni vicine (doppia richiesta, secondo salvataggio, deploy prima della migrazione, fuso orario). Il dato è sbagliato o incoerente, ma non è un via libera totale. |
| **Bassa** | Si recupera con un nuovo tentativo, oppure l'effetto è piccolo e il percorso è raro. Segnalare solo se il percorso è certo. |

## Formato del commento

Un unico commento in italiano semplice. Titolo esatto:

`Revisione automatica (sostituto Bugbot)`

Poi i problemi ordinati per gravità (alta, media, bassa). Per ciascuno:
file, righe, perché è un problema, come correggerlo. Se non c'è nulla di
rilevante, una riga sola che lo dice.

## Checklist ProgettoISO

Controllare solo ciò che il diff tocca.

**Ruoli**

- `superadmin`: attiva i moduli dello studio. Non salta i controlli di licenza.
- Owner / admin di studio: gestisce il proprio studio. Se non ha
  `auditor_org_id`, vede comunque le aziende del proprio studio: un 403
  svuota la tendina Ambito. Il viewer senza auditor_org non le vede.
- Auditor: può creare, modificare, cancellare e aprire il cestino del proprio studio.
- Viewer: sola lettura.
- Cliente senza licenza: sola consultazione.
- Admin di un'azienda cliente: solo la propria azienda, non le altre dello studio.

**Licenze e moduli**

- Lista moduli vuota o assente = tutti i moduli.
- Nessun ruolo, nemmeno admin o superadmin, apre un modulo spento.
- Ogni rotta nuova va legata al modulo giusto. Un controllo messo sul router
  intero, invece che sulla rotta del modulo, blocca anche il resto.

**Isolamento**

- Ogni query filtra per studio (`organization_id`) e, se il dato è aziendale,
  per azienda. Un record senza azienda non deve agganciarsi al dato di
  un'altra azienda.
- Vale anche per `UPDATE` e per il cestino, non solo per le `SELECT`. Una
  rotta nuova si confronta con `list` e `getOne` dello stesso controller.
- Dopo il primo controllo, la riga collegata (storia, padre, WPS della WPQR)
  usa lo stesso filtro. Un antenato di un'altra azienda, o senza azienda, non
  risponde 403 su tutta la storia. Se `company_id` del figlio è vuoto, si usa
  il padre, in lettura e in scrittura.

**Migrazioni SQL Server**

- Solo additive in `database/migrations/` (root). Niente `ON DELETE CASCADE`
  avventati. Statement separati.
- Il codice che legge una colonna nuova deve tollerare il periodo in cui la
  migrazione non è ancora applicata: niente errore opaco e niente elenco che
  si svuota in silenzio.

**Date, scritture, corse**

- Una data pura (`AAAA-MM-GG`) non va riletta con l'ora locale e riconvertita
  in UTC: il giorno slitta. Usare la data già normalizzata.
- Prima di scrivere una data, i token vuoti già usati negli altri campi
  (`N.A.`, `--`, trattino) diventano null. Non legare quel testo a una colonna
  `DATE`: fallisce l'inserimento del certificato.
- Due scritture che devono restare insieme stanno nella stessa transazione.
- Un codice che deve essere unico ha un vincolo sul database, non solo un
  controllo letto-poi-scritto. Il lucchetto deve coprire la stessa chiave su
  cui si può collidere (non solo il record di partenza).

**Scadenze e qualifiche**

- La scadenza efficace è la più restrittiva tra i dati presenti. Compilare un
  campo nuovo non deve spegnere una data più vecchia già scaduta, né dare per
  buona una scadenza lasciata vuota.
- Quella data, se entra in `SUM` o `COUNT` (card, badge), è un'espressione
  scalare. `MIN` dentro `SELECT` è un aggregato su una subquery: SQL Server
  risponde «Cannot perform an aggregate function on an expression containing
  an aggregate or a subquery» e la pagina resta vuota. Il `WHERE` della lista
  può tenere la subquery; le card no.

**Valori già in tabella**

- Un default di colonna (`NA`, `0`) non è «campo vuoto» se lo stesso token è
  anche un valore vero. Il candidato alla rielaborazione non deve restare per
  sempre, e una conferma successiva non deve coprire quel valore.

**Regole sullo stesso certificato**

- Se un processo è escluso da un controllo (niente materiale d'apporto, niente
  corrente), le regole vicine non devono chiedere quei campi. Il processo 311
  (ossiacetilenica) non è un arco.
- Un dato già presente su una passata non va segnalato come assente sul
  certificato solo perché la testata è vuota. Vale anche il contrario: la
  testata copre la riga.
- Aprire un record vecchio e salvarlo non deve scrivere un default al posto di
  un campo ancora vuoto (es. fase ispezione NULL che diventa «dopo»).

**Documenti generati**

- Word e PDF riportano l'autore del contenuto (chi ha compilato o approvato),
  non chi scarica il file. Se in tabella c'è solo un id, va unito il nome:
  non sostituirlo con l'utente corrente.

**Norme**

- Nessun testo di norma a pagamento nel repo. Si cita la fonte già presente,
  non si incolla il PDF.
- `EN287-1` senza trattino è la stessa norma di `EN 287-1`. Un confine di
  parola fra una lettera e una cifra non scatta (`N` e `2` sono entrambi
  caratteri di parola).

**Cestino**

- Conteggio, gate, copertura, notifiche, generazione e «già assegnato»
  escludono `deleted_at`. Un allegato cestinato non alza il badge.
- L'indice unico ignora le righe nel cestino. Creare il sostituto di un
  record cestinato non deve rispondere 409.

**Etichette estratte dal PDF**

- La prima regex non è il campo. «Range of validity» non è la scadenza;
  «Nato a» è un luogo, non una data di nascita; «Data di prova» è l'esame;
  una data di conferma non sostituisce la scadenza.
- «Illimitato» senza un numero non tiene il minimo già calcolato dall'AI.
- Il valore sulla stessa riga, dopo gli spazi di allineamento, non si scarta.
- Un prefisso (`valid`, `test`) non scarta un nome se manca il confine di
  parola: `Valentina` non è l'etichetta «valid».

**Normalizzazione**

- Canonizzare un codice di processo non cancella gli altri nella stessa
  stringa (`135, 138` non diventa solo `135`). Il testo storico
  (`783-STUD WELDING`) deve ancora selezionarsi e filtrarsi.
- Decimali italiani e suffissi (`12,5 mm`) non diventano null. Riusare
  `toNumericOrNull`, non un parse stretto.
- Se si aliasa `base_material_group`, si aliasa anche `base_material_group_2`.
- Se il campo nuovo è vuoto (`welding_process_test`), si legge il legacy
  (`welding_process`).

**Copertura numerica**

- Un estremo assente non è `0` (`Number('')` lo è). Fuori tabella non è
  «parziale»: è non coperto.
- Una WPQR stud (ISO 14555) non eredita il diametro piastra→tubo della 15614.
- Simboli di posizione fuori tabella non fanno sembrare assente ogni colonna
  qualificata. Il finding «manca il dato» resta; il «più stretto» no.

**Stato dopo un errore o un cambio ambito**

- Upload di più file: se uno fallisce, ricaricare il job prima di riprovare.
  Un flag «occupato» condiviso non è un caricamento a lotti.
- La conferma tiene la verifica appena mostrata, non la foto presa prima
  della modifica. Un override fallito non sostituisce la riga precedente.
  Una select già sul tipo rilevato si può confermare lo stesso.
- La chiave che deve ricaricare la coda va davvero aggiornata. Una risposta
  vecchia non reinserisce una riga già confermata. Cambiare ambito toglie
  dalla tabella il risultato dell'azienda precedente.
- La validazione numerica vale solo sui campi numerici. Etichetta di passata
  e polarità sono testo.

**Migrazioni e runner**

- Ogni file SQL nuovo ha `run-migration-N-vps.js`. Anche il brief che
  annuncia la migrazione lo elenca.
- Il controllo «sono in produzione?» non usa la sottostringa `test`. Il
  database di test vero è `2026-06-18_SGQ_ISO9001`.
- Le variabili `DB_*` non si copiano sia sulla sezione test sia su una
  sezione production clonata: il controllo le vede uguali e si ferma, oppure
  il DDL parte sul database sbagliato.
- Un test di CI non legge l'albero vivo `database/migrations/` se il prossimo
  file numerato cambierebbe il piano. Usa una fixture.

**Classificazione e intestazione**

- Il nome del file non è una prova per saltare l'OCR dell'intestazione.
- Non passare tutto l'OCR a un normalizzatore pensato per una sigla corta.
  Un secondo ente elencato in intestazione conta.
- I campi visibili seguono `qualification_type`, non una sottostringa di
  `standard_ref`. L'autosave non azzera un campo ancora a schermo.

**Privacy verso l'AI**

- Un numero di certificato, un codice di processo o un riferimento WPQR non
  è un telefono. Non riscriverlo con un segnaposto. Il campo personale
  (esaminatore, ispettore, nome) si oscura; un token tecnico corto non si
  scrive al posto del nome dentro un campo tecnico.

**Legami WPS e WPQR**

- Un pezzo di data (`10/08`) non è un riferimento di supporto.
- Il ruolo del legame non dipende da quale dei due documenti è stato
  caricato prima, se la coppia è una sola.
- Un errore di lookup non butta via un riferimento già risolto e non
  sostituisce un esito buono con «da verificare».

**Testo visibile**

- Accenti veri: è, più. Non `e'`, `piu'`.

## Manutenzione

Dopo ogni revisione, se è emerso un **tipo di problema nuovo** o un **falso
allarme**, aggiornare [`casi.md`](casi.md) e, se la regola vale per tutte le
PR future, anche la checklist di questa skill. Farlo nella stessa PR di
follow-up che corregge il bug, oppure in una piccola PR di sola documentazione.
Non lasciare la lezione solo nella chat.

## Registro

I casi reali, con data, PR, area e regola imparata, stanno in
[`casi.md`](casi.md). Leggerlo all'inizio, prima del diff.
