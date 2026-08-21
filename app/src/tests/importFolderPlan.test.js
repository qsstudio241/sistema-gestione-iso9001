import { describe, it, expect } from "vitest";
import { MAX_IMPORT_JOB_FILES } from "../utils/importFolderUpload";
import {
  ROOT_FOLDER_KEY,
  guessTypeFromPath,
  honestPathLabel,
  detectPickedRoot,
  firstLevelFolderName,
  buildFolderInventory,
  chunkFiles,
  buildUploadLots,
  buildLotTitle,
  estimateLotsText,
  formatImportSize,
  compareFoldersForUpload,
  lotDocumentTypeHint,
} from "../utils/importFolderPlan";

function fakeFile(rel, { name, size = 1024 } = {}) {
  const base = name || String(rel).split("/").pop();
  return { name: base, size, webkitRelativePath: rel };
}

describe("importFolderPlan — path only", () => {
  it("guessTypeFromPath riconosce capitolato e commessa dal nome cartella", () => {
    expect(guessTypeFromPath("Documenti/Capitolati/a.pdf")).toBe("capitolato");
    expect(guessTypeFromPath("Commesse")).toBe("commessa");
    expect(guessTypeFromPath("01_Capitolati")).toBe("capitolato");
    expect(guessTypeFromPath("Procedure")).toBe("procedura");
    expect(guessTypeFromPath("Scan")).toBe(null);
    expect(guessTypeFromPath("Thumbs")).toBe(null);
  });

  it("etichetta onesta: solo path, niente LLM", () => {
    expect(honestPathLabel("capitolato")).toBe("Probabile: capitolato (dal nome)");
    expect(honestPathLabel(null)).toBe("Da classificare");
  });
});

describe("importFolderPlan — inventory e raggruppamento", () => {
  it("salta junk OS e raggruppa per cartella di primo livello sotto la radice scelta", () => {
    const files = [
      fakeFile("Documenti/Capitolati/rfq.pdf", { size: 2 * 1024 * 1024 }),
      fakeFile("Documenti/Capitolati/ordine.docx", { size: 1024 * 1024 }),
      fakeFile("Documenti/Commesse/2024/disegno.dwg", { size: 4 * 1024 * 1024 }),
      fakeFile("Documenti/Scan/pagina1.jpg", { size: 8 * 1024 * 1024 }),
      fakeFile("Documenti/Scan/Thumbs.db", { name: "Thumbs.db", size: 10 }),
      fakeFile("Documenti/readme.txt", { size: 100 }),
    ];
    const inv = buildFolderInventory(files);
    expect(inv.skippedJunk).toBe(1);
    expect(inv.files).toHaveLength(5);
    expect(inv.pickedRoot).toBe("Documenti");
    const names = inv.folders.map((f) => f.name);
    expect(names).toContain("Capitolati");
    expect(names).toContain("Commesse");
    expect(names).toContain("Scan");
    expect(names).toContain("Documenti");
    const cap = inv.folders.find((f) => f.name === "Capitolati");
    expect(cap.fileCount).toBe(2);
    expect(cap.guessedType).toBe("capitolato");
    expect(cap.label).toBe("Probabile: capitolato (dal nome)");
    const scan = inv.folders.find((f) => f.name === "Scan");
    expect(scan.guessedType).toBe(null);
    expect(scan.label).toBe("Da classificare");
  });

  it("firstLevelFolderName: Documenti/Capitolati/a.pdf → Capitolati", () => {
    expect(firstLevelFolderName(fakeFile("Documenti/Capitolati/a.pdf"), "Documenti")).toBe(
      "Capitolati"
    );
    expect(firstLevelFolderName(fakeFile("Documenti/solo.pdf"), "Documenti")).toBe("");
    expect(detectPickedRoot([fakeFile("Documenti/a.pdf"), fakeFile("Altro/b.pdf")])).toBe("");
  });
});

