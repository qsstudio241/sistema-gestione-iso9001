# Libreria UI SGQ — catalogo componenti

> Fonte operativa per standard grafico, riuso e deprecazione duplicati.  
> Aggiornare quando si introduce un nuovo blocco UI riusabile.  
> Copertura stimata **Fase A: ~55–65%** dell’interfaccia (componenti condivisi ok; `pages/` e CSS per-pagina da secondo passaggio).

Riferimento rapido anche in `.cursor/rules/sgq-operating-memory.mdc` (tabella «blocco unico»).

---

## 1. Catalogo per categoria

### Pulsanti esito / workflow

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Esito checklist C/NC/OSS/OM/NA/NV | `.status-btn` + varianti + `.active` | `btn-workflow` (Reclami) | `ChecklistModule.css`, `QuestionCard.jsx`, `NCPage.jsx` | Domande audit; filtri NC | **btn-workflow** ? `.status-btn` o pulsante workflow dedicato |
| Step workflow NC | `.status-btn` via `NC_WORKFLOW_CFG` | Etichette lunghe senza override 40×40 | `NCPage.jsx`, `NCPage.css` | Transizioni stato NC nel **drawer** | No — usare **`.nc-workflow-btn`** (min-width, nowrap) |

### Pulsanti azione primari / secondari

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Primario | `.btn-primary` | Ridefinizioni in 8+ CSS pagina | `index.css` | CTA principale | **Sì** — solo `index.css` |
| Secondario | `.btn-secondary` | Stesse pagine + `.btn-edit` Reclami | `index.css` | Azioni secondarie | **Sì** — consolidare |
| Pericolo | `.btn-danger` | Inline sparse | `SharedComponents.jsx` | Conferme distruttive | Estrarre in `index.css` |

### Campi testo / textarea (+ dettatura)

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Note audit | `AutoTextarea` + `notes-textarea` | `outcome-textarea` | `AutoTextarea.jsx`, `QuestionCard.jsx` | Checklist, audit | No |
| Note NC | `RichTextField` | Textarea raw Reclami, `cr-notes-textarea` | `RichTextField.jsx`, `NcDetailPanel.jsx` | NC con draft + storico | Migrare legacy |
| Dettatura | In `AutoTextarea` | — | `AutoTextarea.jsx` | Campi con AutoTextarea/RichTextField | Richiede `Permissions-Policy: microphone=(self)` |

### Banner / alert / stat cards

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Alert generico | `.alert` | Banner pagina-specifici | `index.css` | Messaggi inline | Valutare `SgqAlert` |
| Banner sync/lock | `SyncMergeBanner`, `AuditLockBanner` | — | rispettivi jsx | Solo audit multi-device | Mantieni |
| Stat cards | `.nc-stat` / `.nc-stats-bar` | `.metric-card`, Home stats | `NCPage.css` | KPI cliccabili | Consolidare pattern |
| Toast | `Toast` | — | `SharedComponents.jsx` | Feedback transitorio | Estendere uso |

### Griglie / tabelle

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Griglia generica | `SgqDataGrid` | — | `SgqDataGrid.jsx` | NC, admin, template | No — `onRowSelect(rowKey, row)` |
| Registro documenti | `DocumentDataGrid` | — | `DocumentDataGrid.jsx` | Solo dominio documenti | Non duplicare altrove |

### Drawer / pannelli laterali

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Drawer slide-in | `.doc-detail` + overlay | `.nc-detail-drawer` override | `DocumentDetailPanel.css`, `NCPage.jsx` | Dettaglio documento / NC | No — NC riusa shell documenti |

### Modali

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Conferma | `ConfirmDialog` | — | `SharedComponents.jsx` | Sì/no | No |
| Form standard | `.modal-overlay` (AuditSelector) | 12+ overlay custom pagina | `AuditSelector.css`, varie pagine | Form creazione | **Sì** — estrarre `SgqModal` |

### Allegati

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Upload audit | `AttachmentSection` + `useAttachmentManager` | — | `AttachmentSection.jsx` | Domande ISO/custom | No |
| Preview | `AttachmentPreview` | — | `AttachmentPreview.jsx` | Anteprima server | No |
| Allegati NC | `NcAttachmentsSection` | `EvidenceManager` | `NcAttachmentsSection.jsx` | Evidenze NC | **EvidenceManager** @deprecated |

