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

/**
 * Converte XML Normattiva in Markdown strutturato.
 * @param {string} xmlText - XML completo del decreto
 * @param {object} metadata - { urn, title, vigenza, dataInizioVigore, dataFineVigore }
 * @returns {string} Markdown strutturato
 */
function convertXmlToMarkdown(xmlText, metadata) {
  try {
    logger.info(`[NormattivaToMarkdown] Conversione in corso per: ${metadata.title}`);
    
    // Parsing XML basilare (in produzione: xmldom o xml2js)
    // Per MVP: estrazione testuale con regex
    
    const lines = [];
    
    // Header
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
    
    // Parsing articoli
    // Pattern tipico XML Normattiva: <articolo id="..."><num>1</num><rubrica>Ambito</rubrica><comma>...</comma></articolo>
    
    const articoloRegex = /<articolo[^>]*>([\s\S]*?)<\/articolo>/gi;
    const articoli = [];
    
    let match;
    while ((match = articoloRegex.exec(xmlText)) !== null) {
      const articoloXml = match[1];
      
      // Estrai numero articolo
      const numMatch = articoloXml.match(/<num>([^<]+)<\/num>/i);
      const numero = numMatch ? numMatch[1].trim() : '?';
      
      // Estrai rubrica (titolo articolo)
      const rubricaMatch = articoloXml.match(/<rubrica>([^<]+)<\/rubrica>/i);
      const rubrica = rubricaMatch ? rubricaMatch[1].trim() : '';
      
      // Estrai commi
      const commaRegex = /<comma[^>]*>([\s\S]*?)<\/comma>/gi;
      const commi = [];
      
      let commaMatch;
      while ((commaMatch = commaRegex.exec(articoloXml)) !== null) {
        const commaText = cleanXmlTags(commaMatch[1]);
        if (commaText.trim()) {
          commi.push(commaText.trim());
        }
      }
      
      // Se nessun comma esplicito, prendi tutto il testo dell'articolo
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
    
    // Se non troviamo articoli strutturati, fallback: estrai tutto il testo
    if (articoli.length === 0) {
      logger.warn('[NormattivaToMarkdown] Nessun articolo strutturato trovato, fallback testo grezzo');
      const cleanText = cleanXmlTags(xmlText);
      lines.push('## Testo completo');
      lines.push('');
      lines.push(cleanText);
      return lines.join('\n');
    }
    
    // Genera Markdown da articoli
    for (const art of articoli) {
      lines.push(`### Art. ${art.numero}${art.rubrica ? ` — ${art.rubrica}` : ''}`);
      lines.push('');
      
      if (art.commi.length === 1) {
        // Un solo comma: paragrafo semplice
        lines.push(art.commi[0]);
      } else {
        // Più commi: lista numerata
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
