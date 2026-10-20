/**
 * L1 — Export Word WPS (ISO 15609-1:2019 Annex A, programmatico).
 * Verifica OOXML valido + campi Mason + tabella 9 colonne + range² + n.a.
 */
import { describe, it, expect, vi } from "vitest";
import PizZip from "pizzip";
import {
  mapWpsToAnnexAFields,
  generateWpsAnnexABlob,
  exportWpsAnnexADocx,
} from "../utils/wordExportWps.js";

vi.mock("file-saver", () => ({ saveAs: vi.fn(), default: { saveAs: vi.fn() } }));

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

function xmlOf(zip) {
  return Object.keys(zip.files)
    .filter((k) => /word\/.+\.xml$/.test(k))
    .map((k) => zip.files[k].asText())
    .join('\n');
}

/** Caso Mason minimo: FW, gruppo 1.2, spessori 5–10 mm */
const MASON_WPS = {
  id: 42,
  wps_code: "WPS-MASON-FW-001",
  revision: "0",
  welding_process: "135",
  material_group: "1.2",
  joint_type: "FW",
  position: "PA",
  filler_material: "G 42 4 M21 3Si1",
  shielding_gas: "M21",
  thickness_range_min: 5,
  thickness_range_max: 10,
  preheat_temp: "",
  interpass_temp: "",
  qualification_standard: "ISO 15614-1",
  company_name: "Mason Srl",
  notes: "Generata da WPQR WPQR-001",
  status: "bozza",
};

describe("mapWpsToAnnexAFields", () => {
  it("mappa campi noti Mason e lascia vuoti i parametri assenti", () => {
    const f = mapWpsToAnnexAFields(MASON_WPS);
    expect(f.wpsNo).toBe("WPS-MASON-FW-001");
    expect(f.jointType).toBe("FW");
    expect(f.materialGroup).toBe("1.2");
    expect(f.thickness).toContain("5");
    expect(f.thickness).toContain("10");
    expect(f.manufacturer).toBe("Mason Srl");
    expect(f.heatInput).toBe("");
    expect(f.currentRange).toBe("");
    expect(f.voltageRange).toBe("");
    expect(f.parentMaterialA).toBe("");
    expect(f.parentMaterialB).toBe("");
    expect(f.metalTransfer).toBe("");
    expect(f.throat).toBe("");
    expect(f.bakingDrying).toBe("");
  });

  it("usa position da welding_positions se position è vuoto", () => {
    const f = mapWpsToAnnexAFields({
      ...MASON_WPS,
      position: "",
      welding_positions: "PB",
    });
    expect(f.position).toBe("PB");
  });

  it("non usa current_type come current_range (bug DC+ in ampere)", () => {
    const f = mapWpsToAnnexAFields({
      ...MASON_WPS,
      current_type: "DC+",
      current_range: "",
    });
    expect(f.currentRange).toBe("");
  });

  it("MAG 135: tungsten/oscillation/plasma = n.a.", () => {
    const f = mapWpsToAnnexAFields(MASON_WPS);
    expect(f.tungsten).toBe("n.a.");
    expect(f.oscillation).toBe("n.a.");
    expect(f.plasma).toBe("n.a.");
  });

  it("mappa i sette campi ISO 15609-1 dal record WPS", () => {
    const f = mapWpsToAnnexAFields({
      ...MASON_WPS,
      wpqr_ref: "24-03390-01",
      parent_material_a: "S355",
      parent_material_b: "S235",
      heat_input: "0,8 kJ/mm",
      current_range: "190 A",
      voltage_range: "24 V",
      metal_transfer: "Spray arc",
    });
    expect(f.wpqrNo).toBe("24-03390-01");
    expect(f.parentMaterialA).toBe("S355");
    expect(f.parentMaterialB).toBe("S235");
    expect(f.heatInput).toBe("0,8 kJ/mm");
    expect(f.currentRange).toBe("190 A");
    expect(f.voltageRange).toBe("24 V");
    expect(f.metalTransfer).toBe("Spray arc");
  });

  it("mappa i campi 182 da WPQR (preparazione, portata, torcia)", () => {
    const f = mapWpsToAnnexAFields({
      ...MASON_WPS,
      joint_preparation: "close square T",
      cleaning_method: "grinding",
      mechanization: "partly mechanized",
      shielding_gas_flow_l_min_min: 12,
      shielding_gas_flow_l_min_max: 15,
      throat_mm: 7.5,
      pipe_diameter_min: 60,
      pipe_diameter_max: 120,
      torch_angle_deg: 15,
      bead_technique: "stringer",
    });
    expect(f.preparationCleaning).toBe("close square T / grinding");
    expect(f.mechanization).toBe("partly mechanized");
    expect(f.shieldingGasFlow).toMatch(/12/);
    expect(f.shieldingGasFlow).toMatch(/15/);
    expect(f.throat).toBe("7.5 mm");
    expect(f.pipeDiameter).toMatch(/60/);
    expect(f.pipeDiameter).toMatch(/120/);
    expect(f.torchAngle).toBe("15\u00B0");
    expect(f.weaving).toBe("stringer");
  });

  it("usa wpqrCode / companyName dagli options se assenti sul record", () => {
    const f = mapWpsToAnnexAFields(
      { wps_code: "WPS-X", revision: "1" },
      { companyName: "Ambito Co", wpqrCode: "WPQR-99" }
    );
    expect(f.manufacturer).toBe("Ambito Co");
    expect(f.wpqrNo).toBe("WPQR-99");
    expect(f.jointType).toBe("");
  });
});

