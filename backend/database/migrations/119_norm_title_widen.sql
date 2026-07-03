-- Migration 119: allarga norm_title per titoli UNI/ISO lunghi (upload norme)
-- Fix: "String or binary data would be truncated" su norm_document_sources.norm_title

IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'norm_document_sources' AND COLUMN_NAME = 'norm_title'
)
BEGIN
  ALTER TABLE norm_document_sources ALTER COLUMN norm_title NVARCHAR(500) NULL;
END;
GO
