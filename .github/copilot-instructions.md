# Sistema Gestione ISO 9001 - Istruzioni per AI Coding Agents

## Panoramica del Progetto

Questo workspace contiene la documentazione del Sistema di Gestione per la Qualità (SGQ) per la conformità alla norma **UNI EN ISO 9001:2015**. Il progetto è strutturato per gestire normative, procedure, checklist di audit e materiali di riferimento (Quaderni della Qualità).

**Lingua primaria**: Italiano (terminologia tecnica conforme alla norma italiana)

## Struttura del Progetto

```
/Normative/          → Testo completo della norma UNI EN ISO 9001:2015 Rev. 0
/Quaderni/           → Guide operative e materiali di supporto:
                       - Linee guida conformità
                       - Fattori di contesto e parti interessate
                       - Risk-based thinking
                       - Approccio per processi
                       - Audit
/*.doc, *.docx       → Check-list e report di audit
```

## Contesto Normativo Essenziale

### Struttura ISO 9001:2015 (Ciclo PDCA)

La norma è organizzata secondo il ciclo Plan-Do-Check-Act:

- **Sezioni 4-6** (Plan): Contesto, Leadership, Pianificazione
- **Sezioni 7-8** (Do): Supporto, Attività operative
- **Sezione 9** (Check): Valutazione delle prestazioni
- **Sezione 10** (Act): Miglioramento

### Principi Chiave da Rispettare

1. **Approccio per processi**: Identificare input, attività, output e interazioni
2. **Risk-based thinking**: Valutare rischi e opportunità (non richiede metodologie formali)
3. **Informazioni documentate**: Termine che sostituisce "documentazione", "procedure documentate", "registrazioni"
4. **Contesto dell'organizzazione**: Fattori interni/esterni e parti interessate rilevanti

## Convenzioni Terminologiche Specifiche

**NON utilizzare terminologia generica**. Adotta questi termini conformi alla ISO 9001:2015:

| ❌ Evitare | ✅ Usare (ISO 9001:2015) |
|-----------|-------------------------|
| Documentazione, procedure, registrazioni | **Informazioni documentate** |
| Fornitore | **Fornitore esterno** |
| Prodotto | **Prodotti e servizi** |
| Ambiente di lavoro | **Ambiente per il funzionamento dei processi** |
| Preventive action | **Azioni per affrontare rischi e opportunità** (punto 6.1) |

### Modalità Verbali della Norma
- **"deve"** = requisito obbligatorio
- **"dovrebbe"** = raccomandazione
- **"può"** (may) = permesso; **"può"** (can) = possibilità/capacità

## Linee Guida per la Creazione/Modifica di Documenti

### Checklist e Report di Audit
- **Formato**: MS Word (.doc/.docx) per compatibilità con workflow esistente
- **Struttura requisiti audit**: Mappare su punti specifici ISO 9001:2015 (es. 4.4, 7.1.5, 8.5.1)
- **Terminologia conformità**: "Non conformità" (non "deviazione"), "Azioni correttive" (punto 10.2)

### Materiali di Supporto
- Consultare i **Quaderni Qualità** esistenti per allineamento stilistico
- Includere riferimenti espliciti ai punti ISO pertinenti (es. "vedere punto 4.1")
- Le note vanno indicate come "Nota:" in corsivo (stile ISO)

### Gestione Versioni
- Specificare sempre "Rev. X" nel titolo/nome file
- Indicare data di modifica in formato italiano (es. "23 settembre 2015")

## Pattern Architetturali

### Organizzazione Documentale
**Separazione netta tra**:
1. **Normative** (testi ufficiali, immutabili) → `/Normative/`
2. **Materiali operativi** (guide, quaderni) → `/Quaderni/`
3. **Strumenti attuativi** (checklist, template) → root o sottocartelle dedicate

### Riferimenti Incrociati
Quando crei documenti, utilizza questo pattern per citazioni:
```
"Come richiesto dal punto 7.5.3 della UNI EN ISO 9001:2015..."
"In conformità ai requisiti di cui al punto 8.4 (Controllo dei processi forniti dall'esterno)..."
```

## Workflow Operativi

### Audit Interno (Sezione 9.2)
1. Pianificare audit considerando: importanza processi, cambiamenti, risultati precedenti
2. Definire criteri e campo applicazione
3. Selezionare auditor garantendo obiettività
4. Riportare risultati alla direzione pertinente
5. Adottare **correzioni e azioni correttive** senza ritardo
6. Conservare informazioni documentate del programma audit e risultati

**Riferimento guida**: ISO 19011 (citata nella norma al punto 9.2)

### Gestione Non Conformità (Sezione 10.2)
Pattern obbligatorio:
1. **Reagire**: controllare e correggere la non conformità
2. **Valutare**: analizzare cause e determinare se esistono NC simili
3. **Attuare**: implementare azioni necessarie
4. **Riesaminare**: verificare efficacia azioni correttive
5. **Aggiornare**: modificare rischi/opportunità e SGQ se necessario
6. **Conservare**: documentare natura NC e azioni intraprese

## Integrazione con Sistemi Esterni

### Riferimenti Normativi
- **ISO 9000:2015**: Fondamenti e vocabolario (background essenziale)
- **ISO 9004**: Gestione per il successo durevole (oltre i requisiti base)
- **ISO 19011**: Linee guida audit di sistemi di gestione

### Norme Correlate Utilizzabili
- ISO 10002 (Trattamento reclami)
- ISO 10007 (Gestione configurazione per rintracciabilità)
- ISO 31000 (Risk management - per approfondimento risk-based thinking)

## Best Practices Specifiche del Progetto

1. **Priorità lingua italiana**: Tutti i documenti devono essere in italiano con terminologia conforme UNI
2. **Codifica caratteri**: UTF-8 per supportare caratteri speciali (©, °, etc.)
3. **Date**: Formato europeo (giorno mese anno, es. "2 novembre 2025")
4. **Proprietà intellettuale**: File in `/Normative/` contengono avviso copyright UNI - non modificare

## Domande Frequenti per AI Agents

**Q: Come gestire l'applicabilità dei requisiti?**
A: Punto 4.3 - L'organizzazione può decidere requisiti non applicabili SOLO se non impattano conformità prodotti/servizi. Fornire sempre giustificazione.

**Q: Serve un "Manuale della Qualità"?**
A: La ISO 9001:2015 NON richiede un manuale specifico. Sufficiente mantenere informazioni documentate necessarie (punto 7.5).

**Q: Risk management formale richiesto?**
A: NO. Punto 6.1 richiede pianificazione azioni per affrontare rischi/opportunità, ma metodologia formale è opzionale.

**Q: Differenza tra "mantenere" e "conservare" informazioni documentate?**
A: **Mantenere** = tenere aggiornate; **Conservare** = archiviare come evidenza (es. registrazioni).

## File Chiave da Consultare

- `Normative/UNI EN ISO 9001_2015 Rev. 0.txt` → Testo completo norma (2232 righe)
- `Quaderni/Linea Guida Conforma 9001_2015.pdf` → Guida attuazione pratica
- `Quaderni/Quaderni Qualità 3-Risk based thinking_ocred.pdf` → Approfondimento risk-based thinking
- `Check-List -Report Audit.docx` → Template audit corrente

---

**Ultimo aggiornamento**: Novembre 2025  
**Norma di riferimento**: UNI EN ISO 9001:2015 (settembre 2015)
