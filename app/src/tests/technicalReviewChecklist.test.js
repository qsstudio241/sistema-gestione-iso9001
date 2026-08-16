import { describe, it, expect } from "vitest";
import { TECHNICAL_REVIEW_ITEMS } from "../data/technicalReviewItems";
import {
  applyTechnicalReviewCompletionStamp,
  checklistForWordExport,
  formatTechnicalReviewCompletion,
  isTechnicalReviewComplete,
  parseTechnicalReviewChecklist,
} from "../utils/technicalReviewChecklist";

function allChecked() {
  const checklist = {};
  for (const item of TECHNICAL_REVIEW_ITEMS) {
    checklist[item.key] = { checked: true };
  }
  return checklist;
}

describe("technicalReviewChecklist", () => {
  it("17 punti: incompleta se manca una spunta", () => {
    const c = allChecked();
    c.subfornitura = { checked: false };
    expect(isTechnicalReviewComplete(c)).toBe(false);
  });

  it("completa solo con tutti i 17 punti", () => {
    expect(isTechnicalReviewComplete(allChecked())).toBe(true);
    expect(TECHNICAL_REVIEW_ITEMS).toHaveLength(17);
  });

  it("al primo completamento scrive data e utente", () => {
    const stamped = applyTechnicalReviewCompletionStamp(allChecked(), {
      user_id: 9,
      full_name: "Mario Rossi",
    }, new Date("2026-08-16T10:00:00.000Z"));
    expect(stamped._completion.by_user_id).toBe(9);
    expect(stamped._completion.by_name).toBe("Mario Rossi");
    expect(stamped._completion.at).toBe("2026-08-16T10:00:00.000Z");
    expect(formatTechnicalReviewCompletion(stamped._completion)).toContain("Mario Rossi");
  });

  it("conserva il primo timbro se resta completa", () => {
    const first = applyTechnicalReviewCompletionStamp(allChecked(), {
      user_id: 1,
      full_name: "Anna",
    }, new Date("2026-01-01T00:00:00.000Z"));
    const second = applyTechnicalReviewCompletionStamp(first, {
      user_id: 2,
      full_name: "Luca",
    }, new Date("2026-08-16T00:00:00.000Z"));
    expect(second._completion.by_name).toBe("Anna");
    expect(second._completion.at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("toglie il timbro se si toglie una spunta", () => {
    const complete = applyTechnicalReviewCompletionStamp(allChecked(), {
      user_id: 1,
      full_name: "Anna",
    });
    complete.gestione_nc = { checked: false };
    const next = applyTechnicalReviewCompletionStamp(complete, { user_id: 1, full_name: "Anna" });
    expect(next._completion).toBeUndefined();
    expect(isTechnicalReviewComplete(next)).toBe(false);
  });

  it("Word: niente timbro locale se il server non l'ha ancora salvato", () => {
    const local = applyTechnicalReviewCompletionStamp(allChecked(), {
      user_id: 9,
      full_name: "Mario Rossi",
    }, new Date("2026-08-16T10:00:00.000Z"));
    const forWord = checklistForWordExport(local, null);
    expect(forWord._completion).toBeUndefined();
    expect(forWord.materiale_base.checked).toBe(true);
  });

  it("Word: se in form manca una spunta, niente timbro anche se persistito", () => {
    const local = { ...allChecked(), gestione_nc: { checked: false } };
    const persisted = JSON.stringify({
      ...allChecked(),
      _completion: { at: "2026-02-01T00:00:00.000Z", by_user_id: 1, by_name: "Anna" },
    });
    const forWord = checklistForWordExport(local, persisted);
    expect(forWord._completion).toBeUndefined();
    expect(forWord.gestione_nc.checked).toBe(false);
  });

  it("Word: usa il timbro persistito, non quello locale", () => {
    const local = applyTechnicalReviewCompletionStamp(allChecked(), {
      user_id: 9,
      full_name: "Falso",
    }, new Date("2099-01-01T00:00:00.000Z"));
    const persisted = JSON.stringify({
      ...allChecked(),
      _completion: { at: "2026-02-01T00:00:00.000Z", by_user_id: 1, by_name: "Anna" },
    });
    const forWord = checklistForWordExport(local, persisted);
    expect(forWord._completion.by_name).toBe("Anna");
    expect(forWord._completion.at).toBe("2026-02-01T00:00:00.000Z");
  });

  it("parse JSON string e oggetto", () => {
    expect(parseTechnicalReviewChecklist('{"materiale_base":{"checked":true}}').materiale_base.checked).toBe(true);
    expect(parseTechnicalReviewChecklist({ materiale_base: { checked: true } }).materiale_base.checked).toBe(true);
    expect(parseTechnicalReviewChecklist("nope")).toEqual({});
  });
});
