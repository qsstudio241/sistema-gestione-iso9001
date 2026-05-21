# DEPUTYTASK — Doc Fase 1 (completato 2026-05-21)

**Stato:** TEST OK — eseguito da Cloud Agent su branch `cursor/docs-fase1-indice-toc-adc9`.

## Obiettivo

Ottimizzazione documentazione **Fase 1** (senza spostare file): navigazione e classificazione.

## Checklist eseguita

- [x] TOC in cima a `docs/GUIDA_CONSOLIDATA.md` (sezioni A–F, piano qualità, ADR-008)
- [x] `docs/INDICE_DOCUMENTAZIONE.md` — tag `attivo` | `storico` | `agente` | `normativa` | `tooling`
- [x] `docs/sessions/` — README aggiornato; stub redirect su `COMMIT_MESSAGES`
- [x] `docs/archive/sessions/COMMIT_MESSAGES.md` — contenuto storico (da `sessions/`)
- [x] `docs/adr/README.md` — ADR-008/009/010 + nota numerazione duplicata

## Non in scope (Fase 2)

- Cartelle `how-to/`, `reference/`
- Hub deploy unico
- Rinumerazione file ADR

## Verifica

```bash
# Link stub sessions
test -f docs/archive/sessions/COMMIT_MESSAGES.md
grep -q "Indice rapido" docs/GUIDA_CONSOLIDATA.md
grep -q "ADR-008" docs/adr/README.md
```

## Chiusura deputy

`TEST OK` — solo markdown, nessun test L1 richiesto.
