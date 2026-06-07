# Linea guida icone — SGQ ISO 9001

## Strategia adottata: SVG inline minimal

Il progetto **non** usa librerie di icone esterne (Lucide, Heroicons, ecc.) per mantenere il bundle leggero e senza dipendenze aggiuntive.

### Approccio consigliato

1. **Emoji Unicode** per icone decorative semplici (stati, feedback)
2. **SVG inline come componente React** per icone funzionali (azioni, navigazione)

### Pattern per SVG inline

```jsx
function IconChevronDown({ size = 16, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
```

### Esempi per tipo

| Contesto | Approccio | Esempio |
|---|---|---|
| Stato badge (C/NC/OSS) | Emoji in stringa JS | `"\u2713"` per check, `"\u2717"` per errore |
| Azione (elimina, modifica) | SVG inline 16px | Trash, Pencil |
| Navigazione (menu, back) | SVG inline 20px | Menu, ArrowLeft |
| Feedback (success, error) | Emoji in Toast | `"\u2713"` success, `"\u2717"` error |
| Decorativo (empty state) | Emoji | `"\uD83D\uDCED"` mailbox |

### Regole

- **Mai** installare `lucide-react`, `react-icons` o simili senza approvazione esplicita
- **Mai** usare `<img src="icon.svg">` — usare sempre SVG inline per gestione colore via `currentColor`
- Le SVG devono avere `fill="none"` e `stroke="currentColor"` per ereditare il colore dal contesto
- Dimensioni standard: 14px (inline text), 16px (pulsanti), 20px (navigazione), 24px (header)
- Se servono molte icone dello stesso set, valutare uno sprite SVG in `public/`

### Dove mettere le icone riusabili

Creare un file `app/src/components/Icons.jsx` con export named per ogni icona:

```jsx
export function IconTrash(props) { /* ... */ }
export function IconEdit(props) { /* ... */ }
export function IconPlus(props) { /* ... */ }
```

Importare singolarmente dove servono per tree-shaking.
