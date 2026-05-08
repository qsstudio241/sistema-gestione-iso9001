# TASK — Sprint 12 WebDAV / Office round-trip (lavoro **parallelo**)

> **Creato**: 18 aprile 2026  
> **Contesto**: `main` include già merge smoke weekend + checklist; questo task **non** sostituisce smoke manuali né deploy migrazione **040**.  
> **Mini-spec**: [`../MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md`](../MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md)  
> **Task dettagliato originale**: [`TASK_WEB_DAV_ROUND_TRIP.md`](TASK_WEB_DAV_ROUND_TRIP.md)

---

## Obiettivo

Sviluppare il **PoC WebDAV + link Office** su **branch dedicato**, in parallelo ad altre attività, senza toccare `main` finché il reviewer desktop non approva.

---

## Branch e flusso

1. `git checkout main && git pull origin main`
2. `git checkout -b feat/webdav-roundtrip-poc`
3. Implementare quanto in `TASK_WEB_DAV_ROUND_TRIP.md` (backend stub + `OfficeEditor` + `apiService`).
4. Apri **PR** verso `main`; nella descrizione PR scrivere esplicitamente: **“Parallelo Sprint 12 — nessun impatto smoke weekend / migrazione 040.”**

---

## Vincoli

- Nessun segreto in repo.
- Nessuna modifica a migrazioni DB produzione da agente web.
- CI verde (`.github/workflows/ci-app-pr.yml`).

---

## Prompt pronto (Cursor web)

```text
Leggi e applica `docs/agent-tasks/TASK_SPRINT12_WEBDAV_PARALLEL.md` e la mini-spec `docs/MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md`.  
Branch: `feat/webdav-roundtrip-poc` da `main` aggiornato. PR verso `main` con CI verde. Non toccare smoke checklist né script migrazione 040.
```

---

## Review

L’agente desktop (sessione Cursor) esegue review + merge dopo CI verde, come da accordo con il committente.
