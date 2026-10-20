#!/usr/bin/env node
'use strict';

/**
 * Gate: un deploy TEST non deve poter toccare PROD (sgq-backend / :3000).
 *   node backend/scripts/check-deploy-test-isolation.js
 */

const fs = require('fs');
const path = require('path');

const dir = __dirname;
const wrapperPath = path.join(dir, 'deploy-to-vps-test.sh');
const mainPath = path.join(dir, 'deploy-to-vps.sh');
const wrapper = fs.readFileSync(wrapperPath, 'utf8');
const main = fs.readFileSync(mainPath, 'utf8');

const errors = [];

function must(cond, msg) {
    if (!cond) errors.push(msg);
}

must(
    /export SGQ_REMOTE_BASE="\/var\/www\/sgq-backend-test"/.test(wrapper),
    'deploy-to-vps-test.sh deve fissare SGQ_REMOTE_BASE=/var/www/sgq-backend-test'
);
must(
    /export SGQ_SYSTEMD_SERVICE="sgq-backend-test\.service"/.test(wrapper),
    'deploy-to-vps-test.sh deve fissare SGQ_SYSTEMD_SERVICE=sgq-backend-test.service'
);
must(
    /test-api\/api\/v1\/health/.test(wrapper),
    'deploy-to-vps-test.sh deve usare health test-api'
);
must(
    /SGQ_LISTEN_PORT=.*3001/.test(wrapper),
    'deploy-to-vps-test.sh deve impostare SGQ_LISTEN_PORT=3001'
);
must(
    !/sgq-backend\.service/.test(wrapper),
    'deploy-to-vps-test.sh non deve nominare sgq-backend.service (PROD)'
);
must(
    !/fuser -k 3000/.test(wrapper),
    'deploy-to-vps-test.sh non deve uccidere la porta 3000'
);

must(
    /IS_TEST_DEPLOY/.test(main),
    'deploy-to-vps.sh deve distinguere il target TEST'
);
must(
    /sgq-backend-test\.service/.test(main),
    'deploy-to-vps.sh deve vincolare il servizio TEST'
);
must(
    /nessun fallback fuser/.test(main),
    'deploy-to-vps.sh su TEST non deve usare fallback fuser'
);
must(
    !/fuser -k 3000\/tcp/.test(main),
    'deploy-to-vps.sh non deve hardcodare fuser -k 3000/tcp (colpirebbe PROD da un deploy TEST)'
);
must(
    /LISTEN_PORT/.test(main),
    'deploy-to-vps.sh deve usare LISTEN_PORT (3001 su TEST, 3000 solo PROD)'
);

if (errors.length) {
    console.error('FAIL isolamento deploy TEST:');
    for (const e of errors) console.error(' -', e);
    process.exit(1);
}

console.log('OK isolamento deploy TEST (solo sgq-backend-test / :3001 / test-api)');
