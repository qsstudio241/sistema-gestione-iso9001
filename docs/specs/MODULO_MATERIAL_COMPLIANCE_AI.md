# MODULO_MATERIAL_COMPLIANCE_AI

## Stato

PROPOSTO

## Data

2026-08-05

## Collegamenti

ADR-020 - Material Compliance AI Module

ADR-021 - Material Requirements Hierarchy

ADR-022 - AI Extraction And Rule Engine Separation

ADR-023 - Material Knowledge Base

ADR-024 - Material Certificate Workflow

---

# 1. Scopo

Realizzare un modulo della piattaforma SGQ in grado di:

- acquisire certificati materia prima
- analizzare certificati EN 10204 3.1
- estrarre automaticamente i dati tecnici
- verificare la conformità della fornitura
- fornire supporto alle decisioni dell'ufficio qualità

Il modulo dovrà integrarsi con l'infrastruttura esistente della piattaforma SGQ.

---

# 2. Obiettivi

## Obiettivi principali

Ridurre il tempo di verifica certificati.

Aumentare la tracciabilità.

Ridurre errori manuali.

Capitalizzare il know-how aziendale.

Supportare audit:

- ISO 9001
- ISO 3834
- EN 1090

---

# 3. Ambito

## Incluso

- Certificati EN 10204 3.1
- Laminati
- Tubi
- Profilati
- Piastre
- Lamiere

## Escluso MVP

- Certificati trattamenti termici
- Certificati verniciatura
- PPAP
- Dossier fornitore

Saranno gestiti in future estensioni.

---

# 4. Architettura funzionale

```text
PDF

↓

OCR

↓

Markdown

↓

AI Extraction

↓

JSON

↓

Rule Engine

↓

Workflow Qualità

↓

Archivio
```

---

# 5. Integrazione piattaforma SGQ

## Riuso componenti esistenti

### Ingest Pipeline

Riuso obbligatorio.

### Document Registry

Riuso obbligatorio.

### RBAC

Riuso obbligatorio.

### Company Scope

Riuso obbligatorio.

### AI Provider Adapter

Riuso obbligatorio.

### Audit Trail

Riuso obbligatorio.

---

# 6. Menu Applicazione

Nuova voce sidebar.

```text
Material Compliance
```

Sotto-menu:

```text
Dashboard

Certificati

Verifiche

Norme

Requisiti Cliente

Knowledge Base

Statistiche
```

---

# 7. Dashboard

Mostrare:

## KPI

Certificati ricevuti

Certificati conformi

Certificati non conformi

Verifiche in attesa

Fornitori principali

Materiali più frequenti

---

# 8. Modulo Certificati

Elenco certificati importati.

Campi:

- provider
- data
- materiale
- colata
- norma
- cliente
- esito

Azioni:

- visualizza
- riesamina
- scarica
- archivia

---

# 9. Pagina dettaglio certificato

Tre pannelli.

## Pannello 1

PDF originale.

## Pannello 2

Markdown generato.

## Pannello 3

Valutazione conformità.

---

# 10. Workflow

Stati:

```text
Ricevuto

OCR

Estratto

Da Verificare

Conforme

Non Conforme

Archiviato
```

---

# 11. Human In The Loop

L'AI non approva mai automaticamente.

Operazioni consentite:

- correggi valore
- approva
- respingi
- richiedi riesame

---

# 12. Gerarchia requisiti

Applicare sempre:

```text
EN10204

↓

Norma Materiale

↓

Ordine Acquisto

↓

Requisito Cliente

↓

Requisito Interno
```

Vince sempre il requisito più restrittivo.

---

# 13. Knowledge Base

Percorso:

```text
knowledge/material-compliance/
```

Struttura:

```text
standards/

customers/

tecnove/

dictionary/

lessons/
```

---

# 14. Norme iniziali

## EN10204

Certificati.

## EN10025-2

Acciai strutturali.

## EN10025-4

Acciai TMCP.

## EN10149-2

Acciai altoresistenziali.

## EN10210

Profili cavi laminati.

## EN10219

Profili cavi formati a freddo.

---

# 15. Requisiti Cliente

Gestiti esternamente al codice.

Esempio:

## FASSI

Carbon Equivalent

Resilienza

Composizione chimica

## CLAAS

Requisiti dedicati

## CNH

Requisiti dedicati

---

# 16. Data Dictionary

Definire:

- colata
- materiale
- certificato
- norma
- ReH
- Rm
- A
- KV
- CEV

con relativi sinonimi.

---

# 17. Rule Engine

Funzioni:

- applicazione limiti
- confronto valori
- gestione tolleranze
- spiegazione esito

Output:

```json
{
  "status":"NON_CONFORME",
  "reason":"Carbon Equivalent",
  "actual":0.45,
  "required":0.43
}
```

---

# 18. Audit Trail

Conservare sempre:

- PDF originale
- OCR
- Markdown
- JSON
- Verifica
- Utente
- Timestamp

---

# 19. Sicurezza

Applicare:

- RBAC esistente
- Company Scope esistente
- Segregazione multi-tenant esistente

Nessuna deroga.

---

# 20. AI

Modelli previsti:

## MVP

Ollama

Qwen

PaddleOCR

## Futuro

Azure OpenAI

Copilot Integration

Provider alternativi

tramite AI Provider Adapter.

---

# 21. MVP

## Fase 1

Import PDF.

## Fase 2

OCR.

## Fase 3

Markdown.

## Fase 4

JSON.

## Fase 5

Rule Engine.

## Fase 6

Dashboard.

## Fase 7

Workflow qualità.

---

# 22. Future Evolution

Certificati trattamenti termici.

Certificati verniciatura.

PPAP.

ISIR.

Dossier fornitore.

Supplier Scorecard.

Material Compliance Assistant.