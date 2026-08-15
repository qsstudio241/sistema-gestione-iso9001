/**
 * Ambito azienda unico per tutta l'app (header).
 * Una chiave localStorage namespaced per organization_id.
 * I selettori di pagina non devono piu' avere una memoria propria.
 */

import { getPrimaryCompanyId, hasCompanyAccess } from "./companyAccess";

export const APP_COMPANY_SCOPE_KEY = "sgq-app-company-scope";

/**
 * Chiavi Ambito di pagina pre-unificazione (PR #401).
 * Se l'utente aveva già un'azienda salvata su una pagina, la si ripristina
 * una volta nella chiave globale — non si perde il contesto operativo.
 */
export const LEGACY_PAGE_SCOPE_KEYS = [
  "sgq-qualifications-company-scope",
  "sgq-projects-company-scope",
  "sgq-sal-company-scope",
  "sgq-management-review-company-scope",
  "sgq-doc-registry-company-scope",
];

/** "" = Tutto lo studio (solo personale studio, non clienti azienda). */
export const STUDIO_WIDE_SCOPE = "";

/** Voce fissa nel menu Ambito (personale studio). Non è il nome anagrafica. */
export const STUDIO_PATRIMONIO_LABEL = "Patrimonio dello studio";

/**
 * Valore Ambito del Patrimonio: sempre `studio`, mai l'id dell'azienda omonima.
 * Così l'albero documentale dello studio (content_scope=studio) resta distinto
 * da quello ISO/cliente (es. QS Studio id=48 su Camellini).
 */
export const STUDIO_PATRIMONIO_SCOPE = "studio";

export function isStudioPatrimonioScope(companyId) {
  return String(companyId || "") === STUDIO_PATRIMONIO_SCOPE;
}

function normalizeOrgName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");
}

/** Al.project (L) e Ai.project (i) sono lo stesso studio: in molti font coincidono. */
function studioNameCandidates(organizationName) {
  const raw = String(organizationName || "").trim();
  if (!raw) return [];
  const names = [raw];
  if (/^al\.project$/i.test(raw)) names.push("Ai.project", "AI.project");
  if (/^ai\.project$/i.test(raw)) names.push("Al.project");
  return names;
}

/**
 * Azienda-studio già in anagrafica, se il nome coincide col tenant.
 * Non crea nulla. Se manca la riga, Patrimonio usa comunque il valore `studio`.
 */
export function findStudioCompany(companies, organizationName) {
  const needles = new Set(studioNameCandidates(organizationName).map(normalizeOrgName).filter(Boolean));
  if (needles.size === 0) return null;
  const list = Array.isArray(companies) ? companies : [];
  return list.find((c) => needles.has(normalizeOrgName(c.name))) || null;
}

/**
 * Valore della voce Patrimonio: sempre `studio`.
 * L'azienda omonima al tenant (se esiste) resta in anagrafica ma non è l'albero studio.
 */
export function resolvePatrimonioScopeValue(_companies, _organizationName) {
  return STUDIO_PATRIMONIO_SCOPE;
}

/**
 * Menu Ambito per il personale studio: Patrimonio (se trovata) + altre aziende A→Z.
 * L'azienda-studio esce dalla lista alfabetica.
 */
export function partitionScopeCompanies(companies, organizationName) {
  const list = Array.isArray(companies) ? companies : [];
  const studio = findStudioCompany(list, organizationName);
  const studioId = studio ? String(studio.id || studio.company_id) : null;
  const others = list
    .filter((c) => String(c.id || c.company_id) !== studioId)
    .slice()
    .sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "it", { sensitivity: "base" })
    );
  return { studio, others };
}

function companyToOption(c) {
  return {
    value: String(c.id || c.company_id),
    label: String(c.name || ""),
  };
}

/**
 * Voci del menu Ambito, nello stesso ordine della tendina.
 * Personale studio: Tutto + Patrimonio + altre A→Z.
 * Utente company_access: solo le sue aziende (niente Tutto/Patrimonio).
 */
export function buildScopeMenuOptions(companies, organizationName, { canSeeAllCompanies } = {}) {
  const list = Array.isArray(companies) ? companies : [];
  if (!canSeeAllCompanies) {
    return partitionScopeCompanies(list, "").others.map(companyToOption);
  }
  const { others } = partitionScopeCompanies(list, organizationName);
  return [
    { value: STUDIO_WIDE_SCOPE, label: "Tutto lo studio" },
    {
      value: resolvePatrimonioScopeValue(list, organizationName),
      label: STUDIO_PATRIMONIO_LABEL,
    },
    ...others.map(companyToOption),
  ];
}

/**
 * Voce selezionata nel combobox.
 * `studio` e l'id azienda-studio sono lo stesso Patrimonio: non cadere su Tutto.
 */
export function findSelectedScopeOption(options, companyId) {
  const list = Array.isArray(options) ? options : [];
  const id = String(companyId ?? "");
  const exact = list.find((o) => o.value === id);
  if (exact) return exact;
  if (isStudioPatrimonioScope(id)) {
    return list.find((o) => o.label === STUDIO_PATRIMONIO_LABEL) || list[0] || null;
  }
  return list[0] || null;
}

