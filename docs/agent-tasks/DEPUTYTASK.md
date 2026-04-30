# DEPUTYTASK — T3: Frontend event-based per save_responses (feature flag)

> **Quando lanciare**: ~07/05/2026 (dopo 1 settimana stabilità T2 in produzione)
> **Prerequisito**: T2 in prod ✅ (30/04/2026) — endpoint POST/GET /audits/:uuid/events operativo
> **Riferimento architetturale**: `docs/adr/ADR-008-event-sourcing-sync.md` (sezione T3)
>
> **Segreti necessari** (già configurati): `SGQ_SSH_KEY_B64`, `SGQ_SUDO_PASSWORD`
> **Migrazioni DB**: nessuna — T3 è solo frontend + feature flag

---

## Obiettivo

Ogni risposta checklist (click su C/NC/OSS/OM/NA/NV) genera un evento atomico
`response_set` con `idempotency_key` univoco e lo invia a `POST /audits/:uuid/events`.

**Il vecchio `save_responses` (bulk) rimane attivo** — T3 aggiunge un percorso parallelo
controllato da feature flag. Nessun utente vede differenze finché il flag non viene attivato.

---

## Feature flag

**Nome variabile**: `VITE_SYNC_MODE`
**Valori**: `legacy` (default, comportamento attuale) | `events` (nuovo percorso T3)
**Come attivare**: Netlify → Site configuration → Environment variables → `VITE_SYNC_MODE=events`
**Rollback**: cambiare a `VITE_SYNC_MODE=legacy` su Netlify → zero deploy necessario

---

## Step 1 — Aggiungi generazione idempotency_key in syncService

In `app/src/services/syncService.js`, aggiungi una funzione helper:

```javascript
/**
 * Genera idempotency_key deterministica per un evento risposta.
 * Stessa coppia (auditUuid, questionId, timestamp_minuto) → stessa chiave.
 * Garantisce che lo stesso evento non venga inserito due volte.
 */
generateResponseEventKey(auditUuid, questionId) {
    const minute = Math.floor(Date.now() / 60000); // granularità 1 minuto
    const raw = `${auditUuid}:${questionId}:${minute}`;
    // Versione semplice senza crypto (browser compatibile)
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    // Formato UUID v4-like da hash + timestamp per unicità
    const ts = Date.now().toString(16).padStart(12, '0');
    const h = Math.abs(hash).toString(16).padStart(8, '0');
    return `${ts.slice(0,8)}-${ts.slice(8,12)}-4${h.slice(0,3)}-8${h.slice(3,6)}-${h.slice(6)}${ts}`.slice(0, 36);
}
```

---

## Step 2 — Aggiungi metodo enqueueResponseEvent in syncService

```javascript
/**
 * Accoda un evento response_set per il nuovo percorso event-based (T3).
 * Usato solo se VITE_SYNC_MODE === 'events'.
 * @param {string} auditUuid
 * @param {number} questionId
 * @param {string} conformityStatus - 'C'|'NC'|'OSS'|'OM'|'NA'|'NV'|null
 * @param {string|null} notes
 */
async enqueueResponseEvent(auditUuid, questionId, conformityStatus, notes = null) {
    const idempotencyKey = this.generateResponseEventKey(auditUuid, questionId);
    const event = {
        event_type: conformityStatus ? 'response_set' : 'response_cleared',
        field_path: `responses.${questionId}`,
        new_value: conformityStatus
            ? JSON.stringify({ conformity_status: conformityStatus, notes })
            : null,
        client_ts: new Date().toISOString(),
        client_ts_offset_ms: 0,
        idempotency_key: idempotencyKey,
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
    };
    return this.enqueue('send_audit_event', { auditUuid, event });
}
```

---

## Step 3 — Aggiungi handler 'send_audit_event' in processQueue

Nel metodo `syncItem` di `syncService.js`, aggiungi il caso:

