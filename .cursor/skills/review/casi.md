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
- **Esito 18/10/2026:** riproducibile su main. Corretto in [#821](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/821): candidato e scrittura solo se la colonna è NULL (`NA` = «non richiesto»).

### «N.A.» finisce in una colonna data

- **Data:** 18/10/2026
- **PR:** [#804](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/804)
- **Area:** ingest WPQR, data di saldatura
- **Gravità:** media
- **Cosa è successo:** gli altri campi di pagina 2 trasformano `N.A.` e `--` in null. `test_date` copia il testo così com'è dentro una colonna `DATE`. L'inserimento del certificato fallisce.
- **Regola:** gli stessi token vuoti valgono anche per la data, prima di legarla al database.
- **Confronto:** solo Bugbot. La checklist guardava lo slittamento di fuso (`toISOString`), non il tipo SQL della colonna né i token già previsti dal prompt.
- **Esito 18/10/2026:** riproducibile su main. Corretto in [#821](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/821): `mapTestDate` — token vuoti e testo non `AAAA-MM-GG` → null.

### Il processo 311 è trattato come un arco

- **Data:** 18/10/2026
- **PR:** [#805](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/805)
- **Area:** completezza WPQR
- **Gravità:** bassa
- **Cosa è successo:** il 311 (ossiacetilenica) è nell'elenco «senza materiale d'apporto», ma il controllo «è un arco?» esclude solo i processi stud. Corrente, tensione e polarità vengono chiesti lo stesso.
- **Regola:** un processo escluso da una regola va riesaminato in quelle vicine.
- **Confronto:** solo Bugbot. Il test del 142 copre l'apporto e il diametro del filo, non la corrente. La skill si è fermata a quel test.
- **Esito 18/10/2026:** riproducibile su main. Corretto in [#821](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/821): 311 (come 142) non è un arco — niente CURRENT_TYPE né corrente/tensione/polarità in passata.

### Le passate AI si inseriscono a pezzi

- **Data:** 18/10/2026
- **PR:** [#804](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/804)
- **Area:** passate WPQR
- **Gravità:** media
- **Cosa è successo:** ogni passata è un INSERT a sé. Se una riga fallisce, le precedenti restano e il tentativo successivo si ferma perché «una passata c'è già». Due conferme insieme possono anche duplicare le righe: l'indice non è univoco.
- **Regola:** il gruppo di righe sta in una transazione. Il «c'è già?» da solo non basta, come per il codice commessa.
- **Confronto:** l'inserimento a metà è di entrambi. La duplicazione in parallelo l'ha vista solo la skill (stessa famiglia del caso #811).
- **Esito 18/10/2026:** riproducibile su main. Corretto in [#821](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/821): `insertAiTestRunsIfEmpty` in transazione con lucchetto sulla WPQR. Nessuna migrazione (niente indice univoco nuovo).

### La testata vuota non cancella la passata

- **Data:** 18/10/2026
- **PR:** [#805](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/805)
- **Area:** completezza WPQR
- **Gravità:** media
- **Cosa è successo:** polarità e designazione del filo, se stanno solo sulla passata, fanno dire al pack che sul certificato mancano. La testata copre la riga (c'è il test); il contrario no.
- **Regola:** un dato già sulla passata non è «assente sul certificato».
- **Confronto:** solo la skill.
- **Esito 18/10/2026:** riproducibile su main. Corretto in [#821](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/821): FILLER e CURRENT_TYPE accettano il dato in passata.

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

### Le card Qualifiche mettono un aggregato dentro un altro

- **Data:** 18/10/2026
- **PR:** [#819](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/819) (visto sullo smoke TEST, non da Bugbot)
- **Area:** qualifiche, statistiche, scadenza oculistica 9712
- **Gravità:** media
- **Cosa è successo:** la data più restrittiva del certificato oculistico è un `SELECT MIN(...)`. Le card la mettono dentro `SUM(CASE WHEN ...)`. SQL Server rifiuta: «Cannot perform an aggregate function on an expression containing an aggregate or a subquery». `GET /qualifications/stats` risponde 500 e la pagina Qualifiche non mostra righe. La lista, che usa la stessa data nel `WHERE`, resta valida. Il cestino (`deleted_at`) non c'entra.
- **Regola:** un `SUM` o un `COUNT` non contiene un altro aggregato né una subquery. La data più restrittiva fra più colonne, se serve alle card, si scrive con un `CASE` scalare. Il risultato resta il minimo fra le date presenti.
- **Confronto:** la skill non ha visto questo 500. La checklist guardava quale data vince, non se l'espressione sta dentro un aggregato.

### L'admin senza auditor_org non vede le aziende

- **Data:** 18/10/2026
- **PR:** [#838](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/838)
- **Area:** Ambito, coda di ingest
- **Gravità:** media
- **Cosa è successo:** l'admin di studio senza `auditor_org_id` è trattato come superadmin. `GET /companies` risponde 403 e la tendina Ambito non ha l'azienda cliente. L'auditor, che ha l'auditor_org, la vede.
- **Regola:** l'admin del proprio studio elenca le aziende di quello studio. Il viewer senza auditor_org resta fuori. Un `auditor_org_id` passato in query resta il filtro.

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

## Storico

Addestramento del 18/10/2026. Trenta PR unite prima della [#803](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/803), le più recenti in cui Bugbot ha lasciato un rilievo e un commit successivo della stessa PR l'ha corretto: [#801](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/801), [#800](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/800), [#799](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/799), [#791](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/791), [#789](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/789), [#786](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/786), [#782](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/782), [#781](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/781), [#778](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/778), [#773](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/773), [#772](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/772), [#769](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/769), [#764](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/764), [#763](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/763), [#761](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/761), [#760](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/760), [#758](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/758), [#753](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/753), [#743](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/743), [#742](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/742), [#738](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/738), [#734](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/734), [#733](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/733), [#727](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/727), [#725](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/725), [#718](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/718), [#711](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/711), [#704](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/704), [#702](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/702), [#701](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/701).

La skill ha chiuso il proprio elenco prima di leggere i commenti. Lo SHA giudicato è il primo commit che Bugbot ha revisionato e che non è la testa della PR (quello prima della correzione). Un titolo conta una volta. Un rilievo di Bugbot su quello SHA è vero perché nella stessa PR c'è un commit dopo: non è stata ricontrollata riga per riga la testa finale di tutte e 47 le voci.

I giri successivi di Bugbot (stessa PR, SHA più avanti) non entrano in questa tabella: non sono stati revisionati alla cieca. Sono 45 titoli, di cui 2 ripetono un bug già contato («verify senza azienda» e «spessore vuoto = 0» sulla #702). Restano 43 rilievi ulteriori.

| Esito | Conteggio | Note |
|---|---|---|
| Trovato da entrambi | 7 | indice unico che tiene il cestino (#801); ambito WPQR che ignora l'azienda della WPS (#799); «illimitato» che tiene il minimo dell'AI (#769); intestazione «validity» che copre la scadenza (#761); guardia prod che non riconosce il database di test vero (#738); upload a pezzi che al retry duplica i file (#711); estremo di spessore vuoto che diventa 0 (#702) |
| Solo Bugbot | 40 | elenco raggruppato sotto. Due erano già nella checklist di isolamento e non sono stati eseguiti |
| Solo la skill | 15 | ipotesi sullo stesso SHA, non confermate da un commento di Bugbot su quello SHA. Non diventano regole a sé |
| Falso allarme Bugbot | 0 | sullo SHA giudicato. Il campione è definito dai commit successivi |
| Falso allarme della skill | 0 | le PR segnate pulite e poi trovate da Bugbot sono mancanze, non allarmi falsi |

### Perché li abbiamo mancati

Due mancanze sono di esecuzione, non di regola nuova. La checklist diceva già che ogni query filtra lo studio e l'azienda. Non l'abbiamo applicata agli `UPDATE` del cestino (#801, scrittura senza `organization_id`) né alla rotta nuova di verifica copertura (#702, nessun filtro azienda, a differenza di `list` e `getOne` nello stesso controller).

Le altre 38 sono tipi che la checklist non nominava. Raggruppati, senza una voce per PR.

**Cestino a metà.** Abbiamo seguito il controllo duplicati e lo `status`, non il `COUNT(*)` degli allegati. Un file cestinato alzava ancora il badge (#801).

**Catena di record.** Ci siamo fermati al filtro della riga corrente. La storia della qualifica, già ammessa, rifaceva il controllo sull'antenato e rispondeva 403 se il rinnovo precedente era di un'altra azienda o senza azienda (#799).

**Numeri tecnici letti come telefoni.** Non abbiamo percorso la regex dello scrubber sui pochi esempi del prompt (certificato `24-03390-01`, processi `135-138-141`) (#789).

**La prima etichetta non è il campo.** Sulla #761 abbiamo visto «validity» e non le sorelle nello stesso file: «Nato a» preso come data, «data di prova» non riconosciuto (#761), la conferma a due cifre che diventa scadenza (#760), il valore dell'esaminatore sulla stessa riga scartato, `Valentina` scartato perché inizia con `valid` (#763), il normalizzatore di una sigla corta applicato a tutto l'OCR (#764), il secondo ente in intestazione ignorato (#772).

**Normalizzare butta via l'altro valore.** Non abbiamo chiesto cosa resta della stringa. Salvare tiene solo il primo codice di processo (#778); WPS e WPQR non canonizzano il testo storico e il filtro non lo ritrova (#778); `num` al posto di `toNumericOrNull` azzera i decimali italiani (#727); manca l'alias di `base_material_group_2` (#773); il pack legge solo `welding_process_test` e ignora `welding_process` (#733, #725).

**La copertura mente sul numero.** Abbiamo visto lo zero sull'estremo vuoto e non il resto: fuori tabella segnato «parziale» (#704), una WPQR stud che eredita il diametro piastra→tubo della 15614 (#704), simboli di posizione sconosciuti che fanno sembrare assente ogni colonna (#733).

**Lo schermo dopo l'errore o il cambio.** Abbiamo visto il retry che duplica e non il flag «occupato» letto come caricamento a lotti (#711), la conferma che rimette la verifica di prima della modifica (#734), l'override fallito che cancella la riga, la select già sul tipo giusto che non si può confermare (#781), la coda la cui chiave di ricarica non è mai aggiornata (#791), l'ambito cambiato che lascia in tabella i risultati dell'altra azienda (#702), `2 +n` e `DC-EP` segnati come numeri invalidi (#753).

**Runner e guardie.** Abbiamo letto il nome del database e non il resto del percorso: mancano `run-migration-175` e `176` (#800) e il brief che annuncia le migrazioni non li elenca (#743); `DB_*` copiato sulla sezione test e su una production clonata fa fallire il runner anche sul test vero (#742); il test di CI legge `database/migrations/` vivo e si rompe al file 169 (#701).

**Classificazione.** Il nome del file contava come prova e saltava l'OCR dell'intestazione (#781). `standard_ref` con `14732` azzerava in salvataggio i campi 9606 ancora visibili (#782).

**Confine di parola.** `EN287-1` non combaciava con `\b` prima di `287`, perché `N` e `2` sono entrambi caratteri di parola (#718).

**Legami WPS/WPQR.** Abbiamo visto il `company_id` vuoto e non il parser: `10/08` diventa un riferimento (#786), il ruolo del legame resta quello del primo caricamento (#786), un errore di lookup con `ref` null non scrive i numeri già estratti (#786).

**Encoding.** La procedura diceva «niente stile». `e'` e `piu'` nel testo mostrato all'operatore sono encoding (#758, #781).

### Solo la skill, sullo stesso SHA

Non sono regole nuove. Erano ipotesi sullo SHA revisionato, non un commento di Bugbot su quello SHA.

- #801: gate NDT e copertura 9712 ignorano `deleted_at`; il generatore WPS include WPQR cestinate; riassegnare un saldatore risponde 409; le NC nate dall'audit non hanno `organization_id` e spariscono dal cestino; l'email di sollecito include NC cestinate.
  **Esito 18/10/2026:** gate NDT e copertura 9712 — corretto in [#828](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/828) (`deleted_at IS NULL`). Generatore WPS — corretto in [#829](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/829) (`loadWpqrRecords` con `deleted_at IS NULL`).
- #791: la coda di ingest non filtra azienda né ruolo (isolamento già in checklist, non eseguito); `cert_ndt` non è nel filtro del modulo qualifiche.
  **Esito 18/10/2026:** coda ingest — corretto in [#826](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/826) (lista per azienda, conferma/scarto bloccati per viewer e per altra azienda). `cert_ndt` già risolto.
- #786: una WPQR creata a mano, con `company_id` vuoto, non si lega.
  **Esito 18/10/2026:** corretto in [#830](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/830) — match `company_id` uguale **oppure** assente (stesso tenant; mai un'altra azienda).
- #764: l'OCR di intestazione non parte se nel corpo c'è già una sigla.
  **Esito 18/10/2026:** corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) — ente AI vuoto/`altro` non salta l'OCR se nel corpo c'è una sigla (IIS).
- #760: una data di nascita a due cifre diventa `exam_date`.
- #733: il form di una 9606-2 BW usa ancora il profilo 9606-1; piastra→tubo con più posizioni usa sempre la soglia 150 mm (Bugbot lo scrive su un commit successivo).
  **Esito 18/10/2026:** form — corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) (`getJointTypeProfile` con la norma; input su `testThicknessKey`). Soglia piastra→tubo già risolta.
- #727: per la 9606-2, `t` del materiale finisce in `s`.
  **Esito 18/10/2026:** corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) — `resolveTestThicknessByJoint` non sposta t→s su ISO 9606-2.
- #725: massimo numerico insieme al flag «illimitato»: il confronto non parte.
  **Esito 18/10/2026:** pack 9606-1 corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833). Pack 9606-2 (`welder9606Part2.pack.js`) ancora aperto: stesso buco, residuo in [#831](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/831).
- #702: una qualifica 14732 entra nel dominio saldatori 9606.
  **Esito 18/10/2026:** corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) — `welder_9606` filtra solo `%9606%`. Il ponte commessa `wpsWelderCoverage` resta con 14732 (COV-4).

### Esito su main (18/10/2026)

Rilettura in sola lettura dopo il merge della [#824](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/824), sul codice di `main`. Nessuna correzione. Nove sono ancora presenti, sei sono già risolti da commit successivi, nessuno è diventato irraggiungibile.

| Esito | Gravità | PR | File | Cosa resta |
|---|---|---|---|---|
| Corretto in [#828](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/828) | alta | #801 | `ndtInspectorGate.service.js`, `cnd9712.adapter.js` | SELECT con `deleted_at IS NULL` su patentino e idoneità visiva (gate e copertura 9712). |
| Corretto in [#829](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/829) | alta | #801 | `wpsGenerator.service.js` (`loadWpqrRecords`) | SELECT con `deleted_at IS NULL`. Una WPQR cestinata non entra più tra le basi di una WPS. |
| Già risolto | media | #801 | `welding.controller.js` (`assignWpsWelder`), `projects.controller.js` (`addProjectWelder`) | Il controllo «già assegnato» esclude `deleted_at`. Riassegnare dopo il cestino non risponde più 409. |
| Già risolto | media | #801 | `trash.service.js` (`listTrashedNonConformities`, `loadTrashRow`) | Elenco e ripristino usano `COALESCE(organization_id della NC, organization_id dell'audit)`. La NC nata dall'audit compare nel cestino. |
| Già risolto | media | #801 | `ncAlertEscalation.service.js` | NC e azioni in sollecito hanno `deleted_at IS NULL`. |
| Corretto in [#826](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/826) | alta | #791 | `PendingIngestQueue.jsx`, `ingestStaging.controller.js`, `ingestStaging.service.js` | Lista per azienda; conferma/scarto bloccati per viewer e per altra azienda. |
| Già risolto | media | #791 | `ingestStaging.controller.js` (`MODULE_DOC_TYPES.qualifiche`) | Il filtro include `cert_ndt`. |
| Corretto in [#830](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/830) | media | #786 | `wpsWpqrLinks.service.js` (`companyClause`) | Match `company_id` uguale oppure assente (stesso tenant). L'azienda diversa resta esclusa. |
| Corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) | media | #764 | `documentIngestPipeline.service.js` (`applyHeaderIssuingBodyFallback`) | Ente AI vuoto/`altro`: l'OCR intestazione parte anche se nel corpo c'è una sigla (IIS). |
| Già risolto | media | #760 | `ruleFieldExtractors.js` (`allDates`, `extractQualificationDates`) | L'anno a due cifre non entra nell'elenco date di default. La nascita è esclusa dai candidati dell'esame. `12.05.75` non diventa `exam_date`. |
| Corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) | media | #733 | `QualificationForm.jsx` | `getJointTypeProfile` riceve la norma. BW 9606-2 usa `thickness_t_test_mm` (`testThicknessKey`). |
| Già risolto | bassa | #733 | `weldingQualificationRules9606Part2.js` (`computePlateToPipeMinDiameter`) | Più posizioni prendono la soglia più alta: PF insieme a un'altra posizione è 500 mm, non il pavimento 150. |
| Corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) | media | #727 | `weldingDesignation.js` (`resolveTestThicknessByJoint`, `parseWelderQualificationDesignation`), `qualificationIngest.service.js` | ISO 9606-2: `t` resta `t` anche su BW. |
| Corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) (9606-1); residuo [#831](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/831) (9606-2) | bassa | #725 | `welder9606Correctness.pack.js`, `welder9606Part2.pack.js` | 9606-1: flag illimitato confrontato anche con massimo numerico. 9606-2: `compareRange` salta ancora il massimo se c'è il flag. |
| Corretto in [#833](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/833) | media | #702 | `welder9606.adapter.js` | Dominio `welder_9606` filtra solo `%9606%`. Il ponte commessa resta con 14732. |

### Quanto prende la checklist aggiornata

Metodo. Denominatore del confronto alla cieca: i 47 titoli del primo SHA. Presi prima di questa checklist: 7, cioè il 15%. Due dei 40 mancati (scrittura del cestino senza studio, verifica copertura senza azienda) erano già scritti sotto Isolamento: eseguirli porta il 15% al 19% (9/47), senza regole nuove.

Le righe aggiunte oggi nominano gli altri 38. Sullo stesso elenco la copertura diventa 47/47. È il soffitto del campione, non una misura: le righe sono state scritte da quegli errori.

Misura non circolare: i 43 rilievi dei giri successivi, esclusi dal numeratore quando la riga è stata allargata proprio per loro. Una riga nata dal primo giro ne copre 6, cioè il 14%: l'aggiornamento WPQR che sposta la WPS di azienda (#799), il filtro WPS che non ritrova il testo storico (#778), tre varianti «identificativo tecnico letto come telefono» (#789), la scadenza etichettata scartata perché la prima data non è il campo (#760). Il resto (ripristino del cestino, regex del telefono che poi non vede un telefono vero, test rotti, posizione piastra→tubo) non è nominato.

Stima per il prossimo pacchetto: i tipi già in questa checklist sì; una variante dello stesso modulo, o un tipo nuovo, no. Nel confronto sulle nove PR dalla #803 il rapporto, con una checklist già arricchita, era 1 su 4. Non si promette un salto dal 15% al 90%.

### Cinque regole che contano di più

1. La prima etichetta trovata non è il campo (scadenza, esame, nascita, conferma).
2. Normalizzare non cancella gli altri valori (codici di processo, decimali italiani, alias della seconda colonna, campo legacy).
3. Ogni migrazione ha lo script VPS, anche nel brief; la guardia riconosce `2026-06-18_SGQ_ISO9001`; `DB_*` non si clona sulla sezione production; il test di CI usa una fixture.
4. In copertura, fuori tabella non è «parziale», l'estremo vuoto non è 0, e una norma non eredita la tabella di un'altra.
5. Un numero di certificato, un processo o un riferimento WPQR non è un telefono.
