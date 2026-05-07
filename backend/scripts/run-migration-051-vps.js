/**
 * run-migration-051-vps.js
 * ISO 45001:2018 — Checklist COMPLETA da norma (53 domande + norm_excerpt, clausole 4→10)
 *
 * Eseguire sul VPS:
 *   scp -P 1122 -i $KEY run-migration-051-vps.js spascarella@www.fr-busato.it:/tmp/
 *   cd /var/www/sgq-backend && DB_SERVER=localhost DB_PORT=11043 DB_DATABASE=SGQ_ISO9001 \
 *     DB_USER=pascarella DB_PASSWORD='#Gestione2025@' NODE_ENV=production node /tmp/run-migration-051-vps.js
 */

'use strict';
const { query } = require('/var/www/sgq-backend/src/config/database');

async function step(label, sql) {
    try {
        const r = await query(sql);
        if (r.recordset && r.recordset.length > 0) {
            console.log(`OK — ${label}:`, JSON.stringify(r.recordset));
        } else {
            const affected = Array.isArray(r.rowsAffected) ? r.rowsAffected.join(',') : '0';
            console.log(`OK — ${label} (${affected} righe modificate)`);
        }
        return r;
    } catch (e) {
        console.error(`ERRORE — ${label}:`, e.message);
        throw e;
    }
}

