/**
 * Test L1 - chunkReloadGuard
 * Rileva "Failed to fetch dynamically imported module" (chunk obsoleto dopo
 * deploy Netlify) e forza un reload automatico con guardia anti-loop.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isChunkLoadError, reloadIfChunkError } from '../utils/chunkReloadGuard';

describe('chunkReloadGuard', () => {
  let reloadSpy;

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    // jsdom rende window.location.reload non scrivibile: si ridefinisce
    // l'intero oggetto location con una versione mockabile per il test.
    reloadSpy = vi.fn();
    delete window.location;
    window.location = { ...new URL('http://localhost/'), reload: reloadSpy };
  });

  describe('isChunkLoadError', () => {
    it('riconosce il messaggio Chrome/Vite per import dinamico', () => {
      const err = new TypeError(
        'Failed to fetch dynamically imported module: https://systemgest.netlify.app/assets/NCPage-abc123.js'
      );
      expect(isChunkLoadError(err)).toBe(true);
    });

    it('riconosce la variante Firefox', () => {
      const err = new Error('error loading dynamically imported module');
      expect(isChunkLoadError(err)).toBe(true);
    });

    it('riconosce ChunkLoadError (webpack-style, per compatibilità)', () => {
      const err = new Error('ChunkLoadError: Loading chunk 42 failed');
      expect(isChunkLoadError(err)).toBe(true);
    });

    it('ignora errori applicativi non correlati', () => {
      const err = new TypeError("Cannot read properties of undefined (reading 'map')");
      expect(isChunkLoadError(err)).toBe(false);
    });

    it('gestisce input null/undefined senza lanciare eccezioni', () => {
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });

    it('estrae il messaggio da un evento unhandledrejection (reason.message)', () => {
      const reason = { message: 'Failed to fetch dynamically imported module: foo.js' };
      expect(isChunkLoadError(reason)).toBe(true);
    });
  });

  describe('reloadIfChunkError', () => {
    it('forza il reload alla prima occorrenza di un chunk error', () => {
      const err = new TypeError('Failed to fetch dynamically imported module: x.js');
      const triggered = reloadIfChunkError(err);

      expect(triggered).toBe(true);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('non ricarica una seconda volta entro la finestra anti-loop', () => {
      const err = new TypeError('Failed to fetch dynamically imported module: x.js');
      reloadIfChunkError(err);
      const secondAttempt = reloadIfChunkError(err);

      expect(secondAttempt).toBe(false);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
    });

    it('non ricarica per errori non correlati al chunk loading', () => {
      const err = new TypeError("Cannot read properties of undefined (reading 'foo')");
      const triggered = reloadIfChunkError(err);

      expect(triggered).toBe(false);
      expect(reloadSpy).not.toHaveBeenCalled();
    });
  });
});
