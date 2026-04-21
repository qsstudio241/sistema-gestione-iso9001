# Task deputy — 5 anomalie audit ISO 9001 (Camellini, aprile 2026)

> Creato: 21 aprile 2026  
> Priorità: alta (in uso su audit reale cliente)  
> Ambito: UI checklist ISO 9001, accordion, StorageContext, RBAC lista audit.

---

## 1) Contesto e segnalazioni cliente

Cliente Camellini riporta 5 anomalie su audit ISO 9001 in corso:

1. **Sottocapitoli mancanti** nella checklist: 8.5.1, 8.4.2, 8.4.3, 8.7.1 ecc. non presenti.
2. **Cancellazione testo** sporadica (durante la scrittura, dopo pochi secondi il testo appena digitato sparisce; riprendendo a scrivere il problema scompare).
3. **Freccia accordion** da spostare a sinistra del titolo in tutti i pannelli espandibili.
4. **Riordinamento capitoli finali**: 11 deve essere "Esito dell'Audit" (riepilogo NC/OSS/OM); 12 "Conclusioni" (campo testo) separato e solo alla fine.
5. **Audit sparisce dal menu a tendina** dopo aver generato il report Word (non lo trova più nel dropdown).

---

## 2) Analisi causa radice (già investigata dal lead)

### Bug 1 — Sottocapitoli mancanti

Il template statico `app/src/data/checklistTemplates.js` (fallback frontend) e le 35 domande DB (migration-010) coprono solo alcuni sotto-paragrafi del capitolo 8:

| Mancante | Testo norma ISO 9001:2015 |
|---|---|
| 8.4.2 | Tipo e grado di controllo dei processi/prodotti/servizi forniti esternamente |
| 8.4.3 | Informazioni ai fornitori esterni |
| 8.5.1 | Controllo della produzione e dell'erogazione del servizio |
| 8.5.4 | Conservazione degli output |
| 8.7.1 | Gestione degli output non conformi (azioni da intraprendere) |
| 8.1 | Pianificazione e controllo operativi |

**Fix richiesto:**
- Aggiungere le domande mancanti al template statico in `checklistTemplates.js` (sezione `clause8`).
- Creare migrazione DB `database/migrations/041_add_iso9001_missing_questions.sql` con le nuove domande per `standard_id=1`, `section_code='clause8'`, `questionId` progressivi dopo il 121.
- **Attenzione**: le domande aggiunte al DB appaiono come NOT_ANSWERED negli audit esistenti (no perdita dati).
- Aggiornare il template statico JS in parallelo affinché il fallback sia allineato al DB.
- **Non modificare** le domande esistenti (87-121): solo aggiungere.

### Bug 2 — Cancellazione testo (race condition)

**Causa**: race condition tra:
1. L'utente digita nelle note di una domanda.
2. `fetchAndApplyServerResponses` (chiamata da `AuditAccordionLayout.useEffect([currentAudit?.id])` con `setTimeout 150ms`) scarica le risposte dal server e le sovrascrive con `updateCurrentAudit`.
3. Il polling `reconcileAuditsFromServer` (ogni 45s in `StorageContext`) fa lo stesso.

