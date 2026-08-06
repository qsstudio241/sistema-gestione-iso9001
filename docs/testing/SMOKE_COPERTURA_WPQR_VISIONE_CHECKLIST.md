# Smoke test — Copertura WPQR + idoneità visiva (checklist cliente)

> **Destinatari**: Studio Mason / Mauro Franciosi (ERAM)  
> **Durata stimata**: ~15 minuti  
> **Ambiente**: produzione `https://systemgest.netlify.app`  
> **Account**: tenant ERAM (non admin di prova Al.project)  
> **Data smoke**: _______________ **Eseguito da**: _______________

---

## Messaggio di contesto (da leggere al cliente)

Prima succedeva spesso questo:

- si parlava di WPS senza partire dalle **estensioni reali delle WPQR**;
- l’assistente poteva rispondere senza avere tutti i dati del giunto;
- l’idoneità visiva (certificato oculistico) non entrava nel riesame;
- acuità e Ishihara sembravano due documenti separati.

Ora il sistema:

1. usa **un solo** certificato oculistico (acuità + Ishihara);
2. **segnala** se manca per chi fa NDT;
3. nell’assistente **chiede i dati mancanti**, poi fa il check sulle WPQR;
4. nel riesame mostra due box **informativi** (WPQR + visione) sotto i saldatori, **senza bloccare** il flusso.

---

## Checklist operativa

### Passo 1 — Qualifiche: idoneità visiva

| # | Azione | Esito atteso | OK |
|---|--------|--------------|----|
| 1.1 | Login con utente ERAM | Accesso riuscito | ☐ |
| 1.2 | Menu **Qualifiche** → tab **NDT** | Elenco patentini NDT | ☐ |
| 1.3 | Osservare il banner in alto | Banner arancione se manca/scaduta idoneità visiva (es. La Forgia) | ☐ |
| 1.4 | Tab **Salute mansione** → **Nuova qualifica** | Un solo tipo: *Certificato idoneità visiva (acuità + Ishihara)* | ☐ |

**Note**: ________________________________________________

### Passo 2 — Assistente: domande prima del verdetto

| # | Azione | Esito atteso | OK |
|---|--------|--------------|----|
| 2.1 | Aprire **AskAi / Assistente** | Chat disponibile | ☐ |
| 2.2 | Scrivere: *Genera una WPS FW, spessori 10 mm e 5 mm, usando le WPQR* (senza materiali) | L’assistente **chiede** i materiali/gruppi (non li inventa) | ☐ |
| 2.3 | Rispondere: *S355 e S235* (o gruppi 1.2 e 1.1) | Risposta con esito **coperto / parziale / non realizzabile** | ☐ |
| 2.4 | (Opzionale) Chip Mason completo FW S355/S235 | Check diretto se i dati bastano | ☐ |

**Note**: ________________________________________________

### Passo 3 — Riesame: copertura informativa (non bloccante)

| # | Azione | Esito atteso | OK |
|---|--------|--------------|----|
| 3.1 | Aprire un **Riesame** (anche in bozza) | Caso aperto; sezione *Copertura saldatori e idoneità* visibile | ☐ |
| 3.2 | Espandere **Verifica Copertura Saldatori** → scegliere commessa → **Verifica** | Tabella saldatori ↔ WPS (semaforo) | ☐ |
| 3.3 | Leggere il box **Copertura procedure (WPQR)** | Esito giunto: coperto / dati incompleti / estensioni | ☐ |
| 3.4 | Leggere il box **Idoneità visiva (NDT/VT)** | Gap visione (es. La Forgia) se certificato assente | ☐ |
| 3.5 | Verificare che i box dicano *solo informativo* | Il semaforo saldatori **non** diventa rosso solo per la visione | ☐ |

**Note**: ________________________________________________

### Passo 4 — (Opzionale) Chiusura cerchio visione

| # | Azione | Esito atteso | OK |
|---|--------|--------------|----|
| 4.1 | Caricare un *Certificato idoneità visiva* per la persona in gap, scadenza futura | Record in Salute mansione | ☐ |
| 4.2 | Riaprire NDT e riesame | Gap visione ridotto o assente | ☐ |

---

## Domande di chiusura al cliente

| Domanda | Risposta (sì/no/note) |
|---------|------------------------|
| Hai capito subito chi non ha l’idoneità visiva a posto? | |
| L’assistente ha inventato i materiali mancanti? | |
| Il riesame ti ha bloccato per la visione? | |
| Ti è chiaro che la procedura dipende dalle WPQR? | |

---

## Esito complessivo

- [ ] **TEST OK** — tutte le voci critiche (1.x, 2.x, 3.x) verificate  
- [ ] **PARZIALE** — dettagli: _________________________________  
- [ ] **KO** — dettagli: _________________________________

**Firma / data**: _______________________ / _______________

---

*Documento operativo ProgettoISO — smoke P3/P4/P5 (WPQR + visione). Versione 04/08/2026.*
