# ISO 15613:2025 — Qualifica WPS da prova di pre-produzione (riferimento operativo SGQ)

> **Uso**: ingest WPQR/WPS, fattibilità commessa, distinguere 15613 da 15614 e da 14555.
> **Fonte**: estratto operativo da BS EN ISO 15613:2025 (identica a ISO 15613:2025, seconda edizione). Testo integrale `docs/Normative/Normative NORMA_00045_ BS EN ISO 15613_2025 Rev. 0.md` (+ `.json`). PDF **non** in Git.
> **Catalogo JS**: non previsto (procedura, non elenco di simboli).
> **Non** seed `norm_requirements` / `import-norms-from-markdown.js` (non è SGQ 4–10).

## Gate fonti (questa fetta)

```text
Fonti Markdown:
- Coperte: NORMA_00045 ISO 15613:2025; NORMA_00043 ISO 15614-1:2017+A1; NORMA_00031 ISO 15614-2:2025; NORMA_00033 ISO 14555:2025 (HITL, non rifatta qui)
- Mancanti (non bloccano): NORMA_00xxx di 14732; altre parti 15614 non digitalizzate
- Si parte su: 15613:2025
```

## Quando si usa 15613 (vs 15614)

Dall'Introduction e da ISO 15607 (citata, non ricopiata): la prova di **pre-produzione** è un metodo di qualifica della procedura quando **forma e dimensioni dei provini standard non rappresentano adeguatamente** il giunto da saldare. In quel caso si realizzano uno o più provini speciali che simulano il giunto di produzione nelle caratteristiche essenziali (es. dimensioni, vincolo, heat sink, accesso limitato).

| Situazione | Norma di metodo | Cosa non fare |
|------------|-----------------|---------------|
| Provino **standard** della serie 15614 copre geometria/accesso/vincolo | **ISO 15614-*** (parte pertinente) | Non etichettare 15613 «perché è WPQR» |
| Geometria di produzione **non** coperta dai provini 15614 (o la 15614 stessa rimanda a 15613, es. 15614-1 Level 2 su giunto/dimensioni fuori dai pezzi standard) | **ISO 15613** | Non copiare i range tabellari 15614 come se il coupon fosse standard: §8 limita al **tipo di giunto** della prova di pre-produzione |
| Range spessore/processo **dopo** la prova 15613 | «As far as technically possible» verso la parte **15614 di Tabella 2**; lo spessore si applica a **ogni componente** del giunto **e** allo spessore di saldatura (§8) | Non inventare una tabella spessori 15613: **non c'è** nel testo 2025 (le info di prova sono state rimosse per evitare conflitto con 15614 — Foreword) |

**Default Level 2** (§7.1, testo leggibile): se il riferimento di prova è **ISO 15614-1** e non è specificato altrimenti, si applica il **level 2**. Non è un livello della 15613; è il default della 15614-1 richiamato da 15613.

## Quando **non** è 14555

- **ISO 14555**: WPQR / range per **arc stud welding** (prigionieri). Già in `NORMA_00033` + estratto STUD-3-B. Questa fetta **non** la rifà.
- **ISO 15613 Scope** elenca anche *stud welding* (insieme ad arco, gas, beam, resistance, friction).
- **Tabella 2** (standard di prova) elenca parti **15614**, **non** ISO 14555.

**GAP onesto:** il testo 15613:2025 **non** definisce una riga «stud → 14555». Non inventare che 15613 sostituisca 14555, né che un WPQR stud vada letto con i range 15614. Per i prigionieri restano 14555 e i codici processo 4063 (783–786), digitalizzati in parallelo.

## Scope e processi (senza soglie)

Applicabile a: arc, gas, beam, resistance, stud, friction welding di materiali metallici (§1).

pWPS secondo la parte ISO **15609** di Tabella 1 (arco 15609-1, gas -2, EB -3, laser -4, resistance -5, laser-arc hybrid -6).

Esaminatore / examining body e prove: parte ISO **15614** di Tabella 2 (acciaio/nichel 15614-1, alluminio -2, ghise -3, Ti/Zr -5, rame -6, tube-to-tube-plate -8, hyperbaric -10, EB/laser -11, spot/seam/projection -12, upset/flash -13, laser-arc hybrid acciai/nichel -14). **15614-4 assente** anche nel testo ufficiale.

Resistance: si usano **componenti reali**; prove 15614-12 o 15614-13 «as far as technically possible»; range di qualifica **limitato al pezzo di pre-produzione provato** (§7.2, §8).

## Campi rilevanti per WPQR / WPS / fattibilità

| Campo / domanda | Cosa dice 15613 (operativo) | Non inventare |
|-----------------|----------------------------|---------------|
| Norma di qualifica procedura | ISO 15613 se la prova è di pre-produzione | Non assumere 15614 solo perché c'è un WPQR |
| Tipo di giunto | **Variabile vincolante** del range (§8): solo il tipo usato nella prova | Estensioni 15614 su altri giunti |
| Spessore | Range della 15614 di Tabella 2, applicato a **ciascun componente** e allo **spessore di saldatura** | Una sola `t` se il giunto ha spessori diversi — GAP dati ingest, non lacuna normativa |
| Level 1/2 | Solo se la prova rimanda a 15614-1; default **2** (§7.1) | Livelli 15613 inesistenti |
| Validità | Produzione dentro il range §8 | Scadenza temporale tipo 9606 — **non** nel testo letto |
| WPQR | Esiti (incl. re-test), voci WPS di Tabella 1, scostamenti da §7; firma examiner/examining body (§10) | Form Word obbligatorio: la norma chiede un modulo uniforme, non un template SGQ |
| Fattibilità commessa | Serve geometria/accesso/vincolo **fuori coupon 15614**? → pista 15613, non «manca WPQR 15614» | Soglie numeriche 15613 |

## Qualità estrazione

22 pagine; ATTENZIONE solo p. 4 (vuota). Tabelle 1–2 HITL dal testo. Annex ZA (PED) presente; edizioni ZA.2 a tratti fuse = GAP. Foreword 2025: tabelle aggiunte a §4 e §5; §7 rinvia a Tabella 2 e **cancella** le informazioni di prova per non confliggere con 15614.
