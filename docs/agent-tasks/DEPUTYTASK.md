# DEPUTYTASK — Assistente AI: deep link documenti, coerenza albero, chat persistente

**Sessione:** 31/05/2026 — pianificazione multi-slice (esecuzione deputy in autonomia)

## Obiettivo

Chiudere tre gap UX dell’Assistente AI e del Registro Documenti:

1. **Chip citazioni `document` / `norm_content`** → oggi portano a `/documents` (tab Priorità di default), non al documento nell’**Albero**.
2. **Coerenza foglie** → stesso documento può comparire in Priorità/Catalogo ma non nella lista foglie del ramo albero selezionato (o viceversa): allineare criteri API/UI.
3. **Chat Assistente** → messaggi solo in `useState`; tornando da un chip la conversazione **si perde**.

**Riferimenti codice attuale**

| Area | File | Gap |
|------|------|-----|
| Path citazioni | `app/src/utils/aiCitations.js` | `document` → `/documents` senza `select` né tab |
| Chip UI | `app/src/components/AiAssistantCitations.jsx` | Usa `getCitationPath` |
| Ricerca unificata | `app/src/utils/searchResultLinks.js` | Stesso limite su `document` |
| Registro | `app/src/components/DocumentRegistry.jsx` | `activeTab` locale, nessun `URLSearchParams`; pattern NC: `NCPage.jsx` + `/nc?select=` |
| Breadcrumb server | `GET /api/v1/documents/:docId/breadcrumb` | Esiste — usare per espansione albero |
| Chat | `app/src/pages/AiAssistantPage.jsx` | `messages` non persistiti |
| Precedente guida | `docs/GUIDA_CONSOLIDATA.md` § Fase A citazioni (30/05/2026) | NC con `?select=`; documenti no |

---

## Cosa fare PRIMA di iniziare (checklist)

### Committente (2 minuti, opzionale ma utile)

- [ ] Confermare **contratto URL** proposto: `/documents?tab=tree&select=<docId>` (allineato a `/nc?select=`).
- [ ] Fornire **1 domanda AI** che restituisca chip «Documento …» su preview/prod (per smoke L3 manuale).
- [ ] Segnalare **1 documento noto** (id o titolo) che oggi compare in **Priorità** ma non nel ramo albero atteso (se esiste).

### Agente deputy (obbligatorio)

- [ ] `git fetch` + `git pull origin main` nella cartella workspace effettiva (`C:\ProgettoISO` o junction Drive).
- [ ] Verificare `main` allineato; branch dedicato es. `feat/ai-docs-deeplink-chat-persist`.
- [ ] Leggere: `PROJECT_CONTEXT.md`, `docs/GUIDA_CONSOLIDATA.md` (§ Fase A citazioni + ricerca C), `NCPage.jsx` (deep link), `useDocumentTree.js`, `documentTree.controller.js` (children/breadcrumb).
- [ ] **Non** toccare schema DB salvo gap dimostrato; preferire fix FE + query esistenti.
- [ ] `$node` path per test L1 (regola workspace).
- [ ] Backend: deploy VPS **solo** se si modifica citazioni server-side; per questo task previsto **solo FE**.

---

## Slice verticali e parallelismo

| Slice | Contenuto | Parallelo con | Dipendenze |
|-------|-----------|---------------|------------|
| **A** | Deep link chip + `searchResultLinks` + `DocumentRegistry` URL (`tab`, `select`, espansione albero, drawer dettaglio) | **B** | Contratto URL; API breadcrumb già presente |
| **B** | Persistenza chat `sessionStorage` in `AiAssistantPage` (chiave per org/user, cap messaggi, no segreti) | **A** | Nessuna |
| **C** | Audit coerenza foglie albero vs Priorità/Catalogo + fix minimo (filtri `getDocuments` / `tree/children`, `parent_id`, status `obsoleto`) | **A** (dopo contratto URL) | Investigazione può partire in parallelo; fix UI albero può unirsi ad A |
| **D** | Integrazione + smoke L3 + doc | — | A + B (+ C se applicabile) |

**Ordine consigliato:** avviare **A e B in parallelo** → **C** appena chiaro il comportamento children → **D** chiusura.

---

## Slice A — Deep link citazioni → Registro / tab Albero

### Implementazione (indicativa)

1. `getCitationPath` / `getSearchResultPath`: per `document` e `norm_content` con `entityId` numerico → `/documents?tab=tree&select=<id>`.
2. `DocumentRegistry.jsx` (mount + `popstate`):
   - Leggere `tab` (`tree`|`priority`|`catalog`) e `select` (doc id).
   - Se `select`: `setActiveTab('tree')`, `getDocument(id)`, `getBreadcrumb(id)`, espandere nodi (`loadChildren` ricorsivo o loop parent), selezionare cartella padre, `handleDocSelect`.
