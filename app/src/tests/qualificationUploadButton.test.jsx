/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { suggestedDocTypeFromTab } from "../components/QualificationUploadButton.jsx";

describe("suggestedDocTypeFromTab", () => {
  it("suggerisce cert_ndt dalla tab NDT", () => {
    expect(suggestedDocTypeFromTab("ndt")).toBe("cert_ndt");
  });

  it("suggerisce patentino dalle tab saldatori", () => {
    expect(suggestedDocTypeFromTab("iso9606_1")).toBe("patentino_saldatore");
    expect(suggestedDocTypeFromTab("iso9606_2")).toBe("patentino_saldatore");
  });

  it("suggerisce 14732 dalla tab operatori", () => {
    expect(suggestedDocTypeFromTab("iso14732")).toBe("qualifica_14732");
  });

  it("non impone default su tab Tutti / altre", () => {
    expect(suggestedDocTypeFromTab("tutti")).toBe("");
    expect(suggestedDocTypeFromTab("iso14731")).toBe("");
    expect(suggestedDocTypeFromTab("")).toBe("");
  });
});
