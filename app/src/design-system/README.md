# Design System — SGQ ISO 9001

Guida rapida per lo sviluppo frontend coerente.

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

### Drawer / pannello laterale ridimensionabile

Pattern di riferimento: `NCPage.jsx` + `useNcDrawerWidth.js`.

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

Pattern base:
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

## Anti-pattern da evitare

| Anti-pattern | Alternativa |
|---|---|
| Creare un nuovo badge CSS locale | Usare `StatusBadge` con type/status |
| `fetch()` diretto | Usare `apiService` (Axios con interceptor) |
| Validazione su ogni keystroke | Validare su blur o cambio stato |
| `console.log` in produzione | Rimuovere prima del commit |
| Spinner custom inline | Usare `LoadingSpinner` |
| Modal senza overlay click-to-close | Usare pattern `ConfirmDialog` |
| CSS duplicato per badge | Importare `StatusBadge.css` |
| Nuova libreria icone | SVG inline (vedi `ICONS.md`) |
| Stili inline per elementi ripetuti | Classe CSS riusabile |

## Come aggiungere un nuovo componente

1. **Verifica** che non esista già (vedi `AUDIT.md`)
2. **Crea** il file in `app/src/components/NomeComponente.jsx`
3. **CSS** nel file parallelo `NomeComponente.css` — usare le variabili `:root`
4. **Esporta** come default o named export
5. **Aggiungi** al catalogo dev: `app/src/pages/DevUiCatalog.jsx`
6. **Aggiorna** questo README se è un pattern riusabile

### Convenzioni di nomenclatura

- Componenti: PascalCase (`StatusBadge.jsx`)
- CSS: kebab-case con prefisso modulo (`sgq-badge--green`, `uic-section`)
- Hook: camelCase con prefisso `use` (`useNcDrawerWidth.js`)
- Variabili CSS: kebab-case con prefisso `--color-`, `--radius`, `--shadow-`

### Accessibilit\u00e0 minima

- Pulsanti: sempre `aria-label` se il testo non è autoesplicativo
- Contrasto colori: AA minimo (il `TagChip` calcola automaticamente il contrasto)
- Focus visibile: non rimuovere mai `outline` senza alternativa
