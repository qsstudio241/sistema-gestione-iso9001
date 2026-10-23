import { describe, it, expect } from 'vitest';
import { loadErrorMessage } from './loadErrorMessage';

describe('loadErrorMessage', () => {
  it('traduce il 429', () => {
    expect(loadErrorMessage({ status: 429 })).toBe('Troppe richieste, riprova tra poco');
    expect(loadErrorMessage({ code: 'RATE_LIMIT_API' })).toBe('Troppe richieste, riprova tra poco');
  });

  it('gli altri errori non parlano di lista vuota', () => {
    expect(loadErrorMessage({ status: 500 })).toMatch(/restano in pagina/);
  });
});
