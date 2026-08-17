# EN 10210-1:2006 — Sezioni cave strutturali finite a caldo (soglie)

> **Uso**: Material Compliance (confronto valori sul 3.1 di tubo/hollow **hot finished**) + ISO-3 (riconoscere grado `*H`).  
> **Fonte**: BS EN 10210-1:2006. Testo digitalizzato in `docs/Normative/Normative NORMA_00027_ EN 10210-1_2006 Rev. 0.md`.  
> **Numeri**: verificati sul testo pymupdf / tabelle pdfplumber (non sulle griglie Markdown specchiate delle pag. 24–27). PDF **non** in Git.  
> **Non** è una norma SGQ a clausole 4–10: **non** va in `import-norms-from-markdown.js`.

## Scopo (cosa copre, cosa no)

Condizioni tecniche di fornitura per **sezioni cave finite a caldo** (circolari, quadre, rettangolari, ellittiche): formate a caldo, oppure formate a freddo **con** trattamento termico successivo equivalente al prodotto hot formed (§1).

**Non** copre sezioni cave **cold formed senza** quel trattamento → **EN 10219-1** (Markdown ancora assente → skip, non fail).  
**Non** copre lamiere/profili → EN 10025-2.  
Tolleranze/dimensioni: EN 10210-2 (non in questo PDF).

Spessore massimo seedato:

- Annex A (non legati JR/J0/J2/K2): **≤ 120 mm**
- Annex B (fine grain N/NL): **≤ 65 mm**

## Come si legge la designazione

Esempio: `EN 10210-S355J2H` oppure `EN 10210-S355NLH`

| Pezzo | Significato |
|-------|-------------|
| `S` | acciaio strutturale |
| `355` | ReH minimo a spessore ≤ 16 mm (MPa) |
| `JR` / `J0` / `J2` / `K2` | resilienza Annex A: 27 J a +20 / 0 / −20 °C; K2 = 40 J a −20 °C (nota e = 27 J a −30 °C) |
| `N` / `NL` | Annex B: normalizzato; NL = 27 J a −50 °C |
| `H` | hollow section (obbligatorio in questa norma) |

In questa edizione **non** ci sono S275JRH né S235J0H/J2H: solo `S235JRH` tra i JR. Qualità JR: KV verificata solo se Opzione 1.3 all’ordine.

Senza `EN 10210` (o 10210-1) citata sul certificato/ordine, **non** si applica questa tabella: lo stesso `S355J2H` può essere 10219 (cold). Skip finché non è chiaro.

## Quale tabella usare sul certificato

| Cosa c’è sul 3.1 | Tabella limite |
|------------------|----------------|
| Analisi di colata (heat) | Tab. A.1 o B.1 (chimica) + A.2 o B.2 (CEV) |
| ReH, Rm, A | Tab. A.3 o B.3, in funzione dello **spessore nominale** |
| KV | Tab. A.3 o B.3; JR solo con Opzione 1.3 |

Formula CEV (IIW, §6.5), sul heat analysis — stessa di EN 10025-2:

`CEV = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15`

## Tabella A.1 — Chimica heat analysis (% max), spessore ≤ 120 mm

| Grado | N. | Deox | C ≤40 | C 40–120 | Si | Mn | P | S | N |
|-------|-----|------|-------|----------|----|----|---|---|---|
| S235JRH | 1.0039 | FN | 0,17 | 0,20 | — | 1,40 | 0,040 | 0,040 | 0,009 |
| S275J0H | 1.0149 | FN | 0,20 | 0,22 | — | 1,50 | 0,035 | 0,035 | 0,009 |
| S275J2H | 1.0138 | FF | 0,20 | 0,22 | — | 1,50 | 0,030 | 0,030 | — |
| S355J0H | 1.0547 | FN | 0,22 | 0,22 | 0,55 | 1,60 | 0,035 | 0,035 | 0,009 |
| S355J2H | 1.0576 | FF | 0,22 | 0,22 | 0,55 | 1,60 | 0,030 | 0,030 | — |
| S355K2H | 1.0512 | FF | 0,22 | 0,22 | 0,55 | 1,60 | 0,030 | 0,030 | — |

Note: FN = rimming non ammesso; FF = fully killed. N max non si applica se Al tot ≥ 0,020 % e Al/N ≥ 2:1 (o altri leganti N, da citare sul certificato).

## Tabella A.2 — CEV max (heat analysis)

| Grado | ≤16 | 16–40 | 40–65 | 65–120 |
|-------|-----|-------|-------|--------|
| S235JRH | 0,37 | 0,39 | 0,41 | 0,44 |
| S275J0H / J2H | 0,41 | 0,43 | 0,45 | 0,48 |
| S355J0H / J2H / K2H | 0,45 | 0,47 | 0,50 | 0,53 |

## Tabella A.3 — ReH min (MPa)

| Grado | ≤16 | 16–40 | 40–63 | 63–80 | 80–100 | 100–120 |
|-------|-----|-------|-------|-------|--------|---------|
| S235 | 235 | 225 | 215 | 215 | 215 | 195 |
| S275 | 275 | 265 | 255 | 245 | 235 | 225 |
| S355 | 355 | 345 | 335 | 325 | 315 | 295 |

## Tabella A.3b — Rm (MPa min–max)

| Grado | ≤3 | 3–100 | 100–120 |
|-------|----|-------|---------|
| S235 | 360–510 | 360–510 | 350–500 |
| S275 | 430–580 | 410–560 | 400–540 |
| S355 | 510–680 | 470–630 | 450–600 |

