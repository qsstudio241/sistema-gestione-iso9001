/**
 * normattivaToMarkdown.service.js
 * Conversione XML Normattiva → Markdown strutturato.
 * 
 * Output pattern:
 * # D.Lgs. 152/2006 — Testo Unico Ambiente
 * **Fonte**: Normattiva (consolidato)
 * **URN**: urn:nir:stato:decreto.legislativo:2006;152
 * 
 * ## PARTE PRIMA
 * ### Art. 1 — Ambito
 * 1. Il presente decreto...
 */

const logger = require('../utils/logger');

function normalizeArticleNumber(raw) {
  const cleaned = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^art(?:icolo)?\.?\s*/i, '')
    .replace(/\.$/, '')
    .trim();
  return cleaned || '?';
}

function tagInner(xml, tagNames) {
  const names = tagNames.join('|');
  const match = String(xml || '').match(new RegExp(`<(?:${names})\\b[^>]*>([\\s\\S]*?)<\\/(?:${names})>`, 'i'));
  return match ? cleanXmlTags(match[1]) : '';
}

/**
 * Converte XML Normattiva in Markdown strutturato.
 * Accetta NIR (`articolo`/`comma`) e Akoma Ntoso (`article`/`paragraph`).
 * @param {string} xmlText - XML completo del decreto
 * @param {object} metadata - { urn, title, vigenza, dataInizioVigore, dataFineVigore }
 * @returns {string} Markdown strutturato
 */
function convertXmlToMarkdown(xmlText, metadata) {
  try {
    logger.info(`[NormattivaToMarkdown] Conversione in corso per: ${metadata.title}`);

    const lines = [];

    lines.push(`# ${metadata.title || 'Decreto Legislativo'}`);
    lines.push('');
    lines.push('**Fonte**: Normattiva (testo consolidato)');
    lines.push(`**URN**: ${metadata.urn || 'N/D'}`);

    if (metadata.vigenza) {
      lines.push(`**Stato**: ${metadata.vigenza}`);
    }

    if (metadata.dataInizioVigore) {
      lines.push(`**Vigore dal**: ${metadata.dataInizioVigore}`);
    }

    if (metadata.dataFineVigore) {
      lines.push(`**Vigore fino al**: ${metadata.dataFineVigore}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    const articoloRegex = /<(articolo|article)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    const articoli = [];

    let match;
    while ((match = articoloRegex.exec(xmlText)) !== null) {
      const articoloXml = match[2];
      const numero = normalizeArticleNumber(tagInner(articoloXml, ['num']));
      const rubrica = tagInner(articoloXml, ['rubrica', 'heading']);

      const commaRegex = /<(comma|paragraph)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      const commi = [];

      let commaMatch;
      while ((commaMatch = commaRegex.exec(articoloXml)) !== null) {
        const body = commaMatch[2].replace(/<num\b[^>]*>[\s\S]*?<\/num>/i, '');
        const commaText = cleanXmlTags(body);
        if (commaText.trim()) {
          commi.push(commaText.trim());
        }
      }

      if (commi.length === 0) {
        const cleanText = cleanXmlTags(articoloXml);
        if (cleanText.trim()) {
          commi.push(cleanText.trim());
        }
      }

      articoli.push({
        numero,
        rubrica,
        commi,
      });
    }

    if (articoli.length === 0) {
      logger.warn('[NormattivaToMarkdown] Nessun articolo strutturato trovato, fallback testo grezzo');
      const cleanText = cleanXmlTags(xmlText);
      lines.push('## Testo completo');
      lines.push('');
      lines.push(cleanText);
      return lines.join('\n');
    }

    for (const art of articoli) {
      lines.push(`### Art. ${art.numero}${art.rubrica ? ` — ${art.rubrica}` : ''}`);
      lines.push('');

      if (art.commi.length === 1) {
        lines.push(art.commi[0]);
      } else {
        for (let i = 0; i < art.commi.length; i++) {
          lines.push(`${i + 1}. ${art.commi[i]}`);
          lines.push('');
        }
      }

      lines.push('');
    }

    const markdown = lines.join('\n');
    logger.info(`[NormattivaToMarkdown] Conversione completata: ${articoli.length} articoli, ${markdown.length} caratteri`);

    return markdown;
  } catch (err) {
    logger.error('[NormattivaToMarkdown] Errore conversione:', err.message);
    throw new Error(`Errore conversione XML → Markdown: ${err.message}`);
  }
}

/**
 * Rimuove tag XML e decodifica entità HTML.
 * @param {string} text
 * @returns {string}
 */
function cleanXmlTags(text) {
  return text
    .replace(/<[^>]+>/g, ' ')           // Rimuovi tag
    .replace(/&lt;/g, '<')               // Decodifica entità
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')                // Collassa spazi multipli
    .trim();
}

/**
 * Genera filename per il Markdown del decreto.
 * @param {string} urn - es. urn:nir:stato:decreto.legislativo:2008;81
 * @param {string} title - es. "D.Lgs. 81/2008 — Sicurezza"
 * @returns {string} - es. "D_Lgs_81_2008_Sicurezza.md"
 */
function generateMarkdownFilename(urn, title) {
  // Estrai da URN: decreto.legislativo:2008;81 → D_Lgs_81_2008
  const urnMatch = urn.match(/:(decreto\.legislativo|decreto\.legge|legge):(\d+);(\d+)/i);
  
  if (urnMatch) {
    const [, tipo, anno, numero] = urnMatch;
    let prefix = '';
    
    if (tipo === 'decreto.legislativo') {
      prefix = 'D_Lgs';
    } else if (tipo === 'decreto.legge') {
      prefix = 'D_L';
    } else if (tipo === 'legge') {
      prefix = 'Legge';
    }
    
    // Aggiungi descrizione da title (rimuovi caratteri non filesystem-safe)
    let suffix = '';
    if (title) {
      const descMatch = title.match(/—\s*(.+)/);
      if (descMatch) {
        suffix = '_' + descMatch[1]
          .trim()
          .replace(/[^a-zA-Z0-9_\s]/g, '')
          .replace(/\s+/g, '_')
          .substring(0, 30); // Max 30 caratteri descrizione
      }
    }
    
    return `${prefix}_${numero}_${anno}${suffix}.md`;
  }
  
  // Fallback: genera da title
  const safeName = title
    .replace(/[^a-zA-Z0-9_\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
  
  return `${safeName || 'decreto'}.md`;
}

module.exports = {
  convertXmlToMarkdown,
  generateMarkdownFilename,
  cleanXmlTags,
};