describe("generateWpsAnnexABlob", () => {
  it("produce ZIP OOXML con word/document.xml e codice WPS Mason", async () => {
    const blob = await generateWpsAnnexABlob(MASON_WPS);
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(500);

    const ab = await blobToArrayBuffer(blob);
    const zip = new PizZip(ab);
    expect(zip.files["word/document.xml"]).toBeTruthy();
    expect(zip.files["[Content_Types].xml"]).toBeTruthy();

    const xml = xmlOf(zip);
    expect(xml).toContain("WPS-MASON-FW-001");
    expect(xml).toContain("FW");
    expect(xml).toContain("1.2");
    expect(xml).toContain("Mason Srl");
    expect(xml).toMatch(/ISO 15609-1/);
    expect(xml).toContain("SystemGest");
    expect(xml).toContain("Parent material designation");
    expect(xml).toContain("Mode(s) of metal transfer");
    expect(xml).toContain("Joint design");
    expect(xml).toContain("Welding sequences");
    expect(xml).toContain("Passata");
    expect(xml).toContain("Type of current/polarity");
    expect(xml).toContain("Wire feed speed");
    expect(xml).toContain("n.a.");
  });

  it("stampa i sette campi ISO 15609-1 nel documento", async () => {
    const blob = await generateWpsAnnexABlob({
      ...MASON_WPS,
      wpqr_ref: "24-03390-01",
      parent_material_a: "S355",
      parent_material_b: "S235",
      heat_input: "0,8 kJ/mm",
      current_range: "190 A",
      voltage_range: "24 V",
      metal_transfer: "Spray arc",
    });
    const ab = await blobToArrayBuffer(blob);
    const zip = new PizZip(ab);
    const xml = xmlOf(zip);
    expect(xml).toContain("24-03390-01");
    expect(xml).toContain("S355");
    expect(xml).toContain("S235");
    expect(xml).toContain("0,8 kJ/mm");
    expect(xml).toContain("190 A");
    expect(xml).toContain("24 V");
    expect(xml).toContain("Spray arc");
  });

  it("riempie la tabella passate a 9 colonne con range² da valori WPQR", async () => {
    const blob = await generateWpsAnnexABlob(MASON_WPS, {
      wpqrCode: "24-03390-01",
      testRuns: [
        {
          run_label: "1", welding_process: "135", filler_diameter_mm: 1,
          current_a: 190, voltage_v: 23.5, current_polarity: "DC+",
          wire_feed_speed: 8, wire_feed_unit: "m/min",
          travel_speed: 5.4, heat_input_value: 0.66,
        },
        {
          run_label: "2 +n", welding_process: "135", filler_diameter_mm: 1,
          current_a: 210, voltage_v: 26.5, current_polarity: "DC+",
          wire_feed_speed: 9, wire_feed_unit: "m/min",
          travel_speed: 3.4, heat_input_value: 1.31,
        },
      ],
    });
    const ab = await blobToArrayBuffer(blob);
    const zip = new PizZip(ab);
    const xml = xmlOf(zip);
    expect(xml).toContain("24-03390-01");
    expect(xml).toContain("171");
    expect(xml).toContain("209");
    expect(xml).toContain("189");
    expect(xml).toContain("231");
    expect(xml).toContain("DC+");
    expect(xml).toContain("2 +n");
    expect(xml).toContain("m/min");
    expect(xml).toContain("5.4");
    expect(xml).toContain("3.4");
    expect(xml).not.toContain("4.86");
    expect(xml).not.toContain("5.94");
    expect(xml).toMatch(/\u00A78\.4\.8|§8\.4\.8|8.4.8/);
  });

  it("exportWpsAnnexADocx chiama saveAs con nome file dal codice", async () => {
    const { saveAs } = await import("file-saver");
    await exportWpsAnnexADocx(MASON_WPS);
    expect(saveAs).toHaveBeenCalled();
    const [, filename] = saveAs.mock.calls[saveAs.mock.calls.length - 1];
    expect(filename).toMatch(/^WPS_WPS-MASON-FW-001/);
    expect(filename).toMatch(/\.docx$/);
  });
});
