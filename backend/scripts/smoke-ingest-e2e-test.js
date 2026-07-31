#!/usr/bin/env node
/**
 * Smoke ingest E2E su ambiente TEST (test-api)
 * Uso: SGQ_APP_EMAIL=... SGQ_APP_PASSWORD=... node backend/scripts/smoke-ingest-e2e-test.js
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.SGQ_TEST_API_BASE || 'https://sistemi.fr-busato.it:8443/test-api/api/v1';
const EMAIL = process.env.SGQ_APP_EMAIL;
const PASS = process.env.SGQ_APP_PASSWORD;

if (!EMAIL || !PASS) {
    console.error('Mancano SGQ_APP_EMAIL / SGQ_APP_PASSWORD');
    process.exit(1);
}

async function req(method, endpoint, { token, body, formData } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload = body;
    if (formData) {
        payload = formData;
    } else if (body) {
        headers['Content-Type'] = 'application/json';
        payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${endpoint}`, { method, headers, body: payload });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    return { status: res.status, json };
}

function makeWpqrPdf(uniqueTag) {
    const tag = uniqueTag || `SMOKE-${Date.now()}`;
    const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R/Parent 2 0 R>>endobj
4 0 obj<</Length 120>>stream
BT /F1 12 Tf 50 700 Td (WPQR 21-${tag} Processo 135 ISO 15614 Spessore 12mm) Tj ET
endstream endobj
xref
0 5
trailer<</Size 5/Root 1 0 R>>
startxref
0
%%EOF`;
    const p = path.join('/tmp', `wpqr-smoke-${Date.now()}.pdf`);
    fs.writeFileSync(p, content);
    return { path: p, tag };
}

async function main() {
    const steps = [];

    const login = await req('POST', '/auth/login', {
        body: { email: EMAIL, password: PASS },
    });
    if (login.status !== 200 || !login.json?.token) {
        console.error('LOGIN FAIL', login.status, login.json);
        process.exit(1);
    }
    const token = login.json.token;
    steps.push('login OK');

    const health = await req('GET', '/health', { token });
    if (health.json?.status !== 'healthy') {
        console.error('HEALTH FAIL', health.json);
        process.exit(1);
    }
    steps.push('health OK');

    const stats = await req('GET', '/ingest-staging/learning-stats?doc_type=wpqr', { token });
    if (stats.status !== 200) {
        console.error('LEARNING STATS FAIL', stats.status, stats.json);
        process.exit(1);
    }
    steps.push(`learning-stats OK (total=${stats.json.total})`);

    let companies = await req('GET', '/companies?limit=5', { token });
    let company = companies.json?.data?.[0];
    if (!company?.id) {
        const created = await req('POST', '/companies', {
            token,
            body: { name: 'Smoke Ingest Test SRL', auditor_org_id: 1, vat_number: 'IT99999999999' },
        });
        company = created.json?.data;
    }
    const companyId = company?.id;
    if (!companyId) {
        console.error('NO COMPANY', companies.json);
        process.exit(1);
    }
    steps.push(`company OK id=${companyId}`);

    const runTag = `RUN-${Date.now()}`;
    const { path: pdfPath, tag } = makeWpqrPdf(runTag);
    const fd = new FormData();
    const blob = new Blob([fs.readFileSync(pdfPath)], { type: 'application/pdf' });
    fd.append('files', blob, `wpqr-${tag}.pdf`);
    fd.append('company_id', String(companyId));

    const upload = await req('POST', '/welding/wpqr/upload-batch', { token, formData: fd });
    fs.unlinkSync(pdfPath);
    const result = upload.json?.results?.[0];
    if (upload.status !== 200 || !result) {
        console.error('UPLOAD FAIL', upload.status, upload.json);
        process.exit(1);
    }
    if (result.status !== 'pending_review' || !result.staging_id) {
        console.error('UPLOAD UNEXPECTED', result);
        process.exit(1);
    }
    steps.push(`upload staging OK id=${result.staging_id}`);

    const fields = { ...result.fields, wpqr_number: result.fields?.wpqr_number || `21-${tag}` };
    const confirm = await req('POST', `/ingest-staging/${result.staging_id}/confirm`, {
        token,
        body: { fields },
    });
    if (confirm.status !== 200 || confirm.json?.status !== 'confirmed') {
        console.error('CONFIRM FAIL', confirm.status, confirm.json);
        process.exit(1);
    }
    steps.push(`confirm OK wpqr_id=${confirm.json.wpqr_id}`);

    const stats2 = await req('GET', '/ingest-staging/learning-stats?doc_type=wpqr', { token });
    if ((stats2.json?.total || 0) < 1) {
        console.error('FEEDBACK NOT RECORDED', stats2.json);
        process.exit(1);
    }
    steps.push(`feedback recorded total=${stats2.json.total}`);

    const rejectTag = `REJ-${Date.now()}`;
    const rejectPdf = makeWpqrPdf(rejectTag);
    const fd2 = new FormData();
    fd2.append('files', new Blob([fs.readFileSync(rejectPdf.path)], { type: 'application/pdf' }), `wpqr-${rejectTag}.pdf`);
    fd2.append('company_id', String(companyId));
    const upload2 = await req('POST', '/welding/wpqr/upload-batch', { token, formData: fd2 });
    fs.unlinkSync(rejectPdf.path);
    const staging2 = upload2.json?.results?.[0]?.staging_id;
    if (!staging2) {
        console.error('UPLOAD2 FAIL', upload2.json);
        process.exit(1);
    }
    const reject = await req('POST', `/ingest-staging/${staging2}/reject`, { token, body: {} });
    if (reject.status !== 200) {
        console.error('REJECT FAIL', reject.status, reject.json);
        process.exit(1);
    }
    steps.push('reject OK');

    console.log('SMOKE INGEST TEST OK');
    steps.forEach((s) => console.log(' -', s));
}

main().catch((e) => {
    console.error('SMOKE CRASH', e.message);
    process.exit(1);
});
