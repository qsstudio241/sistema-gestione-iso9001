/**
 * CONS-3: al login dello stesso utente NON si chiama clearAuditsStore.
 * Locale ricco resta se il server è vuoto o vecchio (campi senza contenuto).
 */
import { describe, it, expect, vi } from "vitest";
import {
  loginUserKeyFromUser,
  shouldClearAuditsStoreOnLogin,
  mergeAuditPreferringRichLocal,
  resolveAuditsAfterLogin,
  runLoginAuditHydrate,
} from "../contexts/StorageContext.jsx";

const SAME_USER = {
  user_id: 42,
  email: "auditor@studio.it",
  organization_id: 1004,
};

const OTHER_USER = {
  user_id: 99,
  email: "altro@studio.it",
  organization_id: 1005,
};

function richLocalAudit(overrides = {}) {
  return {
    metadata: {
      id: "audit-giornata",
      auditId: 77,
      generalData: { auditObject: "Verifica SGQ giornata", scope: "Produzione" },
      auditObjective: { description: "Conformità ISO 9001 compilata offline" },
      auditOutcome: { conclusions: "Due osservazioni da chiudere" },
    },
    checklist: {
      ISO_9001_2015: {
        "4.1": {
          questions: [
            { questionId: "q1", status: "C", notes: "Nota ricca della giornata" },
          ],
        },
      },
    },
    ...overrides,
  };
}

function emptyServerAudit(id = "audit-giornata") {
  return {
    metadata: {
      id,
      auditId: 77,
      generalData: { auditObject: "", scope: "" },
      auditObjective: { description: "", participants: [], agenda: "" },
      auditOutcome: {},
    },
    checklist: {},
  };
}

describe("shouldClearAuditsStoreOnLogin (CONS-3)", () => {
  it("stesso utente → non wipe", () => {
    const key = loginUserKeyFromUser(SAME_USER);
    expect(
      shouldClearAuditsStoreOnLogin({
        previousUserKey: key,
        incomingUserKey: key,
      }),
    ).toBe(false);
  });

  it("identità precedente assente (reload / primo login) → non wipe", () => {
    expect(
      shouldClearAuditsStoreOnLogin({
        previousUserKey: null,
        incomingUserKey: loginUserKeyFromUser(SAME_USER),
      }),
    ).toBe(false);
  });

  it("utente incoming assente → non wipe", () => {
    expect(
      shouldClearAuditsStoreOnLogin({
        previousUserKey: loginUserKeyFromUser(SAME_USER),
        incomingUserKey: null,
      }),
    ).toBe(false);
  });

  it("altro utente / altro tenant senza logout → wipe (isolamento)", () => {
    expect(
      shouldClearAuditsStoreOnLogin({
        previousUserKey: loginUserKeyFromUser(SAME_USER),
        incomingUserKey: loginUserKeyFromUser(OTHER_USER),
      }),
    ).toBe(true);
  });
});

describe("resolveAuditsAfterLogin — locale ricco vs server vuoto/vecchio", () => {
  it("server lista vuota → resta l’audit locale ricco", () => {
    const local = [richLocalAudit()];
    const result = resolveAuditsAfterLogin(local, []);
    expect(result).toHaveLength(1);
    expect(result[0].metadata.id).toBe("audit-giornata");
    expect(result[0].metadata.auditObjective.description).toContain("offline");
  });

  it("server vecchio (stesso UUID, campi vuoti) → si tengono note e obiettivi locali", () => {
    const local = richLocalAudit();
    const merged = mergeAuditPreferringRichLocal(local, emptyServerAudit());
    expect(merged.metadata.auditObjective.description).toContain("offline");
    expect(merged.metadata.generalData.auditObject).toContain("giornata");
    expect(merged.metadata.auditOutcome.conclusions).toContain("osservazioni");
    expect(merged.checklist.ISO_9001_2015["4.1"].questions[0].notes).toContain(
      "giornata",
    );
  });

  it("server lista vuota via resolve → stesso esito del merge", () => {
    const local = [richLocalAudit()];
    const serverOld = [emptyServerAudit()];
    const result = resolveAuditsAfterLogin(local, serverOld);
    expect(result).toHaveLength(1);
    expect(result[0].metadata.auditObjective.description).toContain("offline");
  });
});

