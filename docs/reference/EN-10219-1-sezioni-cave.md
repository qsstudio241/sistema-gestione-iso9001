# EN 10219-1:2006 — Sezioni cave strutturali saldate formate a freddo (soglie)

> **Uso**: Material Compliance (confronto valori sul 3.1 di tubo/hollow **cold formed**) + ISO-3 (riconoscere grado `*H` con norma 10219).  
> **Fonte**: BS EN 10219-1:2006. Testo digitalizzato in `docs/Normative/Normative NORMA_00028_ EN 10219-1_2006 Rev. 0.md`.  
> **Numeri**: verificati sulle tabelle pdfplumber (pag. 20–25). Nessuna pagina ATTENZIONE; tabelle non specchiate. Celle unite (J2H/K2H, NLH, MLH) ripetute dal grado padre. PDF **non** in Git.  
> **Non** è una norma SGQ a clausole 4–10: **non** va in `import-norms-from-markdown.js`.

## Scopo (cosa copre, cosa no)

Condizioni tecniche di fornitura per **sezioni cave strutturali saldate formate a freddo** (circolari, quadre, rettangolari), acciai non legati e a grano fine, **senza trattamento termico successivo** (salvo il trattamento termico della saldatura). Spessore **≤ 40 mm**.

**Non** copre sezioni cave **finite a caldo** (o cold formed **con** trattamento equivalente) → **EN 10210-1**.  
**Non** copre lamiere/profili → EN 10025-2.  
Tolleranze/dimensioni: EN 10219-2 (non in questo PDF).

In questa edizione **non** ci sono S420NH/NLH (solo MH/MLH per S420).

## Come si legge la designazione

Esempio: `EN 10219-S355J2H` oppure `EN 10219-S355MLH`

| Pezzo | Significato |
|-------|-------------|
| `S` | acciaio strutturale |
| `355` | ReH minimo a spessore ≤ 16 mm (MPa) |
| `JR` / `J0` / `J2` / `K2` | resilienza Annex A: 27 J a +20 / 0 / −20 °C; K2 = 40 J a −20 °C |
| `N` / `NL` | Annex B, feedstock **N**: NL = 27 J a −50 °C |
| `M` / `ML` | Annex B, feedstock **M** (termomeccanico): ML = 27 J a −50 °C |
| `H` | hollow section (obbligatorio in questa norma) |

Qualità JR: KV verificata solo se Opzione 1.3 all’ordine.

Senza `EN 10219` (o 10219-1) citata sul certificato/ordine, **non** si applica questa tabella: lo stesso `S355J2H` può essere 10210 (hot). Skip finché non è chiaro. **Non** usare 10210 su un 3.1 che cita 10219: CEV S235JRH è 0,35 qui e 0,37 in 10210.

## Quale tabella usare sul certificato

| Cosa c’è sul 3.1 | Tabella limite |
|------------------|----------------|
| Analisi di colata (heat) | Tab. A.1 o B.1/B.2 (chimica) + A.2 o B.3 (CEV) |
| ReH, Rm, A | Tab. A.3 o B.4/B.5, in funzione dello **spessore nominale** |
| KV | Tab. A.3 o B.4/B.5; JR solo con Opzione 1.3 |

Formula CEV (IIW, §6.6), sul heat analysis — stessa di EN 10025-2 / 10210-1:

`CEV = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15`

## Tabella A.1 — Chimica heat analysis (% max), spessore ≤ 40 mm

Deox: tutti **FF** (fully killed). N max non si applica se Al tot ≥ 0,020 % e Al/N ≥ 2:1 (o altri leganti N, da citare sul certificato).

| Grado | N. | Deox | C | Si | Mn | P | S | N |
|-------|-----|------|---|----|----|---|---|---|
| S235JRH | 1.0039 | FF | 0,17 | — | 1,40 | 0,040 | 0,040 | 0,009 |
| S275J0H | 1.0149 | FF | 0,20 | — | 1,50 | 0,035 | 0,035 | 0,009 |
| S275J2H | 1.0138 | FF | 0,20 | — | 1,50 | 0,030 | 0,030 | — |
| S355J0H | 1.0547 | FF | 0,22 | 0,55 | 1,60 | 0,035 | 0,035 | 0,009 |
| S355J2H | 1.0576 | FF | 0,22 | 0,55 | 1,60 | 0,030 | 0,030 | — |
| S355K2H | 1.0512 | FF | 0,22 | 0,55 | 1,60 | 0,030 | 0,030 | — |

