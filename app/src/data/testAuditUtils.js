/**
 * Test Audit Utilities (STEP 4)
 * Esegui in browser console dopo import mockAudits
 * Sistema Gestione ISO 9001 - QS Studio
 */

import { MOCK_AUDITS } from './mockAudits';
import {
    calculateCompletionPercentage,
    calculateNormCompletion,
    calculateNCStats,
    extractYearFromAuditNumber,
    extractProgressiveFromAuditNumber,
    getNextAuditNumber,
    isValidAuditNumber,
    filterAuditsByYear,
    filterAuditsByClient,
    filterAuditsByNorm,
    filterAuditsByStatus,
    sortAuditsByNumber,
    sortAuditsByDate,
    sortAuditsByCompletion,
    findAuditById,
    findAuditByNumber,
    getUniqueClients,
    getAvailableYears,
    validateAuditData,
    canArchiveAudit,
    exportAuditSummary,
    getAggregateStats
} from '../utils/auditUtils';

/**
 * Test completo Audit Utilities
 */
export function testAuditUtils() {
    console.log('\n🧪 === TEST AUDIT UTILITIES (STEP 4) ===\n');

    const tests = [];
    let passed = 0;
    let failed = 0;

    // === CALCOLO METRICHE ===

    tests.push({
        name: 'calculateCompletionPercentage - Audit 100%',
        test: () => {
            const audit = MOCK_AUDITS[0]; // Raccorderia Piacentina
            const completion = calculateCompletionPercentage(audit.checklist);
            return completion === 100;
        }
    });

    tests.push({
        name: 'calculateCompletionPercentage - Audit 50%',
        test: () => {
            const audit = MOCK_AUDITS[1]; // Acme Industries
            const completion = calculateCompletionPercentage(audit.checklist);
            return completion === 50;
        }
    });

    tests.push({
        name: 'calculateNormCompletion - ISO 9001',
        test: () => {
            const audit = MOCK_AUDITS[0];
            const stats = calculateNormCompletion(audit.checklist, 'ISO_9001');
            return stats.total === 20 && stats.answered === 20 && stats.percentage === 100;
        }
    });

    tests.push({
        name: 'calculateNCStats - 2 NC (1 major, 1 minor)',
        test: () => {
            const audit = MOCK_AUDITS[0];
            const stats = calculateNCStats(audit.nonConformities);
            return stats.total === 2 && stats.byCategory.major === 1 && stats.byCategory.minor === 1;
        }
    });

    // === NUMERI AUDIT ===

    tests.push({
        name: 'extractYearFromAuditNumber - "2025-01"',
        test: () => {
            const year = extractYearFromAuditNumber('2025-01');
            return year === 2025;
        }
    });

    tests.push({
        name: 'extractProgressiveFromAuditNumber - "2025-01"',
        test: () => {
            const progressive = extractProgressiveFromAuditNumber('2025-01');
            return progressive === 1;
        }
    });

    tests.push({
        name: 'getNextAuditNumber - genera "2025-04"',
        test: () => {
            const nextNumber = getNextAuditNumber(MOCK_AUDITS, 2025);
            return nextNumber === '2025-04';
        }
    });

    tests.push({
        name: 'isValidAuditNumber - valida formato',
        test: () => {
            return isValidAuditNumber('2025-01') &&
                isValidAuditNumber('2024-99') &&
                !isValidAuditNumber('2025-1') &&
                !isValidAuditNumber('25-01') &&
                !isValidAuditNumber('invalid');
        }
    });

    // === FILTRI ===

    tests.push({
        name: 'filterAuditsByYear - 3 audit anno 2025',
        test: () => {
            const filtered = filterAuditsByYear(MOCK_AUDITS, 2025);
            return filtered.length === 3;
        }
    });

    tests.push({
        name: 'filterAuditsByClient - trova "Raccorderia"',
        test: () => {
            const filtered = filterAuditsByClient(MOCK_AUDITS, 'Raccorderia');
            return filtered.length === 1 && filtered[0].metadata.clientName.includes('Raccorderia');
        }
    });

    tests.push({
        name: 'filterAuditsByNorm - ISO 9001 presente in tutti',
        test: () => {
            const filtered = filterAuditsByNorm(MOCK_AUDITS, 'ISO_9001');
            return filtered.length === 3;
        }
    });

    tests.push({
        name: 'filterAuditsByNorm - ISO 14001 solo in Acme',
        test: () => {
            const filtered = filterAuditsByNorm(MOCK_AUDITS, 'ISO_14001');
            return filtered.length === 1 && filtered[0].metadata.clientName === 'Acme Industries SpA';
        }
    });

    tests.push({
        name: 'filterAuditsByStatus - 1 completed',
        test: () => {
            const filtered = filterAuditsByStatus(MOCK_AUDITS, 'completed');
            return filtered.length === 1;
        }
    });

    // === ORDINAMENTO ===

    tests.push({
        name: 'sortAuditsByNumber - ordine decrescente',
        test: () => {
            const sorted = sortAuditsByNumber(MOCK_AUDITS, false);
            return sorted[0].metadata.auditNumber === '2025-03' &&
                sorted[2].metadata.auditNumber === '2025-01';
        }
    });

    tests.push({
        name: 'sortAuditsByCompletion - ordine decrescente',
        test: () => {
            const sorted = sortAuditsByCompletion(MOCK_AUDITS, false);
            return sorted[0].metrics.completionPercentage === 100 &&
                sorted[2].metrics.completionPercentage === 0;
        }
    });

    // === RICERCA ===

    tests.push({
        name: 'findAuditByNumber - trova "2025-01"',
        test: () => {
            const audit = findAuditByNumber(MOCK_AUDITS, '2025-01');
            return audit !== null && audit.metadata.auditNumber === '2025-01';
        }
    });

    tests.push({
        name: 'getUniqueClients - 3 clienti unici',
        test: () => {
            const clients = getUniqueClients(MOCK_AUDITS);
            return clients.length === 3 && clients.includes('Acme Industries SpA');
        }
    });

    tests.push({
        name: 'getAvailableYears - anno 2025',
        test: () => {
            const years = getAvailableYears(MOCK_AUDITS);
            return years.length === 1 && years[0] === 2025;
        }
    });

    // === VALIDAZIONE ===

    tests.push({
        name: 'validateAuditData - audit valido',
        test: () => {
            const audit = MOCK_AUDITS[0];
            const validation = validateAuditData(audit);
            return validation.valid === true;
        }
    });

    tests.push({
        name: 'validateAuditData - rileva warnings su completed con NC aperte',
        test: () => {
            // Simula audit completed con NC aperte
            const audit = {
                ...MOCK_AUDITS[0],
                metadata: { ...MOCK_AUDITS[0].metadata, status: 'completed' },
                nonConformities: [
                    { ...MOCK_AUDITS[0].nonConformities[0], status: 'open' }
                ]
            };
            const validation = validateAuditData(audit);
            return validation.warnings.length > 0;
        }
    });

    tests.push({
        name: 'canArchiveAudit - completed può essere archiviato',
        test: () => {
            const audit = MOCK_AUDITS[0];
            const result = canArchiveAudit(audit);
            return result.canArchive === true;
        }
    });

    tests.push({
        name: 'canArchiveAudit - in_progress non può essere archiviato',
        test: () => {
            const audit = MOCK_AUDITS[1];
            const result = canArchiveAudit(audit);
            return result.canArchive === false;
        }
    });

    // === EXPORT ===

    tests.push({
        name: 'exportAuditSummary - contiene campi essenziali',
        test: () => {
            const audit = MOCK_AUDITS[0];
            const summary = exportAuditSummary(audit);
            return summary !== null &&
                summary.auditNumber === '2025-01' &&
                summary.completionPercentage === 100 &&
                summary.majorNC === 1 &&
                summary.minorNC === 1;
        }
    });

    tests.push({
        name: 'getAggregateStats - statistiche corrette',
        test: () => {
            const stats = getAggregateStats(MOCK_AUDITS);
            return stats.totalAudits === 3 &&
                stats.byStatus.completed === 1 &&
                stats.byStatus.in_progress === 1 &&
                stats.byStatus.draft === 1 &&
                stats.byNorm.ISO_9001 === 3 &&
                stats.byNorm.ISO_14001 === 1 &&
                stats.totalNC === 2;
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

    console.log('\n📊 === RIEPILOGO TEST AUDIT UTILITIES ===');
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${successRate}%`);

    return { total, passed, failed, successRate };
}

/**
 * Test interattivi per funzioni specifiche
 */
export function testCalculations() {
    console.log('\n🧪 === TEST CALCOLI ===\n');

    MOCK_AUDITS.forEach((audit, index) => {
        console.log(`\n📋 Audit ${index + 1}: ${audit.metadata.auditNumber} - ${audit.metadata.clientName}`);

        const completion = calculateCompletionPercentage(audit.checklist);
        console.log(`  ✓ Completamento: ${completion}%`);

        const ncStats = calculateNCStats(audit.nonConformities);
        console.log(`  ✓ NC totali: ${ncStats.total}`);
        console.log(`    - Major: ${ncStats.byCategory.major}`);
        console.log(`    - Minor: ${ncStats.byCategory.minor}`);
        console.log(`    - Observation: ${ncStats.byCategory.observation}`);

        audit.metadata.norms.forEach(norm => {
            const normStats = calculateNormCompletion(audit.checklist, norm);
            console.log(`  ✓ ${norm}: ${normStats.answered}/${normStats.total} domande (${normStats.percentage}%)`);
        });
    });
}

/**
 * Test filtri e ordinamento
 */
export function testFiltersAndSorting() {
    console.log('\n🧪 === TEST FILTRI E ORDINAMENTO ===\n');

    console.log('📅 Filtro per anno 2025:');
    const filtered2025 = filterAuditsByYear(MOCK_AUDITS, 2025);
    console.log(`  ✓ Trovati ${filtered2025.length} audit`);

    console.log('\n🏢 Filtro per cliente "Industries":');
    const filteredClient = filterAuditsByClient(MOCK_AUDITS, 'Industries');
    filteredClient.forEach(a => console.log(`  - ${a.metadata.auditNumber}: ${a.metadata.clientName}`));

    console.log('\n📜 Filtro per norma ISO 14001:');
    const filteredNorm = filterAuditsByNorm(MOCK_AUDITS, 'ISO_14001');
    filteredClient.forEach(a => console.log(`  - ${a.metadata.auditNumber}: ${a.metadata.clientName}`));

    console.log('\n🔢 Ordinamento per numero (decrescente):');
    const sortedByNumber = sortAuditsByNumber(MOCK_AUDITS, false);
    sortedByNumber.forEach(a => console.log(`  ${a.metadata.auditNumber} - ${a.metadata.clientName}`));

    console.log('\n📊 Ordinamento per completamento (decrescente):');
    const sortedByCompletion = sortAuditsByCompletion(MOCK_AUDITS, false);
    sortedByCompletion.forEach(a =>
        console.log(`  ${a.metadata.auditNumber}: ${a.metrics.completionPercentage}%`)
    );

    console.log('\n🔍 Clienti unici:');
    const clients = getUniqueClients(MOCK_AUDITS);
    clients.forEach(c => console.log(`  - ${c}`));

    console.log('\n📆 Anni disponibili:');
    const years = getAvailableYears(MOCK_AUDITS);
    years.forEach(y => console.log(`  - ${y}`));
}

/**
 * Test validazione
 */
export function testValidation() {
    console.log('\n🧪 === TEST VALIDAZIONE ===\n');

    MOCK_AUDITS.forEach((audit, index) => {
        console.log(`\n📋 Audit ${index + 1}: ${audit.metadata.auditNumber}`);

        const validation = validateAuditData(audit);
        console.log(`  Valid: ${validation.valid ? '✅' : '❌'}`);

        if (validation.errors.length > 0) {
            console.log('  Errors:');
            validation.errors.forEach(err => console.log(`    ❌ ${err}`));
        }

        if (validation.warnings.length > 0) {
            console.log('  Warnings:');
            validation.warnings.forEach(warn => console.log(`    ⚠️ ${warn}`));
        }

        const archiveCheck = canArchiveAudit(audit);
        console.log(`  Can archive: ${archiveCheck.canArchive ? '✅' : '❌'} (${archiveCheck.reason})`);
    });
}

/**
 * Test export utilities
 */
export function testExport() {
    console.log('\n🧪 === TEST EXPORT ===\n');

    console.log('📄 Audit Summary:');
    MOCK_AUDITS.forEach((audit, index) => {
        const summary = exportAuditSummary(audit);
        console.log(`\n  ${index + 1}. ${summary.auditNumber} - ${summary.clientName}`);
        console.log(`     Status: ${summary.status}`);
        console.log(`     Completamento: ${summary.completionPercentage}%`);
        console.log(`     NC: ${summary.majorNC} major, ${summary.minorNC} minor, ${summary.observations} obs`);
        console.log(`     Evidenze: ${summary.evidencesCount}`);
    });

    console.log('\n\n📊 Aggregate Stats:');
    const stats = getAggregateStats(MOCK_AUDITS);
    console.log(`  Total audits: ${stats.totalAudits}`);
    console.log(`  By Status:`);
    Object.entries(stats.byStatus).forEach(([status, count]) => {
        if (count > 0) console.log(`    - ${status}: ${count}`);
    });
    console.log(`  By Norm:`);
    Object.entries(stats.byNorm).forEach(([norm, count]) => {
        if (count > 0) console.log(`    - ${norm}: ${count}`);
    });
    console.log(`  Total NC: ${stats.totalNC}`);
    console.log(`  Average completion: ${stats.averageCompletion}%`);
    console.log(`  Total evidences: ${stats.totalEvidences}`);
}

/**
 * Esegui tutti i test utilities
 */
export async function runAllUtilsTests() {
    console.log('🚀 === ESECUZIONE TUTTI I TEST AUDIT UTILITIES ===\n');

    testAuditUtils();
    testCalculations();
    testFiltersAndSorting();
    testValidation();
    testExport();

    console.log('\n✅ === TEST UTILITIES COMPLETATI ===\n');
}

// Export per uso browser console
if (typeof window !== 'undefined') {
    window.testAuditUtils = testAuditUtils;
    window.testCalculations = testCalculations;
    window.testFiltersAndSorting = testFiltersAndSorting;
    window.testValidation = testValidation;
    window.testExport = testExport;
    window.runAllUtilsTests = runAllUtilsTests;

    console.log(`
🧪 Test Audit Utilities disponibili in console:
  - testAuditUtils()            // 24 test automatici
  - testCalculations()           // Test calcoli metriche
  - testFiltersAndSorting()      // Test filtri e sort
  - testValidation()             // Test validazione
  - testExport()                 // Test export utilities
  - runAllUtilsTests()           // Esegui tutti i test
  `);
}

export default testAuditUtils;
