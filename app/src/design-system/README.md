# Design System — SGQ ISO 9001

> **DNA visivo dell'app** (equivalente di `AGENTS.md` per look e struttura delle schermate).
> Leggere **prima** di scrivere JSX/CSS. Non è un template di landing: è il vincolo che impedisce a un agente di inventare un'interfaccia nuova a ogni modulo.
>
> Catalogo live (solo DEV): route `/dev/ui-catalog`.
> Componenti collaudati: [`docs/reference/LIBRERIA_UI_SGQ.md`](../../../docs/reference/LIBRERIA_UI_SGQ.md).
> Audit duplicati noti: [`AUDIT.md`](AUDIT.md). Icone: [`ICONS.md`](ICONS.md).
>
> **Non** installare skill GitHub di frontend-design (Hallmark, Impeccable, Taste, plugin `frontend-design`). Il DNA è questo file + le tre schermate sotto.

## Voce del prodotto

Gestionale ISO per PMI e studi: denso, operativo, prevedibile. L'utente deve compilare, filtrare, chiudere un flusso — non essere impressionato.

- Colori: navy (`#1e3a5f`) + slate su fondo `#f8fafc`. Accento blu `#3b82f6` solo per azioni/link.
- Tipografia e spaziature già nel chrome di `AppLayout.css`. Nessuna palette parallela.
- Un modulo nuovo deve **sembrare già parte dell'app**, non un sito vetrina affiancato.

## Gate prima di scrivere UI

1. Esiste già un componente/classe? Cerca in `LIBRERIA_UI_SGQ.md`, `AUDIT.md`, `/dev/ui-catalog`.
2. Quale delle **3 schermate di riferimento** è più vicina al caso (shell / elenco+filtri / scheda a fasi)?
3. Copia struttura, token e interazioni da quella schermata; poi riempi i dati del modulo.
4. CSS solo con variabili `:root` di `AppLayout.css`. Se manca un token, proponilo qui — non hardcodare un colore nuovo in un CSS di pagina.
5. Se serve un pezzo davvero nuovo: crealo, aggiungilo al catalogo `/dev/ui-catalog` e una riga in `LIBRERIA_UI_SGQ.md`.

## Tre schermate di riferimento

Quando un deputy (o il Lead) costruisce o sistema una pagina, **parte da una di queste**, non da un prompt vago.

| # | Tipo di schermata | Copia da | Quando usarla |
|---|-------------------|----------|---------------|
| 1 | **Shell applicazione** | `app/src/layouts/AppLayout.jsx` + `AppLayout.css` | Layout, sidebar, header mobile, colori, raggio, ombre. È l'unica fonte dei token `:root`. |
| 2 | **Elenco operativo + filtri** | `QualificationsPage.jsx` (stesso pattern in `DeadlinesPage.jsx`) | Lista con card KPI cliccabili, **Ambito unico in AppLayout** (non in pagina), griglia `SgqDataGrid`. Una sola fonte di filtro per dimensione (niente tendina duplicata). |
| 3 | **Scheda operativa a fasi** | Drawer NC: `NCPage.jsx` + `.nc-drawer-section` + `useNcDrawerWidth.js` | Dettaglio/edit di un record con flusso ISO. Sezioni numerate collassabili, non un form unico alfabetico. |

### 1 — Shell (`AppLayout`)

- Sidebar navy, contenuto chiaro, header 56px, bottom nav su mobile.
- Token in `:root` (tabella sotto): `--color-primary`, `--color-bg`, `--radius`, `--shadow-sm`, ecc.
- Vietato un secondo chrome (altra sidebar, altro header, dark theme inventato).

### 2 — Elenco + filtri (`QualificationsPage`)

- Barra `.sq-stats-bar` / `.dl-stats-bar`: card con **numero + etichetta**, cliccabili, `aria-label` sul gruppo.
- Card = filtro (toggle). Stessa funzione di conteggio e di colore riga (una sola regola condivisa).
- Header: selettore **Ambito** azienda (`*CompanyScope.js`), non dropdown azienda in toolbar.
- Corpo lista: `SgqDataGrid` dove c'è una tabella; non reinventare `<table>` con CSS locale.
- Dettaglio: `DeadlinesPage.jsx` (card Attive / Scadute / In scadenza / Completate / Archiviate / Prese in carico). Regola filtri: `sgq-operating-memory.mdc` § *Filtri: singola fonte di verità*.

### 3 — Scheda a fasi (drawer NC)

