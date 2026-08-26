/**
 * CND-W — method_params PT/MT → placeholder semantici Word (appendice PLAN).
 */
import { describe, it, expect } from "vitest";
import {
    buildVtTemplateData,
    buildPtMtPlaceholderData,
    WORD_CHECK_ON,
    WORD_CHECK_OFF,
} from "../utils/vtWordExport.js";

describe("vtWordExport CND-W placeholders", () => {
    it("PT: un solo acc acceso; cleaning multi; testo consumabili; niente FORMCHECKBOX", () => {
        const report = {
            report_type: "PT",
            report_number: "PT-01",
            inspection_date: "2026-08-20",
            certificate_date: "2026-08-21",
            responsible: "Rossi",
            inspector: "Bianchi",
            client_representative: "Verdi",
            method_params: {
                pt: {
                    acc: "l2",
                    surface: "grd",
                    cleaning: ["gr", "br"],
                    application: "spray",
                    final: "ok",
                    inspection_pct: "100",
                    pen: "PENTRIX 100",
                    pen_lot: "3416",
                    sol: "METACLEAN 300",
                    sol_lot: "3515",
                    det: "RIVELEX 200",
                    det_lot: "3030",
                    lux: "600",
                    temp: "15",
                    defects: {
                        "100": { present: "yes", outcome: "A" },
                        "2017": { present: "na", outcome: "NA" },
                        "502": { present: "na", outcome: "NA" },
                        "503": { present: "yes", outcome: "S" },
                    },
                },
            },
        };
        const data = buildVtTemplateData(report);

        expect(data.pt_acc_l2).toBe(WORD_CHECK_ON);
        expect(data.pt_acc_l1).toBe(WORD_CHECK_OFF);
        expect(data.pt_acc_l3).toBe(WORD_CHECK_OFF);
        expect(data.pt_sup_grd).toBe(WORD_CHECK_ON);
        expect(data.pt_sup_asw).toBe(WORD_CHECK_OFF);
        expect(data.pt_cln_gr).toBe(WORD_CHECK_ON);
        expect(data.pt_cln_br).toBe(WORD_CHECK_ON);
        expect(data.pt_cln_sb).toBe(WORD_CHECK_OFF);
        expect(data.pt_app_spray).toBe(WORD_CHECK_ON);
        expect(data.pt_app_dip).toBe(WORD_CHECK_OFF);
        expect(data.pt_final_ok).toBe(WORD_CHECK_ON);
        expect(data.pt_final_ko).toBe(WORD_CHECK_OFF);
        expect(data.pt_pen).toBe("PENTRIX 100");
        expect(data.pt_pen_lot).toBe("3416");
        expect(data.pt_lux).toBe("600");
        expect(data.inspection_pct).toBe("100");
        expect(data.pt_d_100_yn).toBe("sì");
        expect(data.pt_d_100_a).toBe("A");
        expect(data.pt_d_2017_yn).toBe("NA");
        expect(data.pt_d_502_na).toBe(WORD_CHECK_ON);
        expect(data.pt_d_503_na).toBe(WORD_CHECK_OFF);
        expect(data.pt_d_515_na).toBe(WORD_CHECK_ON);
        expect(data.pt_name_resp).toBe("Rossi");
        expect(Object.keys(data).some((k) => /Controllo\d/i.test(k))).toBe(false);
    });

    it("MT: tracer esclusivo + campi testo; VT lux non toccati da buildPtMt", () => {
        const report = {
            report_type: "MT",
            method_params: {
                mt: {
                    tracer: "wet",
                    mag: "yoke",
                    mag_mode: "dir",
                    demag: "no",
                    pole_pitch: "150-180",
                    curr_type: "CA",
                    curr_a: "12",
                    field: "3",
                    surf: "M",
                    judg: "A",
                    inspection_pct: "100",
                },
            },
        };
        const data = buildVtTemplateData(report);
        expect(data.mt_tr_wet).toBe(WORD_CHECK_ON);
        expect(data.mt_tr_dry).toBe(WORD_CHECK_OFF);
        expect(data.mt_tr_flu).toBe(WORD_CHECK_OFF);
        expect(data.mt_mag_yoke).toBe(WORD_CHECK_ON);
        expect(data.mt_mag_prod).toBe(WORD_CHECK_OFF);
        expect(data.mt_mag_dir).toBe(WORD_CHECK_ON);
        expect(data.mt_demag_no).toBe(WORD_CHECK_ON);
        expect(data.mt_demag_yes).toBe(WORD_CHECK_OFF);
        expect(data.mt_pole_pitch).toBe("150-180");
        expect(data.mt_surf).toBe("M");
        expect(data.mt_judg).toBe("A");
        expect(data.pt_acc_l1).toBeUndefined();
    });

    it("VT: lux invariati; buildPtMt non aggiunge flag PT/MT", () => {
        const report = {
            report_type: "VT",
            method_params: {
                illuminance_min: 400,
                illuminance_max: 600,
                illuminance_measured: "450",
            },
            items: [{ position_code: "W1", evaluation: "A" }],
        };
        const data = buildVtTemplateData(report);
        expect(data.illuminanceMin).toBe("400");
        expect(data.illuminanceMax).toBe("600");
        expect(data.illuminanceMeasured).toBe("450");
        expect(data.items).toHaveLength(1);
        expect(data.pt_acc_l1).toBeUndefined();
        expect(data.mt_tr_wet).toBeUndefined();
        expect(buildPtMtPlaceholderData(report, report.method_params)).toEqual({});
    });
});
