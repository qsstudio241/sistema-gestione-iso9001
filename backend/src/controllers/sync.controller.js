/**
 * Backend Controller: Sync
 * Gestisce sincronizzazione dati offline → online con conflict resolution
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { allocateAuditReportNumber } = require('../services/auditNumberAllocation.service');
const { validateAuditDateRange } = require('../utils/auditDateRange');
const { studioScopeClause } = require('../services/auditListRbac.service');

/**
 * POST /api/v1/sync/audits
 * Sincronizza audit creati/modificati offline
 * 
 * Body: {
 *   audits: [{ id, data, lastModified, ... }],
 *   lastSyncTimestamp: 1234567890
 * }
 */
async function syncAudits(req, res) {
    try {
        const { audits, lastSyncTimestamp } = req.body;
        const userId = req.user.user_id;
        const organizationId = req.user.organization_id;
        const syncUser = req.user;

        if (!audits || !Array.isArray(audits)) {
            return res.status(400).json({
                success: false,
                error: 'Campo audits obbligatorio (array)'
            });
        }

        const results = {
            created: [],
            updated: [],
            conflicts: [],
            errors: []
        };

        // Processa ogni audit
        for (const clientAudit of audits) {
            try {
                // Verifica se audit esiste su server
                const existing = await query(`
          SELECT audit_id, audit_uuid, updated_at
          FROM audits
          WHERE audit_uuid = @audit_uuid
            AND organization_id = @organization_id
        `, {
                    audit_uuid: clientAudit.id,
                    organization_id: organizationId
                });

                if (existing.recordset.length === 0) {
                    // Nuovo audit → CREATE
                    const created = await createAuditFromSync(clientAudit, userId, organizationId);
                    results.created.push(created);
                } else {
                    // Audit esistente → CHECK CONFLICT
                    const serverAudit = existing.recordset[0];
                    const serverTime = new Date(serverAudit.updated_at).getTime();
                    const clientTime = new Date(clientAudit.lastModified).getTime();

                    if (clientTime > serverTime) {
                        // Client più recente → UPDATE
                        const updated = await updateAuditFromSync(serverAudit.audit_id, clientAudit);
                        results.updated.push(updated);
                    } else if (clientTime < serverTime) {
                        // Server più recente → CONFLICT
                        const serverData = await getAuditById(serverAudit.audit_id);
                        results.conflicts.push({
                            clientAudit,
                            serverAudit: serverData,
                            resolution: 'server_wins'
                        });
                    } else {
                        // Stesso timestamp → SKIP (già sincronizzato)
                        results.updated.push({ audit_id: serverAudit.audit_id, skipped: true });
                    }
                }
            } catch (error) {
                logger.error(`Errore sync audit ${clientAudit.id}:`, error);
                results.errors.push({
                    auditId: clientAudit.id,
                    error: error.message
                });
            }
        }

        // Ottieni audit modificati sul server dopo lastSyncTimestamp
        let serverChanges = [];
        if (lastSyncTimestamp) {
            const scope = studioScopeClause(syncUser, 'audits');
            let wherePart = `organization_id = @organization_id
          AND updated_at > @last_sync
          AND is_deleted = 0`;
            const qParams = {
                organization_id: organizationId,
                last_sync: new Date(lastSyncTimestamp),
            };
            if (scope.clause) {
                wherePart += ` AND ${scope.clause}`;
                Object.assign(qParams, scope.params);
            }
            const changesResult = await query(`
        SELECT 
          audit_id, audit_uuid, audit_number, client_name,
          audit_date, audit_date_end, status, updated_at
        FROM audits
        WHERE ${wherePart}
        ORDER BY updated_at DESC
      `, qParams);

            serverChanges = changesResult.recordset;
        }

        res.json({
            success: true,
            results,
            serverChanges,
            syncTimestamp: Date.now()
        });

    } catch (error) {
        logger.error('Errore sync audits:', error);
        res.status(500).json({
            success: false,
            error: 'Errore sincronizzazione audit'
        });
    }
}

/**
 * POST /api/v1/sync/metadata
 * Aggiorna sync_metadata per tracking sincronizzazione
 */
async function updateSyncMetadata(req, res) {
    try {
        const { entityType, entityId, entityUuid, syncVersion } = req.body;
        const userId = req.user.user_id;

        await query(`
      MERGE INTO sync_metadata AS target
      USING (SELECT @entity_type AS entity_type, @entity_id AS entity_id) AS source
      ON target.entity_type = source.entity_type AND target.entity_id = source.entity_id
      WHEN MATCHED THEN
        UPDATE SET 
          last_sync_at = GETDATE(),
          sync_version = @sync_version,
          entity_uuid = @entity_uuid
      WHEN NOT MATCHED THEN
        INSERT (entity_type, entity_id, entity_uuid, last_sync_at, sync_version)
        VALUES (@entity_type, @entity_id, @entity_uuid, GETDATE(), @sync_version);
    `, {
            entity_type: entityType,
            entity_id: entityId,
            entity_uuid: entityUuid,
            sync_version: syncVersion || 1
        });

        res.json({
            success: true,
            message: 'Sync metadata aggiornato'
        });

    } catch (error) {
        logger.error('Errore update sync metadata:', error);
        res.status(500).json({
            success: false,
            error: 'Errore aggiornamento metadata'
        });
    }
}

/**
 * Helper: Crea audit da sync
 */
