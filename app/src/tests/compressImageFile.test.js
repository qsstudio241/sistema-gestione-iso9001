import { describe, it, expect } from 'vitest';
import { compressImageFile } from '../hooks/useAttachmentManager';

/**
 * Test mirati sulla logica di gating della compressione foto.
 * Coprono i due rami che girano PRIMA di toccare le API browser
 * (Image/Canvas/toBlob), quindi eseguibili in jsdom senza ambiente reale.
 */
describe('compressImageFile - gating', () => {
  it('non comprime file non immagine (ritorna l\'originale)', async () => {
    const pdf = new File(['x'.repeat(500 * 1024)], 'doc.pdf', {
      type: 'application/pdf',
    });
    const result = await compressImageFile(pdf);
    expect(result).toBe(pdf);
  });

  it('salta le immagini gia piccole (< 300KB)', async () => {
    const smallImg = new File(['x'.repeat(100 * 1024)], 'foto.jpg', {
      type: 'image/jpeg',
    });
    const result = await compressImageFile(smallImg);
    expect(result).toBe(smallImg);
  });

  it('rispetta la soglia minSizeToSkip personalizzata', async () => {
    const img = new File(['x'.repeat(50 * 1024)], 'foto.jpg', {
      type: 'image/jpeg',
    });
    const result = await compressImageFile(img, { minSizeToSkip: 10 * 1024 * 1024 });
    expect(result).toBe(img);
  });
});
