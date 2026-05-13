import { useState, useCallback } from 'react';
import apiService from '../services/apiService';

export default function useDocumentRelations(documentId) {
    const [relations, setRelations] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadRelations = useCallback(async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const res = await apiService.getDocumentRelations(documentId);
            setRelations(res?.data ?? res?.relations ?? []);
        } catch (err) {
            console.error('[useDocumentRelations] loadRelations failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    const createRelation = useCallback(async (targetDocId, relationType, notes) => {
        if (!documentId) return;
        setLoading(true);
        try {
            await apiService.createDocumentRelation(documentId, {
                target_document_id: targetDocId,
                relation_type: relationType,
                notes,
            });
            await loadRelations();
        } catch (err) {
            console.error('[useDocumentRelations] createRelation failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId, loadRelations]);

    const deleteRelation = useCallback(async (relationId) => {
        setLoading(true);
        try {
            await apiService.deleteDocumentRelation(relationId);
            setRelations(prev => prev.filter(r => r.id !== relationId));
        } catch (err) {
            console.error('[useDocumentRelations] deleteRelation failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    return { relations, loading, loadRelations, createRelation, deleteRelation };
}
