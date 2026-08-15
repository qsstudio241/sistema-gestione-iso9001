/**
 * @vitest-environment jsdom
 *
 * Patrimonio: id omonimo in localStorage non deve restare visibile
 * dopo il load aziende (Camellini QS Studio=48 → studio).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CompanyScopeProvider, useCompanyScope } from "../contexts/CompanyScopeContext";
import { persistAppCompanyScope, APP_COMPANY_SCOPE_KEY } from "../utils/appCompanyScope";

const authState = {
  user: {
    id: 9,
    role: "admin",
    organization_id: 1002,
    organization_name: "QS_Studio",
    company_access: [],
  },
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

let companiesDeferred;
vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: () => companiesDeferred.promise,
  },
}));

function Probe() {
  const { companyId, isStudioPatrimonio, scopeReady, scopeCompanyName } = useCompanyScope();
  return (
    <div>
      <span data-testid="companyId">{companyId}</span>
      <span data-testid="ready">{scopeReady ? "1" : "0"}</span>
      <span data-testid="patrimonio">{isStudioPatrimonio ? "1" : "0"}</span>
      <span data-testid="name">{scopeCompanyName}</span>
    </div>
  );
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("CompanyScopeProvider — remap Patrimonio", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {},
      getItem(key) {
        return this.store[key] ?? null;
      },
      setItem(key, val) {
        this.store[key] = String(val);
      },
      removeItem(key) {
        delete this.store[key];
      },
    });
    companiesDeferred = deferred();
    persistAppCompanyScope(1002, "48");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prima delle aziende scopeReady e' false; poi 48 diventa studio", async () => {
    render(
      <CompanyScopeProvider>
        <Probe />
      </CompanyScopeProvider>
    );

    expect(screen.getByTestId("ready").textContent).toBe("0");
    expect(screen.getByTestId("companyId").textContent).toBe("48");
    expect(screen.getByTestId("patrimonio").textContent).toBe("0");

    companiesDeferred.resolve({
      data: [
        { id: 48, name: "QS Studio" },
        { id: 177, name: "BLOWPACK" },
      ],
    });

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("1");
      expect(screen.getByTestId("companyId").textContent).toBe("studio");
      expect(screen.getByTestId("patrimonio").textContent).toBe("1");
      expect(screen.getByTestId("name").textContent).toBe("Patrimonio dello studio");
    });

    const raw = JSON.parse(localStorage.getItem(APP_COMPANY_SCOPE_KEY));
    expect(raw.company_id).toBe("studio");
  });
});
