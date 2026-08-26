# Backlog norme mancanti (piattaforma)

> **Fonte unica** delle lacune documentali da richiedere al committente o da digitalizzare.
> Distinto dal Registro Documenti cliente (`document_registry`): qui si traccia solo ciò che serve agli **agenti di sviluppo** e al seed `norm_requirements` / skill.
>
> Aggiornare dopo ogni `pdf-to-json` o richiesta HITL. Stati: `da_richiedere` | `pdf_ricevuto` | `digitalizzata` | `parcheggio`.

## Come usare

1. Slice **norm-touching** senza Markdown utile → aggiungere/aggiornare riga qui + blocco «Richiesta norma» (vedi `HANDOFF_TEMPLATE.md`).
2. PDF arrivato → `pdf_ricevuto` → skill `pdf-to-json` → `digitalizzata` + seed VPS se è norma SGQ a clausole.
3. Non inventare soglie/clausole per righe ancora `da_richiedere` / `parcheggio`.

## Backlog

| Codice / titolo | Impatto modulo | Stato | Priorità | Note |
|-----------------|----------------|-------|----------|------|
| ISO **14555**:2025 (arc stud welding / prigionieri) | WPQR Stud Welding (Mason) | `digitalizzata` | P0 | `NORMA_00033` MD+JSON (26/08/2026); PDF **non** in Git. STUD-1 = campi senza range; STUD-3 = range da MD (non inventare). Qualità: ~161 clausole; revisione pagina 20 (Nota tecnica pymupdf) |
| Quaderno Linea Guida **1090** | Contesto EN 1090 / carpenteria | `da_richiedere` | P1 | `Quaderni/Quaderno_2_Linea_Guida_1090.txt` = **0 byte** — rigenerare da PDF |
| ISO **2560** (elettrodi rivestiti) | Material Compliance apporto | `da_richiedere` | P1 | Soglie 3.1 lotto; senza MD → skip Rule Engine |
| ISO **17632** (filo animato) | Material Compliance apporto | `da_richiedere` | P1 | Idem |
| ISO **14174** (flussi) | Material Compliance apporto | `da_richiedere` | P2 | Idem |
| ISO **9712** (testo integrale) | CND / qualifiche NDT (CND-2) | `da_richiedere` | P1 | In repo solo estratto `docs/reference/ISO_9712_2022_NDT_QUALIFICATION.md`; PDF storico rimosso da Git |
| ISO **19011:2018** | Audit / metodologia | `da_richiedere` | P2 | Nessun `.md` in `docs/Normative/`; PDF era fuori Git |
| EN **10025-3/4/5/6** | MC fine grain / weathering | `parcheggio` | P2 | Traccia MC; non bloccano MVP lamiere 10025-2 |
| Leggi settoriali oltre D.Lgs. **81**/ **152** | Conformità legislativa / ADR-018 | `parcheggio` | P2 | Seed 81/152 già in piattaforma; settoriali = HITL |

## Chiusure recenti (non riaprire)

| Codice | Stato | Data | Dove |
|--------|-------|------|------|
| ISO 3834-2:2021 | `digitalizzata` | 25/08/2026 | `NORMA_00029` + seed VPS `ISO_3834_2_2021` |
| ISO 3834-4:2021 | `digitalizzata` | 25/08/2026 | `NORMA_00030` + seed VPS `ISO_3834_4_2021` |
| ISO 14555:2025 | `digitalizzata` | 26/08/2026 | `NORMA_00033` MD+JSON; seed VPS + estratto range = STUD-3 |

## Inventari collegati (non duplicare il dettaglio)

| Ambito | Path |
|--------|------|
| Material Compliance | [`MATERIAL-COMPLIANCE-NORME-SINTESI.md`](MATERIAL-COMPLIANCE-NORME-SINTESI.md) § Inventario |
| Catalogo Normative + Quaderni | [`.cursor/skills/gap-analysis-normativa/reference.md`](../../.cursor/skills/gap-analysis-normativa/reference.md) |
| PDF fuori Git | [`docs/Normative/SOURCE_PDF_INDEX.md`](../Normative/SOURCE_PDF_INDEX.md) |
| Piano fedeltà normativa | [`PLAN_NORM_FIDELITY_SLICES.md`](../agent-tasks/PLAN_NORM_FIDELITY_SLICES.md) |