describe("runLoginAuditHydrate — flusso login", () => {
  it("stesso utente: processQueue sì, clearAuditsStore no, locale resta se server vuoto", async () => {
    const processQueue = vi.fn().mockResolvedValue(undefined);
    const clearAuditsStore = vi.fn().mockResolvedValue(undefined);
    const persistAudits = vi.fn().mockResolvedValue(undefined);
    const local = [richLocalAudit()];
    const key = loginUserKeyFromUser(SAME_USER);

    const out = await runLoginAuditHydrate({
      processQueue,
      clearAuditsStore,
      loadLocalAudits: async () => local,
      fetchServerAudits: async () => [],
      persistAudits,
      previousUserKey: key,
      incomingUserKey: key,
    });

    expect(processQueue).toHaveBeenCalledTimes(1);
    expect(clearAuditsStore).not.toHaveBeenCalled();
    expect(out.clearedAuditsStore).toBe(false);
    expect(out.audits).toHaveLength(1);
    expect(out.audits[0].metadata.auditObjective.description).toContain("offline");
    expect(persistAudits).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ metadata: expect.objectContaining({ id: "audit-giornata" }) }),
      ]),
    );
  });

  it("stesso utente: server vecchio → merge locale ricco, nessun wipe", async () => {
    const clearAuditsStore = vi.fn().mockResolvedValue(undefined);
    const key = loginUserKeyFromUser(SAME_USER);

    const out = await runLoginAuditHydrate({
      processQueue: async () => {},
      clearAuditsStore,
      loadLocalAudits: async () => [richLocalAudit()],
      fetchServerAudits: async () => [emptyServerAudit()],
      persistAudits: async () => {},
      previousUserKey: key,
      incomingUserKey: key,
    });

    expect(clearAuditsStore).not.toHaveBeenCalled();
    expect(out.audits[0].metadata.auditObjective.description).toContain("offline");
    expect(out.audits[0].checklist.ISO_9001_2015["4.1"].questions[0].status).toBe("C");
  });

  it("primo login (nessun previous): fetch fallita = server vuoto → locale resta, nessun wipe", async () => {
    const clearAuditsStore = vi.fn().mockResolvedValue(undefined);

    const out = await runLoginAuditHydrate({
      processQueue: async () => {},
      clearAuditsStore,
      loadLocalAudits: async () => [richLocalAudit()],
      fetchServerAudits: async () => {
        throw new Error("network down");
      },
      persistAudits: async () => {},
      previousUserKey: null,
      incomingUserKey: loginUserKeyFromUser(SAME_USER),
    });

    expect(clearAuditsStore).not.toHaveBeenCalled();
    expect(out.audits).toHaveLength(1);
    expect(out.audits[0].metadata.id).toBe("audit-giornata");
  });

  it("cambio utente: clearAuditsStore viene chiamato", async () => {
    const clearAuditsStore = vi.fn().mockResolvedValue(undefined);

    const out = await runLoginAuditHydrate({
      processQueue: async () => {},
      clearAuditsStore,
      loadLocalAudits: async () => [richLocalAudit()],
      fetchServerAudits: async () => [],
      persistAudits: async () => {},
      previousUserKey: loginUserKeyFromUser(SAME_USER),
      incomingUserKey: loginUserKeyFromUser(OTHER_USER),
    });

    expect(clearAuditsStore).toHaveBeenCalledTimes(1);
    expect(out.clearedAuditsStore).toBe(true);
    expect(out.audits).toHaveLength(0);
  });
});
