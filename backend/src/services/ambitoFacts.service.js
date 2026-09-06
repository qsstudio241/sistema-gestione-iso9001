/**
 * Snapshot fatti operativi per Ambito (Second Brain SB-1 / SB-4).
 * Zero LLM: solo conteggi SQL allineati alle card NC / Qualifiche / Scadenze.
 * companyId valorizzato → azienda; null → aggregati «Tutto lo studio» (SB-4).
 */

const { query } = require('../config/database');
const { RELEASED_STATUS_SQL_IN } = require('../constants/documentStatus');
const logger = require('../utils/logger');

const TOP_COMPANIES_LIMIT = 5;

/** Stessa regola di qualifications.controller EFFECTIVE_EXPIRY_SQL (semaforo card). */
const QUAL_SEMIANNUAL_SQL = `(
    LOWER(q.qualification_type) LIKE '%9606%'
    OR LOWER(q.qualification_type) LIKE '%patentino_saldatore%'
    OR LOWER(q.qualification_type) = '9606_1'
    OR LOWER(q.qualification_type) LIKE '%14732%'
    OR LOWER(q.qualification_type) LIKE '%qualifica_14732%'
)`;

const QUAL_EFFECTIVE_EXPIRY_SQL = `
    CASE
        WHEN ${QUAL_SEMIANNUAL_SQL} THEN
            CASE
                WHEN q.expiry_date IS NULL THEN q.next_confirmation_due
                WHEN q.next_confirmation_due IS NULL THEN q.expiry_date
                WHEN q.next_confirmation_due < q.expiry_date THEN q.next_confirmation_due
                ELSE q.expiry_date
            END
        ELSE q.expiry_date
    END
`;

function emptyNotReady() {
  return {
    ready: false,
    scope: null,
    reason: 'seleziona_azienda',
    companyId: null,
    companyName: null,
    counts: null,
    topCompanies: null,
    generatedAt: new Date().toISOString(),
  };
}

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function buildOrgParams(user) {
  const organizationId = user?.organization_id;
  const auditorOrgId = user?.auditor_org_id || null;
  const params = { organizationId };
  if (auditorOrgId) params.auditorOrgId = auditorOrgId;
  return { organizationId, auditorOrgId, params };
}

/** Filtro aziende dello studio (auditor_org) se presente sul user. */
function companyAuditorFilter(alias, auditorOrgId) {
  if (!auditorOrgId) return '';
  return ` AND ${alias}.auditor_org_id = @auditorOrgId`;
}

/**
 * Aggregati studio (companyId null): totali org + top aziende per urgenza.
 * Solo conteggi — niente testi/documenti cliente.
 */
