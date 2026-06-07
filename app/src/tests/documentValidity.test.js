/**
 * Test L1 — documentValidity.js
 * Vigore documento vs cartelle nel Registro Documenti.
 */
import { describe, it, expect } from "vitest";
import {
  isDocumentFolder,
  isReleasedDocStatus,
  isDocumentVigente,
  shouldShowDocumentStatusBadge,
  normalizeRegistryDocStatusForApi,
  registryDocStatusForForm,
} from "../utils/documentValidity";

describe("documentValidity — normalizeRegistryDocStatusForApi", () => {
  it("mappa vigente legacy a rilasciato", () => {
    expect(normalizeRegistryDocStatusForApi("vigente")).toBe("rilasciato");
  });

  it("non confonde con validity_status norme (superata resta invalida lato API)", () => {
    expect(normalizeRegistryDocStatusForApi("superata")).toBe("superata");
  });

  it("registryDocStatusForForm normalizza documenti legacy", () => {
    expect(registryDocStatusForForm("vigente")).toBe("rilasciato");
    expect(registryDocStatusForForm("bozza")).toBe("bozza");
  });
});

describe("documentValidity — isDocumentFolder", () => {
  it("ritorna true per doc_type folder", () => {
    expect(isDocumentFolder({ doc_type: "folder", title: "Procedure" })).toBe(true);
  });

  it("ritorna true per is_system_folder", () => {
    expect(isDocumentFolder({ doc_type: "procedura", is_system_folder: true })).toBe(true);
  });

  it("ritorna false per documento normale", () => {
    expect(isDocumentFolder({ doc_type: "procedura", status: "vigente" })).toBe(false);
  });
});

describe("documentValidity — isReleasedDocStatus", () => {
  it("accetta rilasciato e vigente", () => {
    expect(isReleasedDocStatus("rilasciato")).toBe(true);
    expect(isReleasedDocStatus("vigente")).toBe(true);
  });

  it("rifiuta altri stati", () => {
    expect(isReleasedDocStatus("bozza")).toBe(false);
    expect(isReleasedDocStatus("obsoleto")).toBe(false);
  });
});

describe("documentValidity — isDocumentVigente", () => {
  it("documento vigente conta come vigente", () => {
    expect(isDocumentVigente({ doc_type: "procedura", status: "vigente" })).toBe(true);
    expect(isDocumentVigente({ doc_type: "manuale", status: "rilasciato" })).toBe(true);
  });

  it("cartella con status vigente NON conta come vigente", () => {
    expect(isDocumentVigente({ doc_type: "folder", status: "vigente" })).toBe(false);
    expect(isDocumentVigente({ doc_type: "folder", status: "rilasciato" })).toBe(false);
  });

  it("documento bozza non è vigente", () => {
    expect(isDocumentVigente({ doc_type: "procedura", status: "bozza" })).toBe(false);
  });
});

describe("documentValidity — shouldShowDocumentStatusBadge", () => {
  it("mostra badge su documento con status", () => {
    expect(shouldShowDocumentStatusBadge({ doc_type: "procedura", status: "vigente" })).toBe(true);
  });

  it("NON mostra badge su cartella anche con status vigente", () => {
    expect(shouldShowDocumentStatusBadge({ doc_type: "folder", status: "vigente" })).toBe(false);
    expect(shouldShowDocumentStatusBadge({ is_system_folder: true, status: "rilasciato" })).toBe(false);
  });

  it("NON mostra badge se status assente", () => {
    expect(shouldShowDocumentStatusBadge({ doc_type: "procedura" })).toBe(false);
  });
});
