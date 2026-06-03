# DEPUTYTASK — Albero documentale per-azienda (org QS 1002)

**Stato:** TEST OK (migrazione + deploy VPS 03/06/2026)  
**PR:** [#90](https://github.com/qsstudio241/sistema-gestione-iso9001/pull/90)

## Completato

| Step | Esito |
|------|-------|
| Migrazione DB org 1002 (15 aziende, albero condiviso archiviato) | ✅ |
| SAVECO: 15 radici dopo cleanup folder obsoleti | ✅ |
| API albero filtro stretto `company_id` | ✅ deploy VPS |
| Test Jest `documentTreeCompanyScope` | ✅ 4/4 |

## Uso operativo (Camellini)

1. Registro documenti → tab **Albero**
2. **Ambito** = nome cliente (es. SAVECO, RIVIAL) — non «tutto lo studio»
3. Hard refresh PWA (Ctrl+Shift+R) se l’albero sembra vecchio

## Smoke utente

Ambito SAVECO e RIVIAL: **15 cartelle** radice, **nessun duplicato** (es. una sola DOCUMENTAZIONE INTERNA).