async function loadStudioAggregates(user) {
  const { organizationId, auditorOrgId, params } = buildOrgParams(user);
  if (organizationId == null) {
    return emptyNotReady();
  }

  const audFilterNc = auditorOrgId
    ? ` AND EXISTS (
         SELECT 1 FROM companies c_aud
         WHERE c_aud.id = COALESCE(a.company_id, nc.company_id)
           AND c_aud.auditor_org_id = @auditorOrgId
       )`
    : '';
  const audFilterQual = companyAuditorFilter('c', auditorOrgId);
  const audFilterDoc = companyAuditorFilter('c', auditorOrgId);

  const [ncRes, qualRes, docRes, topNcRes, topQualRes, topDocRes] = await Promise.all([
    query(
      `SELECT SUM(CASE WHEN nc.status <> 'closed' THEN 1 ELSE 0 END) AS nc_open
       FROM non_conformities nc
       LEFT JOIN audits a ON nc.audit_id = a.audit_id
       WHERE COALESCE(a.organization_id, nc.organization_id) = @organizationId
         ${audFilterNc}`,
      params
    ),
    query(
      `SELECT SUM(CASE
            WHEN (${QUAL_EFFECTIVE_EXPIRY_SQL}) IS NOT NULL
             AND (${QUAL_EFFECTIVE_EXPIRY_SQL}) BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(day, 30, CAST(GETDATE() AS DATE))
             AND q.status NOT IN ('revocata','sospesa')
            THEN 1 ELSE 0 END) AS quals_expiring_30
       FROM qualifications q
       INNER JOIN companies c ON c.id = q.company_id
       WHERE q.organization_id = @organizationId
         ${audFilterQual}`,
      params
    ),
    query(
      `SELECT SUM(CASE
            WHEN dr.expiry_date IS NOT NULL
             AND dr.expiry_date BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
             AND dr.status IN ${RELEASED_STATUS_SQL_IN}
            THEN 1 ELSE 0 END) AS docs_expiring_30
       FROM document_registry dr
       INNER JOIN companies c ON c.id = dr.company_id
       WHERE dr.organization_id = @organizationId
         AND dr.doc_type <> 'folder'
         ${audFilterDoc}`,
      params
    ),
    query(
      `SELECT TOP ${TOP_COMPANIES_LIMIT}
          COALESCE(a.company_id, nc.company_id) AS company_id,
          MAX(c.name) AS company_name,
          SUM(CASE WHEN nc.status <> 'closed' THEN 1 ELSE 0 END) AS nc_open
       FROM non_conformities nc
       LEFT JOIN audits a ON nc.audit_id = a.audit_id
       LEFT JOIN companies c ON c.id = COALESCE(a.company_id, nc.company_id)
       WHERE COALESCE(a.organization_id, nc.organization_id) = @organizationId
         AND COALESCE(a.company_id, nc.company_id) IS NOT NULL
         ${audFilterNc}
       GROUP BY COALESCE(a.company_id, nc.company_id)
       HAVING SUM(CASE WHEN nc.status <> 'closed' THEN 1 ELSE 0 END) > 0
       ORDER BY nc_open DESC`,
      params
    ),
    query(
      `SELECT TOP ${TOP_COMPANIES_LIMIT}
          q.company_id,
          MAX(c.name) AS company_name,
          SUM(CASE
            WHEN (${QUAL_EFFECTIVE_EXPIRY_SQL}) IS NOT NULL
             AND (${QUAL_EFFECTIVE_EXPIRY_SQL}) BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(day, 30, CAST(GETDATE() AS DATE))
             AND q.status NOT IN ('revocata','sospesa')
            THEN 1 ELSE 0 END) AS quals_expiring_30
       FROM qualifications q
       INNER JOIN companies c ON c.id = q.company_id
       WHERE q.organization_id = @organizationId
         ${audFilterQual}
       GROUP BY q.company_id
       HAVING SUM(CASE
            WHEN (${QUAL_EFFECTIVE_EXPIRY_SQL}) IS NOT NULL
             AND (${QUAL_EFFECTIVE_EXPIRY_SQL}) BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(day, 30, CAST(GETDATE() AS DATE))
             AND q.status NOT IN ('revocata','sospesa')
            THEN 1 ELSE 0 END) > 0
       ORDER BY quals_expiring_30 DESC`,
      params
    ),
    query(
      `SELECT TOP ${TOP_COMPANIES_LIMIT}
          dr.company_id,
          MAX(c.name) AS company_name,
          SUM(CASE
            WHEN dr.expiry_date IS NOT NULL
             AND dr.expiry_date BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
             AND dr.status IN ${RELEASED_STATUS_SQL_IN}
            THEN 1 ELSE 0 END) AS docs_expiring_30
       FROM document_registry dr
       INNER JOIN companies c ON c.id = dr.company_id
       WHERE dr.organization_id = @organizationId
         AND dr.doc_type <> 'folder'
         ${audFilterDoc}
       GROUP BY dr.company_id
       HAVING SUM(CASE
            WHEN dr.expiry_date IS NOT NULL
             AND dr.expiry_date BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
             AND dr.status IN ${RELEASED_STATUS_SQL_IN}
            THEN 1 ELSE 0 END) > 0
       ORDER BY docs_expiring_30 DESC`,
      params
    ),
  ]);

  const ncOpen = Number((ncRes.recordset || [])[0]?.nc_open || 0);
  const qualsExpiring30 = Number((qualRes.recordset || [])[0]?.quals_expiring_30 || 0);
  const docsExpiring30 = Number((docRes.recordset || [])[0]?.docs_expiring_30 || 0);

  const byCompany = new Map();
  function upsert(row, field, sqlKey) {
    const id = toInt(row.company_id);
    if (id == null) return;
    const prev = byCompany.get(id) || {
      companyId: id,
      companyName: row.company_name || `Azienda #${id}`,
      ncOpen: 0,
      qualsExpiring30: 0,
      docsExpiring30: 0,
    };
    if (row.company_name) prev.companyName = row.company_name;
    prev[field] = Number(row[sqlKey] || 0);
    byCompany.set(id, prev);
  }

  for (const row of topNcRes.recordset || []) upsert(row, 'ncOpen', 'nc_open');
  for (const row of topQualRes.recordset || []) upsert(row, 'qualsExpiring30', 'quals_expiring_30');
  for (const row of topDocRes.recordset || []) upsert(row, 'docsExpiring30', 'docs_expiring_30');

  const topCompanies = Array.from(byCompany.values())
    .map((c) => ({
      ...c,
      urgencyTotal: c.ncOpen + c.qualsExpiring30 + c.docsExpiring30,
    }))
    .filter((c) => c.urgencyTotal > 0)
    .sort((a, b) => b.urgencyTotal - a.urgencyTotal || a.companyName.localeCompare(b.companyName))
    .slice(0, TOP_COMPANIES_LIMIT);

  return {
    ready: true,
    scope: 'studio',
    reason: null,
    companyId: null,
    companyName: null,
    counts: { ncOpen, qualsExpiring30, docsExpiring30 },
    topCompanies,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * @param {object} user - req.user
 * @param {number|string|null|undefined} companyId - già risolto da resolveAiCompanyScope
 */
async function loadAmbitoFacts(user, companyId) {
  const cid = toInt(companyId);
  if (cid == null) {
    try {
      return await loadStudioAggregates(user);
    } catch (err) {
      logger.warn('[AMBITO_FACTS] studio aggregates:', err.message);
      throw err;
    }
  }

  const organizationId = user?.organization_id;
  const auditorOrgId = user?.auditor_org_id || null;

  let companyName = null;
  try {
    const nameParams = { companyId: cid };
    let nameSql = 'SELECT name FROM companies WHERE id = @companyId';
    if (auditorOrgId) {
      nameSql += ' AND auditor_org_id = @auditorOrgId';
      nameParams.auditorOrgId = auditorOrgId;
    }
    const nameRes = await query(nameSql, nameParams);
    companyName = (nameRes.recordset || [])[0]?.name || null;
  } catch (err) {
    logger.warn('[AMBITO_FACTS] company name:', err.message);
  }

  const params = { companyId: cid, organizationId };

  const [ncRes, qualRes, docRes] = await Promise.all([
    query(
      `SELECT SUM(CASE WHEN nc.status <> 'closed' THEN 1 ELSE 0 END) AS nc_open
       FROM non_conformities nc
       LEFT JOIN audits a ON nc.audit_id = a.audit_id
       WHERE COALESCE(a.organization_id, nc.organization_id) = @organizationId
         AND COALESCE(a.company_id, nc.company_id) = @companyId`,
      params
    ),
    query(
      `SELECT SUM(CASE
            WHEN (${QUAL_EFFECTIVE_EXPIRY_SQL}) IS NOT NULL
             AND (${QUAL_EFFECTIVE_EXPIRY_SQL}) BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(day, 30, CAST(GETDATE() AS DATE))
             AND q.status NOT IN ('revocata','sospesa')
            THEN 1 ELSE 0 END) AS quals_expiring_30
       FROM qualifications q
       WHERE q.organization_id = @organizationId
         AND q.company_id = @companyId`,
      params
    ),
    query(
      `SELECT SUM(CASE
            WHEN dr.expiry_date IS NOT NULL
             AND dr.expiry_date BETWEEN CAST(GETDATE() AS DATE)
                 AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
             AND dr.status IN ${RELEASED_STATUS_SQL_IN}
            THEN 1 ELSE 0 END) AS docs_expiring_30
       FROM document_registry dr
       WHERE dr.organization_id = @organizationId
         AND dr.company_id = @companyId
         AND dr.doc_type <> 'folder'`,
      params
    ),
  ]);

  const ncOpen = Number((ncRes.recordset || [])[0]?.nc_open || 0);
  const qualsExpiring30 = Number((qualRes.recordset || [])[0]?.quals_expiring_30 || 0);
  const docsExpiring30 = Number((docRes.recordset || [])[0]?.docs_expiring_30 || 0);

  return {
    ready: true,
    scope: 'company',
    reason: null,
    companyId: cid,
    companyName,
    counts: { ncOpen, qualsExpiring30, docsExpiring30 },
    topCompanies: null,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Blocco testo da iniettare nel system prompt della chat (SB-3 / SB-4).
 * Zero inventiva: solo i conteggi già calcolati da loadAmbitoFacts.
 * @param {object|null|undefined} facts
 * @returns {string} vuoto se non ready
 */
function formatAmbitoFactsPromptBlock(facts) {
  if (!facts || facts.ready !== true || !facts.counts) return '';
  const c = facts.counts;

  if (facts.scope === 'studio' || facts.companyId == null) {
    const lines = [
      '',
      '',
      '--- FATTI STUDIO (aggregati SQL, non RAG clienti) ---',
      'Ambito: Tutto lo studio',
      `NC aperte (totale studio): ${Number(c.ncOpen) || 0}`,
      `Qualifiche in scadenza entro 30 giorni (totale): ${Number(c.qualsExpiring30) || 0}`,
      `Documenti in scadenza entro 30 giorni (totale): ${Number(c.docsExpiring30) || 0}`,
    ];
    const top = Array.isArray(facts.topCompanies) ? facts.topCompanies : [];
    if (top.length > 0) {
      lines.push('Top aziende per urgenza (solo conteggi):');
      for (const row of top) {
        lines.push(
          `- ${row.companyName || `Azienda #${row.companyId}`}: NC=${Number(row.ncOpen) || 0}, Qual=${Number(row.qualsExpiring30) || 0}, Doc=${Number(row.docsExpiring30) || 0}`
        );
      }
    }
    lines.push(
      'Usa ESCLUSIVAMENTE questi aggregati. Non mescolare testi o documenti di clienti diversi.',
      'Non inventare dettagli per-azienda oltre i conteggi. Per analisi di un cliente l\'utente deve selezionare l\'Ambito azienda.',
      '--- FINE FATTI STUDIO ---'
    );
    return lines.join('\n');
  }

  const name = facts.companyName || `Azienda #${facts.companyId}`;
  const lines = [
    '',
    '',
    '--- FATTI AMBITO (SQL vivo, non RAG) ---',
    `Azienda attiva: ${name} (company_id=${facts.companyId})`,
    `NC aperte: ${Number(c.ncOpen) || 0}`,
    `Qualifiche in scadenza entro 30 giorni: ${Number(c.qualsExpiring30) || 0}`,
    `Documenti in scadenza entro 30 giorni: ${Number(c.docsExpiring30) || 0}`,
    'Usa ESCLUSIVAMENTE questi numeri per conteggi su NC / qualifiche / documenti di questa azienda.',
    'Non mescolare dati di altre aziende. Se la domanda non riguarda questi fatti, ignora il blocco.',
    '--- FINE FATTI AMBITO ---',
  ];
  return lines.join('\n');
}

module.exports = {
  loadAmbitoFacts,
  loadStudioAggregates,
  emptyNotReady,
  formatAmbitoFactsPromptBlock,
  TOP_COMPANIES_LIMIT,
};
