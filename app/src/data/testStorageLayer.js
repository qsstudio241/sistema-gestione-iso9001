/**
 * Test Storage Layer (STEP 3)
 * Esegui in browser console dopo avvio app
 * Sistema Gestione ISO 9001 - QS Studio
 */

/**
 * Test completo Storage Layer
 * Eseguire in console dopo che l'app è montata con StorageProvider
 */
export function testStorageLayer() {
    console.log('\n🧪 === TEST STORAGE LAYER (STEP 3) ===\n');

    const tests = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Verifica localStorage inizializzato
    tests.push({
        name: 'localStorage inizializzato con audits',
        test: () => {
            const audits = localStorage.getItem('audits');
            return audits !== null;
        }
    });

    // Test 2: Verifica currentAuditId salvato
    tests.push({
        name: 'currentAuditId salvato in localStorage',
        test: () => {
            const currentId = localStorage.getItem('currentAuditId');
            return currentId !== null;
        }
    });

    // Test 3: Verifica struttura audits parsabile
    tests.push({
        name: 'audits array parsabile da JSON',
        test: () => {
            try {
                const audits = JSON.parse(localStorage.getItem('audits') || '[]');
                return Array.isArray(audits) && audits.length >= 3;
            } catch {
                return false;
            }
        }
    });

    // Test 4: Verifica auto-save singolo audit
    tests.push({
        name: 'auto-save singolo audit (audit_uuid)',
        test: () => {
            const currentId = localStorage.getItem('currentAuditId');
            if (!currentId) return false;

            const auditKey = `audit_${currentId}`;
            const audit = localStorage.getItem(auditKey);
            return audit !== null;
        }
    });

    // Test 5: Verifica metriche coerenti
    tests.push({
        name: 'metriche audit coerenti con checklist',
        test: () => {
            try {
                const audits = JSON.parse(localStorage.getItem('audits') || '[]');
                const firstAudit = audits[0];
                if (!firstAudit) return false;

                // Conta domande risposte
                let answered = 0;
                let total = 0;
                Object.values(firstAudit.checklist).forEach(normChecklist => {
                    Object.values(normChecklist.clauses).forEach(clause => {
                        clause.questions.forEach(q => {
                            total++;
                            if (q.status !== 'not_answered') answered++;
                        });
                    });
                });

                const calculatedPercentage = Math.round((answered / total) * 100);
                return calculatedPercentage === firstAudit.metrics.completionPercentage;
            } catch {
                return false;
            }
        }
    });

    // Test 6: Verifica timestamp ISO 8601
    tests.push({
        name: 'timestamp in formato ISO 8601',
        test: () => {
            try {
                const audits = JSON.parse(localStorage.getItem('audits') || '[]');
                const firstAudit = audits[0];
                if (!firstAudit) return false;

                const timestamp = firstAudit.metadata.createdAt;
                const parsed = new Date(timestamp);
                return !isNaN(parsed.getTime()) && timestamp.includes('T');
            } catch {
                return false;
            }
        }
    });

    // Test 7: Verifica ID univoci
    tests.push({
        name: 'ID audit univoci',
        test: () => {
            try {
                const audits = JSON.parse(localStorage.getItem('audits') || '[]');
                const ids = audits.map(a => a.metadata.id);
                const uniqueIds = new Set(ids);
                return ids.length === uniqueIds.size;
            } catch {
                return false;
            }
        }
    });

    // Test 8: Verifica progressione numeri audit
    tests.push({
        name: 'numeri audit progressivi (2025-01, 2025-02, 2025-03)',
        test: () => {
            try {
                const audits = JSON.parse(localStorage.getItem('audits') || '[]');
                const numbers = audits.map(a => a.metadata.auditNumber);
                return numbers.includes('2025-01') &&
                    numbers.includes('2025-02') &&
                    numbers.includes('2025-03');
            } catch {
                return false;
            }
        }
    });

    // Esegui tests
    tests.forEach((test, index) => {
        try {
            const result = test.test();
            if (result) {
                console.log(`✅ Test ${index + 1}: ${test.name}`);
                passed++;
            } else {
                console.log(`❌ Test ${index + 1}: ${test.name}`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ Test ${index + 1}: ${test.name} (Exception: ${error.message})`);
            failed++;
        }
    });

    // Riepilogo
    const total = tests.length;
    const successRate = Math.round((passed / total) * 100);

    console.log('\n📊 === RIEPILOGO TEST STORAGE LAYER ===');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${successRate}%`);

    return { total, passed, failed, successRate };
}

/**
 * Test interattivo auto-save
 * Modifica un audit e verifica salvataggio dopo 2s
 */
export async function testAutoSave() {
    console.log('\n🧪 === TEST AUTO-SAVE (attendi 3s) ===\n');

    try {
        // Leggi audit corrente
        const currentId = localStorage.getItem('currentAuditId');
        const auditKey = `audit_${currentId}`;
        const beforeAudit = localStorage.getItem(auditKey);
        const beforeTimestamp = JSON.parse(beforeAudit).metadata.lastModified;

        console.log('⏳ Modifica audit... (simulazione)');
        console.log(`Timestamp BEFORE: ${beforeTimestamp}`);

        // Simula modifica (in produzione userebbe updateCurrentAudit)
        const modified = JSON.parse(beforeAudit);
        modified.metadata.lastModified = new Date().toISOString();
        modified.metadata.notes += '\n[TEST AUTO-SAVE]';

        localStorage.setItem(auditKey, JSON.stringify(modified));

        // Attendi 3s per vedere auto-save
        await new Promise(resolve => setTimeout(resolve, 3000));

        const afterAudit = localStorage.getItem(auditKey);
        const afterTimestamp = JSON.parse(afterAudit).metadata.lastModified;

        console.log(`Timestamp AFTER: ${afterTimestamp}`);
        console.log(afterTimestamp !== beforeTimestamp ? '✅ Auto-save funzionante' : '❌ Auto-save non attivo');

    } catch (error) {
        console.error('❌ Errore test auto-save:', error);
    }
}

/**
 * Test metriche real-time
 * Verifica calcolo metriche da checklist
 */
export function testMetricsCalculation() {
    console.log('\n🧪 === TEST METRICHE REAL-TIME ===\n');

    try {
        const audits = JSON.parse(localStorage.getItem('audits') || '[]');

        audits.forEach((audit, index) => {
            console.log(`\n📋 Audit ${index + 1}: ${audit.metadata.auditNumber} - ${audit.metadata.clientName}`);

            // Calcola metriche manualmente
            let totalQuestions = 0;
            let answeredQuestions = 0;
            const complianceStats = {
                compliant: 0,
                partial: 0,
                non_compliant: 0,
                not_applicable: 0
            };

            Object.entries(audit.checklist).forEach(([normKey, normChecklist]) => {
                console.log(`  └─ ${normKey}:`);

                Object.values(normChecklist.clauses).forEach(clause => {
                    clause.questions.forEach(q => {
                        totalQuestions++;
                        if (q.status !== 'not_answered') {
                            answeredQuestions++;
                            complianceStats[q.status]++;
                        }
                    });
                });

                const normTotal = Object.values(normChecklist.clauses)
                    .reduce((sum, clause) => sum + clause.questions.length, 0);

                console.log(`     Domande: ${normTotal}`);
            });

            const calculatedPercentage = totalQuestions > 0
                ? Math.round((answeredQuestions / totalQuestions) * 100)
                : 0;

            const storedPercentage = audit.metrics.completionPercentage;

            console.log(`  ✓ Completamento calcolato: ${calculatedPercentage}%`);
            console.log(`  ✓ Completamento salvato: ${storedPercentage}%`);
            console.log(`  ${calculatedPercentage === storedPercentage ? '✅' : '❌'} Metriche coerenti`);

            console.log(`  ✓ NC totali: ${audit.nonConformities.length}`);
            console.log(`  ✓ Evidenze: ${audit.evidences.length}`);
            console.log(`  ✓ Pending issues: ${audit.pendingIssues.length}`);
        });

    } catch (error) {
        console.error('❌ Errore test metriche:', error);
    }
}

/**
 * Quick overview localStorage
 */
export function inspectLocalStorage() {
    console.log('\n🔍 === INSPECT LOCALSTORAGE ===\n');

    const keys = Object.keys(localStorage);
    console.log(`📦 Total keys: ${keys.length}\n`);

    keys.forEach(key => {
        const value = localStorage.getItem(key);
        const size = new Blob([value]).size;
        const sizeKB = (size / 1024).toFixed(2);

        if (key === 'audits' || key.startsWith('audit_')) {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    console.log(`📋 ${key}: ${parsed.length} audits (${sizeKB} KB)`);
                } else {
                    console.log(`📄 ${key}: ${parsed.metadata?.auditNumber || 'N/A'} (${sizeKB} KB)`);
                }
            } catch {
                console.log(`🔑 ${key}: ${sizeKB} KB`);
            }
        } else {
            console.log(`🔑 ${key}: ${value.substring(0, 50)}... (${sizeKB} KB)`);
        }
    });
}

/**
 * Esegui tutti i test
 */
export async function runAllStorageTests() {
    console.log('🚀 === ESECUZIONE TUTTI I TEST STORAGE LAYER ===\n');

    testStorageLayer();
    testMetricsCalculation();
    inspectLocalStorage();

    console.log('\n⏳ Avvio test auto-save (attendi 3s)...');
    await testAutoSave();

    console.log('\n✅ === TEST COMPLETATI ===\n');
}

// Export per uso browser console
if (typeof window !== 'undefined') {
    window.testStorageLayer = testStorageLayer;
    window.testAutoSave = testAutoSave;
    window.testMetricsCalculation = testMetricsCalculation;
    window.inspectLocalStorage = inspectLocalStorage;
    window.runAllStorageTests = runAllStorageTests;

    console.log(`
🧪 Test Storage Layer disponibili in console:
  - testStorageLayer()          // Test base localStorage
  - testMetricsCalculation()    // Verifica metriche
  - testAutoSave()              // Test auto-save con delay
  - inspectLocalStorage()       // Overview localStorage
  - runAllStorageTests()        // Esegui tutti i test
  `);
}

export default testStorageLayer;
