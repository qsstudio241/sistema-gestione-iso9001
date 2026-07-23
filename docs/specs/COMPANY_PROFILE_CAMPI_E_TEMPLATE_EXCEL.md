# Profilo azienda — catalogo campi e template Excel

> Spec S0 per [ADR-018](../adr/ADR-018-company-profile-conformita-legislativa.md).  
> Encoding: UTF-8 senza BOM. Accenti italiani corretti.

---

## 1. Principio

| Livello | Recupero web/ufficiale | Inserimento consulente / studio |
|---------|------------------------|----------------------------------|
| **A** | Sì (visura / Registro Imprese / Excel da visura) | Possibile override |
| **B** | Quasi mai | **Obbligatorio** se si vuole scremare obblighi 14001/45001 |

La scheda minima `companies` resta invariata. Questi campi vivono in `company_profile`.

---

## 2. Livello A — anagrafica recuperabile

| Chiave campo (`field_key`) | Label UI | Tipo | Colonna Excel (header canonico) | Fonte tipica | Note |
|----------------------------|----------|------|----------------------------------|--------------|------|
| `legal_name` | Ragione sociale | string | `ragione_sociale` | Visura | Sync opzionale → `companies.name` |
| `vat_number` | Partita IVA | string(11) | `partita_iva` | Visura / AE | Sync opzionale → `companies.vat_number` |
| `fiscal_code` | Codice fiscale | string | `codice_fiscale` | Visura | Spesso = P.IVA per società |
| `ateco_primary` | ATECO primario | string | `ateco_primario` | Visura / REA | Es. `25.11.00` |
| `ateco_primary_desc` | Descrizione ATECO | string | `ateco_primario_desc` | Visura | |
| `ateco_secondary` | ATECO secondari | string | `ateco_secondari` | Visura | Lista separata da `;` |
| `legal_form` | Forma giuridica | string | `forma_giuridica` | Visura | SRL, SPA, … |
| `rea_number` | N. REA | string | `rea` | Visura | |
| `cciaa` | CCIAA / provincia RI | string | `cciaa` | Visura | |
| `pec` | PEC | string | `pec` | Visura | |
| `registered_street` | Sede legale — via | string | `sede_via` | Visura | |
| `registered_cap` | Sede legale — CAP | string | `sede_cap` | Visura | |
| `registered_city` | Sede legale — comune | string | `sede_comune` | Visura | |
| `registered_province` | Sede legale — provincia | string(2) | `sede_provincia` | Visura | |
| `registered_country` | Nazione | string | `sede_nazione` | Visura | Default `IT` |
| `local_units_summary` | Unità locali (sintesi) | string/text | `unita_locali` | Visura | Testo libero o elenco |
| `share_capital` | Capitale sociale | string | `capitale_sociale` | Visura / bilancio | Opzionale |
| `company_status` | Stato impresa | string | `stato_impresa` | Visura | attiva, liquidazione, … |
| `legal_rep_name` | Legale rappresentante | string | `legale_rappresentante` | Visura | |
| `website` | Sito web | string | `sito_web` | Manuale / web | Opzionale |
| `phone` | Telefono | string | `telefono` | Manuale | Opzionale |
| `email` | Email | string | `email` | Manuale | Distinta da PEC |

**Minimo consigliato livello A** (per considerare il profilo “avviato”):  
`vat_number` + `ateco_primary` + sede (`registered_city` o indirizzo strutturato).

---

## 3. Livello B — profilo operativo (solo inserimento umano / Excel studio)

### 3.1 Trasversale / dimensione

| Chiave | Label UI | Tipo | Colonna Excel | Norma tipica |
|--------|----------|------|---------------|--------------|
| `employees_count` | N. lavoratori | int | `n_lavoratori` | 45001 / 81/08 |
| `employees_note` | Nota organico | string | `nota_organico` | stagionali, somministrati |
| `sites_count` | N. sedi operative | int | `n_sedi_operative` | entrambe |
| `sites_description` | Descrizione sedi / layout | text | `descrizione_sedi` | entrambe |
| `collective_agreement` | CCNL applicato | string | `ccnl` | 45001 (altri requisiti) |
| `has_construction_sites` | Opera in cantieri / Tit. IV | bit/bool | `cantieri` | 45001 |
| `has_third_party_sites` | Lavora presso terzi | bit/bool | `presso_terzi` | 45001 |

### 3.2 SSL (45001 / D.Lgs. 81/2008)

| Chiave | Label UI | Tipo | Colonna Excel |
|--------|----------|------|---------------|
| `has_dvr` | DVR presente | bit | `ha_dvr` |
| `rspp_name` | RSPP | string | `rspp` |
| `competent_doctor` | Medico competente | string | `medico_competente` |
| `rls_name` | RLS | string | `rls` |
| `inail_pat` | PAT INAIL | string | `pat_inail` |
| `main_hazards` | Pericoli principali | text | `pericoli_principali` |
| `uses_hazardous_agents` | Agenti chimici/biologici/cancerogeni | bit | `agenti_pericolosi` |
| `has_work_at_height` | Lavoro in quota | bit | `lavoro_quota` |
| `has_night_shifts` | Lavoro notturno / turni | bit | `turni_notturni` |
| `equipment_summary` | Attrezzature rilevanti | text | `attrezzature` |

