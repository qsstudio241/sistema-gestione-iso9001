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

    // Documenti scaduti o in scadenza nei prossimi DEFAULT_ALERT_DAYS giorni
    const docResult = await pool.request()
      .input('orgId', orgId)
      .input('days', DEFAULT_ALERT_DAYS)
      .query(`
        SELECT COUNT(*) AS cnt
        FROM document_registry
        WHERE organization_id = @orgId
          AND status NOT IN ('obsoleto')
          AND expiry_date IS NOT NULL
          AND expiry_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
      `);

    // NC aperte da più di 30 giorni (se la tabella esiste)
    let ncCount = 0;
    try {
      const ncResult = await pool.request()
        .input('orgId', orgId)
        .query(`
          SELECT COUNT(*) AS cnt
          FROM non_conformities
          WHERE organization_id = @orgId
            AND status NOT IN ('chiusa', 'annullata')
            AND DATEDIFF(day, created_at, GETDATE()) > 30
        `);
      ncCount = ncResult.recordset[0]?.cnt || 0;
    } catch {
      // La tabella NC potrebbe non avere la struttura attesa — non bloccante
    }

    const docCount = docResult.recordset[0]?.cnt || 0;

    // Qualifiche scadute o in scadenza entro 30 giorni (Sprint 4)
    let qualifCount = 0;
    try {
      const qualifResult = await pool.request()
        .input('orgId', orgId)
        .query(`
          SELECT COUNT(*) AS cnt
          FROM qualifications
          WHERE organization_id = @orgId
            AND status NOT IN ('revocata','sospesa')
            AND expiry_date IS NOT NULL
            AND expiry_date <= DATEADD(day, 30, CAST(GETDATE() AS DATE))
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

    const docResult = await pool.request()
      .input('orgId', orgId)
      .input('days', days)
      .query(`
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
          DATEDIFF(day, CAST(GETDATE() AS DATE), dr.expiry_date) AS days_remaining
        FROM document_registry dr
        LEFT JOIN companies c ON dr.company_id = c.id
        WHERE dr.organization_id = @orgId
          AND dr.status NOT IN ('obsoleto')
          AND dr.expiry_date IS NOT NULL
          AND dr.expiry_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
        ORDER BY dr.expiry_date ASC
      `);

    res.json({
      alerts: docResult.recordset || [],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAlertCount, getAlerts };
