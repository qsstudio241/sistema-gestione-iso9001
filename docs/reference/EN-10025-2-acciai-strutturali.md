# EN 10025-2:2019 — Acciai strutturali non legati (soglie)

> **Uso**: Material Compliance (confronto valori sul 3.1) + ISO-3 (riconoscere grado / spessore / condizione).  
> **Fonte**: BS EN 10025-2:2019. Testo digitalizzato in `docs/Normative/Normative NORMA_00026_ EN 10025-2_2019 Rev. 0.md`.  
> **Numeri**: verificati sul testo pymupdf delle tabelle (non sulle griglie Markdown fuse). PDF **non** in Git.  
> **Non** è una norma SGQ a clausole 4–10: **non** va in `import-norms-from-markdown.js`.

## Scopo (cosa copre, cosa no)

Condizioni tecniche di fornitura per **prodotti piani e lunghi** (e semilavorati destinati a diventarlo) in acciai di qualità non legati, gradi **S185, S235, S275, S355, S460, S500, E295, E335, E360**.

**Non** copre sezioni cave strutturali né tubi → quelle soglie stanno in **EN 10210-1** (hot finished) e **EN 10219-1** (cold formed). Un certificato «S355J2H» o tubo non si valuta con questa norma.

Spessori ammessi (estratto §1):

- S460 e S500 lunghi: da 3 mm a 150 mm
- Piani qualità JR/J0/J2/K2: fino a 400 mm
- Altri gradi/qualità, piani e lunghi: fino a 250 mm

## Come si legge la designazione

Esempio: `EN 10025-2 - S355J2+N`

| Pezzo | Significato |
|-------|-------------|
| `S` | acciaio strutturale (`E` = engineering, senza KV obbligatorio) |
| `355` | ReH minimo a spessore ≤ 16 mm (MPa) |
| `JR` / `J0` / `J2` / `K2` | resilienza: 27 J a +20 / 0 / −20 °C; K2 = 40 J a −20 °C (equivalente 27 J a −30 °C, nota d Tab. 8) |
| `C` | idoneità a piega a freddo (Tab. 9) |
| `+N` / `+AR` / `+M` | normalizzato o laminato normalizzante / as-rolled / termomeccanico |

S235 e S275: JR, J0, J2. S355 e S460: anche K2. S500: solo J0. S460 e S500: **solo prodotti lunghi**.

Condizione di fornitura: se non pattuita, il fabbricante sceglie tra +AR/+N/+M (quarto plate: solo +AR o +N). Sul certificato **deve** comparire il simbolo se è richiesto un documento EN 10204 (§6.3). Le proprietà meccaniche di questa norma **non** dipendono dalla condizione.

## Quale tabella usare sul certificato

| Cosa c’è sul 3.1 | Tabella limite |
|------------------|----------------|
| Analisi di colata (heat / ladle) | Tab. 1 (chimica) + Tab. 5 (CEV) |
| Analisi di prodotto (product / check) | Tab. 3 — limiti **più larghi**; è **Opzione 2**, solo se ordinata |
| ReH, Rm, A | Tab. 6, in funzione dello **spessore nominale** |
| KV (Charpy) | Tab. 8; qualità **JR** verificata solo se richiesta all’ordine (Opzione 3) |

Se il certificato riporta entrambe le analisi, confrontare ciascuna con la sua tabella. Non inventare lo spessore: senza `dimensions` non si sceglie la colonna ReH.

Formula CEV (IIW, §7.2.3), sul heat analysis:

`CEV = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15`

## Tabella 1 — Chimica heat analysis (% max)

Colonne C: spessore ≤ 16 / > 16 ≤ 40 / > 40 mm. Si assente = non specificato come max (S235/S275).

