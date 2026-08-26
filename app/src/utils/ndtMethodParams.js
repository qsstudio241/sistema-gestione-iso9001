/**
 * CND-3 — catalogo flag PT/MT → method_params JSON.
 * Placeholder semantici allineati a PLAN_CND appendice (Word Mason 23/08).
 * Un verbale = un metodo: sanitize non mescola .pt e .mt.
 */

const VT_KEYS = ["illuminance_min", "illuminance_max", "illuminance_measured", "power_w", "wavelength"];

export const PT_ACC_OPTIONS = [
    { value: "l1", label: "L1 \u2014 lin. l\u22642 / n.lin. d\u22644", placeholder: "{pt_acc_l1}" },
    { value: "l2", label: "L2 \u2014 l\u22644 / d\u22646", placeholder: "{pt_acc_l2}" },
    { value: "l3", label: "L3 \u2014 l\u22648 / d\u22648", placeholder: "{pt_acc_l3}" },
];

export const PT_SURFACE_OPTIONS = [
    { value: "asw", label: "Come saldato", placeholder: "{pt_sup_asw}" },
    { value: "grd", label: "Molato", placeholder: "{pt_sup_grd}" },
    { value: "mac", label: "Lav. macchina", placeholder: "{pt_sup_mac}" },
    { value: "frg", label: "Forgiato", placeholder: "{pt_sup_frg}" },
];

export const PT_CLEANING_OPTIONS = [
    { value: "gr", label: "Molatura", placeholder: "{pt_cln_gr}" },
    { value: "br", label: "Spazzolatura", placeholder: "{pt_cln_br}" },
    { value: "sb", label: "Sabbiatura", placeholder: "{pt_cln_sb}" },
];

export const PT_APP_OPTIONS = [
    { value: "spray", label: "Spray", placeholder: "{pt_app_spray}" },
    { value: "dip", label: "Immersione", placeholder: "{pt_app_dip}" },
    { value: "brush", label: "Pennello", placeholder: "{pt_app_brush}" },
];

export const PT_FINAL_OPTIONS = [
    { value: "ok", label: "SI \u2014 soddisfacente", placeholder: "{pt_final_ok}", cls: "compliant" },
    { value: "ko", label: "NO \u2014 non soddisfacente", placeholder: "{pt_final_ko}", cls: "non-compliant" },
];

/** Difetti PT ISO 6520 — presenza sì|NA, esito A|NA|S. */
export const PT_DEFECTS = [
    { code: "100", label: "Cricche", iso: "100\u2013104" },
    { code: "2017", label: "Porosit\u00e0 superficiale", iso: "2017" },
    { code: "401", label: "Mancata fusione", iso: "401" },
    { code: "402", label: "Mancata penetrazione", iso: "402" },
    { code: "5011", label: "Incisione marginale", iso: "5011\u20135012" },
    { code: "5013", label: "Incisione al vertice", iso: "5013" },
    { code: "502", label: "Sovrametallo eccessivo", iso: "502" },
    { code: "503", label: "Convessit\u00e0 eccessiva", iso: "503" },
    { code: "504", label: "Eccesso di penetrazione", iso: "504" },
    { code: "5041", label: "Sgocciolamento", iso: "5041" },
    { code: "506", label: "Traboccamento", iso: "506" },
    { code: "507", label: "Slivellamento", iso: "507" },
    { code: "509", label: "Avvallamento", iso: "509" },
    { code: "511", label: "Riempimento incompleto", iso: "511" },
    { code: "512", label: "Asimmetria eccessiva", iso: "512" },
    { code: "515", label: "Insellamento al vertice", iso: "515" },
    { code: "517", label: "Ripresa difettosa", iso: "517" },
    { code: "601", label: "Colpo d\u2019arco", iso: "601" },
    { code: "602", label: "Spruzzi", iso: "602" },
];

export const PT_PRESENT_OPTIONS = [
    { value: "yes", label: "s\u00ec", cls: "compliant" },
    { value: "na", label: "NA", cls: "not-applicable" },
];

export const PT_OUTCOME_OPTIONS = [
    { value: "A", label: "A", cls: "compliant" },
    { value: "NA", label: "NA", cls: "not-applicable" },
    { value: "S", label: "S", cls: "non-compliant" },
];

