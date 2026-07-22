/**
 * Test integrazione export Word NC (docxtemplater reale + template su disco)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import PizZip from 'pizzip';
import { generateNcDocxBlob } from '../utils/ncWordExport.js';

const templatePath = path.join(process.cwd(), 'public/templates/NC-scheda.docx');

vi.mock('file-saver', () => ({ saveAs: vi.fn(), default: { saveAs: vi.fn() } }));

describe('ncWordExport integration', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('NC-scheda.docx')) {
        const buf = fs.readFileSync(templatePath);
        return { ok: true, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
      }
      return { ok: false, status: 404 };
    }));
  });

  it('renderizza correzione e incorpora immagine nel docx', async () => {
    const bytes = await generateNcDocxBlob(
      { nc_number: 'NC-QS-260515-01-015', client_name: 'Cliente', description: 'Desc NC' },
      [{
        action_type: 'immediate',
        status: 'in_progress',
        description: 'Pianificata formazione dei preposti',
        responsible: 'HSE',
        due_date: '2026-07-18',
      }],
      [{
        attachment_id: 99,
        file_name: 'foto.jpg',
        mime_type: 'image/jpeg',
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFhUVFRUYFxgXFxgXGBgXGBcYGBgYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAEBAQEAAAAAAAAAAAAAAAAAAQIE/8QAFhEBAQEAAAAAAAAAAAAAAAAAABEB/9oADAMBAAIQAxAAAAG6P//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
        imageMimeType: 'image/jpeg',
      }],
      { templateUrl: 'https://example.com/templates/NC-scheda.docx', outputType: 'uint8array' },
    );

    const zip = new PizZip(bytes);
    const xml = zip.files['word/document.xml'].asText();
    expect(xml).toContain('Pianificata formazione dei preposti');
    expect(xml).not.toContain('NC_ATTACHMENTS_MARKER');
    expect(/wp:inline|a:blip/.test(xml)).toBe(true);
  });
});
