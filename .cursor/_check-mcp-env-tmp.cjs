const fs=require("fs");
const p="c:/ProgettoISO/.cursor/mcp.env";
if(!fs.existsSync(p)){console.log("MCP_FILE:MISSING");process.exit(1);}
const lines=fs.readFileSync(p,"utf8").split(/\r?\n/);
let g=false, email=null, pwLen=0;
for(const line of lines){
  if(/^\s*#/.test(line)) continue;
  let m=line.match(/^\s*GITHUB_PERSONAL_ACCESS_TOKEN\s*=\s*(.+)\s*$/); if(m&&m[1].trim()) g=true;
  m=line.match(/^\s*SGQ_APP_EMAIL\s*=\s*(.+)\s*$/); if(m) email=m[1].trim().replace(/^["']|["']$/g,"");
  m=line.match(/^\s*SGQ_APP_PASSWORD\s*=\s*(.+)\s*$/); if(m) pwLen=m[1].trim().replace(/^["']|["']$/g,"").length;
}
console.log("GITHUB_PERSONAL_ACCESS_TOKEN:", g?"presente":"assente");
if(email){
  const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  console.log("SGQ_APP_EMAIL: presente email="+email+" formato="+(ok?"ok":"dubbio"));
}else console.log("SGQ_APP_EMAIL: assente");
console.log("SGQ_APP_PASSWORD:", pwLen>0?"presente lunghezza="+pwLen:"assente");
if(!email||!pwLen) process.exit(2);
