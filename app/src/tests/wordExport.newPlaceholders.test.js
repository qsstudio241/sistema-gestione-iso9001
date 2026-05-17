/**
 * Test per i nuovi placeholder estesi di buildTemplateData.
 */
import { describe, it, expect } from "vitest";
import { buildTemplateData } from "../utils/wordExport.js";

function makeAudit(overrides = {}) {
    return {
        metadata: {
            clientName: "Acme Srl",
            auditNumber: "QS_260510_01",
            procedureCode: "PR01",
            auditDate: "2026-05-10",
            auditPartyType: "first_party",
            auditorName: "Mario Rossi",
            selectedStandards: ["ISO_9001"],
            projectYear: "2026",
            status: "completed",
            completedAt: "2026-05-12T10:00:00Z",
            approvedAt: "2026-05-14T08:30:00Z",
            createdAt: "2026-04-01T09:00:00Z",
            lastModified: "2026-05-14T08:30:00Z",
            revisionNumber: "3",
            auditType: "Interno",
            auditorEmail: "mario@studio.it",
            auditorPhone: "+39 0123 456789",
            companyAddress: "Via Roma 10, 00100 Roma",
            nextAuditDate: "2027-05-10",
            generalData: {
                auditObject: "Audit SGQ",
                scope: "Produzione",
                referenceDocuments: ["MQ-01", "PQ-02"],
                processes: "Tutti i processi",
                programCommunicatedDate: "2026-04-20",
                auditors: ["Mario Rossi"],
            },
            auditObjective: {
                description: "Verifica implementazione SGQ",
                participants: [{ role: "Lead Auditor", name: "Mario Rossi" }],
                agenda: "09:00 Apertura\n10:00 Verifica\n12:00 Chiusura",
            },
            auditOutcome: {
                conclusions: "Audit positivo con osservazioni.",
                nextAuditDate: "2027-05-10",
            },
            ...overrides,
        },
        checklist: {
            ISO_9001: {
                s4: {
                    title: "Contesto",
                    questions: [
                        { status: "C", text: "Q1" },
                        { status: "NC", text: "Q2" },
                        { status: "OSS", text: "Q3" },
                        { status: "OM", text: "Q4" },
                        { status: "NA", text: "Q5" },
                        { status: "NV", text: "Q6" },
                        { status: null, text: "Q7" },
                    ],
                },
            },
        },
        exportOrganizationBranding: { name: "Studio ABC", vat: "IT01234567890" },
    };
}