## Tabella A.2 — CEV max (heat analysis), spessore ≤ 40 mm

Un solo valore per grado (nessuna fascia 16/40 distinta, a differenza di 10210).

| Grado | ≤40 |
|-------|-----|
| S235JRH | 0,35 |
| S275J0H / J2H | 0,40 |
| S355J0H / J2H / K2H | 0,45 |

## Tabella A.3 — ReH min (MPa)

| Grado | ≤16 | 16 < t ≤ 40 |
|-------|-----|-------------|
| S235 | 235 | 225 |
| S275 | 275 | 265 |
| S355 | 355 | 345 |

## Tabella A.3b — Rm (MPa min–max)

Fascia **≥ 3 mm** (a 3 mm vale 470–630 su S355, **non** la fascia sotto i 3 mm). Diverso da EN 10210-1 (lì a 3 mm vale ≤3 = 510–680).

| Grado | <3 | 3–40 |
|-------|------|------|
| S235 | 360–510 | 360–510 |
| S275 | 430–580 | 410–560 |
| S355 | 510–680 | 470–630 |

## Tabella A.3c — A min (%)

| Grado | ≤40 |
|-------|-----|
| S235 | 24 |
| S275 | 20 |
| S355 | 20 |

## Tabella A.3d — KV min (J)

| Grado | T (°C) | min J | Nota |
|-------|--------|-------|------|
| S235JRH | +20 | 27 | solo Opzione 1.3 |
| S275J0H / S355J0H | 0 | 27 | |
| S275J2H / S355J2H | −20 | 27 | |
| S355K2H | −20 | 40 | |

## Tabella B.1 — Chimica heat, feedstock N (% max), spessore ≤ 40 mm

Deox: **GF**. S275/S355 = quality steel (QS); S460 = special steel (SS). C di S355NLH è **0,18**. C di S460NH/NLH è **0,20** (non 0,22). V di S275N* è **0,05**.

| Grado | N. | C | Si | Mn | P | S | Nb | V | Al tot min | Ti | Cr | Ni | Mo | Cu | N |
|-------|-----|---|----|----|---|---|----|---|------------|----|----|----|----|----|---|
| S275NH | 1.0493 | 0,20 | 0,40 | 0,50–1,40 | 0,035 | 0,030 | 0,050 | 0,05 | 0,020 | 0,03 | 0,30 | 0,30 | 0,10 | 0,35 | 0,015 |
| S275NLH | 1.0497 | 0,20 | 0,40 | 0,50–1,40 | 0,030 | 0,025 | 0,050 | 0,05 | 0,020 | 0,03 | 0,30 | 0,30 | 0,10 | 0,35 | 0,015 |
| S355NH | 1.0539 | 0,20 | 0,50 | 0,90–1,65 | 0,035 | 0,030 | 0,050 | 0,12 | 0,020 | 0,03 | 0,30 | 0,50 | 0,10 | 0,35 | 0,015 |
| S355NLH | 1.0549 | 0,18 | 0,50 | 0,90–1,65 | 0,030 | 0,025 | 0,050 | 0,12 | 0,020 | 0,03 | 0,30 | 0,50 | 0,10 | 0,35 | 0,015 |
| S460NH | 1.8953 | 0,20 | 0,60 | 1,00–1,70 | 0,035 | 0,030 | 0,050 | 0,20 | 0,020 | 0,03 | 0,30 | 0,80 | 0,10 | 0,70 | 0,025 |
| S460NLH | 1.8956 | 0,20 | 0,60 | 1,00–1,70 | 0,030 | 0,025 | 0,050 | 0,20 | 0,020 | 0,03 | 0,30 | 0,80 | 0,10 | 0,70 | 0,025 |

## Tabella B.2 — Chimica heat, feedstock M (% max), spessore ≤ 40 mm

Deox: **GF**, tutti special steel (SS). Nel PDF questa tabella **non** ha colonne Cr/Cu.

