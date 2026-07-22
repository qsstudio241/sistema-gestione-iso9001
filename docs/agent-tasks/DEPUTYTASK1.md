# DEPUTYTASK1 — Rischi §6.1: campo `nature` (rischio/opportunità) — Slice 1-3

**Stato:** CHIUSO — TEST OK, mergiato PR #279 (22/07/2026)  
**Priorità:** P1 roadmap — §6.1 ISO 9001/14001/45001  
**Branch base:** `main`  
**Prossima migrazione disponibile:** 121  
**Creato da:** Lead 21/07/2026

> **Correzione post-merge (22/07/2026)**: il brief indicava erroneamente `backend/database/migrations/` come cartella destinazione — quella è una **reliquia storica non più attiva** (mai deployata sul VPS). La cartella canonica condivisa è **`database/migrations/`** (root repo). Le 3 migrazioni sono state rinumerate **123/124/125** (121/122 erano già occupati da un'altra sessione parallela: `121_nc_correction_gate.sql`, `122_qualifications_14732_fields.sql`) e spostate nella cartella corretta. Nessun impatto sul DB: gli script `run-migration-*-vps.js` avevano SQL inline, già eseguiti con successo. Vedi lezione in `GUIDA_CONSOLIDATA.md`.

---

## Contesto

La pagina `RisksPage.jsx` gestisce già rischi e obiettivi (§6.1/§6.2) ma tratta tutto come "rischio" senza distinguere rischi da opportunità. ISO 9001:2015 §6.1.1 richiede esplicitamente di "determinare i rischi e le opportunità". Le tre slice aggiungono questa distinzione in modo incrementale, retrocompatibile e senza breaking change.

Prossima migrazione numerica: **121** (sequenza condivisa — verificare che la 120 sia già applicata sul VPS prima di procedere).

---

## Slice 1 — Campo `nature` su tabella `risks` (migrazione 121 + UI selector)

### Backend — Migrazione 121

Creare `backend/database/migrations/121_risks_nature.sql`:
```sql
-- Idempotente: verifica esistenza colonna prima di aggiungerla
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'nature'
)
BEGIN
  ALTER TABLE risks
    ADD nature NVARCHAR(20) NOT NULL DEFAULT 'risk'
    CONSTRAINT CK_risks_nature CHECK (nature IN ('risk', 'opportunity'));
END
```

Creare script VPS `backend/scripts/run-migration-121-vps.js`:
```js
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '../database/migrations/121_risks_nature.sql'), 'utf8');
    await query(sql);
    console.log('Migration 121 OK — colonna nature aggiunta a risks');
  } catch (e) {
    console.error('Migration 121 ERRORE:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
main();
```

Applicare sul VPS:
```bash
echo "$SGQ_SSH_KEY_B64" | base64 -d > /tmp/sgq_key && chmod 600 /tmp/sgq_key
scp -i /tmp/sgq_key -P 1122 -o StrictHostKeyChecking=no \
  backend/database/migrations/121_risks_nature.sql \
  backend/scripts/run-migration-121-vps.js \
  spascarella@www.fr-busato.it:/tmp/
ssh -i /tmp/sgq_key -p 1122 -o StrictHostKeyChecking=no spascarella@www.fr-busato.it \
  "node /tmp/run-migration-121-vps.js"
```

### Backend — Controller `risks.controller.js`

Verificare (con `rg "nature"` nel file) se `nature` è già letto/scritto. Se no:
- Aggiungere `nature` alla SELECT in `listRisks` e `getRiskById`
- Aggiungere `nature` al body parsing in `createRisk` e `updateRisk` (default `'risk'` se mancante)
- Validare: `['risk', 'opportunity'].includes(nature)` altrimenti 400

### Frontend — `RisksPage.jsx`

1. Aggiungere selettore "Tipo" nel form di creazione/modifica rischio:
```jsx
<div className="form-group">
  <label>Tipo</label>
  <select
    value={formData.nature || 'risk'}
    onChange={e => setFormData(p => ({ ...p, nature: e.target.value }))}
    className="form-control"
  >
    <option value="risk">Rischio</option>
    <option value="opportunity">Opportunità</option>
  </select>
</div>
```

2. Mostrare badge "Rischio" / "Opportunità" nella griglia (colonna o chip):
```jsx
<span className={`nature-badge nature-${row.nature || 'risk'}`}>
  {row.nature === 'opportunity' ? '🟢 Opportunità' : '🔴 Rischio'}
</span>
```

3. CSS in `RisksPage.css` o stile inline:
```css
.nature-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.75rem; font-weight: 600; }
.nature-risk        { background: #fee2e2; color: #991b1b; }
.nature-opportunity { background: #d1fae5; color: #065f46; }
```

**DoD Slice 1:**
- Migration 121 applicata sul VPS (verificare con `SELECT nature FROM risks LIMIT 1`)
- Nuovo rischio crea-con-type, modifica tipo esistente, griglia mostra badge
- `npm run test:run` verde

---

## Slice 2 — Tabelle `context_factors` (§4.1) e `interested_parties` (§4.2)

> **Prerequisito:** Slice 1 completata e su `main`.

### Backend — Migrazione 122

Creare `backend/database/migrations/122_context_factors_interested_parties.sql`:
```sql
-- §4.1 Fattori di contesto (interni/esterni)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'context_factors')
BEGIN
  CREATE TABLE context_factors (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    company_id     INT NULL,          -- scope azienda se applicabile
    type           NVARCHAR(20) NOT NULL DEFAULT 'external'
                   CONSTRAINT CK_cf_type CHECK (type IN ('internal', 'external')),
    category       NVARCHAR(50) NULL, -- PESTLE tag: Political, Economic, Social, etc.
    description    NVARCHAR(MAX) NOT NULL,
    impact         NVARCHAR(20) NOT NULL DEFAULT 'neutral'
                   CONSTRAINT CK_cf_impact CHECK (impact IN ('positive', 'negative', 'neutral')),
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_context_factors_org ON context_factors(organization_id);
END

-- §4.2 Parti interessate
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'interested_parties')
BEGIN
  CREATE TABLE interested_parties (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    company_id     INT NULL,
    name           NVARCHAR(200) NOT NULL,
    relationship   NVARCHAR(100) NULL,  -- es. "Cliente", "Fornitore", "Regolatore"
    requirements   NVARCHAR(MAX) NULL,  -- requisiti/aspettative rilevanti §4.2b
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_interested_parties_org ON interested_parties(organization_id);
END
```

### Backend — Nuovi controller/route

- `contextFactors.controller.js` + `interestedParties.controller.js`
- Route: `GET/POST/PUT/DELETE /context-factors` e `/interested-parties`
- Scope: filtrare su `organization_id` + opz. `company_id` (pattern Ambito)
- Aggiungere a `deploy-manifest.json`

### Frontend — Tab "Contesto" in `RisksPage`

Aggiungere tab "Contesto §4" con due sezioni: "Fattori di contesto" e "Parti interessate". Usare `SgqDataGrid` (componente esistente) per la visualizzazione.

Seguire il pattern Ambito (`risksCompanyScope.js` se esiste, altrimenti `documentRegistryCompanyScope.js` come riferimento).

**DoD Slice 2:**
- Migration 122 applicata
- CRUD context_factors e interested_parties funzionante
- Tab "Contesto §4" visibile in RisksPage
- `npm run test:run` verde

---

## Slice 3 — Collegamento Rischi/Opportunità → Piano Azioni

> **Prerequisito:** Slice 1 completata e su `main`.

### Obiettivo

Quando un rischio/opportunità passa a `status='in_treatment'`, l'utente può creare automaticamente un'azione nel Piano Azioni (`action_plan_items`) con `source_category='rischi'`. FK `source_risk_id` già esiste? Verificare con `rg "source_risk" backend/`.

### Frontend — `RisksPage.jsx`

In visualizzazione dettaglio rischio con `status='in_treatment'`:
```jsx
{risk.status === 'in_treatment' && hasLicensedModule('nc') && (
  <button
    className="btn btn-secondary btn-sm"
    onClick={() => handleCreateActionFromRisk(risk)}
  >
    ➕ Crea azione nel Piano Azioni
  </button>
)}
```

`handleCreateActionFromRisk` apre il modale NC con `source_category='rischi'` e `source_risk_id` pre-compilato.

### Backend

Se `source_risk_id` non esiste nella tabella `action_plan_items`, aggiungere con migrazione 123:
```sql
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='action_plan_items' AND COLUMN_NAME='source_risk_id')
  ALTER TABLE action_plan_items ADD source_risk_id INT NULL;
```

**DoD Slice 3:**
- Pulsante "Crea azione" visibile su rischio in_treatment
- Azione creata con source_category='rischi' e link al rischio di origine
- `npm run test:run` verde

---

## Sequenza di lavoro

```bash
git pull origin main
git checkout -b cursor/rischi-opportunita-slices-3bea
```

Slice 1 → commit → Slice 2 → commit → Slice 3 → commit → push → PR

**Commit message standard:**
```
feat: Rischi §6.1 Slice 1 — campo nature (rischio/opportunità), mig. 121
feat: Rischi §6.1 Slice 2 — context_factors e interested_parties (§4.1/§4.2), mig. 122
feat: Rischi §6.1 Slice 3 — collegamento rischio → Piano Azioni (source_category rischi)
```

---

## DoD globale

- Migrazione/i applicate sul VPS (prima TEST se disponibile, poi produzione)
- `npm run test:run` verde dopo ogni slice
- `npm run build` verde prima del push
- PR draft aperta; chiudere con TEST OK o FIX NON APPLICABILI
