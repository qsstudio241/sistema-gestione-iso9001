# Indice e convenzioni documentazione

> Punto di ingresso per capire dove si trova cosa. Aggiornato: 2026-04-19.

---

## Dove trovare cosa

| Scopo | File | Note |
|-------|------|------|
| **Contesto progetto (AI / onboarding)** | [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) (root) | Stack, infra, workflow deploy, regole operative |
| **Roadmap e stato** | [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) | Fasi, backlog, stato avanzamento |
| **Mini-specifica commerciale / §8.2** | [MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md](MINI_SPEC_RIESAME_REQUISITI_CONTRATTO.md) | Pilota riesame requisiti contratto; stati, ruoli, integrazione ingest |
| **Mini-specifica Office round-trip** | [MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md](MINI_SPEC_OFFICE_ROUNDTRIP_WEBDAV.md) | Editing Word/Excel desktop con WebDAV/Helper custom (Windows-first) |
| **Esperienza operativa (unica guida)** | [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md) | Deploy, Word Verbale, DB/repro; **sezione “Piano qualità”** = fasi sviluppo, DoD, piramide test e smoke robustezza — aggiornare qui, non creare nuovi SESSION_NOTES |
| **Storico sessioni** | [archive/sessions/](archive/sessions/) | Solo consultazione |
| **Schema DB** | [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Leggere prima di modificare il DB |
| **Quick-ref DB e API** | [DATABASE.md](DATABASE.md), [BACKEND_API.md](BACKEND_API.md) | Riferimento rapido (spostati da root) |
| **Deploy Netlify** | [NETLIFY_DEPLOYMENT.md](NETLIFY_DEPLOYMENT.md) | Build, deploy, convenzioni Git |
| **Checklist deploy release** | [DEPLOY_CHECKLIST_RELEASE.md](DEPLOY_CHECKLIST_RELEASE.md) | Passi per release (build, backend VPS, push, smoke test) |
| **Perdita connessione (offline/mobile)** | [GESTIONE_PERDITA_CONNESSIONE.md](GESTIONE_PERDITA_CONNESSIONE.md) | Comportamento offline, sync, health check, mobile; **§ Logout** = limiti vs ADR-007 |
| **Open points: logout, backup PC, cache audit** | [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md) sezione *Open points e memoria trasversale* + [adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md](adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md) | Fonte unica per non “perdere” requisiti tra sessioni |
| **Utenti, checklist, sistemi, report** | [SCHEMA_UTENTI_CHECKLIST_SISTEMI_REPORT.md](SCHEMA_UTENTI_CHECKLIST_SISTEMI_REPORT.md) | Organization/user, ruoli, checklist ISO e custom, template report, self-assessment |
| **Architettura utenti e RBAC** | [ARCHITETTURA_UTENTI_RBAC.md](ARCHITETTURA_UTENTI_RBAC.md) | Tenant → studio → azienda; ruoli canonici; deleghe; scope API; piano migrazione (fonte per hardening sicurezza) |
| **Migrazione DB: split tenant** | [MIGRATION_PLAN_SPLIT_TENANTS.md](MIGRATION_PLAN_SPLIT_TENANTS.md) | Da un solo `organization_id` a più organizzazioni (QS_Studio, MASON, ERAM); fasi, inventario tabelle, checklist |
| **Decisioni architetturali** | [adr/README.md](adr/README.md) | Indice ADR; dettaglio in `adr/ADR-*.md` |
| **Manuali** | [MANUALE_UTENTE.md](MANUALE_UTENTE.md), [MANUALE_OPERATIVO_FASE1.md](MANUALE_OPERATIVO_FASE1.md) | Uso applicazione e procedure |
| **Riferimenti tecnici** | [REFERENCE.md](REFERENCE.md), [DATABASE_MAPPING.md](DATABASE_MAPPING.md) | Infra prod., **SSH vs SQL**, ruolo assistente Cursor |
| **Storico / archive** | [archive/](archive/) | CLEANUP_ROADMAP, ROADMAP_RESET_COMPLETO (doc storici) |

---

## Convenzione: istruzioni e workflow

Le **regole operative** e il **workflow deploy** stanno in **PROJECT_CONTEXT.md**.  
L’**esperienza accumulata** (bug risolti, procedure) va in **`GUIDA_CONSOLIDATA.md`** — non creare nuovi `SESSION_NOTES_YYYYMMDD.md`.

**Chiarezza e best practice sulla documentazione** (struttura, fonte unica, cosa evitare): sezione *Principi di documentazione* in [GUIDA_CONSOLIDATA.md](GUIDA_CONSOLIDATA.md).

---

## Proposta riorganizzazione (opzionale)

Se in futuro si vuole riordinare la documentazione, una struttura possibile è:

### 1. Root: solo ingressi essenziali
- **PROJECT_CONTEXT.md** — contesto progetto, stack, workflow, regole (resta il principale per AI/sviluppatori)
- **README.md** — descrizione repo, come avviare app/backend (se presente)
- Eventuali **COMMIT_MESSAGES.md** / **CURSOR_HANDOFF.md** come riferimenti operativi

### 2. docs/: tutto il resto
- **PROJECT_ROADMAP.md**, **DATABASE_SCHEMA.md**, **NETLIFY_DEPLOYMENT.md** — già in docs/
- **SESSION_NOTES_*.md** — in `docs/sessions/` (riorganizzazione applicata)
- **adr/** — già ordinata; da aggiornare solo l’indice in `adr/README.md` (vedi sotto)
- **Normative/** — documenti normativi (resta com’è)

### 3. ADR: numerazione univoca
- Oggi ci sono **due ADR-002** (offline-first-sync, checklist-alignment-strategy) e **tre ADR-003** (bidirectional-sync, database-architecture, pwa-mobile-android).
- Proposta: rinumerare in sequenza univoca (ADR-002, ADR-003, …) e aggiornare **solo** `docs/adr/README.md` con la tabella aggiornata e i link ai file (i nomi file possono restare per storia, oppure rinominare in `ADR-NNN-titolo-kebab-case.md`).
- Non è obbligatorio farlo subito: si può fare in un unico passaggio quando si tocca la documentazione ADR.

### 4. Riduzione duplicati
- **CLEANUP_ROADMAP.md**, **ROADMAP_RESET_COMPLETO.md**: valutare se unificarli con **PROJECT_ROADMAP.md** (o marcare come “storico” e tenere un solo roadmap attivo).
- **COMMIT_MESSAGES.md**: è di sessione; si può spostare in `docs/sessions/` o rinominare con data (es. `COMMIT_MESSAGES_20260208.md`) e citare da SESSION_NOTES.

---

**Riorganizzazione applicata**: session notes e COMMIT_MESSAGES in `docs/sessions/`; CLEANUP e ROADMAP_RESET in `docs/archive/`; DATABASE e BACKEND_API in `docs/`; indice ADR completo in `adr/README.md`.

Riepilogo: **sì, ha senso riorganizzare in modo organico** (meno file in root, indice chiaro, ADR con numeri univoci). Si può fare in modo incrementale; questo file serve da indice e da traccia per la riorganizzazione futura.
