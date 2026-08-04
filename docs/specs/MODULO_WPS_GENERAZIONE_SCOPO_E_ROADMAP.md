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
| **P1** | Endpoint + UI anteprima/salva bozza + suggerimento AskAi (caso Mason in linguaggio naturale) | ✅ Implementato (DEPUTYTASK1, 30/07/2026) |
| **P1b** | Completare Tabella 7 Level 1 (GAP estrazione) se verificata su PDF ufficiale | Opzionale |
| **P2** | Export Word WPS (modulo ISO 15609-1 Annex A) | ✅ v1 (30/07/2026) — `wordExportWps.js` + pulsante Word in tab WPS |
| **P2b** | Deprecare/nascondere upload batch WPS come flusso primario | ✅ (31/07/2026) — «Import PDF (legacy)» a richiesta |
| **P3** | Status `need_input` + domande se dati giunto incompleti (AI orchestra, check 15614 solo con input completi) | ✅ 04/08/2026 |
| **P4** | Assistente: se `need_input` → porre le `questions[]` all’utente; poi richiamare generate | Backlog |
| **P5** | Riesame: rassegna multi-giunto da requisiti/documenti + copertura WPQR (advisory) + visione NDT advisory | Backlog |

---

## Orchestrazione AI (accordo prodotto 04/08/2026)

1. L’AI valuta se la richiesta sul giunto è **completa** (tipo, materiali/gruppi, spessori…).
2. Se manca qualcosa → **domande pertinenti** (`status: need_input`, campo `questions[]`) — non indovina.
3. Con input completi → chiama il **check deterministico** WPQR/15614 (`ok` / `partial` / `not_possible` + estensioni).
4. L’AI **non** decide da sola se un range è coperto; spiega il risultato del motore.

---

## Dettaglio P2 — Export Word (Annex A)

> Prerequisito: WPS generabile/salvabile (P0+P1).  
> Norma: ISO 15609-1 Annex A (form copiabile). Layout ricostruito da §4: Annex A nel PDF digitalizzato è poco leggibile.

**v1 ✅**: documento `.docx` programmatico (`docx`, come SAL); etichette Annex A; campi noti da `welding_procedures` (+ `company_name` Ambito); resto vuoto; pulsante **Word** su ogni riga tab WPS; test `wordExportWps.test.js`.  
**v1 non include**: deprecazione upload (P2b), 15609-2 dedicato, sketch obbligatorio, migrazione DB.

---

## Dettaglio P1 (storico — implementato)

> Prerequisito: `wpsGenerator.service.js` + Tabella 5 + test Mason verdi su `main`.  
> File brief: sovrascrivere `DEPUTYTASK1.md` con **Stato: APERTO** solo a P0 mergiato.

### P1-A — API

| Elemento | Spec |
|----------|------|
| Route | `POST /api/v1/welding/wps/generate` |
| Licenza | già `requireLicensedModule('saldatura')` sul router; se si usa AI per parse testo → anche gate `ai_norms` solo su quel ramo |
| Body | `{ company_id?, joint_type, welding_process?, parent_material_a, parent_material_b, thickness_a_mm, thickness_b_mm, free_text? }` |
| Comportamento | Chiama `generateWpsFromWpqr` (P0). **Nessuna scrittura DB** in generate. |
| Response | Stesso shape P0: `status`, `wpqr_used`, `candidates`, `wps_draft`, `extensions_needed`, `warnings` |
| Persistenza | Salvataggio bozza = `POST /welding/wps` esistente con payload da `wps_draft` (status `bozza`) — human-in-the-loop |
| Test | Jest controller/route: ok / not_possible / org scope; non chiamare AI se body già strutturato |

### P1-B — UI su `WeldingProceduresPage`

| Elemento | Spec |
|----------|------|
| Entry | Pulsante **«Genera WPS»** nell’header tab WPS (vicino a «+ Nuova WPS»), pattern Ambito già presente |
| Form | Campi: tipo giunto (FW/BW), materiale A/B (testo grado o gruppo), spessore A/B mm, processo opzionale |
| Esito ok/partial | Pannello anteprima campi bozza + lista warning; azioni **Salva bozza** / Annulla |
| Esito not_possible | Messaggio chiaro + elenco `extensions_needed` (niente form vuoto da salvare) |
| Riuso | Stili `WeldingProceduresPage.css` / form esistenti; niente card decorative parallele |
| Upload PDF | Secondario: **Import PDF (legacy)** a richiesta (P2b ✅) — flusso primario = Genera WPS |

### P1-C — AskAi (linguaggio naturale)

| Elemento | Spec |
|----------|------|
| Contesto | Estendere `saveQualContext` / chip in `AiAssistantPage` `buildContextualSuggestions` con suggerimento tipo: «Genera WPS FW S355 10 mm + S235 5 mm dalle WPQR» |
| Flusso preferito | Chip → utente conferma → FE chiama `POST .../wps/generate` con parametri estratti **o** form precompilato; matching resta nel service P0 |
| Vietato | Far decidere all’LLM se il range 15614 è coperto |
| Disclaimer | `AiDisclaimer` se c’è testo generato dall’AI |

### DoD P1

- [x] Endpoint + test Jest
- [x] UI genera → anteprima → salva bozza (caso Mason manuale)
- [x] Chip/suggerimento AskAi collegato al form o all’API
- [x] `deploy-manifest.json` + deploy VPS se nuovi file backend
- [x] Vitest FE mirati + build
- [x] Aggiornare questa spec (P1 ✅) + `DEPUTYTASK1` CHIUSO

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
