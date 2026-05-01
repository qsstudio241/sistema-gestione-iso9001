-- Migration 047: Aggiungi custom_item_id a attachments (unificazione allegati ISO e custom)
-- Idempotente: IF NOT EXISTS su ogni oggetto.
-- Permette a useAttachmentManager di gestire allegati anche per item checklist custom.
SET NOCOUNT ON;

-- Colonna custom_item_id nullable (retrocompatibile: tutti gli allegati esistenti restano invariati)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'custom_item_id'
)
BEGIN
    ALTER TABLE dbo.attachments
        ADD custom_item_id INT NULL;
    PRINT 'Colonna custom_item_id aggiunta a dbo.attachments';
END
ELSE
    PRINT 'Colonna custom_item_id già presente — skip';

-- FK verso custom_checklist_items (nullable, no ON DELETE SET NULL — non supportato da SQL Server in questo contesto)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_attachments_custom_item_id'
)
BEGIN
    ALTER TABLE dbo.attachments
        ADD CONSTRAINT FK_attachments_custom_item_id
        FOREIGN KEY (custom_item_id)
        REFERENCES dbo.custom_checklist_items(id);
    PRINT 'FK FK_attachments_custom_item_id creata';
END
ELSE
    PRINT 'FK FK_attachments_custom_item_id già presente — skip';

-- Indice per filtro efficiente per custom_item_id
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_attachments_custom_item_id'
    AND object_id = OBJECT_ID('dbo.attachments')
)
BEGIN
    CREATE INDEX IX_attachments_custom_item_id
        ON dbo.attachments (custom_item_id)
        WHERE custom_item_id IS NOT NULL;
    PRINT 'Indice IX_attachments_custom_item_id creato';
END
ELSE
    PRINT 'Indice IX_attachments_custom_item_id già presente — skip';

PRINT 'Migration 047 completata.';
