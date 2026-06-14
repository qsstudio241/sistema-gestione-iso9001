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
const { effectiveAlertDue } = require('../services/qualificationAlert.service');
// Giorni default per alert scadenza documenti
const DEFAULT_ALERT_DAYS = 30;

/** Espressione SQL: data guida qualifica (min tra expiry e conferma 9606). */
const SQL_QUAL_EFFECTIVE_DUE = `
  CASE
    WHEN q.qualification_type LIKE '%9606%'
         AND q.next_confirmation_due IS NOT NULL
         AND (q.expiry_date IS NULL OR q.next_confirmation_due < q.expiry_date)
    THEN q.next_confirmation_due
    ELSE q.expiry_date
  END
`;

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
    const qualifFilter = companyAccessSqlFilter(accessList, 'qualifications',    'company_id', 'uca_q');

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
          AND nc.status NOT IN ('closed', 'verified')
          AND DATEDIFF(day, nc.created_at, GETDATE()) > 30
          ${ncFilter.clause ? `AND ${ncFilter.clause}` : ''}
      `);
      ncCount = ncResult.recordset[0]?.cnt || 0;
    } catch {
      // Non bloccante
    }

    const docCount = docResult.recordset[0]?.cnt || 0;

    let qualifCount = 0;
    try {
      const qualifReq = pool.request().input('orgId', orgId);
      Object.entries(qualifFilter.params).forEach(([k, v]) => qualifReq.input(k, v));
      const qualifResult = await qualifReq.query(`
        SELECT COUNT(*) AS cnt
        FROM qualifications q
        WHERE q.organization_id = @orgId
          AND q.status NOT IN ('revocata','sospesa')
          AND q.approval_status = 'approvata'
          AND (${SQL_QUAL_EFFECTIVE_DUE}) IS NOT NULL
          AND (${SQL_QUAL_EFFECTIVE_DUE}) <= DATEADD(day, 30, CAST(GETDATE() AS DATE))
          ${qualifFilter.clause ? `AND ${qualifFilter.clause}` : ''}
      `);
      qualifCount = qualifResult.recordset[0]?.cnt || 0;
    } catch {
      // Tabella qualifications non ancora creata — non bloccante
    }

    const total = docCount + ncCount + qualifCount;

    res.json({
      total,
      documents: docCount,
      nc: ncCount,
      qualifications: qualifCount,
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
          (${SQL_QUAL_EFFECTIVE_DUE}) AS effective_due,
          CASE
            WHEN (${SQL_QUAL_EFFECTIVE_DUE}) < CAST(GETDATE() AS DATE) THEN 'expired'
            ELSE 'expiring'
          END AS alert_type,
          DATEDIFF(day, CAST(GETDATE() AS DATE), (${SQL_QUAL_EFFECTIVE_DUE})) AS days_remaining
        FROM qualifications q
        LEFT JOIN companies c ON q.company_id = c.id
        WHERE q.organization_id = @orgId
          AND q.status NOT IN ('revocata','sospesa')
          AND q.approval_status = 'approvata'
          AND (${SQL_QUAL_EFFECTIVE_DUE}) IS NOT NULL
          AND (${SQL_QUAL_EFFECTIVE_DUE}) <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
          ${qualFilter.clause ? `AND ${qualFilter.clause}` : ''}
        ORDER BY (${SQL_QUAL_EFFECTIVE_DUE}) ASC
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
