/**
 * gen-token-and-smoke.js
 * Genera JWT direttamente sul VPS e testa le nuove API documentali.
 */
const fs = require('fs');
const sql = require('/var/www/sgq-backend/node_modules/mssql');
const jwt = require('/var/www/sgq-backend/node_modules/jsonwebtoken');
const http = require('http');

// Leggi JWT_SECRET dall'env (file con possibili CRLF)
const envPath = '/var/www/sgq-backend/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const jwtMatch = envContent.match(/JWT_SECRET=([^\r\n]+)/);
const JWT_SECRET = jwtMatch ? jwtMatch[1].replace(/\r/g, '').trim() : null;

if (!JWT_SECRET) { console.error('JWT_SECRET non trovato in .env'); process.exit(1); }
console.log('JWT_SECRET trovato (len=' + JWT_SECRET.length + ')');

// Leggi DB config
const configs = JSON.parse(fs.readFileSync('/var/www/sgq-backend/config/database.json', 'utf8'));
const dbConf = configs.production;

function apiRequest(method, path, data, token) {
    return new Promise((resolve, reject) => {
        const body = data ? JSON.stringify(data) : null;
        const opts = {
            hostname: 'localhost', port: 3000,
            path: '/api/v1' + path, method,
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        };
        if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
        const req = http.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
                catch(e) { resolve({ status: res.statusCode, data: d.substring(0, 200) }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function main() {
    // Connetti DB per ottenere user_id e org_id dell'admin
    const pool = await sql.connect({
        server: 'localhost', port: dbConf.port || 11043,
        database: dbConf.database, user: dbConf.user, password: dbConf.password,
        options: { encrypt: false, trustServerCertificate: true }
    });
    const r = await pool.request().query("SELECT user_id, email, role, organization_id FROM users WHERE email='admin@sgq.local'");
    const user = r.recordset[0];
    await pool.close();
    
    if (!user) { console.error('Utente admin@sgq.local non trovato'); process.exit(1); }
    console.log('Utente trovato:', user.email, '| role:', user.role, '| org_id:', user.organization_id);

    // Genera JWT
    const token = jwt.sign(
        { user_id: user.user_id, email: user.email, role: user.role, organization_id: user.organization_id },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
    console.log('Token generato (' + token.length + ' chars)\n');

    // Test 6.3a  Albero documentale
    console.log('=== 6.3a GET /documents/tree ===');
    const tree = await apiRequest('GET', '/documents/tree', null, token);
    console.log('Status:', tree.status);
    if (tree.status === 200) {
        const items = Array.isArray(tree.data) ? tree.data : (tree.data.items || tree.data.folders || []);
        console.log('Items:', items.length, '| Preview:', JSON.stringify(items.slice(0,2), null, 2).substring(0, 300));
    } else {
        console.log('Response:', JSON.stringify(tree.data).substring(0, 300));
    }

    // Test 6.3b  Tag
    console.log('\n=== 6.3b GET /document-tags ===');
    const tags = await apiRequest('GET', '/document-tags', null, token);
    console.log('Status:', tags.status);
    if (Array.isArray(tags.data)) {
        console.log('Tags count:', tags.data.length, '| First 3:', tags.data.slice(0,3).map(t => t.name).join(', '));
    } else {
        console.log('Response:', JSON.stringify(tags.data).substring(0, 300));
    }

    // Test 6.3c  Categorie
    console.log('\n=== 6.3c GET /tag-categories ===');
    const cats = await apiRequest('GET', '/tag-categories', null, token);
    console.log('Status:', cats.status);
    if (Array.isArray(cats.data)) {
        console.log('Cats count:', cats.data.length, '| Names:', cats.data.map(c => c.name).join(', '));
    } else {
        console.log('Response:', JSON.stringify(cats.data).substring(0, 300));
    }

    // Test 6.3d  Template albero
    console.log('\n=== 6.3d GET /document-tree-templates ===');
    const tmpl = await apiRequest('GET', '/document-tree-templates', null, token);
    console.log('Status:', tmpl.status);
    if (Array.isArray(tmpl.data)) {
        console.log('Templates count:', tmpl.data.length, '| First:', tmpl.data.slice(0,2).map(t => t.name).join(', '));
    } else {
        console.log('Response:', JSON.stringify(tmpl.data).substring(0, 300));
    }

    // Test 6.4  Provisioning
    console.log('\n=== 6.4 POST /documents/provision-tree (company_id=1) ===');
    const prov = await apiRequest('POST', '/documents/provision-tree', { company_id: 9, standard_codes: ['ISO_9001'] }, token);
    console.log('Status:', prov.status);
    const provData = prov.data;
    if (Array.isArray(provData)) {
        console.log('Folders created/found:', provData.length);
        provData.slice(0, 5).forEach(f => console.log('  -', f.name, '[' + (f.folder_code || f.code || '?') + ']'));
    } else if (provData && provData.folders) {
        console.log('Folders:', provData.folders.length);
    } else {
        console.log('Response:', JSON.stringify(provData).substring(0, 400));
    }

    // Test albero dopo provisioning
    console.log('\n=== Albero company_id=1 dopo provisioning ===');
    const tree2 = await apiRequest('GET', '/documents/tree?company_id=9', null, token);
    console.log('Status:', tree2.status);
    console.log('Response preview:', JSON.stringify(tree2.data).substring(0, 400));

    console.log('\n=== SMOKE TEST COMPLETATO ===');
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
