# ISO 4063 — Processi di saldatura (riferimento operativo SGQ)

> **Uso**: ingest patentini/WPQR/WPS, modulo 3834.  
> **Fonte**: estratto operativo da ISO 4063 (designazioni processo). Testo integrale nel Patrimonio Studio.  
> **Catalogo codice**: `app/src/data/weldingProcesses4063.js` (fonte unica per UI e normalizzazione).

## Scopo

Designazione numerica univoca dei **processi di saldatura**. Usata da ISO 9606, ISO 15614, WPS/WPQR e certificati ente.

## Regole per l'estrazione AI

| Campo | Regola |
|-------|--------|
| `welding_process` | Codice **numerico** ISO 4063 (es. `135`, `141`) — non il nome commerciale |
| Alias comuni | MIG/MAG filo solido → `135`; filo animato → `136`; TIG/GTAW → `141`; MMA/elettrodo → `111`; SAW → `121` |
| Ambiguità MAG | Se non specificato filo animato, preferire `135` |
| Formato certificato | Spesso `ISO 4063: 135` o `Process 141` nel testo |

## Tabella — processi più frequenti (modulo 3834)

| Codice | Descrizione sintetica |
|--------|------------------------|
| 111 | Elettrodo rivestito (MMA) |
| 121 | Arco sommerso (SAW) |
| 131 | MIG filo solido |
| 135 | MAG filo solido |
| 136 | MAG filo animato (FCAW) |
| 138 | MAG filo animato metallico |
| 141 | TIG (GTAW) |
| 145 | TIG + filo freddo |
| 311 | Ossiacetilenica |

Elenco completo e alias: vedi catalogo JS.

## Riferimenti incrociati

- ISO 9606-1 — qualifica saldatori
- ISO 15614-1 — qualifica procedure (WPQR)
- ISO/TR 15608 — gruppi materiale (catalogo separato)
