/**
 * useNcActions - stato condiviso azioni NC (Trattamento + Azioni correttive/preventive)
 *
 * Un'unica fetch/stato per evitare disallineamenti tra le due sezioni del drawer
 * che oggi mostrano sottoinsiemi diversi delle stesse azioni (ISO 10.2.1 a vs c).
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import {
  loadNcResponsibleContacts,
  NC_SCOPE_ATTUAZIONE,
} from "../utils/ncResponsibleContacts";
import { filterActionsByDue, getActionDueStatus } from "../utils/ncWorkflow";

/**
 * @param {{ ncId: number, ncStatus: string, companyId?: number|null, organizationId?: number|null }} params
 */
export function useNcActions({ ncId, ncStatus, companyId = null, organizationId = null }) {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [dueFilter, setDueFilter] = useState("all");
  const [editDraft, setEditDraft] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getNcActions(ncId);
      setActions(res?.data || []);
    } catch {
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [ncId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await loadNcResponsibleContacts(apiService, { companyId, scope: NC_SCOPE_ATTUAZIONE });
        if (!cancelled) setContacts(rows || []);
      } catch {
        if (!cancelled) setContacts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, organizationId]);

  const isClosed = ["closed", "verified"].includes(ncStatus);

  const filteredActions = useMemo(
    () => filterActionsByDue(actions, dueFilter),
    [actions, dueFilter],
  );
  const overdueActionsCount = useMemo(
    () => actions.filter((a) => getActionDueStatus(a) === "overdue").length,
    [actions],
  );
  const dueSoonActionsCount = useMemo(
    () => actions.filter((a) => getActionDueStatus(a) === "due_soon").length,
    [actions],
  );
  const immediateActions = useMemo(
    () => filteredActions.filter((a) => a.action_type === "immediate"),
    [filteredActions],
  );
  const otherActions = useMemo(
    () => filteredActions.filter((a) => a.action_type !== "immediate"),
    [filteredActions],
  );
  const hasCompletedCorrection = useMemo(
    () => actions.some((a) => a.action_type === "immediate" && (a.status === "completed" || a.status === "verified")),
    [actions],
  );

  async function createAction(payload) {
    await apiService.createNcAction(ncId, payload);
    await load();
  }

  async function handleStatus(action, newStatus) {
    await apiService.updateNcAction(ncId, action.action_id, { status: newStatus });
    await load();
  }

  function handleStartEdit(action) {
    setEditDraft({
      actionId: action.action_id,
      responsible: action.responsible || "",
      responsible_contact_id: action.responsible_contact_id || null,
      useExternalResponsible: !action.responsible_contact_id && !!action.responsible,
      due_date: action.due_date ? action.due_date.substring(0, 10) : "",
      saving: false,
      error: null,
    });
  }

  function handleCancelEdit() {
    setEditDraft(null);
  }

  async function handleSaveEdit(action) {
    setEditDraft((d) => ({ ...d, saving: true, error: null }));
    try {
      await apiService.updateNcAction(ncId, action.action_id, {
        responsible: editDraft.useExternalResponsible
          ? editDraft.responsible.trim() || null
          : editDraft.responsible.trim() || null,
        responsible_contact_id: editDraft.useExternalResponsible
          ? null
          : editDraft.responsible_contact_id,
        due_date: editDraft.due_date || null,
      });
      setEditDraft(null);
      await load();
    } catch (err) {
      setEditDraft((d) => ({ ...d, saving: false, error: err?.message || "Errore salvataggio." }));
    }
  }

  async function handleDelete(action) {
    if (!window.confirm(`Eliminare l'azione "${action.description.substring(0, 50)}..."?`)) return;
    try {
      await apiService.deleteNcAction(ncId, action.action_id);
      await load();
    } catch {
      alert("Errore durante l'eliminazione.");
    }
  }

  return {
    actions,
    loading,
    contacts,
    dueFilter,
    setDueFilter,
    editDraft,
    isClosed,
    filteredActions,
    immediateActions,
    otherActions,
    overdueActionsCount,
    dueSoonActionsCount,
    hasCompletedCorrection,
    load,
    createAction,
    handleStatus,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleDelete,
  };
}
