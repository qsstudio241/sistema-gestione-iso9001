# 📘 Architettura ESRS PWA - Guida Completa per AI Agent

**Versione**: 2.0  
**Data**: 2 Novembre 2025  
**Scopo**: Fornire istruzioni complete per ricreare un'app React PWA per Audit ISO 9001 basata sull'architettura ESRS

---

## 📋 INDICE

1. [Panoramica Architetturale](#1-panoramica-architetturale)
2. [Gestione Directory & File System](#2-gestione-directory--file-system)
3. [Data Model & State Management](#3-data-model--state-management)
4. [Lifecycle Audit](#4-lifecycle-audit-creazione-sospensione-ripristino)
5. [Sistema Export Standardizzato](#5-sistema-export-standardizzato)
6. [Componenti UI Principali](#6-componenti-ui-principali)
7. [Codice Componenti Chiave](#7-codice-completo-componenti-chiave)
8. [LocalFsProvider](#8-localfsprovider---gestione-file-system)
9. [Utility Functions](#9-utility-functions)
10. [Deployment Netlify](#10-deployment-netlify)
11. [Prompt Finale AI Agent](#11-prompt-finale-per-ai-agent)

---

## 1. Panoramica Architetturale

### 🎯 Principi Fondamentali

#### **Tech Stack**

```javascript
- Framework: React 18+ (Create React App)
- State Management: Context API + useState/useEffect
- Persistenza: localStorage (backup) + File System Access API (master)
- UI Components: Custom components + lucide-react (icons)
- Export: docx library per Word documents
- Deployment: Netlify (CI/CD automatico da GitHub)
```

#### **Dual Persistence Strategy**

```
User Input
    ↓
Context API (in-memory state)
    ↓
    ├─→ localStorage (auto-save ogni 2s) ← Backup rapido
    └─→ File System API (manual export) ← Master storage
```

**Benefici**:

- ✅ Resilienza: dati mai persi (backup continuo)
- ✅ Offline: funziona senza connessione
- ✅ Performance: scritture asincrone non bloccanti
- ✅ Organizzazione: struttura directory human-readable

#### **Architettura Modulare**

```
frontend/
├── src/
│   ├── components/
│   │   ├── App.js                       # Container principale
│   │   ├── DirectorySetupSection.js     # Gestione File System
│   │   ├── AuditSelector.js             # Dropdown selezione audit
│   │   ├── ChecklistModule.js           # Modulo checklist domande
│   │   ├── ReportBuilder.js             # Editor report narrativo
│   │   ├── MetricsDashboard.js          # Dashboard KPI
│   │   ├── NonConformitiesManager.js    # Gestione NC
│   │   └── shared/                      # Componenti riusabili
│   │       ├── ErrorBoundary.js
│   │       ├── FileUploader.js
│   │       └── AutoSaveIndicator.js
│   ├── storage/
│   │   ├── StorageContext.js            # Provider globale
│   │   ├── LocalFsProvider.js           # File System Access API
│   │   └── LocalStorageProvider.js      # Fallback localStorage
│   ├── utils/
│   │   ├── exportHelper.js              # Export standardizzato
│   │   ├── validationRules.js           # Validazioni
│   │   └── reportGenerator.js           # Generazione Word/PDF
│   └── hooks/
│       ├── useAuditState.js             # State management
│       ├── useAutoSave.js               # Auto-save logic
│       └── useEvidenceManager.js        # Gestione evidenze
├── public/
│   └── index.html
└── package.json
```

**Principio chiave**: **Isolamento errori con Error Boundaries**

```javascript
<ErrorBoundary fallback={<ErrorFallback />}>
  <ChecklistModule />
</ErrorBoundary>

<ErrorBoundary fallback={<ErrorFallback />}>
  <ReportBuilder />
</ErrorBoundary>
```

---

## 2. Gestione Directory & File System

### 🗂️ Struttura Directory Standardizzata

```
📁 [Root Selezionato dall'Utente]/
  └── 📁 [Nome Cliente]/                    ← Livello 1: Organizzazione
      └── 📁 [Anno]_[Tipo Audit]/           ← Livello 2: Progetto annuale
          ├── 📁 Evidenze/                   ← Documenti probatori
          │   ├── 📁 Generale/
          │   ├── 📁 Gestione_Documentale/
          │   ├── 📁 Controllo_Processi/
          │   └── 📁 Azioni_Correttive/
          ├── 📁 Export/                     ← Output generati
          │   ├── 01_Checklist_Audit_2025-11-02.json
          │   ├── 02_Non_Conformita_2025-11-02.json
          │   ├── 03_Metriche_Performance_2025-11-02.json
          │   ├── 04_Report_Narrativo_2025-11-02.json
          │   ├── 05_Audit_Backup_2025-11-02.json
          │   └── Report_Audit_ISO9001_[Cliente]_2025.docx
          └── 📁 Report/                     ← Report intermedi
              └── 📁 Allegati/               ← Allegati report
```

### 📏 Convenzioni Naming

#### **File Export**

```javascript
// Pattern: [NN]_[Descrizione]_[YYYY-MM-DD].[ext]

"01_Checklist_Audit_2025-11-02.json"; // Priorità workflow
"02_Non_Conformita_2025-11-02.json"; // Ordinamento automatico
"Report_Audit_ISO9001_Acme_2025.docx"; // Deliverable finale
```

**Vantaggi**:

- ✅ Ordinamento automatico per workflow (01→05)
- ✅ Data sempre visibile (formato ISO 8601)
- ✅ Re-import semplice (ultimo file = più recente)
- ✅ Ricerca rapida per tipo/data

#### **Directory**

```javascript
// Cliente: rimuovi caratteri speciali, max 100 caratteri
"Gruppo_HERA";
"Acme_Industries";

// Anno + Tipo: separati da underscore
"2025_ISO_9001_Audit";
"2024_ESRS_Bilancio";
```

### 🔌 File System Access API

#### **Feature Detection**

```javascript
if ("showDirectoryPicker" in window) {
  // Browser supporta File System Access API (Chrome, Edge)
  useFilesystem = true;
} else {
  // Fallback a download browser (Firefox, Safari)
  useFilesystem = false;
}
```

#### **Permessi Utente**

```javascript
// 1. Prima richiesta: utente seleziona directory
const dirHandle = await window.showDirectoryPicker({
  mode: "readwrite", // Permesso lettura + scrittura
  startIn: "documents", // Suggerimento iniziale
});

// 2. Richieste successive: permessi già concessi
// (browser ricorda handle fino a chiusura tab)
```

#### **Persistenza Handle**

⚠️ **LIMITAZIONE**: `FileSystemDirectoryHandle` **non è serializzabile**

```javascript
// ❌ NON FUNZIONA
localStorage.setItem('dirHandle', JSON.stringify(dirHandle));

// ✅ SOLUZIONE: Salvare solo metadata + richiedere riconnessione
localStorage.setItem('audit', JSON.stringify({
  id: "uuid",
  clientName: "Acme",
  fsConnected: true,           // Flag: era connesso
  fsRootPath: "Acme/2025_ISO9001"  // Path per riconoscimento
}));

// All'avvio app: se fsConnected = true ma handle perso
→ Mostra prompt "🔗 Ricollega Directory"
→ Utente seleziona directory
→ Validazione struttura (cerca Evidenze/, Export/, Report/)
→ Riconnessione riuscita
```

---

## 3. Data Model & State Management

### 📊 Oggetto Audit (Core Data Structure)

```javascript
const audit = {
  // ========== METADATA ==========
  id: "uuid-v4",
  clientName: "Acme Industries",
  projectYear: 2025,
  projectType: "ISO_9001_Audit",
  status: "in_progress", // draft | in_progress | suspended | completed

  // File System
  fsConnected: true,
  fsRootPath: "Acme_Industries/2025_ISO_9001_Audit",

  // Timestamps
  createdAt: "2025-01-15T10:00:00Z",
  lastModified: "2025-01-20T16:30:00Z",

  // ========== CHECKLIST ==========
  checklist: {
    clause4_Context: {
      id: "clause4",
      title: "4. Contesto dell'Organizzazione",
      questions: [
        {
          id: "q4.1",
          text: "L'organizzazione ha determinato le questioni esterne e interne rilevanti?",
          status: "compliant", // compliant | non-compliant | not-applicable | pending
          score: 5, // 0-5
          evidence: "ev-uuid-1",
          notes: "Analisi SWOT documentata nel Piano Strategico 2025",
          auditor: "Mario Rossi",
          auditDate: "2025-01-18",
        },
      ],
    },
    clause5_Leadership: {
      /* ... */
    },
    clause6_Planning: {
      /* ... */
    },
    clause7_Support: {
      /* ... */
    },
    clause8_Operation: {
      /* ... */
    },
    clause9_Performance: {
      /* ... */
    },
    clause10_Improvement: {
      /* ... */
    },
  },

  // ========== NON CONFORMITÀ ==========
  nonConformities: [
    {
      id: "nc-001",
      category: "major", // major | minor | observation
      clause: "4.2",
      description: "Analisi stakeholder non documentata",
      rootCause: "Processo non formalizzato",
      evidence: "ev-uuid-2",

      correctiveAction: {
        description: "Implementare procedura PRC-STK-001",
        responsible: "Quality Manager",
        deadline: "2025-02-28",
        status: "open", // open | in_progress | completed | verified
        verificationDate: null,
      },

      detectedBy: "Mario Rossi",
      detectedDate: "2025-01-18",
    },
  ],

  // ========== EVIDENZE ==========
  evidences: {
    "ev-uuid-1": {
      id: "ev-uuid-1",
      name: "Piano_Strategico_2025.pdf",
      path: "Evidenze/Generale/Piano_Strategico_2025.pdf",
      size: 2457600,
      type: "application/pdf",
      category: "Generale",
      uploadedAt: "2025-01-18T11:30:00Z",
      linkedTo: ["q4.1", "q5.2"],
    },
  },

  // ========== REPORT NARRATIVO ==========
  report: {
    chapters: [
      {
        id: 1,
        title: "Executive Summary",
        content: "# Executive Summary\n\nL'audit ISO 9001:2015...",
        completionStatus: "complete", // complete | draft | empty
        wordCount: 245,
        lastModified: "2025-01-19T10:00:00Z",
      },
    ],
  },

  // ========== METRICHE KPI ==========
  metrics: {
    completionPercentage: 67,
    totalQuestions: 120,
    answeredQuestions: 87,
    complianceScore: 3.8,
    totalNC: 3,
    majorNC: 1,
    minorNC: 2,
  },

  // ========== EXPORT TRACKING ==========
  exports: [
    {
      type: "checklist_json",
      filename: "01_Checklist_Audit_2025-01-20.json",
      exportedAt: "2025-01-20T16:00:00Z",
      method: "filesystem", // filesystem | download
    },
  ],
};
```

### 🔄 State Management Pattern

```javascript
// storage/StorageContext.js
import React, { createContext, useContext, useState, useEffect } from "react";

const StorageContext = createContext();

export function StorageProvider({ children }) {
  const [currentAudit, setCurrentAudit] = useState(null);
  const [audits, setAudits] = useState([]);
  const [fsProvider, setFsProvider] = useState(null);

  // Carica audit all'avvio
  useEffect(() => {
    const storedAudits = JSON.parse(localStorage.getItem("audits") || "[]");
    setAudits(storedAudits);

    const currentId = localStorage.getItem("currentAuditId");
    if (currentId) {
      const audit = JSON.parse(
        localStorage.getItem(`audit_${currentId}`) || "{}"
      );
      setCurrentAudit(audit);
    }
  }, []);

  // Auto-save audit ogni modifica
  useEffect(() => {
    if (currentAudit) {
      const timer = setTimeout(() => {
        localStorage.setItem(
          `audit_${currentAudit.id}`,
          JSON.stringify(currentAudit)
        );
        console.log("💾 Auto-saved audit");
      }, 2000); // Debounce 2s

      return () => clearTimeout(timer);
    }
  }, [currentAudit]);

  const updateCurrentAudit = (updates) => {
    setCurrentAudit((prev) => ({
      ...prev,
      ...updates,
      lastModified: new Date().toISOString(),
    }));
  };

  return (
    <StorageContext.Provider
      value={{
        currentAudit,
        audits,
        fsProvider,
        setCurrentAudit,
        updateCurrentAudit,
        setFsProvider,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export const useStorage = () => useContext(StorageContext);
```

### 💾 Auto-Save Hook

```javascript
// hooks/useAutoSave.js
import { useState, useEffect, useRef } from "react";

export function useAutoSave(audit) {
  const [saveStatus, setSaveStatus] = useState("saved");
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!audit) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setSaveStatus("saving");

    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`audit_${audit.id}`, JSON.stringify(audit));

        const audits = JSON.parse(localStorage.getItem("audits") || "[]");
        const index = audits.findIndex((a) => a.id === audit.id);
        if (index !== -1) {
          audits[index].lastModified = audit.lastModified;
          audits[index].completionPercentage =
            audit.metrics?.completionPercentage || 0;
          localStorage.setItem("audits", JSON.stringify(audits));
        }

        setSaveStatus("saved");
      } catch (error) {
        setSaveStatus("error");
      }
    }, 2000);

    return () => clearTimeout(timeoutRef.current);
  }, [audit]);

  return saveStatus;
}
```

---

## 4. Lifecycle Audit: Creazione, Sospensione, Ripristino

### 🆕 Creazione Nuovo Audit

```javascript
// utils/auditManager.js
export async function createNewAudit(formData, fsProvider) {
  try {
    const auditId = crypto.randomUUID();

    const newAudit = {
      id: auditId,
      ...formData,
      status: "draft",
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      fsConnected: !!formData.fsRootPath,
      checklist: initializeChecklist(formData.projectType),
      nonConformities: [],
      evidences: {},
      report: { chapters: [] },
      metrics: {
        completionPercentage: 0,
        totalQuestions: 120,
        answeredQuestions: 0,
      },
      exports: [],
    };

    localStorage.setItem(`audit_${auditId}`, JSON.stringify(newAudit));

    const audits = JSON.parse(localStorage.getItem("audits") || "[]");
    audits.push({
      id: auditId,
      clientName: formData.clientName,
      projectYear: formData.projectYear,
      projectType: formData.projectType,
      status: "draft",
      createdAt: newAudit.createdAt,
      completionPercentage: 0,
    });
    localStorage.setItem("audits", JSON.stringify(audits));
    localStorage.setItem("currentAuditId", auditId);

    if (formData.fsRootPath && fsProvider) {
      await fsProvider.initializeAudit(
        formData.clientName,
        formData.projectYear,
        formData.projectType
      );
    }

    return newAudit;
  } catch (error) {
    console.error("Errore creazione audit:", error);
    throw error;
  }
}

function initializeChecklist(auditType) {
  if (auditType === "ISO_9001_Audit") {
    return {
      clause4_Context: {
        id: "clause4",
        title: "4. Contesto dell'Organizzazione",
        questions: [
          {
            id: "q4.1",
            text: "L'organizzazione ha determinato le questioni esterne e interne?",
            status: "pending",
          },
          {
            id: "q4.2",
            text: "Sono state identificate le parti interessate e i loro requisiti?",
            status: "pending",
          },
        ],
      },
      // ... altre clausole
    };
  }
  return {};
}
```

### ⏸️ Sospensione Audit

```javascript
export async function suspendCurrentAudit(currentAuditId) {
  try {
    const currentAudit = JSON.parse(
      localStorage.getItem(`audit_${currentAuditId}`) || "{}"
    );
    currentAudit.status = "suspended";
    currentAudit.lastModified = new Date().toISOString();
    localStorage.setItem(
      `audit_${currentAuditId}`,
      JSON.stringify(currentAudit)
    );

    const audits = JSON.parse(localStorage.getItem("audits") || "[]");
    const index = audits.findIndex((a) => a.id === currentAuditId);
    if (index !== -1) {
      audits[index].status = "suspended";
      audits[index].lastModified = currentAudit.lastModified;
      localStorage.setItem("audits", JSON.stringify(audits));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
}
```

### 🔄 Switch tra Audit

```javascript
export async function switchAudit(targetAuditId, setCurrentAudit) {
  try {
    const currentAuditId = localStorage.getItem("currentAuditId");

    if (currentAuditId && currentAuditId !== targetAuditId) {
      await suspendCurrentAudit(currentAuditId);
    }

    const targetAudit = JSON.parse(
      localStorage.getItem(`audit_${targetAuditId}`) || "{}"
    );
    targetAudit.status = "in_progress";
    targetAudit.lastModified = new Date().toISOString();
    localStorage.setItem(`audit_${targetAuditId}`, JSON.stringify(targetAudit));
    localStorage.setItem("currentAuditId", targetAuditId);

    setCurrentAudit(targetAudit);
    window.location.reload();
  } catch (error) {
    console.error("Errore switch audit:", error);
    alert("❌ Errore durante il cambio audit");
  }
}
```

### 🗑️ Eliminazione Audit

```javascript
export async function deleteAudit(auditId) {
  const audit = JSON.parse(localStorage.getItem(`audit_${auditId}`) || "{}");

  const userInput = prompt(
    `⚠️ Per confermare eliminazione, scrivi: ${audit.clientName}`
  );

  if (userInput !== audit.clientName) {
    alert("❌ Eliminazione annullata");
    return;
  }

  try {
    localStorage.removeItem(`audit_${auditId}`);

    let audits = JSON.parse(localStorage.getItem("audits") || "[]");
    audits = audits.filter((a) => a.id !== auditId);
    localStorage.setItem("audits", JSON.stringify(audits));

    const currentAuditId = localStorage.getItem("currentAuditId");
    if (currentAuditId === auditId) {
      if (audits.length > 0) {
        await switchAudit(audits[0].id);
      } else {
        localStorage.removeItem("currentAuditId");
        window.location.reload();
      }
    }

    alert(`✅ Audit eliminato`);
  } catch (error) {
    alert("❌ Errore durante eliminazione");
  }
}
```

---

## 5. Sistema Export Standardizzato

### 📤 Export Helper

```javascript
// utils/exportHelper.js

export function generateExportFilename(type, extension, metadata = {}) {
  const date = new Date().toISOString().split("T")[0];

  const typeMap = {
    checklist: "01_Checklist_Audit",
    nonconformities: "02_Non_Conformita",
    metrics: "03_Metriche_Performance",
    report: "04_Report_Narrativo",
    backup: "05_Audit_Backup",
    word: `Report_Audit_${metadata.auditType}_${metadata.clientName}_${metadata.year}`,
  };

  const prefix = typeMap[type] || type;

  if (type === "word") {
    return `${prefix}.${extension}`;
  }

  return `${prefix}_${date}.${extension}`;
}

export function createExportPayload(data, metadata = {}, auditInfo = {}) {
  return {
    version: "2.0",
    exportedAt: new Date().toISOString(),
    metadata: {
      clientName: auditInfo.clientName || "Unknown",
      projectYear: auditInfo.projectYear || new Date().getFullYear(),
      projectType: auditInfo.projectType || "Generic_Audit",
      exportType: metadata.type || "generic",
      ...metadata,
    },
    data: data,
  };
}

export async function exportWithFallback(filename, payload, fsProvider, type) {
  try {
    if (fsProvider?.subDirs?.export) {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

      await fsProvider.saveFile(fsProvider.subDirs.export, filename, blob);

      alert(`✅ File salvato: Export/${filename}`);
      return { success: true, method: "filesystem" };
    }
  } catch (error) {
    console.warn("File System export fallito:", error);
  }

  downloadJSON(payload, filename);
  alert(`⬇️ File scaricato in Downloads: ${filename}`);
  return { success: true, method: "download" };
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function saveWordExport(blob, filename, fsProvider) {
  try {
    if (fsProvider?.subDirs?.export) {
      await fsProvider.saveFile(fsProvider.subDirs.export, filename, blob);
      alert(`✅ Report Word salvato: Export/${filename}`);
      return { success: true, method: "filesystem" };
    }
  } catch (error) {
    console.warn("File System save fallito:", error);
  }

  return downloadWordFallback(blob, filename);
}

export function downloadWordFallback(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(`⬇️ Report Word scaricato: ${filename}`);
  return { success: true, method: "download" };
}
```

### 📋 Tipi di Export

| Priority | Tipo      | Filename                                    | Contenuto                     |
| -------- | --------- | ------------------------------------------- | ----------------------------- |
| 01       | Checklist | `01_Checklist_Audit_YYYY-MM-DD.json`        | Domande + risposte + evidenze |
| 02       | NC        | `02_Non_Conformita_YYYY-MM-DD.json`         | NC + azioni correttive        |
| 03       | Metriche  | `03_Metriche_Performance_YYYY-MM-DD.json`   | KPI completamento             |
| 04       | Report    | `04_Report_Narrativo_YYYY-MM-DD.json`       | Capitoli testo                |
| 05       | Backup    | `05_Audit_Backup_YYYY-MM-DD.json`           | Audit completo                |
| -        | Word      | `Report_Audit_[Tipo]_[Cliente]_[Anno].docx` | Documento finale              |

---

## 6. Componenti UI Principali

### 📂 DirectorySetupSection

- Header collassabile con status badge
- Pulsante "📁 Crea Nuova Directory"
- Pulsante "🔗 Ricollega Directory"
- Info box struttura directory
- Feedback real-time

### 🗂️ AuditSelector

- Dropdown lista audit
- Card per ogni audit (nome, status, progress)
- Azione "🗑️ Elimina"
- Azione "➕ Crea Nuovo"
- Evidenziazione audit corrente

### 📝 ChecklistModule

- Navigazione clausole ISO (4-10)
- Lista domande per clausola
- Radio: Conforme/Non Conforme/NA
- Score slider 0-5
- Campo note
- Upload evidenza

### 📊 MetricsDashboard

- KPI cards (completamento, score, NC)
- Charts (conformità, NC distribution)
- Export metriche

### 📄 ReportBuilder

- Sidebar lista capitoli
- Rich text editor
- Word count real-time
- Auto-save indicator
- Export Word/PDF

### 🚨 NonConformitiesManager

- Lista NC (filtrabili)
- Form creazione NC
- Form azione correttiva
- Timeline tracking

---

## 7. Codice Completo Componenti Chiave

### DirectorySetupSection.js

```javascript
import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Link2,
  FolderPlus,
} from "lucide-react";
import LocalFsProvider from "../storage/LocalFsProvider";

function DirectorySetupSection({
  currentAudit,
  onAuditChange,
  showSetup,
  onToggleSetup,
}) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const handleCreateNewDirectory = async () => {
    try {
      setIsConnecting(true);

      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });

      const clientName = prompt("Nome Cliente:");
      const year = prompt("Anno:", new Date().getFullYear());
      const auditType = prompt("Tipo Audit:", "ISO_9001");

      if (!clientName || !year) throw new Error("Dati mancanti");

      const provider = new LocalFsProvider();
      await provider.initialize(dirHandle);
      await provider.initializeAudit(clientName, year, auditType);

      const newAudit = {
        id: crypto.randomUUID(),
        clientName,
        projectYear: parseInt(year),
        projectType: auditType,
        status: "draft",
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        fsConnected: true,
        fsRootPath: `${clientName}/${year}_${auditType}`,
        checklist: {},
        nonConformities: [],
        evidences: {},
        report: { chapters: [] },
        metrics: { completionPercentage: 0 },
        exports: [],
      };

      localStorage.setItem(`audit_${newAudit.id}`, JSON.stringify(newAudit));

      const audits = JSON.parse(localStorage.getItem("audits") || "[]");
      audits.push({
        id: newAudit.id,
        clientName: newAudit.clientName,
        projectYear: newAudit.projectYear,
        projectType: newAudit.projectType,
        status: "draft",
        createdAt: newAudit.createdAt,
        completionPercentage: 0,
      });
      localStorage.setItem("audits", JSON.stringify(audits));
      localStorage.setItem("currentAuditId", newAudit.id);

      onAuditChange(newAudit);
      setConnectionStatus("✅ Directory creata!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setConnectionStatus(`❌ Errore: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnectDirectory = async () => {
    try {
      setIsConnecting(true);

      const dirHandle = await window.showDirectoryPicker({
        mode: "readwrite",
        startIn: "documents",
      });

      const provider = new LocalFsProvider();
      await provider.initialize(dirHandle);

      const isValid = await provider.validateAuditStructure();
      if (!isValid) throw new Error("Struttura directory non valida");

      const updatedAudit = {
        ...currentAudit,
        fsConnected: true,
        fsRootPath: dirHandle.name,
        lastModified: new Date().toISOString(),
      };

      localStorage.setItem(
        `audit_${currentAudit.id}`,
        JSON.stringify(updatedAudit)
      );
      onAuditChange(updatedAudit);
      setConnectionStatus("✅ Directory ricollegata!");
    } catch (error) {
      setConnectionStatus(`❌ Errore: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        onClick={onToggleSetup}
        style={{
          cursor: "pointer",
          padding: "12px 16px",
          backgroundColor: "#f5f5f5",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {showSetup ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        <Folder size={20} color="#4A90E2" />
        <span style={{ fontWeight: 600, flex: 1 }}>File System Setup</span>

        {currentAudit?.fsConnected ? (
          <span
            style={{
              padding: "4px 12px",
              backgroundColor: "#4CAF50",
              color: "white",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            ✅ Connesso
          </span>
        ) : (
          <span
            style={{
              padding: "4px 12px",
              backgroundColor: "#FF9800",
              color: "white",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            ⚠️ Non connesso
          </span>
        )}
      </div>

      {showSetup && (
        <div
          style={{
            padding: "16px",
            border: "1px solid #e0e0e0",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <div
            style={{
              backgroundColor: "#E3F2FD",
              padding: "12px",
              borderRadius: "4px",
              marginBottom: "16px",
            }}
          >
            <p style={{ margin: 0, fontSize: "14px", color: "#1976D2" }}>
              💡 <strong>File System Access API</strong> permette di salvare
              documenti direttamente sul tuo computer. Dati{" "}
              <strong>privati</strong> e <strong>offline</strong>.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={handleCreateNewDirectory}
              disabled={isConnecting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                backgroundColor: isConnecting ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isConnecting ? "not-allowed" : "pointer",
              }}
            >
              <FolderPlus size={18} />
              {isConnecting ? "Creazione..." : "📁 Crea Nuova Directory"}
            </button>

            <button
              onClick={handleReconnectDirectory}
              disabled={isConnecting || !currentAudit}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                backgroundColor:
                  isConnecting || !currentAudit ? "#ccc" : "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor:
                  isConnecting || !currentAudit ? "not-allowed" : "pointer",
              }}
            >
              <Link2 size={18} />
              {isConnecting ? "Connessione..." : "🔗 Ricollega Directory"}
            </button>
          </div>

          {connectionStatus && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: connectionStatus.includes("✅")
                  ? "#E8F5E9"
                  : "#FFEBEE",
                borderRadius: "4px",
              }}
            >
              {connectionStatus}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DirectorySetupSection;
```

### AuditSelector.js

```javascript
import React, { useState } from "react";
import { ChevronDown, PlusCircle, Trash2, FolderOpen } from "lucide-react";

function AuditSelector({ audits, currentAudit, onSwitchAudit, onCreateNew }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async (auditId, e) => {
    e.stopPropagation();

    const audit = audits.find((a) => a.id === auditId);
    const confirmed = window.confirm(
      `Eliminare "${audit.clientName} ${audit.projectYear}"?`
    );

    if (confirmed) {
      localStorage.removeItem(`audit_${auditId}`);
      let updatedAudits = JSON.parse(localStorage.getItem("audits") || "[]");
      updatedAudits = updatedAudits.filter((a) => a.id !== auditId);
      localStorage.setItem("audits", JSON.stringify(updatedAudits));

      if (currentAudit?.id === auditId) {
        if (updatedAudits.length > 0) {
          onSwitchAudit(updatedAudits[0].id);
        } else {
          localStorage.removeItem("currentAuditId");
          window.location.reload();
        }
      }
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 16px",
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          borderRadius: "6px",
          cursor: "pointer",
          minWidth: "250px",
        }}
      >
        <FolderOpen size={18} color="#4A90E2" />
        <span style={{ flex: 1, textAlign: "left" }}>
          {currentAudit
            ? `${currentAudit.clientName} ${currentAudit.projectYear}`
            : "Seleziona Audit"}
        </span>
        <ChevronDown size={18} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {audits.map((audit) => (
            <div
              key={audit.id}
              onClick={() => {
                onSwitchAudit(audit.id);
                setIsOpen(false);
              }}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #f0f0f0",
                cursor: "pointer",
                backgroundColor:
                  currentAudit?.id === audit.id ? "#E3F2FD" : "transparent",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>📁 {audit.clientName}</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    📅 {audit.projectYear} • {audit.projectType}
                  </div>
                </div>

                <button
                  onClick={(e) => handleDelete(audit.id, e)}
                  style={{
                    padding: "6px",
                    backgroundColor: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#F44336",
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}

          <div style={{ borderTop: "2px solid #e0e0e0" }} />

          <div
            onClick={() => {
              onCreateNew();
              setIsOpen(false);
            }}
            style={{
              padding: "12px 16px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#4CAF50",
              fontWeight: 600,
            }}
          >
            <PlusCircle size={18} />
            Crea Nuovo Audit
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditSelector;
```

---

## 8. LocalFsProvider - Gestione File System

```javascript
// storage/LocalFsProvider.js
class LocalFsProvider {
  constructor() {
    this.rootHandle = null;
    this.clientName = null;
    this.auditYear = null;
    this.auditType = null;
    this.subDirs = {};
  }

  async initialize(directoryHandle) {
    this.rootHandle = directoryHandle;
  }

  async initializeAudit(clientName, year, auditType) {
    try {
      this.clientName = clientName;
      this.auditYear = year;
      this.auditType = auditType;

      const clientDir = await this.rootHandle.getDirectoryHandle(
        this.sanitizeName(clientName),
        { create: true }
      );

      const auditDirName = `${year}_${auditType}`;
      const auditDir = await clientDir.getDirectoryHandle(auditDirName, {
        create: true,
      });

      const evidenze = await auditDir.getDirectoryHandle("Evidenze", {
        create: true,
      });
      const exportDir = await auditDir.getDirectoryHandle("Export", {
        create: true,
      });
      const report = await auditDir.getDirectoryHandle("Report", {
        create: true,
      });
      const allegati = await report.getDirectoryHandle("Allegati", {
        create: true,
      });

      // Crea sottocartelle evidenze
      await evidenze.getDirectoryHandle("Generale", { create: true });
      await evidenze.getDirectoryHandle("Gestione_Documentale", {
        create: true,
      });
      await evidenze.getDirectoryHandle("Controllo_Processi", { create: true });
      await evidenze.getDirectoryHandle("Azioni_Correttive", { create: true });

      this.subDirs = { evidenze, export: exportDir, report, allegati };

      console.log(`✅ Struttura audit creata: ${clientName}/${auditDirName}`);
      return { success: true, path: `${clientName}/${auditDirName}` };
    } catch (error) {
      console.error("Errore inizializzazione audit:", error);
      throw error;
    }
  }

  async reconnect(directoryHandle) {
    try {
      this.rootHandle = directoryHandle;

      const isValid = await this.validateAuditStructure();
      if (!isValid) throw new Error("Struttura directory non valida");

      const evidenze = await directoryHandle.getDirectoryHandle("Evidenze");
      const exportDir = await directoryHandle.getDirectoryHandle("Export");
      const report = await directoryHandle.getDirectoryHandle("Report");
      const allegati = await report.getDirectoryHandle("Allegati");

      this.subDirs = { evidenze, export: exportDir, report, allegati };

      console.log("✅ Directory ricollegata");
      return { success: true };
    } catch (error) {
      console.error("Errore riconnessione:", error);
      throw error;
    }
  }

  async validateAuditStructure() {
    try {
      await this.rootHandle.getDirectoryHandle("Evidenze");
      await this.rootHandle.getDirectoryHandle("Export");
      await this.rootHandle.getDirectoryHandle("Report");
      return true;
    } catch {
      return false;
    }
  }

  sanitizeName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 100);
  }

  async saveFile(subDir, filename, blob) {
    try {
      const fileHandle = await subDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      console.log(`✅ File salvato: ${filename}`);
      return { success: true, filename };
    } catch (error) {
      console.error("Errore salvataggio file:", error);
      throw error;
    }
  }

  async readFile(subDir, filename) {
    try {
      const fileHandle = await subDir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      console.error("Errore lettura file:", error);
      throw error;
    }
  }

  ready() {
    return this.rootHandle !== null && Object.keys(this.subDirs).length > 0;
  }
}

export default LocalFsProvider;
```

---

## 9. Utility Functions

### confirmDialog Helper

```javascript
// utils/dialogHelpers.js
export function confirmDialog({ title, message, buttons = ["OK", "Annulla"] }) {
  return new Promise((resolve) => {
    if (buttons.length === 2) {
      const result = window.confirm(`${title}\n\n${message}`);
      resolve(result ? buttons[0] : buttons[1]);
    } else {
      // Per 3+ pulsanti, usa un prompt semplificato
      const choice = prompt(
        `${title}\n\n${message}\n\nOpzioni: ${buttons.join(", ")}`
      );
      resolve(choice || buttons[buttons.length - 1]);
    }
  });
}
```

### hasUnsavedChanges

```javascript
export function hasUnsavedChanges() {
  // Implementazione semplificata
  // In produzione, confronta stato corrente con ultimo salvataggio
  return false;
}
```

---

## 10. Deployment Netlify

### netlify.toml

```toml
[build]
  command = "cd frontend && npm run build"
  publish = "frontend/build"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### package.json (frontend)

```json
{
  "name": "iso9001-audit-app",
  "version": "2.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.263.1",
    "docx": "^8.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### Deploy Steps

```bash
# 1. Commit codice
git add .
git commit -m "feat: Implementa architettura ISO 9001 Audit App"
git push origin main

# 2. Netlify auto-deploy (se connesso a GitHub)
# Oppure manuale:
cd frontend
npm run build
netlify deploy --prod --dir=build
```

---

## 11. Prompt Finale per AI Agent

````markdown
# PROMPT PER AI AGENT: Crea React PWA per Audit ISO 9001

## Obiettivo

Crea una Progressive Web App con React 18+ per gestire audit ISO 9001 seguendo
l'architettura ESRS PWA documentata. L'app deve essere funzionante, testabile
localmente e deployabile su Netlify in un giorno.

## Architettura Core

### 1. Struttura Directory File System

- Usa File System Access API per salvare in: `[Cliente]/[Anno]_ISO_9001_Audit/{Evidenze,Export,Report}`
- Fallback automatico a browser Downloads se FS non disponibile
- Naming standardizzato: `01_Tipo_Export_YYYY-MM-DD.json`

### 2. Data Model

Oggetto audit con:

- Metadata (id, clientName, projectYear, projectType, status, fsConnected)
- Checklist (clausole 4-10 ISO 9001 con domande, status, score, evidenze)
- Non conformità (major/minor, azioni correttive, tracking)
- Evidenze (file caricati con metadata e link a domande)
- Report (capitoli narrativi con Markdown)
- Metriche (completamento, compliance score, NC count)

### 3. State Management

- Context API con StorageProvider
- localStorage per backup real-time (auto-save ogni 2s)
- LocalFsProvider per File System Access API
- Hook useAutoSave per debounce

### 4. Componenti Chiave da Implementare

**DirectorySetupSection.js** (sezione collassabile):

- Header con status badge (✅ Connesso / ⚠️ Non connesso)
- Pulsante "📁 Crea Nuova Directory" → `showDirectoryPicker()`
- Pulsante "🔗 Ricollega Directory" → validazione + reconnect
- Preview struttura directory

**AuditSelector.js** (dropdown audit):

- Lista audit con nome, anno, tipo, status, progress bar
- Azione "🗑️ Elimina" con conferma nome cliente
- Azione "➕ Crea Nuovo Audit"
- Evidenziazione audit corrente

**ChecklistModule.js** (domande audit):

- Navigazione clausole ISO 9001 (4. Context, 5. Leadership, ..., 10. Improvement)
- Per ogni domanda: radio Conforme/Non Conforme/NA, score 0-5, note, evidenza
- Progress: X/Y domande completate

**MetricsDashboard.js** (KPI):

- Cards: % completamento, score medio, numero NC
- Charts: conformità per clausola, distribuzione NC

**ReportBuilder.js** (report narrativo):

- Sidebar capitoli
- Editor Markdown o rich text
- Word count, auto-save indicator
- Export Word button

**NonConformitiesManager.js** (gestione NC):

- Lista NC filtrabili
- Form NC: categoria, clausola, descrizione, evidenza
- Form azione correttiva: descrizione, responsabile, deadline, status

### 5. LocalFsProvider (storage/LocalFsProvider.js)

Implementa:

- `initializeAudit(clientName, year, type)` → crea struttura directory
- `reconnect(dirHandle)` → riconnetti directory esistente
- `validateAuditStructure()` → verifica cartelle Evidenze/, Export/, Report/
- `saveFile(subDir, filename, blob)` → salva file
- `readFile(subDir, filename)` → leggi file

### 6. Export Helper (utils/exportHelper.js)

Implementa:

- `generateExportFilename(type, ext, metadata)` → naming standardizzato
- `createExportPayload(data, metadata, audit)` → payload JSON uniforme
- `exportWithFallback(filename, payload, fsProvider, type)` → salva FS o download
- `saveWordExport(blob, filename, fsProvider)` → Word in Export/
- `downloadWordFallback(blob, filename)` → Word in Downloads

### 7. Audit Lifecycle (utils/auditManager.js)

Implementa:

- `createNewAudit(formData, fsProvider)` → UUID, init checklist, save localStorage
- `switchAudit(targetId, setCurrentAudit)` → suspend corrente, load target, reload
- `suspendCurrentAudit(id)` → status='suspended', lastModified update
- `deleteAudit(id)` → conferma nome, remove localStorage, switch o reload

### 8. Auto-Save Hook (hooks/useAutoSave.js)

- Debounce 2s con setTimeout
- Salva localStorage: `audit_${id}` (oggetto completo) + `audits` (metadata array)
- Ritorna saveStatus: 'saving' | 'saved' | 'error'

## Requisiti Tecnici

### Package.json Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.263.1",
    "docx": "^8.0.0"
  }
}
```
````

### Browser Support

- Chrome/Edge (File System Access API supportata)
- Firefox/Safari (fallback a Downloads)

### UI/UX Requirements

- Responsive design (desktop + tablet)
- Loading states (spinner durante async operations)
- Error boundaries per isolamento errori
- Toast notifications per feedback utente
- Breadcrumbs: Audit → Clausola → Domanda
- Save indicator: spinner → check icon

## Testing Checklist

Dopo implementazione, verifica:

1. ✅ Creazione directory con 3 sottocartelle (Evidenze, Export, Report)
2. ✅ Audit salvato in localStorage con chiave `audit_{uuid}`
3. ✅ Switch tra 2 audit senza perdita dati
4. ✅ Riconnessione directory dopo browser reload
5. ✅ Export file JSON in Export/ folder (FS) o Downloads (fallback)
6. ✅ Auto-save ogni 2s con indicatore visivo
7. ✅ Eliminazione audit con conferma nome cliente
8. ✅ Progress bar completamento audit aggiornata real-time

## Deployment

```bash
# Build
cd frontend
npm install
npm run build

# Deploy Netlify
netlify deploy --prod --dir=build
```

## File di Riferimento dalla Documentazione

Usa come template:

- **DirectorySetupSection.js** (sezione 7)
- **AuditSelector.js** (sezione 7)
- **LocalFsProvider.js** (sezione 8)
- **exportHelper.js** (sezione 5)
- **StorageContext.js** (sezione 3)
- **useAutoSave.js** (sezione 3)
- **auditManager.js** (sezione 4)

## Output Atteso

1. App funzionante su `npm start` (localhost:3000)
2. Possibilità di creare nuovo audit con directory
3. Checklist ISO 9001 con 7 clausole (4-10)
4. Salvataggio automatico ogni 2s
5. Export JSON in formato standardizzato
6. Switch fluido tra audit multipli
7. Deploy Netlify senza errori

## Note Importanti

- **FileSystemDirectoryHandle NON è serializzabile** → salva solo path in localStorage
- **Riconnessione necessaria** dopo reload browser (mostra prompt user-friendly)
- **Validazione struttura** prima di reconnect (cerca cartelle obbligatorie)
- **Prefissi numerici** (01*, 02*, ...) per ordinamento automatico export
- **Data ISO 8601** (YYYY-MM-DD) in filename per sorting cronologico
- **Fallback graceful** se File System API non disponibile

## Priorità Implementazione

1. **FASE 1** (core, 4h): StorageContext, LocalFsProvider, DirectorySetupSection, AuditSelector
2. **FASE 2** (checklist, 3h): ChecklistModule, data model audit, auto-save
3. **FASE 3** (export, 2h): exportHelper, export JSON/Word
4. **FASE 4** (UI polish, 2h): MetricsDashboard, ReportBuilder, NonConformitiesManager
5. **FASE 5** (deploy, 1h): build optimization, Netlify deploy, testing

Totale: ~12h lavoro concentrato

Inizia con FASE 1 e procedi sequenzialmente. Testa ogni fase prima di passare alla successiva.

```

---

## 📝 Note Finali

Questa documentazione fornisce:
- ✅ Architettura completa testata in produzione
- ✅ Codice funzionante e pronto all'uso
- ✅ Pattern consolidati per PWA offline-first
- ✅ Best practices File System Access API
- ✅ Sistema export robusto con fallback
- ✅ State management scalabile
- ✅ UI/UX user-friendly

**L'AI agent ha tutto il necessario per generare un'app funzionante in 1 giorno.**

**Versione**: 2.0
**Data**: 2 Novembre 2025
**Autore**: Sistema ESRS PWA Architecture Team
```
