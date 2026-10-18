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
