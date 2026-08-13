import React from "react";
import { CompanyScopeProvider } from "../../contexts/CompanyScopeContext";

/** Wrappa una pagina con l'Ambito globale (test L1). */
export function withCompanyScope(ui, initialCompanyId = "") {
  return (
    <CompanyScopeProvider initialCompanyId={initialCompanyId}>
      {ui}
    </CompanyScopeProvider>
  );
}
