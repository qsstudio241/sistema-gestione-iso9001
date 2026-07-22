# Reference — schemi e API stabili

Riferimenti tecnici da consultare durante sviluppo o debug (non procedure passo-passo).

| File | Contenuto |
|------|-----------|
| [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) | Schema DB (fonte di verità) |
| [DATABASE.md](DATABASE.md) | Connessione, ambienti, quick-ref |
| [BACKEND_API.md](BACKEND_API.md) | Endpoint API |
| [DATABASE_MAPPING.md](DATABASE_MAPPING.md) | Mapping tabelle / legacy |
| [LIBRERIA_UI_SGQ.md](LIBRERIA_UI_SGQ.md) | Catalogo componenti UI, duplicati, matrice moduli |

### Cataloghi ingest saldatura (Livello A — ADR-017)

| Guida | Catalogo JS | Campo |
|-------|-------------|-------|
| [ISO-TR-15608-gruppi-materiali.md](ISO-TR-15608-gruppi-materiali.md) | `materialGroups15608.js` | `material_group` |
| [ISO-4063-processi-saldatura.md](ISO-4063-processi-saldatura.md) | `weldingProcesses4063.js` | `welding_process` |
| [ISO-6947-posizioni-saldatura.md](ISO-6947-posizioni-saldatura.md) | `weldingPositions6947.js` | `welding_positions` |

### Range di validità qualifiche (norme complete, non solo cataloghi)

| Guida | Copre |
|-------|-------|
| [ISO-9606-1-range-validita-patentino.md](ISO-9606-1-range-validita-patentino.md) | Saldatori manuali — spessore/diametro/posizioni, validità 3/2 anni |
| [ISO-15614-1-range-validita-WPQR.md](ISO-15614-1-range-validita-WPQR.md) | WPQR procedure — livelli, spessore/diametro, campi essenziali |
| [ISO-14732-operatori-saldatura.md](ISO-14732-operatori-saldatura.md) | Operatori saldatura automatica/meccanizzata — validità 6/3 anni (diversa da 9606-1) |

Piano slice: [PLAN_INGEST_REFERENCE_CATALOGS.md](../agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md).

Deploy: [how-to/deploy.md](../how-to/deploy.md). Esperienza operativa: [GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md).
