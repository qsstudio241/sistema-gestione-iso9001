-- Migration 055: alter non_conformities per tracciabilità reclami

ALTER TABLE non_conformities ADD source_complaint_id INT NULL;
ALTER TABLE non_conformities ADD CONSTRAINT FK_nc_complaint FOREIGN KEY (source_complaint_id) REFERENCES complaints(id);
ALTER TABLE non_conformities DROP CONSTRAINT CK_nc_source_type;
ALTER TABLE non_conformities ADD CONSTRAINT CK_nc_source_type CHECK (source_type IN ('audit_nc','audit_oss','manual','reaudit_persists','complaint'));
ALTER TABLE non_conformities ADD root_cause NVARCHAR(MAX) NULL;