(async () => {
    console.log('=== Migration 051: ISO 45001:2018 checklist COMPLETA ===\n');

    // PRIMA
    await step('PRIMA stato', `
        SELECT
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=3)                AS sections_count,
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=3 AND is_active=1) AS sections_active,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=3)                AS total_q,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=3 AND is_active=1) AS active_q
    `);

    // 1. Soft-delete TUTTE le domande ISO 45001 attive (placeholder esistenti)
    await step('Soft-delete tutte domande ISO 45001 esistenti', `
        UPDATE checklist_questions
        SET is_active=0, updated_at=GETDATE()
        WHERE standard_id=3 AND is_active=1
    `);

    // 2. Disattiva sezioni legacy (clause4, clause5, etc.)
    await step('Disattiva sezioni legacy ISO 45001', `
        UPDATE checklist_sections
        SET is_active=0
        WHERE standard_id=3 AND section_code IN ('clause4','clause5','clause6','clause7','clause8','clause9','clause10')
    `);

    // 3. Upsert sezioni clausola 4→10 (idempotente)
    for (const [code, title, ord] of [
        ['45001_c4',  "4 - Contesto dell'Organizzazione",               1],
        ['45001_c5',  '5 - Leadership e Partecipazione dei Lavoratori',  2],
        ['45001_c6',  '6 - Pianificazione',                              3],
        ['45001_c7',  '7 - Supporto',                                    4],
        ['45001_c8',  '8 - Attivita Operative',                          5],
        ['45001_c9',  '9 - Valutazione delle Prestazioni',               6],
        ['45001_c10', '10 - Miglioramento',                              7],
    ]) {
        const escapedTitle = title.replace(/'/g, "''");
        const chk = await query(`SELECT section_id FROM checklist_sections WHERE standard_id=3 AND section_code='${code}'`);
        if (chk.recordset.length > 0) {
            await step(`Riattiva sezione ${code}`, `UPDATE checklist_sections SET section_title=N'${escapedTitle}', is_active=1, display_order=${ord} WHERE standard_id=3 AND section_code='${code}'`);
        } else {
            await step(`Inserisce sezione ${code}`, `INSERT INTO checklist_sections (section_code,section_title,standard_id,display_order,is_active) VALUES ('${code}',N'${escapedTitle}',3,${ord},1)`);
        }
    }

    // 4. Domande + norm_excerpt
    // [section_code, display_order, question_text, norm_excerpt]
    const domande = [
        // §4 – Contesto (5 domande)
        ['45001_c4', 1,
            "4.1 - L'organizzazione ha determinato i fattori esterni e interni pertinenti alle sue finalita' e che influenzano la sua capacita' di conseguire i risultati attesi per il proprio sistema di gestione per la SSL?",
            "L'organizzazione deve determinare i fattori esterni e interni pertinenti alle sue finalita' e che influenzano la sua capacita' di conseguire i risultati attesi per il proprio sistema di gestione per la SSL."],
        ['45001_c4', 2,
            "4.2 - L'organizzazione ha determinato le altre parti interessate pertinenti al SGSSL, le esigenze e aspettative pertinenti (requisiti) dei lavoratori e di altre parti interessate, e quali di queste esigenze diventano o potrebbero diventare requisiti legali e altri requisiti?",
            "L'organizzazione deve determinare: a) le altre parti interessate, oltre ai lavoratori, che sono pertinenti al sistema di gestione per la SSL; b) le esigenze e le aspettative pertinenti (cioe' i requisiti) dei lavoratori e di altre parti interessate; c) quali di queste esigenze e aspettative sono o potrebbero diventare requisiti legali e altri requisiti."],
        ['45001_c4', 3,
            "4.3 - Il campo di applicazione del SGSSL e' determinato considerando i fattori 4.1, i requisiti 4.2 e le attivita' correlate al lavoro; e' disponibile come informazione documentata?",
            "L'organizzazione deve determinare i confini e l'applicabilita' del sistema di gestione per la SSL, al fine di stabilirne il campo di applicazione. Nel determinare il campo di applicazione, l'organizzazione deve: a) considerare i fattori esterni e interni di cui al punto 4.1; b) tenere conto dei requisiti di cui al punto 4.2; c) tenere conto delle attivita' correlate al lavoro pianificate o svolte. Il campo di applicazione deve essere disponibile come informazione documentata."],
        ['45001_c4', 4,
            "4.3 - Il sistema di gestione per la SSL include le attivita', i prodotti e i servizi nell'ambito del controllo o dell'influenza dell'organizzazione che possono avere un impatto sulle prestazioni in termini di SSL?",
            "Il sistema di gestione per la SSL deve includere le attivita', i prodotti e i servizi nell'ambito del controllo o dell'influenza dell'organizzazione i quali possono avere un impatto sulle prestazioni in termini di SSL dell'organizzazione."],
        ['45001_c4', 5,
            "4.4 - Il sistema di gestione per la SSL e' stabilito, attuato, mantenuto e migliorato in modo continuo, compresi i processi necessari e le loro interazioni, in conformita' ai requisiti della norma?",
            "L'organizzazione deve stabilire, attuare, mantenere e migliorare in modo continuo un sistema di gestione per la SSL, compresi i processi necessari e le loro interazioni, in conformita' ai requisiti del presente documento."],

        // §5 – Leadership (9 domande)
        ['45001_c5', 6,
            "5.1 - L'alta direzione dimostra leadership e impegno: assume piena responsabilita' per la prevenzione di lesioni e malattie, assicura disponibilita' risorse, integra requisiti SSL nei processi di business, comunica importanza SSL, assicura conseguimento risultati attesi?",
            "L'alta direzione deve dimostrare leadership e impegno nei riguardi del sistema di gestione per la SSL: a) assumendosi la piena responsabilita' e l'obbligo complessivo di rendere conto della prevenzione di lesioni e malattie correlate al lavoro, nonche' della predisposizione di luoghi di lavoro e attivita' sicuri e salubri; b) assicurando che siano stabiliti la politica e gli obiettivi di SSL; c) assicurando l'integrazione dei requisiti del sistema di SSL nei processi di business dell'organizzazione; d) assicurando che siano disponibili le risorse necessarie; e) comunicando l'importanza di una gestione della SSL efficace."],
        ['45001_c5', 7,
            "5.1 - L'alta direzione guida e sostiene le persone affinche' contribuiscano all'efficacia del SGSSL, assicura e promuove il miglioramento continuo, sviluppa una cultura che supporti i risultati attesi, protegge i lavoratori da ritorsioni e assicura processi di consultazione e partecipazione?",
            "L'alta direzione deve: f) assicurando che il sistema di gestione per la SSL consegua i risultati attesi; g) guidando e sostenendo le persone affinche' contribuiscano all'efficacia del sistema di gestione per la SSL; h) assicurando e promuovendo il miglioramento continuo; i) fornendo sostegno agli altri pertinenti ruoli gestionali; j) sviluppando, guidando e promuovendo una cultura nell'organizzazione che supporti i risultati attesi del sistema di gestione per la SSL; k) proteggendo i lavoratori dalle ritorsioni a seguito della segnalazione di incidenti, pericoli, rischi e opportunita'; l) assicurando che l'organizzazione stabilisca e implementi processi per la consultazione e la partecipazione dei lavoratori; m) supportando l'istituzione e l'operativita' dei comitati per la salute e sicurezza."],
        ['45001_c5', 8,
            "5.2 - La politica per la SSL e' stabilita, comprende impegno a condizioni di lavoro sicure e salubri, fornisce quadro per gli obiettivi, comprende impegno a requisiti legali, eliminazione pericoli, miglioramento continuo e consultazione/partecipazione dei lavoratori?",
            "L'alta direzione deve stabilire, attuare e mantenere una politica per la SSL che: a) comprenda l'impegno a fornire condizioni di lavoro sicure e salubri per la prevenzione di lesioni e malattie correlate al lavoro; b) costituisca un quadro di riferimento per fissare gli obiettivi per la SSL; c) comprenda l'impegno a soddisfare i requisiti legali e altri requisiti; d) comprenda l'impegno ad eliminare i pericoli e a ridurre i rischi per la SSL; e) comprenda l'impegno per il miglioramento continuo del sistema di SSL; f) comprenda l'impegno per la consultazione e la partecipazione dei lavoratori e, ove istituiti, dei rappresentanti dei lavoratori."],
        ['45001_c5', 9,
            "5.2 - La politica per la SSL e' disponibile come informazione documentata, e' comunicata all'interno dell'organizzazione ed e' disponibile alle parti interessate?",
            "La politica per la SSL deve: essere disponibile come informazione documentata; essere comunicata all'interno dell'organizzazione; essere disponibile alle parti interessate, per quanto appropriato; essere pertinente e appropriata."],
        ['45001_c5', 10,
            "5.3 - Le responsabilita' e le autorita' per i ruoli pertinenti al SGSSL sono assegnate, comunicate a tutti i livelli e mantenute come informazioni documentate? I lavoratori si assumono la responsabilita' degli aspetti del sistema su cui hanno il controllo?",
            "L'alta direzione deve assicurare che le responsabilita' e le autorita' per i ruoli pertinenti all'interno del sistema di gestione per la SSL siano assegnate e comunicate a tutti i livelli all'interno dell'organizzazione e mantenute come informazioni documentate. I lavoratori a ciascun livello dell'organizzazione devono assumersi la responsabilita' di quegli aspetti del sistema di gestione per la SSL su cui hanno il controllo."],
        ['45001_c5', 11,
            "5.3 - Sono assegnate specifiche responsabilita' e autorita' per: assicurare che il SGSSL sia conforme ai requisiti della norma; riferire all'alta direzione sulle prestazioni del sistema di gestione per la SSL?",
            "L'alta direzione deve assegnare le responsabilita' e autorita' per: a) assicurare che il sistema di gestione per la SSL sia conforme ai requisiti del presente documento; b) riferire all'alta direzione sulle prestazioni del sistema di gestione per la SSL."],
        ['45001_c5', 12,
            "5.4 - Sono stabiliti processi per la consultazione e la partecipazione dei lavoratori a tutti i livelli, fornendo modalita', tempo, formazione e risorse necessarie, accesso a informazioni chiare e pertinenti sul SGSSL, eliminando ostacoli alla partecipazione?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per la consultazione e la partecipazione dei lavoratori a tutti i livelli e funzioni applicabili e, ove istituiti, dei rappresentanti dei lavoratori. L'organizzazione deve: a) fornire modalita', tempo, formazione e risorse necessarie per la consultazione e la partecipazione; b) fornire un accesso tempestivo a informazioni chiare, comprensibili e pertinenti sul sistema di gestione per la SSL; c) individuare ed eliminare gli ostacoli o le barriere alla partecipazione e ridurre al minimo quelli che non possono essere rimossi."],
        ['45001_c5', 13,
            "5.4 - E' favorita la consultazione dei lavoratori senza funzioni manageriali sulle seguenti attivita': determinare esigenze parti interessate, stabilire politica SSL, assegnare ruoli, determinare come soddisfare requisiti legali, stabilire obiettivi SSL, determinare controlli appaltatori, stabilire cosa monitorare, pianificare audit, assicurare miglioramento continuo?",
            "L'organizzazione deve: d) favorire la consultazione dei lavoratori senza funzioni manageriali sulle seguenti attivita': 1) determinare le esigenze e le aspettative delle parti interessate; 2) stabilire la politica per la SSL; 3) assegnare ruoli, responsabilita' e autorita' nell'organizzazione; 4) determinare come soddisfare i requisiti legali e altri requisiti; 5) stabilire gli obiettivi per la SSL e pianificarne il raggiungimento; 6) determinare i controlli applicabili per l'affidamento all'esterno, l'approvvigionamento e gli appaltatori; 7) determinare cosa necessita di essere monitorato, misurato e valutato; 8) pianificare, stabilire, attuare e mantenere uno o piu' programmi di audit; 9) assicurare il miglioramento continuo."],
        ['45001_c5', 14,
            "5.4 - E' favorita la partecipazione dei lavoratori senza funzioni manageriali nelle seguenti attivita': determinare modalita' di consultazione/partecipazione, identificare pericoli e valutare rischi/opportunita', determinare azioni per eliminare pericoli, determinare requisiti di competenza, determinare cosa comunicare, determinare misure di controllo, investigare incidenti e NC?",
            "L'organizzazione deve: e) favorire la partecipazione di lavoratori senza funzioni manageriali nelle seguenti attivita': 1) determinare le modalita' per la loro consultazione e partecipazione; 2) identificare i pericoli e valutare i rischi e le opportunita'; 3) determinare le azioni per eliminare i pericoli e ridurre i rischi per la SSL; 4) determinare i requisiti di competenza, i fabbisogni formativi, la formazione da effettuare e valutare la formazione stessa; 5) determinare cosa e' necessario comunicare e come farlo; 6) determinare le misure di controllo e la loro attuazione e uso efficaci; 7) investigare incidenti e non conformita' e determinare azioni correttive."],

        // §6 – Pianificazione (10 domande)
        ['45001_c6', 15,
            "6.1.1 - Sono determinati i rischi e le opportunita' da affrontare per: assicurare i risultati attesi del SGSSL, prevenire o ridurre gli effetti indesiderati, conseguire il miglioramento continuo?",
            "Nel pianificare il sistema di gestione per la SSL, l'organizzazione deve considerare i fattori di cui al punto 4.1, i requisiti di cui ai punti 4.2 e 4.3 e determinare i rischi e le opportunita' che e' necessario affrontare per: a) fornire assicurazione che il sistema di gestione per la SSL possa conseguire i risultati attesi; b) prevenire, o ridurre, gli effetti indesiderati; c) conseguire il miglioramento continuo."],
        ['45001_c6', 16,
            "6.1.1 - I rischi e le opportunita' connessi ai cambiamenti nell'organizzazione sono determinati e valutati prima dell'attuazione della modifica? Sono conservate informazioni documentate sui rischi/opportunita' e sui processi/azioni per determinarli e affrontarli?",
            "In caso di modifiche pianificate, permanenti o temporanee, questa valutazione deve essere effettuata prima che sia attuata la modifica. L'organizzazione deve conservare informazioni documentate relative a: rischi e opportunita'; processi e azioni necessarie per determinare e affrontare i rischi e le opportunita' nella misura necessaria per poter ritenere che processi e azioni siano eseguiti come pianificato."],
        ['45001_c6', 17,
            "6.1.2.1 - Sono stabiliti processi per l'identificazione continua e proattiva dei pericoli, considerando: fattori sociali (carico lavoro, orari, molestie), organizzazione del lavoro, attivita' di routine e non, incidenti rilevanti, situazioni di emergenza, persone presenti nel luogo di lavoro?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per l'identificazione continua e proattiva dei pericoli. I processi devono tener conto, ma non limitarsi a: a) come e' organizzato il lavoro, fattori sociali (inclusi carico di lavoro, ore di lavoro, vessazioni, molestie e intimidazioni), leadership e cultura nell'organizzazione; b) attivita' e situazioni di routine e non di routine, compresi i pericoli derivanti da: infrastrutture, attrezzature, materiali, sostanze e condizioni fisiche del luogo di lavoro; progettazione di prodotti e servizi; fattori umani; come viene eseguito il lavoro; c) incidenti rilevanti accaduti, interni o esterni all'organizzazione; d) situazioni di potenziale emergenza; e) persone (lavoratori, appaltatori, visitatori, persone in prossimita' del luogo di lavoro)."],
        ['45001_c6', 18,
            "6.1.2.1 - L'identificazione dei pericoli considera anche: progettazione di aree di lavoro, processi, installazioni e attrezzature; situazioni nelle vicinanze del posto di lavoro; cambiamenti reali o proposti nell'organizzazione, attivita' e processi; cambiamenti nella conoscenza e nelle informazioni dei pericoli?",
            "I processi per l'identificazione dei pericoli devono tener conto anche di: f) altri fattori, inclusi la progettazione di aree di lavoro, processi, installazioni, macchinari/attrezzature, procedure operative e organizzazione del lavoro; situazioni che si verificano nelle vicinanze del posto di lavoro causate da attivita' correlate al lavoro; situazioni non tenute sotto controllo dall'organizzazione nelle vicinanze del luogo di lavoro; g) cambiamenti effettivi o proposti nell'organizzazione, attivita' operative, processi, attivita' nel sistema di gestione per la SSL; h) cambiamenti nella conoscenza e nelle informazioni dei pericoli."],
        ['45001_c6', 19,
            "6.1.2.2 - Sono stabiliti processi per valutare i rischi per la SSL provenienti dai pericoli identificati e gli altri rischi connessi al SGSSL? Le metodologie e i criteri per la valutazione dei rischi sono definiti, documentati e assicurano un approccio proattivo e sistematico?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per: a) valutare i rischi per la SSL provenienti dai pericoli identificati, tenendo conto, al contempo, dell'efficacia dei controlli esistenti; b) determinare e valutare gli altri rischi connessi alla costituzione, attuazione, attivita' operative e manutenzione del sistema di gestione per la SSL. Le metodologie dell'organizzazione e i criteri per la valutazione dei rischi per la SSL devono essere definiti in relazione al loro campo di applicazione, alla loro natura e alla tempistica per assicurare che siano proattivi piuttosto che reattivi e utilizzati in modo sistematico. Le informazioni documentate sulla metodologia e sui criteri devono essere mantenute e conservate."],
        ['45001_c6', 20,
            "6.1.2.3 - Sono stabiliti processi per valutare le opportunita' per la SSL (miglioramento prestazioni SSL, adattamento del lavoro ai lavoratori, eliminazione pericoli) e altre opportunita' di miglioramento del SGSSL?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per valutare: a) opportunita' per la SSL per migliorare le prestazioni in termini di SSL, tenendo conto delle modifiche pianificate all'organizzazione, alle sue politiche, ai processi o alle sue attivita', e: 1) opportunita' di adattare il lavoro, l'organizzazione del lavoro e l'ambiente di lavoro ai lavoratori; 2) opportunita' di eliminare i pericoli e ridurre i rischi per la SSL; b) altre opportunita' di migliorare il sistema di gestione per la SSL."],
        ['45001_c6', 21,
            "6.1.3 - Sono determinati e accessibili i requisiti legali aggiornati e altri requisiti applicabili ai pericoli, ai rischi per la SSL e al SGSSL? Sono tenuti in conto nel sistema e mantenuti come informazioni documentate aggiornate?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per: a) determinare e avere accesso a requisiti legali aggiornati e ad altri requisiti applicabili ai suoi pericoli, ai rischi per la SSL e al sistema di gestione per la SSL; b) determinare in che modo questi requisiti legali e altri requisiti si applicano all'organizzazione e cosa necessita di essere comunicato; c) tenere conto di questi requisiti legali e altri requisiti nell'istituzione, attuazione, mantenimento e miglioramento continuo del proprio sistema di gestione per la SSL. L'organizzazione deve mantenere e conservare le informazioni documentate sui propri requisiti legali e altri requisiti e deve assicurarsi che siano aggiornate per recepire gli eventuali cambiamenti."],
        ['45001_c6', 22,
            "6.1.4 - Sono pianificate azioni per affrontare rischi e opportunita', soddisfare requisiti legali e prepararsi alle emergenze? Sono determinate le modalita' per integrare le azioni nei processi del SGSSL, attuarle e valutarne l'efficacia, tenendo conto della gerarchia delle misure di prevenzione?",
            "L'organizzazione deve pianificare: a) azioni, per: 1) affrontare tali rischi e opportunita'; 2) soddisfare requisiti legali e altri requisiti; 3) prepararsi e rispondere alle situazioni di emergenza; b) modalita', per: 1) integrare e attuare le azioni nei processi del proprio sistema di gestione per la SSL e altri processi di business; 2) valutare l'efficacia di tali azioni. L'organizzazione deve tenere conto della gerarchia delle misure di prevenzione e protezione e degli output dal sistema di gestione per la SSL nel pianificare l'azione da intraprendere."],
        ['45001_c6', 23,
            "6.2.1 - Gli obiettivi per la SSL sono stabiliti per funzioni e livelli pertinenti, sono coerenti con la politica, misurabili, tengono conto di requisiti/valutazioni rischi-opportunita'/consultazione lavoratori, sono monitorati, comunicati, aggiornati e mantenuti come informazioni documentate?",
            "L'organizzazione deve stabilire obiettivi per la SSL alle funzioni e ai livelli pertinenti. Gli obiettivi per la SSL devono: a) essere coerenti con la politica per la SSL; b) essere misurabili (se praticabile) o essere in grado di fornire una valutazione delle prestazioni; c) tenere conto dei requisiti applicabili e dei risultati della valutazione dei rischi e delle opportunita' e della consultazione dei lavoratori; d) essere monitorati; e) essere comunicati; f) essere aggiornati per quanto appropriato. L'organizzazione deve mantenere e conservare informazioni documentate sugli obiettivi e sui piani della SSL per raggiungere tali obiettivi."],
        ['45001_c6', 24,
            "6.2.2 - Per ciascun obiettivo per la SSL e' determinato: cosa sara' fatto, quali risorse saranno richieste, chi ne sara' responsabile, quando sara' completato, come saranno valutati i risultati (compresi indicatori di monitoraggio) e come le azioni saranno integrate nei processi di business?",
            "Nel pianificare come raggiungere i propri obiettivi per la SSL, l'organizzazione deve determinare: a) cosa sara' fatto; b) quali risorse saranno richieste; c) chi ne sara' responsabile; d) quando sara' completato; e) come saranno valutati i risultati, compresi gli indicatori per il monitoraggio; f) come le azioni per raggiungere gli obiettivi per la SSL saranno integrate nei processi di business dell'organizzazione."],

        // §7 – Supporto (9 domande)
        ['45001_c7', 25,
            "7.1 - Sono determinate e fornite le risorse necessarie per l'istituzione, l'attuazione, il mantenimento e il miglioramento continuo del sistema di gestione per la SSL?",
            "L'organizzazione deve determinare e fornire le risorse necessarie per l'istituzione, l'attuazione, il mantenimento e il miglioramento continuo del sistema di gestione per la SSL."],
        ['45001_c7', 26,
            "7.2 - Sono determinate le competenze necessarie dei lavoratori che influenzano o possono influenzare le prestazioni SSL (inclusa la capacita' di identificare i pericoli)? Sono assicurate competenze adeguate da istruzione/formazione/esperienza? Sono intraprese azioni per acquisirle e ne e' valutata l'efficacia? Sono conservate evidenze documentate?",
            "L'organizzazione deve: a) determinare le competenze necessarie dei lavoratori che influenzano o possono influenzare le sue prestazioni in termini di SSL; b) assicurare che i lavoratori siano competenti (compresa la capacita' di identificare i pericoli) sulla base del livello di istruzione, della formazione o dell'esperienza adeguate; c) ove applicabile, intraprendere azioni per acquisire e mantenere le necessarie competenze e valutare l'efficacia delle azioni intraprese; d) conservare appropriate informazioni documentate, quale evidenza delle competenze."],
        ['45001_c7', 27,
            "7.3 - I lavoratori sono resi consapevoli di: politica e obiettivi per la SSL, proprio contributo all'efficacia del SGSSL, implicazioni e conseguenze derivanti dal non essere conformi ai requisiti del sistema, incidenti che li riguardano, pericoli e rischi SSL che li riguardano, capacita' di allontanarsi da situazioni di pericolo grave e immediato?",
            "I lavoratori devono essere resi consapevoli: a) della politica per la SSL e degli obiettivi per la SSL; b) del proprio contributo all'efficacia del sistema di gestione per la SSL, compresi i benefici derivanti dal miglioramento delle prestazioni in termini di SSL; c) delle implicazioni e delle conseguenze potenziali derivanti dal non essere conformi ai requisiti del sistema di gestione per la SSL; d) degli incidenti che li riguardano e dei risultati delle analisi delle relative cause; e) dei pericoli, dei rischi per la SSL e delle relative azioni che li riguardano; f) della capacita' di allontanarsi da situazioni lavorative che ritengono rappresentino un pericolo grave e immediato per la loro vita o salute."],
        ['45001_c7', 28,
            "7.4.1 - Sono stabiliti processi per le comunicazioni interne ed esterne pertinenti al SGSSL (cosa/quando/con chi/come), tenendo conto della diversita' (genere, lingua, cultura, disabilita')? Le informazioni SSL comunicate sono coerenti con quelle del sistema e affidabili? Sono conservate informazioni documentate delle comunicazioni?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi necessari per le comunicazioni interne ed esterne pertinenti al sistema di gestione per la SSL, determinando anche: a) l'oggetto della comunicazione; b) quando comunicare; c) con chi comunicare: 1) internamente tra i differenti livelli e le diverse funzioni dell'organizzazione; 2) con gli appaltatori e i visitatori del luogo di lavoro; 3) con le altre parti interessate; d) come comunicare. L'organizzazione deve tenere conto degli aspetti della diversita' quando si considerano le sue esigenze di comunicazione e assicurare che le opinioni delle parti interessate esterne siano considerate nello stabilire i suoi processi di comunicazione."],
        ['45001_c7', 29,
            "7.4.2 - La comunicazione interna assicura la diffusione di informazioni pertinenti al SGSSL tra livelli e funzioni, compresi i cambiamenti, e consente ai lavoratori di contribuire al miglioramento continuo del sistema?",
            "L'organizzazione deve: a) comunicare internamente informazioni pertinenti al sistema di gestione per la SSL fra i differenti livelli e le diverse funzioni dell'organizzazione, compresi i cambiamenti al sistema di gestione per la SSL, per quanto appropriato; b) assicurare che i suoi processi di comunicazione consentano ai lavoratori di contribuire al miglioramento continuo."],
        ['45001_c7', 30,
            "7.4.3 - La comunicazione esterna pertinente al SGSSL avviene in conformita' ai processi comunicativi dell'organizzazione e tenendo in considerazione i requisiti legali e altri requisiti?",
            "L'organizzazione deve comunicare all'esterno informazioni pertinenti al sistema di gestione per la SSL, come stabilito dai processi di comunicazione dell'organizzazione e tenendo in considerazione i propri requisiti legali e altri requisiti."],
        ['45001_c7', 31,
            "7.5.1 - Il sistema di gestione per la SSL comprende le informazioni documentate richieste dalla norma e quelle aggiuntive che l'organizzazione determina necessarie per l'efficacia del SGSSL?",
            "Il sistema di gestione per la SSL dell'organizzazione deve comprendere: a) le informazioni documentate richieste dal presente documento; b) le informazioni documentate che l'organizzazione determina necessarie per l'efficacia del sistema di gestione per la SSL."],
        ['45001_c7', 32,
            "7.5.2 - Nella creazione e aggiornamento delle informazioni documentate sono assicurati in maniera appropriata: identificazione e descrizione, formato e supporto, riesame e approvazione in merito all'idoneita' e all'adeguatezza?",
            "Nel creare e aggiornare le informazioni documentate, l'organizzazione deve assicurare in maniera appropriata: a) l'identificazione e la descrizione (per esempio titolo, data, autore o numero di riferimento); b) il formato (per esempio lingua, versione del software, grafica) e il supporto (per esempio cartaceo, elettronico); c) il riesame e l'approvazione in merito all'idoneita' e all'adeguatezza."],
        ['45001_c7', 33,
            "7.5.3 - Le informazioni documentate del SGSSL sono tenute sotto controllo (disponibili e idonee, adeguatamente protette; distribuzione, accesso, archiviazione, preservazione, versioni, conservazione ed eliminazione assicurati)? Le informazioni documentate di origine esterna sono identificate e controllate?",
            "Le informazioni documentate richieste dal sistema di gestione per la SSL e dal presente documento devono essere tenute sotto controllo per assicurare che: a) siano disponibili e idonee all'utilizzo, dove e quando necessario; b) siano adeguatamente protette. Per tenere sotto controllo le informazioni documentate, l'organizzazione deve intraprendere le seguenti attivita': distribuzione, accesso, reperimento e utilizzo; archiviazione e preservazione, compreso il mantenimento della leggibilita'; tenuta sotto controllo delle modifiche; conservazione ed eliminazione. Le informazioni documentate di origine esterna, determinate come necessarie dall'organizzazione, devono essere identificate per quanto appropriato, e tenute sotto controllo."],

        // §8 – Attivita Operative (9 domande)
        ['45001_c8', 34,
            "8.1.1 - I processi necessari per soddisfare i requisiti del SGSSL sono pianificati, attuati, controllati e mantenuti: criteri per i processi definiti, controllo attuato in conformita' ai criteri, informazioni documentate conservate, lavoro adattato ai lavoratori?",
            "L'organizzazione deve pianificare, attuare, controllare e mantenere i processi necessari per soddisfare i requisiti del sistema di gestione per la SSL e per attuare le azioni determinate al punto 6, come segue: a) stabilendo i criteri per i processi; b) attuando il controllo dei processi in conformita' ai criteri; c) mantenendo e conservando le informazioni documentate nella misura necessaria a ritenere che i processi siano stati effettuati come pianificato; d) adattando il lavoro ai lavoratori."],
        ['45001_c8', 35,
            "8.1.1 - Nei luoghi di lavoro con piu' datori di lavoro, l'organizzazione coordina le parti pertinenti del sistema di gestione per la SSL con le altre organizzazioni presenti?",
            "Nei luoghi di lavoro con piu' datori di lavoro, l'organizzazione deve coordinare le parti pertinenti del sistema di gestione per la SSL con le altre organizzazioni."],
        ['45001_c8', 36,
            "8.1.2 - Sono stabiliti processi per l'eliminazione dei pericoli e la riduzione dei rischi per la SSL applicando la gerarchia delle misure di prevenzione e protezione: eliminazione, sostituzione, misure tecnico-progettuali, misure amministrative (inclusa formazione), dispositivi di protezione individuale?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per l'eliminazione dei pericoli e la riduzione dei rischi per la SSL, utilizzando la seguente gerarchia delle misure di prevenzione e protezione: a) eliminare i pericoli; b) sostituire con processi, attivita' operative, materiali o attrezzature meno pericolosi; c) utilizzare misure tecnico-progettuali (engineering controls) e riorganizzare il lavoro; d) utilizzare misure di tipo amministrativo (administrative controls), compresa la formazione; e) utilizzare adeguati dispositivi di protezione individuale."],
        ['45001_c8', 37,
            "8.1.3 - Sono stabiliti processi per l'attuazione e il controllo delle modifiche temporanee e permanenti pianificate con impatto sulla SSL (nuovi prodotti/servizi/processi, cambiamenti requisiti legali, cambiamenti nella conoscenza dei pericoli, sviluppi tecnologici)? Le conseguenze dei cambiamenti involontari sono riesaminate con azioni mitiganti?",
            "L'organizzazione deve stabilire uno o piu' processi per l'attuazione e il controllo delle modifiche temporanee e permanenti pianificate che hanno un impatto sulle prestazioni in termini di SSL, tra cui: a) nuovi prodotti, servizi e processi o modifiche a prodotti, servizi e processi esistenti; b) cambiamenti nei requisiti legali e altri requisiti; c) cambiamenti nelle conoscenze o informazioni su pericoli e rischi per la SSL; d) sviluppi nella conoscenza e nella tecnologia. L'organizzazione deve riesaminare le conseguenze dei cambiamenti involontari, intraprendendo azioni per mitigare ogni effetto negativo, per quanto necessario."],
        ['45001_c8', 38,
            "8.1.4.1/8.1.4.2 - Sono stabiliti processi per tenere sotto controllo l'approvvigionamento di prodotti e servizi? L'organizzazione coordina con gli appaltatori per identificare pericoli e valutare/controllare rischi SSL da attivita' degli appaltatori e dell'organizzazione stessa?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per tenere sotto controllo l'approvvigionamento di prodotti e servizi al fine di assicurare la conformita' al proprio sistema di gestione per la SSL. L'organizzazione deve coordinare i processi di approvvigionamento con i propri appaltatori, per identificare i pericoli e valutare e tenere sotto controllo i rischi per la SSL derivanti da: a) attivita' e operazioni degli appaltatori che hanno un impatto sull'organizzazione; b) attivita' e operazioni dell'organizzazione che hanno un impatto sui lavoratori degli appaltatori; c) attivita' e operazioni degli appaltatori che hanno un impatto su altre parti interessate presenti nel luogo di lavoro."],
        ['45001_c8', 39,
            "8.1.4.2/8.1.4.3 - I requisiti del SGSSL sono soddisfatti dagli appaltatori e dai loro lavoratori? I processi di selezione degli appaltatori applicano criteri di salute e sicurezza sul lavoro? Le funzioni e i processi affidati all'esterno sono tenuti sotto controllo in modo coerente con requisiti legali e risultati attesi del SGSSL?",
            "L'organizzazione deve assicurare che i requisiti del proprio sistema di gestione per la SSL siano soddisfatti dagli appaltatori e dai loro lavoratori. I processi di approvvigionamento dell'organizzazione devono definire e applicare criteri di salute e sicurezza sul lavoro nel selezionare gli appaltatori. L'organizzazione deve assicurare che le funzioni e i processi affidati all'esterno siano tenuti sotto controllo e che i suoi accordi di affidamento all'esterno siano coerenti con i requisiti legali e altri requisiti e con il raggiungimento dei risultati attesi del sistema di gestione per la SSL."],
        ['45001_c8', 40,
            "8.2 - Sono stabiliti processi per la preparazione e risposta alle situazioni di emergenza: risposta pianificata (incluso primo soccorso), formazione per la risposta pianificata, prove ed esercitazioni periodiche, revisione delle modalita' di risposta dopo prove o emergenze reali, comunicazione agli appaltatori/visitatori/servizi di emergenza/autorita'?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi necessari per prepararsi e rispondere alle potenziali situazioni di emergenza, tra cui: a) stabilire una risposta pianificata alle situazioni di emergenza, compreso l'intervento di primo soccorso; b) fornire formazione per la risposta pianificata; c) periodicamente sottoporre a prova ed effettuare esercitazioni per valutare la capacita' di reazione secondo quanto pianificato; d) valutare le prestazioni e, per quanto necessario, sottoporre a revisione le modalita' di risposta pianificate, anche dopo le prove e in particolare dopo il verificarsi di situazioni di emergenza; e) comunicare e fornire informazioni pertinenti a tutti i lavoratori sui loro obblighi e responsabilita'; f) comunicare informazioni pertinenti agli appaltatori, visitatori, servizi di risposta alle emergenze, autorita' governative e, per quanto appropriato, alla comunita' locale."],
        ['45001_c8', 41,
            "8.2 - L'organizzazione tiene conto delle esigenze e delle capacita' di tutte le parti interessate pertinenti e assicura il loro coinvolgimento nello sviluppo della risposta pianificata alle emergenze? Sono conservate informazioni documentate sui processi e sui piani per rispondere alle potenziali situazioni di emergenza?",
            "L'organizzazione deve: g) tener conto delle esigenze e delle capacita' di tutte le parti interessate pertinenti e assicurare il loro coinvolgimento, per quanto appropriato, nello sviluppo della risposta pianificata. L'organizzazione deve mantenere e conservare informazioni documentate sui processi e sui piani per rispondere alle potenziali situazioni di emergenza."],
        ['45001_c8', 42,
            "8.2 - Il coinvolgimento delle parti interessate pertinenti nello sviluppo della risposta alle emergenze e' assicurato? Le comunicazioni pertinenti in materia di preparazione e risposta alle emergenze sono fornite anche alle parti interessate esterne (appaltatori, visitatori, servizi di emergenza, autorita', comunita' locale)?",
            "L'organizzazione deve: g) tener conto delle esigenze e delle capacita' di tutte le parti interessate pertinenti e assicurare il loro coinvolgimento, per quanto appropriato, nello sviluppo della risposta pianificata. f) comunicare informazioni pertinenti agli appaltatori, visitatori, servizi di risposta alle emergenze, autorita' governative e, per quanto appropriato, alla comunita' locale."],

        // §9 – Valutazione delle Prestazioni (7 domande)
        ['45001_c9', 43,
            "9.1.1 - Sono determinati: cosa e' necessario monitorare e misurare (conformita' requisiti legali, attivita' relative a pericoli/rischi/opportunita', progressi verso obiettivi SSL, efficacia controlli), i metodi, i criteri di valutazione delle prestazioni SSL, la frequenza e quando analizzare e comunicare i risultati?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per il monitoraggio, la misurazione, l'analisi e la valutazione delle prestazioni. L'organizzazione deve determinare: a) cosa e' necessario monitorare e misurare, compreso: 1) la misura in cui sono soddisfatti i requisiti legali e altri requisiti; 2) le sue attivita' e operazioni relative ai pericoli, ai rischi e alle opportunita' identificati; 3) progressi verso il raggiungimento degli obiettivi dell'organizzazione per la SSL; 4) efficacia dei controlli operativi e di altri controlli; b) metodi per il monitoraggio, la misurazione, l'analisi e la valutazione delle prestazioni; c) criteri rispetto ai quali l'organizzazione valutera' le proprie prestazioni in termini di SSL; d) quando devono essere eseguiti il monitoraggio e la misurazione; e) quando devono essere analizzati, valutati e comunicati i risultati."],
        ['45001_c9', 44,
            "9.1.1 - Le apparecchiature di monitoraggio e misurazione sono tarate o verificate e mantenute appropriatamente? Sono conservate informazioni documentate quali evidenza dei risultati di monitoraggio/misurazione/analisi/valutazione e della manutenzione/taratura/verifica delle apparecchiature?",
            "L'organizzazione deve assicurare che le apparecchiature di monitoraggio e misurazione siano tarate o verificate, per quanto applicabile, e che vengano utilizzate e mantenute in modo appropriato. L'organizzazione deve conservare appropriate informazioni documentate: come evidenza dei risultati di monitoraggio, misurazione, analisi e valutazione delle prestazioni; sulla manutenzione, taratura o verifica dell'attrezzatura di misurazione."],
        ['45001_c9', 45,
            "9.1.2 - Sono stabiliti processi per valutare la conformita' ai requisiti legali e altri requisiti: determinazione frequenza e metodi di valutazione, conformita' valutata con azioni intraprese se necessario, conoscenza e comprensione dello stato di conformita' mantenuta, risultati della valutazione conservati come informazioni documentate?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi per valutare la conformita' ai requisiti legali e altri requisiti. L'organizzazione deve: a) determinare la frequenza e i metodi per la valutazione della conformita'; b) valutare la conformita' e intraprendere azioni, se necessario; c) mantenere la conoscenza e la comprensione del proprio stato di conformita' ai requisiti legali e altri requisiti; d) conservare informazioni documentate dei risultati della valutazione della conformita'."],
        ['45001_c9', 46,
            "9.2.1 - Sono condotti audit interni a intervalli pianificati per accertare se il SGSSL e' conforme ai requisiti propri dell'organizzazione (politica, obiettivi SSL) e ai requisiti della norma, ed e' efficacemente attuato e mantenuto?",
            "L'organizzazione deve condurre, ad intervalli pianificati, audit interni allo scopo di fornire informazioni per accertare se il sistema di gestione per la SSL e': a) conforme: 1) ai requisiti propri dell'organizzazione per il proprio sistema di gestione per la SSL, compresa la politica e gli obiettivi per la SSL; 2) ai requisiti del presente documento; b) efficacemente attuato e mantenuto."],
        ['45001_c9', 47,
            "9.2.2 - Il programma di audit interno comprende: frequenza, metodi, responsabilita', consultazione, pianificazione/reporting; criteri e campo di applicazione definiti per ciascun audit; auditor selezionati per obiettivita' e imparzialita'; risultati riportati ai manager pertinenti e ai lavoratori; azioni per NC intraprese; informazioni documentate conservate?",
            "L'organizzazione deve: a) pianificare, stabilire, attuare e mantenere uno o piu' programmi di audit, comprensivi di frequenza, metodi, responsabilita', consultazione, requisiti di pianificazione e reporting, che devono tenere in considerazione l'importanza dei processi coinvolti e i risultati degli audit precedenti; b) definire i criteri di audit e il campo di applicazione per ciascun audit; c) selezionare gli auditor e condurre gli audit in modo tale da assicurare l'obiettivita' e l'imparzialita' del processo di audit; d) assicurare che i risultati degli audit siano riportati ai manager pertinenti; assicurare che i risultati pertinenti degli audit siano riportati ai lavoratori e, ove istituiti, ai rappresentanti dei lavoratori e ad altre parti interessate pertinenti; e) intraprendere azioni per affrontare le non conformita' e migliorare in modo continuo le prestazioni in termini di SSL; f) conservare informazioni documentate quale evidenza dei risultati di audit e dell'attuazione del programma di audit."],
        ['45001_c9', 48,
            "9.3 - L'alta direzione riesamina il SGSSL a intervalli pianificati considerando: azioni da riesami precedenti, cambiamenti interni/esterni (parti interessate, requisiti legali, rischi/opportunita'), grado realizzazione politica/obiettivi SSL, prestazioni (incidenti/NC/azioni correttive, monitoraggio, conformita', audit, consultazione/partecipazione), adeguatezza risorse, comunicazioni con parti interessate, opportunita' miglioramento continuo?",
            "L'alta direzione deve, a intervalli pianificati, riesaminare il sistema di gestione per la SSL dell'organizzazione, per assicurarne la continua idoneita', adeguatezza ed efficacia. Il riesame di direzione deve includere considerazioni su: a) stato delle azioni derivanti da precedenti riesami di direzione; b) cambiamenti nei fattori esterni e interni che sono pertinenti al sistema di gestione per la SSL; c) grado di realizzazione della politica per la SSL e degli obiettivi per la SSL; d) informazioni sulle prestazioni in termini di SSL (incidenti, NC, azioni correttive, miglioramento continuo, risultati monitoraggio/misurazione, valutazione conformita', risultati di audit, consultazione e partecipazione dei lavoratori, rischi e opportunita'); e) adeguatezza delle risorse; f) comunicazioni pertinenti con le parti interessate; g) opportunita' per il miglioramento continuo."],
        ['45001_c9', 49,
            "9.3 - Gli output del riesame di direzione comprendono decisioni su: mantenimento idoneita'/adeguatezza/efficacia SGSSL, miglioramento continuo, modifiche al sistema, risorse necessarie, azioni, integrazione con processi di business, implicazioni strategiche? I risultati del riesame sono comunicati ai lavoratori e sono conservate informazioni documentate?",
            "Gli output del riesame di direzione devono comprendere decisioni relative a: mantenimento dell'idoneita', dell'adeguatezza e dell'efficacia del sistema di gestione per la SSL nel conseguimento dei risultati attesi; opportunita' di miglioramento continuo; qualsiasi esigenza di modifica al sistema di gestione per la SSL; risorse necessarie; azioni, se necessarie; opportunita' per migliorare l'integrazione del sistema di gestione per la SSL con altri processi di business; qualsiasi implicazione per gli indirizzi strategici dell'organizzazione. L'alta direzione deve comunicare i risultati pertinenti del riesame di direzione ai lavoratori e, ove istituiti, ai rappresentanti dei lavoratori. L'organizzazione deve conservare informazioni documentate quale evidenza dei risultati dei riesami di direzione."],

        // §10 – Miglioramento (4 domande)
        ['45001_c10', 50,
            "10.1 - L'organizzazione determina opportunita' di miglioramento (dal punto 9) e intraprende le azioni necessarie al conseguimento dei risultati attesi del proprio sistema di gestione per la SSL?",
            "L'organizzazione deve determinare opportunita' di miglioramento (vedere punto 9) e intraprendere le azioni necessarie al conseguimento dei risultati attesi del proprio sistema di gestione per la SSL."],
        ['45001_c10', 51,
            "10.2 - Sono stabiliti processi per determinare e gestire incidenti e non conformita': reazione tempestiva, valutazione necessita' azioni correttive per eliminare cause radice con coinvolgimento lavoratori, riesame valutazioni rischi, determinazione e attuazione azioni necessarie (gerarchia misure), riesame efficacia azioni, modifiche al SGSSL se necessario?",
            "L'organizzazione deve stabilire, attuare e mantenere uno o piu' processi, compreso reporting, investigazioni e azioni da intraprendere, per determinare e gestire gli incidenti e le non conformita'. Quando si verifica un incidente o una non conformita', l'organizzazione deve: a) reagire tempestivamente all'incidente o alla non conformita'; b) valutare, con la partecipazione dei lavoratori e il coinvolgimento di altre parti interessate pertinenti, la necessita' di azioni correttive per eliminare le cause radice dell'incidente o della non conformita'; c) riesaminare le valutazioni esistenti dei rischi per la SSL; d) determinare e attuare ogni azione necessaria, comprese le azioni correttive, secondo la gerarchia delle misure di prevenzione e protezione; e) valutare i rischi per la SSL che riguardano pericoli nuovi o modificati; f) riesaminare l'efficacia di ogni azione intrapresa, comprese le azioni correttive; g) effettuare modifiche al sistema di gestione per la SSL, se necessario."],
        ['45001_c10', 52,
            "10.2 - Le azioni correttive sono proporzionate agli effetti reali o potenziali degli incidenti/NC? Sono conservate informazioni documentate (natura NC/incidenti, azioni intraprese, risultati e efficacia delle azioni correttive)? Queste informazioni sono comunicate ai lavoratori e ai rappresentanti?",
            "Le azioni correttive devono essere appropriate agli effetti reali o potenziali degli incidenti o delle non conformita' riscontrate. L'organizzazione deve conservare informazioni documentate quale evidenza: della natura degli incidenti o delle non conformita' e di ogni successiva azione intrapresa; dei risultati di qualsiasi azione e azione correttiva, compresa la loro efficacia. L'organizzazione deve comunicare queste informazioni documentate ai lavoratori interessati e, ove istituiti, ai rappresentanti dei lavoratori e ad altre parti interessate pertinenti."],
        ['45001_c10', 53,
            "10.3 - L'organizzazione migliora in modo continuo l'idoneita', l'adeguatezza e l'efficacia del SGSSL mediante: miglioramento prestazioni SSL, promozione cultura SSL, promozione partecipazione lavoratori, comunicazione risultati del miglioramento, conservazione evidenze documentate del miglioramento continuo?",
            "L'organizzazione deve migliorare in modo continuo l'idoneita', l'adeguatezza e l'efficacia del sistema di gestione per la SSL, mediante: a) il miglioramento delle prestazioni in termini di SSL; b) la promozione di una cultura che supporti un sistema di gestione per la SSL; c) la promozione della partecipazione dei lavoratori nell'attuazione di azioni per il miglioramento continuo del sistema di gestione per la SSL; d) la comunicazione dei risultati pertinenti del miglioramento continuo ai lavoratori e, ove istituiti, ai rappresentanti dei lavoratori; e) mantenimento e conservazione di informazioni documentate come evidenza del miglioramento continuo."],
    ];

    let inserted = 0;
    let skipped  = 0;

    for (const [code, ord, text, excerpt] of domande) {
        const escapedText    = text.replace(/'/g, "''");
        const escapedExcerpt = excerpt.replace(/'/g, "''");
        const chk = await query(
            `SELECT question_id FROM checklist_questions WHERE standard_id=3 AND section_code='${code}' AND is_active=1 AND question_text=N'${escapedText}'`
        );
        if (chk.recordset.length > 0) {
            console.log(`SKIP ${code} ord ${ord}: gia' presente`);
            skipped++;
            continue;
        }
        await query(
            `INSERT INTO checklist_questions (standard_id,section_code,question_text,question_type,is_mandatory,display_order,is_active,norm_excerpt,created_at,updated_at) VALUES (3,'${code}',N'${escapedText}','TEXT',1,${ord},1,N'${escapedExcerpt}',GETDATE(),GETDATE())`
        );
        inserted++;
    }

    console.log(`\nDomande inserite: ${inserted} | Skip (gia' presenti): ${skipped}`);

    // DOPO
    await step('DOPO stato', `
        SELECT
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=3)                AS sections_count,
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=3 AND is_active=1) AS sections_active,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=3)                AS total_q,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=3 AND is_active=1) AS active_q,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=3 AND is_active=1 AND norm_excerpt IS NOT NULL AND norm_excerpt <> '') AS q_with_excerpt
    `);

    console.log('\n=== Migration 051 completata con successo ===');
    console.log('53 domande ISO 45001:2018 complete in 7 sezioni (clausole 4-10) con norm_excerpt');
    process.exit(0);
})().catch(e => {
    console.error('FATALE:', e.message);
    process.exit(1);
});
