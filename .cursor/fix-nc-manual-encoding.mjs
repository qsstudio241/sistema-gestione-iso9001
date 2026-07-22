const fs = require("fs");
const path = "c:/ProgettoISO/docs/how-to/MANUALE_UTENTE_NC.md";
const buf = fs.readFileSync(path);
const text = new TextDecoder("windows-1252").decode(buf);
fs.writeFileSync(path, text, "utf8");
const sample = text.slice(0, 80);
console.log(sample);
console.log("S? test:", text.includes("S?"), "? test:", text.includes("?"));
