const fs = require("fs");
const path = "c:/ProgettoISO/docs/how-to/MANUALE_UTENTE_NC.md";
let t = fs.readFileSync(path, "utf8");
t = t.replace(/\u0097/g, "\u2014");
t = t.replace(/\u0096/g, "\u2013");
t = t.replace(/\u0085/g, "\u2026");
t = t.replace(/severit \u00a0/g, "severit\u00e0 ");
t = t.replace(/severit /g, (m, off) => {
  const next = t.slice(off, off + 12);
  if (next.startsWith("severit \u00a0") || next.startsWith("severit\u00e0")) return m;
  return "severit\u00e0 ";
});
const pairs = [
  ["Link audit ? NC", "Link audit \u2192 NC"],
  ["**custom** ? registro", "**custom** \u2192 registro"],
  ["**Audit** ? selezionare", "**Audit** \u2192 selezionare"],
  ["`Aperta` ? `In corso` ? `Risolta` ? `Verificata` ? *(approvazione RQ)* ? `Chiusa`", "`Aperta` \u2192 `In corso` \u2192 `Risolta` \u2192 `Verificata` \u2192 *(approvazione RQ)* \u2192 `Chiusa`"],
  ["(Aperta ? In corso)", "(Aperta \u2192 In corso)"],
  ["(In corso ? Risolta)", "(In corso \u2192 Risolta)"],
  ["(Risolta ? Verificata)", "(Risolta \u2192 Verificata)"],
  ["(Verificata ? Chiusa)", "(Verificata \u2192 Chiusa)"],
  ["**Avvia** ? **Completa** ? **Verifica**", "**Avvia** \u2192 **Completa** \u2192 **Verifica**"],
  ["icona elimina ? conferma", "icona elimina \u2192 conferma"],
  ["scadenze ? Solo scadute", "scadenze \u2192 Solo scadute"],
  ["### 3.12 Link audit ? NC", "### 3.12 Link audit \u2192 NC"],
  ["**numero audit** ? pagina", "**numero audit** \u2192 pagina"],
  ["registro** ? `/nc?select", "registro** \u2192 `/nc?select"],
  ["efficacia** ? **Salva", "efficacia** \u2192 **Salva"],
  ["**Salva modifiche** ? riprovare", "**Salva modifiche** \u2192 riprovare"],
  ["tenant ? **Licenze", "tenant \u2192 **Licenze"],
  ["**Licenze moduli** ? abilitare", "**Licenze moduli** \u2192 abilitare"],
  ["checklist ? registro", "checklist \u2192 registro"],
  ["stato ? mostra", "stato \u2192 mostra"],
  ["NC-\u2014 \u2014 Chiusa", "NC-\u2026 \u2014 Chiusa"],
];
for (const [a, b] of pairs) t = t.split(a).join(b);
// N degree sign
t = t.replace(/N\u00b0/g, "N\u00b0");
if (t.includes("N\uFFFD NC") || t.includes("N\u009c")) t = t.replace(/N. NC/g, "N\u00b0 NC");
fs.writeFileSync(path, t.replace(/\r\n/g, "\n"), "utf8");
const bad = [...t].filter(c => c.charCodeAt(0) < 32 && c !== "\n").length;
console.log("U+0097 left:", t.includes("\u0097"));
console.log("arrows ok:", t.includes("\u2192"));
console.log("em dash:", (t.match(/\u2014/g) || []).length);
