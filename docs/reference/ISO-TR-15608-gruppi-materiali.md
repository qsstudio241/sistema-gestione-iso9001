# ISO/TR 15608:2013 — Gruppi materiali (riferimento operativo SGQ)

> **Uso**: assistente AI, ingest patentini/WPQR/WPS, modulo 3834.  
> **Fonte**: estratto operativo da ISO/TR 15608:2013 (ed. 3). Testo integrale nel Patrimonio Studio.  
> **Catalogo codice**: `app/src/data/materialGroups15608.js` (fonte unica per UI e normalizzazione).

## Scopo

Sistema uniforme di **raggruppamento materiali metallici** per saldatura (e trattamenti termici, formatura, NDT). Usato da ISO 9606, ISO 15614, EN ISO 3834.

## Regole per l'estrazione AI

| Campo | Regola |
|-------|--------|
| `material_group` | Codice sottogruppo ISO/TR 15608 (es. `1.2`, `8.1`, `21`) **quando è indicato sul certificato**. Se il certificato indica **solo il gruppo padre** (es. "Gruppo 1", "gr. 8"), restituire il codice del gruppo padre così com'è (es. `1`, `8`) — vedi nota sotto. |
| `filler_material_group` | FM1–FM6 (ISO 14343 / 18274) — **non** confondere con gruppo base |
| Designazione acciaio | Mappare quando possibile: S235/P235 → `1.1`; S355/P355 → `1.2`; 1.4301/AISI 304 → `8.1`; 1.4404/AISI 316L → `8.2`; 1.4462 → `10.1` |
| Ambiguità | `null` + warning, mai inventare |

### Nota — gruppo padre vs sottogruppo sui patentini saldatori (aggiornamento 16/07/2026, feedback Studio Mason)

I patentini saldatori reali (ISO 9606-1) riportano spesso **solo il gruppo padre** (es. "1",
"8") e **non il sottogruppo** (es. "1.2", "8.1"): una qualifica su un sottogruppo copre
tipicamente l'intero gruppo padre secondo ISO 9606-1, quindi il certificato indica il dato
più generico. Questo **non contraddice** la regola di fondo (il sottogruppo resta il dato più
preciso quando disponibile, es. per WPS/WPQR dove serve la granularità fine) — significa
solo che il campo `material_group` deve accettare **entrambe** le forme. Il catalogo
`materialGroups15608.js` espone ora anche i gruppi padre come opzioni selezionabili
(`getMaterialGroupSelectOptions` — i gruppi padre non sostituiscono i sottogruppi, li
affiancano) e li risolve in `findMaterialGroup`/`normalizeMaterialGroupCode`.

## Tabella 1 — Acciai (gruppi 1–11)

| Codice | Descrizione sintetica |
|--------|------------------------|
| 1.1 | Re ≤ 275 MPa |
| 1.2 | 275 < Re ≤ 360 MPa |
| 1.3 | Acciai a grano fino normalizzati, Re > 360 MPa |
| 1.4 | Resistenza corrosione atmosferica |
| 2.1 | TMCP a grano fino, 360 < Re ≤ 460 MPa |
| 2.2 | TMCP a grano fino, Re > 460 MPa |
| 3.1 | Temprati e rinvenuti, 360 < Re ≤ 690 MPa |
| 3.2 | Temprati e rinvenuti, Re > 690 MPa |
| 3.3 | Indurimento per precipitazione (non inox) |
| 4.1 | Cr-Mo-(Ni) bassolegati, Cr ≤ 0,3 % |
| 4.2 | Cr-Mo-(Ni) bassolegati, Cr ≤ 0,7 % |
| 5.1–5.4 | Acciai Cr-Mo (range Cr/Mo crescenti) |
| 6.1–6.4 | Acciai Cr-Mo ad alto vanadio |
| 7.1 | Inox ferritici |
| 7.2 | Inox martensitici |
| 7.3 | Inox induriti per precipitazione |
| 8.1 | Inox austenitici Cr ≤ 19 % |
| 8.2 | Inox austenitici Cr > 19 % |
| 8.3 | Inox austenitici al Mn |
| 9.1–9.3 | Acciai legati al nichel |
| 10.1–10.3 | Inox duplex |
| 11.1–11.3 | Acciai gruppo 1 con C elevato (0,25–0,85 %) |

**Note**: per spessore variabile usare il **Re massimo** specificato. I gruppi 2 possono essere considerati gruppo 1 in base all'analisi prodotto.

## Tabella 2 — Alluminio (21–26)

| Codice | Descrizione |
|--------|-------------|
| 21 | Alluminio puro |
| 22.1–22.4 | Leghe Al-Mn / Al-Mg non trattabili termicamente |
| 23.1–23.2 | Leghe trattabili termicamente (Al-Mg-Si, Al-Zn-Mg) |
| 24.1–24.2 | Leghe Al-Si da fonderia |
| 25 | Al-Si-Cu da fonderia |
| 26 | Al-Cu |

## Tabella 3 — Rame (31–38)

31 rame; 32.1–32.2 ottoni; 33 bronzo; 34 Cu-Ni; 35 Cu-Al; 36 Cu-Ni-Zn; 37–38 altre leghe.

## Tabella 4 — Nichel (41–48)

41 nichel puro; 42 Ni-Cu; 43 Ni-Cr; 44 Ni-Mo; 45 Ni-Fe-Cr; 46 Ni-Cr-Co; 47 Ni-Fe-Cr-Cu; 48 Ni-Fe-Co.

## Tabella 5 — Titanio (51–54)

51.1–51.4 titanio puro per contenuto O₂; 52 alfa; 53 alfa-beta; 54 near-beta/beta.

## Tabella 6 — Zirconio (61–62)

61 puro; 62 con 2,5 % Nb.

## Tabella 7 — Ghisa (71–76)

71 grigia; 72.1–72.4 sferoidale; 73 malleabile; 74 austemperata; 75 austenitica; 76 altre.

## Riferimenti incrociati utili

- ISO/TR 20172 — materiali europei (mappatura designazioni)
- ISO 9606-1 — qualifica saldatori (acciai)
- ISO 9606-2 — qualifica saldatori (alluminio)
- EN ISO 15614-1 — qualifica procedure (acciai)
