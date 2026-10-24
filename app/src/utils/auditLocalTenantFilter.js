/**
 * Isolamento multi-tenant per bozze / cache audit in IndexedDB.
 * Pattern allineato a useNdtAutoSave (organization_id + nascondi legacy senza org).
 */

/**
 * @param {string|number|null|undefined} explicitOrgId
 * @param {{ organization_id?: string|number|null }|null|undefined} [user]
 * @returns {string|number|null}
 */
export function resolveAuditOrganizationId(explicitOrgId, user) {
  if (explicitOrgId != null && explicitOrgId !== '') return explicitOrgId;
  if (user?.organization_id != null && user.organization_id !== '') {
    return user.organization_id;
  }
  return null;
}

/**
 * organization_id salvato sull'audit locale (metadata o root).
 * @param {object|null|undefined} audit
 * @returns {string|number|null}
 */
export function getAuditOrganizationId(audit) {
  if (audit == null) return null;
  const fromMeta =
    audit.metadata?.organizationId ??
    audit.metadata?.organization_id ??
    null;
  if (fromMeta != null && fromMeta !== '') return fromMeta;
  const fromRoot = audit.organization_id ?? audit.organizationId ?? null;
  if (fromRoot != null && fromRoot !== '') return fromRoot;
  return null;
}

/**
 * True se l'audit appartiene allo studio corrente.
 * Legacy senza organization_id: escluso quando currentOrgId è noto (no leak).
 *
 * @param {object|null|undefined} audit
 * @param {string|number|null|undefined} currentOrgId
 */
export function auditMatchesOrganization(audit, currentOrgId) {
  if (currentOrgId == null || currentOrgId === '') return false;
  const oid = getAuditOrganizationId(audit);
  if (oid == null || oid === '') return false;
  return String(oid) === String(currentOrgId);
}

/**
 * Filtra lista audit locali per studio corrente.
 * @param {Array} audits
 * @param {string|number|null|undefined} currentOrgId
 */
export function filterAuditsByOrganization(audits, currentOrgId) {
  if (!Array.isArray(audits)) return [];
  return audits.filter((a) => auditMatchesOrganization(a, currentOrgId));
}

function auditRowId(audit) {
  const id = audit?.metadata?.id || audit?.id;
  return id == null || id === '' ? null : String(id);
}

function idInSet(id, ids) {
  if (id == null) return false;
  const want = String(id).toLowerCase();
  return ids.some((item) => item != null && String(item).toLowerCase() === want);
}

/**
 * Copia locale da riaprire offline.
 * Stesso studio: sì. Studio diverso: no.
 * Riga senza studio (la lista server non lo scrive): solo se questo dispositivo l'ha aperta.
 * @param {Array} localAudits
 * @param {string|number|null|undefined} organizationId
 * @param {Array<string>} [recentIds]
 * @param {string|null|undefined} [rememberedId]
 */
export function selectAuditsForOfflineReopen(localAudits, organizationId, recentIds = [], rememberedId = null) {
  const list = Array.isArray(localAudits) ? localAudits : [];
  const openedHere = [...(Array.isArray(recentIds) ? recentIds : [])];
  if (rememberedId != null && rememberedId !== '') openedHere.push(rememberedId);
  const orgKnown = organizationId != null && organizationId !== '';
  return list
    .filter((audit) => {
      const oid = getAuditOrganizationId(audit);
      const rowId = auditRowId(audit);
      if (orgKnown && oid != null && oid !== '') {
        return String(oid) === String(organizationId);
      }
      if (oid != null && oid !== '') return false;
      return idInSet(rowId, openedHere);
    })
    .map((audit) => stampMissingOrganization(audit, organizationId));
}

/**
 * La GET /audits non manda organization_id: senza questo timbro il filtro offline svuota la lista.
 * @param {object|null|undefined} audit
 * @param {string|number|null|undefined} organizationId
 */
export function stampMissingOrganization(audit, organizationId) {
  if (!audit || organizationId == null || organizationId === '') return audit;
  if (getAuditOrganizationId(audit) != null) return audit;
  return {
    ...audit,
    metadata: { ...(audit.metadata || {}), organizationId },
  };
}
