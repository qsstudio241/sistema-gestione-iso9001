/**
 * Checklist Templates - Fallback Statico
 * Sistema Gestione ISO 9001 - QS Studio
 * 
 * Template checklist utilizzato come fallback quando backend API non disponibile.
 * Dati estratti da: database/migrations/010_update_iso9001_35questions.sql
 * 
 * TODO: Sostituire con caricamento dinamico da GET /api/v1/standards/questions
 */

/**
 * Template ISO 9001:2015 (35 domande)
 * Fonte: CheckList\ChekList9001.txt (cliente)
 */
export const ISO_9001_TEMPLATE = {
  standardId: 1,
  standardCode: "ISO_9001_2015",
  standardName: "ISO 9001:2015",
  sections: [
    {
      sectionCode: "clause4",
      sectionTitle: "4 - Contesto dell'Organizzazione",
      displayOrder: 1,
      questions: [
        { questionId: 87,  clauseRef: "4.1", questionText: "Comprendere l'Organizzazione e il suo contesto", questionType: "conformity", isMandatory: true, displayOrder: 1 },
        { questionId: 88,  clauseRef: "4.2", questionText: "Esigenze e aspettative delle parti interessate", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: 89,  clauseRef: "4.3", questionText: "Campo di applicazione", questionType: "conformity", isMandatory: true, displayOrder: 3 },
        { questionId: 90,  clauseRef: "4.4", questionText: "Informazioni necessarie per supportare l'attuazione dei processi", questionType: "conformity", isMandatory: true, displayOrder: 4 }
      ]
    },
    {
      sectionCode: "clause5",
      sectionTitle: "5 - Leadership",
      displayOrder: 2,
      questions: [
        { questionId: 91,  clauseRef: "5.1",   questionText: "Leadership e Impegno", questionType: "conformity", isMandatory: true, displayOrder: 5 },
        { questionId: 92,  clauseRef: "5.2.1", questionText: "Politica per la Qualità", questionType: "conformity", isMandatory: true, displayOrder: 6 },
        { questionId: 93,  clauseRef: "5.2.2", questionText: "Comunicazione della Politica per la Qualità", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: 94,  clauseRef: "5.3",   questionText: "Ruoli organizzativi, responsabilità e autorità", questionType: "conformity", isMandatory: true, displayOrder: 8 }
      ]
    },
    {
      sectionCode: "clause6",
      sectionTitle: "6 - Pianificazione",
      displayOrder: 3,
      questions: [
        { questionId: 95, clauseRef: "6.1", questionText: "Azioni per affrontare rischi e opportunità", questionType: "conformity", isMandatory: true, displayOrder: 9 },
        { questionId: 96, clauseRef: "6.2", questionText: "Obiettivi per la Qualità", questionType: "conformity", isMandatory: true, displayOrder: 10 }
      ]
    },
    {
      sectionCode: "clause7",
      sectionTitle: "7 - Supporto",
      displayOrder: 4,
      questions: [
        { questionId: 97,  clauseRef: "7.1.2",   questionText: "Persone", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: 98,  clauseRef: "7.1.3",   questionText: "Infrastruttura", questionType: "conformity", isMandatory: true, displayOrder: 14 },
        { questionId: 99,  clauseRef: "7.1.4",   questionText: "Ambiente", questionType: "conformity", isMandatory: true, displayOrder: 15 },
        { questionId: 100, clauseRef: "7.1.5.1", questionText: "Idoneità allo scopo delle risorse per il monitoraggio e la misurazione", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: 101, clauseRef: "7.1.5.2", questionText: "Riferibilità metrologica per la taratura/verifica delle apparecchiature di misura", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: 102, clauseRef: "7.2",     questionText: "Evidenza delle competenze del personale", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: 103, clauseRef: "7.3",     questionText: "Consapevolezza", questionType: "conformity", isMandatory: true, displayOrder: 20 },
        { questionId: 104, clauseRef: "7.4",     questionText: "Comunicazione", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: 105, clauseRef: "7.5",     questionText: "Informazioni Documentate", questionType: "conformity", isMandatory: true, displayOrder: 22 }
      ]
    },
    {
      sectionCode: "clause8",
      sectionTitle: "8 - Attività Operative",
      displayOrder: 5,
      questions: [
        { questionId: 194, clauseRef: "8.1",   questionText: "Pianificazione e controllo operativi", questionType: "conformity", isMandatory: true, displayOrder: 39 },
         { questionId: 106, clauseRef: "8.2",   questionText: "Requisiti per prodotti e servizi", questionType: "conformity", isMandatory: true, displayOrder: 23 },
         { questionId: 107, clauseRef: "8.2.3", questionText: "Riesame dei requisiti", questionType: "conformity", isMandatory: true, displayOrder: 24 },
         { questionId: 108, clauseRef: "8.3",   questionText: "Progettazione", questionType: "conformity", isMandatory: true, displayOrder: 25 },
         { questionId: 109, clauseRef: "8.4.1", questionText: "Valutazione, selezione, monitoraggio delle prestazioni e rivalutazione dei fornitori esterni", questionType: "conformity", isMandatory: true, displayOrder: 26 },
        { questionId: 195, clauseRef: "8.4.2", questionText: "Tipo e grado di controllo dei processi, prodotti e servizi forniti esternamente", questionType: "conformity", isMandatory: true, displayOrder: 40 },
        { questionId: 196, clauseRef: "8.4.3", questionText: "Informazioni ai fornitori esterni", questionType: "conformity", isMandatory: true, displayOrder: 41 },
        { questionId: 197, clauseRef: "8.5.1", questionText: "Controllo della produzione e dell'erogazione del servizio", questionType: "conformity", isMandatory: true, displayOrder: 42 },
         { questionId: 110, clauseRef: "8.5.2", questionText: "Rintracciabilità degli output", questionType: "conformity", isMandatory: true, displayOrder: 27 },
         { questionId: 111, clauseRef: "8.5.3", questionText: "Proprietà del cliente/fornitore", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: 198, clauseRef: "8.5.4", questionText: "Conservazione degli output", questionType: "conformity", isMandatory: true, displayOrder: 43 },
         { questionId: 112, clauseRef: "8.5.5", questionText: "Post vendita", questionType: "conformity", isMandatory: true, displayOrder: 29 },
         { questionId: 113, clauseRef: "8.5.6", questionText: "Controllo delle modifiche", questionType: "conformity", isMandatory: true, displayOrder: 30 },
         { questionId: 114, clauseRef: "8.6",   questionText: "Rilascio dei prodotti/servizi", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: 199, clauseRef: "8.7.1", questionText: "Gestione degli output non conformi (azioni da intraprendere)", questionType: "conformity", isMandatory: true, displayOrder: 44 },
         { questionId: 115, clauseRef: "8.7.2", questionText: "Descrizione delle Non Conformità, Azioni adottate, concessioni ottenute", questionType: "conformity", isMandatory: true, displayOrder: 32 }
      ]
    },
    {
      sectionCode: "clause9",
      sectionTitle: "9 - Valutazione delle Prestazioni",
      displayOrder: 6,
      questions: [
        { questionId: 116, clauseRef: "9.1.1", questionText: "Valutazione delle prestazioni del SGQ (KPI)", questionType: "conformity", isMandatory: true, displayOrder: 33 },
        { questionId: 117, clauseRef: "9.1.2", questionText: "Customer Satisfaction", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: 118, clauseRef: "9.2.2", questionText: "Attuazione del programma di audit e risultati di audit", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: 119, clauseRef: "9.3.3", questionText: "Risultati dei Riesami di Direzione", questionType: "conformity", isMandatory: true, displayOrder: 36 }
      ]
    },
    {
      sectionCode: "clause10",
      sectionTitle: "10 - Miglioramento",
      displayOrder: 7,
      questions: [
        { questionId: 120, clauseRef: "10.2", questionText: "Non conformità e Azioni Correttive", questionType: "conformity", isMandatory: true, displayOrder: 37 },
        { questionId: 121, clauseRef: "10.3", questionText: "Miglioramento continuo", questionType: "conformity", isMandatory: true, displayOrder: 38 }
      ]
    }
  ]
};

/**
 * Template ISO 14001:2015 — Audit SGA (clausole 4-10, 53 domande)
 * Fonte: DB produzione post-migration 049 + UNI EN ISO 14001:2015
 * questionId: allineati a checklist_questions (standard_id=2)
 */
