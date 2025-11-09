/**
 * Storage Adapter - Gestisce fallback tra LocalFsProvider e IndexedDBProvider
 * Rileva device e sceglie storage ottimale
 * Sistema Gestione ISO 9001 - QS Studio
 */

import { LocalFsProvider } from './LocalFsProvider';
import { IndexedDBProvider } from './IndexedDBProvider';

/**
 * Rileva se siamo su dispositivo mobile
 */
export function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/**
 * Verifica supporto File System Access API
 */
export function hasFileSystemAccess() {
    return 'showDirectoryPicker' in window;
}

/**
 * Determina quale storage provider usare
 */
export function getRecommendedStorage() {
    const mobile = isMobileDevice();
    const hasFS = hasFileSystemAccess();

    if (mobile || !hasFS) {
        return {
            type: 'indexeddb',
            reason: mobile
                ? 'Dispositivo mobile rilevato'
                : 'File System Access API non supportata',
        };
    }

    return {
        type: 'filesystem',
        reason: 'Desktop con File System Access API',
    };
}

/**
 * Factory per creare storage provider appropriato
 */
export async function createStorageProvider() {
    const recommendation = getRecommendedStorage();

    console.log(
        `📦 Storage provider: ${recommendation.type} (${recommendation.reason})`
    );

    if (recommendation.type === 'indexeddb') {
        const provider = new IndexedDBProvider();
        await provider.initialize();
        return provider;
    }

    // Desktop: ritorna LocalFsProvider (non auto-inizializzato)
    return new LocalFsProvider();
}

/**
 * Informazioni device e storage per UI
 */
export function getDeviceInfo() {
    const mobile = isMobileDevice();
    const hasFS = hasFileSystemAccess();
    const recommendation = getRecommendedStorage();

    return {
        isMobile: mobile,
        hasFileSystemAccess: hasFS,
        recommendedStorage: recommendation.type,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
    };
}
