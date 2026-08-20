/**
 * Completamento chiusura: ignora checklist attivate e poi spente in 1.1.
 * Caso reale AUD-260819-01: 22 risposte ISO_3834_2 + 36 vuote RDP_MSN → 38%.
 */
import { describe, it, expect } from "vitest";
import {
  pickChecklistForSelectedStandards,
  calcChecklistCompletion,
  getFirstUnansweredTarget,
  pruneUnansweredDeselectedChecklist,
  applyPrunedChecklist,
} from "./activeAuditChecklist";

function q(status, questionId = null) {
  return { status, questionId, notes: "" };
}

function clause(questions) {
  return { questions };
}

/** 22 domande ISO 3834-2 in campo, tutte risposte (come in produzione). */
function iso3834Complete() {
  const questions = Array.from({ length: 22 }, (_, i) =>
    q(i === 0 ? "NC" : i < 4 ? "OSS" : "C", 3800 + i),
  );
  return {
    "3834_s5": clause(questions.slice(0, 10)),
    "3834_s6": clause(questions.slice(10)),
  };
}

/** Template RDP_MSN leftover: 36 vuote, questionId spesso null se mai idratato. */
function rdpMsnEmpty() {
  return {
    "3834_s4": clause(Array.from({ length: 18 }, () => q("NOT_ANSWERED", null))),
    "3834_s7": clause(Array.from({ length: 18 }, () => q("NOT_ANSWERED", null))),
  };
}

function leftoverChecklist() {
  return {
    ISO_3834_2: iso3834Complete(),
    RDP_MSN: rdpMsnEmpty(),
  };
}

describe("pickChecklistForSelectedStandards", () => {
  it("con solo ISO_3834_2 selezionato esclude il leftover RDP_MSN", () => {
    const picked = pickChecklistForSelectedStandards(leftoverChecklist(), [
      "ISO_3834_2",
    ]);
    expect(Object.keys(picked)).toEqual(["ISO_3834_2"]);
    expect(picked.RDP_MSN).toBeUndefined();
  });

  it("risolve alias ISO_3834 verso la key canonica ISO_3834_2", () => {
    const checklist = { ISO_3834: iso3834Complete() };
    const picked = pickChecklistForSelectedStandards(checklist, ["ISO_3834_2"]);
    expect(picked.ISO_3834_2).toBeDefined();
    expect(picked.ISO_3834).toBeUndefined();
  });
});

describe("calcChecklistCompletion — AUD-260819-01", () => {
  it("il blob intero (3834 + RDP vuoto) è ~38%", () => {
    expect(calcChecklistCompletion(leftoverChecklist())).toBe(38);
  });

  it("solo le norme selezionate in 1.1 sono al 100%", () => {
    const picked = pickChecklistForSelectedStandards(leftoverChecklist(), [
      "ISO_3834_2",
    ]);
    expect(calcChecklistCompletion(picked)).toBe(100);
  });
});

describe("getFirstUnansweredTarget", () => {
  it("sul blob intero la prima vuota è RDP (nascosta, fieldId null)", () => {
    const target = getFirstUnansweredTarget(leftoverChecklist());
    expect(target.subsId).toBe("rdp-msn");
    expect(target.fieldId).toBeNull();
  });

  it("sulle sole norme selezionate non c'è nulla da completare", () => {
    const picked = pickChecklistForSelectedStandards(leftoverChecklist(), [
      "ISO_3834_2",
    ]);
    expect(getFirstUnansweredTarget(picked)).toEqual({
      subsId: null,
      fieldId: null,
    });
  });

  it("se la 3834 ha un buco, punta a quella domanda visibile", () => {
    const checklist = leftoverChecklist();
    checklist.ISO_3834_2["3834_s5"].questions[2].status = "NOT_ANSWERED";
    const picked = pickChecklistForSelectedStandards(checklist, ["ISO_3834_2"]);
    const target = getFirstUnansweredTarget(picked);
    expect(target.subsId).toBe("iso-3834");
    expect(target.fieldId).toBe("question-3802");
  });
});

describe("pruneUnansweredDeselectedChecklist", () => {
  it("rimuove RDP_MSN vuoto e lascia ISO_3834_2", () => {
    const pruned = pruneUnansweredDeselectedChecklist(leftoverChecklist(), [
      "ISO_3834_2",
    ]);
    expect(pruned).not.toBeNull();
    expect(Object.keys(pruned)).toEqual(["ISO_3834_2"]);
  });

  it("non tocca una norma deselezionata se ha almeno una risposta", () => {
    const checklist = leftoverChecklist();
    checklist.RDP_MSN["3834_s4"].questions[0].status = "C";
    expect(
      pruneUnansweredDeselectedChecklist(checklist, ["ISO_3834_2"]),
    ).toBeNull();
  });

  it("no-op se selectedStandards è vuoto (niente wipe in race di load)", () => {
    expect(pruneUnansweredDeselectedChecklist(leftoverChecklist(), [])).toBeNull();
    expect(pruneUnansweredDeselectedChecklist(leftoverChecklist(), null)).toBeNull();
  });

  it("no-op se non c'è leftover", () => {
    const only3834 = { ISO_3834_2: iso3834Complete() };
    expect(
      pruneUnansweredDeselectedChecklist(only3834, ["ISO_3834_2"]),
    ).toBeNull();
  });
});

describe("applyPrunedChecklist", () => {
  it("riallinea completionPercentage a 100 dopo il prune", () => {
    const audit = {
      checklist: leftoverChecklist(),
      metrics: { completionPercentage: 38, totalQuestions: 58, answeredQuestions: 22 },
    };
    const pruned = pruneUnansweredDeselectedChecklist(audit.checklist, [
      "ISO_3834_2",
    ]);
    const next = applyPrunedChecklist(audit, pruned);
    expect(next.metrics.completionPercentage).toBe(100);
    expect(next.metrics.totalQuestions).toBe(22);
    expect(next.metrics.answeredQuestions).toBe(22);
    expect(next.checklist.RDP_MSN).toBeUndefined();
  });
});
