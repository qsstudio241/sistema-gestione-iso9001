/**
 * Snapshot cruscotto stato sviluppo (vista committente).
 * Fonte operativa: docs/PROJECT_ROADMAP.md § Stato attuale.
 * Aggiornare questo file quando cambia una priorità o si chiude un modulo.
 */

export const STATO_SVILUPPO_UPDATED_AT = "2026-09-13";

export const STATO_COLONNE = [
  { key: "done", label: "Fatto", cls: "sq-stat-verde" },
  { key: "inProgress", label: "In corso", cls: "sq-stat-giallo" },
  { key: "next", label: "Prossimo", cls: "sq-stat-arancione" },
];

export const STATO_SVILUPPO = {
  updatedAt: STATO_SVILUPPO_UPDATED_AT,
  intro:
    "Vista semplice di dove siamo. Il dettaglio tecnico resta nella roadmap.",
  done: [
    {
      id: "audit",
      title: "Audit multi-standard",
      note: "ISO 9001, 14001, 45001 e 3834: checklist, sync, export Word, tipologia prima/seconda parte.",
    },
    {
      id: "nc",
      title: "Non conformit\u00e0",
      note: "Apertura, azioni, evidenze, verifica e chiusura.",
    },
    {
      id: "qualifiche",
      title: "Qualifiche e alert",
      note: "Scadenze patentini e destinatario esplicito degli avvisi (Alert #3).",
    },
    {
      id: "saldatura",
      title: "Saldatura",
      note: "WPQR, WPS, Welding Book, foto cordone, dashboard ISO 3834.",
    },
    {
      id: "sal",
      title: "SAL",
      note: "Stato avanzamento lavori / requisiti, con supporto AI gi\u00e0 in uso.",
    },
    {
      id: "documenti",
      title: "Registro e scadenzari",
      note: "Documenti aziendali, scadenze e alert collegati.",
    },
    {
      id: "riesame",
      title: "Riesami",
      note: "Riesame di direzione e riesame requisiti/contratto.",
    },
    {
      id: "anagrafiche",
      title: "Anagrafiche e accessi",
      note: "Aziende, personale, ruoli, licenze moduli, isolamento dati tra studi.",
    },
    {
      id: "cnd",
      title: "CND (ciclo base)",
      note: "Strumenti e verbali VT/MT/PT. Restano raffinamenti (UT, firma, foto offline).",
    },
    {
      id: "ai",
      title: "Assistente AI e conformit\u00e0",
      note: "Assistente di Ambito, Gap analysis, Libreria norme, Mappa conformit\u00e0.",
    },
    {
      id: "ai-quesiti",
      title: "AI sui quesiti checklist",
      note: "Pulsante \u00abChiedi all'AI\u00bb su ogni domanda (mergiato il 13/09). Da usare in campo.",
    },
    {
      id: "offline",
      title: "Lavoro senza rete",
      note: "Salvataggio in locale e sync automatico quando torna la connessione.",
    },
  ],
  inProgress: [
    {
      id: "ai-campo",
      title: "Prova in campo dell'AI sui quesiti",
      note: "La funzione c'\u00e8. Per 2\u20134 settimane si usa in audit reali; i miglioramenti arrivano dopo il feedback.",
    },
  ],
  next: [
    {
      id: "ctx4",
      title: "Collegare email e Drive all'assistente",
      note: "CTX-4. Prima serve una tua decisione (sicurezza/accessi).",
      waitForYou: true,
    },
    {
      id: "ing5",
      title: "Import commesse pi\u00f9 avanzato",
      note: "ING-5. In attesa di conferma su come vuoi gestire i file.",
      waitForYou: true,
    },
    {
      id: "roo18",
      title: "Rischi nel riesame di direzione",
      note: "ROO-18. Ingest/dati riesame dopo tua conferma.",
      waitForYou: true,
    },
    {
      id: "mci4",
      title: "Materiali: pi\u00f9 certificati in una busta",
      note: "MC-I4. Una busta pu\u00f2 contenere pi\u00f9 documenti da spezzare.",
    },
    {
      id: "iso4b",
      title: "ISO 3834: scala 1\u20136 e ponti restanti",
      note: "ISO-4b e seguenti. Word visita e foto cordone sono gi\u00e0 fatti.",
    },
    {
      id: "cnd-residui",
      title: "CND: verbale UT, firma, foto offline",
      note: "Completamento del ciclo ispettore in campo.",
    },
    {
      id: "s1c",
      title: "SAL: file .doc vecchi",
      note: "S1c. Si fa solo se lo chiedi esplicitamente.",
      waitForYou: true,
    },
    {
      id: "fw0",
      title: "Foto intelligenti (RAG multimodale)",
      note: "FW-0. Collegare le foto dell'ingest alla ricerca per immagini.",
    },
  ],
};

export function countStatoSviluppo(data = STATO_SVILUPPO) {
  return {
    done: data.done.length,
    inProgress: data.inProgress.length,
    next: data.next.length,
  };
}
