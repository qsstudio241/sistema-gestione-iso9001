/**
 * Contesto Ambito azienda unico (header AppLayout).
 * Le pagine leggono companyId e non mostrano un secondo selettore.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import apiService from "../services/apiService";
import {
  findStudioCompany,
  getAllowedCompanyIds,
  isCompanyScopeLocked,
  isCompanyScopedUser,
  isStudioPatrimonioScope,
  persistAppCompanyScope,
  resolveAppCompanyScope,
  sanitizeScopeAgainstCompanies,
  STUDIO_PATRIMONIO_LABEL,
  STUDIO_PATRIMONIO_SCOPE,
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
  isStudioPatrimonio: false,
  scopeReady: true,
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
  const [scopeReady, setScopeReady] = useState(
    () => initialCompanyId !== undefined || isCompanyScopedUser(user)
  );

  useEffect(() => {
    if (initialCompanyId !== undefined) {
      setCompanyIdState(String(initialCompanyId));
      setScopeReady(true);
      return;
    }
    setCompanyIdState(resolveAppCompanyScope(user));
    if (isCompanyScopedUser(user)) setScopeReady(true);
  }, [user?.id, user?.organization_id, user?.company_access, initialCompanyId]);

  useEffect(() => {
    let cancelled = false;
    if (initialCompanyId === undefined && !isCompanyScopedUser(user)) {
      setScopeReady(false);
    }
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
        setScopeReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setCompanies([]);
          setScopeReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id, initialCompanyId]);

  const locked = isCompanyScopeLocked(user);
  const companyScoped = isCompanyScopedUser(user);

  const setCompanyId = useCallback(
    (value) => {
      if (locked) return;
      let next = value == null ? STUDIO_WIDE_SCOPE : String(value);
      if (companyScoped && !next) return;
      if (companyScoped) {
        const allowed = getAllowedCompanyIds(user) || [];
        if (next && !allowed.includes(next)) return;
      } else if (next && companies.length) {
        const studio = findStudioCompany(companies, user?.organization_name);
        if (studio && String(studio.id || studio.company_id) === next) {
          next = STUDIO_PATRIMONIO_SCOPE;
        }
      }
      setCompanyIdState(next);
      persistAppCompanyScope(user?.organization_id, next);
    },
    [locked, companyScoped, user, companies]
  );

  const isStudioPatrimonio = useMemo(() => {
    if (companyScoped || !companyId) return false;
    if (isStudioPatrimonioScope(companyId)) return true;
    const studio = findStudioCompany(companies, user?.organization_name);
    return Boolean(studio && String(studio.id || studio.company_id) === String(companyId));
  }, [companyId, companies, companyScoped, user?.organization_name]);

  const scopeCompanyName = useMemo(() => {
    if (!companyId) return "Tutto lo studio";
    if (isStudioPatrimonio) return STUDIO_PATRIMONIO_LABEL;
    const match = companies.find((c) => String(c.id || c.company_id) === String(companyId));
    return match?.name || `Azienda #${companyId}`;
  }, [companyId, companies, isStudioPatrimonio]);

  const value = useMemo(
    () => ({
      companyId,
      setCompanyId,
      companies,
      locked,
      companyScoped,
      isStudioWide: !companyId,
      isStudioPatrimonio,
      scopeReady,
      scopeCompanyName,
    }),
    [companyId, setCompanyId, companies, locked, companyScoped, isStudioPatrimonio, scopeReady, scopeCompanyName]
  );

  return (
    <CompanyScopeContext.Provider value={value}>{children}</CompanyScopeContext.Provider>
  );
}
