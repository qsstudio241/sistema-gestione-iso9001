import React, { useState } from "react";
import { useNavigate } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import { useStorage } from "../contexts/StorageContext";
import apiService from "../services/apiService";
import {
  downloadAuditJSON,
  downloadAllAuditsJSON,
  downloadAuditSummaryJSON,
  downloadAuditSummaryCSV,
} from "../utils/exportManager";
import {
  exportAuditToWord,
  exportAuditToFileSystem,
  exportAuditToWorkspace,
} from "../utils/wordExport";
import "./ExportPanel.css";

const ExportPanel = () => {
  const { user, hasLicensedModule } = useAuth();
  const { currentAudit, audits, fsProvider, importBackup } = useStorage();
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  // null = auto-detect per standard (ISO 3834 → embed, altri → link)
  // true/false = scelta esplicita dell'utente
  const [embedPhotos, setEmbedPhotos] = useState(null);

  const PHOTO_STANDARDS = ['ISO_3834', 'ISO_3834_2', 'ISO_3834_2_2021', 'RDP_MSN'];

  /** Calcola il photoMode effettivo: rispetta la scelta utente, altrimenti auto. */
  const resolvePhotoMode = (standardKey, customChecklistId) => {
    if (embedPhotos === true)  return 'preview';
    if (embedPhotos === false) return undefined;
    // auto-detect
    if (customChecklistId)    return 'preview';
    if (!standardKey)         return undefined;
    return (PHOTO_STANDARDS.includes(standardKey) || String(standardKey).includes('3834'))
      ? 'preview' : undefined;
  };

  /** Restituisce true se l'audit corrente ha almeno uno standard con foto (auto). */
  const auditHasPhotoStandard = () => {
    const stds = currentAudit?.metadata?.selectedStandards || [];
    const customId = currentAudit?.metadata?.customChecklistId ?? currentAudit?.custom_checklist_id;
    if (customId) return true;
    return stds.some(s => PHOTO_STANDARDS.includes(s) || String(s).includes('3834'));
  };

  /** Valore effettivo del checkbox (considerando anche null = auto). */
  const embedPhotosEffective = embedPhotos !== null ? embedPhotos : auditHasPhotoStandard();

  // Development mode - mostra formati avanzati JSON/CSV
  const isDev = process.env.NODE_ENV === "development";

  const showMessage = (message, type = "success") => {
    setExportMessage({ text: message, type });
    setTimeout(() => setExportMessage(null), 5000);
  };

  const handleExportCurrent = (format) => {
    if (!currentAudit) return;

    switch (format) {
      case "json-full":
        downloadAuditJSON(currentAudit);
        break;
      case "json-summary":
        downloadAuditSummaryJSON(currentAudit);
        break;
      case "csv":
        downloadAuditSummaryCSV(currentAudit);
        break;
      default:
        break;
    }
  };

  /**
   * Prepara l'audit per l'export: fetch allegati e rilievi dal server,
   * costruisce getViewUrl con token. Condivisa da entrambi i pulsanti.
   */
  const prepareAuditForExport = async () => {
    const auditForExport = { ...currentAudit };
    const auditorFb = user?.full_name?.trim();
    const isAuditorPlaceholder = (v) => {
      const t = String(v || "").trim().toLowerCase();
      return (
        !t ||
        t === "non specificato" ||
        t === "n/d" ||
        t === "n.d." ||
        t === "nd"
      );
    };
    if (auditorFb && isAuditorPlaceholder(auditForExport.metadata?.auditorName)) {
      auditForExport.metadata = {
        ...auditForExport.metadata,
        auditorName: auditorFb,
      };
    }
    // Priorità a auditId numerico (integer DB) — stesso ordine di useAttachmentManager.js
    const auditId = currentAudit.metadata?.auditId || currentAudit.metadata?.id || currentAudit.id;

    // 1) Preferisci GET /audits/:id/pending-issues (tab. pending_issues + NC) — Fase 0.5 roadmap
    try {
      if (auditId != null && String(auditId).trim() !== "") {
        const pendRes = await apiService.getPendingIssues(auditId);
        const list = pendRes?.pending_issues;
        if (Array.isArray(list) && list.length > 0) {
          auditForExport.pendingIssues = list.map((p) => ({
            clause:
              p.requirement_reference ||
              (p.section_id != null && p.section_id !== "" ? String(p.section_id) : "") ||
              "",
            description: p.nc_description || "",
            originAuditNumber:
              p.nc_number || (p.source_audit_id ? `#${p.source_audit_id}` : "—"),
            issue_status: p.issue_status || "open",
            status: p.issue_status || "open",
            resolutionNotes: p.follow_up_notes || "",
            source_audit_id: p.source_audit_id,
          }));
          console.log(
            `📋 [EXPORT] ${list.length} rilievi pendenti da GET /audits/.../pending-issues`
          );
        }
      }
    } catch (err) {
      console.warn("[EXPORT] pending-issues API non disponibile:", err.message);
    }

    // Dati azienda da anagrafica (nome+indirizzo): usati nel report fornitore quando disponibili
    try {
      const companyId = currentAudit?.metadata?.companyId;
      if (companyId) {
        const companyRes = await apiService.getCompany(companyId);
        const company = companyRes?.data || companyRes || {};
        const companyName = String(company?.name || "").trim();
        const companyAddress = String(company?.address || "").trim();
        if (companyName || companyAddress) {
          auditForExport.metadata = {
            ...(auditForExport.metadata || {}),
            exportCompanyName: companyName || "",
            exportCompanyAddress: companyAddress || "",
          };
        }
      }
    } catch (err) {
      console.warn("[EXPORT] anagrafica azienda non disponibile:", err.message);
    }

    // 2) Fallback: rilievi da audit_responses ultimo audit stesso cliente (se pending_issues vuoto)
    try {
      if (!auditForExport.pendingIssues?.length) {
        const clientName = currentAudit.metadata?.clientName;
        const auditUuid = currentAudit.metadata?.id || null;
        if (clientName) {
          const reauditInfo = await apiService.checkReaudit(clientName, auditUuid);
          if (reauditInfo.has_previous_audit && reauditInfo.last_audit_id) {
            const ncData = await apiService.getNcResponses(reauditInfo.last_audit_id);
            const rawIssues = (ncData.responses || []).filter(
              (i) => i.conformity_status !== "OM"
            );
            if (rawIssues.length > 0) {
              auditForExport.pendingIssues = rawIssues.map((i) => ({
                clause: i.section_code || "",
                description: i.question_text || `Domanda ${i.question_id}`,
                originAuditNumber:
                  reauditInfo.last_audit_number || `#${reauditInfo.last_audit_id}`,
                status: "open",
                resolutionNotes: i.notes || "",
              }));
              console.log(
                `📋 [EXPORT] ${rawIssues.length} rilievi pendenti da audit_responses (fallback)`
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn("[EXPORT] pending issues fallback non disp., uso locali:", err.message);
    }

    // Fetch rilievi ente certificatore
    try {
      const companyId  = currentAudit?.metadata?.companyId;
      const _stds = currentAudit?.metadata?.selectedStandards || [];
      const _ckKeys = Object.keys(currentAudit?.checklist || {});
      const _has = (code) => _stds.some(s => String(s).includes(code)) || _ckKeys.some(k => k.includes(code));
      const standardId = _has('14001') ? 2 : _has('45001') ? 3 : 1;
      if (companyId) {
        const cfRes = await apiService.get(
          `/companies/${companyId}/certification-findings?standard_id=${standardId}`
        );
        auditForExport.certificationFindings = cfRes.data || [];
        console.log(`📋 [EXPORT] ${auditForExport.certificationFindings.length} rilievi ente certificatore`);
      }
    } catch (err) {
      console.warn('[EXPORT] rilievi ente non disp.:', err.message);
      auditForExport.certificationFindings = [];
    }

    // Fetch checklist custom + risposte (per audit con customChecklistId)
    // Merge server + IndexedDB: il report deve usare i dati più completi (offline-first).
    const localCustomResponses = currentAudit?.customResponses && typeof currentAudit.customResponses === "object"
      ? { ...currentAudit.customResponses }
      : {};
    const mergeCustomResponsesForExport = (serverByItem) => {
      const merged = { ...localCustomResponses };
      const normalizeBlocks = (b) => (Array.isArray(b) ? b : []);
      Object.entries(serverByItem || {}).forEach(([idStr, serverBlocks]) => {
        const idNum = Number(idStr);
        const key = Number.isFinite(idNum) ? idNum : idStr;
        const srv = normalizeBlocks(
          typeof serverBlocks === "string"
            ? (() => { try { return JSON.parse(serverBlocks || "[]"); } catch { return []; } })()
            : serverBlocks
        );
        const loc = normalizeBlocks(merged[key] ?? merged[idStr]);
        // Server vince se ha blocchi; altrimenti restano i dati locali (salvati prima del sync)
        merged[key] = srv.length > 0 ? srv : (loc.length > 0 ? loc : srv);
      });
      return merged;
    };

    const customChecklistId = currentAudit?.metadata?.customChecklistId ?? currentAudit?.custom_checklist_id;
    if (customChecklistId) {
      try {
        const [clRes, respRes] = await Promise.all([
          apiService.getCustomChecklist(customChecklistId),
          apiService.getCustomChecklistResponses(auditId),
        ]);
        auditForExport.customChecklist = clRes?.data ?? null;
        const byItem = {};
        const byStatus = {}; // fix: r.status era ignorato → export senza badge/riepilogo esiti
        (respRes?.data ?? []).forEach((r) => {
          try {
            byItem[r.custom_item_id] = typeof r.evidence_blocks === "string"
              ? JSON.parse(r.evidence_blocks || "[]")
              : (r.evidence_blocks || []);
          } catch {
            byItem[r.custom_item_id] = [];
          }
          if (r.status) byStatus[r.custom_item_id] = r.status;
        });
        auditForExport.customResponses = mergeCustomResponsesForExport(byItem);
        auditForExport.customStatuses = byStatus;
        console.log(
          `📋 [EXPORT] Checklist custom: ${Object.keys(byItem).length} righe, ${Object.keys(byStatus).length} esiti, merge locale (${Object.keys(localCustomResponses).length} chiavi)`
        );
      } catch (err) {
        console.warn('[EXPORT] Checklist custom non disp.:', err.message);
        auditForExport.customResponses = Object.keys(localCustomResponses).length
          ? localCustomResponses
          : (auditForExport.customResponses ?? {});
        auditForExport.customStatuses = auditForExport.customStatuses ?? {};
      }
    }

    // Fetch allegati dal server e normalizza in formato wordExport (camelCase)
    try {
      const rawAtts = await apiService.getAttachments(auditId);
      const serverAtts = Array.isArray(rawAtts) ? rawAtts : (rawAtts?.data ?? rawAtts?.attachments ?? []);
      if (serverAtts?.length > 0) {
        const normalized = serverAtts.map(att => ({
          id:                 att.attachment_id,
          questionId:         att.question_id,
          customItemId:       att.custom_item_id ?? null,
          name:               att.file_name,
          fileName:           att.file_name,
          fileSize:           att.file_size,
          mimeType:           att.mime_type,
          category:           att.category,
          description:        att.description,
          serverAttachmentId: att.attachment_id,
        }));
        // Normalizza question_id (server number vs locale stringa "87") per dedup merge
        const serverQuestionIds = new Set(
          normalized
            .map((a) => (a.questionId != null ? Number(a.questionId) : NaN))
            .filter((n) => Number.isFinite(n) && n > 0)
        );
        const localOnly = (auditForExport.attachments || []).filter((a) => {
          const q = a.questionId != null ? Number(a.questionId) : NaN;
          if (!Number.isFinite(q) || q <= 0) return true;
          return !serverQuestionIds.has(q);
        });
        auditForExport.attachments = [...normalized, ...localOnly];
        console.log(`📎 [EXPORT] ${normalized.length} allegati da server + ${localOnly.length} solo locali`);
      }
    } catch (err) {
      console.warn('[EXPORT] allegati server non disp., uso locali:', err.message);
    }

    // Fetch stralci normativi (norm_excerpt) — usati dal report ISO 14001
    // Usa .some(includes) per gestire varianti '14001', 'ISO_14001', 'ISO_14001_2015'
    const selectedStandards = currentAudit?.metadata?.selectedStandards || [];
    const checklistKeys = Object.keys(currentAudit?.checklist || {});
    const has14001 = selectedStandards.some(s => String(s).includes('14001'))
      || checklistKeys.some(k => k.includes('14001'));
    const has45001 = selectedStandards.some(s => String(s).includes('45001'))
      || checklistKeys.some(k => k.includes('45001'));
    const standardIdForExcerpts = has14001 ? 2 : has45001 ? 3 : null;
    if (standardIdForExcerpts) {
      try {
        const excRes = await apiService.get(`/checklist/questions/all?standard_id=${standardIdForExcerpts}`);
        const excMap = {};
        (excRes.questions || []).forEach(q => {
          if (q.norm_excerpt?.trim()) excMap[q.question_id] = q.norm_excerpt.trim();
        });
        auditForExport.normExcerpts = excMap;
        console.log(`📋 [EXPORT] ${Object.keys(excMap).length} stralci normativi caricati per standard_id=${standardIdForExcerpts}`);
      } catch (err) {
        console.warn('[EXPORT] norm_excerpts non disponibili:', err.message);
      }
    }

    // Costruisce getViewUrl con token (encodeURIComponent per sicurezza)
    const rawToken = apiService.getToken();

    // Logo anagrafica azienda → placeholder [LOGO] in document/header template Word
    let embedCompanyLogo = null;
    const exportCompanyId = currentAudit?.metadata?.companyId;
    if (exportCompanyId && rawToken) {
      try {
        const logoRes = await fetch(apiService.getCompanyLogoUrl(exportCompanyId), {
          headers: { Authorization: `Bearer ${rawToken}` },
        });
        if (logoRes.ok) {
          const blob = await logoRes.blob();
          const mime = (blob.type || "").split(";")[0].trim().toLowerCase();
          const okMime = ["image/jpeg", "image/jpg", "image/png", "image/gif"].includes(mime);
          if (okMime) {
            embedCompanyLogo = {
              dataUrl: await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
              }),
            };
            console.log("📋 [EXPORT] Logo azienda caricato per embedding Word");
          }
        }
      } catch (err) {
        console.warn("[EXPORT] Logo azienda non incluso nel Word:", err.message);
      }
    }
    auditForExport.embedCompanyLogo = embedCompanyLogo;

    auditForExport.exportOrganizationBranding = {
      name: user?.organization_name || "",
      vat: user?.organization_vat_number || "",
    };

    // Fetch org: logo studio + prefisso numerazione (non dipendere dal JWT che può essere stale)
    let embedOrganizationLogo = null;
    let auditReportPrefix = null;
    if (rawToken) {
      try {
        const orgRes = await apiService.getMyOrganization();
        const orgData = orgRes?.data ?? orgRes;
        auditReportPrefix = orgData?.audit_report_prefix || null;

        const orgLogoRes = await fetch(apiService.getOrganizationLogoUrl(), {
          headers: { Authorization: `Bearer ${rawToken}` },
        });
        if (orgLogoRes.ok) {
          const blob = await orgLogoRes.blob();
          const mime = (blob.type || "").split(";")[0].trim().toLowerCase();
          const okMime = ["image/jpeg", "image/jpg", "image/png", "image/gif"].includes(mime);
          if (okMime) {
            embedOrganizationLogo = {
              dataUrl: await new Promise((resolve, reject) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = reject;
                fr.readAsDataURL(blob);
              }),
            };
            console.log("📋 [EXPORT] Logo organizzazione caricato per embedding Word");
          }
        }
      } catch (err) {
        console.warn("[EXPORT] Logo/prefisso organizzazione non incluso:", err.message);
      }
    }
    auditForExport.embedOrganizationLogo = embedOrganizationLogo;

    const getViewUrl = rawToken
      ? (id) => `${apiService.baseUrl}/attachments/${id}/view?token=${encodeURIComponent(rawToken)}`
      : null;

    return { auditForExport, getViewUrl, auditReportPrefix };
  };

  const handleExportWord = async () => {
    if (!currentAudit) return;
    try {
      setIsExporting(true);
      const { auditForExport, getViewUrl, auditReportPrefix } = await prepareAuditForExport();

      // Audit con checklist custom (senza standard ISO) → un solo report Word
      const customChecklistId = auditForExport.metadata?.customChecklistId ?? auditForExport.custom_checklist_id;
      if (customChecklistId && (!auditForExport.metadata?.selectedStandards?.length) && !Object.keys(auditForExport.checklist || {}).length) {
        const photoMode = resolvePhotoMode(null, customChecklistId);
        if (photoMode === 'preview') showMessage("⏳ Caricamento immagini in corso...", "info");
        const fileName = await exportAuditToWord(auditForExport, getViewUrl, {
          customChecklistId,
          photoMode,
          auditReportPrefix,
          getTemplateResolver: () => apiService.getReportTemplate(null, customChecklistId),
        });
        showMessage(`✅ Report Word generato: ${fileName}`, "success");
        return;
      }

      // selectedStandards = flags attivi → un file Word per ogni flag.
      // Fallback alle chiavi della checklist se il campo non è compilato.
      const activeStandards = (auditForExport.metadata?.selectedStandards?.length > 0)
        ? auditForExport.metadata.selectedStandards
        : Object.keys(auditForExport.checklist || {});

      if (activeStandards.length === 0) {
        showMessage("⚠️ Nessuno standard selezionato per questo audit", "error");
        return;
      }

      const willEmbedPhotos = activeStandards.some(s => resolvePhotoMode(s, null) === 'preview');
      if (activeStandards.length > 1) {
        showMessage(`⏳ Generazione ${activeStandards.length} report${willEmbedPhotos ? ' (foto incluse)' : ''}...`, "info");
      } else if (willEmbedPhotos) {
        showMessage("⏳ Caricamento immagini in corso...", "info");
      }

      const fileNames = [];
      for (const stdKey of activeStandards) {
        if (fileNames.length > 0) await new Promise(r => setTimeout(r, 900));
        const fileName = await exportAuditToWord(auditForExport, getViewUrl, {
          standardKey: stdKey,
          photoMode: resolvePhotoMode(stdKey, null),
          auditReportPrefix,
          getTemplateResolver: (stdId) => apiService.getReportTemplate(stdId),
        });
        fileNames.push(fileName);
      }

      showMessage(
        fileNames.length === 1
          ? `✅ Report Word generato: ${fileNames[0]}`
          : `✅ ${fileNames.length} report generati: ${fileNames.join(' + ')}`,
        "success"
      );
    } catch (error) {
      console.error("Errore export Word:", error);
      showMessage(`❌ Errore: ${error.message}`, "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportToFileSystem = async () => {
    if (!currentAudit) return;
    try {
      setIsExporting(true);
      const { auditForExport, getViewUrl, auditReportPrefix } = await prepareAuditForExport();

      const customChecklistId = auditForExport.metadata?.customChecklistId ?? auditForExport.custom_checklist_id;
      const hasCustomOnly = customChecklistId && !auditForExport.metadata?.selectedStandards?.length && !Object.keys(auditForExport.checklist || {}).length;

      const stds = auditForExport.metadata?.selectedStandards || [];
      const firstStd = stds[0] || null;
      const photoMode = resolvePhotoMode(hasCustomOnly ? null : firstStd, hasCustomOnly ? customChecklistId : null);
      if (photoMode === 'preview') showMessage("⏳ Caricamento immagini in corso...", "info");
      const exportOpts = {
        auditReportPrefix,
        ...(photoMode ? { photoMode } : {}),
        ...(hasCustomOnly
          ? { customChecklistId, getTemplateResolver: () => apiService.getReportTemplate(null, customChecklistId) }
          : { getTemplateResolver: (stdId) => apiService.getReportTemplate(stdId) }),
      };

      if (fsProvider?.ready()) {
        const result = await exportAuditToWorkspace(auditForExport, fsProvider, getViewUrl, exportOpts);
        if (result.fallback) {
          showMessage(`📱 Android: file salvato in Download (${result.fileName})`, "info");
        } else {
          showMessage(`✅ Report salvato in workspace: ${result.fileName}`, "success");
        }
        return;
      }

      const result = await exportAuditToFileSystem(auditForExport, getViewUrl, exportOpts);
      if (result.fallback) {
        showMessage(`📱 Android: file salvato in Download (${result.fileName})`, "info");
      } else {
        showMessage(`✅ File salvato in: ${result.path}`, "success");
      }
    } catch (error) {
      console.error("Errore salvataggio file system:", error);
      if (error.message.includes("annullato")) {
        showMessage("ℹ️ Salvataggio annullato", "info");
      } else {
        showMessage(`❌ Errore: ${error.message}`, "error");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = () => {
    downloadAllAuditsJSON(audits);
  };

  const handleImportBackup = async () => {
    // Crea input file nascosto
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        setIsImporting(true);
        showMessage("📥 Importazione backup in corso...", "info");

        // Leggi file JSON
        const text = await file.text();
        const backupData = JSON.parse(text);

        // Importa tramite StorageContext
        const result = await importBackup(backupData);

        if (result.success) {
          showMessage(
            `✅ Import completato: ${result.count} audit ripristinati`,
            "success"
          );
        } else {
          showMessage(`❌ Errore import: ${result.error}`, "error");
        }
      } catch (error) {
        console.error("Errore lettura backup:", error);
        showMessage(`❌ File non valido: ${error.message}`, "error");
      } finally {
        setIsImporting(false);
      }
    };

    input.click();
  };

  return (
    <div className="export-panel">
      {/* Export Message Notification */}
      {exportMessage && (
        <div className={`export-notification ${exportMessage.type}`}>
          {exportMessage.text}
        </div>
      )}

      <div className="export-sections">
        {/* Export Audit Corrente - WORD */}
        <div className="export-section export-word-section">
          <h4>📄 Report Word{(() => {
            const stds = currentAudit?.metadata?.selectedStandards || [];
            if (stds.length === 0) return '';
            const label = stds.map(k =>
              String(k).replace('ISO_', 'ISO ').replace(/_\d{4}$/, '')
            ).join(' + ');
            return stds.length > 1
              ? ` — ${stds.length} file (${label})`
              : ` (${label})`;
          })()}</h4>
          {!currentAudit ? (
            <p className="export-info">
              Seleziona un audit per abilitare export
            </p>
          ) : (
            <>
              <p className="export-info">
                Genera report professionale per{" "}
                <strong>{currentAudit.metadata.auditNumber}</strong> -{" "}
                {currentAudit.metadata.clientName}
              </p>
              <div className="export-photo-toggle">
                <label className="photo-toggle-label">
                  <input
                    type="checkbox"
                    checked={embedPhotosEffective}
                    onChange={e => setEmbedPhotos(e.target.checked)}
                    disabled={isExporting}
                  />
                  <span>
                    Incorpora foto nel documento
                    {embedPhotos === null && (
                      <span className="photo-toggle-auto"> (auto)</span>
                    )}
                  </span>
                </label>
                {embedPhotos !== null && (
                  <button
                    className="photo-toggle-reset"
                    onClick={() => setEmbedPhotos(null)}
                    disabled={isExporting}
                    title="Torna al comportamento automatico"
                  >
                    ripristina auto
                  </button>
                )}
                <p className="photo-toggle-hint">
                  {embedPhotosEffective
                    ? "Le foto vengono scaricate e incorporate nel DOCX — file più grande, generazione più lenta."
                    : "Le foto non vengono incorporate — solo il nome del file comparirà nel report."}
                </p>
              </div>

              <div className="export-buttons">
                <button
                  onClick={handleExportWord}
                  disabled={isExporting}
                  className="btn btn-word"
                  title="Scarica report Word (browser download)"
                >
                  {isExporting ? "⏳ Generazione in corso..." : "📄 Genera Report Word"}
                </button>
                <button
                  onClick={handleExportToFileSystem}
                  disabled={isExporting}
                  className="btn btn-filesystem"
                  title={
                    fsProvider?.ready()
                      ? "Salva in workspace collegato (Report/)"
                      : "Salva in cartella organizzata (File System Access API)"
                  }
                >
                  {isExporting
                    ? "⏳ Salvataggio in corso..."
                    : fsProvider?.ready()
                    ? "✅ Salva in Workspace"
                    : "💾 Salva in File System"}
                </button>
              </div>
              <p className="export-hint">
                {fsProvider?.ready() ? (
                  <span>
                    <strong>✅ Workspace collegato:</strong> Report salvato in{" "}
                    <code>Report/{currentAudit.metadata.clientName}/</code>
                  </span>
                ) : (
                  <span>
                    <strong>💡 Suggerimento:</strong> Collega workspace in
                    Impostazioni per salvataggio automatico
                  </span>
                )}
              </p>

              {/* Collegamento documentale — visibile per audit completati/approvati */}
              {["completed", "approved"].includes(currentAudit?.metadata?.status) &&
                hasLicensedModule?.("documents") && (
                <div className="export-docregistry-hint">
                  <span>📂</span>
                  <span>
                    Dopo aver generato il report Word, registralo nella{" "}
                    <button
                      type="button"
                      className="export-docregistry-link"
                      onClick={() => navigate("/documents")}
                    >
                      Gestione Documentale
                    </button>{" "}
                    per archiviarlo con versione e metadati.
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Export JSON/CSV - Solo Development Mode */}
        {isDev && (
          <div className="export-section">
            <h4>Formato Dati (JSON/CSV)</h4>
            {!currentAudit ? (
              <p className="export-info">
                Seleziona un audit per abilitare export
              </p>
            ) : (
              <>
                <p className="export-info">
                  Esporta <strong>{currentAudit.metadata.auditNumber}</strong> -{" "}
                  {currentAudit.metadata.clientName}
                </p>
                <div className="export-buttons">
                  <button
                    onClick={() => handleExportCurrent("json-full")}
                    className="btn btn-primary"
                  >
                    📊 JSON Completo
                  </button>
                  <button
                    onClick={() => handleExportCurrent("json-summary")}
                    className="btn btn-secondary"
                  >
                    📋 JSON Summary
                  </button>
                  <button
                    onClick={() => handleExportCurrent("csv")}
                    className="btn btn-success"
                  >
                    📈 CSV Summary
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Export Tutti */}
        <div className="export-section">
          <h4>Backup Completo</h4>
          <p className="export-info">
            Esporta tutti gli audit ({audits.length} totali) in un unico file
            JSON
          </p>
          <div className="export-buttons">
            <button
              onClick={handleExportAll}
              disabled={audits.length === 0}
              className="btn btn-warning"
            >
              💾 Backup Tutti gli Audit
            </button>
            <button
              onClick={handleImportBackup}
              disabled={isImporting}
              className="btn btn-info"
              title="Importa backup JSON per ripristinare audit"
            >
              {isImporting ? "⏳ Importazione..." : "📥 Importa Backup"}
            </button>
          </div>
        </div>

        {/* Info Export */}
        <div className="export-info-section">
          <h4>ℹ️ Formati Export</h4>
          <ul>
            <li>
              <strong>Report Word:</strong> Documento professionale conforme ISO
              9001:2015 con intestazione, dati generali, checklist completa e
              rilievi emergenti
            </li>
            <li>
              <strong>Salva in Workspace:</strong> Organizzazione automatica in
              cartelle strutturate per anno e cliente nella cartella workspace
              collegata
            </li>
            <li>
              <strong>Backup Completo:</strong> Tutti gli audit in formato JSON
              per ripristino completo del sistema
            </li>
            <li>
              <strong>Importa Backup:</strong> Ripristina audit da file JSON di
              backup (utile per sincronizzare dati tra dispositivi)
            </li>
            {isDev && (
              <>
                <li>
                  <strong>JSON Completo:</strong> Include tutti i dati audit
                  (checklist, NC, evidenze, report)
                </li>
                <li>
                  <strong>JSON Summary:</strong> Contiene solo metriche, NC
                  summary e informazioni base
                </li>
                <li>
                  <strong>CSV Summary:</strong> Formato tabellare per
                  Excel/LibreOffice con metriche e NC
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