```javascript
case 'send_audit_event':
    return await this.syncSendAuditEvent(payload);
```

E il metodo:

```javascript
async syncSendAuditEvent(payload) {
    const { auditUuid, event } = payload;
    try {
        await apiService.post(`/audits/${auditUuid}/events`, { events: [event] });
        return { sent: true };
    } catch (error) {
        // 207 con skipped = idempotency già presente → ok, non è un errore
        if (error?.status === 207) return { sent: true, skipped: true };
        throw error;
    }
}
```

---

## Step 4 — Integra in StorageContext (percorso events)

In `app/src/contexts/StorageContext.jsx`, nella funzione che gestisce il cambio risposta
(cerca il punto dove viene chiamato `updateCurrentAudit` con la nuova risposta),
aggiungi dopo l'aggiornamento locale:

```javascript
// Percorso event-based (T3): attivo solo con VITE_SYNC_MODE=events
if (import.meta.env.VITE_SYNC_MODE === 'events' && question.questionId) {
    syncService.enqueueResponseEvent(
        auditUuid,
        question.questionId,
        newStatus,
        question.notes ?? null
    ).catch(() => {});
}
```

Individua il punto esatto leggendo il codice — cerca `conformity_status` o `status.*C\|NC\|OSS`
in `StorageContext.jsx` o nel componente `ChecklistModule`/`Dashboard` che gestisce il click.

---

## Step 5 — Test L1

Crea `app/src/tests/syncService.eventBased.test.js`:

Casi da coprire:
- `enqueueResponseEvent` con status 'C' → tipo `send_audit_event`, `event_type: 'response_set'`
- `enqueueResponseEvent` con status null → `event_type: 'response_cleared'`
- Stessa coppia (auditUuid, questionId) entro 1 minuto → stessa `idempotency_key`
- Coppie diverse → `idempotency_key` diverse

Esegui: `cd app && NODE_ENV=test npm run test:run`

---

## Step 6 — Commit e push

```bash
git add app/src/services/syncService.js app/src/contexts/StorageContext.jsx \
        app/src/tests/syncService.eventBased.test.js
git commit -m "feat(sync): T3 — percorso event-based per save_responses (feature flag VITE_SYNC_MODE)

- syncService: generateResponseEventKey, enqueueResponseEvent, syncSendAuditEvent
- StorageContext: fork percorso events vs legacy su VITE_SYNC_MODE
- Test L1: N/N green

Backward compatible: VITE_SYNC_MODE=legacy (default) = comportamento invariato.
Attivare con VITE_SYNC_MODE=events su Netlify."
git push -u origin main
```

---

## Step 7 — Deploy VPS (solo server.js se modificato)

Se `server.js` non è stato toccato, **nessun deploy VPS necessario** — T3 è solo frontend.
Verifica con `git diff HEAD~1 backend/` — se vuoto, skip deploy.

---

## Step 8 — Verifica Netlify

Dopo il push, attendere che Netlify completi il build (~2 min).
**Non attivare** `VITE_SYNC_MODE=events` ancora — il flag resta `legacy` in produzione.
Il smoke test L3 umano (con flag attivo) viene pianificato separatamente dal product owner.

---

## Definition of Done

- [ ] `generateResponseEventKey` e `enqueueResponseEvent` in `syncService.js`
- [ ] Handler `send_audit_event` in `processQueue`
- [ ] Fork `VITE_SYNC_MODE` in `StorageContext`
- [ ] Test L1 tutti verdi (inclusi nuovi `syncService.eventBased.test.js`)
- [ ] Build Vite OK (0 errori)
- [ ] `VITE_SYNC_MODE=legacy` (default) — comportamento produzione invariato
- [ ] Aggiorna roadmap: T3 ✅ (o ⏳ se smoke L3 umano ancora da fare)

Chiudi con **TEST OK** o **FIX NON APPLICABILI** elencando l'esito di ogni step.
