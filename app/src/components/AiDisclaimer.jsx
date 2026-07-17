/**
 * AiDisclaimer — footer non invasivo per i flussi AI (ADR-010 §9, HK-9)
 * Avvisa che i suggerimenti AI sono indicativi e richiedono supervisione umana.
 */
import React from 'react';

const DEFAULT_MSG =
  'I suggerimenti generati dall\u2019intelligenza artificiale sono a scopo indicativo e richiedono sempre la supervisione di un professionista qualificato.';

export default function AiDisclaimer({ message, style }) {
  return (
    <p
      style={{
        fontSize: '0.78rem',
        color: '#78909c',
        fontStyle: 'italic',
        margin: 0,
        ...(style || {}),
      }}
    >
      {message || DEFAULT_MSG}
    </p>
  );
}