| Grado | N. | Deox | C ≤16 | C 16–40 | C >40 | Si | Mn | P | S | N | Cu |
|-------|-----|------|-------|---------|-------|----|----|---|---|---|----|
| S235JR | 1.0038 | FN | 0,17 | 0,17 | 0,20 | — | 1,40 | 0,035 | 0,035 | 0,012 | 0,55 |
| S235J0 | 1.0114 | FN | 0,17 | 0,17 | 0,17 | — | 1,40 | 0,030 | 0,030 | 0,012 | 0,55 |
| S235J2 | 1.0117 | FF | 0,17 | 0,17 | 0,17 | — | 1,40 | 0,025 | 0,025 | — | 0,55 |
| S275JR | 1.0044 | FN | 0,21 | 0,21 | 0,22 | — | 1,50 | 0,035 | 0,035 | 0,012 | 0,55 |
| S275J0 | 1.0143 | FN | 0,18 | 0,18 | 0,18 h | — | 1,50 | 0,030 | 0,030 | 0,012 | 0,55 |
| S275J2 | 1.0145 | FF | 0,18 | 0,18 | 0,18 h | — | 1,50 | 0,025 | 0,025 | — | 0,55 |
| S355JR | 1.0045 | FN | 0,24 | 0,24 | 0,24 | 0,55 | 1,60 | 0,035 | 0,035 | 0,012 | 0,55 |
| S355J0 | 1.0553 | FN | 0,20 | 0,20 i | 0,22 | 0,55 | 1,60 | 0,030 | 0,030 | 0,012 | 0,55 |
| S355J2 | 1.0577 | FF | 0,20 | 0,20 i | 0,22 | 0,55 | 1,60 | 0,025 | 0,025 | — | 0,55 |
| S355K2 | 1.0596 | FF | 0,20 | 0,20 i | 0,22 | 0,55 | 1,60 | 0,025 | 0,025 | — | 0,55 |
| S460 JR/J0/J2/K2 | 1.0507… | FF | 0,20 | 0,20 i | 0,22 | 0,55 | 1,70 | 0,030 | 0,030 | 0,025 | 0,55 |
| S500J0 | 1.0502 | FF | 0,20 | 0,20 | 0,22 | 0,55 | 1,70 | 0,030 | 0,030 | 0,025 | 0,55 |

Note operative (non saltarle nel Rule Engine):

- **h**: spessore > 150 mm → C heat max 0,20 % (S275J0/J2).
- **i**: spessore > 30 mm → C heat max 0,22 % (S355J0/J2/K2 e S460).
- Prodotti lunghi: P e S possono essere **0,005 % più alti**.
- N max non si applica se Al totale ≥ 0,020 % (o Al acido-solubile ≥ 0,015 %) o altri leganti N; vanno citati sul certificato.
- Ni ≤ 0,42 / Cr ≤ 0,29 / Mo ≤ 0,11 (heat). S460/S500: Nb ≤ 0,05, V ≤ 0,13, Ti ≤ 0,05.
- FN = rimming non ammesso; FF = fully killed.

## Tabella 3 — Chimica product analysis (% max)

Stessa griglia, limiti più larghi. Usare **solo** se sul 3.1 c’è analisi di prodotto.

| Grado | C ≤16 | C 16–40 | C >40 | Si | Mn | P | S | N | Cu |
|-------|-------|---------|-------|----|----|---|---|---|----|
| S235JR | 0,19 | 0,19 | 0,23 | — | 1,50 | 0,045 | 0,045 | 0,014 | 0,60 |
| S235J0 | 0,19 | 0,19 | 0,19 | — | 1,50 | 0,040 | 0,040 | 0,014 | 0,60 |
| S235J2 | 0,19 | 0,19 | 0,19 | — | 1,50 | 0,035 | 0,035 | — | 0,60 |
| S275JR | 0,24 | 0,24 | 0,25 | — | 1,60 | 0,045 | 0,045 | 0,014 | 0,60 |
| S275J0 | 0,21 | 0,21 | 0,21 h | — | 1,60 | 0,040 | 0,040 | 0,014 | 0,60 |
| S275J2 | 0,21 | 0,21 | 0,21 h | — | 1,60 | 0,035 | 0,035 | — | 0,60 |
| S355JR | 0,27 | 0,27 | 0,27 | 0,60 | 1,70 | 0,045 | 0,045 | 0,014 | 0,60 |
| S355J0 | 0,23 | 0,23 i | 0,24 | 0,60 | 1,70 | 0,040 | 0,040 | 0,014 | 0,60 |
| S355J2 | 0,23 | 0,23 i | 0,24 | 0,60 | 1,70 | 0,035 | 0,035 | — | 0,60 |
| S355K2 | 0,23 | 0,23 i | 0,24 | 0,60 | 1,70 | 0,035 | 0,035 | — | 0,60 |
| S460 | 0,23 | 0,23 i | 0,24 | 0,60 | 1,80 | 0,040 | 0,040 | 0,027 | 0,60 |
| S500J0 | 0,23 | 0,23 | 0,24 | 0,60 | 1,80 | 0,040 | 0,040 | 0,027 | 0,60 |

