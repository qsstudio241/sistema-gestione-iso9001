# Revisione migrazione 167 (solo documentale) — 07/10/2026

Oggetto: `database/migrations/167_ai_usage_log.sql` (tabelle `ai_assistant_usage`, `ai_assistant_notifications`), runner `backend/scripts/run-migration-167-vps.js`. La 167 **non va modificata** (già in PROD). Nessun companion `167_verify`/`167_rollback` (previsti solo da 169, `backend/scripts/migrationContract.js`). Nessuna esecuzione, nessun accesso a TEST/PROD.

## Problema 1 — `ON DELETE CASCADE` (confermato)
Righe 28, 37, 70 di `167_ai_usage_log.sql`: tutte e 3 le FK (`FK_ai_assistant_usage_org`, `FK_ai_assistant_usage_user`, `FK_ai_assistant_notif_org`) hanno `ON DELETE CASCADE`. Vietato da `.cursor/rules/sgq-operating-memory.mdc` § Accesso Netlify e VPS. Le migrazioni 160 e 164 dichiarano esplicitamente «Nessun ON DELETE CASCADE».

## Problema 2 — FK su colonne inesistenti (confermato, ed è più ampio)
- `organizations` ha PK `organization_id`: join in `backend/src/controllers/auth.controller.js` (righe 191, 395) e FK corrette in molte migrazioni (es. `database/migrations/162_commercial_checklist_templates.sql` riga 18). La 167 usa `organizations(id)` (righe 28, 70).
- Terzo errore non segnalato: riga 37 usa `users(id)`, ma la PK di `users` è `user_id` (es. `database/migrations/149_material_certificates.sql` riga 132, `022_user_standards.sql` riga 25). Tutte e 3 le FK puntano a colonne che non esistono.

## Su DB pulito / come è stata applicata
Dedotto dal codice (non eseguito): `CREATE TABLE` e indici riescono; i 3 `ADD CONSTRAINT` falliscono (SQL Server: colonna referenziata inesistente). Il runner (riga 53) lancia `sqlcmd` **senza `-b`**: l'errore non interrompe i batch successivi e il runner stampa «eseguita con successo» (riga 64). Esito atteso: tabelle e indici presenti, **nessuna delle 3 FK creata**, nessun CASCADE effettivo. Precedente identico: `032_qualifications.sql` riga 49 ha `organizations(id)` e `backend/scripts/run-migration-032.js` ha creato la tabella senza FK. Il runner 167 ha anche messaggi errati (`ai_usage_log`, righe 4 e 82).
Note di applicazione in PROD: nei doc non c'è una nota esplicita. `docs/GUIDA_CONSOLIDATA.md` (riga 1707, 28/09/2026) cita `ai_assistant_usage` «vuota», quindi la tabella esiste in PROD. `docs/agent-tasks/DEPUTYTASK_AI_CHECKLIST.md` (riga 510) dà la 167 «non eseguita su DB test». **La forma effettiva dei vincoli in PROD/TEST è quindi da verificare** (SELECT sotto, a cura del committente).

## Impatto
- Nessuna FK: non c'è integrità referenziale. Org/utente cancellati lasciano righe orfane. Il codice non fa `DELETE FROM organizations`; i tenant si disattivano con `is_active`. Gli utenti si cancellano solo con script manuali (`database/scripts/split_tenants_delete_user_1007_eram_typo.sql`).
- Il CASCADE, se fosse stato creato, avrebbe cancellato in silenzio l'audit trail AI alla cancellazione di un utente: sbagliato per un log di audit.
- `questionAssistant.controller.js` (righe 116, 134, 148) scrive solo con org/utente validi: nessun impatto funzionale oggi.

## SQL corretto PROPOSTO (testo, non applicato)
Nuova migrazione **170** (ultima presente: 169; nessun 170 su `origin/main`), da scrivere in una slice dedicata:

```sql
-- TYPE: transform
-- BACKFILL: none
-- VERIFY: 170_verify.sql
-- ROLLBACK: 170_rollback.sql
-- Allinea le FK di 167: PK corrette, nessun CASCADE. Idempotente, FK in statement separati.
-- Tabella assente (CI apply-on-empty) -> no-op.
IF OBJECT_ID('dbo.ai_assistant_usage') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_ai_assistant_usage_org'
               AND parent_object_id=OBJECT_ID('dbo.ai_assistant_usage') AND delete_referential_action<>0)
  ALTER TABLE dbo.ai_assistant_usage DROP CONSTRAINT FK_ai_assistant_usage_org;
GO
IF OBJECT_ID('dbo.ai_assistant_usage') IS NOT NULL AND OBJECT_ID('dbo.organizations') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_ai_assistant_usage_org')
  ALTER TABLE dbo.ai_assistant_usage ADD CONSTRAINT FK_ai_assistant_usage_org
    FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);
GO
-- idem per FK_ai_assistant_usage_user -> dbo.users(user_id)
-- idem per FK_ai_assistant_notif_org (su ai_assistant_notifications) -> dbo.organizations(organization_id)
```
Cleanup applicativo esplicito: prima di un eventuale hard delete di utente/organizzazione, lo script manuale cancella prima le righe di `ai_assistant_usage` / `ai_assistant_notifications` (nessuna cascata implicita). Il verify 170 controlla assenza di orfani e `delete_referential_action = 0`; il rollback ripristina l'assenza di FK.

## Allineamento TEST/PROD (senza riscrivere la storia)
1. Il committente esegue su TEST e PROD (read-only):
```sql
SELECT fk.name, OBJECT_NAME(fk.parent_object_id) AS tabella, OBJECT_NAME(fk.referenced_object_id) AS ref_tabella,
       COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS ref_colonna, fk.delete_referential_action_desc
FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE fk.parent_object_id IN (OBJECT_ID('dbo.ai_assistant_usage'), OBJECT_ID('dbo.ai_assistant_notifications'));
SELECT COL_LENGTH('dbo.organizations','id') AS org_id_col, COL_LENGTH('dbo.users','id') AS users_id_col; -- NULL = colonna assente
SELECT COUNT(*) AS orfani_org FROM dbo.ai_assistant_usage u WHERE NOT EXISTS (SELECT 1 FROM dbo.organizations o WHERE o.organization_id = u.organization_id);
```
2. Zero righe FK (atteso): la 170 aggiunge le 3 FK corrette. FK presenti con CASCADE o puntamento errato: la 170 fa DROP/ADD. FK già corrette: la 170 è no-op, nessuna azione.
3. Orfani > 0: decisione sul cleanup prima della 170 (non automatico).

## Rischio e decisione
Rischio **Medio/Alto**: la 170 cambia vincoli su tabelle esistenti in PROD (`database/migrations/**` e runner VPS: sempre consenso esplicito, nessun automerge). Basso impatto dati (tabella `ai_assistant_usage` vuota a fine settembre).
**Decisione richiesta al committente:** (a) eseguire le SELECT e comunicare l'esito; (b) approvare la 170 solo se la forma in PROD è errata o assente; (c) scegliere se `user_id` deve avere FK o restare senza (conservare l'audit trail anche dopo cancellazione utente).
