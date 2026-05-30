# Manuale utente — Modulo Non Conformità (NC)

> Registro cross-audit ISO 9001:2015 §8.7 + §10.2. Percorso app: **`/nc`** (alias API `/non-conformities`).  
> **Apri Canvas:** [manuale-modulo-nc.canvas.tsx](/Users/AI.Project/.cursor/projects/c-ProgettoISO/canvases/manuale-modulo-nc.canvas.tsx) in Cursor Glass.

## 1. Panoramica

Il modulo NC centralizza le non conformità di tutti gli audit dell'organizzazione: creazione manuale, import bulk da audit (ISO + checklist custom), azioni correttive, verifica efficacia, approvazione chiusura RQ ed export CSV.

| Ruolo | Cosa fa nel modulo |
|-------|-------------------|
| **Auditor** | Consulta NC collegate ai propri audit, aggiorna dettagli e azioni (se licenza modulo attiva) |
| **Admin / superadmin** | Tutto quanto sopra + approvazione chiusura NC (`approved_at`) |
| **Responsabile Qualità (RQ)** | Stesso profilo admin per gate chiusura; supervisione scadenze e verifica efficacia |

Stati NC: **Aperta** ? **In corso** ? **Risolta** ? **Verificata** ? **Chiusa**.

Gate obbligatori (codice `ncWorkflow.js`):

- Passaggio a **Verificata** o **Chiusa**: richiede **note verifica efficacia** salvate nel pannello dettaglio.
- Passaggio a **Chiusa**: richiede prima **Approva chiusura** (solo admin/superadmin); compare il pulsante solo in stato Verificata.

## 2. Flusso stati e gate

```
Aperta ? In corso ? Risolta ? Verificata ??[Approva RQ]??? Chiusa
                              ?
                    note verifica obbligatorie
```

Azioni correttive (per singola NC): **Aperta** ? **In corso** ? **Completata** ? **Verificata** (con nota verifica azione obbligatoria).

## 3. Scenari operativi

### 3.1 NC da audit ISO (push bulk)

1. Durante la **chiusura guidata audit**, sezione trasferimento al registro NC.
2. Pulsante **Trasferisci al registro NC** ? `POST /audits/:id/push-to-nc-register`.
3. Crea righe con `source_type` `audit_nc` o `audit_oss` (idempotente: stessa domanda ISO non duplicata).
4. **Annulla** entro ~10 secondi (`DELETE` stesso endpoint) se push errato — solo NC ancora `open` senza azioni.

### 3.2 NC da checklist custom

Stesso push bulk: le risposte NC/OSS su voci custom entrano nel registro con `source_custom_item_id` (migration 072). Indice univoco `(audit_id, source_custom_item_id)` evita duplicati.

### 3.3 NC manuale

1. In `/nc` ? **+ Nuova NC**.
2. Selezionare audit collegato, sezione (ISO HLS o sezioni API standard), descrizione, severità, responsabile, scadenza.
3. Server imposta `source_type: manual`; numero suggerito prefisso `NC-M-`.

### 3.4 Gestione azioni (attuazione + verifica)

Nel pannello dettaglio NC, sezione **Azioni correttive**:

- Tipi: immediata, correttiva, preventiva.
- Workflow: Avvia ? Completa ? Verifica (nota obbligatoria).
- Filtri scadenza azioni: Tutte / Scadute / In scadenza 7 gg.

### 3.5 Allegati evidenze

Sezione **Allegati evidenze** nel dettaglio NC. Upload opzionale (`category: evidence`). Non obbligatori per avanzare lo stato (regola SGQ: evidenze mai gate di compilazione).

### 3.6 Approvazione RQ

In stato **Verificata**, admin/superadmin vede **Approva chiusura** ? `POST /non-conformities/:id/approve-closure`. Solo dopo compare il passaggio a **Chiusa**.

### 3.7 Filtri e scadenze

- Card statistiche cliccabili: Aperte, In corso, Scadute, In scadenza 7 gg.
- Filtri aggiuntivi: severità, cliente, ricerca numero/descrizione.
- Vista **Azioni in scadenza**: aggregato cross-NC (30 gg + scadute).

### 3.8 Export CSV

Pulsante **Export CSV** ? file `registro-nc-YYYY-MM-DD.csv` con filtri griglia correnti (UTF-8 BOM).

### 3.9 Link audit e deep-link

- Selezione riga aggiorna URL: `/nc?select={nc_id}` (condivisibile).
- Nel dettaglio, link all'audit origine (`/audit`).
- Reclamo origine: link `/reclami?complaint=` se `source_type: complaint`.

## 4. FAQ

**Perché non posso chiudere la NC?**  
Serve approvazione RQ (`approved_at`) e note verifica salvate.

**Perché il push audit non crea nuove righe?**  
Idempotenza: NC già presenti per stessa domanda/item vengono saltate (`skipped_count`).

**Posso eliminare un'azione?**  
Solo se ancora in stato Aperta.

**Il modulo NC non si apre (403)?**  
Verificare licenza organizzazione; admin/superadmin bypassano il controllo modulo.

**Cosa significa origine Audit NC vs Manuale?**  
`audit_nc`/`audit_oss` = push da checklist; `manual` = creazione da registro; `complaint` = da reclamo.

## 5. Troubleshooting

| Sintomo | Causa probabile | Azione |
|---------|-----------------|--------|
| Alert "Compilare note verifica" | Gate workflow | Salvare note nel pannello dettaglio prima di Verificata/Chiusa |
| Alert approvazione RQ | `approved_at` assente | Admin usa Approva chiusura |
| Griglia vuota dopo filtro | Filtro attivo | Reset filtri o card Totali |
| Export CSV disabilitato | Nessuna riga visibile | Rimuovere filtro o ricerca |
| Push undo fallito | NC già lavorate | Undo solo su NC `open` senza azioni |

## 6. Glossario

| Termine | Significato |
|---------|-------------|
| NC | Non conformità (§8.7 / §10.2) |
| OSS | Osservazione (push come `audit_oss`) |
| Gate | Regola che blocca transizione stato |
| RQ | Responsabile Qualità (ruolo admin per approvazione) |
| Push | Trasferimento bulk da audit a registro NC |
| Verifica efficacia | Note obbligatorie prima di Verificata/Chiusa |

## 7. Riferimenti

- App: [https://systemgest.netlify.app/nc](https://systemgest.netlify.app/nc)
- Guida operativa: [GUIDA_CONSOLIDATA.md](../GUIDA_CONSOLIDATA.md) — sezione sessione NC / hardening
- Codice: `app/src/pages/NCPage.jsx`, `app/src/utils/ncWorkflow.js`, `backend/src/controllers/nc.controller.js`
- Migration DB: `database/migrations/072_nc_hardening.sql`

---

*Ultimo aggiornamento: maggio 2026 — NC Fase 1 + hardening 072 (push custom, approvazione RQ).*
