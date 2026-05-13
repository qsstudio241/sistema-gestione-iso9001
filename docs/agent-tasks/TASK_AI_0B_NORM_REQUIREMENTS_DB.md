# TASK 0-B — DB norme strutturate + import iniziale

> **ADR di riferimento**: [docs/adr/ADR-010-ai-agentic-architecture.md](../adr/ADR-010-ai-agentic-architecture.md) sezione 3
> **Branch**: `feat/norm-requirements-db`
> **Eseguibile in parallelo con**: 0-A, 0-C

---

## Obiettivo

Creare la tabella `norm_requirements` e popolarla con le 6 norme già disponibili in `docs/Normative/*.md`, strutturandole per clausola.

## File da creare

### `backend/database/migrations/052_norm_requirements.sql`

```sql
CREATE TABLE norm_requirements (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  standard_code   NVARCHAR(50)  NOT NULL,
  clause_ref      NVARCHAR(30)  NOT NULL,
  clause_title    NVARCHAR(500),
  requirement_text NVARCHAR(MAX) NOT NULL,
  applicability   NVARCHAR(200),
  linked_legislation NVARCHAR(500),
  source          NVARCHAR(50)  NOT NULL DEFAULT 'local_file',
  source_url      NVARCHAR(500),
  last_synced_at  DATETIME2     NOT NULL DEFAULT GETDATE(),
  norm_version    NVARCHAR(20),
  is_current      BIT           NOT NULL DEFAULT 1,
  CONSTRAINT UQ_norm_req UNIQUE (standard_code, clause_ref, norm_version)
);

CREATE INDEX IX_norm_req_code ON norm_requirements(standard_code);
CREATE INDEX IX_norm_req_clause ON norm_requirements(clause_ref);
```

### `backend/scripts/run-migration-052-vps.js`
Script per eseguire la migrazione sul VPS via SSH (pattern standard del progetto: `require('/var/www/sgq-backend/src/config/database')`).

### `backend/scripts/import-norms-from-markdown.js`
Script Node che:
1. Legge ogni file `.md` da `docs/Normative/`
2. Parsa il testo per identificare le clausole (pattern: numeri tipo `4.1`, `4.2`, `5.1.1`, `8.4.2`, ecc. seguiti da un titolo)
3. Per ogni clausola estratta, fa INSERT in `norm_requirements`
4. Mapping file → `standard_code`:
   - `UNI EN ISO 9001_2015 Rev. 0.md` → `ISO_9001_2015`
   - `Normative NORMA_00003_ UNI EN ISO 14001_2015 Rev. 0.md` → `ISO_14001_2015`
   - `Normative NORMA_00002_ UNI ISO 45001_2018 Rev. 0.md` → `ISO_45001_2018`
   - `Normative NORMA_00005_ UNI EN ISO 3834-1_2021 Rev. 0.md` → `ISO_3834_1_2021`
   - `Normative NORMA_00009_ UNI EN ISO 3834-3_2021 Rev. 0.md` → `ISO_3834_3_2021`
   - `Normative NORMA_00008_ UNI EN ISO 3834-5_2021 Rev. 0.md` → `ISO_3834_5_2021`

### Nota sulla struttura dei file markdown

I file sono strutturati per "Pagina X" (corrispondenti alle pagine del PDF originale). All'interno di ogni pagina, le clausole sono identificabili dal formato numerico (es. `4.1 Comprendere l'organizzazione e il suo contesto`). Il parser deve:
- Ignorare le pagine iniziali (copertina, premessa, indice)
- Identificare le clausole dal pattern `^(\d+\.[\d.]+)\s+(.+)$`
- Aggregare il testo tra una clausola e la successiva come `requirement_text`
- Gestire le sotto-clausole (es. `8.4.2.a)`, `8.4.2.b)`) come parte della clausola padre

## Regole

- Lo script deve essere idempotente: se eseguito 2 volte, non duplica i record (usa MERGE o DELETE+INSERT per `standard_code`)
- Pattern VPS per cloud agent: scrivere lo script con `require` assoluti, copiare via SCP, eseguire via SSH
- Non toccare altri file del backend

## DoD

- Tabella `norm_requirements` creata
- Almeno ISO 9001:2015 importata con clausole strutturate (clausole 4.x → 10.x)
- Le altre 5 norme importate (best effort — la qualità del parsing può variare)
- Script idempotente verificato
- Commit su branch, PR aperta
