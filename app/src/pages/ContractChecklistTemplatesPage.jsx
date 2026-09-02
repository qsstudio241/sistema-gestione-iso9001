/**
 * Template checklist Riesame requisiti — gestione studio (ING-4)
 * Route: /settings/contract-checklist-templates
 * DNA: elenco operativo + scheda (token AppLayout), niente look nuovo.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import apiService from "../services/apiService";
import SgqDataGrid from "../components/SgqDataGrid";
import {
  PRELIMINARY_ITEMS,
  FINAL_ITEMS,
  buildSeedItemsFromDefaults,
  isCoreRef,
} from "../data/commercialChecklistDefaults";
import "./ContractChecklistTemplatesPage.css";

const GRID_COLUMNS = [
  { id: "name", label: "Nome", sortable: true, width: "1.4fr" },
  { id: "scope", label: "Ambito", sortable: true, width: "1fr" },
  { id: "active", label: "Attivo", sortable: true, width: "90px" },
  { id: "actions", label: "Azioni", sortable: false, width: "160px", cellClassName: "cct-cell-actions" },
];

function toEditorItems(items) {
  if (Array.isArray(items) && items.length) {
    return items.map((it, idx) => ({
      phase: it.phase,
      item_ref: it.item_ref,
      item_text: it.item_text,
      sort_order: it.sort_order ?? idx,
      is_core: !!(it.is_core === true || it.is_core === 1 || isCoreRef(it.phase, it.item_ref)),
    }));
  }
  return buildSeedItemsFromDefaults();
}

export default function ContractChecklistTemplatesPage() {
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(null); // null | { mode, id?, name, company_id, is_active, items, phaseTab }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tplRes, companyRes] = await Promise.all([
        apiService.listCommercialChecklistTemplates(),
        apiService.getCompanies({ limit: 500 }),
      ]);
      const list = tplRes?.data ?? tplRes ?? [];
      setRows(Array.isArray(list) ? list : []);
      const cos = companyRes?.data ?? companyRes ?? [];
      setCompanies(Array.isArray(cos) ? cos : []);
    } catch (err) {
      setError(err.message || "Caricamento template fallito");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditor({
      mode: "create",
      name: "Checklist riesame (studio)",
      company_id: "",
      is_active: true,
      items: buildSeedItemsFromDefaults(),
      phaseTab: "preliminary",
    });
  };

  const openEdit = async (id) => {
    setError(null);
    try {
      const res = await apiService.getCommercialChecklistTemplate(id);
      const tpl = res?.data ?? res;
      setEditor({
        mode: "edit",
        id: tpl.id,
        name: tpl.name || "",
        company_id: tpl.company_id != null ? String(tpl.company_id) : "",
        is_active: !!tpl.is_active,
        items: toEditorItems(tpl.items),
        phaseTab: "preliminary",
      });
    } catch (err) {
      setError(err.message || "Dettaglio template non disponibile");
    }
  };

  const phaseItems = useMemo(() => {
    if (!editor) return [];
    return editor.items.filter((i) => i.phase === editor.phaseTab);
  }, [editor]);

  const updateItemText = (ref, text) => {
    setEditor((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.phase === prev.phaseTab && it.item_ref === ref
          ? { ...it, item_text: text.slice(0, 500) }
          : it
      ),
    }));
  };

  const addExtra = () => {
    setEditor((prev) => {
      const phase = prev.phaseTab;
      const prefix = phase === "preliminary" ? "P" : "F";
      const existingNums = prev.items
        .filter((i) => i.phase === phase)
        .map((i) => parseInt(String(i.item_ref).replace(/^[PF]/i, ""), 10))
        .filter((n) => Number.isFinite(n));
      const nextNum = (existingNums.length ? Math.max(...existingNums) : (phase === "preliminary" ? 10 : 6)) + 1;
      const ref = `${prefix}${nextNum}`;
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            phase,
            item_ref: ref,
            item_text: "",
            sort_order: prev.items.filter((i) => i.phase === phase).length,
            is_core: false,
          },
        ],
      };
    });
  };

  const removeExtra = (ref) => {
    setEditor((prev) => ({
      ...prev,
      items: prev.items.filter(
        (it) => !(it.phase === prev.phaseTab && it.item_ref === ref && !it.is_core)
      ),
    }));
  };

  const saveEditor = async () => {
    if (!editor?.name?.trim()) {
      setError("Nome template obbligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: editor.name.trim(),
        company_id: editor.company_id ? Number(editor.company_id) : null,
        is_active: !!editor.is_active,
        items: editor.items.map((it, idx) => ({
          phase: it.phase,
          item_ref: it.item_ref,
          item_text: it.item_text,
          sort_order: it.sort_order ?? idx,
          is_core: !!it.is_core,
        })),
      };
      if (editor.mode === "create") {
        await apiService.createCommercialChecklistTemplate(payload);
      } else {
        await apiService.updateCommercialChecklistTemplate(editor.id, payload);
      }
      setEditor(null);
      await load();
    } catch (err) {
      setError(err.message || "Salvataggio fallito");
    } finally {
      setSaving(false);
    }
  };

  const removeTemplate = async (id) => {
    if (!window.confirm("Eliminare questo template? I casi già snapshotati non cambiano.")) return;
    setError(null);
    try {
      await apiService.deleteCommercialChecklistTemplate(id);
      await load();
    } catch (err) {
      setError(err.message || "Eliminazione fallita");
    }
  };

  const gridRows = rows.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.company_id
      ? r.company_name || `Azienda #${r.company_id}`
      : "Default studio (tutti i clienti)",
    active: r.is_active ? "Sì" : "No",
    actions: (
      <span className="cct-row-actions">
        <button type="button" className="btn-secondary" onClick={() => openEdit(r.id)}>
          Modifica
        </button>
        <button type="button" className="btn-secondary" onClick={() => removeTemplate(r.id)}>
          Elimina
        </button>
      </span>
    ),
  }));

  return (
    <div className="cct-page">
      <header className="cct-header">
        <div>
          <h1>Template checklist riesame</h1>
          <p className="cct-intro">
            Personalizza le voci P/F del Riesame requisiti per cliente. Le voci core ISO 9001 §8.2
            restano obbligatorie; puoi variare il testo o aggiungere voci studio. All&apos;applicazione
            sul caso viene creato uno snapshot: le checklist già compilate non vengono sovrascritte.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          Nuovo template
        </button>
      </header>

      {error && <div className="cct-error" role="alert">{error}</div>}

      {loading ? (
        <p className="cct-muted">Caricamento…</p>
      ) : (
        <SgqDataGrid columns={GRID_COLUMNS} rows={gridRows} emptyMessage="Nessun template: usa Nuovo template (seed §8.2)." />
      )}

      {editor && (
        <div className="cct-editor" role="region" aria-label="Editor template">
          <h2>{editor.mode === "create" ? "Nuovo template" : `Modifica #${editor.id}`}</h2>
          <div className="cct-form-row">
            <label>
              Nome
              <input
                type="text"
                value={editor.name}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                maxLength={200}
              />
            </label>
            <label>
              Cliente (opzionale)
              <select
                value={editor.company_id}
                onChange={(e) => setEditor({ ...editor, company_id: e.target.value })}
              >
                <option value="">Default studio</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.ragione_sociale || `#${c.id}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="cct-check">
              <input
                type="checkbox"
                checked={!!editor.is_active}
                onChange={(e) => setEditor({ ...editor, is_active: e.target.checked })}
              />
              Attivo (un solo attivo per ambito)
            </label>
          </div>

          <div className="cct-phase-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={editor.phaseTab === "preliminary" ? "active" : ""}
              aria-selected={editor.phaseTab === "preliminary"}
              onClick={() => setEditor({ ...editor, phaseTab: "preliminary" })}
            >
              Preliminare ({PRELIMINARY_ITEMS.length}+)
            </button>
            <button
              type="button"
              role="tab"
              className={editor.phaseTab === "final" ? "active" : ""}
              aria-selected={editor.phaseTab === "final"}
              onClick={() => setEditor({ ...editor, phaseTab: "final" })}
            >
              Finale ({FINAL_ITEMS.length}+)
            </button>
          </div>

          <ul className="cct-item-list">
            {phaseItems.map((it) => (
              <li key={`${it.phase}-${it.item_ref}`} className={it.is_core ? "cct-item-core" : "cct-item-extra"}>
                <span className="cct-ref" title={it.is_core ? "Voce core ISO §8.2" : "Voce studio"}>
                  {it.item_ref}
                  {it.is_core ? " · core" : " · extra"}
                </span>
                <input
                  type="text"
                  className="notes-textarea cct-item-text"
                  value={it.item_text}
                  onChange={(e) => updateItemText(it.item_ref, e.target.value)}
                  maxLength={500}
                />
                {!it.is_core && (
                  <button type="button" className="btn-secondary" onClick={() => removeExtra(it.item_ref)}>
                    Rimuovi
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="cct-editor-actions">
            <button type="button" className="btn-secondary" onClick={addExtra}>
              Aggiungi voce studio
            </button>
            <div className="cct-editor-actions-right">
              <button type="button" className="btn-secondary" onClick={() => setEditor(null)} disabled={saving}>
                Annulla
              </button>
              <button type="button" className="btn-primary" onClick={saveEditor} disabled={saving}>
                {saving ? "Salvataggio…" : "Salva template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
