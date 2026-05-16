import React, { useState, useMemo, useRef, useEffect } from 'react';
import './TagFilterBar.css';

export default function TagFilterBar({
    tags = [],
    activeTagIds = [],
    onToggle,
    onReset,
}) {
    const [showAll, setShowAll] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowAll(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const activeSet = useMemo(() => new Set(activeTagIds), [activeTagIds]);

    const grouped = useMemo(() => {
        const map = new Map();
        for (const t of tags) {
            const catId = t.category_id ?? 0;
            if (!map.has(catId)) map.set(catId, []);
            map.get(catId).push(t);
        }
        return map;
    }, [tags]);

    const topTags = useMemo(() => tags.slice(0, 10), [tags]);

    return (
        <div className="tag-filter-bar">
            {topTags.map((t) => {
                const id = t.tag_id ?? t.id;
                const active = activeSet.has(id);
                const color = t.color || '#6c757d';
                return (
                    <button
                        key={id}
                        type="button"
                        className={`tag-filter-bar__chip ${
                            active ? 'tag-filter-bar__chip--active' : 'tag-filter-bar__chip--inactive'
                        }`}
                        style={
                            active
                                ? { backgroundColor: color, borderColor: color, color: '#fff' }
                                : { borderColor: color, color }
                        }
                        onClick={() => onToggle?.(id)}
                    >
                        {t.name}
                    </button>
                );
            })}

            {tags.length > 10 && (
                <div className="tag-filter-bar__dropdown-wrapper" ref={dropdownRef}>
                    <button
                        type="button"
                        className="tag-filter-bar__all-btn"
                        onClick={() => setShowAll((p) => !p)}
                    >
                        Tutti i tag {"\u25BE"}
                    </button>
                    {showAll && (
                        <div className="tag-filter-bar__dropdown">
                            {[...grouped.entries()].map(([catId, catTags]) => (
                                <React.Fragment key={catId}>
                                    <div className="tag-filter-bar__dropdown-category">
                                        {catTags[0]?.category_name || 'Senza categoria'}
                                    </div>
                                    {catTags.map((t) => {
                                        const id = t.tag_id ?? t.id;
                                        const active = activeSet.has(id);
                                        return (
                                            <div
                                                key={id}
                                                className="tag-filter-bar__dropdown-item"
                                                onClick={() => { onToggle?.(id); }}
                                            >
                                                <span
                                                    className="tag-filter-bar__dropdown-dot"
                                                    style={{ backgroundColor: t.color || '#6c757d' }}
                                                />
                                                {t.name}
                                                {active && <span className="tag-filter-bar__dropdown-check">{"\u2713"}</span>}
                                            </div>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTagIds.length > 0 && (
                <button
                    type="button"
                    className="tag-filter-bar__reset-btn"
                    onClick={onReset}
                >
                    {"\u21BB"} Reset filtri
                </button>
            )}
        </div>
    );
}
