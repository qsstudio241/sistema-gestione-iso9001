#!/usr/bin/env python3
"""Smoke test per le nuove API gestione documentale."""
import urllib.request
import json
import sys

BASE = "http://localhost:3000/api/v1"

def req(method, path, data=None, token=None):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"__http_error": e.code, "body": e.read().decode()[:300]}

print("=== 6.1 Health ===")
h = req("GET", "/health")
print(json.dumps(h, indent=2)[:200])

print("\n=== 6.2 Login ===")
login = req("POST", "/auth/login", {"email": "admin@sgq.local", "password": "Admin2026!"})
token = login.get("token") or login.get("accessToken")
if not token:
    print("ERRORE login:", json.dumps(login)[:300])
    sys.exit(1)
print(f"Token ottenuto ({len(token)} chars)")

print("\n=== 6.3a Albero documentale ===")
tree = req("GET", "/documents/tree", token=token)
print(json.dumps(tree, indent=2, ensure_ascii=False)[:500])

print("\n=== 6.3b Tag di sistema (document-tags) ===")
tags = req("GET", "/document-tags", token=token)
if isinstance(tags, list):
    print(f"  {len(tags)} tag trovati")
    for t in tags[:5]:
        print(f"  - {t.get('name')} [{t.get('slug')}]")
else:
    print(json.dumps(tags, indent=2, ensure_ascii=False)[:400])

print("\n=== 6.3c Categorie tag ===")
cats = req("GET", "/tag-categories", token=token)
if isinstance(cats, list):
    print(f"  {len(cats)} categorie trovate")
    for c in cats:
        print(f"  - {c.get('name')} (id={c.get('id')})")
else:
    print(json.dumps(cats, indent=2, ensure_ascii=False)[:300])

print("\n=== 6.3d Template albero ===")
tmpl = req("GET", "/document-tree-templates", token=token)
if isinstance(tmpl, list):
    print(f"  {len(tmpl)} template trovati")
    for t in tmpl[:3]:
        print(f"  - {t.get('name')} [{t.get('standard_code')}]")
else:
    print(json.dumps(tmpl, indent=2, ensure_ascii=False)[:300])

print("\n=== 6.3e History documento 1 ===")
hist = req("GET", "/documents/1/history", token=token)
print(json.dumps(hist, indent=2, ensure_ascii=False)[:300])

print("\n=== 6.4 Provisioning albero company_id=1 ===")
prov = req("POST", "/documents/provision-tree", {"company_id": 1, "standard_codes": ["ISO_9001"]}, token=token)
if isinstance(prov, list):
    print(f"  {len(prov)} cartelle create/trovate")
    for p in prov[:5]:
        print(f"  - {p.get('name')} [{p.get('folder_code')}]")
elif isinstance(prov, dict) and "folders" in prov:
    folders = prov["folders"]
    print(f"  {len(folders)} cartelle create/trovate")
else:
    print(json.dumps(prov, indent=2, ensure_ascii=False)[:400])

print("\n=== Albero dopo provisioning ===")
tree2 = req("GET", "/documents/tree?company_id=1", token=token)
if isinstance(tree2, list):
    print(f"  {len(tree2)} nodi nell'albero")
elif isinstance(tree2, dict):
    items = tree2.get("folders") or tree2.get("items") or []
    print(f"  Struttura: {list(tree2.keys())}")
    print(json.dumps(tree2, indent=2, ensure_ascii=False)[:400])

print("\n=== SMOKE TEST COMPLETATO ===")