### 3.3 Ambiente (14001 / D.Lgs. 152/2006)

| Chiave | Label UI | Tipo | Colonna Excel |
|--------|----------|------|---------------|
| `produces_waste` | Produce rifiuti | bit | `produce_rifiuti` |
| `waste_cer_summary` | CER / tipologie rifiuti | text | `rifiuti_cer` |
| `waste_broker_or_self` | Gestione rifiuti (iscrizione albo / terzi) | string | `gestione_rifiuti` |
| `has_water_discharge` | Scarichi idrici | bit | `scarichi_idrici` |
| `has_air_emissions` | Emissioni in atmosfera | bit | `emissioni_aria` |
| `has_aua_or_aia` | Autorizzazione AUA/AIA | bit | `aua_aia` |
| `authorization_refs` | Riferimenti autorizzazioni | text | `rif_autorizzazioni` |
| `uses_fuel_plants` | Impianti combustione / caldaie | bit | `impianti_combustione` |
| `energy_carriers` | Vettori energetici | string | `vettori_energetici` |
| `noise_external_relevant` | Rumore esterno rilevante | bit | `rumore_esterno` |
| `hazardous_substances_env` | Sostanze pericolose (ambiente) | text | `sostanze_ambiente` |

### 3.4 Meta

| Chiave | Label UI | Tipo | Colonna Excel | Note |
|--------|----------|------|---------------|------|
| `notes` | Note consulente | text | `note` | Libere |
| `profile_version_label` | Etichetta revisione | string | `revisione` | Es. `2026-07` |

Valori booleani in Excel: `si` / `no` / `1` / `0` / `true` / `false` (normalizzati dal detector).

---

## 4. Formato file template

### 4.1 Foglio unico `ProfiloAzienda`

- Riga 1: header canonici (colonne sopra).  
- Riga 2: una riga dati per l'azienda corrente (import da scheda dettaglio).  
- Encoding: UTF-8; Excel `.xlsx` generato con SheetJS (`xlsx`).

### 4.2 Import multi-azienda (S3+ / opzionale S4)

Stesso foglio con **N righe**; chiave di matching:

1. `partita_iva` (preferita)  
2. altrimenti `codice_fiscale`  
3. altrimenti skip + errore in report

Solo aziende già presenti nello scope studio vengono aggiornate (niente auto-create silenzioso in v1).

### 4.3 Mapping flessibile (come scadenziario)

Il detector riconosce sinonimi header, es.:

| Canonico | Sinonimi accettati |
|----------|-------------------|
| `partita_iva` | `p.iva`, `piva`, `vat`, `partita iva` |
| `ateco_primario` | `ateco`, `codice ateco`, `ateco primario` |
| `n_lavoratori` | `dipendenti`, `addetti`, `numero dipendenti` |
| `sede_comune` | `comune`, `città`, `citta` |

Confidence: alta se P.IVA + almeno 3 campi A; media se solo ATECO + sede; bassa → non proporre import automatico.

---

## 5. Provenance (`source_meta`)

Esempio JSON salvato su riga profilo:

```json
{
  "ateco_primary": { "source": "excel", "at": "2026-07-23T20:00:00Z", "file": "anagrafica_cliente.xlsx" },
  "employees_count": { "source": "manual", "at": "2026-07-23T20:05:00Z", "user_id": 12 },
  "pec": { "source": "registry", "at": "2026-08-01T10:00:00Z", "provider": "infocamere" }
}
```

Valori ammessi `source`: `manual` | `excel` | `registry`.

---

## 6. Completeness (indicatore UI)

Pesi suggeriti (S4):

| Blocco | Peso | Campi chiave |
|--------|------|--------------|
| Identità A | 30% | `vat_number`, `legal_name`, `ateco_primary` |
| Sede A | 15% | `registered_city` + (`registered_street` o indirizzo) |
| Dimensione B | 20% | `employees_count`, `sites_count` |
| SSL B | 15% | `has_dvr` + uno tra RSPP/RLS/medici |
| Ambiente B | 20% | almeno 2 flag rifiuti/scarichi/emissioni/autorizzazioni |

Badge in scheda: incompleto (sotto 50) / parziale (50–79) / pronto (80 o più).  
Non blocca audit; avvisa solo i flussi di conformità legislativa.

---

## 7. RBAC e gate (richiamo)

- Lettura/scrittura profilo: stesso modello `companyAccess` della scheda azienda.  
- Visibilità feature: `hasSalLegalConformityCapability`.  
- Import Excel: solo utenti con write + capability.
