const fs = require("fs");
const path = "c:/ProgettoISO/docs/how-to/MANUALE_UTENTE_NC.md";
const buf = fs.readFileSync(path);
const text = new TextDecoder("windows-1252").decode(buf);
fs.writeFileSync(path, text, "utf8");
console.log(text.slice(0, 60));
console.log("S?:", text.includes("S\u00ec"), "em:", text.includes("\u2014"), "sect:", text.includes("\u00a7"));
