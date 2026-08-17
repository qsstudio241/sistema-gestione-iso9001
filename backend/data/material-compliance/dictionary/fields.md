---
kb: material-compliance
kind: dictionary
source: EN 10168:2004 / UNI EN 10168:2005
updated: 2026-08-16
---

# Dizionario campi certificato

Chiavi canoniche per estrazione AI e Rule Engine. Dettaglio e commenti norma: [`docs/reference/EN-10168-layout-certificato.md`](../../../docs/reference/EN-10168-layout-certificato.md).

`material_role`: `base` (lamiere, profili, tubi) oppure `filler` (filo, elettrodo, flusso). Stesso certificato EN 10204; sull’apporto B07 è di solito il **lotto**, non la colata. ISO 14341 classifica il filo (WPS/WPQR e campo `filler_designation`); **non** fornisce soglie 3.1 di lotto da seedare.

| key | en10168 | sinonimi (certificato / capitolato) |
|-----|---------|-------------------------------------|
| material_role | — | base / filler, materiale di base, materiale d'apporto, consumabile, filler metal |
| inspection_document_type | A02 | 3.1, 3.2, 2.1, 2.2, MTC, mill test, Abnahmeprüfzeugnis, 3.1.B |
| certificate_no | A03 | Cert.N°, document number, n. certificato |
| manufacturer_works | A01 | mill, acciaieria, Herstellerwerk, produttore filo |
| purchaser | A06 | customer, consignee, committente |
| purchaser_order_no | A07 | customer order, n. ordine, DDT (ponte) |
| product_form | B01 | plate, tube, section, lamiera; se filler: wire, electrode, flux, filo, elettrodo, flusso |
| steel_designation | B02 | grade, steel name, S355J2 (solo base) |
| filler_designation | — | ISO 14341, G 42 4 M21 3Si1, ER70S-6 (solo apporto) |
| filler_standard | — | ISO 14341, ISO 2560, ISO 17632, ISO 14174 |
| delivery_condition | B04 | N, QT, AR, normalized, as rolled |
| heat_or_lot_no | B07 | heat, cast, colata, lot, batch, lotto |
| heat_no | B07 | alias di heat_or_lot_no (prompt) |
| dimensions | B09-B11 | thk, Ø, length, spessore |
| actual_mass | B13 | weight, kg |
| ReH | C11 | yield, Rp0.2, snervamento, YS |
| Rm | C12 | tensile, UTS, resistenza |
| A | C13 | elongation, allungamento, A% |
| KV | C40-C43 | impact, Charpy, resilienza, J |
| hardness | C30-C32 | HV, HB, HRC |
| chemistry | C71-C92 | C, Mn, P, S, Ceq, ladle/check |
| CEV | C99 o extra | Ceq, carbon equivalent |
| ndt | D02-D50 | UT, PT, MT, RT |
| validated_by | Z02 | inspection representative |