Note product: **h** > 150 mm C = 0,22 %; **i** > 30 mm C = 0,24 %. N esente se Al tot ≥ 0,015 % (o Al ac.sol. ≥ 0,013 %). Ni/Cr/Mo max 0,47 / 0,34 / 0,14. S460/S500: Nb 0,06, V 0,15, Ti 0,06.

## Tabella 5 — CEV max (heat analysis)

Bande spessore: ≤ 30 / > 30 ≤ 40 / > 40 ≤ 150 / > 150 ≤ 250 / > 250 ≤ 400 mm.

| Gradi | ≤30 | 30–40 | 40–150 | 150–250 | 250–400 |
|-------|-----|-------|--------|---------|---------|
| S235 JR/J0/J2 | 0,35 | 0,35 | 0,38 | 0,40 | 0,40 |
| S275 JR/J0/J2 | 0,40 | 0,40 | 0,42 | 0,44 | 0,44 |
| S355 JR/J0/J2/K2 | 0,45 | 0,47 | 0,47 | 0,49 b | 0,49 |
| S460 (solo lunghi) | 0,47 | 0,49 | 0,49 | — | — |
| S500J0 (solo lunghi) | 0,49 | 0,49 | 0,49 | — | — |

**b**: prodotti lunghi S355, fascia 150–250 mm → CEV max **0,54**.  
Opzione 20 (Cu 0,25–0,40 % heat): CEV Tab. 5 **+ 0,02**. Controllo Si per zincatura (S275/S355): CEV **+ 0,02** se Si ≤ 0,04 %, **+ 0,01** se Si ≤ 0,25 %.

## Tabella 6 — ReH min e Rm (MPa), temperatura ambiente

ReH per spessore (mm): ≤16 / 16–40 / 40–63 / 63–80 / 80–100 / 100–150 / 150–200 / 200–250 / 250–400.

| Gradi | ≤16 | 16–40 | 40–63 | 63–80 | 80–100 | 100–150 | 150–200 | 200–250 | 250–400 |
|-------|-----|-------|-------|-------|--------|---------|---------|---------|---------|
| S235 | 235 | 225 | 215 | 215 | 215 | 195 | 185 | 175 | 165 |
| S275 | 275 | 265 | 255 | 245 | 235 | 225 | 215 | 205 | 195 |
| S355 | 355 | 345 | 335 | 325 | 315 | 295 | 285 | 275 | 265 |
| S460 lunghi | 460 | 440 | 420 | 400 | 390 | 390 | — | — | — |
| S500 lunghi | 500 | 480 | 460 | 450 | 450 | 450 | — | — | — |

Rm per spessore: \<3 / ≥3–100 / 100–150 / 150–250 / 250–400.

| Gradi | \<3 | ≥3–100 | 100–150 | 150–250 | 250–400 |
|-------|-----|--------|---------|---------|---------|
| S235 | 360–510 | 360–510 | 350–500 | 340–490 | 330–480 |
| S275 | 430–580 | 410–560 | 400–540 | 380–540 | 380–540 |
| S355 | 510–680 | 470–630 | 450–600 | 450–600 | 450–600 |
| S460 lunghi | — | 550–720 | 530–700 | — | — |
| S500 lunghi | — | 580–760 | 560–750 | — | — |

