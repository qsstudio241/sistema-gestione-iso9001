-- Migration 144: vincolo UNIQUE su auditor_orgs.email (idempotente)
--
-- Contesto: PR #382 (DEPUTYTASK1, provisioning nuovo studio da UI) introduce
-- POST /api/v1/auditor-orgs con un controllo applicativo di univocità email
-- (SELECT fuori transazione) ma nessun vincolo a livello DB. Segnalato da
-- Bugbot (severità alta, 10/08/2026): due richieste concorrenti con la stessa
-- email possono entrambe superare il pre-check e creare due studi duplicati.
--
-- Indice UNIQUE filtrato (non un vincolo UNIQUE semplice) perché la colonna
-- è NULLABLE e SQL Server ammette un solo NULL con un vincolo UNIQUE
-- standard: il filtro WHERE email IS NOT NULL permette più righe con email
-- NULL (studi legacy senza email) mantenendo l'unicità solo tra i valori
-- effettivamente popolati.

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_auditor_orgs_email' AND object_id = OBJECT_ID('dbo.auditor_orgs')
)
BEGIN
    CREATE UNIQUE INDEX UX_auditor_orgs_email
    ON dbo.auditor_orgs (email)
    WHERE email IS NOT NULL;
END
