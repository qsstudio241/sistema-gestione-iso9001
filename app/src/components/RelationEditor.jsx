import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import apiService from '../services/apiService';
import './RelationEditor.css';

const RELATION_TYPES = [
    { value: 'references',    label: 'Riferisce',    icon: '\u{1F517}' },
    { value: 'supersedes',    label: 'Sostituisce',  icon: '\u{1F504}' },
    { value: 'implements',    label: 'Implementa',   icon: '\u{2699}\u{FE0F}' },
    { value: 'requires',      label: 'Richiede',     icon: '\u{279C}' },
    { value: 'attachment_of', label: 'Allegato di',   icon: '\u{1F4CE}' },
];

const typeMap = Object.fromEntries(RELATION_TYPES.map((t) => [t.value, t]));

export default function RelationEditor({
    documentId,
    relations = [],
    onAdd,
    onDelete,
    loading = false,
}) {
    const [adding, setAdding] = useState(false);
    const [relType, setRelType] = useState('references');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        const handleClick = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const searchDocuments = useCallback(async (q) => {
        if (!q || q.length < 2) { setSearchResults([]); return; }
        try {
            const res = await apiService.getDocuments({ search: q, limit: 10 });
            const docs = res?.data ?? res?.documents ?? [];
            setSearchResults(docs.filter((d) => d.id !== documentId));
        } catch {
            setSearchResults([]);
        }
    }, [documentId]);

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        setSelectedDoc(null);
        setShowResults(true);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => searchDocuments(val), 300);
    };

    const handleSelectDoc = (doc) => {
        setSelectedDoc(doc);
        setSearchQuery(doc.title || doc.doc_code || '');
        setShowResults(false);
    };

    const handleConfirm = () => {
        if (!selectedDoc) return;
        onAdd?.(selectedDoc.id, relType, null);
        resetForm();
    };

    const resetForm = () => {
        setAdding(false);
        setRelType('references');
        setSearchQuery('');
        setSearchResults([]);
        setSelectedDoc(null);
        setShowResults(false);
    };

    const grouped = useMemo(() => {
        const map = new Map();
        for (const r of relations) {
            const t = r.relation_type || 'references';
            if (!map.has(t)) map.set(t, []);
            map.get(t).push(r);
        }
        return map;
    }, [relations]);

    return (
        <div className="relation-editor">
            {relations.length === 0 && !adding && (
                <div className="relation-editor__empty">Nessuna relazione</div>
            )}

            {RELATION_TYPES.map(({ value, label, icon }) => {
                const items = grouped.get(value);
                if (!items?.length) return null;
                return (
                    <div className="relation-editor__group" key={value}>
                        <div className="relation-editor__group-title">
                            <span>{icon}</span> {label}
                        </div>
                        {items.map((r) => (
                            <div
                                key={r.id}
                                className={`relation-editor__card relation-editor__card--${value}`}
                            >
                                <span className="relation-editor__icon">{icon}</span>
                                <span className="relation-editor__doc-info">
                                    {r.target_title || r.source_title || `Doc #${r.target_document_id || r.source_document_id}`}
                                    {(r.target_doc_code || r.source_doc_code) && (
                                        <span className="relation-editor__doc-code">
                                            {r.target_doc_code || r.source_doc_code}
                                        </span>
                                    )}
                                </span>
                                {onDelete && (
                                    <button
                                        type="button"
                                        className="relation-editor__delete-btn"
                                        onClick={() => onDelete(r.id)}
                                        disabled={loading}
                                        aria-label="Elimina relazione"
                                    >
                                        ?
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                );
            })}

            {adding ? (
                <div className="relation-editor__inline-form">
                    <select
                        className="relation-editor__select"
                        value={relType}
                        onChange={(e) => setRelType(e.target.value)}
                    >
                        {RELATION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                                {t.icon} {t.label}
                            </option>
                        ))}
                    </select>
                    <div className="relation-editor__search-wrapper" ref={searchRef}>
                        <input
                            className="relation-editor__search-input"
                            type="text"
                            placeholder="Cerca documento…"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            onFocus={() => searchResults.length > 0 && setShowResults(true)}
                        />
                        {showResults && searchResults.length > 0 && (
                            <div className="relation-editor__search-results">
                                {searchResults.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="relation-editor__search-option"
                                        onClick={() => handleSelectDoc(doc)}
                                    >
                                        {doc.title}
                                        {doc.doc_code && (
                                            <span className="relation-editor__search-code">{doc.doc_code}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        className="relation-editor__confirm-btn"
                        onClick={handleConfirm}
                        disabled={!selectedDoc || loading}
                    >
                        Conferma
                    </button>
                    <button
                        type="button"
                        className="relation-editor__cancel-btn"
                        onClick={resetForm}
                    >
                        Annulla
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    className="relation-editor__add-btn"
                    onClick={() => setAdding(true)}
                >
                    ? Aggiungi relazione
                </button>
            )}
        </div>
    );
}
