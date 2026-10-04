# ISO 4063:2023 — Processi di saldatura (riferimento operativo SGQ)

> **Uso**: ingest patentini/WPQR/WPS, modulo 3834, designazione processo.
> **Fonte**: estratto operativo da ISO 4063:2023 (quinta edizione, 2023-03). Testo integrale digitalizzato in `docs/Normative/Normative NORMA_00044_ ISO 4063_2023 Rev. 0.md` (+ `.json`). PDF **non** in Git.
> **Non** è un SGQ a clausole 4–10: **non** seed `norm_requirements` / `import-norms-from-markdown.js`.
> **Catalogo codice**: `app/src/data/weldingProcesses4063.js` (mirror `backend/src/data/`). Elenco **frequente** per UI/AI, non l’intera norma.

## Fonti Markdown

```text
Fonti Markdown:
- Coperte: NORMA_00044 ISO 4063:2023 (schema generic; elenco §5 ricostruito pymupdf)
- Mancanti: NORMA_00xxx 14732 (non blocca 4063)
- Si parte su: famiglia 78 corrente (783–786) nel testo ufficiale
```

## Designazione (§4)

Formato: `ISO 4063 – <numero>` (trattino, massimo tre cifre). Ibrido: numeri uniti da `+` (es. `ISO 4063 – 522 + 15`).

## Regole per l'estrazione AI

| Campo | Regola |
|-------|--------|
| `welding_process` | Codice **numerico** ISO 4063 (es. `135`, `141`, `783`) — non il nome commerciale |
| Alias comuni | MIG/MAG filo solido → `135`; filo animato → `136`; TIG/GTAW → `141`; MMA/elettrodo → `111`; SAW → `121` |
| Ambiguità MAG | Se non specificato filo animato, preferire `135` |
| Stud / prigionieri | Se il certificato scrive **783 / 784 / 785 / 786**, copiare quel numero. Non usare **781** né **787** (obsoleti, Annex B). Non inventare un 78x se manca il numero |
| Acronimo USA `SW` | Annex C: `SW` ↔ 783/785/786 — non scegliere uno dei tre senza il numero sul documento |
| Formato certificato | Spesso `ISO 4063: 135` o `Process 141` |

## Tabella — processi frequenti (modulo 3834) + famiglia stud

| Codice | Descrizione sintetica (da 2023) |
|--------|----------------------------------|
| 111 | Manual metal arc welding (MMA/SMAW) |
| 114 | Self-shielded tubular cored arc welding |
| 121 | SAW filo solido |
| 131 | MIG filo solido |
| 135 | MAG filo solido |
| 136 | MAG filo animato (FCAW) |
| 138 | MAG filo animato metallico |
| 141 | TIG con apporto solido |
| 142 | TIG autogeno |
| 145 | TIG con gas riducente e apporto solido |
| 15 | Plasma arc welding |
| 311 | Ossiacetilenica |
| **78** | **Arc stud welding** (gruppo) |
| **783** | Drawn arc stud welding with ceramic ferrule or shielding gas |
| **784** | Short-cycle drawn arc stud welding |
| **785** | Capacitor discharge drawn arc stud welding |
| **786** | Capacitor discharge stud welding with tip ignition |

Elenco completo: `NORMA_00044`. Alias UI: catalogo JS.

## Obsoleti (Annex B — non usare come codice corrente)

| Ex codice | Nota |
|-----------|------|
| 781 | Arc stud welding — designazione storica `ISO 4063:1990–781` |
| 787 | Drawn arc stud welding with fusible collar — `ISO 4063:1998–787` |

## Riferimenti incrociati

- ISO 9606-1 — qualifica saldatori
- ISO 14732 — operatori (anche prove prigionieri su 14555)
- ISO 15614-1 — WPQR arco/gas
- ISO 14555 — range WPQR stud (i 78x sono **solo** indicazione di processo; i range restano §10.2.8 della 14555)
- ISO/TR 15608 — gruppi materiale
