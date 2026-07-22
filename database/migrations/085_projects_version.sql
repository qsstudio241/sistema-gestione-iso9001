-- Migration 085: projects versionata + FK handoff + FK qualifications
-- Idempotente

-- ?? projects: colonna commercial_case_id ?????????????????????????????????????
IF EXISTS (SELECT 1 FROM sys.objects WHERE name='projects' AND type='U')
  AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('projects') AND name='commercial_case_id')
BEGIN
    ALTER TABLE projects ADD commercial_case_id INT NULL;
    PRINT 'Colonna projects.commercial_case_id aggiunta.';
END

-- FK projects -> commercial_cases
IF EXISTS (SELECT 1 FROM sys.objects WHERE name='projects' AND type='U')
  AND EXISTS (SELECT 1 FROM sys.objects WHERE name='commercial_cases' AND type='U')
  AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_projects_commercial_case')
BEGIN
    ALTER TABLE projects ADD CONSTRAINT FK_projects_commercial_case
        FOREIGN KEY (commercial_case_id) REFERENCES commercial_cases(id);
    PRINT 'FK FK_projects_commercial_case aggiunto.';
END

-- ?? qualifications: FK previous_qualification_id ?????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_qualifications_previous')
BEGIN
    ALTER TABLE qualifications ADD CONSTRAINT FK_qualifications_previous
        FOREIGN KEY (previous_qualification_id) REFERENCES qualifications(id);
    PRINT 'FK FK_qualifications_previous aggiunto.';
END

-- ?? Index projects.commercial_case_id ????????????????????????????????????????
IF EXISTS (SELECT 1 FROM sys.objects WHERE name='projects' AND type='U')
  AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('projects') AND name='IX_projects_commercial_case')
BEGIN
    CREATE INDEX IX_projects_commercial_case ON projects (commercial_case_id);
    PRINT 'Indice IX_projects_commercial_case creato.';
END

PRINT 'Migration 085 completata.';
