# ADR-023 — Knowledge Base requisiti materiali (Markdown versionato)

> **Stato**: Proposto — 05/08/2026  
> **Spec**: [MODULO_MATERIAL_COMPLIANCE_AI.md](../specs/MODULO_MATERIAL_COMPLIANCE_AI.md)  
> **Correlati**: ADR-020, ADR-021, ADR-022

---

## Contesto e problema

Norme, requisiti cliente e criteri interni cambiano nel tempo. Se le soglie vivono nel codice (`if (cliente === 'FASSI')`), ogni aggiornamento richiede deploy e rischia regressioni. Serve una **fonte di conoscenza** aggiornabile e versionata, separata dalla logica del Rule Engine.

---

## Decisione

### Path canonico (repo)

```text
knowledge/material-compliance/
├── standards/          # EN 10204, EN 10025-2, …
├── customers/          # FASSI, CLAAS, CNH, VOLVO, …
├── companies/          # requisiti interni per slug azienda (es. companies/tecnove/)
├── dictionary/         # chiavi canoniche + sinonimi (ReH, Rm, KV, CEV, …)
└── lessons/            # pattern da correzioni operatore (post-MVP)
```

> **Nota**: niente cartella fissa `tecnove/` in root KB — Tecnove (o altra azienda) va sotto `companies/<slug>/`, multi-tenant-friendly.

### Formato

- Markdown (+ frontmatter YAML opzionale) **versionato in Git**.
- Il Rule Engine carica un **snapshot** (path + commit/hash o versione file) al momento della verifica e lo persiste sull’esito (riproducibilità).

### Contenuti iniziali (MVP contenuti)

| Area | Priorità MVP |
|------|----------------|
| `dictionary/` chiavi + sinonimi base | Obbligatorio prima del Rule Engine |
| `standards/` dalle **norme consegnate dal committente** (HITL 16/08) | Obbligatorio — non seed inventato |
| Altre EN 10025-4 / 10149 / 10210 / 10219 | Appena disponibili |
| 1–2 `customers/` di pilota | Consigliato |
| `companies/<slug>/` pilota | Consigliato |
| `lessons/` | Dopo feedback loop (post-MVP) |

### Principio

Aggiornare una soglia o un sinonimo = **PR sul Markdown**, non modifica al sorgente del motore (salvo nuovi tipi di regola non previsti).

---

## Cosa NON fare

- Hardcodare clienti o soglie nel service Rule Engine.
- Caricare la KB da storage non versionato senza hash salvato sull’esito.
- Esporre editing KB multi-tenant in UI prima del pilota (MVP: file in repo / path server controllato).

---

## Conseguenze

| + | − |
|---|---|
| Aggiornamento requisiti senza deploy app | Serve disciplina PR/review sui file KB |
| Audit: si sa quale versione regole ha deciso | Parser KB da testare (L1) |
