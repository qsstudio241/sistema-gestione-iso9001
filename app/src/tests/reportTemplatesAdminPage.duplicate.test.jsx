/**
 * @vitest-environment jsdom
 *
 * Duplica modello di sistema solo dalla riga elenco, non dal banner.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ReportTemplatesAdminPage from "../components/ReportTemplatesAdminPage";

vi.mock("../services/apiService", () => ({
  default: {
    baseUrl: "https://example.test/api/v1",
    getReportTemplates: vi.fn(),
    getStandards: vi.fn(),
    getReportTemplateStandardAssignments: vi.fn(),
    getNcReportTemplateAssignment: vi.fn(),
    downloadReportTemplateFile: vi.fn(),
  },
}));

import apiService from "../services/apiService";

describe("ReportTemplatesAdminPage — un solo Duplica", () => {
  beforeEach(() => {
    apiService.getReportTemplates.mockImplementation((scope) =>
      Promise.resolve({
        data:
          scope === "nc"
            ? []
            : [
                {
                  id: 4,
                  name: "Report Audit ISO 3834-2",
                  organization_id: null,
                  is_system: true,
                  standard_key: "ISO_3834_2",
                  file_path: "/templates/ISO3834-audit-report.docx",
                  scope: "audit",
                },
              ],
      })
    );
    apiService.getStandards.mockResolvedValue({
      data: [{ standard_id: 6, standard_name: "ISO 3834-2" }],
    });
    apiService.getReportTemplateStandardAssignments.mockResolvedValue({ data: [] });
    apiService.getNcReportTemplateAssignment.mockResolvedValue({ data: null });
  });

  it("non mostra la card Duplica modello nel banner; Duplica resta sulla riga", async () => {
    render(<ReportTemplatesAdminPage onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Report Audit ISO 3834-2")).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: /Duplica modello/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Modello di sistema/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Duplica" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Carica file/i })).toBeInTheDocument();
  });
});