export const ISO_14001_TEMPLATE = {
  standardId: 2,
  standardCode: "ISO_14001_2015",
  standardName: "ISO 14001:2015",
  sections: [
    {
      sectionCode: "14001_c4",
      sectionTitle: "4 - Contesto dell'Organizzazione",
      displayOrder: 1,
      questions: [
        { questionId: 223, clauseRef: "4.1", questionText: "4.1 - L'organizzazione ha determinato i fattori interni ed esterni rilevanti per le sue finalita' e che influenzano il SGA, incluse le condizioni ambientali che la riguardano?", questionType: "conformity", isMandatory: true, displayOrder: 1 },
        { questionId: 224, clauseRef: "4.2", questionText: "4.2 - L'organizzazione ha identificato le parti interessate rilevanti per il SGA e ne ha determinato esigenze, aspettative e obblighi di conformita' che ne derivano?", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: 225, clauseRef: "4.3", questionText: "4.3 - Il campo di applicazione del SGA e' definito (confini fisici e organizzativi, attivita', prodotti e servizi) e mantenuto come informazione documentata disponibile alle parti interessate?", questionType: "conformity", isMandatory: true, displayOrder: 3 },
        { questionId: 226, clauseRef: "4.3", questionText: "4.3 - La definizione del campo di applicazione considera i fattori di cui al 4.1, gli obblighi di conformita' di cui al 4.2 e l'autorita'/abilita' dell'organizzazione ad esercitare controllo?", questionType: "conformity", isMandatory: true, displayOrder: 4 },
        { questionId: 227, clauseRef: "4.4", questionText: "4.4 - Il SGA e' stabilito, attuato, mantenuto e migliorato in modo continuo in conformita' ai requisiti della norma, con processi necessari e loro interazioni definiti?", questionType: "conformity", isMandatory: true, displayOrder: 5 },
        { questionId: 228, clauseRef: "4.4", questionText: "4.4 - La conoscenza derivante dall'analisi del contesto (4.1) e delle parti interessate (4.2) e' integrata nello sviluppo e nel mantenimento del SGA?", questionType: "conformity", isMandatory: true, displayOrder: 6 },
        { questionId: 229, clauseRef: "4.4", questionText: "4.4 - Il SGA copre tutte le attivita', i prodotti e i servizi inclusi nel campo di applicazione definito?", questionType: "conformity", isMandatory: true, displayOrder: 7 },
      ]
    },
    {
      sectionCode: "14001_c5",
      sectionTitle: "5 - Leadership",
      displayOrder: 2,
      questions: [
        { questionId: 230, clauseRef: "5.1", questionText: "5.1 - L'alta direzione dimostra leadership e impegno: accetta di rendere conto dell'efficacia del SGA, assicura disponibilita' delle risorse e comunica l'importanza della gestione ambientale?", questionType: "conformity", isMandatory: true, displayOrder: 8 },
        { questionId: 231, clauseRef: "5.1", questionText: "5.1 - L'alta direzione assicura che i requisiti del SGA siano integrati nei processi di business e promuove il miglioramento continuo, guidando e supportando le persone?", questionType: "conformity", isMandatory: true, displayOrder: 9 },
        { questionId: 232, clauseRef: "5.2", questionText: "5.2 - La politica ambientale e' appropriata alle finalita' e al contesto, fornisce un quadro per gli obiettivi ambientali e include impegni per la protezione dell'ambiente e la prevenzione dell'inquinamento?", questionType: "conformity", isMandatory: true, displayOrder: 10 },
        { questionId: 233, clauseRef: "5.2", questionText: "5.2 - La politica ambientale include impegno a soddisfare obblighi di conformita' e miglioramento continuo SGA; e' documentata, comunicata internamente e disponibile alle parti interessate?", questionType: "conformity", isMandatory: true, displayOrder: 11 },
        { questionId: 234, clauseRef: "5.3", questionText: "5.3 - Le responsabilita' e le autorita' per i ruoli pertinenti al SGA sono assegnate, documentate e comunicate all'interno dell'organizzazione?", questionType: "conformity", isMandatory: true, displayOrder: 12 },
        { questionId: 235, clauseRef: "5.3", questionText: "5.3 - Sono assegnate responsabilita' e autorita' per assicurare la conformita' del SGA alla norma e per riferire all'alta direzione sulle prestazioni del SGA, inclusa la prestazione ambientale?", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: 236, clauseRef: "5.3", questionText: "5.3 - I ruoli gestionali a ogni livello pertinente ricevono supporto nell'esercitare la propria leadership nelle rispettive aree di responsabilita' ambientale?", questionType: "conformity", isMandatory: true, displayOrder: 14 },
      ]
    },
    {
      sectionCode: "14001_c6",
      sectionTitle: "6 - Pianificazione",
      displayOrder: 3,
      questions: [
        { questionId: 237, clauseRef: "6.1.1", questionText: "6.1.1 - E' stabilito un processo per determinare i rischi e le opportunita' associati agli aspetti ambientali, agli obblighi di conformita' e ai fattori del contesto, e sono documentati?", questionType: "conformity", isMandatory: true, displayOrder: 15 },
        { questionId: 238, clauseRef: "6.1.1", questionText: "6.1.1 - Nell'ambito del SGA sono state identificate le potenziali situazioni di emergenza con impatto ambientale?", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: 239, clauseRef: "6.1.2", questionText: "6.1.2 - Gli aspetti ambientali delle attivita', prodotti e servizi (compresi cambiamenti pianificati, condizioni anomale ed emergenze ragionevolmente prevedibili) sono determinati con prospettiva di ciclo di vita?", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: 240, clauseRef: "6.1.2", questionText: "6.1.2 - Gli aspetti ambientali significativi sono determinati con criteri stabiliti, comunicati ai livelli e funzioni pertinenti e mantenuti come informazione documentata (aspetti, criteri, aspetti significativi)?", questionType: "conformity", isMandatory: true, displayOrder: 18 },
        { questionId: 241, clauseRef: "6.1.3", questionText: "6.1.3 - Gli obblighi di conformita' applicabili agli aspetti ambientali sono identificati, accessibili e considerati nell'istituzione/mantenimento del SGA e mantenuti come informazione documentata?", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: 242, clauseRef: "6.1.4", questionText: "6.1.4 - Sono pianificate azioni per aspetti ambientali significativi, obblighi di conformita' e rischi/opportunita', considerando opzioni tecnologiche e vincoli finanziari e operativi?", questionType: "conformity", isMandatory: true, displayOrder: 20 },
        { questionId: 243, clauseRef: "6.2.1", questionText: "6.2.1 - Gli obiettivi ambientali sono stabiliti per funzioni e livelli pertinenti, sono coerenti con la politica, misurabili, monitorati, comunicati, aggiornati e mantenuti come informazione documentata?", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: 244, clauseRef: "6.2.1", questionText: "6.2.1 - Gli obiettivi ambientali tengono conto degli aspetti ambientali significativi, degli obblighi di conformita' e dei rischi/opportunita'?", questionType: "conformity", isMandatory: true, displayOrder: 22 },
        { questionId: 245, clauseRef: "6.2.2", questionText: "6.2.2 - Per ciascun obiettivo ambientale e' definito un piano con: cosa fare, risorse, responsabile, tempi di completamento e indicatori/metodi per valutare i risultati?", questionType: "conformity", isMandatory: true, displayOrder: 23 },
        { questionId: 246, clauseRef: "6.2.2", questionText: "6.2.2 - Le azioni per il raggiungimento degli obiettivi ambientali sono integrate nei processi di business dell'organizzazione?", questionType: "conformity", isMandatory: true, displayOrder: 24 },
      ]
    },
    {
      sectionCode: "14001_c7",
      sectionTitle: "7 - Supporto",
      displayOrder: 4,
      questions: [
        { questionId: 247, clauseRef: "7.1", questionText: "7.1 - Sono state determinate e fornite le risorse (umane, infrastrutturali, tecnologiche, finanziarie) necessarie per l'istituzione, l'attuazione, il mantenimento e il miglioramento del SGA?", questionType: "conformity", isMandatory: true, displayOrder: 25 },
        { questionId: 248, clauseRef: "7.2", questionText: "7.2 - Le competenze necessarie per il personale con impatto ambientale sono determinate e assicurate (istruzione, formazione, esperienza); le esigenze di formazione correlate al SGA sono identificate?", questionType: "conformity", isMandatory: true, displayOrder: 26 },
        { questionId: 249, clauseRef: "7.2", questionText: "7.2 - Sono intraprese azioni per acquisire le competenze necessarie e ne e' valutata l'efficacia; le evidenze delle competenze sono conservate come informazione documentata?", questionType: "conformity", isMandatory: true, displayOrder: 27 },
        { questionId: 250, clauseRef: "7.3", questionText: "7.3 - Il personale sotto il controllo dell'organizzazione e' consapevole della politica ambientale, degli aspetti significativi, del proprio contributo all'efficacia del SGA e delle implicazioni delle non conformita'?", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: 251, clauseRef: "7.4", questionText: "7.4 - Sono stabiliti processi per la comunicazione interna ed esterna pertinente al SGA (cosa, quando, con chi, come), coerenti con le informazioni del SGA e con gli obblighi di conformita'?", questionType: "conformity", isMandatory: true, displayOrder: 29 },
        { questionId: 252, clauseRef: "7.4.2", questionText: "7.4.2 - La comunicazione interna assicura che informazioni pertinenti al SGA siano diffuse tra livelli e funzioni e che il personale possa contribuire al miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 30 },
        { questionId: 253, clauseRef: "7.4.3", questionText: "7.4.3 - La comunicazione esterna pertinente al SGA avviene in conformita' ai processi comunicativi e agli obblighi di conformita', con evidenza documentata per quanto appropriato?", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: 254, clauseRef: "7.5.1", questionText: "7.5.1 - Il SGA comprende tutte le informazioni documentate richieste dalla norma e quelle aggiuntive necessarie per l'efficacia del SGA?", questionType: "conformity", isMandatory: true, displayOrder: 32 },
        { questionId: 255, clauseRef: "7.5.2", questionText: "7.5.2 - Nella creazione e aggiornamento delle informazioni documentate sono assicurate: identificazione/descrizione adeguata, formato/mezzo appropriato, riesame e approvazione?", questionType: "conformity", isMandatory: true, displayOrder: 33 },
        { questionId: 256, clauseRef: "7.5.3", questionText: "7.5.3 - Le informazioni documentate del SGA sono tenute sotto controllo: disponibili dove/quando necessario, protette, distribuite, archiviate, conservate e gestite nelle versioni; le modifiche sono controllate?", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: 257, clauseRef: "7.5.3", questionText: "7.5.3 - Le informazioni documentate di origine esterna necessarie per il SGA sono identificate e tenute sotto controllo?", questionType: "conformity", isMandatory: true, displayOrder: 35 },
      ]
    },
    {
      sectionCode: "14001_c8",
      sectionTitle: "8 - Attivita Operative",
      displayOrder: 5,
      questions: [
        { questionId: 258, clauseRef: "8.1", questionText: "8.1 - Sono stabiliti criteri operativi per i processi rilevanti e il controllo e' attuato in conformita' (procedure, istruzioni, controlli ingegneristici con gerarchia eliminazione/sostituzione/amministrazione)?", questionType: "conformity", isMandatory: true, displayOrder: 36 },
        { questionId: 259, clauseRef: "8.1", questionText: "8.1 - Le modifiche pianificate sono gestite e le conseguenze dei cambiamenti involontari sono riesaminate, con azioni per mitigare effetti negativi?", questionType: "conformity", isMandatory: true, displayOrder: 37 },
        { questionId: 260, clauseRef: "8.1", questionText: "8.1 - I processi affidati all'esterno sono tenuti sotto controllo; i requisiti ambientali sono comunicati ai fornitori esterni/appaltatori; e' adottata una prospettiva di ciclo di vita (progettazione, approvvigionamento, fine vita)?", questionType: "conformity", isMandatory: true, displayOrder: 38 },
        { questionId: 261, clauseRef: "8.2", questionText: "8.2 - Esiste un processo per prepararsi e rispondere alle emergenze ambientali: piano di risposta, azioni preventive/mitigative, risposta alle emergenze reali?", questionType: "conformity", isMandatory: true, displayOrder: 39 },
        { questionId: 262, clauseRef: "8.2", questionText: "8.2 - Le azioni di risposta alle emergenze sono periodicamente sottoposte a prova (ove praticabile) e i processi di risposta sono riesaminati e revisionati periodicamente, in particolare dopo eventi di emergenza?", questionType: "conformity", isMandatory: true, displayOrder: 40 },
        { questionId: 263, clauseRef: "8.2", questionText: "8.2 - Sono fornite informazioni e formazione pertinenti in materia di preparazione e risposta alle emergenze alle parti interessate pertinenti, compresi i lavoratori?", questionType: "conformity", isMandatory: true, displayOrder: 41 },
      ]
    },
    {
      sectionCode: "14001_c9",
      sectionTitle: "9 - Valutazione delle Prestazioni",
      displayOrder: 6,
      questions: [
        { questionId: 264, clauseRef: "9.1.1", questionText: "9.1.1 - Sono determinati: cosa monitorare/misurare, i metodi, i criteri di valutazione delle prestazioni ambientali e gli indicatori appropriati, con frequenza definita per esecuzione e analisi?", questionType: "conformity", isMandatory: true, displayOrder: 42 },
        { questionId: 265, clauseRef: "9.1.1", questionText: "9.1.1 - Le attrezzature di monitoraggio e misurazione sono tarate/verificate e mantenute; i risultati di monitoraggio/analisi/valutazione sono comunicati internamente ed esternamente e documentati?", questionType: "conformity", isMandatory: true, displayOrder: 43 },
        { questionId: 266, clauseRef: "9.1.2", questionText: "9.1.2 - Esiste un processo per valutare periodicamente la conformita' agli obblighi di conformita'; le azioni necessarie sono intraprese e i risultati della valutazione documentati?", questionType: "conformity", isMandatory: true, displayOrder: 44 },
        { questionId: 267, clauseRef: "9.2.1", questionText: "9.2.1 - Sono condotti audit interni a intervalli pianificati per verificare la conformita' del SGA ai requisiti propri e della norma e la sua efficace attuazione e mantenimento?", questionType: "conformity", isMandatory: true, displayOrder: 45 },
        { questionId: 268, clauseRef: "9.2.2", questionText: "9.2.2 - Il programma di audit interno comprende frequenza, metodi, responsabilita', criteri e campo di applicazione; gli auditor garantiscono obiettivita' e imparzialita'; i risultati sono riportati al pertinente livello direzionale e documentati?", questionType: "conformity", isMandatory: true, displayOrder: 46 },
        { questionId: 269, clauseRef: "9.3", questionText: "9.3 - L'alta direzione riesamina periodicamente il SGA valutando: stato azioni precedenti, cambiamenti interni/esterni/aspetti significativi/rischi, grado di raggiungimento obiettivi, prestazione ambientale, adeguatezza risorse, comunicazioni parti interessate?", questionType: "conformity", isMandatory: true, displayOrder: 47 },
        { questionId: 270, clauseRef: "9.3", questionText: "9.3 - Il riesame di direzione produce output documentati: conclusioni su idoneita'/adeguatezza/efficacia SGA, decisioni per il miglioramento continuo, eventuali modifiche al SGA, azioni per obiettivi non raggiunti?", questionType: "conformity", isMandatory: true, displayOrder: 48 },
      ]
    },
    {
      sectionCode: "14001_c10",
      sectionTitle: "10 - Miglioramento",
      displayOrder: 7,
      questions: [
        { questionId: 271, clauseRef: "10.1", questionText: "10.1 - L'organizzazione determina le opportunita' di miglioramento (da 9.1, 9.2, 9.3) e intraprende le azioni necessarie per conseguire gli esiti attesi del SGA?", questionType: "conformity", isMandatory: true, displayOrder: 49 },
        { questionId: 272, clauseRef: "10.2", questionText: "10.2 - In caso di non conformita', l'organizzazione reagisce tempestivamente (controllo, correzione, mitigazione impatti ambientali), valuta l'esigenza di azioni correttive per eliminare le cause e prevenire la ripetizione?", questionType: "conformity", isMandatory: true, displayOrder: 50 },
        { questionId: 273, clauseRef: "10.2", questionText: "10.2 - Le azioni correttive sono proporzionate all'importanza degli effetti e degli impatti ambientali delle non conformita'; la loro efficacia e' riesaminata; il SGA e' modificato se necessario?", questionType: "conformity", isMandatory: true, displayOrder: 51 },
        { questionId: 274, clauseRef: "10.2", questionText: "10.2 - La natura delle non conformita', le azioni intraprese e i risultati delle azioni correttive sono conservati come informazione documentata?", questionType: "conformity", isMandatory: true, displayOrder: 52 },
        { questionId: 275, clauseRef: "10.3", questionText: "10.3 - L'organizzazione migliora in modo continuo l'idoneita', l'adeguatezza e l'efficacia del SGA per migliorare la prestazione ambientale?", questionType: "conformity", isMandatory: true, displayOrder: 53 },
      ]
    },
  ]
};


/**
 * Matrice conformita legislativa (D.Lgs. 152/06) — NON audit ISO 14001 SGA
 * 2 sezioni normative — 46 domande
 * Fonte: CheckList\ChekList14001.txt (cliente)
 * questionId: null = domande non ancora nel DB (sync silenzioso; vedere migration 012)
 */
export const ISO_14001_LEGISLATIVO_TEMPLATE = {
  standardId: 2,
  standardCode: "LEG_AMBIENTE_152",
  standardName: "Conformita legislativa ambientale",
  sections: [
    {
      sectionCode: "14001_s4",
      sectionTitle: "4 - AMBIENTE E SICUREZZA",
      displayOrder: 1,
      questions: [
        { questionId: 122, clauseRef: "2",  questionText: "EDILIZIA/AGIBILITA'", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: 123, clauseRef: "3",  questionText: "INDUSTRIE INSALUBRI", questionType: "conformity", isMandatory: true, displayOrder: 3 },
        { questionId: 124, clauseRef: "4",  questionText: "IMPIANTI TERMICI", questionType: "conformity", isMandatory: true, displayOrder: 4 },
        { questionId: 125, clauseRef: "5",  questionText: "INCIDENTI RILEVANTI", questionType: "conformity", isMandatory: true, displayOrder: 5 },
        { questionId: 126, clauseRef: "6",  questionText: "PREVENZIONE INCENDI / RISCHIO INCENDI", questionType: "conformity", isMandatory: true, displayOrder: 6 },
        { questionId: 127, clauseRef: "7",  questionText: "PIANO DI EMERGENZA", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: 128, clauseRef: "8",  questionText: "ADDETTI ALLE EMERGENZE", questionType: "conformity", isMandatory: true, displayOrder: 8 },
        { questionId: 129, clauseRef: "9",  questionText: "GAS TOSSICI", questionType: "conformity", isMandatory: true, displayOrder: 9 },
        { questionId: 130, clauseRef: "10", questionText: "AMIANTO E RELATIVI RISCHI", questionType: "conformity", isMandatory: true, displayOrder: 10 },
        { questionId: 131, clauseRef: "11", questionText: "TRASPORTO MATERIALI PERICOLOSI (ADR / RID)", questionType: "conformity", isMandatory: true, displayOrder: 11 },
        { questionId: 132, clauseRef: "12", questionText: "SOSTANZE E PREPARATI PERICOLOSI / RISCHIO CHIMICO PER LA SALUTE E LA SICUREZZA", questionType: "conformity", isMandatory: true, displayOrder: 12 },
        { questionId: 133, clauseRef: "13", questionText: "PCB / PCT", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: 134, clauseRef: "14", questionText: "RADIAZIONI IONIZZANTI E RELATIVI RISCHI", questionType: "conformity", isMandatory: true, displayOrder: 14 }
      ]
    },
    {
      sectionCode: "14001_s5",
      sectionTitle: "5. AMBIENTE",
      displayOrder: 2,
      questions: [
        { questionId: 135, clauseRef: "15", questionText: "VALUTAZIONE IMPATTO AMBIENTALE (VIA) e VALUTAZIONE AMBIENTALE STRATEGICA (VAS)", questionType: "conformity", isMandatory: true, displayOrder: 15 },
        { questionId: 136, clauseRef: "16", questionText: "AUTORIZZAZIONE INTEGRATA AMBIENTALE (AIA) e IPPC", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: 137, clauseRef: "17", questionText: "AUTORIZZAZIONE UNICA AMBIENTALE (AUA)", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: 138, clauseRef: "18", questionText: "APPROVVIGIONAMENTO IDRICO", questionType: "conformity", isMandatory: true, displayOrder: 18 },
        { questionId: 139, clauseRef: "19", questionText: "SCARICHI IDRICI", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: 140, clauseRef: "20", questionText: "QUALITA' DELL'ARIA", questionType: "conformity", isMandatory: true, displayOrder: 20 },
        { questionId: 141, clauseRef: "21", questionText: "EMISSIONI IN ATMOSFERA", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: 142, clauseRef: "22", questionText: "EMISSIONI ODORIGENE", questionType: "conformity", isMandatory: true, displayOrder: 22 },
        { questionId: 143, clauseRef: "23", questionText: "RIFIUTI", questionType: "conformity", isMandatory: true, displayOrder: 23 },
        { questionId: 144, clauseRef: "24", questionText: "GESTIONE IMBALLAGGI (CONAI E CONSORZI DI FILIERA)", questionType: "conformity", isMandatory: true, displayOrder: 24 },
        { questionId: 145, clauseRef: "25", questionText: "DISCARICHE E IMPIANTI DI INCENERIMENTO", questionType: "conformity", isMandatory: true, displayOrder: 25 },
        { questionId: 146, clauseRef: "26", questionText: "TERRE E ROCCE DA SCAVO", questionType: "conformity", isMandatory: true, displayOrder: 26 },
        { questionId: 147, clauseRef: "27", questionText: "BONIFICA SITI CONTAMINATI", questionType: "conformity", isMandatory: true, displayOrder: 27 },
        { questionId: 148, clauseRef: "28", questionText: "CONTAMINAZIONE SUOLO E SOTTOSUOLO (Serbatoi Interrati)", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: 149, clauseRef: "29", questionText: "GAS AD EFFETTO SERRA E LESIVI DELL'OZONO", questionType: "conformity", isMandatory: true, displayOrder: 29 },
        { questionId: 150, clauseRef: "30", questionText: "INQUINAMENTO ACUSTICO", questionType: "conformity", isMandatory: true, displayOrder: 30 },
        { questionId: 151, clauseRef: "31", questionText: "GESTIONE ENERGETICA ED ENERGY MANAGER", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: 152, clauseRef: "32", questionText: "MOBILITY MANAGER", questionType: "conformity", isMandatory: true, displayOrder: 32 },
        { questionId: 153, clauseRef: "33", questionText: "INQUINAMENTO ELETTROMAGNETICO", questionType: "conformity", isMandatory: true, displayOrder: 33 },
        { questionId: 154, clauseRef: "34", questionText: "INQUINAMENTO LUMINOSO", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: 155, clauseRef: "35", questionText: "SOSTENIBILITA' / CORPORATE SUSTAINABILITY REPORTING DIRECTIVE (CSRD)", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: 156, clauseRef: "36", questionText: "MEDI IMPIANTI DI COMBUSTIONE", questionType: "conformity", isMandatory: true, displayOrder: 36 },
        { questionId: 157, clauseRef: "37", questionText: "GRANDI IMPIANTI DI COMBUSTIONE", questionType: "conformity", isMandatory: true, displayOrder: 37 },
        { questionId: 158, clauseRef: "38", questionText: "ATTIVITA' DI GESTIONE DEI RIFIUTI ED IMPIANTI DI RECUPERO (art. 208 e segg. D.Lgs. 152/06)", questionType: "conformity", isMandatory: true, displayOrder: 38 },
        { questionId: 159, clauseRef: "39", questionText: "OLI USATI", questionType: "conformity", isMandatory: true, displayOrder: 39 },
        { questionId: 160, clauseRef: "40", questionText: "RIFIUTI SANITARI/ORIGINE ANIMALE, SOTTOPRODOTTI DI ORIGINE ANIMALE", questionType: "conformity", isMandatory: true, displayOrder: 40 },
        { questionId: 161, clauseRef: "41", questionText: "UTILIZZO FANGHI IN AGRICOLTURA", questionType: "conformity", isMandatory: true, displayOrder: 41 },
        { questionId: 162, clauseRef: "42", questionText: "SOTTOPRODOTTI", questionType: "conformity", isMandatory: true, displayOrder: 42 },
        { questionId: 163, clauseRef: "43", questionText: "ATTIVITA' DI AUTOSMALTIMENTO DI RIFIUTI PERICOLOSI", questionType: "conformity", isMandatory: true, displayOrder: 43 },
        { questionId: 164, clauseRef: "44", questionText: "RISPARMIO ED EFFICIENZA ENERGETICA", questionType: "conformity", isMandatory: true, displayOrder: 44 },
        { questionId: 165, clauseRef: "45", questionText: "EUDR, European Union Deforestation Regulation", questionType: "conformity", isMandatory: true, displayOrder: 45 },
        { questionId: 166, clauseRef: "46", questionText: "PPWR (Packaging and Packaging Waste Regulation)", questionType: "conformity", isMandatory: true, displayOrder: 46 },
        { questionId: 167, clauseRef: "47", questionText: "Prescrizioni AIA, AUA", questionType: "conformity", isMandatory: true, displayOrder: 47 }
      ]
    }
  ]
};

/**
 * Template ISO 3834-2:2021 (Requisiti di qualità per la saldatura per fusione dei materiali metallici)
 * Requisiti completi — 36 domande di audit (clausole norma ISO 3834-2)
 * Usato da Mason per audit di seconda parte su committenti.
 * questionId: null = domande non ancora nel DB (sync silenzioso)
 */
export const RDP_MSN_TEMPLATE = {
  standardId: 7,
  standardCode: "RDP_MSN",
  standardName: "Rapporto di Prova / Audit Fornitori (ISO 3834)",
  sections: [
    {
      sectionCode: "3834_s4",
      sectionTitle: "4 - Riesame dei requisiti e riesame tecnico",
      displayOrder: 1,
      questions: [
        { questionId: null, clauseRef: "1",  questionText: "Riesame dei requisiti contrattuali prima dell'offerta/ordine (4.2)", questionType: "conformity", isMandatory: true, displayOrder: 1 },
        { questionId: null, clauseRef: "2",  questionText: "Riesame tecnico della fattibilità della saldatura (4.3)", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: null, clauseRef: "3",  questionText: "Eventuali subappalti di saldatura documentati e comunicati al cliente (6)", questionType: "conformity", isMandatory: true, displayOrder: 3 }
      ]
    },
    {
      sectionCode: "3834_s7",
      sectionTitle: "7 - Personale di saldatura",
      displayOrder: 2,
      questions: [
        { questionId: null, clauseRef: "4",  questionText: "Saldatori e operatori qualificati secondo norme applicabili (ISO 9606, ISO 14732) (7.1)", questionType: "conformity", isMandatory: true, displayOrder: 4 },
        { questionId: null, clauseRef: "5",  questionText: "Coordinatori di saldatura con competenze tecniche adeguate (IWE/IWT/IWS) (7.2)", questionType: "conformity", isMandatory: true, displayOrder: 5 },
        { questionId: null, clauseRef: "6",  questionText: "Addetti al controllo di saldatura qualificati (NDT, ispezione) (8)", questionType: "conformity", isMandatory: true, displayOrder: 6 }
      ]
    },
    {
      sectionCode: "3834_s10",
      sectionTitle: "10 - Attrezzature di saldatura e accessorie",
      displayOrder: 3,
      questions: [
        { questionId: null, clauseRef: "7",  questionText: "Attrezzature di saldatura idonee, disponibili e manutenute (10.1)", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: null, clauseRef: "8",  questionText: "Attrezzature di taglio, fissaggio e movimentazione adeguate (10.1)", questionType: "conformity", isMandatory: true, displayOrder: 8 },
        { questionId: null, clauseRef: "9",  questionText: "Strumenti di misura tarati e idonei (calibrazione documentata) (10.2)", questionType: "conformity", isMandatory: true, displayOrder: 9 }
      ]
    },
    {
      sectionCode: "3834_s11",
      sectionTitle: "11 - Attività di saldatura (pianificazione e WPS)",
      displayOrder: 4,
      questions: [
        { questionId: null, clauseRef: "10", questionText: "Specifiche di procedura di saldatura (WPS) disponibili e approvate (11.1)", questionType: "conformity", isMandatory: true, displayOrder: 10 },
        { questionId: null, clauseRef: "11", questionText: "Procedure qualificate (WPQR/PQR) secondo norme applicabili (ISO 15614) (11.2)", questionType: "conformity", isMandatory: true, displayOrder: 11 },
        { questionId: null, clauseRef: "12", questionText: "Pianificazione della produzione include sequenza e condizioni di saldatura (11.3)", questionType: "conformity", isMandatory: true, displayOrder: 12 },
        { questionId: null, clauseRef: "13", questionText: "Materiali di apporto conformi alle specifiche e correttamente conservati (11.4)", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: null, clauseRef: "14", questionText: "Materiali base conformi alle specifiche contrattuali (11.4)", questionType: "conformity", isMandatory: true, displayOrder: 14 },
        { questionId: null, clauseRef: "15", questionText: "Trattamento termico post-saldatura (PWHT) pianificato e documentato se richiesto (11.5)", questionType: "conformity", isMandatory: true, displayOrder: 15 }
      ]
    },
    {
      sectionCode: "3834_s12",
      sectionTitle: "12 - Controllo e prove (prima, durante e dopo la saldatura)",
      displayOrder: 5,
      questions: [
        { questionId: null, clauseRef: "16", questionText: "Controlli pre-saldatura: pulizia, geometria, posizionamento, puntatura (12.1)", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: null, clauseRef: "17", questionText: "Controlli in corso d'opera: parametri saldatura, sequenza, interpass (12.2)", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: null, clauseRef: "18", questionText: "Controlli post-saldatura: esame visivo (VT) su tutti i giunti (12.3)", questionType: "conformity", isMandatory: true, displayOrder: 18 },
        { questionId: null, clauseRef: "19", questionText: "Controlli non distruttivi (NDT) secondo norma e contratto (PT, MT, RT, UT) (12.3)", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: null, clauseRef: "20", questionText: "Prove distruttive (DT) e prove di accettazione eseguite e documentate (12.3)", questionType: "conformity", isMandatory: true, displayOrder: 20 }
      ]
    },
    {
      sectionCode: "3834_s14",
      sectionTitle: "14 - Non conformità e azioni correttive",
      displayOrder: 6,
      questions: [
        { questionId: null, clauseRef: "21", questionText: "Difetti rilevati riparati secondo procedura qualificata o rilavorati (14.1)", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: null, clauseRef: "22", questionText: "Non conformità registrate con analisi causa e azione correttiva (14.2)", questionType: "conformity", isMandatory: true, displayOrder: 22 },
        { questionId: null, clauseRef: "23", questionText: "Prodotti non conformi identificati e segregati per evitare uso involontario (14.3)", questionType: "conformity", isMandatory: true, displayOrder: 23 }
      ]
    },
    {
      sectionCode: "3834_s15",
      sectionTitle: "15 - Identificazione e rintracciabilità",
      displayOrder: 7,
      questions: [
        { questionId: null, clauseRef: "24", questionText: "Materiali base identificati e rintracciabili durante tutto il processo (15.1)", questionType: "conformity", isMandatory: true, displayOrder: 24 },
        { questionId: null, clauseRef: "25", questionText: "Materiali di apporto identificati e rintracciabili durante tutto il processo (15.1)", questionType: "conformity", isMandatory: true, displayOrder: 25 },
        { questionId: null, clauseRef: "26", questionText: "Giunti saldati identificati e rintracciabili rispetto a WPS e saldatore (15.2)", questionType: "conformity", isMandatory: true, displayOrder: 26 }
      ]
    },
    {
      sectionCode: "3834_s16",
      sectionTitle: "16 - Registrazioni della qualità",
      displayOrder: 8,
      questions: [
        { questionId: null, clauseRef: "27", questionText: "Registrazioni delle qualifiche di saldatori e operatori disponibili e aggiornate (16)", questionType: "conformity", isMandatory: true, displayOrder: 27 },
        { questionId: null, clauseRef: "28", questionText: "Qualifiche delle procedure di saldatura (WPQR) documentate e aggiornate (16)", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: null, clauseRef: "29", questionText: "Certificati dei materiali base e di apporto conservati e rintracciabili (16)", questionType: "conformity", isMandatory: true, displayOrder: 29 },
        { questionId: null, clauseRef: "30", questionText: "Rapporti di controllo e prove (VT, NDT, DT) conservati e accessibili (16)", questionType: "conformity", isMandatory: true, displayOrder: 30 },
        { questionId: null, clauseRef: "31", questionText: "Registrazioni del trattamento termico (PWHT) disponibili se applicabile (16)", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: null, clauseRef: "32", questionText: "Dossier di saldatura completo per ogni commessa/struttura prodotta (16)", questionType: "conformity", isMandatory: true, displayOrder: 32 }
      ]
    },
    {
      sectionCode: "3834_s17",
      sectionTitle: "17 - Dichiarazione di conformità",
      displayOrder: 9,
      questions: [
        { questionId: null, clauseRef: "33", questionText: "Dichiarazione di conformità alla norma ISO 3834-2 disponibile e aggiornata (17)", questionType: "conformity", isMandatory: true, displayOrder: 33 },
        { questionId: null, clauseRef: "34", questionText: "Marcatura CE / dichiarazioni di prestazione per prodotti saldati (se applicabile) (17)", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: null, clauseRef: "35", questionText: "Certificazione di terza parte o attestazione di conformità ISO 3834-2 (se richiesta) (17)", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: null, clauseRef: "36", questionText: "Piano di gestione qualità di saldatura (WQMP) redatto e applicato (generale)", questionType: "conformity", isMandatory: true, displayOrder: 36 }
      ]
    }
  ]
};

/**
 * Template ISO 3834-2 — Checklist In Campo per Audit Fornitori (Mason Srl)
 * 22 domande suddivise in 4 sezioni operative.
 * Fonte: Checklist_in campo_TIPO_audit_fornitori.pdf
 * questionId: null = domande non ancora nel DB (sync silenzioso)
 */
export const ISO_3834_TEMPLATE = {
  standardId: 6,
  standardCode: "ISO_3834_2",
  standardName: "ISO 3834-2 - Audit Fornitori in Campo",
  sections: [
    {
      sectionCode: "3834_s1",
      sectionTitle: "GESTIONE QUALIT\u00c0",
      displayOrder: 1,
      questions: [
        { questionId: null, clauseRef: "3834f_q1",  displayOrder: 1,  questionType: "conformity", isMandatory: true,
          questionText: "Il fornitore \u00e8 in possesso di certificazione UNI EN ISO 9001?" },
        { questionId: null, clauseRef: "3834f_q2",  displayOrder: 2,  questionType: "conformity", isMandatory: true,
          questionText: "Qualora il fornitore sia certificato ISO 3834 si effettua un corretto riesame dei requisiti?" },
        { questionId: null, clauseRef: "3834f_q3",  displayOrder: 3,  questionType: "conformity", isMandatory: true,
          questionText: "Vengono subappaltate alcune attivit\u00e0 (es. saldatura, ispezione, controlli non distruttivi, trattamenti termici)?" },
        { questionId: null, clauseRef: "3834f_q4",  displayOrder: 4,  questionType: "conformity", isMandatory: true,
          questionText: "\u00c8 stato stabilito un criterio di accettabilit\u00e0 fra le parti?" },
        { questionId: null, clauseRef: "3834f_q5",  displayOrder: 5,  questionType: "conformity", isMandatory: false,
          questionText: "Il fornitore ha preparato il PPAP in accordo alle specifiche di riferimento?" },
        { questionId: null, clauseRef: "3834f_q6",  displayOrder: 6,  questionType: "conformity", isMandatory: true,
          questionText: "Come vengono gestite le eventuali non conformit\u00e0?" }
      ]
    },
    {
      sectionCode: "3834_s2",
      sectionTitle: "CONTROLLO DOCUMENTALE",
      displayOrder: 2,
      questions: [
        { questionId: null, clauseRef: "3834f_q7",  displayOrder: 7,  questionType: "conformity", isMandatory: true,
          questionText: "La rintracciabilit\u00e0 del materiale \u00e8 garantita? Vengono gestiti i certificati con documenti secondo ISO 10204?" },
        { questionId: null, clauseRef: "3834f_q8",  displayOrder: 8,  questionType: "conformity", isMandatory: true,
          questionText: "\u00c8 presente un coordinatore di saldatura (IWT/IWE)?" },
        { questionId: null, clauseRef: "3834f_q9",  displayOrder: 9,  questionType: "conformity", isMandatory: true,
          questionText: "I saldatori e gli operatori di saldatura (WQ) sono in grado di eseguire le attivit\u00e0 di saldatura? Sono provvisti di qualifiche ISO 9606/ISO 14732?" },
        { questionId: null, clauseRef: "3834f_q10", displayOrder: 10, questionType: "conformity", isMandatory: true,
          questionText: "I procedimenti di saldatura (WPQR) sono correttamente qualificati (ISO 15614/ISO 15613)?" },
        { questionId: null, clauseRef: "3834f_q11", displayOrder: 11, questionType: "conformity", isMandatory: true,
          questionText: "Sono presenti specifiche di saldatura (WPS) applicabili ai componenti ispezionati?" },
        { questionId: null, clauseRef: "3834f_q12", displayOrder: 12, questionType: "conformity", isMandatory: true,
          questionText: "Il personale addetto alle prove non distruttive \u00e8 qualificato (certificazione CND secondo ISO 9712)?" }
      ]
    },
    {
      sectionCode: "3834_s3",
      sectionTitle: "ISPEZIONE IN CAMPO",
      displayOrder: 3,
      questions: [
        { questionId: null, clauseRef: "3834f_q13", displayOrder: 13, questionType: "conformity", isMandatory: true,
          questionText: "Il fornitore possiede adeguate attrezzature per la saldatura? Sono manutenute e i parametri di voltaggio/corrente controllati periodicamente?" },
        { questionId: null, clauseRef: "3834f_q14", displayOrder: 14, questionType: "conformity", isMandatory: true,
          questionText: "Sono disponibili i disegni tecnici nelle aree di saldatura?" },
        { questionId: null, clauseRef: "3834f_q15", displayOrder: 15, questionType: "conformity", isMandatory: true,
          questionText: "Controllo della pulizia del pezzo: il materiale base \u00e8 pulito e privo di sporcizia prima della saldatura?" },
        { questionId: null, clauseRef: "3834f_q16", displayOrder: 16, questionType: "conformity", isMandatory: false,
          questionText: "Le maschere di saldatura sono monitorate dimensionalmente? Sono etichettate e controllate periodicamente?" },
        { questionId: null, clauseRef: "3834f_q17", displayOrder: 17, questionType: "conformity", isMandatory: true,
          questionText: "La puntatura del pezzo presenta criticit\u00e0? C'\u00e8 personale dedicato con patentini e istruzioni operative dedicate?" },
        { questionId: null, clauseRef: "3834f_q18", displayOrder: 18, questionType: "conformity", isMandatory: true,
          questionText: "Eventuali riparazioni sul pezzo vengono registrate? Esistono WPS dedicate alle riparazioni?" },
        { questionId: null, clauseRef: "3834f_q19", displayOrder: 19, questionType: "conformity", isMandatory: true,
          questionText: "Le condizioni di stoccaggio del Materiale Base, d'Apporto e Gas risultano adeguate (umidit\u00e0, temperatura)?" }
      ]
    },
    {
      sectionCode: "3834_s4",
      sectionTitle: "CONTROLLO POST-SALDATURA",
      displayOrder: 4,
      questions: [
        { questionId: null, clauseRef: "3834f_q20", displayOrder: 20, questionType: "conformity", isMandatory: true,
          questionText: "Sono eseguiti e registrati Controlli Non Distruttivi (CND)? Quali sono e che estensione hanno?" },
        { questionId: null, clauseRef: "3834f_q21", displayOrder: 21, questionType: "conformity", isMandatory: true,
          questionText: "Si eseguono controlli dimensionali del pezzo in accordo ai disegni contrattuali? \u00c8 disponibile il rapporto dimensionale?" },
        { questionId: null, clauseRef: "3834f_q22", displayOrder: 22, questionType: "conformity", isMandatory: false,
          questionText: "\u00c8 contemplata una marcatura del pezzo finito?" }
      ]
    }
  ]
};

/**
 * Template ISO 45001:2018 (Sistema di Gestione per la Salute e Sicurezza sul Lavoro)
 * Clausole 4-10 — 53 domande di audit
 * questionId: question_id reali da DB (standard_id=3, migration 2026-05-07)
 * sectionCode allineati ai section_code DB (45001_c4…45001_c10)
 */
export const ISO_45001_TEMPLATE = {
  standardId: 3,
  standardCode: "ISO_45001_2018",
  standardName: "ISO 45001:2018",
  sections: [
    {
      sectionCode: "45001_c4",
      sectionTitle: "4 - Contesto dell\u2019Organizzazione",
      displayOrder: 1,
      questions: [
        { questionId: 276, clauseRef: "4.1", questionText: "4.1 - L\u2019organizzazione ha determinato i fattori esterni e interni pertinenti alle sue finalit\u00e0 e che influenzano la sua capacit\u00e0 di conseguire i risultati attesi per il proprio sistema di gestione per la SSL?", questionType: "conformity", isMandatory: true, displayOrder: 1 },
        { questionId: 277, clauseRef: "4.2", questionText: "4.2 - L\u2019organizzazione ha determinato le altre parti interessate pertinenti al SGSSL, le esigenze e aspettative pertinenti (requisiti) dei lavoratori e di altre parti interessate, e quali di queste esigenze diventano o potrebbero diventare requisiti legali e altri requisiti?", questionType: "conformity", isMandatory: true, displayOrder: 2 },
        { questionId: 278, clauseRef: "4.3", questionText: "4.3 - Il campo di applicazione del SGSSL \u00e8 determinato considerando i fattori 4.1, i requisiti 4.2 e le attivit\u00e0 correlate al lavoro; \u00e8 disponibile come informazione documentata?", questionType: "conformity", isMandatory: true, displayOrder: 3 },
        { questionId: 279, clauseRef: "4.3", questionText: "4.3 - Il sistema di gestione per la SSL include le attivit\u00e0, i prodotti e i servizi nell\u2019ambito del controllo o dell\u2019influenza dell\u2019organizzazione che possono avere un impatto sulle prestazioni in termini di SSL?", questionType: "conformity", isMandatory: true, displayOrder: 4 },
        { questionId: 280, clauseRef: "4.4", questionText: "4.4 - Il sistema di gestione per la SSL \u00e8 stabilito, attuato, mantenuto e migliorato in modo continuo, compresi i processi necessari e le loro interazioni, in conformit\u00e0 ai requisiti della norma?", questionType: "conformity", isMandatory: true, displayOrder: 5 }
      ]
    },
    {
      sectionCode: "45001_c5",
      sectionTitle: "5 - Leadership e Partecipazione dei Lavoratori",
      displayOrder: 2,
      questions: [
        { questionId: 281, clauseRef: "5.1", questionText: "5.1 - L\u2019alta direzione dimostra leadership e impegno: assume piena responsabilit\u00e0 per la prevenzione di lesioni e malattie, assicura disponibilit\u00e0 risorse, integra requisiti SSL nei processi di business, comunica importanza SSL, assicura conseguimento risultati attesi?", questionType: "conformity", isMandatory: true, displayOrder: 6 },
        { questionId: 282, clauseRef: "5.1", questionText: "5.1 - L\u2019alta direzione guida e sostiene le persone affinch\u00e9 contribuiscano all\u2019efficacia del SGSSL, assicura e promuove il miglioramento continuo, sviluppa una cultura che supporti i risultati attesi, protegge i lavoratori da ritorsioni e assicura processi di consultazione e partecipazione?", questionType: "conformity", isMandatory: true, displayOrder: 7 },
        { questionId: 283, clauseRef: "5.2", questionText: "5.2 - La politica per la SSL \u00e8 stabilita, comprende impegno a condizioni di lavoro sicure e salubri, fornisce quadro per gli obiettivi, comprende impegno a requisiti legali, eliminazione pericoli, miglioramento continuo e consultazione/partecipazione dei lavoratori?", questionType: "conformity", isMandatory: true, displayOrder: 8 },
        { questionId: 284, clauseRef: "5.2", questionText: "5.2 - La politica per la SSL \u00e8 disponibile come informazione documentata, \u00e8 comunicata all\u2019interno dell\u2019organizzazione ed \u00e8 disponibile alle parti interessate?", questionType: "conformity", isMandatory: true, displayOrder: 9 },
        { questionId: 285, clauseRef: "5.3", questionText: "5.3 - Le responsabilit\u00e0 e le autorit\u00e0 per i ruoli pertinenti al SGSSL sono assegnate, comunicate a tutti i livelli e mantenute come informazioni documentate? I lavoratori si assumono la responsabilit\u00e0 degli aspetti del sistema su cui hanno il controllo?", questionType: "conformity", isMandatory: true, displayOrder: 10 },
        { questionId: 286, clauseRef: "5.3", questionText: "5.3 - Sono assegnate specifiche responsabilit\u00e0 e autorit\u00e0 per: assicurare che il SGSSL sia conforme ai requisiti della norma; riferire all\u2019alta direzione sulle prestazioni del sistema di gestione per la SSL?", questionType: "conformity", isMandatory: true, displayOrder: 11 },
        { questionId: 287, clauseRef: "5.4", questionText: "5.4 - Sono stabiliti processi per la consultazione e la partecipazione dei lavoratori a tutti i livelli, fornendo modalit\u00e0, tempo, formazione e risorse necessarie, accesso a informazioni chiare e pertinenti sul SGSSL, eliminando ostacoli alla partecipazione?", questionType: "conformity", isMandatory: true, displayOrder: 12 },
        { questionId: 288, clauseRef: "5.4", questionText: "5.4 - \u00c8 favorita la consultazione dei lavoratori senza funzioni manageriali sulle seguenti attivit\u00e0: determinare esigenze parti interessate, stabilire politica SSL, assegnare ruoli, determinare come soddisfare requisiti legali, stabilire obiettivi SSL, determinare controlli appaltatori, stabilire cosa monitorare, pianificare audit, assicurare miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 13 },
        { questionId: 289, clauseRef: "5.4", questionText: "5.4 - \u00c8 favorita la partecipazione dei lavoratori senza funzioni manageriali nelle seguenti attivit\u00e0: determinare modalit\u00e0 di consultazione/partecipazione, identificare pericoli e valutare rischi/opportunit\u00e0, determinare azioni per eliminare pericoli, determinare requisiti di competenza, determinare cosa comunicare, determinare misure di controllo, investigare incidenti e NC?", questionType: "conformity", isMandatory: true, displayOrder: 14 }
      ]
    },
    {
      sectionCode: "45001_c6",
      sectionTitle: "6 - Pianificazione",
      displayOrder: 3,
      questions: [
        { questionId: 290, clauseRef: "6.1.1", questionText: "6.1.1 - Sono determinati i rischi e le opportunit\u00e0 da affrontare per: assicurare i risultati attesi del SGSSL, prevenire o ridurre gli effetti indesiderati, conseguire il miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 15 },
        { questionId: 291, clauseRef: "6.1.1", questionText: "6.1.1 - I rischi e le opportunit\u00e0 connessi ai cambiamenti nell\u2019organizzazione sono determinati e valutati prima dell\u2019attuazione della modifica? Sono conservate informazioni documentate sui rischi/opportunit\u00e0 e sui processi/azioni per determinarli e affrontarli?", questionType: "conformity", isMandatory: true, displayOrder: 16 },
        { questionId: 292, clauseRef: "6.1.2.1", questionText: "6.1.2.1 - Sono stabiliti processi per l\u2019identificazione continua e proattiva dei pericoli, considerando: fattori sociali (carico lavoro, orari, molestie), organizzazione del lavoro, attivit\u00e0 di routine e non, incidenti rilevanti, situazioni di emergenza, persone presenti nel luogo di lavoro?", questionType: "conformity", isMandatory: true, displayOrder: 17 },
        { questionId: 293, clauseRef: "6.1.2.1", questionText: "6.1.2.1 - L\u2019identificazione dei pericoli considera anche: progettazione di aree di lavoro, processi, installazioni e attrezzature; situazioni nelle vicinanze del posto di lavoro; cambiamenti reali o proposti nell\u2019organizzazione, attivit\u00e0 e processi; cambiamenti nella conoscenza e nelle informazioni dei pericoli?", questionType: "conformity", isMandatory: true, displayOrder: 18 },
        { questionId: 294, clauseRef: "6.1.2.2", questionText: "6.1.2.2 - Sono stabiliti processi per valutare i rischi per la SSL provenienti dai pericoli identificati e gli altri rischi connessi al SGSSL? Le metodologie e i criteri per la valutazione dei rischi sono definiti, documentati e assicurano un approccio proattivo e sistematico?", questionType: "conformity", isMandatory: true, displayOrder: 19 },
        { questionId: 295, clauseRef: "6.1.2.3", questionText: "6.1.2.3 - Sono stabiliti processi per valutare le opportunit\u00e0 per la SSL (miglioramento prestazioni SSL, adattamento del lavoro ai lavoratori, eliminazione pericoli) e altre opportunit\u00e0 di miglioramento del SGSSL?", questionType: "conformity", isMandatory: true, displayOrder: 20 },
        { questionId: 296, clauseRef: "6.1.3", questionText: "6.1.3 - Sono determinati e accessibili i requisiti legali aggiornati e altri requisiti applicabili ai pericoli, ai rischi per la SSL e al SGSSL? Sono tenuti in conto nel sistema e mantenuti come informazioni documentate aggiornate?", questionType: "conformity", isMandatory: true, displayOrder: 21 },
        { questionId: 297, clauseRef: "6.1.4", questionText: "6.1.4 - Sono pianificate azioni per affrontare rischi e opportunit\u00e0, soddisfare requisiti legali e prepararsi alle emergenze? Sono determinate le modalit\u00e0 per integrare le azioni nei processi del SGSSL, attuarle e valutarne l\u2019efficacia, tenendo conto della gerarchia delle misure di prevenzione?", questionType: "conformity", isMandatory: true, displayOrder: 22 },
        { questionId: 298, clauseRef: "6.2.1", questionText: "6.2.1 - Gli obiettivi per la SSL sono stabiliti per funzioni e livelli pertinenti, sono coerenti con la politica, misurabili, tengono conto di requisiti/valutazioni rischi-opportunit\u00e0/consultazione lavoratori, sono monitorati, comunicati, aggiornati e mantenuti come informazioni documentate?", questionType: "conformity", isMandatory: true, displayOrder: 23 },
        { questionId: 299, clauseRef: "6.2.2", questionText: "6.2.2 - Per ciascun obiettivo per la SSL \u00e8 determinato: cosa sar\u00e0 fatto, quali risorse saranno richieste, chi ne sar\u00e0 responsabile, quando sar\u00e0 completato, come saranno valutati i risultati (compresi indicatori di monitoraggio) e come le azioni saranno integrate nei processi di business?", questionType: "conformity", isMandatory: true, displayOrder: 24 }
      ]
    },
    {
      sectionCode: "45001_c7",
      sectionTitle: "7 - Supporto",
      displayOrder: 4,
      questions: [
        { questionId: 300, clauseRef: "7.1", questionText: "7.1 - Sono determinate e fornite le risorse necessarie per l\u2019istituzione, l\u2019attuazione, il mantenimento e il miglioramento continuo del sistema di gestione per la SSL?", questionType: "conformity", isMandatory: true, displayOrder: 25 },
        { questionId: 301, clauseRef: "7.2", questionText: "7.2 - Sono determinate le competenze necessarie dei lavoratori che influenzano o possono influenzare le prestazioni SSL (inclusa la capacit\u00e0 di identificare i pericoli)? Sono assicurate competenze adeguate da istruzione/formazione/esperienza? Sono intraprese azioni per acquisirle e ne \u00e8 valutata l\u2019efficacia? Sono conservate evidenze documentate?", questionType: "conformity", isMandatory: true, displayOrder: 26 },
        { questionId: 302, clauseRef: "7.3", questionText: "7.3 - I lavoratori sono resi consapevoli di: politica e obiettivi per la SSL, proprio contributo all\u2019efficacia del SGSSL, implicazioni e conseguenze derivanti dal non essere conformi ai requisiti del sistema, incidenti che li riguardano, pericoli e rischi SSL che li riguardano, capacit\u00e0 di allontanarsi da situazioni di pericolo grave e immediato?", questionType: "conformity", isMandatory: true, displayOrder: 27 },
        { questionId: 303, clauseRef: "7.4.1", questionText: "7.4.1 - Sono stabiliti processi per le comunicazioni interne ed esterne pertinenti al SGSSL (cosa/quando/con chi/come), tenendo conto della diversit\u00e0 (genere, lingua, cultura, disabilit\u00e0)? Le informazioni SSL comunicate sono coerenti con quelle del sistema e affidabili? Sono conservate informazioni documentate delle comunicazioni?", questionType: "conformity", isMandatory: true, displayOrder: 28 },
        { questionId: 304, clauseRef: "7.4.2", questionText: "7.4.2 - La comunicazione interna assicura la diffusione di informazioni pertinenti al SGSSL tra livelli e funzioni, compresi i cambiamenti, e consente ai lavoratori di contribuire al miglioramento continuo del sistema?", questionType: "conformity", isMandatory: true, displayOrder: 29 },
        { questionId: 305, clauseRef: "7.4.3", questionText: "7.4.3 - La comunicazione esterna pertinente al SGSSL avviene in conformit\u00e0 ai processi comunicativi dell\u2019organizzazione e tenendo in considerazione i requisiti legali e altri requisiti?", questionType: "conformity", isMandatory: true, displayOrder: 30 },
        { questionId: 306, clauseRef: "7.5.1", questionText: "7.5.1 - Il sistema di gestione per la SSL comprende le informazioni documentate richieste dalla norma e quelle aggiuntive che l\u2019organizzazione determina necessarie per l\u2019efficacia del SGSSL?", questionType: "conformity", isMandatory: true, displayOrder: 31 },
        { questionId: 307, clauseRef: "7.5.2", questionText: "7.5.2 - Nella creazione e aggiornamento delle informazioni documentate sono assicurati in maniera appropriata: identificazione e descrizione, formato e supporto, riesame e approvazione in merito all\u2019idoneita\u2019 e all\u2019adeguatezza?", questionType: "conformity", isMandatory: true, displayOrder: 32 },
        { questionId: 308, clauseRef: "7.5.3", questionText: "7.5.3 - Le informazioni documentate del SGSSL sono tenute sotto controllo (disponibili e idonee, adeguatamente protette; distribuzione, accesso, archiviazione, preservazione, versioni, conservazione ed eliminazione assicurati)? Le informazioni documentate di origine esterna sono identificate e controllate?", questionType: "conformity", isMandatory: true, displayOrder: 33 }
      ]
    },
    {
      sectionCode: "45001_c8",
      sectionTitle: "8 - Attivit\u00e0 Operative",
      displayOrder: 5,
      questions: [
        { questionId: 309, clauseRef: "8.1.1", questionText: "8.1.1 - I processi necessari per soddisfare i requisiti del SGSSL sono pianificati, attuati, controllati e mantenuti: criteri per i processi definiti, controllo attuato in conformit\u00e0 ai criteri, informazioni documentate conservate, lavoro adattato ai lavoratori?", questionType: "conformity", isMandatory: true, displayOrder: 34 },
        { questionId: 310, clauseRef: "8.1.1", questionText: "8.1.1 - Nei luoghi di lavoro con pi\u00f9 datori di lavoro, l\u2019organizzazione coordina le parti pertinenti del sistema di gestione per la SSL con le altre organizzazioni presenti?", questionType: "conformity", isMandatory: true, displayOrder: 35 },
        { questionId: 311, clauseRef: "8.1.2", questionText: "8.1.2 - Sono stabiliti processi per l\u2019eliminazione dei pericoli e la riduzione dei rischi per la SSL applicando la gerarchia delle misure di prevenzione e protezione: eliminazione, sostituzione, misure tecnico-progettuali, misure amministrative (inclusa formazione), dispositivi di protezione individuale?", questionType: "conformity", isMandatory: true, displayOrder: 36 },
        { questionId: 312, clauseRef: "8.1.3", questionText: "8.1.3 - Sono stabiliti processi per l\u2019attuazione e il controllo delle modifiche temporanee e permanenti pianificate con impatto sulla SSL (nuovi prodotti/servizi/processi, cambiamenti requisiti legali, cambiamenti nella conoscenza dei pericoli, sviluppi tecnologici)? Le conseguenze dei cambiamenti involontari sono riesaminate con azioni mitiganti?", questionType: "conformity", isMandatory: true, displayOrder: 37 },
        { questionId: 313, clauseRef: "8.1.4", questionText: "8.1.4.1/8.1.4.2 - Sono stabiliti processi per tenere sotto controllo l\u2019approvvigionamento di prodotti e servizi? L\u2019organizzazione coordina con gli appaltatori per identificare pericoli e valutare/controllare rischi SSL da attivit\u00e0 degli appaltatori e dell\u2019organizzazione stessa?", questionType: "conformity", isMandatory: true, displayOrder: 38 },
        { questionId: 314, clauseRef: "8.1.4", questionText: "8.1.4.2/8.1.4.3 - I requisiti del SGSSL sono soddisfatti dagli appaltatori e dai loro lavoratori? I processi di selezione degli appaltatori applicano criteri di salute e sicurezza sul lavoro? Le funzioni e i processi affidati all\u2019esterno sono tenuti sotto controllo in modo coerente con requisiti legali e risultati attesi del SGSSL?", questionType: "conformity", isMandatory: true, displayOrder: 39 },
        { questionId: 315, clauseRef: "8.2", questionText: "8.2 - Sono stabiliti processi per la preparazione e risposta alle situazioni di emergenza: risposta pianificata (incluso primo soccorso), formazione per la risposta pianificata, prove ed esercitazioni periodiche, revisione delle modalit\u00e0 di risposta dopo prove o emergenze reali, comunicazione agli appaltatori/visitatori/servizi di emergenza/autorit\u00e0?", questionType: "conformity", isMandatory: true, displayOrder: 40 },
        { questionId: 316, clauseRef: "8.2", questionText: "8.2 - L\u2019organizzazione tiene conto delle esigenze e delle capacit\u00e0 di tutte le parti interessate pertinenti e assicura il loro coinvolgimento nello sviluppo della risposta pianificata alle emergenze? Sono conservate informazioni documentate sui processi e sui piani per rispondere alle potenziali situazioni di emergenza?", questionType: "conformity", isMandatory: true, displayOrder: 41 },
        { questionId: 317, clauseRef: "8.2", questionText: "8.2 - Il coinvolgimento delle parti interessate pertinenti nello sviluppo della risposta alle emergenze \u00e8 assicurato? Le comunicazioni pertinenti in materia di preparazione e risposta alle emergenze sono fornite anche alle parti interessate esterne (appaltatori, visitatori, servizi di emergenza, autorit\u00e0, comunit\u00e0 locale)?", questionType: "conformity", isMandatory: true, displayOrder: 42 }
      ]
    },
    {
      sectionCode: "45001_c9",
      sectionTitle: "9 - Valutazione delle Prestazioni",
      displayOrder: 6,
      questions: [
        { questionId: 318, clauseRef: "9.1.1", questionText: "9.1.1 - Sono determinati: cosa \u00e8 necessario monitorare e misurare (conformit\u00e0 requisiti legali, attivit\u00e0 relative a pericoli/rischi/opportunit\u00e0, progressi verso obiettivi SSL, efficacia controlli), i metodi, i criteri di valutazione delle prestazioni SSL, la frequenza e quando analizzare e comunicare i risultati?", questionType: "conformity", isMandatory: true, displayOrder: 43 },
        { questionId: 319, clauseRef: "9.1.1", questionText: "9.1.1 - Le apparecchiature di monitoraggio e misurazione sono tarate o verificate e mantenute appropriatamente? Sono conservate informazioni documentate quali evidenza dei risultati di monitoraggio/misurazione/analisi/valutazione e della manutenzione/taratura/verifica delle apparecchiature?", questionType: "conformity", isMandatory: true, displayOrder: 44 },
        { questionId: 320, clauseRef: "9.1.2", questionText: "9.1.2 - Sono stabiliti processi per valutare la conformit\u00e0 ai requisiti legali e altri requisiti: determinazione frequenza e metodi di valutazione, conformit\u00e0 valutata con azioni intraprese se necessario, conoscenza e comprensione dello stato di conformit\u00e0 mantenuta, risultati della valutazione conservati come informazioni documentate?", questionType: "conformity", isMandatory: true, displayOrder: 45 },
        { questionId: 321, clauseRef: "9.2.1", questionText: "9.2.1 - Sono condotti audit interni a intervalli pianificati per accertare se il SGSSL \u00e8 conforme ai requisiti propri dell\u2019organizzazione (politica, obiettivi SSL) e ai requisiti della norma, ed \u00e8 efficacemente attuato e mantenuto?", questionType: "conformity", isMandatory: true, displayOrder: 46 },
        { questionId: 322, clauseRef: "9.2.2", questionText: "9.2.2 - Il programma di audit interno comprende: frequenza, metodi, responsabilit\u00e0, consultazione, pianificazione/reporting; criteri e campo di applicazione definiti per ciascun audit; auditor selezionati per obiettivit\u00e0 e imparzialit\u00e0; risultati riportati ai manager pertinenti e ai lavoratori; azioni per NC intraprese; informazioni documentate conservate?", questionType: "conformity", isMandatory: true, displayOrder: 47 },
        { questionId: 323, clauseRef: "9.3", questionText: "9.3 - L\u2019alta direzione riesamina il SGSSL a intervalli pianificati considerando: azioni da riesami precedenti, cambiamenti interni/esterni (parti interessate, requisiti legali, rischi/opportunit\u00e0), grado realizzazione politica/obiettivi SSL, prestazioni (incidenti/NC/azioni correttive, monitoraggio, conformit\u00e0, audit, consultazione/partecipazione), adeguatezza risorse, comunicazioni con parti interessate, opportunit\u00e0 miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 48 },
        { questionId: 324, clauseRef: "9.3", questionText: "9.3 - Gli output del riesame di direzione comprendono decisioni su: mantenimento idoneita\u2019/adeguatezza/efficacia SGSSL, miglioramento continuo, modifiche al sistema, risorse necessarie, azioni, integrazione con processi di business, implicazioni strategiche? I risultati del riesame sono comunicati ai lavoratori e sono conservate informazioni documentate?", questionType: "conformity", isMandatory: true, displayOrder: 49 }
      ]
    },
    {
      sectionCode: "45001_c10",
      sectionTitle: "10 - Miglioramento",
      displayOrder: 7,
      questions: [
        { questionId: 325, clauseRef: "10.1", questionText: "10.1 - L\u2019organizzazione determina opportunit\u00e0 di miglioramento (dal punto 9) e intraprende le azioni necessarie al conseguimento dei risultati attesi del proprio sistema di gestione per la SSL?", questionType: "conformity", isMandatory: true, displayOrder: 50 },
        { questionId: 326, clauseRef: "10.2", questionText: "10.2 - Sono stabiliti processi per determinare e gestire incidenti e non conformit\u00e0: reazione tempestiva, valutazione necessit\u00e0 azioni correttive per eliminare cause radice con coinvolgimento lavoratori, riesame valutazioni rischi, determinazione e attuazione azioni necessarie (gerarchia misure), riesame efficacia azioni, modifiche al SGSSL se necessario?", questionType: "conformity", isMandatory: true, displayOrder: 51 },
        { questionId: 327, clauseRef: "10.2", questionText: "10.2 - Le azioni correttive sono proporzionate agli effetti reali o potenziali degli incidenti/NC? Sono conservate informazioni documentate (natura NC/incidenti, azioni intraprese, risultati e efficacia delle azioni correttive)? Queste informazioni sono comunicate ai lavoratori e ai rappresentanti?", questionType: "conformity", isMandatory: true, displayOrder: 52 },
        { questionId: 328, clauseRef: "10.3", questionText: "10.3 - L\u2019organizzazione migliora in modo continuo l\u2019idoneita\u2019, l\u2019adeguatezza e l\u2019efficacia del SGSSL mediante: miglioramento prestazioni SSL, promozione cultura SSL, promozione partecipazione lavoratori, comunicazione risultati del miglioramento, conservazione evidenze documentate del miglioramento continuo?", questionType: "conformity", isMandatory: true, displayOrder: 53 }
      ]
    }
  ]
};

/**
 * Registry di tutti i templates disponibili
 */
export const CHECKLIST_TEMPLATES = {
  1: ISO_9001_TEMPLATE,   // ISO 9001:2015
  2: ISO_14001_TEMPLATE,  // ISO 14001:2015
  3: ISO_45001_TEMPLATE,  // ISO 45001:2018
  6: ISO_3834_TEMPLATE,   // ISO 3834-2 Checklist In Campo (Mason)
  7: RDP_MSN_TEMPLATE,    // Rapporto di Prova / Audit Fornitori (clausole norma ISO 3834-2)
};

/**
 * Ottiene template checklist per standard_id
 * @param {number} standardId 
 * @returns {Object|null} Template oppure null
 */
export function getChecklistTemplate(standardId) {
  return CHECKLIST_TEMPLATES[standardId] || null;
}

/**
 * Verifica se template è disponibile
 * @param {number} standardId 
 * @returns {boolean}
 */
export function hasChecklistTemplate(standardId) {
  const template = CHECKLIST_TEMPLATES[standardId];
  return template && template.sections && template.sections.length > 0;
}
