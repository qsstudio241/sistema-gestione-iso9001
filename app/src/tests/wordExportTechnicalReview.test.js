import { describe, it, expect, vi } from "vitest";
import PizZip from "pizzip";
import { TECHNICAL_REVIEW_ITEMS } from "../data/technicalReviewItems";
import { applyTechnicalReviewCompletionStamp } from "../utils/technicalReviewChecklist";
import { generateTechnicalReviewBlob } from "../utils/wordExportTechnicalReview";

vi.mock("file-saver", () => ({ saveAs: vi.fn(), default: { saveAs: vi.fn() } }));

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

describe("wordExportTechnicalReview", () => {
  it("produce OOXML con commessa, un punto §5.3 e il timbro", async () => {
    const checklist = {};
    for (const item of TECHNICAL_REVIEW_ITEMS) {
      checklist[item.key] = { checked: true };
    }
    const stamped = applyTechnicalReviewCompletionStamp(checklist, {
      user_id: 3,
      full_name: "Paola Verdi",
    }, new Date("2026-08-16T12:00:00.000Z"));

    const blob = await generateTechnicalReviewBlob({
      projectCode: "CM-2026-009",
      clientName: "Mason",
      status: "aperta",
      checklist: stamped,
    });
    expect(blob.size).toBeGreaterThan(500);

    const zip = new PizZip(await blobToArrayBuffer(blob));
    expect(zip.files["word/document.xml"]).toBeTruthy();
    const xml = zip.files["word/document.xml"].asText();
    expect(xml).toContain("CM-2026-009");
    expect(xml).toContain("Materiale base");
    expect(xml).toContain("Paola Verdi");
    expect(xml).toContain("3834");
  });
});
