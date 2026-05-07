/**
 * run-migration-049-vps.js
 * ISO 14001:2015 — Checklist COMPLETA da norma (53 domande, clausole 4→10)
 *
 * Eseguire sul VPS:
 *   scp -P 1122 -i $KEY run-migration-049-vps.js spascarella@www.fr-busato.it:/tmp/
 *   cd /var/www/sgq-backend && DB_SERVER=localhost DB_PORT=11043 DB_DATABASE=SGQ_ISO9001 \
 *     DB_USER=pascarella DB_PASSWORD='#Gestione2025@' NODE_ENV=production node /tmp/run-migration-049-vps.js
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
    console.log('=== Migration 049: ISO 14001:2015 checklist COMPLETA ===\n');

    // PRIMA
    await step('PRIMA stato', `
        SELECT
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=2)                AS sections_count,
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=2 AND is_active=1) AS sections_active,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=2)                AS total_q,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=2 AND is_active=1) AS active_q
    `);

    // 1. Soft-delete TUTTE le domande ISO 14001 attive (sia legislative che migration 023)
    await step('Soft-delete tutte domande ISO 14001', `
        UPDATE checklist_questions
        SET is_active=0, updated_at=GETDATE()
        WHERE standard_id=2 AND is_active=1
    `);

    // 2. Disattiva sezioni legacy legislative (iso14001_s4, iso14001_s5)
    await step('Disattiva sezioni legislative legacy', `
        UPDATE checklist_sections
        SET is_active=0
        WHERE standard_id=2 AND section_code IN ('iso14001_s4','iso14001_s5')
    `);

    // 3. Upsert sezioni clausola 4→10 (idempotente)
    for (const [code, title, ord] of [
        ['14001_c4',  "4 - Contesto dell'Organizzazione",  1],
        ['14001_c5',  '5 - Leadership',                      2],
        ['14001_c6',  '6 - Pianificazione',                  3],
        ['14001_c7',  '7 - Supporto',                        4],
        ['14001_c8',  '8 - Attivita Operative',              5],
        ['14001_c9',  '9 - Valutazione delle Prestazioni',   6],
        ['14001_c10', '10 - Miglioramento',                  7],
    ]) {
        const escapedTitle = title.replace(/'/g, "''");
        const chk = await query(`SELECT section_id FROM checklist_sections WHERE standard_id=2 AND section_code='${code}'`);
        if (chk.recordset.length > 0) {
            await step(`Riattiva sezione ${code}`, `UPDATE checklist_sections SET section_title=N'${escapedTitle}', is_active=1, display_order=${ord} WHERE standard_id=2 AND section_code='${code}'`);
        } else {
            await step(`Inserisce sezione ${code}`, `INSERT INTO checklist_sections (section_code,section_title,standard_id,display_order,is_active) VALUES ('${code}',N'${escapedTitle}',2,${ord},1)`);
        }
    }

    // 4. Inserimento 53 domande complete
    const domande = [
        // §4 – Contesto (7)
        ['14001_c4', 1, "4.1 - L'organizzazione ha determinato i fattori interni ed esterni rilevanti per le sue finalita' e che influenzano il SGA, incluse le condizioni ambientali che la riguardano?"],
        ['14001_c4', 2, "4.2 - L'organizzazione ha identificato le parti interessate rilevanti per il SGA e ne ha determinato esigenze, aspettative e obblighi di conformita' che ne derivano?"],
        ['14001_c4', 3, "4.3 - Il campo di applicazione del SGA e' definito (confini fisici e organizzativi, attivita', prodotti e servizi) e mantenuto come informazione documentata disponibile alle parti interessate?"],
        ['14001_c4', 4, "4.3 - La definizione del campo di applicazione considera i fattori di cui al 4.1, gli obblighi di conformita' di cui al 4.2 e l'autorita'/abilita' dell'organizzazione ad esercitare controllo?"],
        ['14001_c4', 5, "4.4 - Il SGA e' stabilito, attuato, mantenuto e migliorato in modo continuo in conformita' ai requisiti della norma, con processi necessari e loro interazioni definiti?"],
        ['14001_c4', 6, "4.4 - La conoscenza derivante dall'analisi del contesto (4.1) e delle parti interessate (4.2) e' integrata nello sviluppo e nel mantenimento del SGA?"],
        ['14001_c4', 7, "4.4 - Il SGA copre tutte le attivita', i prodotti e i servizi inclusi nel campo di applicazione definito?"],
        // §5 – Leadership (7)
        ['14001_c5', 8,  "5.1 - L'alta direzione dimostra leadership e impegno: accetta di rendere conto dell'efficacia del SGA, assicura disponibilita' delle risorse e comunica l'importanza della gestione ambientale?"],
        ['14001_c5', 9,  "5.1 - L'alta direzione assicura che i requisiti del SGA siano integrati nei processi di business e promuove il miglioramento continuo, guidando e supportando le persone?"],
        ['14001_c5', 10, "5.2 - La politica ambientale e' appropriata alle finalita' e al contesto, fornisce un quadro per gli obiettivi ambientali e include impegni per la protezione dell'ambiente e la prevenzione dell'inquinamento?"],
        ['14001_c5', 11, "5.2 - La politica ambientale include impegno a soddisfare obblighi di conformita' e miglioramento continuo SGA; e' documentata, comunicata internamente e disponibile alle parti interessate?"],
        ['14001_c5', 12, "5.3 - Le responsabilita' e le autorita' per i ruoli pertinenti al SGA sono assegnate, documentate e comunicate all'interno dell'organizzazione?"],
        ['14001_c5', 13, "5.3 - Sono assegnate responsabilita' e autorita' per assicurare la conformita' del SGA alla norma e per riferire all'alta direzione sulle prestazioni del SGA, inclusa la prestazione ambientale?"],
        ['14001_c5', 14, "5.3 - I ruoli gestionali a ogni livello pertinente ricevono supporto nell'esercitare la propria leadership nelle rispettive aree di responsabilita' ambientale?"],
        // §6 – Pianificazione (10)
        ['14001_c6', 15, "6.1.1 - E' stabilito un processo per determinare i rischi e le opportunita' associati agli aspetti ambientali, agli obblighi di conformita' e ai fattori del contesto, e sono documentati?"],
        ['14001_c6', 16, "6.1.1 - Nell'ambito del SGA sono state identificate le potenziali situazioni di emergenza con impatto ambientale?"],
        ['14001_c6', 17, "6.1.2 - Gli aspetti ambientali delle attivita', prodotti e servizi (compresi cambiamenti pianificati, condizioni anomale ed emergenze ragionevolmente prevedibili) sono determinati con prospettiva di ciclo di vita?"],
        ['14001_c6', 18, "6.1.2 - Gli aspetti ambientali significativi sono determinati con criteri stabiliti, comunicati ai livelli e funzioni pertinenti e mantenuti come informazione documentata (aspetti, criteri, aspetti significativi)?"],
        ['14001_c6', 19, "6.1.3 - Gli obblighi di conformita' applicabili agli aspetti ambientali sono identificati, accessibili e considerati nell'istituzione/mantenimento del SGA e mantenuti come informazione documentata?"],
        ['14001_c6', 20, "6.1.4 - Sono pianificate azioni per aspetti ambientali significativi, obblighi di conformita' e rischi/opportunita', considerando opzioni tecnologiche e vincoli finanziari e operativi?"],
        ['14001_c6', 21, "6.2.1 - Gli obiettivi ambientali sono stabiliti per funzioni e livelli pertinenti, sono coerenti con la politica, misurabili, monitorati, comunicati, aggiornati e mantenuti come informazione documentata?"],
        ['14001_c6', 22, "6.2.1 - Gli obiettivi ambientali tengono conto degli aspetti ambientali significativi, degli obblighi di conformita' e dei rischi/opportunita'?"],
        ['14001_c6', 23, "6.2.2 - Per ciascun obiettivo ambientale e' definito un piano con: cosa fare, risorse, responsabile, tempi di completamento e indicatori/metodi per valutare i risultati?"],
        ['14001_c6', 24, "6.2.2 - Le azioni per il raggiungimento degli obiettivi ambientali sono integrate nei processi di business dell'organizzazione?"],
        // §7 – Supporto (11)
        ['14001_c7', 25, "7.1 - Sono state determinate e fornite le risorse (umane, infrastrutturali, tecnologiche, finanziarie) necessarie per l'istituzione, l'attuazione, il mantenimento e il miglioramento del SGA?"],
        ['14001_c7', 26, "7.2 - Le competenze necessarie per il personale con impatto ambientale sono determinate e assicurate (istruzione, formazione, esperienza); le esigenze di formazione correlate al SGA sono identificate?"],
        ['14001_c7', 27, "7.2 - Sono intraprese azioni per acquisire le competenze necessarie e ne e' valutata l'efficacia; le evidenze delle competenze sono conservate come informazione documentata?"],
        ['14001_c7', 28, "7.3 - Il personale sotto il controllo dell'organizzazione e' consapevole della politica ambientale, degli aspetti significativi, del proprio contributo all'efficacia del SGA e delle implicazioni delle non conformita'?"],
        ['14001_c7', 29, "7.4 - Sono stabiliti processi per la comunicazione interna ed esterna pertinente al SGA (cosa, quando, con chi, come), coerenti con le informazioni del SGA e con gli obblighi di conformita'?"],
        ['14001_c7', 30, "7.4.2 - La comunicazione interna assicura che informazioni pertinenti al SGA siano diffuse tra livelli e funzioni e che il personale possa contribuire al miglioramento continuo?"],
        ['14001_c7', 31, "7.4.3 - La comunicazione esterna pertinente al SGA avviene in conformita' ai processi comunicativi e agli obblighi di conformita', con evidenza documentata per quanto appropriato?"],
        ['14001_c7', 32, "7.5.1 - Il SGA comprende tutte le informazioni documentate richieste dalla norma e quelle aggiuntive necessarie per l'efficacia del SGA?"],
        ['14001_c7', 33, "7.5.2 - Nella creazione e aggiornamento delle informazioni documentate sono assicurate: identificazione/descrizione adeguata, formato/mezzo appropriato, riesame e approvazione?"],
        ['14001_c7', 34, "7.5.3 - Le informazioni documentate del SGA sono tenute sotto controllo: disponibili dove/quando necessario, protette, distribuite, archiviate, conservate e gestite nelle versioni; le modifiche sono controllate?"],
        ['14001_c7', 35, "7.5.3 - Le informazioni documentate di origine esterna necessarie per il SGA sono identificate e tenute sotto controllo?"],
        // §8 – Attivita Operative (6)
        ['14001_c8', 36, "8.1 - Sono stabiliti criteri operativi per i processi rilevanti e il controllo e' attuato in conformita' (procedure, istruzioni, controlli ingegneristici con gerarchia eliminazione/sostituzione/amministrazione)?"],
        ['14001_c8', 37, "8.1 - Le modifiche pianificate sono gestite e le conseguenze dei cambiamenti involontari sono riesaminate, con azioni per mitigare effetti negativi?"],
        ['14001_c8', 38, "8.1 - I processi affidati all'esterno sono tenuti sotto controllo; i requisiti ambientali sono comunicati ai fornitori esterni/appaltatori; e' adottata una prospettiva di ciclo di vita (progettazione, approvvigionamento, fine vita)?"],
        ['14001_c8', 39, "8.2 - Esiste un processo per prepararsi e rispondere alle emergenze ambientali: piano di risposta, azioni preventive/mitigative, risposta alle emergenze reali?"],
        ['14001_c8', 40, "8.2 - Le azioni di risposta alle emergenze sono periodicamente sottoposte a prova (ove praticabile) e i processi di risposta sono riesaminati e revisionati periodicamente, in particolare dopo eventi di emergenza?"],
        ['14001_c8', 41, "8.2 - Sono fornite informazioni e formazione pertinenti in materia di preparazione e risposta alle emergenze alle parti interessate pertinenti, compresi i lavoratori?"],
        // §9 – Valutazione delle Prestazioni (8)
        ['14001_c9', 42, "9.1.1 - Sono determinati: cosa monitorare/misurare, i metodi, i criteri di valutazione delle prestazioni ambientali e gli indicatori appropriati, con frequenza definita per esecuzione e analisi?"],
        ['14001_c9', 43, "9.1.1 - Le attrezzature di monitoraggio e misurazione sono tarate/verificate e mantenute; i risultati di monitoraggio/analisi/valutazione sono comunicati internamente ed esternamente e documentati?"],
        ['14001_c9', 44, "9.1.2 - Esiste un processo per valutare periodicamente la conformita' agli obblighi di conformita'; le azioni necessarie sono intraprese e i risultati della valutazione documentati?"],
        ['14001_c9', 45, "9.2.1 - Sono condotti audit interni a intervalli pianificati per verificare la conformita' del SGA ai requisiti propri e della norma e la sua efficace attuazione e mantenimento?"],
        ['14001_c9', 46, "9.2.2 - Il programma di audit interno comprende frequenza, metodi, responsabilita', criteri e campo di applicazione; gli auditor garantiscono obiettivita' e imparzialita'; i risultati sono riportati al pertinente livello direzionale e documentati?"],
        ['14001_c9', 47, "9.3 - L'alta direzione riesamina periodicamente il SGA valutando: stato azioni precedenti, cambiamenti interni/esterni/aspetti significativi/rischi, grado di raggiungimento obiettivi, prestazione ambientale, adeguatezza risorse, comunicazioni parti interessate?"],
        ['14001_c9', 48, "9.3 - Il riesame di direzione produce output documentati: conclusioni su idoneita'/adeguatezza/efficacia SGA, decisioni per il miglioramento continuo, eventuali modifiche al SGA, azioni per obiettivi non raggiunti?"],
        // §10 – Miglioramento (5)
        ['14001_c10', 49, "10.1 - L'organizzazione determina le opportunita' di miglioramento (da 9.1, 9.2, 9.3) e intraprende le azioni necessarie per conseguire gli esiti attesi del SGA?"],
        ['14001_c10', 50, "10.2 - In caso di non conformita', l'organizzazione reagisce tempestivamente (controllo, correzione, mitigazione impatti ambientali), valuta l'esigenza di azioni correttive per eliminare le cause e prevenire la ripetizione?"],
        ['14001_c10', 51, "10.2 - Le azioni correttive sono proporzionate all'importanza degli effetti e degli impatti ambientali delle non conformita'; la loro efficacia e' riesaminata; il SGA e' modificato se necessario?"],
        ['14001_c10', 52, "10.2 - La natura delle non conformita', le azioni intraprese e i risultati delle azioni correttive sono conservati come informazione documentata?"],
        ['14001_c10', 53, "10.3 - L'organizzazione migliora in modo continuo l'idoneita', l'adeguatezza e l'efficacia del SGA per migliorare la prestazione ambientale?"],
    ];

    let inserted = 0;
    let skipped  = 0;

    for (const [code, ord, text] of domande) {
        const escaped = text.replace(/'/g, "''");
        const chk = await query(
            `SELECT question_id FROM checklist_questions WHERE standard_id=2 AND section_code='${code}' AND is_active=1 AND question_text=N'${escaped}'`
        );
        if (chk.recordset.length > 0) {
            console.log(`SKIP ${code} ord ${ord}: gia' presente`);
            skipped++;
            continue;
        }
        await query(
            `INSERT INTO checklist_questions (standard_id,section_code,question_text,question_type,is_mandatory,display_order,is_active,created_at,updated_at) VALUES (2,'${code}',N'${escaped}','TEXT',1,${ord},1,GETDATE(),GETDATE())`
        );
        inserted++;
    }

    console.log(`\nDomande inserite: ${inserted} | Skip (gia' presenti): ${skipped}`);

    // DOPO
    await step('DOPO stato', `
        SELECT
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=2)                AS sections_count,
            (SELECT COUNT(*) FROM checklist_sections  WHERE standard_id=2 AND is_active=1) AS sections_active,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=2)                AS total_q,
            (SELECT COUNT(*) FROM checklist_questions WHERE standard_id=2 AND is_active=1) AS active_q
    `);

    console.log('\n=== Migration 049 completata con successo ===');
    console.log('53 domande ISO 14001:2015 complete in 7 sezioni (clausole 4-10)');
    process.exit(0);
})().catch(e => {
    console.error('FATALE:', e.message);
    process.exit(1);
});
