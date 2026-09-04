# Libreria componenti UI SGQ — riferimento rapido

> Fonte unica per il **riuso** componenti/classi CSS nel progetto.
> **DNA visivo** (token, anti-pattern, 3 schermate da copiare prima di scrivere markup): [`app/src/design-system/README.md`](../../app/src/design-system/README.md).
> Catalogo live (solo DEV): `/dev/ui-catalog`.
>
> Aggiornare qui quando si aggiunge un nuovo blocco riutilizzabile.

## Schermate di riferimento (pagina intera)

| Tipo | Copia da | Note |
|------|----------|------|
| Shell (sidebar, token `:root`) | `AppLayout.jsx` + `AppLayout.css` | Unica fonte colori/raggi/ombre |
| Elenco + filtri KPI | `QualificationsPage.jsx` (anche `DeadlinesPage.jsx`) | Card cliccabili = unico filtro per dimensione; `SgqDataGrid` |
| Scheda a fasi | Drawer NC (`NCPage.jsx`, `.nc-drawer-section`) | Ordine operativo, sezioni collassabili |

## Componenti collaudati

| Elemento | Componente/classe | Note |
|----------|-------------------|------|
| Pulsanti esito C/NC/OSS/OM/NA/NV | `status-btn compliant/non-compliant/partial/om/not-applicable/not-verified` + `.active` | `ChecklistModule.css` |
| Textarea note/evidenze | `className="notes-textarea"` | `ChecklistModule.css` |
| **Domanda checklist (qualsiasi tipo)** | **`QuestionCard.jsx`** | Props: `question`, `onStatusChange`, `onNotesChange`, `attachmentManager`, `auditId`, `customItemId`, `statusOptions` (opzionale — sottoinsieme pulsanti, default 6 standard); slot `children` per contenuto extra. Usare per ISO, custom e qualsiasi futuro tipo di domanda. |
| Caricamento allegati | `AttachmentSection.jsx` + `useAttachmentManager` hook | Supporta `customItemId` (migration 047) |
| Preview allegati server | `AttachmentPreview.jsx` | Supporta `questionId` (ISO) e `customItemId` (custom) |
| Badge di stato (documenti, NC, audit, …) | `StatusBadge.jsx` | Non creare un badge CSS locale |
| Card contenitore | `Card` da `SharedComponents.jsx` | Per KPI cliccabili: `.sq-stat` / `.dl-stat`, non `Card` |
| Griglia dati | `SgqDataGrid.jsx` | Liste modulo (Qualifiche, Scadenzari, SAL, …) |
| Overlay dialog ingest / split-view | `IngestDialogShell.jsx` | Guscio unico (PR #377); CSS specifico nel dialog figlio. Anche import Excel M03 (`RiskM03ImportDialog`) |
| Overlay visualizzatore documenti (PDF / Word / Excel) | `DocumentViewerChrome.jsx` | Chrome unico: **Chiudi** + **Scarica** (se già previsto) + **Schermo intero / Riduci**. Toggle CSS sul viewport dell'app (non Fullscreen API, non finestra Windows). Vietato imitare ─ □ ✕ di sistema. `DocFileDialog` resta il form file. |
| Cerca azienda nel registro | `CompanyRegistrySearch.jsx` | Lista da spuntare (classi `did-*`); non salva da sola |
| Conteggio NC/OSS/OM (Sezione 11) | `calculateFindingsMetrics` + `calculateCustomFindingsMetrics` (`metricsCalculator.js`) via `AuditOutcomeSection.jsx` | — |
| Stato salvato/errore form | `custom-checklist-form-error`, `custom-checklist-saving` | `CustomChecklistAuditView.css` |
| Route protetta da licenza | `LicensedRoute` (wrapper `App.jsx`) | Prop `licenseKey` |
| Selezione ambito azienda | `CompanyScopeSelect` in `AppLayout` (`CompanyScopeContext`) | Combobox in alto (digita per filtrare); le pagine **non** hanno un secondo Ambito. Helper: `buildScopeMenuOptions` / `filterScopeMenuOptions` |
| Disclaimer AI | `AiDisclaimer.jsx` | Footer non invasivo; testo da ADR-010 §9 |
| Card/tabella azione admin (dashboard superadmin) | `.billing-card`, `.billing-table`, `.btn-primary`/`.btn-secondary` (`BillingDashboardPage.css`) | Riusato per la sezione "Rielaborazioni disponibili" (28/07/2026); pattern per qualsiasi nuovo pannello cross-tenant nella dashboard superadmin |

## Motivazione

Riuso garantisce consistenza visiva, comportamento già testato, scalabilità senza debito tecnico.
Ogni nuova implementazione parallela va considerata un difetto da correggere.

## Aggiornamento

Aggiungere righe quando si crea un nuovo componente riutilizzabile durante una slice.
Non duplicare questa tabella in `.cursor/rules/` — linkare da lì.