3. Allineare navigazione interna: `replace` URL quando si apre/chiude dettaglio (come NC).
4. Test L1 Vitest: estendere `app/src/tests/aiCitations.test.js` e `searchResultLinks.test.js`; nuovo test helper «parse document deep link» se estratto.
5. Test componente leggero (opzionale): mount `DocumentRegistry` con mock API breadcrumb + select.

### Test intermedi L1 (slice A)

```powershell
$node = "c:\Users\AI.Project\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
$env:NODE_ENV = "test"
Set-Location "C:\ProgettoISO\app"
& $node "node_modules\vitest\vitest.mjs" run src/tests/aiCitations.test.js src/tests/searchResultLinks.test.js 2>&1 | Select-Object -Last 25
```

**Criterio slice A:** path documento con `tab=tree&select=`; aprendo URL, tab Albero + drawer documento (test o smoke).

---

## Slice B — Persistenza chat sessionStorage

### Implementazione (indicativa)

1. Chiave es. `sgq:ai-assistant-messages:<organization_id>` (e opz. suffix user id se multi-account stesso browser).
2. `useEffect` load al mount; save debounced (300–500 ms) su cambio `messages` (escludere messaggio `loading` temporaneo).
3. Cap: ultimi N messaggi (es. 50) o max ~200 KB JSON; `try/catch` se quota esaurita.
4. Pulsante «Nuova conversazione» (admin o tutti): `clear` chiave + stato vuoto.
5. **Non** persistere token/password; solo testi UI e metadati citazioni già in risposta API.

### Test intermedi L1 (slice B)

- Nuovo `app/src/tests/aiAssistantChatPersist.test.js`: serializza/deserializza, rispetta cap, ignora storage error.
- Smoke manuale: invia 2 messaggi → vai su `/documents` → torna Assistente → chat visibile.

**Criterio slice B:** refresh tab (F5) mantiene chat; navigazione interna mantiene chat; logout pulisce (se esiste evento `sgq:userLoggedOut`, allineare).

---

## Slice C — Coerenza foglie albero vs Priorità / Catalogo

### Diagnosi (prima del fix)

1. Confrontare per 3–5 doc campione:
   - `GET /documents?…` (come Priorità/Catalogo)
   - `GET /documents/tree/:folderId/children` (foglie albero)
2. Verificare: `parent_id`, `status`, `doc_type=folder`, documenti orfani (`/documents/orphans`), filtro `obsoleto`.
3. Documentare in commento test o in guida **regola unica**: «un documento rilasciato con parent X appare nel ramo X».

### Fix atteso (minimo)

- Se gap è solo FE: stessi filtri `status`/`doc_type` tra liste.
- Se gap è API children: allineare query `documentTree.controller` a criteri lista (senza cambiare semantica multi-tenant).

### Test intermedi L1 (slice C)

- Test Jest/Vitest su helper estratto (es. stesso set id da mock tree children vs mock catalog list).
- Opzionale script diagnostico `.cursor/doc-tree-coherence-smoke.mjs` (JWT da env).

**Criterio slice C:** per org test, insieme id foglie ⊆ insieme id visibili in catalogo (stesso filtro status) **oppure** differenza documentata e accettata in guida.

---

## Slice D — Chiusura integrata

### Smoke L3 (manuale o Playwright)

| # | Passo | Atteso |
|---|--------|--------|
| 1 | Login preview/prod | OK |
| 2 | Assistente AI → domanda con citazione documento | Chip visibile |
| 3 | Click chip | `/documents?tab=tree&select=…`, albero + dettaglio |
| 4 | Back → Assistente | Chat ancora presente |
| 5 | Priorità: apri stesso doc | Coerente con percorso albero |

### Build L1 globale (pre-push)

```powershell
$node = "c:\Users\AI.Project\AppData\Local\Programs\cursor\resources\app\resources\helpers\node.exe"
$env:NODE_ENV = "test"
Set-Location "C:\ProgettoISO\app"
& $node "node_modules\vitest\vitest.mjs" run 2>&1 | Select-Object -Last 30
Set-Location "C:\ProgettoISO\app"
& $node "node_modules\vite\bin\vite.js" build 2>&1 | Select-Object -Last 15
```

---

## Criteri chiusura sessione

| Esito | Condizione |
|-------|------------|
| **TEST OK** | Slice A+B obbligatorie verdi; C risolta o rischio residuo scritto in guida; L1 verde; smoke L3 tabella compilata (data, ambiente) |
| **FIX NON APPLICABILI** | Blocco documentato (es. API mancante, RBAC) + proposta in `PROJECT_ROADMAP.md` |

**Post-OK**

1. Commit su branch → PR → merge `main` (regola workspace).
2. Deploy: **solo Netlify** (FE); nessun restart VPS se zero modifiche backend.
3. Aggiornare `docs/GUIDA_CONSOLIDATA.md` § Assistente AI / citazioni con contratto URL + persistenza chat + eventuale lezione albero.
4. Sovrascrivere questo file con stato chiuso (tabella esiti) o lasciare brief per prossimo task.

---

## Comando deputy standard

```
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Pianificato 31/05/2026 — solo doc, nessuna implementazione in sessione lead.*
