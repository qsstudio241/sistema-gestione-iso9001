import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildChatStorageKey,
  serializeChatMessages,
  deserializeChatMessages,
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
  AI_CHAT_MAX_MESSAGES,
} from '../utils/aiAssistantChatPersist';

describe('aiAssistantChatPersist', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('buildChatStorageKey include org e utente', () => {
    expect(buildChatStorageKey(1001, 42)).toBe('sgq:ai-assistant-messages:1001:42');
    expect(buildChatStorageKey(null, null)).toContain('unknown');
  });

  it('serialize/deserialize mantiene messaggi e date', () => {
    const raw = [
      { role: 'user', text: 'Ciao', time: new Date('2026-05-31T10:00:00Z') },
      {
        role: 'assistant',
        text: 'Risposta',
        time: new Date('2026-05-31T10:00:01Z'),
        citations: [{ entityType: 'document', entityId: '1' }],
        sourcesCount: 1,
      },
      { role: 'loading', text: '...' },
    ];
    const serialized = serializeChatMessages(raw);
    expect(serialized).toHaveLength(2);
    const restored = deserializeChatMessages(serialized);
    expect(restored[0].text).toBe('Ciao');
    expect(restored[0].time).toBeInstanceOf(Date);
    expect(restored[1].citations).toHaveLength(1);
  });

  it('rispetta il cap messaggi', () => {
    const many = Array.from({ length: AI_CHAT_MAX_MESSAGES + 10 }, (_, i) => ({
      role: 'user',
      text: `msg ${i}`,
      time: new Date(),
    }));
    expect(serializeChatMessages(many)).toHaveLength(AI_CHAT_MAX_MESSAGES);
    expect(serializeChatMessages(many)[0].text).toBe('msg 10');
  });

  it('load/save/clear su sessionStorage', () => {
    const key = buildChatStorageKey(1, 2);
    expect(loadChatMessages(key)).toEqual([]);
    saveChatMessages(key, [{ role: 'user', text: 'Test', time: new Date() }]);
    expect(loadChatMessages(key)).toHaveLength(1);
    clearChatMessages(key);
    expect(loadChatMessages(key)).toEqual([]);
  });

  it('ignora errori quota sessionStorage', () => {
    const key = buildChatStorageKey(1, 2);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(saveChatMessages(key, [{ role: 'user', text: 'x', time: new Date() }])).toBe(false);
    spy.mockRestore();
  });
});
