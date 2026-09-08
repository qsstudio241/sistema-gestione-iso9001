/**
 * L1 — Export Word Welding Book (IOF ISO 3834, programmatico).
 * Verifica OOXML valido + campi testata / sequenza (niente esiti C/NC).
 */
import { describe, it, expect, vi } from "vitest";
import PizZip from "pizzip";
import {
  mapWeldingBookToIofFields,
  generateWeldingBookBlob,
  exportWeldingBookDocx,
} from "../utils/wordExportWeldingBook.js";

vi.mock("file-saver", () => ({ saveAs: vi.fn(), default: { saveAs: vi.fn() } }));

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

const MASON_WB = {
  id: 7,
  book_number: "WB-MASON-001",
  document_revision: "0",
  status: "draft",
  product_code: "TRV-120",
  product_description: "Traversa saldata",
  job_order: "C-2026-014",
  client_name: "Mason Srl",
  drawing_ref: "DIS-TRV-120",
  drawing_revision: "B",
  wps_code: "WPS-MASON-FW-001",
  wpqr_code: "WPQR-001",
  base_material: "S355",
  filler_material: "G 42 4 M21 3Si1",
  welding_process: "135",
  coordinator_name: "Coord. Mason",
  notes: "Bozza IOF prova",
  equipment: [
    {
      asset_id: 11,
      internal_code: "SAL-01",
      asset_name: "Sorgente MIG",
      serial_number: "SN-9",
      equipment_role: "welding_source",
      notes: "",
    },
  ],
  welds: [
    {
      sequence_no: "S01",
      joint_code: "J1",
      joint_description: "Angolo FW",
      welder_name: "Rossi",
      weld_date: "2026-09-01",
      weld_params: {
        current_a: "180",
        voltage_v: "22",
        travel_speed: "35",
        passes: "2",
        preheat_c: "",
        interpass_c: "150",
        filler: "G 42 4 M21 3Si1",
        gas: "M21",
      },
      notes: "",
    },
  ],
};

describe("mapWeldingBookToIofFields", () => {
  it("mappa testata e griglie; lascia vuoti i parametri assenti", () => {
    const f = mapWeldingBookToIofFields(MASON_WB);
    expect(f.bookNumber).toBe("WB-MASON-001");
    expect(f.productCode).toBe("TRV-120");
    expect(f.wpsCode).toBe("WPS-MASON-FW-001");
    expect(f.equipmentRows).toHaveLength(1);
    expect(f.equipmentRows[0].label).toContain("SAL-01");
    expect(f.weldRows).toHaveLength(1);
    expect(f.weldRows[0].currentA).toBe("180");
    expect(f.weldRows[0].preheatC).toBe("");
    expect(f.weldRows[0].photoNote).toBe("");
  });

  it("usa equipment/welds dagli options se passati separati", () => {
    const f = mapWeldingBookToIofFields(
      { book_number: "WB-X", product_code: "P1" },
      {
        equipment: [{ asset_id: 1, internal_code: "EQ-1", equipment_role: "gas" }],
        welds: [{ sequence_no: "S02", weld_params: { voltage_v: "24" } }],
      }
    );
    expect(f.equipmentRows[0].role).toBe("Gas");
    expect(f.weldRows[0].sequenceNo).toBe("S02");
    expect(f.weldRows[0].voltageV).toBe("24");
  });
});

describe("generateWeldingBookBlob", () => {
  it("produce ZIP OOXML con word/document.xml e codice WB Mason", async () => {
    const blob = await generateWeldingBookBlob(MASON_WB);
    expect(blob).toBeTruthy();
    expect(blob.size).toBeGreaterThan(500);

    const ab = await blobToArrayBuffer(blob);
    const zip = new PizZip(ab);
    expect(zip.files["word/document.xml"]).toBeTruthy();
    expect(zip.files["[Content_Types].xml"]).toBeTruthy();

    const xml = zip.file("word/document.xml").asText();
    expect(xml).toContain("WB-MASON-001");
    expect(xml).toContain("WELDING BOOK");
    expect(xml).toContain("Traversa saldata");
    expect(xml).toContain("S01");
    expect(xml).toContain("Rossi");
    // IOF: niente esiti conformità
    expect(xml).not.toMatch(/>\s*Esito\s*</);
    expect(xml).not.toContain("Non conformità");
  });
});

describe("exportWeldingBookDocx", () => {
  it("invoca saveAs con nome file sensato", async () => {
    const { saveAs } = await import("file-saver");
    await exportWeldingBookDocx(MASON_WB);
    expect(saveAs).toHaveBeenCalled();
    const filename = saveAs.mock.calls[0][1];
    expect(filename).toMatch(/^WeldingBook_WB-MASON-001/);
    expect(filename).toMatch(/\.docx$/);
  });
});
