/**
 * Regole condivise per identificare le qualifiche soggette a conferma
 * periodica semestrale (ISO 9606-1 saldatori manuali, ISO 14732 operatori
 * saldatura automatica/meccanizzata).
 *
 * Specchio lato frontend di backend/src/services/weldingCoordinatorAuth.service.js
 * (funzioni isWelder9606Type / isOperator14732Type / requiresSemiannualConfirmation)
 * — mantenere sincronizzate le due implementazioni se cambia la regola di
 * matching sul tipo qualifica.
 */

export function isWelder9606Type(qualificationType) {
    const t = String(qualificationType || "").toLowerCase();
    return t.includes("9606") || t.includes("patentino_saldatore") || t === "9606_1";
}

export function isOperator14732Type(qualificationType) {
    const t = String(qualificationType || "").toLowerCase();
    return t.includes("14732") || t.includes("qualifica_14732");
}

export function requiresSemiannualConfirmation(qualificationType) {
    return isWelder9606Type(qualificationType) || isOperator14732Type(qualificationType);
}
