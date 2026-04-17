/**
 * Migration 012 - ISO 14001 checklist legislativa
 * 2 sezioni (14001_s4, 14001_s5) + 46 domande in checklist_questions
 *
 * Eseguire con: node migration-012.js
 * SAFE TO RUN MULTIPLE TIMES - usa upsert sezioni + WHERE NOT EXISTS domande
 * section_code corti (<=10 char) per compatibilita con VARCHAR(10) esistente.
 */

require('dotenv').config();
const path = require('path');
const sql = require('mssql');
const { resolveDbSection } = require(path.join(__dirname, 'scripts', 'mergeDbEnv'));

const env = process.env.NODE_ENV || 'production';
const c = resolveDbSection(env);

const config = {
    user: c.user,
    password: c.password,
    server: c.server,
    port: c.port || 1433,
    database: c.database,
    options: {
        ...(c.options || {}),
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 60000
    },
    requestTimeout: 60000
};

const SECTIONS = [
    { section_code: '14001_s4', section_title: '4 - AMBIENTE E SICUREZZA', standard_id: 2, display_order: 1 },
    { section_code: '14001_s5', section_title: '5. AMBIENTE', standard_id: 2, display_order: 2 }
];

const QUESTIONS = [
    // --- Sezione 14001_s4: AMBIENTE E SICUREZZA (display_order 2-14)
    { section_code: '14001_s4', question_text: "EDILIZIA/AGIBILITA'", display_order: 2 },
    { section_code: '14001_s4', question_text: 'INDUSTRIE INSALUBRI', display_order: 3 },
    { section_code: '14001_s4', question_text: 'IMPIANTI TERMICI', display_order: 4 },
    { section_code: '14001_s4', question_text: 'INCIDENTI RILEVANTI', display_order: 5 },
    { section_code: '14001_s4', question_text: 'PREVENZIONE INCENDI / RISCHIO INCENDI', display_order: 6 },
    { section_code: '14001_s4', question_text: 'PIANO DI EMERGENZA', display_order: 7 },
    { section_code: '14001_s4', question_text: 'ADDETTI ALLE EMERGENZE', display_order: 8 },
    { section_code: '14001_s4', question_text: 'GAS TOSSICI', display_order: 9 },
    { section_code: '14001_s4', question_text: 'AMIANTO E RELATIVI RISCHI', display_order: 10 },
    { section_code: '14001_s4', question_text: 'TRASPORTO MATERIALI PERICOLOSI (ADR / RID)', display_order: 11 },
    { section_code: '14001_s4', question_text: 'SOSTANZE E PREPARATI PERICOLOSI / RISCHIO CHIMICO PER LA SALUTE E LA SICUREZZA', display_order: 12 },
    { section_code: '14001_s4', question_text: 'PCB / PCT', display_order: 13 },
    { section_code: '14001_s4', question_text: 'RADIAZIONI IONIZZANTI E RELATIVI RISCHI', display_order: 14 },
    // --- Sezione 14001_s5: AMBIENTE (display_order 15-47)
    { section_code: '14001_s5', question_text: 'VALUTAZIONE IMPATTO AMBIENTALE (VIA) e VALUTAZIONE AMBIENTALE STRATEGICA (VAS)', display_order: 15 },
    { section_code: '14001_s5', question_text: 'AUTORIZZAZIONE INTEGRATA AMBIENTALE (AIA) e IPPC', display_order: 16 },
    { section_code: '14001_s5', question_text: 'AUTORIZZAZIONE UNICA AMBIENTALE (AUA)', display_order: 17 },
    { section_code: '14001_s5', question_text: 'APPROVVIGIONAMENTO IDRICO', display_order: 18 },
    { section_code: '14001_s5', question_text: 'SCARICHI IDRICI', display_order: 19 },
    { section_code: '14001_s5', question_text: "QUALITA' DELL'ARIA", display_order: 20 },
    { section_code: '14001_s5', question_text: 'EMISSIONI IN ATMOSFERA', display_order: 21 },
    { section_code: '14001_s5', question_text: 'EMISSIONI ODORIGENE', display_order: 22 },
    { section_code: '14001_s5', question_text: 'RIFIUTI', display_order: 23 },
    { section_code: '14001_s5', question_text: 'GESTIONE IMBALLAGGI (CONAI E CONSORZI DI FILIERA)', display_order: 24 },
    { section_code: '14001_s5', question_text: 'DISCARICHE E IMPIANTI DI INCENERIMENTO', display_order: 25 },
    { section_code: '14001_s5', question_text: 'TERRE E ROCCE DA SCAVO', display_order: 26 },
    { section_code: '14001_s5', question_text: 'BONIFICA SITI CONTAMINATI', display_order: 27 },
    { section_code: '14001_s5', question_text: 'CONTAMINAZIONE SUOLO E SOTTOSUOLO (Serbatoi Interrati)', display_order: 28 },
    { section_code: '14001_s5', question_text: "GAS AD EFFETTO SERRA E LESIVI DELL'OZONO", display_order: 29 },
    { section_code: '14001_s5', question_text: 'INQUINAMENTO ACUSTICO', display_order: 30 },
    { section_code: '14001_s5', question_text: 'GESTIONE ENERGETICA ED ENERGY MANAGER', display_order: 31 },
    { section_code: '14001_s5', question_text: 'MOBILITY MANAGER', display_order: 32 },
    { section_code: '14001_s5', question_text: 'INQUINAMENTO ELETTROMAGNETICO', display_order: 33 },
    { section_code: '14001_s5', question_text: 'INQUINAMENTO LUMINOSO', display_order: 34 },
    { section_code: '14001_s5', question_text: "SOSTENIBILITA' / CORPORATE SUSTAINABILITY REPORTING DIRECTIVE (CSRD)", display_order: 35 },
    { section_code: '14001_s5', question_text: 'MEDI IMPIANTI DI COMBUSTIONE', display_order: 36 },
    { section_code: '14001_s5', question_text: 'GRANDI IMPIANTI DI COMBUSTIONE', display_order: 37 },
    { section_code: '14001_s5', question_text: "ATTIVITA' DI GESTIONE DEI RIFIUTI ED IMPIANTI DI RECUPERO (art. 208 e segg. D.Lgs. 152/06)", display_order: 38 },
    { section_code: '14001_s5', question_text: 'OLI USATI', display_order: 39 },
    { section_code: '14001_s5', question_text: 'RIFIUTI SANITARI/ORIGINE ANIMALE, SOTTOPRODOTTI DI ORIGINE ANIMALE', display_order: 40 },
    { section_code: '14001_s5', question_text: 'UTILIZZO FANGHI IN AGRICOLTURA', display_order: 41 },
    { section_code: '14001_s5', question_text: 'SOTTOPRODOTTI', display_order: 42 },
    { section_code: '14001_s5', question_text: "ATTIVITA' DI AUTOSMALTIMENTO DI RIFIUTI PERICOLOSI", display_order: 43 },
    { section_code: '14001_s5', question_text: 'RISPARMIO ED EFFICIENZA ENERGETICA', display_order: 44 },
    { section_code: '14001_s5', question_text: 'EUDR, European Union Deforestation Regulation', display_order: 45 },
    { section_code: '14001_s5', question_text: 'PPWR (Packaging and Packaging Waste Regulation)', display_order: 46 },
    { section_code: '14001_s5', question_text: 'Prescrizioni AIA, AUA', display_order: 47 }
];

