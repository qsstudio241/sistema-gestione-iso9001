/**
 * alert.controller.js — Alert Engine
 * Gestisce il conteggio e la lista degli alert urgenti per la sidebar badge
 * e per la pagina Home.
 *
 * Alert attivi:
 * - Documenti scaduti (expiry_date < oggi, status != 'obsoleto')
 * - Documenti in scadenza entro N giorni (configurabile, default 30)
 * - NC aperte da più di 30 giorni
 */

const { getPool } = require('../config/database');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
} = require('../services/companyAccess.service');
const { EFFECTIVE_SQL, ACTIVE_STATUS_SQL, SITUAZIONE_BUCKET_SQL } = require('../services/qualificationExpirySql');
// Giorni default per alert scadenza documenti
const DEFAULT_ALERT_DAYS = 30;

/**
 * GET /alerts/count
 * Ritorna il conteggio totale di alert urgenti per l'organizzazione corrente.
 * Usato dal badge nella sidebar.
 */
async function getAlertCount(req, res) {
  try {
    const pool = await getPool();
    const orgId = req.user.organization_id;
    const accessList = await ensureCompanyAccessLoaded(req.user);

    // Filtro company_access per documenti e qualifiche
    const docFilter    = companyAccessSqlFilter(accessList, 'document_registry', 'company_id', 'uca_doc');
    const ncFilter     = companyAccessSqlFilter(accessList, 'a',                 'company_id', 'uca_nc');
    const qualifFilter = companyAccessSqlFilter(accessList, 'q',                'company_id', 'uca_q');

    const docReq = pool.request().input('orgId', orgId).input('days', DEFAULT_ALERT_DAYS);
    Object.entries(docFilter.params).forEach(([k, v]) => docReq.input(k, v));
    const docResult = await docReq.query(`
      SELECT COUNT(*) AS cnt
      FROM document_registry
      WHERE organization_id = @orgId
        AND status NOT IN ('obsoleto')
        AND expiry_date IS NOT NULL
        AND expiry_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
        ${docFilter.clause ? `AND ${docFilter.clause}` : ''}
    `);

    let ncCount = 0;
    try {
      const ncReq = pool.request().input('orgId', orgId);
      Object.entries(ncFilter.params).forEach(([k, v]) => ncReq.input(k, v));
      const ncResult = await ncReq.query(`
        SELECT COUNT(*) AS cnt
        FROM non_conformities nc
        INNER JOIN audits a ON nc.audit_id = a.audit_id
        WHERE a.organization_id = @orgId
          AND nc.deleted_at IS NULL
          AND nc.status NOT IN ('closed', 'verified')
          AND DATEDIFF(day, nc.created_at, GETDATE()) > 30
          ${ncFilter.clause ? `AND ${ncFilter.clause}` : ''}
      `);
      ncCount = ncResult.recordset[0]?.cnt || 0;
    } catch {
      // Non bloccante
    }

    const docCount = docResult.recordset[0]?.cnt || 0;

    // Stessi bucket delle card Qualifiche (Scadute + Urgenti 30gg): vedi qualificationExpirySql.
    let qualifExpired = 0;
    let qualifExpiring = 0;
    try {
      const qualifReq = pool.request().input('orgId', orgId);
      Object.entries(qualifFilter.params).forEach(([k, v]) => qualifReq.input(k, v));
      const qualifResult = await qualifReq.query(`
        SELECT
          COALESCE(SUM(CASE WHEN ${SITUAZIONE_BUCKET_SQL.scadute} THEN 1 ELSE 0 END), 0) AS expired,
          COALESCE(SUM(CASE WHEN ${SITUAZIONE_BUCKET_SQL.urgenti_30} THEN 1 ELSE 0 END), 0) AS expiring
        FROM qualifications q
        WHERE q.organization_id = @orgId
          AND q.deleted_at IS NULL
          ${qualifFilter.clause ? `AND ${qualifFilter.clause}` : ''}
      `);
      qualifExpired = qualifResult.recordset[0]?.expired || 0;
      qualifExpiring = qualifResult.recordset[0]?.expiring || 0;
    } catch {
      // Tabella qualifications non ancora creata — non bloccante
    }
    const qualifCount = qualifExpired + qualifExpiring;

    const total = docCount + ncCount + qualifCount;

    res.json({
      total,
      documents: docCount,
      nc: ncCount,
      qualifications: qualifCount,
      qualifications_expired: qualifExpired,
      qualifications_expiring: qualifExpiring,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /alerts
 * Ritorna la lista dettagliata degli alert urgenti.
 * Usato dalla HomePage dashboard.
 */
async function getAlerts(req, res) {
  try {
    const pool = await getPool();
    const orgId = req.user.organization_id;
    const days  = parseInt(req.query.days) || DEFAULT_ALERT_DAYS;
    const accessList = await ensureCompanyAccessLoaded(req.user);
    const docFilter  = companyAccessSqlFilter(accessList, 'dr', 'company_id', 'uca_adoc');

    const docReq = pool.request().input('orgId', orgId).input('days', days);
    Object.entries(docFilter.params).forEach(([k, v]) => docReq.input(k, v));
    const docResult = await docReq.query(`
        SELECT
          dr.id,
          dr.title,
          dr.doc_code,
          dr.doc_type,
          dr.status,
          dr.expiry_date,
          dr.responsible,
          c.name AS company_name,
          CASE
            WHEN dr.expiry_date < CAST(GETDATE() AS DATE) THEN 'expired'
            ELSE 'expiring'
          END AS alert_type,
          DATEDIFF(day, CAST(GETDATE() AS DATE), dr.expiry_date) AS days_remaining,
          'document' AS item_kind
        FROM document_registry dr
        LEFT JOIN companies c ON dr.company_id = c.id
        WHERE dr.organization_id = @orgId
          AND dr.status NOT IN ('obsoleto')
          AND dr.expiry_date IS NOT NULL
          AND dr.expiry_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
          ${docFilter.clause ? `AND ${docFilter.clause}` : ''}
        ORDER BY dr.expiry_date ASC
      `);

    const qualFilter = companyAccessSqlFilter(accessList, 'q', 'company_id', 'uca_qal');
    const qualReq = pool.request().input('orgId', orgId).input('days', days);
    Object.entries(qualFilter.params).forEach(([k, v]) => qualReq.input(k, v));

    let qualAlerts = [];
    try {
      const qualResult = await qualReq.query(`
        SELECT
          q.id,
          q.person_name AS title,
          q.certificate_number AS doc_code,
          q.qualification_type AS doc_type,
          q.status,
          q.expiry_date,
          q.next_confirmation_due,
          c.name AS company_name,
          ${EFFECTIVE_SQL} AS effective_due,
          CASE
            WHEN ${EFFECTIVE_SQL} < CAST(GETDATE() AS DATE) THEN 'expired'
            ELSE 'expiring'
          END AS alert_type,
          DATEDIFF(day, CAST(GETDATE() AS DATE), ${EFFECTIVE_SQL}) AS days_remaining
        FROM qualifications q
        LEFT JOIN companies c ON q.company_id = c.id
        WHERE q.organization_id = @orgId
          AND q.deleted_at IS NULL
          AND ${ACTIVE_STATUS_SQL}
          AND ${EFFECTIVE_SQL} IS NOT NULL
          AND ${EFFECTIVE_SQL} <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
          ${qualFilter.clause ? `AND ${qualFilter.clause}` : ''}
        ORDER BY ${EFFECTIVE_SQL} ASC
      `);
      qualAlerts = (qualResult.recordset || []).map((q) => ({
        id: q.id,
        title: `Qualifica: ${q.title}`,
        doc_code: q.doc_code,
        doc_type: q.doc_type,
        status: q.status,
        expiry_date: q.effective_due,
        company_name: q.company_name,
        alert_type: q.alert_type,
        days_remaining: q.days_remaining,
        item_kind: 'qualification',
        next_confirmation_due: q.next_confirmation_due,
      }));
    } catch {
      // Tabella/colonne assenti — non bloccante
    }

    const merged = [...(docResult.recordset || []), ...qualAlerts]
      .sort((a, b) => {
        const da = a.days_remaining ?? 9999;
        const db = b.days_remaining ?? 9999;
        return da - db;
      });

    res.json({
      alerts: merged,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAlertCount, getAlerts };