describe("importFolderPlan — ordine e chunk", () => {
  it("capitolato e commessa prima di Scan / da classificare", () => {
    const folders = [
      { name: "Scan", guessedType: null },
      { name: "Procedure", guessedType: "procedura" },
      { name: "Commesse", guessedType: "commessa" },
      { name: "Capitolati", guessedType: "capitolato" },
    ];
    const ordered = [...folders].sort(compareFoldersForUpload).map((f) => f.name);
    expect(ordered).toEqual(["Capitolati", "Commesse", "Procedure", "Scan"]);
  });

  it("chunk da MAX_IMPORT_JOB_FILES (80)", () => {
    const files = Array.from({ length: 81 }, (_, i) => fakeFile(`Documenti/Scan/f${i}.jpg`));
    const chunks = chunkFiles(files, MAX_IMPORT_JOB_FILES);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(80);
    expect(chunks[1]).toHaveLength(1);
  });

  it("lotti: cartelle indovinate in testa, titoli Documenti / Capitolati (1/2)", () => {
    const capFiles = Array.from({ length: 81 }, (_, i) =>
      fakeFile(`Documenti/Capitolati/c${i}.pdf`)
    );
    const scanFiles = Array.from({ length: 10 }, (_, i) =>
      fakeFile(`Documenti/Scan/s${i}.jpg`)
    );
    const inv = buildFolderInventory([...scanFiles, ...capFiles]);
    const keys = new Set(inv.folders.map((f) => f.key));
    const lots = buildUploadLots(inv, keys, MAX_IMPORT_JOB_FILES);
    expect(lots[0].folderName).toBe("Capitolati");
    expect(lots[0].title).toBe("Documenti / Capitolati (1/2)");
    expect(lots[1].title).toBe("Documenti / Capitolati (2/2)");
    expect(lots[2].folderName).toBe("Scan");
    expect(lots[2].title).toBe("Documenti 3/3");
    expect(lots[2].progressLabel).toBe("Lotto 3/3 — Scan");
    expect(lots[0].files).toHaveLength(80);
    expect(lots[1].files).toHaveLength(1);
  });

  it("checkbox: solo le cartelle selezionate diventano lotti", () => {
    const inv = buildFolderInventory([
      fakeFile("Documenti/Capitolati/a.pdf"),
      fakeFile("Documenti/Scan/b.jpg"),
    ]);
    const cap = inv.folders.find((f) => f.name === "Capitolati");
    const lots = buildUploadLots(inv, new Set([cap.key]));
    expect(lots).toHaveLength(1);
    expect(lots[0].folderName).toBe("Capitolati");
  });

  it("stima lotti in italiano e size in MB", () => {
    expect(estimateLotsText(19, 80)).toMatch(/Servono 19 lotti da 80/);
    expect(estimateLotsText(19, 80)).toMatch(/1–2 min a lotto/);
    expect(estimateLotsText(1, 80)).toMatch(/1 lotto/);
    expect(formatImportSize(842 * 1024 * 1024)).toBe("842 MB");
  });

  it("lotDocumentTypeHint non manda commessa al registro", () => {
    expect(lotDocumentTypeHint("capitolato")).toBe("capitolato");
    expect(lotDocumentTypeHint("commessa")).toBeUndefined();
    expect(lotDocumentTypeHint(null)).toBeUndefined();
  });

  it("buildLotTitle per un solo lotto riconosciuto", () => {
    expect(
      buildLotTitle("Documenti", {
        guessedType: "procedura",
        folderName: "Procedure",
        folderIndex: 1,
        folderTotal: 1,
        globalIndex: 1,
        globalTotal: 1,
      })
    ).toBe("Documenti / Procedure");
  });

  it("ROOT_FOLDER_KEY per file nella radice", () => {
    const inv = buildFolderInventory([fakeFile("Documenti/solo.pdf")]);
    expect(inv.folders[0].key).toBe(ROOT_FOLDER_KEY);
  });
});
