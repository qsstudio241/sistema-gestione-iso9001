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
- Owner / admin di studio: gestisce il proprio studio.
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

## Manutenzione

Dopo ogni revisione, se è emerso un **tipo di problema nuovo** o un **falso
allarme**, aggiornare [`casi.md`](casi.md) e, se la regola vale per tutte le
PR future, anche la checklist di questa skill. Farlo nella stessa PR di
follow-up che corregge il bug, oppure in una piccola PR di sola documentazione.
Non lasciare la lezione solo nella chat.

## Registro

I casi reali, con data, PR, area e regola imparata, stanno in
[`casi.md`](casi.md). Leggerlo all'inizio, prima del diff.
