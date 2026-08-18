/**
 * LicensedRoute — Sprint 8: mostra il modulo solo se licenziato per l'organizzazione
 */

import React from "react";
import { useAuth } from "../contexts/AuthContext";
import ModuleLocked from "./ModuleLocked";
import { hasLicensedModule } from "../utils/licenseUtils";

export default function LicensedRoute({ moduleKey, isAllowed, children }) {
  const { user } = useAuth();
  const allowed = typeof isAllowed === "function"
    ? isAllowed(user)
    : hasLicensedModule(user, moduleKey);

  if (allowed) return children;
  return <ModuleLocked module={moduleKey} lockedByLicense />;
}
