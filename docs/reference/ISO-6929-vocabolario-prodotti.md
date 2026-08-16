# ISO 6929:2013 — Vocabolario prodotti in acciaio

> **Uso**: normalizzare `product_form` (griglia MC + capitolato). Non è una norma di requisiti.  
> **Fonte**: `docs/Normative/Normative NORMA_00024_ ISO 6929_2013 Rev. 0.md` (pagina 45 = colophon vuoto).

## Scopo

Definisce i termini per stadio di fabbricazione, forma/dimensioni e aspetto. EN 10168 B01 («lamiera spessa, profilato, largo piatto, tubo, sezione cava») usa questo vocabolario.

## Forme utili al modulo (MVP)

| Chiave canonica | Termini ISO 6929 (EN) | Etichetta IT in UI |
|-----------------|----------------------|--------------------|
| `plate` | plate, sheet, wide flat, heavy plate | Lamiera / piastra |
| `strip` | hot-rolled strip, cold-rolled strip | Nastro / coil |
| `section` | heavy section, beam, channel | Profilato |
| `hollow_section` | hollow section | Sezione cava |
| `tube` | tube | Tubo |
| `bar` | bar, rod | Barra / tondo |
| `wire` | wire | Filo |
| `semi` | bloom, billet, slab | Semiprodotto |
| `ingot` | ingot | Lingotto |
| `other` | — | Altro (testo libero) |

La griglia MC HITL 16/08 usa «Piastra / tubo / profilo / lamiera»: mappare `plate` (piastra e lamiera), `tube`, `section`. `hollow_section` può stare sotto tubo o profilo in UI, nel JSON resta distinto.

## Cosa NON fare

- Catalogo esaustivo in JS: troppi termini (coating, electrical steel, mining frames). Solo le forme sopra + testo originale in `product_form_raw`.
- Usare il vocabolario come requisito di conformità.
