# Sistema Gestione ISO 9001/14001/45001 - v1.0

Applicazione web completa per la gestione audit interni conforme a **UNI EN ISO 9001:2015** (Punto 9.2), **ISO 14001:2015** e **ISO 45001:2018**.

## Architettura Dati

Il sistema implementa un'architettura a flusso centralizzato:

```
User Input → Context API → localStorage (backup) → File System (master) → Export Helper → JSON/Word/PDF
```

### Componenti Architetturali

- **Context API**: Gestione stato centralizzata dell'applicazione
- **localStorage**: Backup automatico locale dei dati
- **File System**: Fonte master autoritativa (cartella `Export/`)
- **Export Helper**: Sistema centralizzato per esportazioni multiple

## Funzionalità Principali

### 1. Gestione Audit Interni (Punto 9.2)

- Pianificazione e registrazione audit
- Mappatura su punti specifici ISO 9001:2015
- Tracciamento conformità e non conformità
- Export report in Word/PDF

### 2. Gestione Non Conformità (Punto 10.2)

- Registrazione non conformità
- Ciclo: Reagire → Valutare → Attuare → Riesaminare → Aggiornare
- Analisi cause e azioni correttive
- Verifica efficacia

### 3. Export Multiplo

- **JSON**: Backup completo e interoperabilità
- **Word (DOCX)**: Documenti formattati ISO-compliant
- **PDF**: Distribuzione ufficiale

### 4. Sincronizzazione Dati

- Backup automatico su localStorage
- Salvataggio master su file system
- Import/export dati completo

## Requisiti

- Node.js 16+
- Browser moderno (Chrome 86+, Edge 86+, Firefox, Safari)

## Installazione

```powershell
cd app
npm install
```

## Avvio Sviluppo

```powershell
npm run dev
```

L'applicazione sarà disponibile su `http://localhost:3000`

## Build Produzione

```powershell
npm run build
```

## Struttura Progetto

```
app/
├── src/
│   ├── components/       # Componenti React
│   │   ├── Dashboard.jsx        # Dashboard principale
│   │   ├── AuditForm.jsx        # Form gestione audit
│   │   ├── NonConformitaForm.jsx # Form non conformità
│   │   ├── ExportPanel.jsx      # Pannello esportazioni
│   │   └── DataSync.jsx         # Sincronizzazione dati
│   ├── contexts/         # Context API
│   │   └── DataContext.jsx      # Stato centralizzato
│   ├── utils/            # Utilità
│   │   ├── exportHelper.js      # Export JSON/Word/PDF
│   │   └── fileSystemService.js # Gestione file system
│   ├── App.jsx           # Componente root
│   └── main.jsx          # Entry point
├── Export/               # Cartella dati master
└── package.json
```

## Tecnologie

- **React 18** - Framework UI
- **Vite** - Build tool e dev server
- **docx** - Generazione documenti Word
- **jsPDF** - Generazione PDF
- **File System Access API** - Accesso file system nativo

## Conformità ISO 9001:2015

L'applicazione supporta i seguenti punti della norma:

- **4.4** - Sistema dei processi
- **6.1** - Rischi e opportunità
- **7.5** - Informazioni documentate
- **9.2** - Audit interno
- **10.2** - Non conformità e azioni correttive

## Terminologia ISO

Il sistema utilizza la terminologia ufficiale della norma:

- **Informazioni documentate** (non "documenti" o "registrazioni")
- **Fornitore esterno** (non "fornitore")
- **Prodotti e servizi** (non "prodotti")
- **Azioni per affrontare rischi e opportunità** (non "azioni preventive")

## Note Browser

Per supporto completo della File System Access API, usare:

- Chrome/Edge 86+
- Browser non supportati: fallback su cartella Download

## Licenza

© 2025 - Sistema Gestione ISO 9001 - Tutti i diritti riservati

## Supporto

Per domande o supporto sulla norma UNI EN ISO 9001:2015, consultare:

- Normativa completa in `../Normative/`
- Guide operative in `../Quaderni/`
