/**
 * Test di Validazione Mock Data
 * Verifica integrità e coerenza dei dati di test
 * 
 * ESECUZIONE TEST:
 * 1. Aprire la console del browser (F12)
 * 2. Importare questo modulo
 * 3. Eseguire: testMockAudits()
 * 4. Verificare risultati in console
 */

import { MOCK_AUDITS } from './mockAudits.js';
import { validateAuditSchema } from './auditDataModel.js';

/**
 * Test Suite Completo Mock Audits
 */
export function testMockAudits() {
    console.group('🧪 TEST MOCK AUDITS - Sistema Gestione ISO');

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    // Test 1: Verifica numero audit
    totalTests++;
    console.group('Test 1: Verifica numero audit mock');
    if (MOCK_AUDITS.length === 3) {
        console.log('✅ PASS: Presenti 3 audit mock');
        passedTests++;
    } else {
        console.error(`❌ FAIL: Attesi 3 audit, trovati ${MOCK_AUDITS.length}`);
        failedTests++;
    }
    console.groupEnd();

    // Test 2: Validazione schema per ogni audit
    MOCK_AUDITS.forEach((audit, index) => {
        totalTests++;
        console.group(`Test 2.${index + 1}: Validazione schema ${audit.metadata.clientName}`);

        const validation = validateAuditSchema(audit);
        if (validation.valid) {
            console.log(`✅ PASS: Schema valido per ${audit.metadata.clientName}`);
            passedTests++;
        } else {
            console.error(`❌ FAIL: Schema invalido per ${audit.metadata.clientName}`);
            console.error('Errori:', validation.errors);
            failedTests++;
        }
        console.groupEnd();
    });

    // Test 3: Verifica metadata obbligatori
    MOCK_AUDITS.forEach((audit, index) => {
        totalTests++;
        console.group(`Test 3.${index + 1}: Metadata obbligatori ${audit.metadata.clientName}`);

        const requiredFields = ['id', 'clientName', 'projectYear', 'auditNumber', 'status', 'selectedStandards'];
        const missingFields = requiredFields.filter(field => !audit.metadata[field]);

        if (missingFields.length === 0) {
            console.log(`✅ PASS: Tutti i metadata obbligatori presenti`);
            passedTests++;
        } else {
            console.error(`❌ FAIL: Campi mancanti: ${missingFields.join(', ')}`);
            failedTests++;
        }
        console.groupEnd();
    });

    // Test 4: Verifica univocità ID audit
    totalTests++;
    console.group('Test 4: Univocità ID audit');
    const auditIds = MOCK_AUDITS.map(a => a.metadata.id);
    const uniqueIds = new Set(auditIds);

    if (auditIds.length === uniqueIds.size) {
        console.log('✅ PASS: Tutti gli ID audit sono univoci');
        passedTests++;
    } else {
        console.error('❌ FAIL: ID audit duplicati');
        failedTests++;
    }
    console.groupEnd();

    // Test 5: Verifica numerazione progressiva
    totalTests++;
    console.group('Test 5: Numerazione progressiva audit');
    const auditNumbers = MOCK_AUDITS.map(a => a.metadata.auditNumber).sort();
    const expectedNumbers = ['2025-01', '2025-02', '2025-03'];

    if (JSON.stringify(auditNumbers) === JSON.stringify(expectedNumbers)) {
        console.log('✅ PASS: Numerazione progressiva corretta (2025-01, 2025-02, 2025-03)');
        passedTests++;
    } else {
        console.error(`❌ FAIL: Numerazione errata. Atteso: ${expectedNumbers}, Trovato: ${auditNumbers}`);
        failedTests++;
    }
    console.groupEnd();

    // Test 6: Verifica checklist Raccorderia Piacentina (completo)
    totalTests++;
    console.group('Test 6: Checklist completa Raccorderia Piacentina');
    const rpAudit = MOCK_AUDITS[0];
    const rpChecklist = rpAudit.checklist.ISO_9001;
    const rpTotalQuestions = Object.values(rpChecklist).reduce((sum, clause) => sum + clause.questions.length, 0);

    if (rpTotalQuestions >= 15 && rpAudit.metrics.completionPercentage === 100) {
        console.log(`✅ PASS: Checklist completa con ${rpTotalQuestions} domande, 100% compilato`);
        passedTests++;
    } else {
        console.error(`❌ FAIL: Checklist incompleta. Domande: ${rpTotalQuestions}, Completamento: ${rpAudit.metrics.completionPercentage}%`);
        failedTests++;
    }
    console.groupEnd();

    // Test 7: Verifica Non Conformità Raccorderia Piacentina
    totalTests++;
    console.group('Test 7: Non Conformità Raccorderia Piacentina');
    const rpNC = rpAudit.nonConformities;

    if (rpNC.length === 2 && rpAudit.metrics.totalNC === 2) {
        console.log(`✅ PASS: Presenti 2 NC (1 major, 1 minor)`);
        console.log(`   - NC Major: ${rpNC.find(nc => nc.category === 'major')?.clause}`);
        console.log(`   - NC Minor: ${rpNC.find(nc => nc.category === 'minor')?.clause}`);
        passedTests++;
    } else {
        console.error(`❌ FAIL: NC non coerenti. Array: ${rpNC.length}, Metrics: ${rpAudit.metrics.totalNC}`);
        failedTests++;
    }
    console.groupEnd();

    // Test 8: Verifica evidenze collegate
    totalTests++;
    console.group('Test 8: Evidenze collegate a domande');
    const rpEvidences = Object.values(rpAudit.evidences);
    const linkedEvidences = rpEvidences.filter(ev => ev.linkedToQuestions.length > 0);

    if (linkedEvidences.length > 0) {
        console.log(`✅ PASS: ${linkedEvidences.length} evidenze collegate a domande`);
        linkedEvidences.forEach(ev => {
            console.log(`   - ${ev.name} → ${ev.linkedToQuestions.join(', ')}`);
        });
        passedTests++;
    } else {
        console.error('❌ FAIL: Nessuna evidenza collegata a domande');
        failedTests++;
    }
    console.groupEnd();

    // Test 9: Verifica audit multi-standard Acme Industries
    totalTests++;
    console.group('Test 9: Multi-standard Acme Industries');
    const acmeAudit = MOCK_AUDITS[1];
    const hasISO9001 = acmeAudit.selectedStandards.includes('ISO_9001');
    const hasISO14001 = acmeAudit.selectedStandards.includes('ISO_14001');
    const hasISO9001Checklist = !!acmeAudit.checklist.ISO_9001;
    const hasISO14001Checklist = !!acmeAudit.checklist.ISO_14001;

    if (hasISO9001 && hasISO14001 && hasISO9001Checklist && hasISO14001Checklist) {
        console.log('✅ PASS: Audit multi-standard con checklist ISO 9001 e ISO 14001');
        console.log(`   - Completamento ISO 9001: ${acmeAudit.metrics.completionByStandard.ISO_9001}%`);
        console.log(`   - Completamento ISO 14001: ${acmeAudit.metrics.completionByStandard.ISO_14001}%`);
        passedTests++;
    } else {
        console.error('❌ FAIL: Struttura multi-standard non corretta');
        failedTests++;
    }
    console.groupEnd();

    // Test 10: Verifica pending issues Acme Industries
    totalTests++;
    console.group('Test 10: Pending issues Acme Industries');
    const acmePending = acmeAudit.pendingIssues;

    if (acmePending.length > 0) {
        console.log(`✅ PASS: ${acmePending.length} pending issue trasferito da audit precedente`);
        console.log(`   - Origine: ${acmePending[0].originAuditNumber}`);
        console.log(`   - Clausola: ${acmePending[0].clause}`);
        console.log(`   - Status: ${acmePending[0].status}`);
        passedTests++;
    } else {
        console.error('❌ FAIL: Nessun pending issue presente');
        failedTests++;
    }
    console.groupEnd();

    // Test 11: Verifica audit vuoto Template Industries
    totalTests++;
    console.group('Test 11: Audit vuoto Template Industries');
    const templateAudit = MOCK_AUDITS[2];

    if (
        templateAudit.metadata.status === 'draft' &&
        Object.keys(templateAudit.checklist).length === 0 &&
        templateAudit.nonConformities.length === 0 &&
        templateAudit.metrics.completionPercentage === 0
    ) {
        console.log('✅ PASS: Audit vuoto correttamente inizializzato (status: draft, 0% completato)');
        passedTests++;
    } else {
        console.error('❌ FAIL: Audit vuoto contiene dati inattesi');
        failedTests++;
    }
    console.groupEnd();

    // Test 12: Verifica coerenza metrics
    MOCK_AUDITS.forEach((audit, index) => {
        totalTests++;
        console.group(`Test 12.${index + 1}: Coerenza metrics ${audit.metadata.clientName}`);

        const metricsNC = audit.metrics.totalNC;
        const actualNC = audit.nonConformities.length;
        const metricsEvidences = audit.metrics.totalEvidences;
        const actualEvidences = Object.keys(audit.evidences).length;

        if (metricsNC === actualNC && metricsEvidences === actualEvidences) {
            console.log('✅ PASS: Metrics coerenti con dati (NC, evidenze)');
            passedTests++;
        } else {
            console.error('❌ FAIL: Metrics non coerenti');
            console.error(`   - NC metrics: ${metricsNC}, actual: ${actualNC}`);
            console.error(`   - Evidences metrics: ${metricsEvidences}, actual: ${actualEvidences}`);
            failedTests++;
        }
        console.groupEnd();
    });

    // Test 13: Verifica timestamp ISO 8601
    totalTests++;
    console.group('Test 13: Formato timestamp ISO 8601');
    let timestampValid = true;
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

    MOCK_AUDITS.forEach(audit => {
        if (!iso8601Regex.test(audit.metadata.createdAt)) {
            timestampValid = false;
            console.error(`❌ Invalid createdAt: ${audit.metadata.createdAt}`);
        }
        if (!iso8601Regex.test(audit.metadata.lastModified)) {
            timestampValid = false;
            console.error(`❌ Invalid lastModified: ${audit.metadata.lastModified}`);
        }
    });

    if (timestampValid) {
        console.log('✅ PASS: Tutti i timestamp in formato ISO 8601');
        passedTests++;
    } else {
        console.error('❌ FAIL: Timestamp non conformi a ISO 8601');
        failedTests++;
    }
    console.groupEnd();

    // Test 14: Verifica status azioni correttive
    totalTests++;
    console.group('Test 14: Status azioni correttive NC');
    const rpNCStatuses = rpAudit.nonConformities.map(nc => nc.correctiveAction.status);
    const validStatuses = ['open', 'in_progress', 'completed', 'verified', 'rejected'];
    const allValid = rpNCStatuses.every(status => validStatuses.includes(status));

    if (allValid) {
        console.log('✅ PASS: Status azioni correttive validi');
        rpNCStatuses.forEach((status, i) => {
            console.log(`   - NC ${i + 1}: ${status}`);
        });
        passedTests++;
    } else {
        console.error('❌ FAIL: Status azioni correttive non validi');
        failedTests++;
    }
    console.groupEnd();

    // Riepilogo finale
    console.groupEnd();
    console.group('📊 RIEPILOGO TEST');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests === 0) {
        console.log('🎉 TUTTI I TEST SUPERATI! Mock data validi e pronti per l\'uso.');
    } else {
        console.warn(`⚠️ ${failedTests} test falliti. Rivedere mock data.`);
    }
    console.groupEnd();

    return {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1)
    };
}

/**
 * Test rapido per verifica in console
 */
export function quickTest() {
    console.log('🚀 Quick Test Mock Audits');
    console.table(MOCK_AUDITS.map(audit => ({
        'Audit Number': audit.metadata.auditNumber,
        'Cliente': audit.metadata.clientName,
        'Status': audit.metadata.status,
        'Norme': audit.metadata.selectedStandards.join(', '),
        'Completamento': `${audit.metrics.completionPercentage}%`,
        'NC': audit.metrics.totalNC,
        'Evidenze': audit.metrics.totalEvidences
    })));
}

// Auto-esecuzione in ambiente sviluppo
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.log('🔧 Ambiente sviluppo rilevato. Eseguire testMockAudits() per validazione completa.');
}

export default { testMockAudits, quickTest };
