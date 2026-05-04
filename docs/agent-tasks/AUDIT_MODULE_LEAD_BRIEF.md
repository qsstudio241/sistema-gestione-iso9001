# Brief lead — Modulo Audit: analisi gap e piano task

> **Scopo**: conservare in **un’unica fonte** l’analisi funzionale/architetturale del modulo audit (`/audit`) per **lead agent** (pianificazione, review, suddivisione su deputy).  
> **Pubblico**: lead / architect AI; i deputy ricevono **slice** estratte da qui o da `DEPUTYTASK.md` (task attivo singolo).  
> **Aggiornamento**: revisionare questo file quando cambiano comportamento reale, priorità prodotto o dopo chiusura slice (data ultima revisione in fondo).

---

## 1. Sintesi esecutiva

| Voce | Contenuto |
|------|-------------|
| **Stato complessivo** | Nucleo audit **operativo**: checklist ISO/custom, allegati, sync multi-device (server-wins), lock solo UX, temporal DB, export Word, pending issues su DB, chiusura/approvazione API. |
| **Gap verso “professionale” al 100%** | Read-only post-chiusura **non** uniforme su UI; API risposte **non** blocca audit `completed`; re-audit: UX pendenze **diversa** dalla checklist, senza deep-link domanda; chiusura **80%** ignora completamento **solo custom**; registro NC in audit **disallineato** da backend converter e da modulo `/nc`; allegati offline **SYNC-5** backlog; Word/security token allegati in roadmap. |
| **Decisione prodotto da fissare** | Registro NC **in audit** vs **modulo NC organizzazione** (fonti multiple) e ponte **audit → documentale**. |

---

## 2. Flusso utente target (riferimento committente)

1. Creazione audit → compilazione checklist (C/NC/OSS/OM/NA/NV + note + allegati) per ogni requisito.  
2. Esito metriche + conclusioni → chiusura formale → export Word (con/senza foto) → rifinitura esterna → **carico manuale** in modulo Documenti.  
3. Anno successivo: **re-audit** con pendenze da audit precedente, **stessa UX** checklist in lettura mirata, verifica efficacia, chiusura pendenze, ripetizione ciclo.  
4. NC organizzative: modulo **dedicato** (`/nc`) con possibile **ingresso automatico** dagli audit (non duplicare senza regole).

Il codice oggi copre bene **1** e in parte **2**–**3**; **4** è parzialmente sovrapposto (`NonConformitiesManager` in audit).

---

## 3. Mappa perimetro codice (lead: dove intervenire)

| Area UI | File principali |
|---------|-------------------|
| Shell route audit | `app/src/App.jsx` (`/audit` → `Dashboard`) |
| Lista / crea / re-audit | `app/src/components/AuditSelector.jsx` |
| Accordion verbale | `app/src/components/AuditAccordionLayout.jsx` |
| Dati generali / standard | `app/src/components/GeneralDataSection.jsx` |
| Obiettivo | `app/src/components/AuditObjectiveSection.jsx` |
| Pendenze DB | `app/src/components/PendingIssuesCascade.jsx` |
| Rilievi certificatore | `app/src/components/CertificationFindingsSection.jsx` |
| Checklist ISO | `app/src/components/ChecklistModule.jsx`, `QuestionCard.jsx` |
| Checklist custom | `app/src/components/CustomChecklistAuditView.jsx` |
| NC in audit (registro locale) | `app/src/components/NonConformitiesManager.jsx` |
| Esito / conclusioni | `app/src/components/AuditOutcomeSection.jsx` |
| Chiusura | `app/src/components/AuditClosePanel.jsx` |
| Export | `app/src/components/ExportPanel.jsx`, `app/src/utils/wordExport.js`, `wordExportHelpers.js` |
| Stato / sync | `app/src/contexts/StorageContext.jsx`, `app/src/services/syncService.js` |
| Converter backend ↔ FE | `app/src/utils/auditConverter.js` |
| Metriche checklist | `app/src/utils/metricsCalculator.js` |
| API audit / pending / complete | `backend/src/controllers/audit.controller.js`, `audit.routes.js` |
| API risposte | `backend/src/controllers/response.controller.js` |

---

## 4. Matrice gap: cosa fa oggi (GA) vs ottimale

Legenda priorità: **P0** bloccante per coerenza/rischio | **P1** UX o allineamento flusso | **P2** hardening o nice-to-have.