**Scenario concreto**: l'utente apre un nuovo accordion sub-section (cambio stato locale ma non cambio `currentAudit?.id`), poi scrive. Ma se c'è qualcosa che fa cambiare `currentAudit?.id` (es. l'audit viene rimontato dopo un reconcile), `fetchAndApplyServerResponses` viene richiamata e sovrascrive le note non ancora sincronizzate.

**Fix richiesto:**
- In `fetchAndApplyServerResponses` (`StorageContext.jsx`): prima di sovrascrivere una risposta, verificare se il testo locale (nella checklist corrente in memoria) è **più recente** di quello server (confronto `lastModified` o timestamp). Se locale > server, NON sovrascrivere le note.
- In alternativa (più semplice e sicura): in `fetchAndApplyServerResponses`, per il campo `notes`, applicare il dato del server **solo se** il campo locale è vuoto/NOT_ANSWERED. Non sovrascrivere note già digitate.
- Aggiungere un **debounce o guard** affinché `fetchAndApplyServerResponses` non venga rieseguita se è già stata eseguita nell'ultimo minuto per lo stesso `numericAuditId`.

**File**: `app/src/contexts/StorageContext.jsx` (funzione `fetchAndApplyServerResponses`, righe 1674-1731) e `app/src/components/AuditAccordionLayout.jsx` (useEffect con `setTimeout` a riga 144-148).

### Bug 3 — Freccia accordion a sinistra

**Causa**: in `AuditAccordionLayout.jsx`, il `span.section-arrow` / `span.subsection-arrow` è posizionato come ultimo figlio del button (quindi estrema destra del flex container). Il cliente vuole la freccia a sinistra del titolo.

**Fix richiesto:**
- Spostare lo `span.section-arrow` **prima** di `span.section-title` (e analogamente per `span.subsection-arrow` prima di `span.subsection-title`).
- Aggiornare `AuditAccordionLayout.css` se necessario per il layout flex.
- Il simbolo corrente `▶` (chiuso) / `▼` (aperto) può restare, oppure cambiarlo in `›` / `⌄` (più moderno). Scegliere quello che si allinea meglio al design esistente.
- Applicare la stessa modifica strutturale a **tutte** le sezioni e sotto-sezioni (`general-data`, `objective`, `pending-issues`, `cert-findings`, tutti i `STANDARDS_CONFIG`, `custom-checklist`, `checklist`, `outcome`, `export`).

**File**: `app/src/components/AuditAccordionLayout.jsx`, `app/src/components/AuditAccordionLayout.css`.

### Bug 4 — Riordino capitoli 11 ESITO / 12 CONCLUSIONI

**Causa**: `AuditOutcomeSection` contiene in un'unica sezione sia il riepilogo numerico NC/OSS/OM sia il campo di testo "Conclusioni". Il cliente vuole due capitoli distinti:
- **11 – ESITO DELL'AUDIT**: solo riepilogo rilievi emersi (tabella con conteggi NC, OSS, OM, conformità) — dato calcolato automaticamente dalla checklist.
- **12 – CONCLUSIONI**: campo di testo libero per le conclusioni finali (già in `auditOutcome.conclusions`).

**Fix richiesto:**
- Spezzare la sezione "Esito Audit" in `AuditAccordionLayout.jsx` in **due sezioni** distinte:
  1. Sezione 11 `outcome` → mostra solo metriche calcolate (NC/OSS/OM) — rimuove il campo textarea Conclusioni.
  2. Sezione 12 `conclusions` → mostra solo il campo textarea Conclusioni.
- In `AuditOutcomeSection.jsx`: estrarre il blocco "Conclusioni" (campo textarea `conclusions`) in un componente separato o renderlo condizionale tramite una prop `showConclusions`.
- Aggiornare i label dei button accordion: `11 – ESITO DELL'AUDIT` e `12 – CONCLUSIONI`.
- Il campo `auditOutcome.conclusions` è già persistito: nessuna modifica al modello dati richiesta.
- **Ordine finale accordion**: 1 Dati Generali, 2 Checklist, 11 Esito Audit, 12 Conclusioni, [Export Report].
  - Nota: i capitoli da 3 a 10 sono i capitoli ISO (4-10 della norma) che nel layout attuale sono dentro la sezione "Checklist". Per ora questa numerazione è implicita, non c'è un bisogno di rinumerare l'accordion con etichette 3-10. Verificare con il cliente se vuole numerazione esplicita dei capitoli ISO nell'accordion (fuori scope di questo task se non richiesto esplicitamente).

**File**: `app/src/components/AuditAccordionLayout.jsx`, `app/src/components/AuditOutcomeSection.jsx`.

### Bug 5 — Audit sparisce dal menu dopo stampa (CRITICO)

**Causa radice identificata**: durante `prepareAuditForExport()` in `ExportPanel.jsx` (operazione asincrona lunga, ~3-10s di chiamate API), il polling `reconcileAuditsFromServer` (ogni 45s) in `StorageContext.jsx` può attivarsi. Nel reconcile:
1. Scarica la lista audit dal server (`fetchAllServerAudits`).
2. Se il backend RBAC (deployato 19/04/2026) non restituisce l'audit corrente per qualsiasi motivo (bug scope, timeout, paginazione), l'audit non è in `serverAudits`.
3. `filterLocalAuditsAfterServerFetch` **esclude** l'audit dalla lista locale perché ha `auditId` numerico > 0 (condizione `hasServerNumericId → return false`).
4. L'audit sparisce da `finalAudits`.
5. `setCurrentAuditId((prev) => exists ? prev : null)` → diventa `null`.
6. Al ritorno dall'export, il menu mostra "-- Seleziona un audit --" e l'audit non è visibile.

**Fix richiesti (in ordine di sicurezza):**

**Fix A (essenziale e immediato)**: In `reconcileAuditsFromServer` e `loadAuditsFromIndexedDB` dentro `StorageContext.jsx`, aggiungere una **guard** contro la perdita dell'audit correntemente selezionato. Prima di fare `setCurrentAuditId(null)`, verificare che l'audit effettivamente NON esista più nel server (e non solo che il reconcile abbia fallito o restituito lista incompleta). Soluzione: se `serverAudits.length === 0` o l'API ha restituito errore, **non** azzerare `currentAuditId`. In particolare:
```javascript
// NON fare setCurrentAuditId(null) se il server ha restituito lista vuota
// (potrebbe essere un errore API, non una lista reale)
if (finalAudits.length === 0 && serverAudits.length === 0) {
  // Server ha restituito 0 audit: probabilmente errore — mantieni stato corrente
  return { success: false, reason: "server_returned_empty_list" };
}
```

**Fix B (hardening)**: La condizione in `filterLocalAuditsAfterServerFetch` che esclude gli audit con `auditId` numerico è troppo aggressiva. Aggiungere protezione: se l'audit con `auditId` è quello **attualmente selezionato** (`currentAuditId`), non escluderlo dalla lista finale, anche se il server non lo ha restituito. Oppure: non fare mai `setCurrentAuditId(null)` durante un reconcile che avviene mentre l'utente sta lavorando sull'audit (aggiungere flag `isExporting` o verificare che `isReconcilingRef` non entri in conflitto con l'export).

