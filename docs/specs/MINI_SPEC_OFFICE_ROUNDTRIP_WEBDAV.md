# Mini-spec — Office Round-trip Editing (WebDAV/Helper)

> Stato: **approvata per Sprint rapido (PoC)**  
> Target iniziale: **Windows + Microsoft Office desktop con licenze attive**  
> Strategia: **infrastruttura nostra** (niente dipendenze commerciali obbligatorie)

---

## 1) Obiettivo prodotto

Consentire all'utente SGQ di:

1. cliccare un documento (`.docx` / `.xlsx`) dal portale;
2. aprirlo direttamente in Word/Excel desktop;
3. salvare in Office;
4. ritrovare il file aggiornato sul server con tracciabilita' (utente, ora, versione).

---

## 2) Scope Sprint (PoC robusto)

### In scope
- Apertura da frontend con Office URI Scheme:
  - `ms-word:ofe|u|<url-https-firmata>`
  - `ms-excel:ofe|u|<url-https-firmata>`
- Endpoint backend per generare link WebDAV firmati e a scadenza breve.
- Endpoint WebDAV minimi: `GET`, `PUT`, `PROPFIND`, `LOCK`, `UNLOCK`.
- Isolamento multi-tenant (`organization_id`) e controllo permessi su ogni richiesta.
- Log operazioni (open/edit/save) con utente e documento.

### Fuori scope (fase successiva)
- Integrazione Microsoft 365/SharePoint.
- Co-authoring real-time multi-utente avanzato.
- Tool desktop helper completo (watch process, retry locale, sync offline esteso).

---

## 3) Architettura tecnica proposta

## 3.1 Frontend (React)

Nuovo componente `OfficeEditor` (o azione in Document Browser):

- Chiama `POST /documents/:id/webdav-link`.
- Riceve:
  - `webdav_url` (https, firmata, breve TTL),
  - `office_scheme_word`,
  - `office_scheme_excel`,
  - `expires_at`.
- Esegue redirect verso lo scheme Office corretto.
- Fallback esplicito:
  - se apertura Office fallisce, mostra "Scarica file / Ricarica nuova versione".

## 3.2 Backend (Node su Linux)

Modulo dedicato `webdav`:

- `POST /documents/:id/webdav-link` (REST auth JWT):
  - valida accesso documento (tenant + ruolo),
  - genera token `dt` firmato (scope `webdav_edit`),
  - ritorna URL WebDAV firmata.

- `GET/PUT/PROPFIND/LOCK/UNLOCK /webdav/:orgId/:docId/:filename`
  - valida `dt` o credenziale sessione equivalente,
  - risolve path fisico solo dentro root consentita,
  - blocca path traversal,
  - applica lock/versioning.

Storage iniziale:
- root server dedicata, es. `/var/www/sgq-backend/data/documents/`.
- mapping DB documento -> path fisico + metadati versione.

---

## 4) Sicurezza (obbligatoria)

- Niente JWT applicativo "lungo" in query.
- Token `dt`:
  - TTL 5–15 minuti,
  - scope limitato a singolo `doc_id` + `org_id` + `user_id`,
  - opzionale one-use per operazioni sensibili.
- HTTPS obbligatorio (certificato valido).
- CORS:
  - configurazione stretta su API browser;
  - no `Access-Control-Allow-Origin: *` con credenziali.
- Audit log:
  - `OPEN`, `LOCK`, `PUT`, `UNLOCK`,
  - `user_id`, `org_id`, `doc_id`, timestamp, esito.

---

## 5) Concorrenza e versioning

- Lock esclusivo per documento (TTL server-side).
- Salvataggio (`PUT`) con incremento revisione:
  - `revision_number`,
  - `updated_by`,
  - `updated_at`.
- Se lock perso/scaduto: errore esplicito e richiesta riapertura documento.

---

## 6) Infrastruttura Windows (Trusted Sites)

Per ridurre blocchi Office:

- Dominio app/API in **Siti attendibili** (`Internet Options` o policy GPO).
- Office desktop autenticato e aggiornato.
- Verifica policy aziendale su apertura URI scheme (`ms-word:`/`ms-excel:`).

Checklist IT minima per cliente pilota:
- [ ] Word/Excel desktop installati e attivati.
- [ ] Browser predefinito consente passaggio a Office app.
- [ ] Dominio SGQ in Trusted Sites.
- [ ] Nessun proxy/firewall blocca metodi WebDAV (`PROPFIND`, `LOCK`, `UNLOCK`).

---

## 7) Piano implementazione rapido (2 sprint)

### Sprint A — PoC funzionale
- Backend: endpoint `webdav-link` + WebDAV read/write base.
- Frontend: pulsante "Apri in Word/Excel (beta)".
- Test manuali su 2 utenti Windows.

### Sprint B — Hardening
- Lock robusto + versioning DB.
- Log/audit completi.
- Error handling e fallback UX.
- Smoke test su file reali cliente.

---

## 8) Criteri di accettazione (DoD)

- Apertura Word/Excel da UI con un click (utente autorizzato).
- Salvataggio in Office visibile lato server entro pochi secondi.
- Un secondo utente vede lock/errore coerente (niente overwrite silenzioso).
- Nessun token sensibile persistente in URL oltre TTL.
- Tracciabilita' versione documento disponibile in UI o log.

---

## 9) Decisione architetturale corrente

Per il target PMI:
- **Scelta corrente**: infrastruttura nostra (`WebDAV`/helper custom).
- **Evoluzione futura**: connettore Microsoft 365 opzionale quando il prodotto e il parco clienti saranno maturi.