### Form validation

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Errore inline | `.custom-checklist-form-error` | `.form-error`, `.docform-error` | varie CSS | Blur/submit, mai keystroke | Consolidare `.sgq-form-error` |
| Salvataggio | `.custom-checklist-saving`, `AutoSaveIndicator` | — | audit custom | Autosave | No |

### Badge / stati

| Categoria | Componente canonico | Varianti / duplicati | File | Quando usare | Deprecare? |
|-----------|---------------------|----------------------|------|--------------|------------|
| Badge base | `Badge` | Poco usato | `SharedComponents.jsx` | Tag neutri | Estendere |
| Stato NC | `.nc-tag` | — | `NCPage.css` | Registro NC | Fino a design system |
| Stato reclamo | `.cst-tag`, `.sev-tag` | — | `ComplaintsPage` | Reclami | Allineare palette NC |

### Componenti rimossi / deprecati

| Componente | Sostituto | Stato |
|------------|-----------|-------|
| `AuditTabsLayout` (+ `.css`) | `AuditAccordionLayout` | **Rimosso** 31/05/2026 (zero import attivi) |
| `NonConformitiesManager` (+ `.css`) | `NCPage` + `NcDetailPanel` | **Rimosso** 31/05/2026 (zero import attivi) |
| `EvidenceManager` | `AttachmentSection` | @deprecated — ancora in repo se referenziato |

---

## 2. Matrice moduli × componenti

Legenda: ? = uso diretto | ? = parziale/legacy | — = non usato

| Componente / pattern | Audit | NC | Documenti | Reclami | Admin |
|---------------------|:-----:|:--:|:---------:|:-------:|:-----:|
| `QuestionCard` + `.status-btn` | ? | — | — | — | — |
| `RichTextField` | — | ? | — | — | — |
| `AutoTextarea` / `notes-textarea` | ? | ? | — | — | — |
| `AttachmentSection` | ? | — | — | — | — |
| `NcAttachmentsSection` | — | ? | — | — | — |
| `SgqDataGrid` | — | ? | — | — | ? |
| `DocumentDataGrid` | — | — | ? | — | — |
| `.doc-detail` drawer | — | ? | ? | — | — |
| `.btn-primary` | ? | ? | ? | ? | ? |
| Banner sync | ? | — | — | — | — |
| Stat cards | ? | ? | ? | ? | — |

---

## 3. Top 5 duplicati (priorità Fase C)

1. **`.btn-primary` / `.btn-secondary`** duplicati in CSS pagina ? solo `index.css`
2. **12+ overlay modale** custom ? `SgqModal` da pattern AuditSelector + `ConfirmDialog`
3. **Textarea** raw vs `RichTextField` / `AutoTextarea`
4. **Badge** per modulo (`nc-tag`, `cst-tag`, …) ? palette condivisa
5. **`DocumentDataGrid` vs `SgqDataGrid`** — non duplicare griglie fuori dominio documenti

**Gap copertura (secondo passaggio):** `pages/` (Login, Home, Settings, Rischi, Progetti, Welding, ContractReview), shell app (menu/header), CSS per-pagina non catalogati.

---

## 4. Piano pulizia

| Fase | Contenuto | Stato |
|------|-----------|-------|
| **A** | Questo catalogo + link in GUIDA | ? 30/05/2026 |
| **B** | Refactor NC drawer, encoding, RichTextField end-to-end | ? sessione NC |
| **C** | Deprecare duplicati (pulsanti, modali, badge, legacy) | Backlog P2 |

---

## 5. Regole operative

Prima di creare un nuovo elemento UI:

1. Cercare in questo file e in `sgq-operating-memory.mdc`
2. Riutilizzare il canonico; documentare qui solo se genuinamente nuovo
3. Non introdurre override pagina per `.btn-primary` o `.modal-overlay`
4. Textarea con dettatura: `AutoTextarea` o `RichTextField` (NC)

---

*Ultimo aggiornamento: 2026-05-30 — Fase A (sessione chiusura Modulo NC)*
