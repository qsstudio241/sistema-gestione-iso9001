# ADR-021 — Gerarchia requisiti materiali (più restrittivo vince)

> **Stato**: Proposto — 05/08/2026  
> **Spec**: [MODULO_MATERIAL_COMPLIANCE_AI.md](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **Correlati**: ADR-020, ADR-022, ADR-023

---

## Contesto e problema

La conformità di una materia prima **non** dipende da una sola norma. Concorrono certificato EN 10204, norma materiale, ordine di acquisto, requisiti cliente e criteri interni azienda. Senza una gerarchia esplicita, il Rule Engine e l’UI produrrebbero esiti ambigui o non auditabili.

---

## Decisione

### Ordine di applicazione (dal generale allo specifico)

```text
EN 10204 (tipo certificato)
    ↓
Norma materiale (es. EN 10025-2)
    ↓
Ordine di acquisto / specifica fornitura
    ↓
Requisiti cliente (KB customers/)
    ↓
Requisiti interni azienda (KB companies/<slug>/)
```

### Regola fondamentale

Per ogni grandezza confrontata (ReH, Rm, KV, CEV, …) **prevale il requisito più restrittivo** tra i livelli applicabili.  
L’esito finale del certificato è **NON CONFORME** se **anche un solo** livello applicabile fallisce (dopo aggregazione del più restrittivo sul campo).

### Output obbligatorio per ogni check

| Campo | Significato |
|-------|-------------|
| `requirement_key` | Es. `ReH`, `CEV` |
| `source_level` | `en10204` \| `material_std` \| `po` \| `customer` \| `company` |
| `source_ref` | Id/path KB o n. ordine |
| `required` | Valore/limite richiesto (già il più restrittivo applicato) |
| `actual` | Valore dal certificato (post-normalizzazione) |
| `result` | `pass` \| `fail` \| `skip` |
| `explanation` | Testo breve per audit |

### Esempio

| Livello | ReH min |
|---------|---------|
| Norma EN 10025-2 | ≥ 355 MPa |
| Cliente FASSI | ≥ 390 MPa |
| Interno azienda | ≥ 400 MPa |
| Valore certificato | 395 MPa |

Esiti: norma OK, cliente OK, interno **fail** → esito certificato **NON CONFORME**, con riga check che cita `source_level=company`.

---

## Cosa NON fare

- Far decidere all’AI quale livello “conta di più”.
- Nascondere l’origine del requisito nell’UI di revisione.
- Codificare soglie cliente nel Rule Engine: solo lettura da KB / DB requisiti.

---

## Conseguenze

Ogni valutazione è spiegabile in audit (ISO 9001 §7.5 / ISO 3834).  
Il Rule Engine resta deterministico a parità di input JSON + snapshot requisiti usati.