- Layout `page-with-drawer` + handle di resize (`useNcDrawerWidth.js`).
- Ordine operativo, non alfabetico: **Scheda ? Stato ? Cause ? Azioni ? Evidenze ? Verifica ? Chiusura**.
- Sezioni `.nc-drawer-section` collassabili; gate sulle fasi non ancora rilevanti.
- Per un modulo nuovo con “scheda lunga”: stesso scheletro (sezioni numerate), non un wall of inputs.

**Dialog / overlay** (complemento, non quarta schermata): guscio unico `IngestDialogShell.jsx` (PR #377). Nuovi modal di revisione/split-view riusano la shell; dimensioni specifiche restano nel CSS del dialog figlio. **Visualizzatori documenti** (PDF / Word / Excel): chrome unico `DocumentViewerChrome` (Chiudi + Scarica + Schermo intero). Non è `IngestDialogShell`; `DocFileDialog` resta il form file.

## Anti-pattern visivi (AI slop adattato al gestionale)

Questi sono i pattern che i modelli inventano da soli. Da noi sono un difetto, non un “refresh”.

| Vietato | Perché | Fare invece |
|---------|--------|-------------|
| Palette nuova, gradienti viola/blu, crema-arancio, dark neon | Rompe identità industriale | Solo variabili `:root` di `AppLayout.css` |
| Hero, testimonials, pricing, FAQ da sito vetrina | Non è una landing | Lista / filtri / scheda come le 3 schermate |
| Tre card con icona gigante al centro | Pattern tipico “AI slop” | Card KPI come Qualifiche (numero + etichetta, cliccabili) |
| Bottoni “pill” glassmorphism / CTA da marketing | Incoerenti col resto | `.btn-primary` / `.btn-secondary` già in uso |
| Nuovo CSS per badge, spinner, toast, overlay già esistenti | Deriva visiva (già in `AUDIT.md`) | `StatusBadge`, `LoadingSpinner`, `Toast`, `IngestDialogShell` |
| Tendina + card KPI sulla stessa dimensione | Bug reali (Qualifiche, Scadenzari, NC, WPQR) | Solo le card; vedi regola filtri |
| Form unico alfabetico o un solo `<form>` enorme | Committente: UI guida il flusso | Sezioni operative come drawer NC |
| Overlay/dialog copiato e adattato | Guscio duplicato (ingest) | `IngestDialogShell` + CSS discendente |
| `input type="file"` nudo o dropzone copiata | Due modi di caricare, look diverso | `FileDropzone` (`zone` / `compact`) |
| Emoji decorative in JSX grezzo dopo `>` | Encoding + look da landing | SVG inline (`ICONS.md`) o `\u` **dentro stringa JS** |
| Skill/theme esterne (“Midnight”, “Editorial”, …) | Conflitto con ADR-015 e con questo DNA | Questo file |

## Variabili CSS disponibili

Definite in `:root` (`AppLayout.css`):

| Variabile | Valore | Uso |
|---|---|---|
| `--color-primary` | `#1e3a5f` | Testi principali, sidebar |
| `--color-primary-light` | `#2c5282` | Hover su primary |
| `--color-accent` | `#3b82f6` | Link, azioni principali |
| `--color-bg` | `#f8fafc` | Sfondo pagina |
| `--color-surface` | `#ffffff` | Sfondo card/pannelli |
| `--color-border` | `#e2e8f0` | Bordi, separatori |
| `--color-text` | `#1e293b` | Testo corpo |
| `--color-text-muted` | `#64748b` | Testo secondario |
| `--color-active-bg` | `#dbeafe` | Sfondo elemento attivo |
| `--color-active-text` | `#1d4ed8` | Testo elemento attivo |
| `--radius` | `8px` | Border-radius standard |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | Ombra leggera |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.1)` | Ombra media |
| `--sidebar-width` | `230px` | Larghezza sidebar |
| `--header-height` | `56px` | Altezza header mobile |

## Pattern approvati

### Badge di stato

Usare **sempre** `StatusBadge.jsx`:

```jsx
import StatusBadge from "../components/StatusBadge";

<StatusBadge status="bozza" type="document" />
<StatusBadge status="open" type="nc" />
<StatusBadge status="draft" type="audit" size="small" />
```

Tipi supportati: `document`, `audit`, `nc`, `norm_quality`, `project`, `user`, `license`.

### Card

Usare `Card` da `SharedComponents.jsx`:

```jsx
import { Card } from "../components/SharedComponents";

