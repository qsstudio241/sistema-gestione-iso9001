/**
 * Custom Checklist Audit View - Phase 6.4 + Approccio misto
 * Mostra sezioni/voci con blocchi evidenza (testo + allegato).
 * Permette di aggiungere sezioni e voci durante l'audit.
 *
 * Fix 23-apr-2026:
 *   - Bug 1: textarea sempre visibile (almeno 1 blocco per item, anche se vuoto)
 *   - Bug 2: bottone "Aggiungi sezione" spostato IN FONDO alla lista (non in cima)
 *   - Bug 3: feedback visivo errori su tutti i form (no più soli console.error)
 *   - UX: auto-scroll al form quando appare; form "aggiungi" apre verso il basso
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import apiService from "../services/apiService";
import { syncService } from "../services/syncService";
import { useStorage } from "../contexts/StorageContext";
import { useAttachmentManager } from "../hooks/useAttachmentManager";
import { QuestionCard } from "./QuestionCard";
import "./CustomChecklistAuditView.css";

const OUTCOME_CODES = ['C', 'OSS', 'NC', 'OM', 'NV', 'NA'];

// Mappa codice esito → classe CSS di ChecklistModule (status-btn system)
const OUTCOME_CSS = {
  C:   'compliant',
  NC:  'non-compliant',
  OSS: 'partial',
  OM:  'om',
  NA:  'not-applicable',
  NV:  'not-verified',
};

// Blocco evidence di default (vuoto) — usato come segnaposto per render
const EMPTY_BLOCK = { text: '', attachment_id: null };

function CustomChecklistAuditView({ audit, onUpdate, readOnly = false }) {
  const customChecklistId = audit?.metadata?.customChecklistId ?? audit?.custom_checklist_id;
  const auditId = audit?.metadata?.auditId ?? audit?.audit_id;
  const { updateCurrentAudit } = useStorage();

  // Gestione allegati unificata: stesso hook della checklist ISO.
  // Ora che attachments ha custom_item_id (migration 047), ogni item custom
  // può usare AttachmentSection/AttachmentPreview esattamente come la ISO.
  const attachmentManager = useAttachmentManager(audit, updateCurrentAudit);

  const [checklist, setChecklist] = useState(null);
  const [responses, setResponses] = useState({}); // custom_item_id -> evidence_blocks[]
  const responsesRef = useRef({}); // ref aggiornato per accesso in closure debounce
  const [statuses, setStatuses] = useState({}); // custom_item_id -> status string|null
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const enqueuedBlobKeysRef = useRef(new Set());
  const lastFlushedAuditIdRef = useRef(null);
  const notesDebounceRef = useRef({});

  // Ref stabile per customResponses iniziali: aggiornato ad ogni render senza
  // essere incluso nelle dipendenze di loadChecklist — evita che updateCurrentAudit
  // (chiamato dal debounce onNotesChange) scateni un reload con setLoading(true).
  const auditCustomResponsesRef = useRef(audit?.customResponses);
  auditCustomResponsesRef.current = audit?.customResponses;

  // Mantieni ref aggiornato per accesso in closure (debounce onNotesChange)
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  // Stato form "Aggiungi sezione" (in fondo alla lista)
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionCode, setNewSectionCode] = useState("");
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [sectionError, setSectionError] = useState(null);
  const addSectionFormRef = useRef(null);

  // Stato form "Aggiungi sotto-punto" (per sezione)
  const [addingItemBySection, setAddingItemBySection] = useState({}); // sectionId -> true
  const [newItemBySection, setNewItemBySection] = useState({}); // sectionId -> { code, title }
  const [itemErrors, setItemErrors] = useState({}); // sectionId -> errorMsg

  const loadChecklist = useCallback(async () => {
    if (!customChecklistId) return;
    try {
      const clRes = await apiService.getCustomChecklist(customChecklistId);
      const clData = clRes?.data ?? null;
      setChecklist(clData);

      // Propaga il template nell'audit globale: metricsCalculator e AuditOutcomeSection
      // usano currentAudit.customChecklist.has_outcome_buttons per decidere se sommare
      // i conteggi custom. Senza questa propagazione, sezione 11 mostra sempre 0.
      if (clData) {
        const propagate = (prev) => ({ ...prev, customChecklist: clData });
        propagate._systemCall = true;
        updateCurrentAudit(propagate, { skipSync: true });
      }

      const localResponses = auditCustomResponsesRef.current ?? {};

      if (!auditId) {
        setResponses(localResponses);
        return;
      }

      const respRes = await apiService.getCustomChecklistResponses(auditId);
      const serverByItem = {};
      const serverStatuses = {};
      (respRes?.data ?? []).forEach((r) => {
        try {
          serverByItem[r.custom_item_id] = typeof r.evidence_blocks === "string"
            ? JSON.parse(r.evidence_blocks || "[]")
            : (r.evidence_blocks || []);
        } catch {
          serverByItem[r.custom_item_id] = [];
        }
        if (r.status) serverStatuses[r.custom_item_id] = r.status;
      });

      // Merge: preserva localResponses per gli item che il server non ha (offline)
      const merged = { ...(localResponses || {}) };
      Object.entries(serverByItem).forEach(([itemId, blocks]) => {
        if ((blocks || []).length > 0) merged[itemId] = blocks;
      });

      setResponses(merged);
      setStatuses((prev) => ({ ...prev, ...serverStatuses }));
    } catch (err) {
      console.error("Errore caricamento checklist custom:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customChecklistId, auditId, updateCurrentAudit]);

  useEffect(() => {
    if (!customChecklistId) return;
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        await loadChecklist();
      } catch {
        /* handled above */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [customChecklistId, auditId, loadChecklist]);

  // Flush risposte locali su server quando auditId diventa disponibile
  useEffect(() => {
    if (!auditId || !customChecklistId) return;
    (async () => {
      try {
        const responseEntries = Object.entries(responses || {});
        if (!responseEntries.length) return;
        if (lastFlushedAuditIdRef.current === auditId) return;
        lastFlushedAuditIdRef.current = auditId;

        const payload = responseEntries
          .filter(([, blocks]) => (blocks || []).some(b => b.text || b.attachment_id)) // salta blocchi vuoti
          .map(([customItemId, evidenceBlocks]) => ({
            custom_item_id: Number(customItemId),
            evidence_blocks: evidenceBlocks,
            ...(statuses[customItemId] != null ? { status: statuses[customItemId] } : {}),
          }));

        if (payload.length) {
          try {
            await apiService.saveCustomChecklistResponses(auditId, payload);
          } catch (err) {
            await syncService.enqueue("save_custom_checklist_responses", { auditId, responses: payload });
          }
        }

        for (const [customItemId, evidenceBlocks] of responseEntries) {
          for (const blk of evidenceBlocks || []) {
            if (!blk?.pending_blobKey || blk?.attachment_id) continue;
            const blobKey = blk.pending_blobKey;
            if (enqueuedBlobKeysRef.current.has(blobKey)) continue;
            enqueuedBlobKeysRef.current.add(blobKey);
            await syncService.enqueue("upload_custom_attachment_and_patch_custom_response", {
              auditId,
              customItemId: Number(customItemId),
              blobKey,
              blockText: blk?.text || "",
              category: "evidence",
              description: "custom checklist evidence (flush)",
            });
          }
        }
      } catch (err) {
        console.warn("[CustomChecklistAuditView] flush fallito:", err?.message || err);
      }
    })();
  }, [auditId, customChecklistId, responses, statuses]);

  // Auto-scroll al form "Aggiungi sezione" quando appare
  useEffect(() => {
    if (addingSection && addSectionFormRef.current) {
      addSectionFormRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [addingSection]);

  const saveResponses = useCallback(
    async (itemId, blocks) => {
      // Non salvare blocchi completamente vuoti (testo vuoto e nessun allegato)
      const nonEmpty = blocks.filter(b => (b.text && b.text.trim()) || b.attachment_id);
      try {
        setSaving(true);
        setResponses((prev) => ({ ...prev, [itemId]: nonEmpty.length > 0 ? nonEmpty : blocks }));

        updateCurrentAudit((prevAudit) => ({
          ...prevAudit,
          customResponses: {
            ...(prevAudit.customResponses || {}),
            [itemId]: nonEmpty.length > 0 ? nonEmpty : blocks,
          },
          metadata: { ...prevAudit.metadata, lastModified: new Date().toISOString() },
        }));

        if (auditId && nonEmpty.length > 0) {
          const payload = { custom_item_id: itemId, evidence_blocks: nonEmpty };
          try {
            await apiService.saveCustomChecklistResponses(auditId, [payload]);
          } catch (err) {
            console.warn("[CustomChecklistAuditView] save fallito, enqueue:", err?.message || err);
            await syncService.enqueue("save_custom_checklist_responses", {
              auditId,
              responses: [payload],
            }).catch(console.error);
          }
        }
      } catch (err) {
        console.error("Errore salvataggio risposte:", err);
      } finally {
        setSaving(false);
      }
    },
    [auditId, updateCurrentAudit]
  );

  const handleStatusChange = useCallback(
    async (itemId, code) => {
      const newStatus = statuses[itemId] === code ? null : code;
      setStatuses((prev) => ({ ...prev, [itemId]: newStatus }));

      // Sincronizza customStatuses su currentAudit in StorageContext
      // → metriche sezione 11 e export Word usano questo campo
      updateCurrentAudit((prev) => ({
        ...prev,
        customStatuses: { ...(prev.customStatuses || {}), [itemId]: newStatus },
      }));

      if (auditId) {
        const blocks = responses[itemId] || [];
        try {
          await apiService.saveCustomChecklistResponses(auditId, [
            { custom_item_id: itemId, evidence_blocks: blocks, status: newStatus },
          ]);
        } catch (err) {
          console.warn("[CustomChecklistAuditView] status fallito, enqueue:", err?.message || err);
          await syncService.enqueue("save_custom_checklist_responses", {
            auditId,
            responses: [{ custom_item_id: itemId, evidence_blocks: blocks, status: newStatus }],
          }).catch(console.error);
        }
      }
    },
    [auditId, responses, statuses, updateCurrentAudit]
  );

  const updateBlock = (itemId, blockIndex, field, value) => {
    const blocks = [...(responses[itemId] || [])];
    if (!blocks[blockIndex]) blocks[blockIndex] = { text: "", attachment_id: null };
    blocks[blockIndex][field] = value;
    setResponses((prev) => ({ ...prev, [itemId]: blocks }));
  };

  const addBlock = (itemId) => {
    const blocks = [...(responses[itemId] || []), { text: "", attachment_id: null }];
    setResponses((prev) => ({ ...prev, [itemId]: blocks }));
    saveResponses(itemId, blocks);
  };

  const removeBlock = (itemId, blockIndex) => {
    const blocks = (responses[itemId] || []).filter((_, i) => i !== blockIndex);
    setResponses((prev) => ({ ...prev, [itemId]: blocks }));
    saveResponses(itemId, blocks);
  };

  const handleFileSelect = async (itemId, blockIndex, file) => {
    if (!file) return;
    const blocks = [...(responses[itemId] || [])];
    if (!blocks[blockIndex]) blocks[blockIndex] = { text: "", attachment_id: null };

    if (!auditId) {
      try {
        const buffer = await file.arrayBuffer();
        const blobKey = `customAtt_${Date.now()}_${file.name}`;
        await syncService.storeFileBlob(blobKey, buffer, { mimeType: file.type, fileName: file.name });
        blocks[blockIndex].pending_blobKey = blobKey;
        blocks[blockIndex].attachment_id = null;
        setResponses((prev) => ({ ...prev, [itemId]: blocks }));
        await saveResponses(itemId, blocks);
      } catch (err) { console.error("Errore allegato offline:", err); }
      return;
    }

    try {
      const res = await apiService.uploadAttachment(file, { auditId, customItemId: itemId, category: "evidence" });
      const attId = res?.data?.attachment_id ?? res?.attachment_id;
      if (attId) {
        blocks[blockIndex].attachment_id = attId;
        delete blocks[blockIndex].pending_blobKey;
        setResponses((prev) => ({ ...prev, [itemId]: blocks }));
        await saveResponses(itemId, blocks);
      }
    } catch (err) {
      try {
        const buffer = await file.arrayBuffer();
        const blobKey = `customAtt_${Date.now()}_${file.name}`;
        await syncService.storeFileBlob(blobKey, buffer, { mimeType: file.type, fileName: file.name });
        blocks[blockIndex].pending_blobKey = blobKey;
        blocks[blockIndex].attachment_id = null;
        setResponses((prev) => ({ ...prev, [itemId]: blocks }));
        await saveResponses(itemId, blocks);
        await syncService.enqueue("upload_custom_attachment_and_patch_custom_response", {
          auditId, customItemId: itemId, blobKey,
          blockText: blocks[blockIndex]?.text || "",
          category: "evidence",
          description: "custom checklist evidence",
        });
      } catch (syncErr) { console.error("Errore upload allegato (offline):", err, syncErr); }
    }
  };

  // ─── Aggiungi sezione ──────────────────────────────────────────────────────

  const handleAddSection = async (e) => {
    e.preventDefault();
    if (!newSectionCode.trim() || !newSectionTitle.trim()) {
      setSectionError("Codice e titolo sono obbligatori.");
      return;
    }
    setSectionError(null);
    try {
      setSaving(true);
      await apiService.createCustomChecklistSection(customChecklistId, {
        code: newSectionCode.trim(),
        title: newSectionTitle.trim(),
        display_order: checklist?.sections?.length ?? 0,
      });
      setNewSectionCode("");
      setNewSectionTitle("");
      setAddingSection(false);
      await loadChecklist();
      onUpdate?.();
    } catch (err) {
      setSectionError(err.message || "Errore durante la creazione della sezione. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Aggiungi sotto-punto ──────────────────────────────────────────────────

  const handleAddItem = async (e, sectionId) => {
    e.preventDefault();
    const draft = newItemBySection[sectionId] || {};
    if (!draft.code?.trim() || !draft.title?.trim()) {
      setItemErrors((prev) => ({ ...prev, [sectionId]: "Codice e titolo sono obbligatori." }));
      return;
    }
    setItemErrors((prev) => ({ ...prev, [sectionId]: null }));
    try {
      setSaving(true);
      await apiService.createCustomChecklistItem(customChecklistId, {
        section_id: sectionId,
        code: draft.code.trim(),
        title: draft.title.trim(),
        response_type: "verbale",
        display_order: 0,
      });
      setNewItemBySection((prev) => { const n = { ...prev }; delete n[sectionId]; return n; });
      setAddingItemBySection((prev) => ({ ...prev, [sectionId]: false }));
      await loadChecklist();
      onUpdate?.();
    } catch (err) {
      setItemErrors((prev) => ({ ...prev, [sectionId]: err.message || "Errore durante la creazione del sotto-punto. Riprova." }));
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!customChecklistId) return null;
  if (loading) return <div className="custom-checklist-loading">Caricamento checklist...</div>;

  const hasNoSections = !(checklist?.sections?.length > 0);

  return (
    <div className={`custom-checklist-audit-view${readOnly ? ' readonly-mode' : ''}`}>
      {!auditId && (
        <div className="custom-checklist-no-audit-id-hint">
          L&apos;audit non è ancora sincronizzato con il server. La struttura è visibile; il salvataggio delle evidenze sarà disponibile dopo la sincronizzazione.
        </div>
      )}
      {saving && <span className="custom-checklist-saving">Salvataggio...</span>}

      {/* Stato vuoto: checklist senza sezioni */}
      {hasNoSections && !addingSection && (
        <div className="custom-checklist-empty-state">
          <p>La checklist non ha ancora sezioni.</p>
          <p className="hint">Clicca &quot;➕ Aggiungi sezione&quot; qui sotto per iniziare.</p>
        </div>
      )}

      {/* Sezioni esistenti */}
      {(checklist?.sections || []).map((sec) => (
        <div key={sec.id} className="custom-checklist-section">
          <h4 className="custom-checklist-section-title">
            {sec.code} — {sec.title}
          </h4>

          {(sec.items || []).map((item) => {
            // Adatta item custom → forma question attesa da QuestionCard
            const question = {
              id: item.id,
              text: `${item.code} — ${item.title}`,
              status: statuses[item.id] || null,
              // notes: primo blocco testo (campo principale item custom)
              notes: responses[item.id]?.[0]?.text || "",
              questionId: null, // custom items non hanno questionId numerico ISO
            };

            // Blocchi evidenza (dal secondo in poi) — restano come contenuto aggiuntivo
            const displayBlocks = responses[item.id]?.length > 0
              ? responses[item.id]
              : [EMPTY_BLOCK];
            const extraBlocks = displayBlocks.slice(1); // primo blocco è gestito da QuestionCard come notes

            return (
              <QuestionCard
                key={item.id}
                question={question}
                displayRef=""
                checklistKey="custom"
                showStatusButtons={!!checklist?.has_outcome_buttons}
                readOnly={readOnly}
                onStatusChange={(code) => handleStatusChange(item.id, code)}
                onNotesChange={(text) => {
                  updateBlock(item.id, 0, "text", text);
                  // Salva con debounce 800ms: evita una chiamata API per ogni tasto
                  const debKey = `notes_${item.id}`;
                  if (notesDebounceRef.current[debKey]) clearTimeout(notesDebounceRef.current[debKey]);
                  notesDebounceRef.current[debKey] = setTimeout(() => {
                    delete notesDebounceRef.current[debKey];
                    // Leggi il valore corrente dal ref (non dallo state che potrebbe essere stale nel closure)
                    const currentBlocks = (responsesRef.current[item.id] || []);
                    const updatedBlocks = currentBlocks.length > 0
                      ? currentBlocks.map((b, i) => i === 0 ? { ...b, text } : b)
                      : [{ text, attachment_id: null }];
                    saveResponses(item.id, updatedBlocks);
                  }, 800);
                }}
                attachmentManager={attachmentManager}
                auditId={auditId}
                customItemId={item.id}
              >
                {/* Blocchi evidenza aggiuntivi (dal secondo in poi) */}
                {extraBlocks.length > 0 && (
                  <div className="custom-checklist-evidence-blocks extra-blocks">
                    {extraBlocks.map((block, extraIdx) => {
                      const idx = extraIdx + 1;
                      return (
                        <div key={idx} className="evidence-block">
                          <textarea
                            className="notes-textarea"
                            value={block.text || ""}
                            onChange={(e) => updateBlock(item.id, idx, "text", e.target.value)}
                            onBlur={() => {
                              const currentBlocks = responses[item.id];
                              if (currentBlocks?.length > 0) saveResponses(item.id, currentBlocks);
                            }}
                            placeholder="Evidenza aggiuntiva..."
                            rows={3}
                            disabled={readOnly}
                          />
                          {!readOnly && (
                            <div className="evidence-block-actions">
                              <label className="btn-attach">
                                📎 Allega
                                <input
                                  type="file"
                                  accept="image/*,.pdf,.doc,.docx"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFileSelect(item.id, idx, f);
                                    e.target.value = "";
                                  }}
                                  style={{ display: "none" }}
                                />
                              </label>
                              {block.attachment_id && (
                                <a href={apiService.getAttachmentViewUrl(block.attachment_id)} target="_blank" rel="noopener noreferrer" className="link-preview">Vedi allegato</a>
                              )}
                              <button type="button" className="btn-remove" onClick={() => removeBlock(item.id, idx)}>Rimuovi</button>
                            </div>
                          )}
                          {readOnly && block.attachment_id && (
                            <div className="evidence-block-actions">
                              <a href={apiService.getAttachmentViewUrl(block.attachment_id)} target="_blank" rel="noopener noreferrer" className="link-preview">Vedi allegato</a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!readOnly && (
                  <button type="button" className="btn-add-evidence" onClick={() => addBlock(item.id)}>
                    ➕ Aggiungi evidenza
                  </button>
                )}
              </QuestionCard>
            );
          })}

          {/* Form aggiungi sotto-punto — in fondo alla sezione (solo se non readOnly) */}
          {!readOnly && (
            addingItemBySection[sec.id] ? (
              <form
                onSubmit={(e) => handleAddItem(e, sec.id)}
                className="custom-checklist-add-item-form"
              >
                <input
                  type="text"
                  value={newItemBySection[sec.id]?.code ?? ""}
                  onChange={(e) => setNewItemBySection((prev) => ({
                    ...prev,
                    [sec.id]: { ...(prev[sec.id] || {}), code: e.target.value },
                  }))}
                  placeholder="Codice (es. 1.1)"
                  required
                  style={{ width: "70px" }}
                  autoFocus
                />
                <input
                  type="text"
                  value={newItemBySection[sec.id]?.title ?? ""}
                  onChange={(e) => setNewItemBySection((prev) => ({
                    ...prev,
                    [sec.id]: { ...(prev[sec.id] || {}), title: e.target.value },
                  }))}
                  placeholder="Titolo sotto-punto"
                  required
                  style={{ flex: 1 }}
                />
                <button type="submit" disabled={saving}>Aggiungi</button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingItemBySection((p) => ({ ...p, [sec.id]: false }));
                    setNewItemBySection((p) => { const n = { ...p }; delete n[sec.id]; return n; });
                    setItemErrors((p) => ({ ...p, [sec.id]: null }));
                  }}
                >
                  Annulla
                </button>
                {itemErrors[sec.id] && (
                  <div className="custom-checklist-form-error">⚠️ {itemErrors[sec.id]}</div>
                )}
              </form>
            ) : (
              <button
                type="button"
                className="btn-add-item"
                onClick={() => setAddingItemBySection((prev) => ({ ...prev, [sec.id]: true }))}
              >
                ➕ Aggiungi sotto-punto
              </button>
            )
          )}
        </div>
      ))}

      {/* Bottone "Aggiungi sezione" IN FONDO alla lista (solo se non readOnly) */}
      {!readOnly && (
        addingSection ? (
          <form
            ref={addSectionFormRef}
            onSubmit={handleAddSection}
            className="custom-checklist-add-section-form"
          >
            <input
              type="text"
              value={newSectionCode}
              onChange={(e) => setNewSectionCode(e.target.value)}
              placeholder="Codice (es. 1.0)"
              required
              style={{ width: "80px" }}
              autoFocus
            />
            <input
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              placeholder="Titolo sezione"
              required
              style={{ flex: 1 }}
            />
            <button type="submit" disabled={saving}>
              {saving ? "Creazione..." : "Crea sezione"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingSection(false);
                setNewSectionCode("");
                setNewSectionTitle("");
                setSectionError(null);
              }}
            >
              Annulla
            </button>
            {sectionError && (
              <div className="custom-checklist-form-error">⚠️ {sectionError}</div>
            )}
          </form>
        ) : (
          <button
            type="button"
            className="btn-add-section"
            onClick={() => { setAddingSection(true); setSectionError(null); }}
          >
            ➕ Aggiungi sezione
          </button>
        )
      )}
    </div>
  );
}

export default CustomChecklistAuditView;