export const MT_TRACER_OPTIONS = [
    { value: "dry", label: "Secco", placeholder: "{mt_tr_dry}" },
    { value: "wet", label: "Umido", placeholder: "{mt_tr_wet}" },
    { value: "flu", label: "Fluorescente", placeholder: "{mt_tr_flu}" },
];

export const MT_MAG_OPTIONS = [
    { value: "prod", label: "Puntali", placeholder: "{mt_mag_prod}" },
    { value: "yoke", label: "Giogo", placeholder: "{mt_mag_yoke}" },
    { value: "coil", label: "Bobina", placeholder: "{mt_mag_coil}" },
];

export const MT_MAG_MODE_OPTIONS = [
    { value: "dir", label: "Diretta", placeholder: "{mt_mag_dir}" },
    { value: "res", label: "Residua", placeholder: "{mt_mag_res}" },
];

export const MT_DEMAG_OPTIONS = [
    { value: "yes", label: "S\u00ec", placeholder: "{mt_demag_yes}", cls: "compliant" },
    { value: "no", label: "No", placeholder: "{mt_demag_no}", cls: "not-applicable" },
];

export const MT_SURF_OPTIONS = [
    { value: "S", label: "S \u2014 come saldato", placeholder: "{mt_surf}" },
    { value: "U", label: "U \u2014 macchina", placeholder: "{mt_surf}" },
    { value: "G", label: "G \u2014 grezza", placeholder: "{mt_surf}" },
    { value: "M", label: "M \u2014 molato", placeholder: "{mt_surf}" },
    { value: "L", label: "L \u2014 laminato", placeholder: "{mt_surf}" },
];

export const MT_JUDG_OPTIONS = [
    { value: "A", label: "A \u2014 Accettabile", cls: "compliant", placeholder: "{mt_judg}" },
    { value: "R", label: "R \u2014 Da riparare", cls: "partial", placeholder: "{mt_judg}" },
    { value: "S", label: "S \u2014 Scarto", cls: "non-compliant", placeholder: "{mt_judg}" },
];

/** Codice 8 assente nel Word Mason. */
export const MT_DEFECTS = [
    { code: "1", label: "Cricche affioranti" },
    { code: "2", label: "Ripiegature" },
    { code: "3", label: "Sfogliature" },
    { code: "4", label: "Ricalcature / sigillature" },
    { code: "5", label: "Porosit\u00e0 / risucchi" },
    { code: "6", label: "Soffiature" },
    { code: "7", label: "Incisioni marginali" },
    { code: "9", label: "Sfondamento" },
    { code: "10", label: "Altro" },
];

export function emptyPtDefects() {
    const defects = {};
    PT_DEFECTS.forEach((d) => {
        defects[d.code] = { present: "", outcome: "" };
    });
    return defects;
}

export function emptyMtDefects() {
    const defects = {};
    MT_DEFECTS.forEach((d) => {
        defects[d.code] = false;
    });
    return defects;
}

/** Preset Word Mason (non vincolo normativo). */
export function defaultPtParams() {
    return {
        acc: "l1",
        surface: "",
        cleaning: ["gr", "br"],
        application: "spray",
        inspection_pct: "100",
        pen: "PENTRIX 100",
        pen_lot: "3416",
        sol: "METACLEAN 300",
        sol_lot: "3515",
        det: "RIVELEX 200",
        det_lot: "3030",
        lux: "600",
        temp: "15",
        final: "ok",
        defects: emptyPtDefects(),
    };
}

export function defaultMtParams() {
    return {
        tracer: "wet",
        mag: "",
        mag_mode: "dir",
        pole_pitch: "",
        curr_type: "",
        curr_a: "",
        field: "",
        demag: "no",
        surf: "",
        inspection_pct: "100",
        judg: "",
        defects: emptyMtDefects(),
    };
}

export function defaultVtParams() {
    return {
        illuminance_min: 350,
        illuminance_max: 500,
        illuminance_measured: "",
        power_w: "",
        wavelength: "",
    };
}

export function defaultMethodParams(reportType) {
    if (reportType === "PT") return { pt: defaultPtParams() };
    if (reportType === "MT") return { mt: defaultMtParams() };
    if (reportType === "VT") return defaultVtParams();
    return {};
}

