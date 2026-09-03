# UX — Ponte checklist ↔ allegati (Riesame requisiti)

> Proposta UX (03/09/2026). **HITL confermato layout A** (03/09/2026) — implementazione PONTE-1 su branch codice.  
> HITL: ponte checklist↔allegati (non viste-per-ente); obbligatorietà = **flag**.  
> Piano: [`PLAN_VALUTAZIONE_COMMESSE_SLICES.md`](PLAN_VALUTAZIONE_COMMESSE_SLICES.md) · Brief: [`DEPUTYTASK.md`](DEPUTYTASK.md).  
> DNA: `.cr-*` su `ContractReviewPage`; niente secondo DMS / look nuovo.

---

## Raccomandazione Lead (unica) — layout A

**Layout primario:** restare nel tab **Checklist** del caso. Ogni voce P/F già ha testo + esiti Sì/No/N/A/Parziale + note (`.cr-checklist-item`). Sotto le note si aggiunge una zona **«Allegati collegati»** (stesso stile `.cr-*`, non una card nuova).

### Passo operatore (come appare)

1. Apre il caso → tab **Checklist** (come oggi: Genera preliminare/finale).
2. Su una voce (es. P3) sceglie esito e scrive note — invariato.
3. Sotto le note vede **Allegati collegati**:
   - elenco dei file già collegati a quella voce (nome + ruolo catalogo se c’è);
   - bottone secondario **«Collega allegato»** → sceglie tra gli allegati **già sul caso** (tab Documenti), non un upload parallelo;
   - opzionale: **«Carica e collega»** riusa lo stesso upload del caso e collega subito (un solo magazzino allegati).
4. Se la voce è marcata **obbligatoria** (vedi flag sotto): badge soft «Allegato richiesto» accanto al ref (P3). Se manca il file → badge ambra «Manca allegato»; **non** blocca il salvataggio di esito/note.
5. Solo su **Avanza stato** (workflow) scatta il gate **hard** se restano voci obbligatorie senza file (messaggio elenco voci + link al tab Checklist). Salvataggio e export Word restano soft (avviso, non blocco).

### Wireframe testuale (tab Checklist — una voce)

```text
┌─ P3  Requisiti dimensionali sul disegno ─────────────────────┐
│  [Sì] [No] [N/A] [Parziale]     badge: Allegato richiesto     │
│  Note: _________________________________________________      │
│  ── Allegati collegati ──                                     │
│  · disegno_revB.pdf (Disegno)                    [Scollega]   │
│  [ Collega allegato ]   [ Carica e collega ]                  │
│  (se manca file + flag ON:)  ⚠ Manca allegato obbligatorio    │
└───────────────────────────────────────────────────────────────┘
```

---

## Alternativa B (più corta)

Niente zona sotto ogni voce. Solo: badge «ha N allegati / manca» sulla riga + un drawer laterale «Allegati di questa voce» al click sul badge. Meno rumore in lista; un tap in più. Stesso modello dati e stessi gate soft/hard.

---

## Dove sta il flag «Obbligatorio»

| Livello | Chi lo setta | Dove in UI | Default |
|---------|--------------|------------|---------|
| **Template studio (ING-4)** — **fonte primaria** | Admin studio su `/settings/contract-checklist-templates` | Checkbox per voce template: «Allegato obbligatorio per questa voce» | OFF (molte voci non prevedono file) |
| Caso (checklist già generata) | Operatore **solo se** permesso studio (opzionale slice 2) | Stesso toggle in sola lettura di default; override raro | Eredita dal template al «Genera» |

**Raccomandazione:** flag **solo a livello template** nella prima implementazione. L’operatore sul caso **vede** il badge, non lo cambia. Evita confusione e allinea ING-4.

---

## Soft vs hard gate

| Azione | Flag OFF | Flag ON + file presente | Flag ON + file mancante |
|--------|----------|-------------------------|-------------------------|
| Salva esito / note | OK | OK | OK + badge ambra (soft) |
| Esporta Word | OK | OK | OK + riga avviso in UI (soft); Word può annotare «allegato mancante» |
| **Avanza stato** workflow | OK | OK | **Blocco** con elenco voci (hard) — oppure conferma esplicita «Avanza comunque» se Lead lo vuole in slice 2 |

Principio HITL: alcuni allegati possono non essere previsti → flag OFF = nessuna pressione UI.

---

## Riuso (gate Ponytail)

- UI voce: estendere `ChecklistItemRow` / classi `.cr-checklist-item`, `.cr-notes-textarea`, `.cr-answer-bar` — non inventare card.
- Upload/lista: riuso allegati caso + pattern `AttachmentSection` / `useAttachmentManager` se il modello lo consente; **niente** secondo DMS né tabella file parallela.
- Template: checkbox nella pagina template già esistente (`ContractChecklistTemplatesPage`).
- Non toccare viste-per-ente, auth/sync, SAL come motore.

---

## Fuori scope questa proposta

- Viste allegati per ente (slice successiva solo se utile).
- ING-5 agente triage (resta **dopo** / nebbia).
- VC-5 chiarimenti automatici da gap (Lead a parte).
- Implementazione FE/BE (attende conferma UX A o B).

---

## Domanda unica al committente

**Confermi questa UI (A) o preferisci B?**
