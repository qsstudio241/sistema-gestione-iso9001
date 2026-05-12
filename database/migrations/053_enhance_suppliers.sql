-- Migration 053: enhance suppliers
-- Split su ';' — ogni statement esplicito e separato.

ALTER TABLE suppliers ADD supplier_type NVARCHAR(20) NOT NULL DEFAULT 'external';
ALTER TABLE suppliers ADD CONSTRAINT CK_suppliers_type CHECK (supplier_type IN ('external','internal'));
ALTER TABLE suppliers ADD code NVARCHAR(50) NULL;
ALTER TABLE suppliers ADD email NVARCHAR(200) NULL;
ALTER TABLE suppliers ADD phone NVARCHAR(50) NULL;
ALTER TABLE suppliers ADD contact_person NVARCHAR(200) NULL;
ALTER TABLE suppliers ADD address NVARCHAR(500) NULL;
ALTER TABLE suppliers ADD is_active BIT NOT NULL DEFAULT 1;
