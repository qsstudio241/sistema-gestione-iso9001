# DEPUTYTASK2 — Chiarezza "Licenze moduli per studio" (badge + campo piano abbonamento)

**Stato:** CHIUSO — TEST OK (S1 + S2 implementati)
**Priorità:** P2 — chiarezza UI segnalata dal committente (11/08/2026), nessun bug funzionale bloccante
**Branch base:** `main`
**Creato da:** Lead 11/08/2026
**Chiuso da:** Deputy 11/08/2026 — vedi esito sotto

> **Allineamento Git (autonomo)**: prima di leggere questo brief eseguire `git fetch origin main` e `git pull origin main` (o partire da `origin/main` aggiornato). **Non** chiedere al committente di farlo.

---

## Contesto (leggere prima)

Il committente, guardando la pagina "Gestione utenti" → sezione "Licenze moduli per studio" (`app/src/components/UsersAdminPage.jsx`), ha notato due incoerenze visive. Non sono bug bloccanti (nessun dato è a rischio), ma generano confusione — vanno chiarite con fix minimi, senza toccare la logica di licensing esistente né il provisioning nuovo studio (PR #382/#384, già mergiate o in review separata).

**File coinvolto**: solo `app/src/components/UsersAdminPage.jsx` (+ eventualmente `.css` per lo stile del badge/hint) e il relativo test `app/src/tests/usersAdminPage.test.jsx`. Nessun file backend, nessuna migrazione.

## Cosa NON toccare

- `backend/src/services/moduleLicense.service.js` / `app/src/utils/licenseUtils.js` (logica di licensing runtime — invariata).
- `createAuditorOrg` / `inviteFirstStudioAdmin` (PR #382/#384) — non fanno parte di questo brief.
- Il campo `subscription_plan` resta **non collegato** a nessuna logica di gating moduli — questo brief lo rende solo più chiaro all'utente, non lo attiva.

---

## Slice S1 — Badge "Tutti i moduli" coerente anche per elenchi espliciti equivalenti

**Comportamento attuale (bug di chiarezza)**: il badge "Tutti i moduli (default)" (riga ~920-923 di `UsersAdminPage.jsx`) compare **solo** quando `licensed_modules` è `NULL` nel DB. Gli studi **Mason** ed **ERAM** hanno invece un array esplicito che, verificato in produzione (11/08/2026), contiene già tutti i 15 moduli attuali (incluso `cnd`, aggiunto in PR #380) — quindi hanno **lo stesso accesso effettivo** di uno studio "default", ma non mostrano alcun badge. Al.project e QS_Studio (licensed_modules `NULL`) mostrano il badge. Risultato: due studi con accesso identico appaiono diversi in UI, confondendo il committente/futuri admin.

**Cosa fare:**
1. Calcolare se l'elenco esplicito (`effectiveMods` quando non è `null`) contiene **tutti** i key di `ALL_MODULE_KEYS` (confronto per uguaglianza di insieme, non solo lunghezza — usare `Set`).
2. Se sì: mostrare comunque un badge equivalente, ma **senza** la parola "(default)" (perché non è il valore NULL non toccato, è una scelta esplicita salvata) — es. testo `"Tutti i moduli"` con classe CSS leggermente diversa (es. `org-license-badge full` invece di `default`) per permettere in futuro una distinzione visiva se utile, oppure riusare la stessa classe `default` se si preferisce trattarli come visivamente identici (decisione a discrezione del deputy, purché documentata nel commit — nessuna preferenza forte dal Lead, l'importante è che il badge compaia in entrambi i casi).
3. Non toccare la logica di `useDefault` esistente (continua a controllare se i checkbox partono tutti spuntati) — questo è solo un secondo controllo per la visualizzazione del badge.

**DoD:** Vitest — nuovo caso che monta la pagina con un `auditorOrgs` mock dove uno studio ha `licensed_modules` esplicito ma completo (tutti i 15 key) e verifica che il badge compaia comunque; un test esistente con elenco esplicito **parziale** deve continuare a NON mostrare alcun badge (nessuna regressione). `npm run build` OK.

---

## Slice S2 — Nota di chiarezza sotto "Piano abbonamento" nel form "Nuovo studio"

**Comportamento attuale (bug di chiarezza)**: nel form "+ Nuovo studio" (righe ~875-895), il menu a tendina "Piano abbonamento" (Standard/Premium/Trial) è l'unico altro campo oltre ai dati anagrafici. Il committente si aspetta ragionevolmente che scegliere un piano determini i moduli abilitati — verificato nel codice (backend e frontend): **non è così**, `subscription_plan` è salvato in `auditor_orgs.subscription_plan` ma **nessuna** logica lo legge per decidere quali moduli attivare. Ogni nuovo studio nasce sempre con tutti i moduli attivi, indipendentemente dal piano scelto; i moduli si personalizzano solo con le checkbox nella riga dello studio, dopo la creazione.

**Cosa fare:**
1. Aggiungere una riga di testo esplicativo subito sotto il `<select>` "Piano abbonamento" (stesso punto dove già esiste il paragrafo `form-hint` con "Il nuovo studio nasce con tutti i moduli abilitati...", righe ~888-891) — o integrare in quel paragrafo esistente — che chiarisca: *"Il piano abbonamento è un'etichetta informativa (es. per fatturazione futura): oggi non modifica quali moduli sono attivi."*
2. Testo esatto a discrezione del deputy, purché il messaggio sia chiaro, breve, e non tecnico (il committente ha competenze tecniche limitate — vedi tono richiesto in `AGENTS.md`).
3. Riuso della classe `form-hint` già presente, nessun nuovo stile.

**DoD:** Vitest — verificare che il testo (o una sua sottostringa stabile) sia presente quando il form "Nuovo studio" è aperto. `npm run build` OK.

---

## Fuori scope di questo brief

- Collegare realmente `subscription_plan` a un set di moduli predefiniti (decisione di prodotto, non richiesta ora).
- Qualsiasi modifica al provisioning nuovo studio o all'invito primo admin (PR #382/#384).

---

## Verifica chiusura

Alla fine di ogni slice: TEST OK (Vitest mirati + build `app`) oppure FIX NON APPLICABILI con motivo.

---

## Esito (Deputy, 11/08/2026) — TEST OK

**S1** — Aggiunto un secondo controllo `isFullExplicit` (confronto per insieme con `Set`/`every`, non solo lunghezza) accanto a `useDefault` esistente (non toccato). Quando l'elenco esplicito contiene tutti i 15 `ALL_MODULE_KEYS`, compare un badge equivalente con classe `org-license-badge full` (nuova, CSS analogo a `.default` ma colore verde per distinguerla in futuro se utile) e testo `"Tutti i moduli"` (senza `"(default)"`, perché è una scelta esplicita salvata, non il valore NULL non toccato). Un elenco esplicito parziale continua a non mostrare alcun badge (verificato con nuovo test di non-regressione).

**S2** — Integrato il paragrafo `form-hint` già esistente sotto il `<select>` "Piano abbonamento" con una frase aggiuntiva: *"Il piano abbonamento è solo un'etichetta informativa (es. per fatturazione futura): oggi non modifica quali moduli sono attivi."* Nessun nuovo stile, riuso della classe esistente.

**Test**: 3 nuovi casi in `app/src/tests/usersAdminPage.test.jsx` (describe `DEPUTYTASK2: chiarezza licenze studio`) — badge su elenco esplicito completo, nessun badge su elenco esplicito parziale, nota informativa visibile nel form. Suite completa `NODE_ENV=test npm run test:run`: 147 file / 1057 test verdi (nessuna regressione). `npm run build`: OK.

**File toccati**: `app/src/components/UsersAdminPage.jsx`, `app/src/components/UsersAdminPage.css`, `app/src/tests/usersAdminPage.test.jsx`, questo brief.

---

## Comando deputy (dopo push di questo brief su `origin/main`)

```
Leggi docs/agent-tasks/DEPUTYTASK2.md ed eseguilo. Chiudi con TEST OK o FIX NON APPLICABILI.
```

Il deputy allinea Git da solo all'avvio (`git fetch` / `git pull origin main`).