async function runMigration() {
    let pool;
    try {
        console.log('Connessione al database...');
        console.log('  Server:', config.server + ':' + config.port, '/ DB:', config.database);
        pool = await sql.connect(config);
        console.log('Connesso a', config.database);

        // 0. Stato PRIMA
        const before = await pool.request().query(
            'SELECT COUNT(*) AS total FROM checklist_questions WHERE standard_id = 2'
        );
        console.log('Stato PRIMA: ' + before.recordset[0].total + ' domande ISO 14001');

        // 1. Upsert sezioni
        console.log('\n[1/3] Upsert sezioni ISO 14001...');
        for (const s of SECTIONS) {
            const exists = await pool.request()
                .input('sc', sql.NVarChar, s.section_code)
                .input('sid', sql.Int, s.standard_id)
                .query('SELECT 1 FROM checklist_sections WHERE section_code = @sc AND standard_id = @sid');

            if (exists.recordset.length > 0) {
                await pool.request()
                    .input('sc', sql.NVarChar, s.section_code)
                    .input('st', sql.NVarChar, s.section_title)
                    .input('do', sql.Int, s.display_order)
                    .input('sid', sql.Int, s.standard_id)
                    .query('UPDATE checklist_sections SET section_title=@st, display_order=@do WHERE section_code=@sc AND standard_id=@sid');
                console.log('  UPDATE sezione ' + s.section_code);
            } else {
                await pool.request()
                    .input('sc', sql.NVarChar, s.section_code)
                    .input('st', sql.NVarChar, s.section_title)
                    .input('sid', sql.Int, s.standard_id)
                    .input('do', sql.Int, s.display_order)
                    .query('INSERT INTO checklist_sections (section_code, section_title, standard_id, display_order) VALUES (@sc, @st, @sid, @do)');
                console.log('  INSERT sezione ' + s.section_code);
            }
        }

        // 2. Inserisci domande (idempotente)
        console.log('\n[2/3] Inserimento 46 domande ISO 14001...');
        let inserted = 0;
        let skipped = 0;

        for (const q of QUESTIONS) {
            const exists = await pool.request()
                .input('sc', sql.NVarChar, q.section_code)
                .input('qt', sql.NVarChar, q.question_text)
                .query('SELECT 1 FROM checklist_questions WHERE standard_id=2 AND section_code=@sc AND question_text=@qt AND is_active=1');

            if (exists.recordset.length > 0) {
                skipped++;
            } else {
                await pool.request()
                    .input('sc', sql.NVarChar, q.section_code)
                    .input('qt', sql.NVarChar, q.question_text)
                    .input('do', sql.Int, q.display_order)
                    .query(`INSERT INTO checklist_questions
                                (standard_id, section_code, question_text, question_type,
                                 is_mandatory, display_order, is_active, created_at, updated_at)
                            VALUES (2, @sc, @qt, 'text', 1, @do, 1, GETDATE(), GETDATE())`);
                inserted++;
            }
        }
        console.log('  Inserite: ' + inserted + ' | Gia presenti: ' + skipped);

        // 3. Leggi question_id assegnati
        console.log('\n[3/3] Lettura question_id assegnati...');
        const result = await pool.request().query(`
            SELECT cq.question_id, cq.section_code, cq.display_order, cq.question_text
            FROM checklist_questions cq
            WHERE cq.standard_id = 2 AND cq.is_active = 1
            ORDER BY cq.display_order
        `);

        console.log('\nTotale domande ISO 14001 attive: ' + result.recordset.length);
        console.log('\n question_id | section  | ord | question_text (primi 60 car)');
        console.log(' -----------|----------|-----|' + '-'.repeat(62));
        result.recordset.forEach(r => {
            const id = String(r.question_id).padStart(10);
            const sc = r.section_code.padEnd(8);
            const ord = String(r.display_order).padStart(3);
            const txt = (r.question_text || '').substring(0, 60);
            console.log(' ' + id + ' | ' + sc + ' | ' + ord + ' | ' + txt);
        });

        // JSON idMap
        const idMap = {};
        result.recordset.forEach(r => { idMap[r.display_order] = r.question_id; });
        console.log('\nidMap (display_order -> question_id):');
        console.log(JSON.stringify(idMap, null, 2));

        console.log('\nMigration 012 completata con successo!');

    } catch (err) {
        console.error('Errore migration:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
    }
}

runMigration();
