import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyProfilePanel from "../components/CompanyProfilePanel";

const mockGetCompanyProfile = vi.fn();
const mockDetect = vi.fn();
const mockImport = vi.fn();
const mockDownload = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getCompanyProfile: (...args) => mockGetCompanyProfile(...args),
    updateCompanyProfile: vi.fn(),
    detectCompanyProfileImport: (...args) => mockDetect(...args),
    importCompanyProfile: (...args) => mockImport(...args),
    downloadCompanyProfileTemplate: (...args) => mockDownload(...args),
  },
}));

describe("CompanyProfilePanel import Excel", () => {
  beforeEach(() => {
    mockGetCompanyProfile.mockReset();
    mockDetect.mockReset();
    mockImport.mockReset();
    mockDownload.mockReset();
    mockGetCompanyProfile.mockResolvedValue({
      data: {
        exists: false,
        legal_name: "Acme Srl",
        vat_number: "IT123",
        seededFromAnagrafica: ["legal_name", "vat_number"],
      },
    });
    mockDetect.mockResolvedValue({
      data: {
        canImport: true,
        confidence: "alta",
        fileName: "visura.xlsx",
        sheetName: "ProfiloAzienda",
        mapping: { ateco_primary: "ATECO" },
        preview: { ateco_primary: "25.11.00", vat_number: "01234567890" },
      },
    });
    mockImport.mockResolvedValue({
      data: {
        exists: true,
        ateco_primary: "25.11.00",
        vat_number: "01234567890",
        legal_name: "Acme Srl",
      },
    });
  });

  it("mostra pulsanti modello e import se canEdit", async () => {
    render(<CompanyProfilePanel companyId={42} auditorOrgId={1} canEdit />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Scarica modello Excel/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Importa modello Excel/i })).toBeInTheDocument();
    expect(screen.getByText(/foglio Excel da compilare/i)).toBeInTheDocument();
  });

  it("nasconde i pulsanti import se sola lettura", async () => {
    render(<CompanyProfilePanel companyId={42} auditorOrgId={1} canEdit={false} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Srl")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Importa modello Excel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Scarica modello Excel/i })).not.toBeInTheDocument();
  });

  it("detect dry-run apre il dialog e conferma scrive", async () => {
    const user = userEvent.setup();
    render(<CompanyProfilePanel companyId={42} auditorOrgId={1} canEdit />);
    await waitFor(() => {
      expect(screen.getByTestId("company-profile-excel-input")).toBeInTheDocument();
    });
    const file = new File(["xlsx"], "visura.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await user.upload(screen.getByTestId("company-profile-excel-input"), file);
    await waitFor(() => {
      expect(mockDetect).toHaveBeenCalled();
    });
    expect(mockDetect.mock.calls[0][0]).toBe(42);
    expect(mockDetect.mock.calls[0][2]).toEqual({ auditor_org_id: 1 });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("25.11.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Conferma import/i }));
    await waitFor(() => {
      expect(mockImport).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          fileName: "visura.xlsx",
          fields: expect.objectContaining({ ateco_primary: "25.11.00" }),
        }),
        { auditor_org_id: 1 }
      );
    });
  });
});
