/**
 * Contesto Ambito azienda unico (header AppLayout).
 * Le pagine leggono companyId e non mostrano un secondo selettore.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import apiService from "../services/apiService";
import {
  isCompanyScopeLocked,
  isCompanyScopedUser,
  persistAppCompanyScope,
  resolveAppCompanyScope,
  sanitizeScopeAgainstCompanies,
  STUDIO_WIDE_SCOPE,
} from "../utils/appCompanyScope";

const CompanyScopeContext = createContext(null);

const TEST_FALLBACK_SCOPE = Object.freeze({
  companyId: "",
  setCompanyId: () => {},
  companies: [],
  locked: false,
  companyScoped: false,
  isStudioWide: true,
  scopeCompanyName: "Tutto lo studio",
});

export function useCompanyScope() {
  const ctx = useContext(CompanyScopeContext);
  if (!ctx) {
    if (process.env.NODE_ENV === "test") return TEST_FALLBACK_SCOPE;
    throw new Error("useCompanyScope deve essere usato dentro CompanyScopeProvider");
  }
  return ctx;
}

export function CompanyScopeProvider({ children, initialCompanyId }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyIdState] = useState(() =>
    initialCompanyId !== undefined ? String(initialCompanyId) : resolveAppCompanyScope(user)
  );

  useEffect(() => {
    if (initialCompanyId !== undefined) {
      setCompanyIdState(String(initialCompanyId));
      return;
    }
    setCompanyIdState(resolveAppCompanyScope(user));
  }, [user?.id, user?.organization_id, user?.company_access, initialCompanyId]);

  useEffect(() => {
    let cancelled = false;
    apiService
      .getCompanies({ limit: 500 })
      .then((res) => {
        if (cancelled) return;
        const list = res?.data || [];
        setCompanies(list);
        setCompanyIdState((prev) => {
          const next = sanitizeScopeAgainstCompanies(user, prev, list);
          if (next !== prev) persistAppCompanyScope(user?.organization_id, next);
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setCompanies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id]);

  const locked = isCompanyScopeLocked(user);
  const companyScoped = isCompanyScopedUser(user);

  const setCompanyId = useCallback(
    (value) => {
      if (locked) return;
      let next = value == null ? STUDIO_WIDE_SCOPE : String(value);
      if (companyScoped && !next) return;
      setCompanyIdState(next);
      persistAppCompanyScope(user?.organization_id, next);
    },
    [locked, companyScoped, user?.organization_id]
  );

  const scopeCompanyName = useMemo(() => {
    if (!companyId) return "Tutto lo studio";
    const match = companies.find((c) => String(c.id || c.company_id) === String(companyId));
    return match?.name || `Azienda #${companyId}`;
  }, [companyId, companies]);

  const value = useMemo(
    () => ({
      companyId,
      setCompanyId,
      companies,
      locked,
      companyScoped,
      isStudioWide: !companyId,
      scopeCompanyName,
    }),
    [companyId, setCompanyId, companies, locked, companyScoped, scopeCompanyName]
  );

  return (
    <CompanyScopeContext.Provider value={value}>{children}</CompanyScopeContext.Provider>
  );
}
