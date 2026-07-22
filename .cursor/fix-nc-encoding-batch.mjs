import fs from "fs";
import path from "path";

const root = "c:/ProgettoISO/app/src";
const targets = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") walk(full);
    else if (/nc/i.test(entry.name) && /\.(jsx|js)$/.test(entry.name)) targets.push(full);
  }
}

walk(root);

for (const file of targets) {
  const buffer = fs.readFileSync(file);
  const bytes = [...buffer];
  let changed = false;

  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0x97) {
      bytes[i] = 0x2d;
      changed = true;
    }
  }

  if (!changed) continue;

  let text = Buffer.from(bytes).toString("utf8");
  text = text
    .replace(/Qual \? la/g, "Qual \u00E8 la")
    .replace(/descrizione \? obbligatoria/g, "descrizione \u00E8 obbligatoria")
    .replace(/pi\? tardi/g, "pi\u00F9 tardi")
    .replace(/non conformit\?/g, "non conformit\u00E0")
    .replace(/Severit\?/g, "Severit\u00E0")
    .replace(/Audit \$\{nc\.audit_number\} \? \$\{nc\.client_name/g, "Audit ${nc.audit_number} - ${nc.client_name")
    .replace(/` \? \$\{nc\.client_name\}/g, "` - ${nc.client_name}");

  fs.writeFileSync(file, text, "utf8");
  console.log("fixed", file.replace("c:/ProgettoISO/", ""));
}