/** Filtro digitazione: case-insensitive, il testo deve comparire nell'etichetta. */
export function filterScopeMenuOptions(options, query) {
  const list = Array.isArray(options) ? options : [];
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return list;
  return list.filter((o) => String(o.label || "").toLowerCase().includes(q));
}

export function isCompanyScopedUser(user) {
  return hasCompanyAccess(user);
}

/** true se l'utente ha esattamente una azienda: selettore bloccato. */
export function isCompanyScopeLocked(user) {
  return isCompanyScopedUser(user) && (user.company_access || []).length === 1;
}

export function getAllowedCompanyIds(user) {
  if (!isCompanyScopedUser(user)) return null;
  return (user.company_access || [])
    .map((a) => (a?.company_id != null ? String(a.company_id) : null))
    .filter(Boolean);
}

function readRawStore() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(APP_COMPANY_SCOPE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Id numerico dalla prima chiave Ambito di pagina ancora valorizzata. */
function readLegacyPageCompanyScope() {
  if (typeof window === "undefined") return STUDIO_WIDE_SCOPE;
  for (const key of LEGACY_PAGE_SCOPE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null || raw === "" || raw === "studio") continue;
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return String(n);
    } catch {
      /* ignore */
    }
  }
  return STUDIO_WIDE_SCOPE;
}

/**
 * @returns {string} id azienda oppure ""
 */
export function readStoredAppCompanyScope(organizationId) {
  const parsed = readRawStore();
  if (!parsed) {
    const migrated = readLegacyPageCompanyScope();
    if (migrated && organizationId != null) {
      persistAppCompanyScope(organizationId, migrated);
    }
    return migrated;
  }
  if (organizationId != null && String(parsed.organization_id) !== String(organizationId)) {
    return STUDIO_WIDE_SCOPE;
  }
  if (parsed.company_id == null || parsed.company_id === "") return STUDIO_WIDE_SCOPE;
  if (isStudioPatrimonioScope(parsed.company_id)) return STUDIO_PATRIMONIO_SCOPE;
  const n = parseInt(parsed.company_id, 10);
  return Number.isNaN(n) ? STUDIO_WIDE_SCOPE : String(n);
}

/**
 * @param {string|number|null|undefined} companyId  "" rimuove (tutto lo studio)
 */
export function persistAppCompanyScope(organizationId, companyId) {
  if (typeof window === "undefined") return;
  try {
    if (organizationId == null) {
      window.localStorage.removeItem(APP_COMPANY_SCOPE_KEY);
      return;
    }
    const value = {
      organization_id: organizationId,
      company_id: companyId == null || companyId === "" ? "" : String(companyId),
    };
    window.localStorage.setItem(APP_COMPANY_SCOPE_KEY, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Default all'ingresso + persistenza se ancora valida.
 *
 * - Cliente con 1 azienda: sempre quella, non modificabile.
 * - Cliente con 2+ aziende: ultima scelta se ancora permessa, altrimenti primaria. Mai "tutto lo studio".
 * - Personale studio (admin/auditor/viewer senza company_access): "" (tutto lo studio) se nessuna scelta salvata.
 *
 * @param {object|null} user
 * @param {string|null} [storedOverride]  se passato, non legge localStorage (test)
 * @returns {string}
 */
export function resolveAppCompanyScope(user, storedOverride) {
  if (!user) return STUDIO_WIDE_SCOPE;

  if (isCompanyScopeLocked(user)) {
    return String(user.company_access[0].company_id);
  }

  const stored =
    storedOverride !== undefined
      ? storedOverride == null
        ? STUDIO_WIDE_SCOPE
        : String(storedOverride)
      : readStoredAppCompanyScope(user.organization_id);

  if (isCompanyScopedUser(user)) {
    const allowed = getAllowedCompanyIds(user) || [];
    if (stored && allowed.includes(stored)) return stored;
    const primary = getPrimaryCompanyId(user);
    return primary != null ? String(primary) : STUDIO_WIDE_SCOPE;
  }

  return stored || STUDIO_WIDE_SCOPE;
}

/**
 * Dopo il load aziende: se l'id salvato non esiste piu', torna a tutto lo studio
 * (solo personale studio). I clienti azienda restano sul valore resolved.
 */
export function sanitizeScopeAgainstCompanies(user, companyId, companies) {
  if (!companyId) return STUDIO_WIDE_SCOPE;
  const id = String(companyId);
  if (isStudioPatrimonioScope(id) && !isCompanyScopedUser(user)) return STUDIO_PATRIMONIO_SCOPE;
  if (isCompanyScopedUser(user)) {
    const allowed = getAllowedCompanyIds(user) || [];
    if (allowed.includes(id)) return id;
    const primary = getPrimaryCompanyId(user);
    return primary != null ? String(primary) : STUDIO_WIDE_SCOPE;
  }
  const list = Array.isArray(companies) ? companies : [];
  // Personale studio: id dell'azienda omonima (es. QS Studio=48) → Patrimonio, non cliente.
  const studio = findStudioCompany(list, user?.organization_name);
  if (studio && String(studio.id || studio.company_id) === id) {
    return STUDIO_PATRIMONIO_SCOPE;
  }
  if (list.length === 0) return id;
  const ok = list.some((c) => String(c.id || c.company_id) === id);
  return ok ? id : STUDIO_WIDE_SCOPE;
}
