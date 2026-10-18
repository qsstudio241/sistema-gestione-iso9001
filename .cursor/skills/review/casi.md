# Registro casi — revisione PR

Casi reali emersi da una revisione (Bugbot o sostituto). Si aggiorna dopo
ogni revisione che trova un tipo di problema nuovo o un falso allarme.
La skill che lo usa è [`SKILL.md`](SKILL.md): va letto prima del diff.

Per ogni caso: data, PR, area, gravità, cosa è successo, regola generale.

## 18/10/2026

### Due casi, stesso codice, due commesse

- **Data:** 18/10/2026
- **PR:** [#811](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/811)
- **Area:** Riesame requisiti → commessa
- **Gravità:** media
- **Cosa è successo:** il lucchetto del passaggio vale solo per il singolo caso. Due riesami diversi, con lo stesso codice commessa, aperti insieme, non si vedono e possono creare due commesse. Sul codice non c'è un vincolo univoco.
- **Regola:** il lucchetto e l'indice univoco devono coprire la chiave su cui si collide (qui il codice commessa nello studio), non solo il record da cui si parte.

### Il secondo passaggio cambia il riesame e non la commessa

- **Data:** 18/10/2026
- **PR:** [#811](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/811)
- **Area:** Riesame requisiti → commessa
- **Gravità:** media
- **Cosa è successo:** se il caso è già collegato, un nuovo riferimento viene salvato sul riesame e la commessa resta col codice vecchio. La risposta mostra entrambi. Le due scritture non sono nella stessa transazione: se la seconda fallisce, la commessa c'è e il passaggio no.
- **Regola:** scritture che descrivono lo stesso fatto (collegamento e riferimento) stanno in una transazione. Un secondo salvataggio non deve far divergere i due lati.

### Riesame senza azienda agganciato a un'altra azienda

- **Data:** 18/10/2026
- **PR:** [#811](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/811)
- **Area:** isolamento aziende
- **Gravità:** media
- **Cosa è successo:** il controllo «azienda diversa» parte solo se il riesame ha un'azienda. Senza azienda, il passaggio prende la prima commessa con quel codice, anche se è di un'altra azienda dello studio.
- **Regola:** un record senza azienda non si collega al dato di un'azienda. Il filtro manca anche quando il campo è vuoto, non solo quando è diverso.

### Una data nuova spegne la scadenza già scaduta

- **Data:** 18/10/2026
- **PR:** [#813](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/813)
- **Area:** qualifiche, certificato oculistico, gate verbale CND
- **Gravità:** alta
- **Cosa è successo:** compilare solo la visita dell'acuità (o solo i colori) fa ignorare la scadenza unica e l'orologio lasciato vuoto. Un certificato scaduto nel 2020 con una visita al 2027 risulta valido e può sbloccare il verbale.
- **Regola:** la scadenza efficace è la più restrittiva tra le date presenti. Un campo nuovo compilato non spegne una data più vecchia, e una data lasciata vuota non conta come «in regola».

### Il giorno della scadenza slitta di uno

- **Data:** 18/10/2026
- **PR:** [#813](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/813)
- **Area:** date
- **Gravità:** media
- **Cosa è successo:** la data pura viene riletta con l'ora locale del server e riconvertita in UTC. Con l'ora italiana, il 1 giugno diventa 31 maggio nel messaggio «scaduta il …». Nella stessa modifica esisteva già una funzione che evita lo slittamento, ma il testo mostrato non la usava.
- **Regola:** una data senza ora resta una stringa `AAAA-MM-GG`. Non ripassarla da mezzanotte locale e `toISOString`.

### Il codice legge colonne che la migrazione non ha ancora creato

- **Data:** 18/10/2026
- **PR:** [#813](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/813)
- **Area:** migrazione 178, qualifiche
- **Gravità:** media
- **Cosa è successo:** le query nominano le due colonne nuove. Se il backend arriva prima della migrazione, il controllo dell'ispettore va in errore. Lo scadenzario ingoia l'errore e le qualifiche spariscono dall'elenco.
- **Regola:** finché la migrazione non è applicata, il codice non deve rompersi né svuotare un elenco in silenzio. Prima il database, poi il backend che legge le colonne; oppure una lettura che tollera la colonna assente.

### Il Word firma chi scarica, non chi ha compilato

- **Data:** 18/10/2026
- **PR:** [#814](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/814)
- **Area:** export Word, riesame requisiti
- **Gravità:** alta
- **Cosa è successo:** in calce il nome doveva essere chi ha risposto alla checklist. In tabella c'è solo il numero utente (`answered_by`), senza il nome. Il numero viene scartato e al suo posto si stampa chi clicca «esporta». Data e nome possono essere di due persone diverse.
- **Regola:** Word e PDF usano l'autore del contenuto. Se c'è solo un id, unire il nome dall'anagrafica. Non sostituirlo con l'utente corrente.

### «NA» di partenza non è un campo vuoto

- **Data:** 18/10/2026
- **PR:** [#804](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/804)
- **Area:** rielaborazione esiti WPQR
- **Gravità:** alta
- **Cosa è successo:** `vt_result` nasce già `NA` (migrazione 089). La rielaborazione tratta `NA` come «ancora vuoto». Un esito «non richiesto», che è davvero `NA`, resta candidato per sempre. Una conferma successiva può riscrivere gli altri esiti già a `NA`.
- **Regola:** un default di colonna non è «vuoto» se lo stesso token è anche un valore vero. Dopo la conferma il record esce dai candidati, e la scrittura non copre quel valore.
- **Confronto:** solo Bugbot. La skill ha letto la condizione SQL del registro e l'ha scartata come «stesso schema degli altri bundle», senza aprire il `DEFAULT` della colonna.

### «N.A.» finisce in una colonna data

- **Data:** 18/10/2026
- **PR:** [#804](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/804)
- **Area:** ingest WPQR, data di saldatura
- **Gravità:** media
- **Cosa è successo:** gli altri campi di pagina 2 trasformano `N.A.` e `--` in null. `test_date` copia il testo così com'è dentro una colonna `DATE`. L'inserimento del certificato fallisce.
- **Regola:** gli stessi token vuoti valgono anche per la data, prima di legarla al database.
- **Confronto:** solo Bugbot. La checklist guardava lo slittamento di fuso (`toISOString`), non il tipo SQL della colonna né i token già previsti dal prompt.

### Il processo 311 è trattato come un arco

- **Data:** 18/10/2026
- **PR:** [#805](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/805)
- **Area:** completezza WPQR
- **Gravità:** bassa
- **Cosa è successo:** il 311 (ossiacetilenica) è nell'elenco «senza materiale d'apporto», ma il controllo «è un arco?» esclude solo i processi stud. Corrente, tensione e polarità vengono chiesti lo stesso.
- **Regola:** un processo escluso da una regola va riesaminato in quelle vicine.
- **Confronto:** solo Bugbot. Il test del 142 copre l'apporto e il diametro del filo, non la corrente. La skill si è fermata a quel test.

### Le passate AI si inseriscono a pezzi

- **Data:** 18/10/2026
- **PR:** [#804](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/804)
- **Area:** passate WPQR
- **Gravità:** media
- **Cosa è successo:** ogni passata è un INSERT a sé. Se una riga fallisce, le precedenti restano e il tentativo successivo si ferma perché «una passata c'è già». Due conferme insieme possono anche duplicare le righe: l'indice non è univoco.
- **Regola:** il gruppo di righe sta in una transazione. Il «c'è già?» da solo non basta, come per il codice commessa.
- **Confronto:** l'inserimento a metà è di entrambi. La duplicazione in parallelo l'ha vista solo la skill (stessa famiglia del caso #811).

### La testata vuota non cancella la passata

- **Data:** 18/10/2026
- **PR:** [#805](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/805)
- **Area:** completezza WPQR
- **Gravità:** media
- **Cosa è successo:** polarità e designazione del filo, se stanno solo sulla passata, fanno dire al pack che sul certificato mancano. La testata copre la riga (c'è il test); il contrario no.
- **Regola:** un dato già sulla passata non è «assente sul certificato».
- **Confronto:** solo la skill.

### Salvare un verbale vecchio scrive «dopo»

- **Data:** 18/10/2026
- **PR:** [#812](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/812)
- **Area:** verbali CND, fase ispezione
- **Gravità:** media
- **Cosa è successo:** i verbali precedenti hanno la fase vuota (la migrazione non fa UPDATE). Il form mostra «dopo» e il salvataggio la scrive. Il Word, finché il campo è vuoto, non inventa la fase: dopo il salvataggio sì.
- **Regola:** un default vale per il record nuovo. Aprire e salvare un record vecchio non riempie un campo che era vuoto.
- **Confronto:** solo la skill. Bugbot sullo SHA ha detto «nessun problema».

### L'elenco verbali nomina una colonna non ancora creata

- **Data:** 18/10/2026
- **PR:** [#812](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/812)
- **Area:** migrazione 177
- **Gravità:** media
- **Cosa è successo:** la lista e l'aggiornamento del verbale nominano `inspection_phase`. Se il backend arriva prima della migrazione 177, l'elenco va in errore.
- **Regola:** già nel caso #813. Stesso tipo, altro modulo.
- **Confronto:** solo la skill.

## Confronto con Bugbot

Confronto del 18/10/2026 sulle PR [#803](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/803), [#806](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/806), [#807](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/807), [#808](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/808), [#809](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/809), [#810](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/810), [#812](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/812), [#804](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/804), [#805](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/805).

La skill ha chiuso il proprio elenco prima di leggere i commenti. Si giudica lo SHA finale di ogni PR, non un commit intermedio.

| Esito | Conteggio | Dove |
|---|---|---|
| PR pulite per entrambi | 6 | #803, #806, #807, #808, #809, #810 |
| Trovato da entrambi | 1 | passate inserite a metà (#804) |
| Solo Bugbot | 3 | `NA` eterno (#804), `N.A.` in colonna data (#804), processo 311 trattato come arco (#805) |
| Solo la skill | 4 | duplicazione passate (#804), testata vuota vs passata (#805), fase «dopo» al salvataggio (#812), colonna prima della migrazione 177 (#812) |
| Falso allarme Bugbot | 7 | commenti di un giro precedente, il codice dello SHA non fa più quella cosa: 4 su #804 (esito «not acceptable» letto come OK; rielaborazione passate senza WPQR di destinazione; conferma che non vede le passate; esito lungo scritto in colonna), 3 su #805 (diametro 15614-2 che non parte; diametro filo sul 142; tipo di apporto termico non canonico). I test dello SHA coprono i tre della #805 e la mappa esiti della #804. |
| Falso allarme della skill | 0 | i dubbi (esito «failed» volutamente null, fuso sulla data, ruolo maiuscolo) sono stati scartati prima del confronto |

Bugbot è più forte in tre controlli che la checklist non aveva:

1. Il default della colonna, non solo la condizione «è vuoto?».
2. Il tipo SQL (`DATE`) insieme ai token vuoti già usati negli altri campi.
3. Una regola vicina, dopo che un processo è stato escluso da un'altra.

La skill è più forte sul default scritto al salvataggio di un record vecchio, sulla colonna letta prima della migrazione, e sulla corsa tra due conferme (già vista sul passaggio a commessa).
