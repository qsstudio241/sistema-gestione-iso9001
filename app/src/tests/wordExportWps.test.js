/**
 * L1 — Export Word WPS (ISO 15609-1 Annex A, programmatico).
 * Verifica OOXML valido + campi Mason (codice, giunto, materiali/spessori).
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

    const xml = zip.files["word/document.xml"].asText();
    expect(xml).toContain("WPS-MASON-FW-001");
    expect(xml).toContain("FW");
    expect(xml).toContain("1.2");
    expect(xml).toContain("Mason Srl");
    expect(xml).toMatch(/ISO 15609-1/);
    expect(xml).toContain("SystemGest");
    expect(xml).toContain("Materiale padre A");
    expect(xml).toContain("Trasferimento di metallo");
    // Tabella passate vuota presente (etichetta sezione)
    expect(xml).toContain("Passata");
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
    const xml = zip.files["word/document.xml"].asText();
    expect(xml).toContain("24-03390-01");
    expect(xml).toContain("S355");
    expect(xml).toContain("S235");
    expect(xml).toContain("0,8 kJ/mm");
    expect(xml).toContain("190 A");
    expect(xml).toContain("24 V");
    expect(xml).toContain("Spray arc");
  });

  it("riempie la tabella passate dai test_runs della WPQR collegata", async () => {
    const blob = await generateWpsAnnexABlob(MASON_WPS, {
      wpqrCode: "24-03390-01",
      testRuns: [
        {
          run_label: "1", welding_process: "135", filler_diameter_mm: 1,
          current_a: 190, voltage_v: 23.5, travel_speed: 5.4, heat_input_value: 0.66,
        },
        {
          run_label: "2 +n", welding_process: "135", filler_diameter_mm: 1,
          current_a: 210, voltage_v: 26.5, travel_speed: 3.4, heat_input_value: 1.31,
        },
      ],
    });
    const ab = await blobToArrayBuffer(blob);
    const zip = new PizZip(ab);
    const xml = zip.files["word/document.xml"].asText();
    expect(xml).toContain("24-03390-01");
    expect(xml).toContain("190");
    expect(xml).toContain("210");
    expect(xml).toContain("0.66");
    expect(xml).toContain("1.31");
    expect(xml).toContain("2 +n");
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
