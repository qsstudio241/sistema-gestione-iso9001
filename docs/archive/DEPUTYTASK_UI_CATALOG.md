# DEPUTYTASK � Catalogo UI e standardizzazione componenti

**Priorit�:** Media  
**Tipo:** Autonomo, non bloccante  
**Assegnato a:** Deputy (agente autonomo)

---

## Obiettivo

Creare un catalogo formale e navigabile di tutti i componenti UI dell'app ProgettoISO, rilevare inconsistenze tra moduli e proporre/applicare correzioni di standardizzazione. Il risultato deve ridurre la deriva visiva tra moduli e dare agli agenti futuri un riferimento chiaro.

---

## Contesto

L'app (`app/src/`) � una SPA React/Vite con design system CSS parziale. Ogni modulo � stato sviluppato iterativamente e presenta divergenze:
- Badge stato: classi CSS diverse tra NC, Documenti, Norme
- Pannello laterale: ridimensionabile in NC, solo ora esteso a Documenti
- Icone: mix emoji + SVG inline + nessuna libreria unificata
- Feedback upload/errori: formato non uniforme
- Form: stili inconsistenti tra moduli

---

## Compiti (in ordine di priorit�)

### 1. Audit componenti esistenti
Analizza `app/src/components/`, `app/src/pages/`, `app/src/styles/`:
- Elenca tutti i componenti riusabili gi� presenti
- Per ogni tipo (badge, card, drawer, button, form input, modal, spinner, feedback) verifica se esistono varianti duplicate o inconsistenti
- Documenta il risultato in `app/src/design-system/AUDIT.md`

### 2. Pagina catalogo `/dev/ui-catalog`
Crea una pagina React visibile solo in `NODE_ENV=development` (route `/dev/ui-catalog`) che mostri:
- Tutti i componenti con le loro varianti e stati
- Badge stato documento per tutti i valori (bozza, rilasciato, in_revisione, in_approvazione, obsoleto)
- Badge qualit� testo norma (buona, parziale, OCR scarso)
- Pulsanti (primario, secondario, danger, disabled)
- Card documento
- Drawer/pannello laterale ridimensionabile
- Spinner / loading states
- Feedback success/error (es. risultati upload)
- Tag/chip

### 3. Unificare badge stato
Crea un singolo componente `StatusBadge.jsx` con props `status` e `docType` che copra tutti i moduli. Sostituisci le implementazioni duplicate in NC, Documenti, Norme.

### 4. Linea guida icone
Scegli UNA strategia (preferenza: Lucide React gi� installato o SVG inline minimal) e documenta in `app/src/design-system/ICONS.md`. Non implementare la migrazione completa � solo la linea guida e un esempio per tipo.

### 5. Documento design system
Crea `app/src/design-system/README.md` con:
- Variabili CSS disponibili
- Pattern approvati (drawer, card, form)
- Anti-pattern da evitare
- Come aggiungere un nuovo componente seguendo lo standard

---

## Vincoli

- NON rompere funzionalit� esistenti
- NON fare refactor massicci � solo ci� che � necessario per unificare badge e creare la pagina catalogo
- Build Vite deve passare senza errori
- Commit + push su main al termine
- NON serve deploy backend

---

## Output atteso

- `app/src/design-system/AUDIT.md`
- `app/src/design-system/README.md`
- `app/src/design-system/ICONS.md`
- `app/src/components/StatusBadge.jsx` + CSS
- `app/src/pages/DevUiCatalog.jsx` (solo dev)
- Route `/dev/ui-catalog` in `App.jsx` (guard `import.meta.env.DEV`)
- Commit su main con messaggio `feat(design-system): catalogo UI, audit componenti, StatusBadge unificato`

---

## Note operative

- Repo: `c:\ProgettoISO`
- App: `app/`
- Backend: non toccare
- Riferimento pannello ridimensionabile: `app/src/hooks/useNcDrawerWidth.js` e `NCPage.jsx`
- Riferimento badge esistente: cerca `status-badge`, `doc-status`, `norm-quality-badge` in `app/src/`
