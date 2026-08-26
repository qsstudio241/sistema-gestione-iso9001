/**
 * @vitest-environment jsdom
 * CND-3 — method_params PT/MT: placeholder semantici, niente mix PT↔MT, VT piatto.
 */
import { describe, it, expect } from "vitest";
import {
    defaultMethodParams,
    sanitizeMethodParams,
    ptPlaceholderFor,
    mtPlaceholderFor,
    ptDefectPlaceholders,
    SEMANTIC_PLACEHOLDERS,
    PT_DEFECTS,
    MT_DEFECTS,
} from "../utils/ndtMethodParams.js";

describe("ndtMethodParams CND-3", () => {
    it("placeholder semantici del PLAN (non nomi FORMCHECKBOX Word)", () => {
        expect(SEMANTIC_PLACEHOLDERS).toContain("{pt_acc_l2}");
        expect(SEMANTIC_PLACEHOLDERS).toContain("{mt_tr_wet}");
        expect(SEMANTIC_PLACEHOLDERS.every((p) => !/Controllo\d/.test(p))).toBe(true);
        expect(ptPlaceholderFor("acc", "l2")).toBe("{pt_acc_l2}");
        expect(mtPlaceholderFor("tracer", "wet")).toBe("{mt_tr_wet}");
        expect(ptDefectPlaceholders("100")).toEqual({ yn: "{pt_d_100_yn}", a: "{pt_d_100_a}" });
    });

    it("default PT e MT restano nei rispettivi namespace", () => {
        const pt = defaultMethodParams("PT");
        const mt = defaultMethodParams("MT");
        const vt = defaultMethodParams("VT");
        expect(pt.pt).toBeTruthy();
        expect(pt.mt).toBeUndefined();
        expect(pt.illuminance_min).toBeUndefined();
        expect(pt.pt.acc).toBe("l1");
        expect(pt.pt.application).toBe("spray");
        expect(pt.pt.cleaning).toEqual(["gr", "br"]);
        expect(mt.mt).toBeTruthy();
        expect(mt.pt).toBeUndefined();
        expect(mt.mt.tracer).toBe("wet");
        expect(mt.mt.demag).toBe("no");
        expect(vt.illuminance_min).toBe(350);
        expect(vt.pt).toBeUndefined();
        expect(vt.mt).toBeUndefined();
    });

    it("sanitize su PT toglie .mt e i lux VT", () => {
        const mixed = {
            illuminance_min: 350,
            pt: { acc: "l2", application: "dip" },
            mt: { tracer: "dry" },
        };
        const out = sanitizeMethodParams("PT", mixed);
        expect(out.pt.acc).toBe("l2");
        expect(out.pt.application).toBe("dip");
        expect(out.mt).toBeUndefined();
        expect(out.illuminance_min).toBeUndefined();
        expect(Object.keys(out)).toEqual(["pt"]);
    });

    it("sanitize su MT toglie .pt; VT resta piatto senza pt/mt", () => {
        const mixed = {
            illuminance_measured: "420",
            pt: { acc: "l3" },
            mt: { tracer: "flu", judg: "R" },
        };
        const mt = sanitizeMethodParams("MT", mixed);
        expect(mt.mt.tracer).toBe("flu");
        expect(mt.mt.judg).toBe("R");
        expect(mt.pt).toBeUndefined();
        const vt = sanitizeMethodParams("VT", mixed);
        expect(vt.illuminance_measured).toBe("420");
        expect(vt.illuminance_min).toBe(350);
        expect(vt.pt).toBeUndefined();
        expect(vt.mt).toBeUndefined();
    });

    it("catalogo difetti: PT ha 502–515; MT non ha codice 8", () => {
        expect(PT_DEFECTS.map((d) => d.code)).toContain("502");
        expect(PT_DEFECTS.map((d) => d.code)).toContain("515");
        expect(MT_DEFECTS.map((d) => d.code)).not.toContain("8");
        expect(MT_DEFECTS.map((d) => d.code)).toEqual(["1", "2", "3", "4", "5", "6", "7", "9", "10"]);
    });
});
