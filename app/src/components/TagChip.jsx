import React from 'react';

/**
 * Determina se il testo deve essere chiaro o scuro in base al colore di sfondo.
 * Usa la luminanza relativa (WCAG 2.x) per garantire contrasto AA.
 */
function getContrastColor(hexBg) {
    if (!hexBg || typeof hexBg !== 'string') return '#333';
    const hex = hexBg.replace('#', '');
    if (hex.length < 6) return '#333';
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    return luminance > 0.4 ? '#1a1a1a' : '#ffffff';
}

const sizeStyles = {
    small: { fontSize: '11px', padding: '2px 6px', gap: '3px' },
    default: { fontSize: '13px', padding: '3px 10px', gap: '5px' },
};

export default function TagChip({ tag, onRemove, size = 'default' }) {
    const color = tag?.color || '#6c757d';
    const textColor = getContrastColor(color);
    const s = sizeStyles[size] || sizeStyles.default;

    return (
        <span
            className="tag-chip"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: s.gap,
                backgroundColor: color,
                color: textColor,
                fontSize: s.fontSize,
                padding: s.padding,
                borderRadius: '12px',
                lineHeight: 1.4,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                maxWidth: '180px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}
            title={tag?.name}
        >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tag?.name}</span>
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: textColor,
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: s.fontSize,
                        lineHeight: 1,
                        opacity: 0.7,
                        display: 'inline-flex',
                        alignItems: 'center',
                    }}
                    aria-label={`Rimuovi tag ${tag?.name}`}
                >
                    ?
                </button>
            )}
        </span>
    );
}
