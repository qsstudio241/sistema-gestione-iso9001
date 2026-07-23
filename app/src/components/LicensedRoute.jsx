/**
 * LicensedRoute — Sprint 8: mostra il modulo solo se licenziato per l'organizzazione
 */

import React from "react";
import { useAuth } from "../contexts/AuthContext";
import ModuleLocked from "./ModuleLocked";
import { hasLicensedModule } from "../utils/licenseUtils";

export default function LicensedRoute({ moduleKey, children }) {
  const { user } = useAuth();
  const allowed = hasLicensedModule(user, moduleKey);

  if (allowed) return children;
  return <ModuleLocked module={moduleKey} lockedByLicense />;
}
