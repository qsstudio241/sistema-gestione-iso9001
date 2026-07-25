# ISO 13916:2025 — Temperature di saldatura (riferimento operativo SGQ)

> **Uso**: ingest WPS/WPQR, campi `preheat_temp` / `interpass_temp` (e note libro saldatura `preheat_c` / `interpass_c`).  
> **Fonte**: estratto operativo da ISO 13916:2025 (misura Tp / Ti / Tm). Testo digitalizzato in `docs/Normative/Normative NORMA_00013_ UNI EN ISO 13916_2025 Rev. 0.md`.  
> **Codice**: `app/src/data/weldingTemperatures13916.js` (mirror backend) — **solo regole/prompt**, non un catalogo di simboli tipo gas 14175.  
> **Piano slice**: RC-9 in `docs/agent-tasks/PLAN_INGEST_REFERENCE_CATALOGS.md`.

## Scopo

Definisce **come misurare** (punto, tempo, attrezzatura) e **come designare** le temperature di:

| Simbolo | Nome | Significato operativo |
|---------|------|------------------------|
| **Tp** | Preheating temperature | Temperatura pezzo in zona saldatura **subito prima** di qualsiasi operazione di saldatura. Di solito **minimo**; spesso uguale al minimo interpass. |
| **Ti** | Interpass temperature | In saldatura multi-passata: temperatura su cordone/metallo adiacente **subito prima** della passata successiva. Di solito **massimo**. |
| **Tm** | Preheat maintenance temperature | Temperatura **minima** da mantenere in zona saldatura se la saldatura è **interrotta**. |

**Fuori scope**: temperature di PWHT (post weld heat treatment) — non coperti da questa norma.

**Rapporto con ISO 3834**: citata in ISO 3834-5 tra i documenti di riferimento per controlli in corso d'opera; completa i campi temperatura già presenti in WPS/WPQR/libro saldatura senza sostituire i requisiti di sistema 3834.

## Regole per l'estrazione AI

| Campo SGQ | Regola |
|-----------|--------|
| `preheat_temp` | Valore Tp da WPS/certificato (es. `100`, `min 100 °C`, `Tp 155`). Preferire numero + unità se presenti; altrimenti stringa fedele al documento. |
| `interpass_temp` | Valore Ti (spesso `max 250 °C` o range `130/160`). Non confondere con Tp. |
| Preheat maintenance (Tm) | Non c'è colonna dedicata oggi: se presente, mettere in note / `warnings` o appendere a `preheat_temp` solo se il testo lo lega esplicitamente al preriscaldo. |
| Unità | Default °C (norma). Se °F, segnalare in warnings. |
| Designazione ISO 13916 | Formato tipo `Temperature ISO 13916:2025 Tp 155 — CT` → estrarre **155** come Tp e codice attrezzatura **CT**. |
| PWHT | Ignorare per questi campi (altra norma / altro campo `pwht`). |

## Attrezzatura di misura (codici §4.3)

| Codice | Significato |
|--------|-------------|
| TS | Materiali termosensibili (matite/vernici) |
| CT | Termometro a contatto |
| TE | Termocoppia |
| TB | Dispositivi ottici/elettrici senza contatto |

Taratura/verifica: rinvio a **ISO 17662** (bibliografia).

## Punto e tempo di misura (sintesi §4)

- Spessore **t ≤ 50 mm**: misura di regola sulla faccia verso il saldatore; se calore centrato sul cianfrino, distanza **A = 4 × t** (max 50 mm) dal bordo longitudinale della preparazione.
- Spessore **> 50 mm**: temperatura richiesta nel parent metal per almeno **75 mm** (o accordo diverso) dalla preparazione; preferire faccia opposta a quella riscaldata; tempo di equalizzazione ~ **2 min ogni 25 mm** di spessore.
- **Ti**: misurare sul metallo di saldatura o parent metal immediatamente adiacente, **subito prima** della passata successiva.
- **Tm**: monitorare durante l'interruzione se specificata.

*(Dettaglio figure butt/T-joint: consultare copia integrale; nel MD grezzo le formule A/t sono a tratti spezzate.)*

## Esempi di designazione (§6)

| Caso | Designazione |
|------|----------------|
| Tp 155 °C, un rilievo, termometro contatto | `Temperature ISO 13916:2025 Tp 155 — CT` |
| Ti tra 130 e 160 °C (più rilievi), termocoppia | `Temperature ISO 13916:2025 Ti 130/160 — TE` |

## Riferimenti incrociati

- ISO 3834-5 — elenco documenti / controlli (cita ISO 13916)
- ISO 15614-1 / WPS — parametri essenziali temperatura
- ISO 17662 — taratura attrezzature di saldatura
- Campi UI: `WeldingProceduresPage` (`preheat_temp`, `interpass_temp`), libro saldatura (`preheat_c`, `interpass_c`)