Direzione: lamiere/nastri/wide flats larghezza ≥ 600 mm → **trasversale (t)**; altri prodotti → **longitudinale (l)**.

Allungamento A min (L0 = 5,65 √So, spessore ≥ 3 mm) — coppia l / t:

| Gradi | 3–40 | 40–63 | 63–100 | 100–150 | 150–250 | 250–400 |
|-------|------|-------|--------|---------|---------|---------|
| S235 l/t | 26 / 24 | 25 / 23 | 24 / 22 | 22 / 22 | 21 / 21 | 21 / 21 |
| S275 l/t | 23 / 21 | 22 / 20 | 21 / 19 | 19 / 19 | 18 / 18 | 18 / 18 |
| S355 l/t | 22 / 20 | 21 / 19 | 20 / 18 | 18 / 18 | 17 / 17 | 17 / 17 |
| S460 l | 17 | 17 | 17 | 17 | — | — |
| S500 l | 15 | 15 | 15 | 15 | — | — |

Lamiere sottili \< 3 mm (L0 = 80 mm): valori in Tab. 6 conclusa del Markdown; poco usati sui 3.1 strutturali tipici — se serve un caso, rileggere quella pagina, non inventare.

Gradi E295/E335/E360/S185 (Tab. 2/4/7): chimica solo P/S/N; **non** sono il caso SxxxJR dei capitolati carpenteria. Non seedati qui (GAP onesto: usare il testo NORMA_00026 se arriva un certificato E…).

## Tabella 8 — KV2 min, provini longitudinali (J)

| Grado | T (°C) | ≤150 mm | 150–250 mm | 250–400 mm |
|-------|--------|---------|------------|------------|
| S235JR / S275JR / S355JR | +20 | 27 | 27 | 27 |
| S235J0 / S275J0 / S355J0 | 0 | 27 | 27 | 27 |
| S235J2 / S275J2 / S355J2 | −20 | 27 | 27 | 27 |
| S355K2 | −20 | 40 | 33 | 33 |
| S460JR (solo lunghi) | +20 | 27 | — | — |
| S460J0 (solo lunghi) | 0 | 27 | — | — |
| S460J2 (solo lunghi) | −20 | 27 | — | — |
| S460K2 (solo lunghi) | −20 | 40 | — | — |
| S500J0 (solo lunghi) | 0 | 27 | — | — |

S460/S500: KV solo fino a 150 mm (prodotti lunghi). Sezioni > 100 mm: valori da concordare (Opzione 28). Provini ridotti: minimo in proporzione all’area. JR senza KV sul certificato **non** è NC di norma, salvo Opzione 3 / PO.

## Regole per l’estrazione AI (capitolato e 3.1)

| Campo | Regola |
|-------|--------|
| `material_standard` | `EN 10025-2` (anche «UNI EN 10025-2», «EN 10025 parte 2»). Non confondere con 10025-3/4/5/6 né con 10219/10210 |
| `steel_designation` | Nome o numero (S355J2 o 1.0577). Tenere `+N`/`+AR`/`+M` e suffisso `C` se presenti |
| `product_form` | Se tubo / hollow section → **non** applicare queste soglie |
| `dimensions` | Spessore nominale obbligatorio per scegliere la colonna |
| ReH / Rm / A / CEV / chimica | Confrontare col **più restrittivo** tra questa norma e PO/cliente/azienda (ADR-021). Il 3.1 è prova, non requisito |

Gruppo ISO/TR 15608 (già in repo): S235 → 1.1; S275/S355 → 1.2 (Re fino a 360 MPa). S460/S500 fuori dal 1.2.

## Cosa NON fare

- Usare queste soglie su **tubi e sezioni cave** (EN 10210 / 10219).
- Trattare un 3.1 «S355J2» come conforme solo perché c’è il grado scritto: servono valori e spessore.
- Seedare Tab. 7 (E295…) o raggi di piega Tab. 11/12 nel MVP carpenteria.
- Aggiungere questa norma a `import-norms-from-markdown.js`.
