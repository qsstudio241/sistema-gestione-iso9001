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

  it("conta foto cordone da weldPhotosById (ISO-5b)", () => {
    const f = mapWeldingBookToIofFields(MASON_WB, {
      welds: [{ id: 7, sequence_no: "S01", weld_params: {} }],
      weldPhotosById: {
        7: [{ data: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg", fileName: "c.jpg" }],
      },
    });
    expect(f.weldRows[0].photoCount).toBe(1);
    expect(f.weldRows[0].photoNote).toBe("1 foto");
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

  it("incorpora sezione Foto cordone quando passate immagini (ISO-5b)", async () => {
    // JPEG 1x1 minimo valido
    const jpeg = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x08, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
      0x7f, 0xff, 0xd9,
    ]);
    const blob = await generateWeldingBookBlob(MASON_WB, {
      welds: [{ id: 7, sequence_no: "S01", joint_code: "J1", weld_params: {} }],
      weldPhotosById: {
        7: [{ data: jpeg, mimeType: "image/jpeg", fileName: "cordone.jpg" }],
      },
    });
    const ab = await blobToArrayBuffer(blob);
    const zip = new PizZip(ab);
    const xml = zip.file("word/document.xml").asText();
    expect(xml).toContain("Foto cordone");
    expect(xml).toContain("drawing");
    const mediaFiles = Object.keys(zip.files).filter((k) => k.startsWith("word/media/"));
    expect(mediaFiles.length).toBeGreaterThan(0);
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
