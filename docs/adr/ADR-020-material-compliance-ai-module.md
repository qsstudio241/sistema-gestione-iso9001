# ADR-020 - Material Compliance AI Module

## Stato

PROPOSTO

## Data

2026-08-05

## Contesto

La piattaforma SGQ necessita di un nuovo modulo dedicato alla gestione della conformità dei certificati di materia prima.

Il modulo deve supportare:

- Certificati EN 10204 3.1
- Materie prime metalliche
- Verifica conformità materiali
- Verifica conformità ordini
- Verifica conformità cliente
- Verifica conformità requisiti aziendali

L'obiettivo è ridurre il tempo di verifica delle forniture mantenendo piena tracciabilità auditabile.

## Decisione

Il modulo sarà implementato come componente della piattaforma SGQ esistente.

Non verrà sviluppata un'applicazione separata.

Nome modulo:

Material Compliance AI

## Integrazioni obbligatorie

- Document Registry
- Ingest Pipeline
- Company Scope Pattern
- AI Provider Adapter
- Audit Trail AI
- RBAC aziendale

## Obiettivi funzionali

1. Acquisizione certificati PDF
2. OCR documentale
3. Conversione Markdown
4. Estrazione dati strutturati
5. Verifica conformità automatica
6. Workflow approvazione qualità
7. Archiviazione risultati

## Obiettivi non funzionali

- Auditabilità
- Riproducibilità
- Tracciabilità
- Scalabilità
- Riutilizzo delle componenti SGQ esistenti

## Conseguenze

Vantaggi:

- forte integrazione con il sistema SGQ
- riuso dell'infrastruttura esistente
- riduzione costi di manutenzione

Svantaggi:

- dipendenza dall'architettura SGQ esistente