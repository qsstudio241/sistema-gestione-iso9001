# DEPUTYTASK - Contesto AI multi-slice (L1-L4)

**Stato programma:** slice **3 deploy produzione** chiusa (30/05/2026) — slice **2** propagazione audit ancora aperta.
**Branch:** `feat/ai-context-multi-slice` (commit feature + fix script VPS migrazioni).

---

## Slice 3 - Deploy produzione (30/05/2026) — TEST OK

| # | Voce | Esito |
|---|------|-------|
| 1 | Migrazione 066 VPS (`ai_context_notes`) | **OK** — verify colonna su `organizations` |
| 2 | Migrazione 067 VPS (`knowledge_chunks.standard_id` + indice) | **OK** |
| 3 | Deploy backend VPS | **OK** — `deploy-controllers-to-vps.ps1` + file AI (`aiChat`, `aiAssist`, servizi contesto, `knowledgeIndexer`, `normChunker`) |
| 4 | Restart `sgq-backend` | **OK** — MainPID `328524` → `331861` |
| 5 | Health | **OK** — `GET https://www.fr-busato.it:8443/api/v1/health` |
| 6 | Smoke API | **OK** — login, `GET/PATCH /organizations/me` (`ai_context_notes`), `POST /ai/reindex`, `POST /ai/chat` con `standardId` |
| 7 | Reindex legacy | **OK** — `204` chunk totali, `18` con `standard_id` non null (post reindex manuale) |
| 8 | CORS (OPTIONS `/audits/sync`) | **OK** — 204 + header CORS presenti |

### Credenziali usate

- VPS/SSH: `backend/config/.ssh-deploy.local.ps1` (gitignored) — env cloud `SGQ_SSH_KEY_B64` / `SGQ_SUDO_PASSWORD` **assenti** in questa shell; deploy via PuTTY + password locale.
- DB migrazioni: esecuzione **su VPS** con `node /tmp/run-migration-066-vps.js` e `067-vps.js`.

### Blocker residui

1. **Slice 2** (propagazione audit → clausola, enrich su tutti gli endpoint AI) — non in scope deploy.
2. **`gh` CLI** non in PATH — PR create/merge via **GitHub REST API** + PAT utente Windows.
3. Frontend Netlify: merge su `main` → build automatica (~2 min) per UI `StudioSettingsPage` / chip norma.

---

## Slice 2 - Avvio (in corso)

| # | Voce | Esito |
|---|------|-------|
| 1 | `app/src/utils/aiAssistantContext.js` | Presente |
| 2 | `app/src/tests/aiAssistantContext.test.js` | OK (4 test) |
| 3 | `enrichSystemPromptWithOrganization` su tutti gli endpoint AI | **Da fare** |
| 4 | Propagazione audit aperto → clausola in payload chat | **Da fare** |

### Comando deputy - slice 2

```
Leggi docs/agent-tasks/DEPUTYTASK.md (sezione slice 2).
Completa propagazione contesto audit (norma+clausola) e enrich org su endpoint AI mancanti.
Chiudi con TEST OK o FIX NON APPLICABILI.
```

---

*Aggiornato 30/05/2026 — deploy produzione contesto AI (mig. 066/067 VPS + backend + smoke).*