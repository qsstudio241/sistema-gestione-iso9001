/**
 * P1-B/C — Genera WPS modal + intent AskAi
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  saveWpsGenerateIntent,
  consumeWpsGenerateIntent,
  MASON_WPS_GENERATE_DEFAULTS,
  WPS_GENERATE_MASON_CHIP,
} from "../utils/aiAssistantContext";
import { GenerateWpsModal } from "../pages/WeldingProceduresPage";

vi.mock("../services/apiService", () => ({
  default: {
    generateWPS: vi.fn(),
    createWPS: vi.fn(),
  },
}));

import apiService from "../services/apiService";

describe("wps generate intent (P1-C)", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("salva e consuma defaults Mason", () => {
    saveWpsGenerateIntent();
    const intent = consumeWpsGenerateIntent();
    expect(intent.joint_type).toBe(MASON_WPS_GENERATE_DEFAULTS.joint_type);
    expect(intent.parent_material_a).toBe("S355");
    expect(intent.thickness_b_mm).toBe("5");
    expect(consumeWpsGenerateIntent()).toBeNull();
  });

  it("chip testo Mason è stabile", () => {
    expect(WPS_GENERATE_MASON_CHIP).toMatch(/WPS FW/);
    expect(WPS_GENERATE_MASON_CHIP).toMatch(/S355/);
  });
});

describe("GenerateWpsModal (P1-B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("precompila caso Mason e mostra estensioni su not_possible", async () => {
    apiService.generateWPS.mockResolvedValue({
      success: true,
      status: "not_possible",
      wps_draft: null,
      extensions_needed: ["Nessuna WPQR copre il gruppo materiale 1.2–1.1"],
      warnings: [],
    });

    render(
      <GenerateWpsModal
        defaultCompanyId={10}
        initialValues={MASON_WPS_GENERATE_DEFAULTS}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("gen-mat-a")).toHaveValue("S355");
    expect(screen.getByTestId("gen-thick-a")).toHaveValue(10);

    fireEvent.click(screen.getByRole("button", { name: "Genera" }));

    await waitFor(() => {
      expect(screen.getByTestId("gen-preview-not-possible")).toBeInTheDocument();
    });
    expect(screen.getByText(/Nessuna WPQR copre/)).toBeInTheDocument();
    expect(screen.queryByTestId("gen-save-draft")).not.toBeInTheDocument();
    expect(apiService.createWPS).not.toHaveBeenCalled();
  });

  it("ok → anteprima → Salva bozza chiama createWPS", async () => {
    apiService.generateWPS.mockResolvedValue({
      success: true,
      status: "ok",
      wpqr_used: { id: 1, wpqr_code: "WPQR-M1" },
      wps_draft: {
        joint_type: "FW",
        welding_process: "135",
        material_group: "1.2+1.1",
        thickness_range_min: 3,
        thickness_range_max: 20,
        qualification_standard: "ISO 15614-1",
        wpqr_ref: "WPQR-M1",
        status: "bozza",
      },
      extensions_needed: [],
      warnings: [],
    });
    apiService.createWPS.mockResolvedValue({ success: true, data: { id: 99 } });
    const onSaved = vi.fn();

    render(
      <GenerateWpsModal
        defaultCompanyId={10}
        initialValues={MASON_WPS_GENERATE_DEFAULTS}
        onSaved={onSaved}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Genera" }));
    await waitFor(() => {
      expect(screen.getByTestId("gen-preview-ok")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("gen-save-draft"));
    await waitFor(() => {
      expect(apiService.createWPS).toHaveBeenCalled();
    });
    const payload = apiService.createWPS.mock.calls[0][0];
    expect(payload.status).toBe("bozza");
    expect(payload.company_id).toBe(10);
    expect(payload.joint_type).toBe("FW");
    expect(onSaved).toHaveBeenCalled();
  });
});
