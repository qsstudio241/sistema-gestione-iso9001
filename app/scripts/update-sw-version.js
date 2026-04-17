/**
 * update-sw-version.js
 * Aggiorna BUILD_DATE solo nel file buildato (dist/service-worker.js).
 * Eseguito automaticamente da npm via "postbuild" hook.
 */

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '../dist/service-worker.js');
const newDate = new Date().toISOString();

if (!fs.existsSync(swPath)) {
    console.log('[postbuild] dist/service-worker.js non trovato: skip version stamp');
    process.exit(0);
}

let content = fs.readFileSync(swPath, 'utf8');
content = content.replace(
    /const BUILD_DATE = '.*?';/,
    `const BUILD_DATE = '${newDate}';`
);

fs.writeFileSync(swPath, content, 'utf8');
console.log(`[postbuild] dist/service-worker.js BUILD_DATE → ${newDate}`);
