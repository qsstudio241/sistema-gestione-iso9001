-- Migration 054: enhance complaints
-- Split su ';' — statement separati, eseguiti in ordine.

ALTER TABLE complaints ADD complaint_number NVARCHAR(50) NULL;
ALTER TABLE complaints ADD complaint_type NVARCHAR(20) NOT NULL DEFAULT 'customer';
ALTER TABLE complaints ADD CONSTRAINT CK_complaints_type CHECK (complaint_type IN ('customer','supplier','internal'));
ALTER TABLE complaints ADD severity NVARCHAR(20) NOT NULL DEFAULT 'medium';
ALTER TABLE complaints ADD CONSTRAINT CK_complaints_severity CHECK (severity IN ('low','medium','high','critical'));
ALTER TABLE complaints ADD supplier_id INT NULL;
ALTER TABLE complaints ADD CONSTRAINT FK_complaints_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
ALTER TABLE complaints ADD department_id INT NULL;
ALTER TABLE complaints ADD CONSTRAINT FK_complaints_department FOREIGN KEY (department_id) REFERENCES departments(id);
ALTER TABLE complaints ADD nc_id INT NULL;
ALTER TABLE complaints ADD CONSTRAINT FK_complaints_nc FOREIGN KEY (nc_id) REFERENCES non_conformities(nc_id);
ALTER TABLE complaints ADD product_service NVARCHAR(500) NULL;
ALTER TABLE complaints ADD responsible_person NVARCHAR(200) NULL;
ALTER TABLE complaints ADD due_date DATE NULL;
ALTER TABLE complaints ADD root_cause NVARCHAR(MAX) NULL;
ALTER TABLE complaints ADD resolution_summary NVARCHAR(MAX) NULL;
ALTER TABLE complaints DROP CONSTRAINT CK_complaints_status;
ALTER TABLE complaints ADD CONSTRAINT CK_complaints_status CHECK (status IN ('open','in_progress','in_analysis','action_taken','verified','closed','rejected'));
