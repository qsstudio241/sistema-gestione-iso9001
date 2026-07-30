# Modulo WPS — Generazione da WPQR (pivot prodotto)

> **Tipo**: spec di prodotto + roadmap a slice  
> **Versione**: 1.0 — 30/07/2026  
> **Decisione**: l’ingest batch di PDF WPS **non** è il cuore del modulo; il valore è **generare una WPS** a partire dalle WPQR disponibili e segnalare le **estensioni mancanti**.  
> **Cliente di riferimento**: Mason (coordinatore saldatura)  
> **Norme**: ISO 15614-1 (range WPQR), ISO 15609-1/-2 (contenuto WPS), ISO/TR 15608 (gruppi materiale), ISO 4063 / 6947  
> **Riferimenti**: [ISO-15614-1-range-validita-WPQR.md](../reference/ISO-15614-1-range-validita-WPQR.md) · [ISO-15609-WPS-contenuto.md](../reference/ISO-15609-WPS-contenuto.md) · [ADR-010](../adr/ADR-010-ai-agentic-architecture.md) · [piano_modulo_saldatura_v2.plan.md](piano_modulo_saldatura_v2.plan.md) · brief [DEPUTYTASK1.md](../agent-tasks/DEPUTYTASK1.md)

---

## Sintesi (per il committente)

Domanda tipica all’assistente:

> «Genera una WPS per saldatura **FW** di **S355** spessore **10 mm** con **S235** spessore **5 mm**, usando le WPQR disponibili; segnala se non è realizzabile per estensioni mancanti.»

Il sistema deve:

1. Capire i parametri del giunto (tipo, materiali, spessori, processo se noto).
2. Cercare nelle **WPQR** dell’azienda (ambito) quelle che **coprono** il caso secondo ISO 15614-1.
3. Se almeno una WPQR copre → **bozza WPS** (ISO 15609) da revisionare e salvare.
4. Se nessuna copre → risposta chiara: **WPS non realizzabile** + elenco **estensioni** necessarie (nuova prova / range insufficiente / gruppo materiale non coperto).

L’upload PDF WPS resta solo come **import legacy** (documenti già scritti altrove), non come flusso principale.

---

## Distinzione moduli (non confondere)

| Modulo | Domanda | Ruolo WPS |
|--------|---------|-----------|
| **WPS generazione** (questo doc) | «Posso saldare *questo* giunto con le WPQR che ho?» | **Cuore** |
| **Registro WPS/WPQR** (`WeldingProceduresPage`) | CRUD + allegati | Persistenza bozza/attiva |
| **Ingest WPQR** | «Carico un certificato di procedura» | Alimenta il matcher |
| **Ingest WPS** | «Importo una WPS già scritta» | Legacy / opzionale |
| **SAL** ([MODULO_SAL…](MODULO_SAL_SCOPO_E_ROADMAP.md)) | Avanzamento SGQ clausola×stato | **Nessun overlap** — altro prodotto |
| **Commesse / copertura** | «Questa commessa ha saldatori/WPS?» | Consuma WPS già generate |

---

## Architettura target

```
Richiesta (chat AI o form "Genera WPS")
        │
        ▼
wpsGenerator.service.js
  ├─ parseRequest()        → parametri strutturati (AI opzionale)
  ├─ resolveMaterialGroups() → S355→1.2, S235→1.1 (15608 + mappa gradi comuni)
  ├─ findMatchingWpqr()    → query multi-tenant + Ambito company_id
  ├─ checkCoverage()       → 15614 Tabella 5/7/8 (deterministico)
  └─ buildWpsDraft()       → campi 15609 da WPQR vincente
        │
        ▼
{ status: 'ok'|'partial'|'not_possible',
  wpqr_used, wps_draft, extensions_needed[], warnings[] }
```

**Regola ADR-010**: i vincoli numerici e di gruppo materiale sono **deterministici**; l’AI orchestra linguaggio naturale e redige note, **non** decide la conformità del range.

---

## Roadmap slice

| Slice | Obiettivo | Stato |
|-------|-----------|--------|
| **P0** | Codifica **Tabella 5** (acciai) + `wpsGenerator` + caso Mason FW S355/S235 + test L1 | ✅ Implementato (DEPUTYTASK1, 30/07/2026) |
| **P1** | Endpoint `POST /welding/wps/generate` + UI anteprima / salva bozza + chip AskAi | Dopo P0 |
| **P1b** | Completare Tabella 7 Level 1 (GAP estrazione) se verificata su PDF ufficiale | Opzionale |
| **P2** | Deprecare/nascondere upload batch WPS come flusso primario; export Word WPS | Dopo P1 |

---

## Criteri di accettazione prodotto (caso Mason)

| Input | Atteso |
|-------|--------|
| FW, S355 10 mm + S235 5 mm, WPQR gruppo 1 (o 1.2) con range spessore FW che include 5–10 mm | `status=ok` (o `partial` con warning), bozza WPS con `joint_type=FW`, materiali/spessori richiesti, `wpqr_ref` valorizzato |
| Stesso caso ma WPQR solo su inox gruppo 8 | `status=not_possible`, `extensions_needed` con motivo gruppo materiale |
| Stesso caso ma spessore fuori range Tabella 8 / thickness_min–max WPQR | `status=not_possible` o `partial` + estensione spessore |

---

## Cosa non fare

- Non sostituire l’ingest **WPQR** (resta fondamentale).
- Non far decidere all’LLM se un range 15614 è coperto.
- Non mischiare questo flusso nel modulo SAL.
- Non inventare WPQR assenti: se il registro è vuoto → `not_possible` esplicito.
