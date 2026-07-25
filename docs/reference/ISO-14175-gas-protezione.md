# ISO 14175:2008 — Gas e miscele per saldatura a fusione (riferimento operativo SGQ)

> **Uso**: ingest patentini/WPQR/WPS, modulo 3834, campo `shielding_gas`.  
> **Fonte**: estratto operativo da ISO 14175:2008 (classificazione/designazione). Testo integrale digitalizzato in `docs/Normative/Normative NORMA_00012_ UNI EN ISO 14175_2008 Rev. 0.md`.  
> **Catalogo codice**: `app/src/data/shieldingGases14175.js` (mirror backend).  
> **Piano slice**: RC-3 in `docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md`.

## Scopo

Classificare e designare gas di protezione, backing, process e assist in base a proprietà chimiche e comportamento metallurgico. Collega i processi ISO 4063 (es. 141 TIG, 13x MAG/MIG).

**Rapporto con ISO 3834**: la serie 3834 richiede controllo di processi/consumabili; i certificati e le WPS riportano tipicamente il **simbolo di classificazione** (es. `M21`, `I1`) definito da questa norma. Non sostituisce i requisiti di sistema 3834: li completa sul campo gas.

## Regole per l'estrazione AI

| Campo | Regola |
|-------|--------|
| `shielding_gas` | Codice **simbolo** ISO 14175 (main+sub): `I1`, `M21`, `C1`, … — non il nome commerciale del fornitore |
| Preferenza | Se presente sia designazione lunga (`ISO 14175 – M21 – ArC – 18`) sia simbolo corto, salvare il **simbolo corto** (`M21`) |
| Formato certificato | Spesso `Gas: M21`, `ISO 14175-M21`, `Ar+18%CO2 (M21)` |
| Non applicabile | Processo senza gas (es. 111 MMA, 121 SAW) → `null` |
| Gruppo Z | Miscele fuori tabella / componenti non elencati → codice `Z` (non intercambiabile con altri Z) |

## Gruppi principali (sintesi)

| Gruppo | Significato |
|--------|-------------|
| I | Gas inerti e miscele inerti (Ar, He) |
| M1 / M2 / M3 | Miscele ossidanti con O₂ e/o CO₂ (MAG tipico) |
| C | Gas/miscele fortemente ossidanti (CO₂ puro o con O₂) |
| R | Miscele riducenti (H₂) |
| N | Azoto o miscele con N₂ |
| O | Ossigeno |
| Z | Fuori range / componenti non in Tabella 2 |

## Simboli più frequenti (modulo 3834)

| Simbolo | Descrizione sintetica |
|---------|------------------------|
| I1 | Argon 100 % (TIG tipico) |
| I2 | Elio 100 % |
| I3 | Ar + He (0,5–95 % He) |
| M12 | Ar + CO₂ basso (0,5–5 %) |
| M13 | Ar + O₂ basso (0,5–3 %) |
| M20 | Ar + CO₂ 5–15 % |
| M21 | Ar + CO₂ 15–25 % (MAG comune) |
| M22 | Ar + O₂ 3–10 % |
| M24 | Ar + CO₂ 5–15 % + O₂ 0,5–3 % |
| C1 | CO₂ 100 % |
| R1 | Ar + H₂ 0,5–15 % |
| N1 | N₂ 100 % |

Elenco completo e normalizzazione: vedi catalogo JS.

## Esempi di designazione (norma §5.2)

| Classificazione | Designazione completa (esempio) |
|-----------------|----------------------------------|
| M25 | `ISO 14175 – M25 – ArCO – 6/4` |
| I3 | `ISO 14175 – I3 – ArHe – 30` |
| R1 | `ISO 14175 – R1 – ArH – 5` |

## Riferimenti incrociati

- ISO 3834 (serie) — requisiti SGQ saldatura (gas come consumabile di processo)
- ISO 4063 — processi (141, 135, …)
- ISO 9606-1 / ISO 14732 — patentini (campo gas se applicabile)
- ISO 15614-1 — WPQR/WPS