describe("buildTemplateData — nuovi placeholder", () => {
    it("revisionNumber: espone meta.revisionNumber", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.revisionNumber).toBe("3");
    });

    it("revisionNumber: fallback a meta.revision", () => {
        const d = buildTemplateData(makeAudit({ revisionNumber: undefined, revision: "5" }));
        expect(d.revisionNumber).toBe("5");
    });

    it("revisionNumber: vuoto se assente", () => {
        const d = buildTemplateData(makeAudit({ revisionNumber: undefined }));
        expect(d.revisionNumber).toBe("");
    });

    it("auditorEmail e auditorPhone: esposti correttamente", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.auditorEmail).toBe("mario@studio.it");
        expect(d.auditorPhone).toBe("+39 0123 456789");
    });

    it("auditorEmail/Phone: vuoti se non presenti", () => {
        const d = buildTemplateData(makeAudit({ auditorEmail: undefined, auditorPhone: undefined }));
        expect(d.auditorEmail).toBe("");
        expect(d.auditorPhone).toBe("");
    });

    it("companyAddress: da exportCompanyAddress", () => {
        const d = buildTemplateData(makeAudit({ exportCompanyAddress: "Via Verdi 5" }));
        expect(d.companyAddress).toBe("Via Verdi 5");
    });

    it("companyAddress: fallback a companyAddress, poi clientAddress", () => {
        const d = buildTemplateData(makeAudit({ companyAddress: "Via Garibaldi 3" }));
        expect(d.companyAddress).toBe("Via Garibaldi 3");
    });

    it("nextAuditDate: formattata da metadata", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.nextAuditDate).toBe("10/05/2027");
    });

    it("nextAuditDate: fallback a outcome.nextAuditDate", () => {
        const d = buildTemplateData(makeAudit({ nextAuditDate: undefined }));
        expect(d.nextAuditDate).toBe("10/05/2027");
    });

    it("nextAuditDate: N/D se assente ovunque", () => {
        const a = makeAudit({ nextAuditDate: undefined });
        a.metadata.auditOutcome = { conclusions: "ok" };
        const d = buildTemplateData(a);
        expect(d.nextAuditDate).toBe("N/D");
    });

    it("referenceStandard: etichetta singola da normKey", () => {
        const d = buildTemplateData(makeAudit(), "ISO_9001");
        expect(d.referenceStandard).toBe("ISO 9001:2015");
    });

    it("referenceStandard: unione di selectedStandards se normKey assente", () => {
        const a = makeAudit({ selectedStandards: ["ISO_9001", "ISO_14001"] });
        const d = buildTemplateData(a);
        expect(d.referenceStandard).toBe("ISO 9001:2015, ISO 14001:2015");
    });

    it("referenceStandard: vuoto se nessun standard", () => {
        const a = makeAudit({ selectedStandards: [] });
        const d = buildTemplateData(a);
        expect(d.referenceStandard).toBe("");
    });

    it("overallOutcome: 'Non conforme' se NC presenti", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.overallOutcome).toBe("Non conforme");
    });

    it("overallOutcome: 'Con osservazioni' se solo OSS/OM", () => {
        const a = makeAudit();
        a.checklist = { ISO_9001: { s4: { questions: [
            { status: "C" }, { status: "OSS" },
        ]}}};
        const d = buildTemplateData(a);
        expect(d.overallOutcome).toBe("Con osservazioni");
    });

    it("overallOutcome: 'Conforme' se solo C", () => {
        const a = makeAudit();
        a.checklist = { ISO_9001: { s4: { questions: [
            { status: "C" }, { status: "C" },
        ]}}};
        const d = buildTemplateData(a);
        expect(d.overallOutcome).toBe("Conforme");
    });

    it("overallOutcome: 'Non valutato' se zero risposte", () => {
        const a = makeAudit();
        a.checklist = {};
        const d = buildTemplateData(a);
        expect(d.overallOutcome).toBe("Non valutato");
    });

    it("auditType: espone valore", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.auditType).toBe("Interno");
    });

    it("projectYear: espone anno progetto", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.projectYear).toBe("2026");
    });

    it("projectYear: fallback anno corrente se non presente", () => {
        const d = buildTemplateData(makeAudit({ projectYear: undefined }));
        expect(d.projectYear).toBe(String(new Date().getFullYear()));
    });

    it("totalQuestions, answeredQuestions, notAnsweredCount: calcolati", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.totalQuestions).toBe("7");
        expect(d.answeredQuestions).toBe("6");
        expect(d.notAnsweredCount).toBe("1");
    });

    it("auditStatus: espone stato audit", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.auditStatus).toBe("completed");
    });

    it("completedDate: formattata", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.completedDate).toBe("12/05/2026");
    });

    it("approvedDate: formattata", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.approvedDate).toBe("14/05/2026");
    });

    it("createdDate: formattata", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.createdDate).toBe("01/04/2026");
    });

    it("lastModifiedDate: formattata", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.lastModifiedDate).toBe("14/05/2026");
    });

    it("date: N/D se assenti", () => {
        const d = buildTemplateData(makeAudit({
            completedAt: undefined,
            approvedAt: undefined,
            createdAt: undefined,
            lastModified: undefined,
        }));
        expect(d.completedDate).toBe("N/D");
        expect(d.approvedDate).toBe("N/D");
        expect(d.createdDate).toBe("N/D");
        expect(d.lastModifiedDate).toBe("N/D");
    });

    it("agenda: espone stringa testuale", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.agenda).toContain("09:00 Apertura");
    });

    it("agenda: vuota se non presente", () => {
        const a = makeAudit();
        a.metadata.auditObjective = { description: "Test" };
        const d = buildTemplateData(a);
        expect(d.agenda).toBe("");
    });

    it("placeholder esistenti ancora presenti e invariati", () => {
        const d = buildTemplateData(makeAudit());
        expect(d.clientName).toBe("Acme Srl");
        expect(d.auditNumber).toBe("QS_260510_01");
        expect(d.auditor).toBe("Mario Rossi");
        expect(d.organizationName).toBe("Studio ABC");
        expect(d.cCount).toBe("1");
        expect(d.ncCount).toBe("1");
        expect(d.ossCount).toBe("1");
        expect(d.omCount).toBe("1");
        expect(d.naCount).toBe("1");
        expect(d.nvCount).toBe("1");
    });
});
