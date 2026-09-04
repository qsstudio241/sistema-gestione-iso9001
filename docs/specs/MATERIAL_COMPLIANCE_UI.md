# Material Compliance — UI MVP (MC-0)

> **Tipo**: spec tecnica UI (nessun JSX in questa slice)  
> **Versione**: 1.0 — 16/08/2026  
> **Stato**: Proposto — fondazione  
> **Slice**: implementazione in **MC-5** (+ gate licenza visibile in **MC-6**)  
> **DNA**: [`app/src/design-system/README.md`](../../app/src/design-system/README.md) — copiare schermata **2** (elenco Qualifiche) e, per il dettaglio, schermata **3** (sezioni drawer NC) + `IngestDialogShell` per la revisione PDF  
> **Libreria**: [`LIBRERIA_UI_SGQ.md`](../reference/LIBRERIA_UI_SGQ.md)  
> **Data model**: [MATERIAL_COMPLIANCE_DATA_MODEL.md](MATERIAL_COMPLIANCE_DATA_MODEL.md) · **API**: [MATERIAL_COMPLIANCE_API.md](MATERIAL_COMPLIANCE_API.md)  
> **Prodotto**: [MODULO_MATERIAL_COMPLIANCE_AI.md](MODULO_MATERIAL_COMPLIANCE_AI.md)

---

## Sintesi (per il committente)

Una voce di menu **Materiali** nel gruppo Saldatura. Si vede una **tabella** come le Qualifiche: DDT, certificato, se è lamiera o filo, colata o lotto, esito. Si clicca la riga e si apre la scheda con PDF, dati estratti e semaforo. **Base e apporto stanno nella stessa lista.**

Niente dashboard, niente editor delle norme, niente secondo look.

---

## Route e menu

| Elemento | Valore MVP |
|----------|------------|
| Path elenco | `/saldatura/materiali` |
| Path dettaglio | `/saldatura/materiali/:id` |
| Voce sidebar | Gruppo **Saldatura**, label **Materiali**, dopo Commesse (ordine operativo: commessa → materiali in accettazione → procedure) |
| `licenseKey` UI | Seam `MATERIAL_COMPLIANCE` (MC-6): oggi `saldatura` **e** `ai_import`. Capability OFF → `LicensedRoute` + `ModuleLocked` (stesso guscio Qualifiche) |
| Ambito | Solo `CompanyScopeSelect` in `AppLayout`. **Niente** tendina azienda in pagina |

Pagine da creare in MC-5 (nomi indicativi): `MaterialCertificatesPage.jsx` (elenco), dettaglio nella stessa pagina con drawer **oppure** `MaterialCertificateDetailPage.jsx` se il PDF a tre pannelli non entra nel drawer NC. Decisione MC-5: se il preview PDF + testo sta stretto, pagina intera; non inventare un layout nuovo.

---

## Schermate MVP (slim)

| Schermata | MVP | Post-MVP |
|-----------|-----|----------|
| Elenco + upload | Sì | — |
| Dettaglio PDF / testo / esito + HITL | Sì | — |
| Dashboard KPI / statistiche avanzate | **No** | Sì |
| Editor KB / norme in UI | **No** (file Git) | Valutare |
| CRUD consumabili nel Welding Book | **No** | Mai: è questa lista |

Aggiungere in `ModuleLocked` (MC-6) la chiave `material_compliance` (o riuso descrizione `saldatura`) con tre bullet: carica 3.1, confronta con norma/ordine, approva.

---

## Elenco — copia Qualifiche

Copiare struttura di `QualificationsPage.jsx`:

1. Header pagina (titolo + azioni).
2. Barra card KPI cliccabili (`.sq-stats-bar`).
3. `SgqDataGrid` — non una `<table>` locale.

### Azioni (gated, visibili)

Regola operativa: il controllo prerequisito si toglie; **i pulsanti restano visibili**.

| Pulsante | Prerequisito | Se manca |
|----------|--------------|----------|
| **Carica certificato** | Ambito = un’azienda (non «Tutto lo studio») | `disabled` + `title` «Seleziona un’azienda in Ambito» |
| **Carica certificato** | Licenza `ai_import` | `disabled` + title licenza (oltre al `ModuleLocked` di pagina) |

Niente secondo selettore azienda accanto al pulsante.

Upload: `FileDropzone` (PDF, anche scansione). Dopo upload → riga `received` e, quando l’extract è pronto, si entra in revisione. Riusare flusso ingest (`IngestDialogShell`) e la zona unica `FileDropzone`, non un dropzone locale.

### Card KPI — due dimensioni, una fonte ciascuna

**Dimensione Esito** (stesso `workflow_status` della colonna Esito e del colore riga):