<Card title="Titolo">Contenuto</Card>
```

Per **card statistica cliccabile** (filtro), non usare `Card`: copiare `.sq-stat` / `.dl-stat` (schermata 2).

### Drawer / pannello laterale ridimensionabile

Pattern di riferimento: `NCPage.jsx` + `useNcDrawerWidth.js` (schermata 3).

Struttura:
```jsx
<div className="page-with-drawer">
  <div className="page-main">...</div>
  <div className="drawer" style={{ width: drawerWidth }}>
    <div className="drawer-resize-handle" onMouseDown={startResize} />
    <div className="drawer-content">...</div>
  </div>
</div>
```

### Form / Input

- Textarea auto-espandibile: `AutoTextarea.jsx`
- Input con validazione: validare su blur/cambio stato, mai su keystroke
- Select custom: pattern `NcResponsibleSelect.jsx`
- **Caricamento file**: sempre `FileDropzone` (`zone` in form, `compact` in toolbar). Trascina e clicca. Non un `input type="file"` nudo. Fotocamera e picker cartella restano pulsanti dedicati.

```jsx
import FileDropzone from "../components/FileDropzone";

<FileDropzone accept="application/pdf,.pdf" onFiles={(files) => setFile(files[0])} hint="PDF — max 50 MB" />
<FileDropzone variant="compact" multiple accept=".pdf" onFiles={setFiles} label="Carica PDF" />
```

### Tag / Chip

Usare `TagChip.jsx` per etichette colorate:

```jsx
import TagChip from "../components/TagChip";

<TagChip tag={{ name: "ISO 9001", color: "#3b82f6" }} />
<TagChip tag={tag} onRemove={handleRemove} size="small" />
```

### Feedback

| Tipo | Componente | Note |
|---|---|---|
| Notifica temporanea | `Toast` | Auto-dismiss 4s |
| Caricamento | `LoadingSpinner` | 3 dimensioni |
| Stato vuoto | `EmptyState` | Con azione opzionale |
| Salvataggio | `AutoSaveIndicator` | Spinner + timestamp |
| Conferma distruttiva | `ConfirmDialog` | Modal overlay |

### Modal

Preferire `IngestDialogShell` per overlay con header/layout/resizer/Escape. Pattern minimo:

```jsx
<div className="modal-overlay" onClick={onCancel}>
  <div className="modal-content" onClick={e => e.stopPropagation()}>
    <div className="modal-header"><h3>Titolo</h3></div>
    <div className="modal-body">...</div>
    <div className="modal-footer">
      <button className="btn btn-secondary">Annulla</button>
      <button className="btn btn-primary">Conferma</button>
    </div>
  </div>
</div>
```

## Anti-pattern tecnici da evitare

Oltre alla tabella visiva sopra:

| Anti-pattern | Alternativa |
|---|---|
| Creare un nuovo badge CSS locale | Usare `StatusBadge` con type/status |
| `fetch()` diretto | Usare `apiService` (Axios con interceptor) |
| Validazione su ogni keystroke | Validare su blur o cambio stato |
| `console.log` in produzione | Rimuovere prima del commit |
| Spinner custom inline | Usare `LoadingSpinner` |
| Modal senza overlay click-to-close | Usare pattern `ConfirmDialog` / `IngestDialogShell` |
| CSS duplicato per badge | Importare `StatusBadge.css` |
| Nuova libreria icone | SVG inline (vedi `ICONS.md`) |
| Stili inline per elementi ripetuti | Classe CSS riusabile |

## Come aggiungere un nuovo componente

1. **Verifica** che non esista già (vedi `AUDIT.md` e `/dev/ui-catalog`)
2. **Crea** il file in `app/src/components/NomeComponente.jsx`
3. **CSS** nel file parallelo `NomeComponente.css` — usare le variabili `:root`
4. **Esporta** come default o named export
5. **Aggiungi** al catalogo dev: `app/src/pages/DevUiCatalog.jsx`
6. **Aggiorna** questo README se è un pattern riusabile, e una riga in `LIBRERIA_UI_SGQ.md`

### Convenzioni di nomenclatura

- Componenti: PascalCase (`StatusBadge.jsx`)
- CSS: kebab-case con prefisso modulo (`sgq-badge--green`, `uic-section`)
- Hook: camelCase con prefisso `use` (`useNcDrawerWidth.js`)
- Variabili CSS: kebab-case con prefisso `--color-`, `--radius`, `--shadow-`

### Accessibilità minima

- Pulsanti: sempre `aria-label` se il testo non è autoesplicativo
- Contrasto colori: AA minimo (il `TagChip` calcola automaticamente il contrasto)
- Focus visibile: non rimuovere mai `outline` senza alternativa
