/**
 * LicensedRoute — Sprint 8: mostra il modulo solo se licenziato per l'organizzazione
 */

import React from "react";
import { useAuth } from "../contexts/AuthContext";
import ModuleLocked from "./ModuleLocked";

export default function LicensedRoute({ moduleKey, children }) {
  const { user } = useAuth();
  const list = user?.licensed_modules;
  const allowed =
    !list || !Array.isArray(list) || list.length === 0 || list.includes(moduleKey);

  if (allowed) return children;
  return <ModuleLocked module={moduleKey} lockedByLicense />;
}