async function createAuditFromSync(clientAudit, userId, organizationId) {
    const audit_number = await allocateAuditReportNumber(organizationId);
    const dateRange = validateAuditDateRange(
        clientAudit.auditDate,
        clientAudit.auditDateEnd ?? clientAudit.audit_date_end
    );
    if (!dateRange.valid) {
        throw new Error(dateRange.error);
    }
    // Insert audit (senza standard_id - deprecato). Numero report server-side (allineato a POST /audits).
    const result = await query(`
    INSERT INTO audits (
      audit_uuid, audit_number, client_name, project_year,
      audit_date, audit_date_end, auditor_name, audit_type, status,
      organization_id, created_by
    )
    VALUES (
      @audit_uuid, @audit_number, @client_name, @project_year,
      @audit_date, @audit_date_end, @auditor_name, @audit_type, @status,
      @organization_id, @created_by
    );
    SELECT SCOPE_IDENTITY() AS audit_id;
  `, {
        audit_uuid: clientAudit.id,
        audit_number,
        client_name: clientAudit.clientName,
        project_year: clientAudit.projectYear,
        audit_date: dateRange.audit_date,
        audit_date_end: dateRange.audit_date_end,
        auditor_name: clientAudit.auditorName,
        audit_type: clientAudit.auditType,
        status: clientAudit.status || 'draft',
        organization_id: organizationId,
        created_by: userId
    });

    const auditId = result.recordset[0].audit_id;

    // Persistenza tipologia audit e fornitore in audit_extra_data
    const extraData = {
        auditPartyType: clientAudit.auditPartyType ?? clientAudit.audit_party_type ?? 'first_party',
        fornitoreName: clientAudit.fornitoreName ?? clientAudit.fornitore_name ?? ''
    };
    await query(`
        UPDATE audits SET audit_extra_data = @audit_extra_data, updated_at = GETDATE()
        WHERE audit_id = @audit_id
    `, { audit_id: auditId, audit_extra_data: JSON.stringify(extraData) });

    // Insert audit_standards (multi-standard support)
    const standardIds = clientAudit.standardIds || [clientAudit.standardId || 1]; // Retrocompatibilità
    const primaryStandardId = standardIds[0]; // Primo standard = primario

    for (let i = 0; i < standardIds.length; i++) {
        await query(`
            INSERT INTO audit_standards (audit_id, standard_id, is_primary)
            VALUES (@audit_id, @standard_id, @is_primary)
        `, {
            audit_id: auditId,
            standard_id: standardIds[i],
            is_primary: i === 0 ? 1 : 0 // Solo il primo è primario
        });
    }

    return {
        audit_id: auditId,
        audit_uuid: clientAudit.id,
        audit_number,
    };
}

/**
 * Helper: Aggiorna audit da sync
 */
async function updateAuditFromSync(auditId, clientAudit) {
    // Leggi audit_extra_data esistente per merge
    const current = await query(`
        SELECT audit_extra_data FROM audits WHERE audit_id = @audit_id
    `, { audit_id: auditId });
    let extraData = {};
    if (current.recordset[0]?.audit_extra_data) {
        const raw = current.recordset[0].audit_extra_data;
        try {
            extraData = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        } catch (_) {
            extraData = {};
        }
    }
    if (clientAudit.auditPartyType !== undefined || clientAudit.audit_party_type !== undefined) {
        extraData.auditPartyType = clientAudit.auditPartyType ?? clientAudit.audit_party_type ?? 'first_party';
    }
    if (clientAudit.fornitoreName !== undefined || clientAudit.fornitore_name !== undefined) {
        extraData.fornitoreName = clientAudit.fornitoreName ?? clientAudit.fornitore_name ?? '';
    }

    const dateRange = validateAuditDateRange(
        clientAudit.auditDate,
        clientAudit.auditDateEnd ?? clientAudit.audit_date_end
    );
    if (!dateRange.valid) {
        throw new Error(dateRange.error);
    }

    // Update audit base fields + audit_extra_data
    await query(`
    UPDATE audits
    SET
      client_name = @client_name,
      audit_date = @audit_date,
      audit_date_end = @audit_date_end,
      auditor_name = @auditor_name,
      status = @status,
      notes = @notes,
      audit_extra_data = @audit_extra_data,
      updated_at = GETDATE()
    WHERE audit_id = @audit_id
  `, {
        audit_id: auditId,
        client_name: clientAudit.clientName,
        audit_date: dateRange.audit_date,
        audit_date_end: dateRange.audit_date_end,
        auditor_name: clientAudit.auditorName,
        status: clientAudit.status,
        notes: clientAudit.notes,
        audit_extra_data: JSON.stringify(extraData)
    });

    // Update audit_standards se presenti nel payload
    if (clientAudit.standardIds && Array.isArray(clientAudit.standardIds)) {
        // Remove existing standards
        await query(`DELETE FROM audit_standards WHERE audit_id = @audit_id`, { audit_id: auditId });

        // Insert new standards
        const standardIds = clientAudit.standardIds;
        for (let i = 0; i < standardIds.length; i++) {
            await query(`
                INSERT INTO audit_standards (audit_id, standard_id, is_primary)
                VALUES (@audit_id, @standard_id, @is_primary)
            `, {
                audit_id: auditId,
                standard_id: standardIds[i],
                is_primary: i === 0 ? 1 : 0
            });
        }
    }

    return { audit_id: auditId, updated: true };
}

/**
 * Helper: Ottieni audit by ID
 */
async function getAuditById(auditId) {
    const result = await query(`
    SELECT * FROM vw_audit_dashboard
    WHERE audit_id = @audit_id
  `, { audit_id: auditId });

    return result.recordset[0];
}

module.exports = {
    syncAudits,
    updateSyncMetadata
};
