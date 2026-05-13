import { useState, useCallback } from 'react';
import apiService from '../services/apiService';

export default function useDocumentTags(documentId) {
    const [tags, setTags] = useState([]);
    const [allTags, setAllTags] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadTags = useCallback(async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const res = await apiService.getDocumentRelations(documentId);
            const docTags = res?.data?.tags ?? res?.tags ?? [];
            setTags(docTags);
        } catch (err) {
            console.error('[useDocumentTags] loadTags failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    const loadAllTags = useCallback(async () => {
        try {
            const res = await apiService.getDocumentTags();
            setAllTags(res?.data ?? res?.tags ?? []);
            const catRes = await apiService.getTagCategories();
            setCategories(catRes?.data ?? catRes?.categories ?? []);
        } catch (err) {
            console.error('[useDocumentTags] loadAllTags failed:', err.message);
        }
    }, []);

    const assignTag = useCallback(async (tagId) => {
        if (!documentId) return;
        setLoading(true);
        try {
            await apiService.assignDocumentTags(documentId, [tagId]);
            await loadTags();
        } catch (err) {
            console.error('[useDocumentTags] assignTag failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId, loadTags]);

    const removeTag = useCallback(async (tagId) => {
        if (!documentId) return;
        setLoading(true);
        try {
            await apiService.removeDocumentTag(documentId, tagId);
            setTags(prev => prev.filter(t => (t.tag_id ?? t.id) !== tagId));
        } catch (err) {
            console.error('[useDocumentTags] removeTag failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId]);

    const createTag = useCallback(async (name, categoryId, color) => {
        if (!documentId) return;
        setLoading(true);
        try {
            const res = await apiService.createDocumentTag({ name, category_id: categoryId, color });
            const newTag = res?.data ?? res?.tag;
            if (newTag) {
                setAllTags(prev => [...prev, newTag]);
                await apiService.assignDocumentTags(documentId, [newTag.id ?? newTag.tag_id]);
                await loadTags();
            }
        } catch (err) {
            console.error('[useDocumentTags] createTag failed:', err.message);
        } finally {
            setLoading(false);
        }
    }, [documentId, loadTags]);

    const suggestTags = useCallback(async () => {
        if (!documentId) return [];
        try {
            const res = await apiService.get(`/documents/${documentId}/tags/suggestions`);
            return res?.data ?? res?.suggestions ?? [];
        } catch (err) {
            console.error('[useDocumentTags] suggestTags failed:', err.message);
            return [];
        }
    }, [documentId]);

    return {
        tags, allTags, categories, loading,
        assignTag, removeTag, createTag,
        loadTags, loadAllTags, suggestTags,
    };
}
