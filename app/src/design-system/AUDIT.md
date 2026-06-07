# Audit Componenti UI — SGQ ISO 9001

> Generato: 2026-06-06 | Scopo: mappatura componenti riusabili e identificazione duplicati.

## Componenti condivisi (`SharedComponents.jsx`)

| Componente | Props | Note |
|---|---|---|
| `ErrorBoundary` | `children` | Class component, catch globale |
| `LoadingSpinner` | `size`, `message` | Varianti: small, medium, large |
| `Toast` | `type`, `message`, `onClose` | Tipi: success, error, warning, info — auto-dismiss 4s |
| `ConfirmDialog` | `title`, `message`, `onConfirm`, `onCancel` | Modal overlay |
| `AutoSaveIndicator` | `isSaving`, `lastSaved` | Spinner + timestamp |
| `EmptyState` | `icon`, `title`, `message`, `action` | Stato vuoto generico |
| `Badge` | `children`, `variant` | Varianti: default, primary, success, warning, danger |
| `ProgressBar` | `value`, `max`, `showLabel`, `variant` | Barra percentuale |
| `Card` | `title`, `children`, `actions`, `className` | Contenitore con header |
| `Tabs` | `tabs`, `activeTab`, `onChange` | Tab navigation orizzontale |

## Badge di stato — situazione attuale (DUPLICATI)

### 1. Stato documento (`DocumentRegistry`, `DocumentDataGrid`)

- Classe: `.status-badge.status-{value}`
- Valori: `vigente`, `rilasciato`, `bozza`, `in_revisione`, `in_approvazione`, `obsoleto`
- CSS in: `DocumentRegistry.css` (righe 474-487)

### 2. Stato audit (`AuditAccordionLayout`)

- Componente locale: `AuditStatusBadge` (non esportato)
- Classe: `.audit-status-badge.badge-status-{cls}`
- Valori: `draft`, `in_progress`, `suspended`, `completed`, `approved`, `archived`
- CSS in: `AuditAccordionLayout.css` (righe 177-192)

### 3. Stato audit MetricsDashboard

- Classe: `.status-badge.{status}` (riusa nome generico)
- Valori: `draft`, `in_progress`, `completed`, `archived`
- CSS in: `MetricsDashboard.css` (righe 332-357)

### 4. Stato NC (`PendingIssuesCascade`)

- Classe: `.issue-nc-status-badge.nc-badge--{status}`
- Valori: `open`, `in_progress`, `resolved`, `verified`, `closed`
- CSS in: `PendingIssuesCascade.css` (righe 409-422)

### 5. Stato utente (`UsersAdminPage`)

- Classe: `.user-status-badge.inactive` / `.orphan-auditor`
- CSS in: `UsersAdminPage.css` (righe 121-128, 304-306)

### 6. Stato licenza (`LicensesSettingsPage`)

- Classe: `.license-status-badge`
- CSS in: `LicensesSettingsPage.css` (riga 232)

### 7. Qualità testo norma (`NormUploadButton`)

- Classe: `.norm-quality-badge.norm-quality--{quality}`
- Valori: `good`, `partial`, `poor`
- CSS in: `NormUploadButton.css` (righe 260-281)

### 8. Stato norma catalogo (`DocumentForm`, `ImportJobsPage`)

- Classe: `.norm-status-badge.norm-status-{stato}`
- Valori: `vigente`, `ritirata`, `sostituita`, `loading`, `unknown`
- CSS in: `DocumentForm.css` (riga 710+)

### 9. Stato progetto (`ProjectsPage`)

- Componente locale: `StatusBadge` (non esportato)
- Classe: `.pj-status.pj-status-{status}`

## Altre categorie di componenti

### Drawer / pannello laterale ridimensionabile

| File | Descrizione |
|---|---|
| `useNcDrawerWidth.js` | Hook per ridimensionamento drawer NC |
| `NCPage.jsx` | Implementazione drawer con resize handle |
| `DocumentDetailPanel.jsx` | Pannello dettaglio documento (destra) |

### Form / input

| Componente | File | Note |
|---|---|---|
| `AutoTextarea` | `AutoTextarea.jsx` | Textarea auto-espandibile |
| `RichTextField` | `RichTextField.jsx` | Input con formattazione |
| `TagEditor` | `TagEditor.jsx` | Selezione/creazione tag |
| `NcResponsibleSelect` | `NcResponsibleSelect.jsx` | Select custom con ricerca |

### Tag / Chip

| Componente | File | Note |
|---|---|---|
| `TagChip` | `TagChip.jsx` | Chip colorato con contrasto WCAG, rimuovibile |
| `TagFilterBar` | `TagFilterBar.jsx` | Barra filtro con chip multipli |
| `MetricsByStandardChip` | `MetricsByStandardChip.jsx` | Chip metriche per standard |

### Modal / Dialog

| Componente | File | Note |
|---|---|---|
| `ConfirmDialog` | `SharedComponents.jsx` | Modal generico conferma |
| `NcCreateModal` | `NcCreateModal.jsx` | Modal creazione NC |
| `AiConclusionsModal` | `AiConclusionsModal.jsx` | Modal conclusioni AI |
| `DocFileDialog` | `DocFileDialog.jsx` | Dialog file documento |

### Feedback / indicatori

| Componente | File | Note |
|---|---|---|
| `Toast` | `SharedComponents.jsx` | Notifica temporanea |
| `ConnectionStatus` | `ConnectionStatus.jsx` | Indicatore online/offline |
| `SyncMergeBanner` | `SyncMergeBanner.jsx` | Banner merge sync |
| `AuditLockBanner` | `AuditLockBanner.jsx` | Banner audit bloccato |
| `AutoSaveIndicator` | `SharedComponents.jsx` | Indicatore salvataggio |

### Navigazione / layout

| Componente | File | Note |
|---|---|---|
| `AppLayout` | `layouts/AppLayout.jsx` | Sidebar + header + content |
| `AuditAccordionLayout` | `AuditAccordionLayout.jsx` | Accordion navigazione audit |
| `DocumentBreadcrumb` | `DocumentBreadcrumb.jsx` | Breadcrumb documenti |

## Conclusioni

**Problema principale**: i badge di stato sono implementati 9+ volte con pattern CSS diversi. Nessun componente esportato e riusabile copre tutti i casi.

**Azione**: creare `StatusBadge.jsx` unificato che copra tutte le varianti (documento, audit, NC, qualità norma, progetto, utente).
