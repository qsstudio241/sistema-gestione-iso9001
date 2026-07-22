/**
 * Ambito documento derivato dal selettore condiviso del Registro (Priorità / Catalogo / Albero).
 * Quando l'utente ha scelto un'azienda o Patrimonio Studio, la modale non deve chiedere di nuovo ambito/azienda.
 */

/**
 * @param {{ registryCompanyScope: string, isStudioScope: boolean, companies: Array<{id?: number, company_id?: number, name?: string}> }} opts
 * @returns {{ locked: boolean, content_scope?: string, company_id?: number|null, label?: string }}
 */
export function resolveRegistryFormContextScope({
  registryCompanyScope,
  isStudioScope,
  companies = [],
}) {
  if (isStudioScope) {
    return {
      locked: true,
      content_scope: "studio",
      company_id: null,
      label: "Patrimonio Studio",
    };
  }

  if (registryCompanyScope) {
    const match = companies.find(
      (c) => String(c.id || c.company_id) === String(registryCompanyScope)
    );
    const companyId = parseInt(registryCompanyScope, 10);
    return {
      locked: true,
      content_scope: "client",
      company_id: Number.isNaN(companyId) ? null : companyId,
      label: match?.name || `Azienda #${registryCompanyScope}`,
    };
  }

  return { locked: false };
}
