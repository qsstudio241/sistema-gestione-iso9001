# ISO 6947 — Posizioni di saldatura (riferimento operativo SGQ)

> **Uso**: ingest patentini/WPQR/WPS, modulo 3834.  
> **Fonte**: estratto operativo da ISO 6947. Testo integrale nel Patrimonio Studio.  
> **Catalogo codice**: `app/src/data/weldingPositions6947.js` (fonte unica per UI e normalizzazione).

## Scopo

Lettere che identificano la **posizione** del giunto durante la saldatura (piastra e tubo). Compare nei certificati ISO 9606 come elenco di posizioni qualificate.

## Regole per l'estrazione AI

| Campo | Regola |
|-------|--------|
| `welding_positions` | **Array** di codici maiuscoli ISO 6947 |
| Non confondere | PA (piana) ≠ PE (sopratesta) ≠ PF (verticale su) |
| Multiplo | Includere tutte le posizioni elencate sul certificato |
| AWS legacy | 1G→PA, 2G→PC, 3G→PF, 4G→PE, 6G→PJ o H-L045 (euristica) |

## Tabella — posizioni principali

| Codice | Descrizione sintetica |
|--------|------------------------|
| PA | Piana / sotto testa |
| PB | Orizzontale su verticale |
| PC | Orizzontale |
| PD | Sopratesta orizzontale |
| PE | Sopratesta |
| PF | Verticale ascendente |
| PG | Verticale discendente |
| PH | Tubo orizzontale fisso |
| PJ | Tubo inclinato fisso |
| H-L045 | Tubo inclinato 45° |
| J-L045 | Tubo inclinato 45° discendente |

## Riferimenti incrociati

- ISO 9606-1 — campo posizioni in designazione qualifica
- ISO 15614-1 — posizione prova WPQR
