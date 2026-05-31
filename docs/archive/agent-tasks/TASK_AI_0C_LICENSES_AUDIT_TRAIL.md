# TASK 0-C — Licenze AI + audit trail interazioni

> **ADR di riferimento**: [docs/adr/ADR-010-ai-agentic-architecture.md](../adr/ADR-010-ai-agentic-architecture.md) sezioni 7 e 8
> **Branch**: `feat/ai-licenses-audit-trail`
> **Eseguibile in parallelo con**: 0-A, 0-B

---

## Obiettivo

1. Aggiungere le chiavi licenza AI mancanti (`ai_assist`, `ai_norms`, `ai_review`, `ai_chat`) a `KNOWN_MODULE_KEYS`
2. Creare la tabella `ai_interactions` per l'audit trail di tutte le chiamate AI
3. Creare un middleware che logga automaticamente ogni interazione AI

## File da modificare

### `backend/src/services/moduleLicense.service.js`

Aggiungere a `KNOWN_MODULE_KEYS`:

```javascript
ai_assist:  { label: 'AI Assist — suggerimenti compilazione', description: 'Suggerimenti AI in compilazione audit, conclusioni, NC' },
ai_norms:   { label: 'AI Norme — accesso normativo on-demand', description: 'Recupero norme da fonti esterne via NormBroker' },
ai_review:  { label: 'AI Riesame — riesame requisiti assistito', description: 'Riesame contratto §8.2 assistito da AI' },
ai_chat:    { label: 'AI Chat — assistente conversazionale', description: 'Chat con i dati aziendali via RAG' },
```

**Attenzione**: non rimuovere `ai_import` (già esistente). Aggiungere le nuove chiavi dopo quelle esistenti.

## File da creare

### `backend/database/migrations/053_ai_interactions.sql`

```sql
CREATE TABLE ai_interactions (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  organization_id INT           NOT NULL,
  user_id         INT           NOT NULL,
  feature         NVARCHAR(30)  NOT NULL,
  provider        NVARCHAR(20)  NOT NULL,
  model           NVARCHAR(50)  NOT NULL,
  input_tokens    INT,
  output_tokens   INT,
  cost_usd        DECIMAL(10,6),
  latency_ms      INT,
  status          NVARCHAR(20)  NOT NULL,
  context_summary NVARCHAR(500),
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_ai_interactions_org_date ON ai_interactions(organization_id, created_at);
CREATE INDEX IX_ai_interactions_feature ON ai_interactions(feature);
```

Aggiungere anche tabella per configurazione fonti normative (usata dal NormBroker):

```sql
CREATE TABLE norm_sources (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  source_key      NVARCHAR(30)  NOT NULL UNIQUE,
  source_type     NVARCHAR(20)  NOT NULL,
  display_name    NVARCHAR(100) NOT NULL,
  base_url        NVARCHAR(500),
  credentials_json NVARCHAR(MAX),
  is_active       BIT           NOT NULL DEFAULT 1,
  rate_limit_rpm  INT           DEFAULT 10,
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE norm_access_log (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  organization_id INT           NOT NULL,
  standard_code   NVARCHAR(50)  NOT NULL,
  source_used     NVARCHAR(30)  NOT NULL,
  access_type     NVARCHAR(20)  NOT NULL,
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_norm_access_org ON norm_access_log(organization_id, created_at);
```

### `backend/scripts/run-migration-053-vps.js`
Script per eseguire sul VPS (pattern standard).

### `backend/src/middleware/aiAuditTrail.middleware.js`

Middleware Express che:
- Si usa come wrapper attorno ai controller AI
- Prima della risposta, logga in `ai_interactions`: `organization_id` da `req.user`, feature dal parametro, provider/model/tokens dalla risposta del servizio
- Non blocca la risposta se il logging fallisce (catch silenzioso con `logger.warn`)

Esporta: `logAiInteraction(feature)` → middleware function

Uso tipico nella route:
```javascript
router.post('/ai/suggest', authenticate, requireLicensedModule('ai_assist'), logAiInteraction('assist'), aiController.suggest);
```

## Regole

- `credentials_json` in `norm_sources` va cifrato prima del salvataggio (usare pattern esistente nel progetto, o almeno documentare che è da cifrare)
- Il middleware non deve rallentare la risposta: logging asincrono (fire-and-forget con catch)
- Non toccare `importAiExtraction.service.js` né altri controller esistenti

## DoD

- Le 4 nuove chiavi AI visibili in `KNOWN_MODULE_KEYS`
- Tabelle `ai_interactions`, `norm_sources`, `norm_access_log` create
- Middleware `logAiInteraction` funzionante (test unitario con mock `req`/`res`)
- Commit su branch, PR aperta