| Card | Filtro |
|------|--------|
| In revisione | `pending_review` (+ `received` / `text_ready` / `extracted` / `ocr_running` come «in lavorazione» se si vuole un solo secchio operativo) |
| Conformi | `compliant` |
| Non conformi | `non_compliant` |
| Archiviati | `archived` |

Conteggio card = stessa funzione del colore riga. **Niente tendina Esito** oltre alle card.

**Dimensione Ruolo** (stesso `material_role` della colonna Ruolo):

| Card | Filtro |
|------|--------|
| Base | `base` |
| Apporto | `filler` |

Niente tendina Ruolo. Le due dimensioni si combinano (Esito ∩ Ruolo), come Qualifiche tipo ∩ stato.

### Colonne griglia (chiuse)

Ordine sinistro→destro:

| Colonna | Campo | Note |
|---------|-------|------|
| N. DDT | `ddt_no` | Vuoto ammesso |
| Data DDT | `ddt_date` | |
| N. certificato | `certificate_no` | |
| Ruolo | `material_role` | Badge testo «Base» / «Apporto» — `StatusBadge` o cella semplice, niente CSS nuovo |
| Materiale (designazione) | `designation` | S355J2 oppure `G 42 4 M21 3Si1` |
| Colata / lotto | `heat_or_lot_no` | Base = colata; apporto = lotto |
| Forma | `product_form` | Label IT da enum data model |
| Dimensioni | `dimensions` | Una cella |
| Norma | `material_standard` | |
| Fornitore / acciaieria | `manufacturer_works` | |
| Esito | `workflow_status` | Colore riga allineato alle card Esito |

Non in griglia: chimica, ReH/Rm/A/KV, CEV, PDF, note, commessa.

---

## Dettaglio (al click)

Ordine **operativo**, sezioni collassabili (`.nc-drawer-section` o equivalenti della pagina):

1. **Identificazione** — DDT, n. certificato, ruolo, designazione, colata/lotto, forma, dimensioni, norma, fornitore, tipo 2.1–3.2.
2. **PDF** — preview (`AttachmentPreview` / pattern ingest). Scan a pieno schermo se serve.
3. **Testo estratto** — `extracted_text` + `text_extract_reason` visibile se `ocr_*` (l’operatore capisce perché è illeggibile).
4. **Valori laboratorio** — chimica e meccaniche dal JSON; sull’apporto gli stessi campi se stampati, altrimenti «non sul certificato».
5. **Esito Rule Engine** — tabella `checks[]` (chiave, livello ADR-021, richiesto, rilevato, pass/fail/skip, spiegazione). Skip tubi/apporto **leggibile**, non un errore rosso.
6. **Azioni HITL** — sempre visibili:
   - Correggi campo (blur, non tasto per tasto) → ri-valuta
   - Approva conforme
   - Conferma non conforme
   - Archivia (dopo decisione, MC-7 può collegare il registry)

Nessun auto-passaggio a conforme. `AiDisclaimer` in calce al blocco extract (ADR-010).

Correzione campi: form delle chiavi dizionario, non un JSON editor grezzo per l’operatore. JSON grezzo solo se ruolo admin e post-MVP.

---

## Componenti da riusare (vietato reinventare)

| Bisogno | Dove |
|---------|------|
| Elenco + KPI | `QualificationsPage.jsx` + `.sq-stat` |
| Griglia | `SgqDataGrid.jsx` |
| Overlay revisione PDF | `IngestDialogShell.jsx` |
| Disclaimer AI | `AiDisclaimer.jsx` |
| Gate licenza | `LicensedRoute` + `ModuleLocked` |
| Badge stato | `StatusBadge.jsx` |
| Note | `notes-textarea` |
| Allegato / preview | `AttachmentSection` / `AttachmentPreview` se il file non passa dal job ingest |

CSS: solo variabili `:root` di `AppLayout.css`. Nessuna palette parallela.

---

## Desktop-first

La verifica certificato (PDF + griglia valori) è lavoro da ufficio. Mobile: elenco in sola lettura accettabile; upload e HITL non sono il target del primo rilascio. Nessuna PWA nuova.

---

## Cosa NON fare

- Voce menu Dashboard / Statistiche / KB editor in MVP.
- Seconda pagina «Consumabili» distinta da «Materiali».
- Tendina Esito o Ruolo se esistono già le card di quella dimensione.
- Nascondere «Carica certificato» quando manca l’azienda: resta visibile, disabilitato.
- Emoji decorative in JSX grezzo; icona sidebar: escape Unicode in stringa JS, come le altre voci Saldatura.
- Copiare lo shell overlay ingest in un quarto dialog.