function parseRaw(raw) {
    if (!raw) return {};
    if (typeof raw === "string") {
        try { return JSON.parse(raw) || {}; } catch { return {}; }
    }
    return typeof raw === "object" ? raw : {};
}

function mergePt(stored) {
    const base = defaultPtParams();
    if (!stored || typeof stored !== "object") return base;
    const defects = { ...base.defects };
    if (stored.defects && typeof stored.defects === "object") {
        Object.keys(base.defects).forEach((code) => {
            const row = stored.defects[code];
            if (row && typeof row === "object") {
                defects[code] = {
                    present: row.present || "",
                    outcome: row.outcome || "",
                };
            }
        });
    }
    const cleaning = Array.isArray(stored.cleaning)
        ? stored.cleaning.filter((v) => PT_CLEANING_OPTIONS.some((o) => o.value === v))
        : base.cleaning;
    return {
        ...base,
        ...stored,
        cleaning,
        defects,
    };
}

function mergeMt(stored) {
    const base = defaultMtParams();
    if (!stored || typeof stored !== "object") return base;
    const defects = { ...base.defects };
    if (stored.defects && typeof stored.defects === "object") {
        Object.keys(base.defects).forEach((code) => {
            defects[code] = !!stored.defects[code];
        });
    }
    return {
        ...base,
        ...stored,
        defects,
    };
}

/**
 * Un verbale = un metodo. VT resta piatto (lux). PT → { pt }. MT → { mt }.
 * Nomi/date restano sui campi testata del verbale (non duplicati qui).
 */
export function sanitizeMethodParams(reportType, raw) {
    const obj = parseRaw(raw);
    if (reportType === "PT") {
        return { pt: mergePt(obj.pt) };
    }
    if (reportType === "MT") {
        return { mt: mergeMt(obj.mt) };
    }
    if (reportType === "VT") {
        const out = defaultVtParams();
        VT_KEYS.forEach((k) => {
            if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
        });
        return out;
    }
    return {};
}

export function ptPlaceholderFor(group, value) {
    const maps = {
        acc: PT_ACC_OPTIONS,
        surface: PT_SURFACE_OPTIONS,
        cleaning: PT_CLEANING_OPTIONS,
        application: PT_APP_OPTIONS,
        final: PT_FINAL_OPTIONS,
    };
    const opt = (maps[group] || []).find((o) => o.value === value);
    return opt ? opt.placeholder : "";
}

export function mtPlaceholderFor(group, value) {
    const maps = {
        tracer: MT_TRACER_OPTIONS,
        mag: MT_MAG_OPTIONS,
        mag_mode: MT_MAG_MODE_OPTIONS,
        demag: MT_DEMAG_OPTIONS,
    };
    const opt = (maps[group] || []).find((o) => o.value === value);
    return opt ? opt.placeholder : "";
}

export function ptDefectPlaceholders(code) {
    return {
        yn: `{pt_d_${code}_yn}`,
        a: `{pt_d_${code}_a}`,
    };
}

export const SEMANTIC_PLACEHOLDERS = [
    "{pt_acc_l1}", "{pt_acc_l2}", "{pt_acc_l3}",
    "{pt_sup_asw}", "{pt_sup_grd}", "{pt_sup_mac}", "{pt_sup_frg}",
    "{pt_cln_gr}", "{pt_cln_br}", "{pt_cln_sb}",
    "{pt_app_spray}", "{pt_app_dip}", "{pt_app_brush}",
    "{inspection_pct}", "{pt_pen}", "{pt_pen_lot}", "{pt_sol}", "{pt_sol_lot}",
    "{pt_det}", "{pt_det_lot}", "{pt_lux}", "{pt_temp}",
    "{pt_final_ok}", "{pt_final_ko}",
    "{mt_tr_dry}", "{mt_tr_wet}", "{mt_tr_flu}",
    "{mt_mag_prod}", "{mt_mag_yoke}", "{mt_mag_coil}",
    "{mt_mag_dir}", "{mt_mag_res}",
    "{mt_pole_pitch}", "{mt_curr_type}", "{mt_curr_a}", "{mt_field}",
    "{mt_demag_yes}", "{mt_demag_no}", "{mt_surf}", "{mt_judg}",
];