| # | Area | GA (oggi) | Ottimale | Pri |
|---|------|-----------|----------|-----|
| G1 | Post-chiusura / approvazione | `AuditClosePanel` aggiorna stato; **checklist e metadati restano editabili** in UI; `response.controller` **non** impedisce PUT su audit completato. | UI read-only centralizzata (`isAuditLocked`); policy API su `approved` (minimo) o `completed` se policy interna. | P0 |
| G2 | Re-audit pendenze | `PendingIssuesCascade`: card dedicate, GET/PUT `pending-issues`; ordinamento lista = ordine API. | Stessa card checklist + ordinamento **NC → OSS → NV**; pulsante **“Vai alla domanda”** (ISO/custom); messaggio esplicito se zero pendenze. | P1 |
| G3 | Creazione audit vs DB pending | Modal re-audit: `checkReaudit` + `getNcResponses` → copia `pendingIssues` locale (**OM esclusi**). DB lazy-init può **divergere** dalla copia iniziale. | **Una fonte**: dopo creazione, sempre GET pending; oppure server crea righe e FE non duplica logica. | P1 |
| G4 | `AuditClosePanel` completamento | Soglia **80%** su `currentAudit.checklist` (struttura ISO); audit **solo custom** può avere `checklist` vuota → soglia bypassata. | Regola per **solo ISO / solo custom / misto**; blockers allineati al perimetro reale. | P1 |
| G5 | Sezione 11 | Metriche ISO + custom (`has_outcome_buttons`); testo “dettaglio in checklist”. | Drill-down lista; roadmap: Word tabella rilievi **C/NA** (decisione cliente). | P2 |
| G6 | `NonConformitiesManager` | Modello ricco (10.2) in `currentAudit.nonConformities`; `backendToFrontend` imposta **`nonConformities: []`**; `non_conformities_count` da **metriche checklist** (NC come esito). | O separare metriche (“NC checklist”) da registro, o persistere registro server + sync; ponte opzionale a `POST /nc`. | P1 |
| G7 | Export Word | Prepara audit + pending + allegati; JWT in URL allegati. | Token download **monouso** (roadmap 0.B); allineamento template backlog. | P2 |
| G8 | Documenti | Nessun collegamento automatico da export. | Azione “Registra in documentale” con metadati/versione. | P2 |
| G9 | Offline allegati | SYNC-5 backlog (roadmap). | Blob IndexedDB → upload reconnect con stato UI. | P2 |

---

## 5. Backlog slice per deputy (estratti consigliati)

Ogni slice: **un PR**, test L1 dove esiste pattern, aggiornamento **una riga** in `PROJECT_ROADMAP.md` o in questo brief (sezione “Changelog brief”).

| Slice ID | Titolo | Perimetro | Accettazione minima |
|----------|--------|-----------|---------------------|
| **S-A1** | Gate read-only UI post-stato | `AuditAccordionLayout`, figli che editano (`GeneralDataSection`, `ChecklistModule`, `CustomChecklistAuditView`, `NonConformitiesManager`, …) | Se `metadata.status` ∈ `completed`/`approved`/`archived` → disabilitare edit salvo policy esplicita (es. solo admin). |
| **S-A2** | Policy API scrittura checklist | `response.controller.js` (+ test Jest se presenti) | `PUT`/`bulk` risposte rifiutati se audit `approved` (definire se anche `completed`). |
| **S-A3** | Chiusura: completamento custom | `AuditClosePanel.jsx` + eventuale helper metriche custom | Audit solo custom: blockers coerenti (% o “tutti item con esito”). |
| **S-A4** | Pending: ordinamento + deep link | `PendingIssuesCascade.jsx` + routing interno accordion (stato `openSubSections`) | Ordine NC→OSS→NV; click apre checklist alla domanda (`questionId` / `custom_item_id` se in payload). |
| **S-A5** | Allineare pending creazione vs DB | `AuditSelector.jsx` (CreateAuditModal) + backend se necessario | Nessuna doppia logica incoerente; documentare flusso in 2 righe qui sotto changelog. |
| **S-A6** | NC audit vs modulo NC | design minimo + opzionale implementazione | Documento decisione: depreca registro in audit / sync server / “Crea NC” verso API. |
| **S-A7** | Export → documentale | `ExportPanel` + `DocumentRegistry` (se API esiste) | Solo se product conferma: stub o integrazione reale. |

**Dipendenze suggerite**: S-A2 dipende da decisione policy (completed vs approved). S-A4 può richiedere campi aggiuntivi in `GET pending-issues`. S-A5 può toccare `audit.controller` (init pending).

---

## 6. Cosa **non** mescolare nello stesso slice

- Migrazioni DB + refactor accordion completo + smoke Word nello stesso PR.  
- Modulo `/nc` completo + redesign audit nello stesso PR.  
- Abilitare `VITE_SYNC_MODE=events` in prod senza smoke L3 documentato (`GUIDA_CONSOLIDATA`).

---

## 7. Riferimenti documentazione repository

| Documento | Uso |
|-----------|-----|
| `docs/GUIDA_CONSOLIDATA.md` | Sync, deploy, lezioni sessione audit (T1–T5, server-wins). |
| `docs/PROJECT_ROADMAP.md` | Backlog trasversale (Sezione 11 Word, SYNC-5, norm_excerpt, …). |
| `docs/adr/ADR-008-event-sourcing-sync.md` | Vincoli sync event-based. |
| `docs/adr/ADR-007-logout-offline-backup-e-mirror-cartella-pc.md` | Logout vs bozze. |
| `docs/BACKEND_API.md` | Contratti API (aggiornare se cambiano gate). |

---

## 8. Changelog brief

| Data | Autore | Modifica |
|------|--------|----------|
| 2026-05-04 | Agent | Creazione brief da analisi gap modulo audit + flusso committente + matrice GA/ottimale. |

---

**Uso operativo per il lead**: per il deputy, copiare **una slice** dalla tabella §5 in `docs/agent-tasks/DEPUTYTASK.md` con riferimento esplicito a `AUDIT_MODULE_LEAD_BRIEF.md` (sezione + ID slice) e criteri di accettazione; chiudere il task aggiornando §8 e la roadmap se cambia priorità globale.
