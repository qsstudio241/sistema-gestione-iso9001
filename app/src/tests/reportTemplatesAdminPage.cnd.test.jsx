/**
 * @vitest-environment jsdom
 *
 * CND-4: tab CND in Template report.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

describe("ReportTemplatesAdminPage — tab CND", () => {
  beforeEach(() => {
    apiService.getReportTemplates.mockImplementation((scope) =>
      Promise.resolve({
        data:
          scope === "cnd"
            ? [
                {
                  id: 40,
                  name: "Verbale CND PT (sistema)",
                  organization_id: null,
                  is_system: true,
                  standard_key: "PT",
                  file_path: "/templates/CND-PT-verbale.docx",
                  scope: "cnd",
                },
              ]
            : [],
      }),
    );
    apiService.getStandards.mockResolvedValue({ data: [] });
    apiService.getReportTemplateStandardAssignments.mockResolvedValue({ data: [] });
    apiService.getNcReportTemplateAssignment.mockResolvedValue({ data: null });
  });

  it("mostra la tab CND e l'elenco PT dopo il click", async () => {
    render(<ReportTemplatesAdminPage onBack={() => {}} />);
    const cndTab = await screen.findByRole("tab", { name: "CND" });
    expect(cndTab).toBeInTheDocument();
    fireEvent.click(cndTab);
    await waitFor(() => {
      expect(screen.getByText("Verbale CND PT (sistema)")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Metodo/i)).toBeInTheDocument();
    expect(apiService.getReportTemplates).toHaveBeenCalledWith("cnd");
  });
});
