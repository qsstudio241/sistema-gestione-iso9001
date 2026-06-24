# DEPUTYTASK — stato al 24/06/2026

## Sessione completata — TEST OK + RILASCIO PRODUZIONE

### PR mergiata oggi (24/06/2026)
| PR | Contenuto |
|----|-----------|
| #161 | AI Know-how Studio: `content_scope`, Patrimonio Studio, indicizzazione contenuto documenti, timeout difensivo embedding |

**Dettaglio PR #161:**
- Migrazione 111: colonna `content_scope` (`client`/`studio`/`reference`) su `document_registry` + CHECK + DEFAULT + indice
- Backfill: 770 doc client, 97 reference
- Template + provisioning "Patrimonio Studio" (`studio_patrimonio_v1`) per 4 organizzazioni
- `documentTextExtractor.service.js`: estrazione testo DOCX/PDF per indicizzazione AI
- `knowledgeIndexer.service.js`: genera chunk e embedding scope-aware per document_content
- `geminiAdapter.js`: timeout difensivo 30s (AbortController) su embedding + cap 2 retry 429
- Deploy-manifest: aggiunto `documentTextExtractor.service.js`
- Test L1: 22/22 adapter (3 nuovi timeout/rate-limit), CI verde

### Stato produzione (24/06/2026)
- DB `SGQ_ISO9001`: migrazione 111 eseguita (content_scope + template)
- Backend: aggiornato PID 95408, health OK, mammoth installato
- Frontend: Netlify auto-deploy da main in corso
- Reindex: avviato per tutte le org (esecuzione lunga, embedding reale)
- Ambiente test isolato `/var/www/sgq-backend-test`: ancora attivo (dismettibile a regime)

---

## Backlog (prossime sessioni)
1. **Dismettere ambiente test isolato** `/var/www/sgq-backend-test` quando non piu' necessario
2. **Batch upload WPS** (nessun endpoint, bassa priorita')
3. **Hardening RBAC welding** (assertCompanyRead mancante, media priorita')
4. **MT/PT/UT**: sezioni parametri specifiche + template Word
5. **Foto offline**: upload asincrono per cantieri senza WiFi
