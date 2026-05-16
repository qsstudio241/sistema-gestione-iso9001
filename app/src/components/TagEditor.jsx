import React, { useState, useRef, useEffect, useMemo } from 'react';
import TagChip from './TagChip';
import './TagEditor.css';

export default function TagEditor({
    documentId,
    tags = [],
    allTags = [],
    categories = [],
    onAssign,
    onRemove,
    onCreate,
    suggestions = [],
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const assignedIds = useMemo(
        () => new Set(tags.map((t) => t.tag_id ?? t.id)),
        [tags]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return allTags.filter((t) => {
            if (assignedIds.has(t.tag_id ?? t.id)) return false;
            if (!q) return true;
            return (t.name || '').toLowerCase().includes(q);
        });
    }, [allTags, assignedIds, query]);

    const grouped = useMemo(() => {
        const map = new Map();
        for (const t of filtered) {
            const catId = t.category_id ?? 0;
            if (!map.has(catId)) map.set(catId, []);
            map.get(catId).push(t);
        }
        return map;
    }, [filtered]);

    const exactMatch = useMemo(
        () => allTags.some((t) => (t.name || '').toLowerCase() === query.trim().toLowerCase()),
        [allTags, query]
    );

    const unassignedSuggestions = useMemo(
        () => suggestions.filter((s) => !assignedIds.has(s.tag_id ?? s.id)),
        [suggestions, assignedIds]
    );

    const categoryName = (catId) => {
        const cat = categories.find((c) => (c.id ?? c.category_id) === catId);
        return cat?.name || 'Senza categoria';
    };

    const handleSelect = (tag) => {
        onAssign?.(tag.tag_id ?? tag.id);
        setQuery('');
        setOpen(false);
    };

    const handleCreate = () => {
        const name = query.trim();
        if (!name) return;
        onCreate?.(name, null, null);
        setQuery('');
        setOpen(false);
    };

    return (
        <div className="tag-editor" ref={wrapperRef}>
            <div className="tag-editor__assigned">
                {tags.map((t) => (
                    <TagChip
                        key={t.tag_id ?? t.id}
                        tag={t}
                        onRemove={onRemove ? () => onRemove(t.tag_id ?? t.id) : undefined}
                    />
                ))}
            </div>
            <div className="tag-editor__input-wrapper">
                <input
                    className="tag-editor__input"
                    type="text"
                    placeholder="Cerca o crea tag"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                />
                {open && (
                    <div className="tag-editor__dropdown">
                        {unassignedSuggestions.length > 0 && !query.trim() && (
                            <>
                                <div className="tag-editor__suggestions-label">
                                    ? Suggeriti
                                </div>
                                {unassignedSuggestions.map((s) => (
                                    <div
                                        key={s.tag_id ?? s.id}
                                        className="tag-editor__option"
                                        onClick={() => handleSelect(s)}
                                    >
                                        <span
                                            className="tag-editor__color-dot"
                                            style={{ backgroundColor: s.color || '#6c757d' }}
                                        />
                                        {s.name}
                                    </div>
                                ))}
                            </>
                        )}

                        {[...grouped.entries()].map(([catId, catTags]) => (
                            <React.Fragment key={catId}>
                                <div className="tag-editor__category-label">
                                    {categoryName(catId)}
                                </div>
                                {catTags.map((t) => (
                                    <div
                                        key={t.tag_id ?? t.id}
                                        className="tag-editor__option"
                                        onClick={() => handleSelect(t)}
                                    >
                                        <span
                                            className="tag-editor__color-dot"
                                            style={{ backgroundColor: t.color || '#6c757d' }}
                                        />
                                        {t.name}
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}

                        {filtered.length === 0 && unassignedSuggestions.length === 0 && !query.trim() && (
                            <div className="tag-editor__empty">Nessun tag disponibile</div>
                        )}

                        {query.trim() && !exactMatch && (
                            <div
                                className="tag-editor__option tag-editor__option--create"
                                onClick={handleCreate}
                            >
                                ? Crea tag &ldquo;{query.trim()}&rdquo;
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
