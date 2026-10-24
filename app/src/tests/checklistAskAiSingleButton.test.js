import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

describe("un solo Chiedi all'AI in checklist", () => {
  it("ChecklistModule non monta più AskAiButton", () => {
    const src = readSrc("components/ChecklistModule.jsx");
    expect(src).not.toMatch(/AskAiButton/);
    expect(src).toMatch(/UniversalQuestionCard/);
  });

  it("CustomChecklistAuditView non monta più AskAiButton", () => {
    const src = readSrc("components/CustomChecklistAuditView.jsx");
    expect(src).not.toMatch(/AskAiButton/);
    expect(src).toMatch(/QuestionCard/);
  });

  it("QuestionCard monta un solo QuestionAiPanel e non naviga a /ai-assistant", () => {
    const src = readSrc("components/QuestionCard.jsx");
    expect(src.match(/QuestionAiPanel/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).not.toMatch(/\/ai-assistant/);
    expect(src).not.toMatch(/AskAiButton/);
  });
});
