/**
 * @vitest-environment jsdom
 * Storico testo NC — chiave namespaced per organization_id (Passo 1).
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  appendTextFieldHistory,
  getTextFieldHistory,
  textHistoryStorageKey,
} from "../utils/textFieldHistory.js";
import {
  saveNcFieldDraft,
  loadNcFieldDraft,
} from "../utils/ncFieldDraftStorage.js";

describe("textFieldHistory — tenant scope", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("chiave include organization_id", () => {
    expect(textHistoryStorageKey(1001, "nc-create", "description")).toBe(
      "sgq_text_field_history_v1:1001:nc-create:description",
    );
    expect(textHistoryStorageKey(null, "nc-create", "description")).toBeNull();
  });

  it("org A non vede storico org B sullo stesso scope nc-create", () => {
    appendTextFieldHistory(1002, "nc-create", "description", "Testo studio A");
    expect(getTextFieldHistory(1003, "nc-create", "description")).toEqual([]);
    expect(getTextFieldHistory(1002, "nc-create", "description")[0]?.text).toBe(
      "Testo studio A",
    );
  });
});

describe("ncFieldDraftStorage — tenant isolation (già org in chiave)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("org A non carica bozza campo NC di org B", () => {
    saveNcFieldDraft(1002, "nc-create", "description", "Segreto A");
    expect(loadNcFieldDraft(1003, "nc-create", "description")).toBeNull();
    expect(loadNcFieldDraft(1002, "nc-create", "description")?.value).toBe(
      "Segreto A",
    );
  });
});
