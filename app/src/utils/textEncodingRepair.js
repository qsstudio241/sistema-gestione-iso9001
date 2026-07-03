/**
 * Ripara testo con U+FFFD / mojibake (allineato a backend textEncodingRepair.js).
 */
export function repairTextEncoding(input) {
  if (input == null) return input;
  if (typeof input !== "string") return input;

  return input
    .replace(/\uFFFD/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/â€"/g, " - ")
    .replace(/â€“/g, "-")
    .replace(/â€™/g, "'")
    .replace(/Ã¼/g, "ü")
    .replace(/Ãœ/g, "Ü")
    .replace(/Ã¨/g, "è")
    .replace(/Ã©/g, "é")
    .replace(/Ã¬/g, "ì")
    .replace(/Ã²/g, "ò")
    .replace(/Ã¹/g, "ù")
    .replace(/Ã /g, "à")
    .replace(/[\u2013\u2014]/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function repairDeep(value) {
  if (value == null) return value;
  if (typeof value === "string") return repairTextEncoding(value);
  if (Array.isArray(value)) return value.map(repairDeep);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, repairDeep(v)])
    );
  }
  return value;
}
