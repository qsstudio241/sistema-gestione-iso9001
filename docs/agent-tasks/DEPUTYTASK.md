# DEPUTYTASK — Alert qualifiche: destinatario UI (HITL)

**Stato:** APERTO  
**Aperto:** 07/09/2026 (post CM-5; priorità roadmap #2 post ISO-5b)  
**Rischio:** Medio se UI+API additiva; Alto se tocca auth/RBAC email cross-tenant  
**Piano:** roadmap § Priorità #2 · backlog «Modulo Notifiche/Alert — destinatario allerte qualifiche»  
**Dipende:** conferma HITL sotto — **non aprire codice** senza DoD chiuso

---

## Perché

Oggi il destinatario email allerte qualifiche è solo cascata in `resolveWeldingCoordinatorRecipients` (`qualificationAlert.service.js`). Il flag anagrafica «Coordinatore saldatura responsabile (primario)» autorizza la conferma semestrale, **non** gli alert. Il committente (10/08/2026) ha chiesto una sessione dedicata Notifiche/Alert.

## HITL (blocca codice)

1. Destinatario = scelta esplicita in anagrafica azienda (rubrica `notification_contacts` / personale), oppure override opzionale sopra la cascata attuale?
2. Stesso meccanismo anche per documenti/NC, o solo qualifiche in questa slice?
3. Un solo destinatario primario o lista?
4. Fallback se vuoto: tenere cascata attuale sì/no?

## DoD (dopo HITL)

- UI anagrafica: campo/selettore destinatario alert qualifiche visibile
- Servizio: usa la scelta se presente; altrimenti fallback definito
- Test L1 BE + FE; niente segreti; PR Medio + Bugbot

## File previsti (dopo HITL — bozza)

- `backend/src/services/qualificationAlert.service.js` (+ test)
- UI anagrafica / Notifiche (path da confermare: `CompanyDetailPage` vs `NotificationsSettingsPage`)
- eventuale migrazione nullable additiva se serve colonna

## Cosa NON toccare

- CONS-7 / auth offline
- ING-5 / VC-5 / Compliance Map
- SB-2 (slot `DEPUTYTASK2`)
- Scheduler cron nuovi senza conferma costo

## Note

Slice **non** eseguibile finché le 4 domande HITL non hanno risposta. Questo brief è il posto APERTO per la priorità #3; codice solo dopo DoD.