**Fix C (backend investigation)**: Verificare se il backend RBAC (nuovo deploy 19/04) restituisce correttamente tutti gli audit del tenant nella risposta `GET /audits`. Eseguire smoke test diretto `curl GET /api/v1/audits` e verificare che l'audit del cliente Camellini sia presente. Se mancante → bug RBAC da correggere nel backend.

**File principali**: `app/src/contexts/StorageContext.jsx` (funzioni `reconcileAuditsFromServer` righe 634-763, `filterLocalAuditsAfterServerFetch` righe 148-186, `loadAuditsFromIndexedDB` righe 765-998). Backend: `backend/src/services/auditListRbac.service.js`, `backend/src/controllers/audit.controller.js`.

---

## 3) Vincoli non negoziabili

1. **Diff minimo**: solo i punti necessari per i 5 fix.
2. **No segreti** in codice/commit.
3. **Nessuna modifica** alle domande esistenti (question_id 87-121): solo aggiungere nuove.
4. **La migrazione DB** (bug 1) va su `database/migrations/041_*.sql` — va eseguita sul DB produzione dal committente (o tramite deploy script se già predisposto).
5. **Backend RBAC**: se il fix B richiede modifiche backend → deploy VPS con `backend/scripts/deploy-controllers-to-vps.ps1` + `sudo systemctl restart sgq-backend`.
6. Aggiornare `docs/GUIDA_CONSOLIDATA.md` solo se cambia una procedura ripetibile.

