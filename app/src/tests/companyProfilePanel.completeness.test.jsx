import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyProfilePanel from "../components/CompanyProfilePanel";

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getCompanyProfile: (...args) => mockGet(...args),
    updateCompanyProfile: (...args) => mockUpdate(...args),
    detectCompanyProfileImport: vi.fn(),
    importCompanyProfile: vi.fn(),
    downloadCompanyProfileTemplate: vi.fn(),
  },
}));

describe("CompanyProfilePanel completezza + sync", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockUpdate.mockReset();
    mockGet.mockResolvedValue({
      data: {
        exists: true,
        legal_name: "Acme Srl",
        vat_number: "IT123",
        profile_completeness: 30,
        completeness_level: "incompleto",
        seededFromAnagrafica: [],
      },
    });
    mockUpdate.mockResolvedValue({
      data: {
        exists: true,
        legal_name: "Acme Srl",
        vat_number: "IT123",
        profile_completeness: 30,
        completeness_level: "incompleto",
        synced_anagrafica: ["name"],
      },
    });
  });

  it("mostra badge completezza", async () => {
    render(<CompanyProfilePanel companyId={42} auditorOrgId={1} canEdit />);
    await waitFor(() => {
      expect(screen.getByTestId("profile-completeness")).toBeInTheDocument();
    });
    expect(screen.getByTestId("profile-completeness")).toHaveTextContent(/30%/);
    expect(screen.getByTestId("profile-completeness")).toHaveTextContent(/Incompleto/i);
  });

  it("checkbox sync visibili solo in modifica", async () => {
    const { rerender } = render(
      <CompanyProfilePanel companyId={42} auditorOrgId={1} canEdit={false} />
    );
    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Srl")).toBeInTheDocument();
    });
    expect(screen.queryByText(/anagrafica base/i)).not.toBeInTheDocument();
    rerender(<CompanyProfilePanel companyId={42} auditorOrgId={1} canEdit />);
    expect(screen.getByText(/anagrafica base/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Nome/i })).not.toBeChecked();
  });

  it("invia sync_anagrafica solo se spuntato", async () => {
    const user = userEvent.setup();
    const onSynced = vi.fn();
    render(
      <CompanyProfilePanel
        companyId={42}
        auditorOrgId={1}
        canEdit
        onAnagraficaSynced={onSynced}
      />
    );
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: /Nome/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("checkbox", { name: /Nome/i }));
    await user.type(screen.getByLabelText("Ragione sociale"), " X");
    await user.click(screen.getByRole("button", { name: /Salva profilo/i }));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled();
    });
    expect(mockUpdate.mock.calls[0][1].sync_anagrafica).toEqual(
      expect.objectContaining({ name: true, vat_number: false, address: false })
    );
    expect(onSynced).toHaveBeenCalledWith(["name"]);
  });

  it("abilita Salva se solo le checkbox sync sono spuntate", async () => {
    const user = userEvent.setup();
    render(<CompanyProfilePanel companyId={42} auditorOrgId={1} canEdit />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Salva profilo/i })).toBeDisabled();
    });
    await user.click(screen.getByRole("checkbox", { name: /Partita IVA/i }));
    expect(screen.getByRole("button", { name: /Salva profilo/i })).toBeEnabled();
  });
});
