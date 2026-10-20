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
import { GenerateWpsModal, draftToCreatePayload } from "../pages/WeldingProceduresPage";

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
        wpqr_id: 1,
        parent_material_a: "S355",
        parent_material_b: "S235",
        heat_input: "0,8 kJ/mm",
        current_range: "DC+",
        voltage_range: "24 V",
        metal_transfer: "Spray",
        preheat_temp: "20 °C",
        interpass_temp: "max 200 °C",
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
    expect(payload.wpqr_id).toBe(1);
    expect(payload.wpqr_ref).toBe("WPQR-M1");
    expect(payload.parent_material_a).toBe("S355");
    expect(payload.parent_material_b).toBe("S235");
    expect(payload.heat_input).toBe("0,8 kJ/mm");
    expect(payload.current_range).toBe("DC+");
    expect(payload.voltage_range).toBe("24 V");
    expect(payload.metal_transfer).toBe("Spray");
    expect(payload.preheat_temp).toBe("20 °C");
    expect(payload.interpass_temp).toBe("max 200 °C");
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("draftToCreatePayload", () => {
  it("persiste throat, diametro e campi 182, e mappa position da welding_positions", () => {
    const p = draftToCreatePayload({
      welding_positions: "PB",
      throat_mm: 7.5,
      pipe_diameter_mm: 88.9,
      joint_preparation: "square T",
      mechanization: "manual",
      torch_angle_deg: 12,
      wpqr_ref: "X",
      wpqr_id: 3,
    }, 51, "WPS-1");
    expect(p.position).toBe("PB");
    expect(p.welding_positions).toBe("PB");
    expect(p.throat_mm).toBe(7.5);
    expect(p.pipe_diameter_min).toBe(88.9);
    expect(p.pipe_diameter_max).toBe(88.9);
    expect(p.joint_preparation).toBe("square T");
    expect(p.mechanization).toBe("manual");
    expect(p.torch_angle_deg).toBe(12);
    expect(p.company_id).toBe(51);
    expect(p.wps_code).toBe("WPS-1");
  });
});