| Grado | N. | C | Si | Mn | P | S | Nb | V | Al tot min | Ti | Ni | Mo | N |
|-------|-----|---|----|----|---|---|----|---|------------|----|----|----|---|
| S275MH | 1.8843 | 0,13 | 0,50 | 1,50 | 0,035 | 0,030 | 0,050 | 0,08 | 0,020 | 0,050 | 0,30 | 0,20 | 0,020 |
| S275MLH | 1.8844 | 0,13 | 0,50 | 1,50 | 0,030 | 0,025 | 0,050 | 0,08 | 0,020 | 0,050 | 0,30 | 0,20 | 0,020 |
| S355MH | 1.8845 | 0,14 | 0,50 | 1,50 | 0,035 | 0,030 | 0,050 | 0,10 | 0,020 | 0,050 | 0,30 | 0,20 | 0,020 |
| S355MLH | 1.8846 | 0,14 | 0,50 | 1,50 | 0,030 | 0,025 | 0,050 | 0,10 | 0,020 | 0,050 | 0,30 | 0,20 | 0,020 |
| S420MH | 1.8847 | 0,16 | 0,50 | 1,70 | 0,035 | 0,030 | 0,050 | 0,12 | 0,020 | 0,050 | 0,30 | 0,20 | 0,020 |
| S420MLH | 1.8848 | 0,16 | 0,50 | 1,70 | 0,030 | 0,025 | 0,050 | 0,12 | 0,020 | 0,050 | 0,30 | 0,20 | 0,020 |
| S460MH | 1.8849 | 0,16 | 0,60 | 1,70 | 0,035 | 0,030 | 0,050 | 0,12 | 0,020 | 0,050 | 0,30 | 0,20 | 0,025 |
| S460MLH | 1.8850 | 0,16 | 0,60 | 1,70 | 0,030 | 0,025 | 0,050 | 0,12 | 0,020 | 0,050 | 0,30 | 0,20 | 0,025 |

## Tabella B.3 — CEV max (heat), spessore ≤ 40 mm

| Grado | ≤40 |
|-------|-----|
| S275NH / NLH | 0,40 |
| S275MH / MLH | 0,34 |
| S355NH / NLH | 0,43 |
| S355MH / MLH | 0,39 |
| S420MH / MLH | 0,43 |
| S460NH / NLH | 0,53 |
| S460MH / MLH | 0,46 |

## Tabella B.4 — Meccaniche feedstock N, spessore ≤ 40 mm

Rm è **un solo intervallo** per t ≤ 40 mm (niente spezzatura a 16 mm).

| Grado | ReH ≤16 | ReH 16–40 | Rm ≤40 | A % | KV |
|-------|---------|-----------|--------|-----|----|
| S275NH | 275 | 265 | 370–510 | 24 | 40 J a −20 °C |
| S275NLH | 275 | 265 | 370–510 | 24 | 27 J a −50 °C |
| S355NH | 355 | 345 | 470–630 | 22 | 40 J a −20 °C |
| S355NLH | 355 | 345 | 470–630 | 22 | 27 J a −50 °C |
| S460NH | 460 | 440 | 540–720 | 17 | 40 J a −20 °C |
| S460NLH | 460 | 440 | 540–720 | 17 | 27 J a −50 °C |

## Tabella B.5 — Meccaniche feedstock M, spessore ≤ 40 mm

| Grado | ReH ≤16 | ReH 16–40 | Rm ≤40 | A % | KV |
|-------|---------|-----------|--------|-----|----|
| S275MH | 275 | 265 | 360–510 | 24 | 40 J a −20 °C |
| S275MLH | 275 | 265 | 360–510 | 24 | 27 J a −50 °C |
| S355MH | 355 | 345 | 450–610 | 22 | 40 J a −20 °C |
| S355MLH | 355 | 345 | 450–610 | 22 | 27 J a −50 °C |
| S420MH | 420 | 400 | 500–660 | 19 | 40 J a −20 °C |
| S420MLH | 420 | 400 | 500–660 | 19 | 27 J a −50 °C |
| S460MH | 460 | 440 | 530–720 | 17 | 40 J a −20 °C |
| S460MLH | 460 | 440 | 530–720 | 17 | 27 J a −50 °C |

## Cosa non seedare (GAP onesto)

- EN 10219-2 (tolleranze/dimensioni)
- Analisi di prodotto (Tab. 1 scostamenti: non è A.1)
- Opzione 1.3 (KV su JR) e altre opzioni d’ordine: MC-3 tratta come skip se non risultano dal 3.1
- S420NH / S420NLH (assenti da Annex B di questa edizione)

## Prompt / chiavi (ISO-3 e MC)

| Chiave | Esempio |
|--------|---------|
| `material_standard` | `EN 10219-1` (anche «UNI EN 10219», «EN 10219») |
| `steel_designation` | S355J2H, S355MH, S355MLH |
| `product_form` | `tube` \| `hollow_section` |
