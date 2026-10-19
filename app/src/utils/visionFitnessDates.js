/**
 * Date del certificato di idoneità visiva (acuità + Ishihara).
 * In form c'è un solo campo per la visita oculistica. I colori si registrano
 * solo se la data è diversa. Le colonne restano quelle già in tabella:
 * expiry_date, near_vision_expiry_date, colour_vision_expiry_date.
 * Confronto su date pure AAAA-MM-GG: una data vuota non entra nel minimo.
 */

import { isVisionFitnessType } from "../data/occupationalQualificationTypes";

export function toIsoDate(value) {
  if (value == null || value === "") return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/** La data più vicina tra quelle presenti. Una voce vuota non conta. */
export function earliestIsoDate(dates) {
  let best = null;
  for (const raw of dates || []) {
    const iso = toIsoDate(raw);
    if (!iso) continue;
    if (best == null || iso < best) best = iso;
  }
  return best;
}

/** Campo unico: la visita di acuità, oppure la scadenza storica se è l'unica compilata. */
export function displayedVisitDate(form) {
  return toIsoDate(form?.near_vision_expiry_date) || toIsoDate(form?.expiry_date) || "";
}

export function colourDistinctFromVisit(form) {
  const visit = displayedVisitDate(form);
  const colour = toIsoDate(form?.colour_vision_expiry_date);
  return Boolean(colour && colour !== visit);
}

/**
 * Modifica del campo unico.
 * Se expiry_date era vuota, o era proprio la data mostrata, segue la visita.
 * Se expiry_date è un'altra data già salvata, resta com'è.
 */
export function applyVisitDateChange(form, nextRaw) {
  const next = toIsoDate(nextRaw) || "";
  const expiry = toIsoDate(form?.expiry_date) || "";
  const near = toIsoDate(form?.near_vision_expiry_date) || "";
  const prevShown = near || expiry;
  const expiryOut = !expiry || expiry === prevShown ? next : expiry;
  return {
    ...form,
    near_vision_expiry_date: next,
    expiry_date: expiryOut,
  };
}

/**
 * Valori da scrivere.
 * La visita mostrata va nella colonna di acuità. Se il campo è vuoto, resta vuoto.
 * expiry_date non si svuota qui: una data storica diversa resta.
 * I colori si scrivono solo se la data è diversa dalla visita.
 */
export function visionDatesForSave(form, visitRaw) {
  const expiry = toIsoDate(form?.expiry_date) || "";
  const near = toIsoDate(form?.near_vision_expiry_date) || "";
  const colour = toIsoDate(form?.colour_vision_expiry_date) || "";
  const visit = visitRaw === undefined ? (near || expiry) : (toIsoDate(visitRaw) || "");
  const colourOut = colour && colour !== visit ? colour : "";
  return {
    expiry_date: expiry,
    near_vision_expiry_date: visit,
    colour_vision_expiry_date: colourOut,
  };
}

/**
 * Elenco Qualifiche. Senza una data colori diversa: una sola data
 * (la più vicina) e il richiamo «colori: come visita».
 */
export function visionListPresentation(q) {
  if (!q || !isVisionFitnessType(q.qualification_type)) return null;
  const near = toIsoDate(q.near_vision_expiry_date);
  const colour = toIsoDate(q.colour_vision_expiry_date);
  const expiry = toIsoDate(q.expiry_date);
  const visit = near || expiry || "";
  const effective = toIsoDate(q.effective_expiry_date) || earliestIsoDate([expiry, near, colour]);
  const colourDistinct = Boolean(colour && colour !== visit);
  if (!visit && !colour) return null;
  if (!colourDistinct) {
    const date = effective || visit;
    if (!date) return null;
    return { mode: "single", date, hint: "colori: come visita" };
  }
  const lines = [];
  const visitShown = near || visit;
  if (visitShown) {
    lines.push({
      key: "visit",
      label: "Scadenza visita oculistica",
      date: visitShown,
    });
  }
  if (colour) {
    lines.push({ key: "colour", label: "Scadenza test colori", date: colour });
  }
  if (
    expiry
    && near
    && effective === expiry
    && expiry !== visitShown
    && expiry !== colour
  ) {
    lines.push({ key: "expiry", label: "Scadenza certificato", date: expiry });
  }
  return { mode: "split", lines, effective: effective || "" };
}