---

## 4) Perimetro tecnico atteso

### Frontend (obbligatorio)
- `app/src/data/checklistTemplates.js` — aggiunta clausole mancanti (bug 1)
- `app/src/contexts/StorageContext.jsx` — guard reconcile + fix fetchAndApplyServerResponses (bug 2, bug 5)
- `app/src/components/AuditAccordionLayout.jsx` — frecce + riordino sezioni 11/12 (bug 3, bug 4)
- `app/src/components/AuditAccordionLayout.css` — se serve per layout frecce (bug 3)
- `app/src/components/AuditOutcomeSection.jsx` — separazione metriche / conclusioni (bug 4)

### Database (bug 1)
- `database/migrations/041_add_iso9001_missing_questions.sql`

### Backend (bug 5 — solo se smoke mostra RBAC difettoso)
- `backend/src/services/auditListRbac.service.js`
- `backend/src/controllers/audit.controller.js`

---

## 5) Piano di lavoro

1. **Bug 5 prima di tutto** (è il più critico e impatta immediatamente l'operatività).
   - Aggiungere guard in `reconcileAuditsFromServer` e `filterLocalAuditsAfterServerFetch`.
   - Eseguire smoke API `GET /audits` per verificare RBAC backend.
2. **Bug 2**: fix race condition `fetchAndApplyServerResponses` (proteggere notes non ancora sincronizzate).
3. **Bug 1**: aggiungere domande mancanti al template statico JS + migrazione SQL.
4. **Bug 3**: spostare frecce a sinistra nell'accordion.
5. **Bug 4**: dividere sezione "Esito" in 11 (metriche) + 12 (conclusioni).
6. Eseguire L1 test + build.
7. Commit + push su branch `cursor/fix-audit-5-anomalie-d740`.
8. PR su `main`.

---

## 6) Criteri di accettazione

- [ ] La checklist ISO 9001 mostra 8.4.1, 8.4.2, 8.4.3, 8.5.1, 8.5.2, 8.5.3, 8.5.4, 8.5.5, 8.5.6, 8.7.1, 8.7.2.
- [ ] Scrivendo note in una domanda, il testo non scompare dopo pochi secondi.
- [ ] Le frecce nell'accordion sono visibili a sinistra del titolo in tutte le sezioni.
- [ ] L'accordion mostra "11 – ESITO DELL'AUDIT" (metriche) separato da "12 – CONCLUSIONI" (testo).
- [ ] Dopo aver generato il report Word, l'audit rimane visibile e selezionato nel menu a tendina.
- [ ] Nessuna regressione su export, sync, login, checklist 14001 esistente.

---

## 7) Smoke test obbligatorio

### L1 automatico
```bash
cd app
NODE_ENV=test npm run test:run
npm run build
```

### L3 manuale
1. Aprire un audit ISO 9001 → verificare che clausole 8.4.2, 8.4.3, 8.5.1, 8.7.1 siano presenti.
2. Scrivere testo in una nota, aspettare 60s, verificare che non scompaia.
3. Verificare frecce accordion posizionate a sinistra.
4. Verificare sezioni 11 (metriche) e 12 (conclusioni) separate.
5. Generare report Word → tornare al menu → verificare che l'audit sia ancora nel dropdown selezionato.

### Smoke backend RBAC (API)
```bash
# Verifica che GET /audits restituisca tutti gli audit del tenant
curl -s -H "Cookie: sgq_token=<token>" https://www.fr-busato.it:8443/api/v1/audits | jq '.data | length'
```

---

## 8) Regola di chiusura

Ciclo **`review → fix → smoke`** fino a esito positivo completo.

Output finale obbligatorio (uno solo):
- `TEST OK`
- `FIX NON APPLICABILI: <elenco + motivo + prossimo passo>`

---

## 9) Prompt pronto per Agents Window

```text
Leggi docs/agent-tasks/DEPUTYTASK.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```
