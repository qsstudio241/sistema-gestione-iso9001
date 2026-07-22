const fs=require("fs");
const path=require("path");
function loadEnvFile(){
  const envPath=path.join("c:/ProgettoISO",".cursor","mcp.env");
  const out={};
  for(const line of fs.readFileSync(envPath,"utf8").split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if(m) out[m[1]]=m[2].trim();
  }
  return out;
}
const e=loadEnvFile();
const email=process.env.SGQ_APP_EMAIL||e.SGQ_APP_EMAIL;
const password=process.env.SGQ_APP_PASSWORD||e.SGQ_APP_PASSWORD;
(async()=>{
  const r=await fetch("https://www.fr-busato.it:8443/api/v1/auth/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({email,password})
  });
  const text=await r.text();
  let hasToken=false;
  try{ const j=JSON.parse(text); hasToken=!!j.token; }catch{}
  console.log("HTTP", r.status, "token:", hasToken?"si":"no");
  process.exit(r.status===200&&hasToken?0:1);
})();
