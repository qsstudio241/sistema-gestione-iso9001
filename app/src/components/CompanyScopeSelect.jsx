/**
 * Selettore Ambito unico (header). Unico punto in cui l'utente cambia azienda.
 */

import React from "react";
import { useCompanyScope } from "../contexts/CompanyScopeContext";

export default function CompanyScopeSelect() {
  const { companyId, setCompanyId, companies, locked, companyScoped, scopeCompanyName } =
    useCompanyScope();

  if (locked) {
    return (
      <div className="layout-scope" title="Ambito fissato sulla tua azienda">
        <span className="layout-scope-label">{"Ambito"}</span>
        <span className="layout-scope-locked" aria-label="Ambito azienda non modificabile">
          {scopeCompanyName}
        </span>
      </div>
    );
  }

  if (!companies.length && !companyScoped) {
    return null;
  }

  const options = companies;

  return (
    <label className="layout-scope">
      <span className="layout-scope-label">{"Ambito"}</span>
      <select
        className="layout-scope-select"
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
        aria-label="Ambito azienda"
      >
        {!companyScoped && <option value="">{"Tutto lo studio"}</option>}
        {options.map((c) => {
          const id = c.id || c.company_id;
          return (
            <option key={id} value={String(id)}>
              {c.name}
            </option>
          );
        })}
      </select>
    </label>
  );
}
