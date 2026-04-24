import { describe, it, expect } from "vitest";
import { toNumericChecklistQuestionId } from "../utils/attachmentQuestionId";

describe("toNumericChecklistQuestionId", () => {
  it("accetta numero positivo", () => {
    expect(toNumericChecklistQuestionId(87)).toBe(87);
  });

  it("accetta stringa numerica pura", () => {
    expect(toNumericChecklistQuestionId("87")).toBe(87);
  });

  it("rifiuta riferimento clausola tipo 7.5.3", () => {
    expect(toNumericChecklistQuestionId("7.5.3")).toBeUndefined();
  });

  it("gestisce null e stringa vuota", () => {
    expect(toNumericChecklistQuestionId(null)).toBeUndefined();
    expect(toNumericChecklistQuestionId("")).toBeUndefined();
  });
});
