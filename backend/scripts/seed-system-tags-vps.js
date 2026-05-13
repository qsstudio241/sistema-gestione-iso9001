/**
 * seed-system-tags-vps.js — Wrapper per eseguire il seed sul VPS
 * Usa localhost:11043 invece di www.fr-busato.it (non raggiungibile internamente)
 */
const sql = require('/var/www/sgq-backend/node_modules/mssql');
const fs = require('fs');

const dbJsonPath = '/var/www/sgq-backend/config/database.json';
const configs = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
const dbConf = configs.production;

const config = {
    server: 'localhost',
    port: dbConf.port || 11043,
    database: dbConf.database,
    user: dbConf.user,
    password: dbConf.password,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, connectTimeout: 30000, requestTimeout: 60000 }
};

const CATEGORIES = [
  { name: 'Norma di riferimento', color: '#1a73e8', display_order: 1 },
  { name: 'Tipo documento',       color: '#34a853', display_order: 2 },
  { name: 'Area aziendale',       color: '#ea4335', display_order: 3 },
  { name: 'Stato workflow',       color: '#fbbc04', display_order: 4 },
];

const NORM_TAGS = [
  { slug: 'iso-9001',  name: 'ISO 9001',  color: '#1a73e8' },
  { slug: 'iso-14001', name: 'ISO 14001', color: '#34a853' },
  { slug: 'iso-45001', name: 'ISO 45001', color: '#ea4335' },
  { slug: 'iso-3834',  name: 'ISO 3834',  color: '#9c27b0' },
];

const DOC_TYPE_TAGS = [
  { slug: 'manuale',     name: 'Manuale',              color: '#5c6bc0' },
  { slug: 'procedura',   name: 'Procedura',            color: '#26a69a' },
  { slug: 'istruzione',  name: 'Istruzione operativa', color: '#ff7043' },
  { slug: 'modulo',      name: 'Modulo/Registrazione', color: '#78909c' },
  { slug: 'certificato', name: 'Certificato',          color: '#ab47bc' },
  { slug: 'capitolato',  name: 'Capitolato',           color: '#ec407a' },
  { slug: 'wps',         name: 'WPS',                  color: '#8d6e63' },
  { slug: 'wpqr',        name: 'WPQR',                 color: '#795548' },
];

const AREA_TAGS = [
  { slug: 'qualita',      name: 'Qualità',        color: '#1e88e5' },
  { slug: 'ambiente',     name: 'Ambiente',        color: '#43a047' },
  { slug: 'sicurezza',    name: 'Sicurezza',       color: '#e53935' },
  { slug: 'produzione',   name: 'Produzione',      color: '#fb8c00' },
  { slug: 'progettazione',name: 'Progettazione',   color: '#8e24aa' },
  { slug: 'fornitori',    name: 'Fornitori',       color: '#00acc1' },
  { slug: 'personale',    name: 'Personale',       color: '#3949ab' },
];

async function main() {
  console.log(`Connessione a ${config.server}:${config.port}/${config.database}`);
  const pool = await sql.connect(config);
  console.log('Connesso. Inizio seed tag di sistema...');

  const categoryIds = {};

  for (const cat of CATEGORIES) {
    const existing = await pool.request()
      .input('name', cat.name)
      .query(`SELECT id FROM tag_categories WHERE name = @name AND is_system = 1`);
    if (existing.recordset.length > 0) {
      categoryIds[cat.name] = existing.recordset[0].id;
      console.log(`  Categoria "${cat.name}" gia presente (id=${categoryIds[cat.name]})`);
    } else {
      const r = await pool.request()
        .input('name', cat.name).input('color', cat.color).input('display_order', cat.display_order)
        .query(`INSERT INTO tag_categories (organization_id, name, color, display_order, is_system) OUTPUT INSERTED.id VALUES (NULL, @name, @color, @display_order, 1)`);
      categoryIds[cat.name] = r.recordset[0].id;
      console.log(`  Categoria "${cat.name}" creata (id=${categoryIds[cat.name]})`);
    }
  }

  async function seedTags(tags, categoryName) {
    const catId = categoryIds[categoryName];
    for (const tag of tags) {
      const existing = await pool.request().input('slug', tag.slug)
        .query(`SELECT id FROM document_tags WHERE slug = @slug AND is_system = 1`);
      if (existing.recordset.length > 0) {
        console.log(`    Tag "${tag.name}" gia presente`);
      } else {
        await pool.request().input('category_id', catId).input('name', tag.name).input('slug', tag.slug).input('color', tag.color)
          .query(`INSERT INTO document_tags (organization_id, category_id, name, slug, color, is_system) VALUES (NULL, @category_id, @name, @slug, @color, 1)`);
        console.log(`    Tag "${tag.name}" creato`);
      }
    }
  }

  console.log('\n  Seed tag norme:');
  await seedTags(NORM_TAGS, 'Norma di riferimento');
  console.log('\n  Seed tag tipi documento:');
  await seedTags(DOC_TYPE_TAGS, 'Tipo documento');
  console.log('\n  Seed tag aree aziendali:');
  await seedTags(AREA_TAGS, 'Area aziendale');

  console.log('\nSeed completato.');
  await pool.close();
  process.exit(0);
}

main().catch(err => { console.error('Errore seed:', err.message); process.exit(1); });
