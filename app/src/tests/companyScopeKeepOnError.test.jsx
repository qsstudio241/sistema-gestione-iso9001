/**
 * @vitest-environment jsdom
 * Un 429 non deve svuotare l'elenco aziende già caricato.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyScopeProvider, useCompanyScope } from "../contexts/CompanyScopeContext";

const authState = {
  user: {
    id: 9,
    role: "admin",
    organization_id: 1002,
    organization_name: "QS_Studio",
    company_access: [],
  },
};

const getCompanies = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: (...args) => getCompanies(...args),
  },
}));

function Probe() {
  const { companies, companiesLoadError, reloadCompanies } = useCompanyScope();
  return (
    <div>
      <span data-testid="count">{companies.length}</span>
      <span data-testid="error">{companiesLoadError || ""}</span>
      <button type="button" onClick={() => reloadCompanies()}>Riprova</button>
    </div>
  );
}

describe("CompanyScopeProvider — errore di caricamento", () => {
  let failNext = false;

  beforeEach(() => {
    failNext = false;
    getCompanies.mockReset();
    getCompanies.mockImplementation(() => {
      if (failNext) {
        const err = new Error("Troppe richieste");
        err.status = 429;
        err.code = "RATE_LIMIT_API";
        return Promise.reject(err);
      }
      return Promise.resolve({ data: [{ id: 181, name: "OMA" }] });
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("tiene le aziende già viste e mostra il messaggio con Riprova", async () => {
    getCompanies.mockResolvedValueOnce({
      data: [{ id: 181, name: "OMA" }],
    });
    render(
      <CompanyScopeProvider>
        <Probe />
      </CompanyScopeProvider>
    );
    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));

    failNext = true;
    await userEvent.click(screen.getByRole("button", { name: "Riprova" }));

    await waitFor(() => {
      expect(screen.getByTestId("error").textContent).toBe("Troppe richieste, riprova tra poco");
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
  });
});
