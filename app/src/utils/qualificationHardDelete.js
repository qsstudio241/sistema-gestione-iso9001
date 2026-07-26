/**
 * qualificationHardDelete.js — condizione UI per mostrare il pulsante "Elimina" (cancellazione fisica).
 *
 * Distinta dalla Revoca (soft-delete, sempre disponibile). L'Elimina reale è mostrata
 * solo per qualifiche che non sono MAI state approvate: bozza/rifiutata E senza un
 * `approved_at` valorizzato (una qualifica può tornare "rifiutata" dopo essere stata
 * approvata in passato — in quel caso va sempre e solo revocata, mai eliminata, per
 * non perdere la tracciabilità di un dato che è stato usato in produzione).
 *
 * Il backend (`DELETE /qualifications/:id/permanent`) ripete comunque tutti i controlli
 * di sicurezza (conferme semestrali, legami import, rinnovi, WPS) prima di eseguire il
 * DELETE reale: questa funzione serve solo a decidere se mostrare il pulsante.
 */
export function canHardDeleteQualification(q) {
    if (!q) return false;
    return q.approval_status !== "approvata" && !q.approved_at;
}
