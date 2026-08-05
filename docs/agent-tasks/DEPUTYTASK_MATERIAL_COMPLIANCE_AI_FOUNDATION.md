# MATERIAL COMPLIANCE AI - LEAD DEVELOPER PROMPT

## Contesto

Stai lavorando sul repository:

sistema-gestione-iso9001

NON stai sviluppando una nuova applicazione.

Stai sviluppando un nuovo modulo integrato nella piattaforma SGQ esistente.

Prima di qualsiasi attività devi leggere:

1. docs/GUIDA_CONSOLIDATA.md
2. docs/PROJECT_ROADMAP.md
3. docs/ARCHITETTURA_UTENTI_RBAC.md
4. docs/adr/ADR-020-material-compliance-ai-module.md
5. docs/adr/ADR-021-material-requirements-hierarchy.md
6. docs/adr/ADR-022-ai-extraction-rule-engine.md
7. docs/adr/ADR-023-material-knowledge-base.md
8. docs/adr/ADR-024-material-certificate-workflow.md
9. docs/specs/MODULO_MATERIAL_COMPLIANCE_AI.md

---

# Obiettivo

Realizzare il modulo:

Material Compliance AI

per la gestione della conformità dei certificati materiale.

---

# Regole fondamentali

## Regola 1

NON creare una nuova architettura.

Riutilizzare tutte le componenti SGQ già esistenti.

In particolare:

- RBAC
- Company Scope
- Ingest Pipeline
- AI Provider Adapter
- Document Registry
- Audit Trail
- Sidebar
- Dashboard patterns

---

## Regola 2

NON introdurre duplicazione.

Ogni volta che serve una funzionalità:

prima cercare nel repository.

Se esiste una soluzione già utilizzata:

riutilizzarla.

---

## Regola 3

AI non approva conformità.

ADR-022 è vincolante.

L'AI può:

- estrarre
- classificare
- normalizzare

Il Rule Engine deve:

- verificare
- confrontare
- decidere

---

## Regola 4

Human In The Loop obbligatorio.

Nessun certificato può essere approvato automaticamente.

---

## Regola 5

I requisiti non devono essere hardcoded.

Norme e clienti devono vivere nella Knowledge Base.

Mai scrivere:

if(cliente == "FASSI")

nel codice.

---

# Attività iniziale

NON scrivere ancora codice.

Creare prima:

docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md

contenente:

- schema DB
- relazioni
- entità
- workflow
- mapping documenti

---

# Dopo il Data Model

Creare:

docs/specs/MATERIAL_COMPLIANCE_UI.md

contenente:

- route
- pagine
- componenti
- menu

---

# Dopo la UI

Creare:

docs/specs/MATERIAL_COMPLIANCE_API.md

contenente:

- endpoint
- payload
- servizi

---

# Dopo le SPEC

Preparare un piano di implementazione a slice.

Ogni slice deve essere:

- piccola
- testabile
- deployabile

Seguire il metodo SGQ Lead/Deputy.

---

# Stack MVP

Frontend

React

Backend

Node / Express esistente

Database

SQL Server esistente

AI

Provider Adapter esistente

OCR

Provider dedicato configurabile

Knowledge Base

Markdown versionato

---

# Output richiesto

Prima di scrivere codice produrre:

1. MATERIAL_COMPLIANCE_DATA_MODEL.md
2. MATERIAL_COMPLIANCE_UI.md
3. MATERIAL_COMPLIANCE_API.md
4. Piano slice MVP

Solo dopo iniziare lo sviluppo.