## Tabella A.3c — A min longitudinale (%)

Valori trasversali: 2 % in meno. Spessore < 3 mm: vedi 9.2.2 (non seedato).

| Grado | ≤40 | 40–63 | 63–100 | 100–120 |
|-------|-----|-------|--------|---------|
| S235 | 26 | 25 | 24 | 22 |
| S275 | 23 | 22 | 21 | 19 |
| S355 | 22 | 21 | 20 | 18 |

## Tabella A.3d — KV min (J)

| Grado | T (°C) | min J | Nota |
|-------|--------|-------|------|
| S235JRH | +20 | 27 | solo Opzione 1.3 |
| S275J0H / S355J0H | 0 | 27 | |
| S275J2H / S355J2H | −20 | 27 | |
| S355K2H | −20 | 40 | nota e: equivalente 27 J a −30 °C |

## Tabella B.1 — Chimica heat (fine grain), spessore ≤ 65 mm

Mn è un intervallo min–max. C di S355NLH è **0,18** (più basso di S355NH 0,20).

| Grado | N. | C | Si | Mn | P | S | Nb | V | Al tot min | Ti | Cr | Ni | Mo | Cu | N |
|-------|-----|---|----|----|---|---|----|---|------------|----|----|----|----|----|---|
| S275NH | 1.0493 | 0,20 | 0,40 | 0,50–1,40 | 0,035 | 0,030 | 0,050 | 0,08 | 0,020 | 0,03 | 0,30 | 0,30 | 0,10 | 0,35 | 0,015 |
| S275NLH | 1.0497 | 0,20 | 0,40 | 0,50–1,40 | 0,030 | 0,025 | 0,050 | 0,08 | 0,020 | 0,03 | 0,30 | 0,30 | 0,10 | 0,35 | 0,015 |
| S355NH | 1.0539 | 0,20 | 0,50 | 0,90–1,65 | 0,035 | 0,030 | 0,050 | 0,12 | 0,020 | 0,03 | 0,30 | 0,50 | 0,10 | 0,35 | 0,020 |
| S355NLH | 1.0549 | 0,18 | 0,50 | 0,90–1,65 | 0,030 | 0,025 | 0,050 | 0,12 | 0,020 | 0,03 | 0,30 | 0,50 | 0,10 | 0,35 | 0,020 |
| S420NH | 1.8750 | 0,22 | 0,60 | 1,00–1,70 | 0,035 | 0,030 | 0,050 | 0,20 | 0,020 | 0,03 | 0,30 | 0,80 | 0,10 | 0,70 | 0,025 |
| S420NLH | 1.8751 | 0,22 | 0,60 | 1,00–1,70 | 0,030 | 0,025 | 0,050 | 0,20 | 0,020 | 0,03 | 0,30 | 0,80 | 0,10 | 0,70 | 0,025 |
| S460NH | 1.8953 | 0,22 | 0,60 | 1,00–1,70 | 0,035 | 0,030 | 0,050 | 0,20 | 0,020 | 0,03 | 0,30 | 0,80 | 0,10 | 0,70 | 0,025 |
| S460NLH | 1.8956 | 0,22 | 0,60 | 1,00–1,70 | 0,030 | 0,025 | 0,050 | 0,20 | 0,020 | 0,03 | 0,30 | 0,80 | 0,10 | 0,70 | 0,025 |

Deox: GF (fully killed, fine grain). S275/S355 = quality steel; S420/S460 = special steel. Se Cu > 0,30 % allora Ni ≥ metà del Cu.

## Tabella B.2 — CEV max (heat)

| Grado | ≤16 | 16–65 |
|-------|-----|-------|
| S275NH / NLH | 0,40 | 0,40 |
| S355NH / NLH | 0,43 | 0,45 |
| S420NH / NLH | 0,50 | 0,52 |
| S460NH / NLH | 0,53 | 0,55 |

## Tabella B.3 — ReH min (MPa), spessore ≤ 65 mm

| Grado | ≤16 | 16–40 | 40–65 |
|-------|-----|-------|-------|
| S275 | 275 | 265 | 255 |
| S355 | 355 | 345 | 335 |
| S420 | 420 | 400 | 390 |
| S460 | 460 | 440 | 430 |

## Tabella B.3b — Rm (MPa) e A min (%), spessore ≤ 65 mm

| Grado | Rm | A long. | A trans. |
|-------|----|---------|----------|
| S275 | 370–510 | 24 | 22 |
| S355 | 470–630 | 22 | 20 |
| S420 | 520–680 | 19 | 17 |
| S460 | 540–720 | 17 | 15 |

## Tabella B.3c — KV min (J)

| Grado | T (°C) | min J |
|-------|--------|-------|
| *NH (S275/S355/S420/S460) | −20 | 40 (nota b: 27 J a −30 °C) |
| *NLH | −50 | 27 |

## Cosa non seedare (GAP onesto)

- EN 10219-1 (cold formed): **mancante**
- EN 10210-2 (tolleranze/dimensioni)
- Analisi di prodotto (se prevista: non è Tab. A.1)
- Opzione 1.3 (KV su JR) e altre opzioni d’ordine: MC-3 tratta come skip se non risultano dal 3.1
- Gradi assenti da Annex A/B (es. S275JRH)

## Prompt / chiavi (ISO-3 e MC)

| Chiave | Esempio |
|--------|---------|
| `material_standard` | `EN 10210-1` (anche «UNI EN 10210», «EN 10210») |
| `steel_designation` | S355J2H, S355NLH |
| `product_form` | `tube` \| `hollow_section` |
