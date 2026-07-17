-- Migrazione 120: pattern di riferimento ingest (Livello B — cross-tenant, no PII)
-- ADR-017

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'ingest_reference_patterns'
)
BEGIN
    CREATE TABLE dbo.ingest_reference_patterns (
        id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        doc_type            NVARCHAR(64)  NOT NULL,
        field_key           NVARCHAR(128) NOT NULL,
        from_pattern        NVARCHAR(500) NOT NULL,
        to_pattern          NVARCHAR(500) NOT NULL,
        hit_count           INT           NOT NULL CONSTRAINT DF_irp_hit DEFAULT (1),
        last_seen_at        DATETIME2(3)  NOT NULL CONSTRAINT DF_irp_seen DEFAULT (SYSUTCDATETIME()),
        created_at          DATETIME2(3)  NOT NULL CONSTRAINT DF_irp_created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_ingest_reference_patterns UNIQUE (doc_type, field_key, from_pattern, to_pattern)
    );

    CREATE INDEX IX_irp_doc_type_hits
        ON dbo.ingest_reference_patterns (doc_type, hit_count DESC, last_seen_at DESC);
END
