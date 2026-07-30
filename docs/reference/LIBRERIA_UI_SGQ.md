# Libreria componenti UI SGQ — riferimento rapido

> Fonte unica per il riuso componenti/classi CSS nel progetto.  
> Aggiornare qui quando si aggiunge un nuovo blocco riutilizzabile.

## Componenti collaudati

| Elemento | Componente/classe | Note |
|----------|-------------------|------|
| Pulsanti esito C/NC/OSS/OM/NA/NV | `status-btn compliant/non-compliant/partial/om/not-applicable/not-verified` + `.active` | `ChecklistModule.css` |
| Textarea note/evidenze | `className="notes-textarea"` | `ChecklistModule.css` |
| **Domanda checklist (qualsiasi tipo)** | **`QuestionCard.jsx`** | Props: `question`, `onStatusChange`, `onNotesChange`, `attachmentManager`, `auditId`, `customItemId`, `statusOptions` (opzionale — sottoinsieme pulsanti, default 6 standard); slot `children` per contenuto extra. Usare per ISO, custom e qualsiasi futuro tipo di domanda. |
| Caricamento allegati | `AttachmentSection.jsx` + `useAttachmentManager` hook | Supporta `customItemId` (migration 047) |
| Preview allegati server | `AttachmentPreview.jsx` | Supporta `questionId` (ISO) e `customItemId` (custom) |
| Conteggio NC/OSS/OM (Sezione 11) | `calculateFindingsMetrics` + `calculateCustomFindingsMetrics` (`metricsCalculator.js`) via `AuditOutcomeSection.jsx` | — |
| Stato salvato/errore form | `custom-checklist-form-error`, `custom-checklist-saving` | `CustomChecklistAuditView.css` |
| Route protetta da licenza | `LicensedRoute` (wrapper `App.jsx`) | Prop `licenseKey` |
| Selezione ambito azienda | Pattern Ambito (`CompanySelector`) | Usare pattern esistente nelle pagine AI |
| Disclaimer AI | `AiDisclaimer.jsx` | Footer non invasivo; testo da ADR-010 §9 |
| Card/tabella azione admin (dashboard superadmin) | `.billing-card`, `.billing-table`, `.btn-primary`/`.btn-secondary` (`BillingDashboardPage.css`) | Riusato per la sezione "Rielaborazioni disponibili" (28/07/2026); pattern per qualsiasi nuovo pannello cross-tenant nella dashboard superadmin |

## Motivazione

Riuso garantisce consistenza visiva, comportamento già testato, scalabilità senza debito tecnico.  
Ogni nuova implementazione parallela va considerata un difetto da correggere.

## Aggiornamento

Aggiungere righe quando si crea un nuovo componente riutilizzabile durante una slice.  
Non duplicare questa tabella in `.cursor/rules/` — linkare da lì.
