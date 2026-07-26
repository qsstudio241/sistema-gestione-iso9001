# ISO 14341:2020 — Fili-elettrodo e depositi MAG/MIG (riferimento operativo SGQ)

> **Uso**: ingest WPS/WPQR, modulo 3834, campo `filler_material` (designazione consumabile).  
> **Fonte**: estratto operativo da ISO 14341:2020 (classificazione). Testo digitalizzato in `docs/Normative/Normative NORMA_00016_ UNI EN ISO 14341_2020 Rev. 0.md`.  
> **Modulo codice**: `app/src/data/fillerWire14341.js` (mirror backend) — solo regole/prompt, non elenco esaustivo di tutte le combinazioni.  
> **Piano slice**: RC-11 in `docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md`.  
> **Non confondere** con `filler_material_group` (FM1–FM6, ISO 14343 / 18274 — RC-4).

## Scopo

Classificare **fili-elettrodo** e **depositi** per saldatura ad arco con gas di protezione (GMAW/MIG-MAG) di **acciai non legati e a grano fine** (Re fino a ~500 MPa / Rm fino a ~570 MPa). Un filo può essere classificato con gas diversi.

**Rapporto con ISO 3834**: la serie 3834 richiede identificazione e controllo dei consumabili; WPS/WPQR riportano tipicamente la **designazione di classificazione** ISO 14341 (es. `G 42 4 M21 3Si1`). Non sostituisce i requisiti di sistema 3834.

## Due sistemi di classificazione (A / B)

| Suffisso | Base | Energia d'impatto | Uso tipico |
|----------|------|-------------------|------------|
| **A** (`ISO 14341-A-…`) | carico di snervamento + 47 J | Tabella 2 a 47 J | mercato europeo |
| **B** (`ISO 14341-B-…`) | carico di rottura + 27 J | Tabella 2 a 27 J (opz. `U` = anche 47 J) | mercato “B” |

Le clausole/tabelle con suffisso A o B valgono solo per quel sistema; senza suffisso valgono per entrambi.

## Struttura designazione (5 parti dopo `G`)

Per il **deposito** (classificazione completa):

1. **G** — prodotto/processo: filo e/o deposito con gas (GMAW)
2. **Resistenza/allungamento** — sistema A: `35` `38` `42` `46` `50`; sistema B: `43A`/`43P` `49A`/`49P` `55A`/`55P` `57A`/`57P` (`A` = as-welded, `P` = PWHT)
3. **Impatto** — simbolo temperatura Tabella 2 (`Z`, `A`/`Y`, `0`…`10`)
4. **Gas** — simbolo ISO 14175 usato in classificazione (`M12`, `M13`, `M20`, `M21`, `C1`, `Z` = non specificato)
5. **Composizione filo** — simbolo Tabella 3A (es. `3Si1`) o 3B (es. `S3`, `S11`); `Z…` = accordo produttore/cliente

Solo filo (composizione, senza proprietà deposito): es. `ISO 14341-A-G 3Si1` / `ISO 14341-B-G S3`.

## Simboli impatto (Tabella 2, sintesi)

| Simbolo | Temperatura (°C) per 47 J (A) o 27 J (B) |
|---------|------------------------------------------|
| Z | Nessun requisito |
| A o Y | +20 |
| 0 | 0 |
| 2 | −20 |
| 3 | −30 |
| 4 | −40 |
| 5 | −50 |
| 6 | −60 |
| 7…10 | −70 … −100 |

Una classificazione a temperatura più bassa copre automaticamente le temperature più alte della tabella.

## Gas (§5.4) — rinvio ISO 14175

I simboli gas nella designazione 14341 sono quelli ISO 14175 (RC-3): tipici `M21`, `M20`, `M12`, `M13`, `C1`; `Z` = gas non specificato. Per il campo separato `shielding_gas` usare il catalogo `shieldingGases14175.js`.

## Esempi (§11, da norma)

| Designazione | Significato sintetico |
|--------------|------------------------|
| `ISO 14341-A-G 46 5 M21 3Si1` | Sistema A: Re ≥ 460 MPa, 47 J a −50 °C, gas M21, filo 3Si1 |
| `ISO 14341-A-G 3Si1` | Solo filo (composizione 3Si1) |
| `ISO 14341-A-G Z4Mo1` | Composizione fuori tabella (accordo) |
| `ISO 14341-B-G 49A 6 M21 S3` | Sistema B: Rm ≥ 490 as-welded, 27 J a −60 °C, M21, filo S3 |
| `ISO 14341-B-G 49A 0U C1 S11` | Sistema B + opzionale U (anche 47 J a 0 °C), gas C1, S11 |

Su certificati/WPS spesso compare la forma corta senza prefisso norma: `G 42 4 M21 3Si1` o `G 42 4 M21 4Si1`.

## Regole per l'estrazione AI

| Campo | Regola |
|-------|--------|
| `filler_material` | Salvare la **designazione di classificazione** (preferire forma completa se presente: `ISO 14341-A-G 46 5 M21 3Si1` o corta `G 46 5 M21 3Si1`) |
| Dimensione filo | Se presente (es. Ø 1,2 mm), appenderla o tenerla in nota; non sostituisce la classificazione |
| Nome commerciale | Non sostituire la designazione ISO (es. “ER70S-6” AWS può restare in warning/nota se non c’è ISO) |
| `filler_material_group` | **Non** derivare da 14341: è FM1–FM6 (altra norma / RC-4) |
| `shielding_gas` | Estrarre il simbolo 14175 **anche** se compare solo dentro la designazione 14341 (es. `… M21 3Si1` → gas `M21`) se il campo gas è vuoto |
| Non applicabile | Consumabili fuori scope (acciai inox → ISO 14343; alluminio → ISO 18274; elettrodo rivestito → altre norme) → non forzare 14341 |

## GAP / limiti PDF

- Tabella 3A/3B (composizione chimica completa) **non affidabile** dall’estrazione automatica (pagina con font/layout problematico).
- Non inventare simboli chimici oltre esempi §11 e simboli già leggibili nel MD.
- Pagine 6 e 21 senza testo utile.

## Riferimenti incrociati

- ISO 14175 — gas di protezione (simbolo nella 4ª parte)
- ISO 15609-1 — contenuto WPS (consumabili §4.4.8)
- ISO 15614-1 — WPQR
- ISO 3834 (serie) — controllo consumabili
- ISO 13916 — misura temperature (citata nei test meccanici §6)
- RC-4 — gruppi FM (diverso da questa designazione)
