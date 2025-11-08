/**
 * Evidence Manager Component
 * Gestione evidenze audit con File System Access API
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState } from "react";
import { useStorage } from "../contexts/StorageContext";
import { EVIDENCE_CATEGORY } from "../data/auditDataModel";
import "./EvidenceManager.css";

function EvidenceManager() {
  const { currentAudit, updateCurrentAudit } = useStorage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");

  if (!currentAudit) {
    return (
      <div className="evidence-manager empty">
        <p>Seleziona un audit per gestire le evidenze</p>
      </div>
    );
  }

  // Converti evidences da oggetto a array
  const evidencesObj = currentAudit.evidences || {};
  const evidences = Object.values(evidencesObj);

  const filteredEvidences = evidences.filter(
    (e) => filterCategory === "all" || e.category === filterCategory
  );

  const stats = {
    total: evidences.length,
    documents: evidences.filter(
      (e) => e.category === EVIDENCE_CATEGORY.DOCUMENT
    ).length,
    photos: evidences.filter((e) => e.category === EVIDENCE_CATEGORY.PHOTO)
      .length,
    records: evidences.filter((e) => e.category === EVIDENCE_CATEGORY.RECORD)
      .length,
    other: evidences.filter((e) => e.category === EVIDENCE_CATEGORY.OTHER)
      .length,
  };

  const handleAddEvidence = (evidenceData) => {
    updateCurrentAudit((audit) => {
      const newId = `ev-${Date.now()}`;
      const newEvidence = {
        id: newId,
        ...evidenceData,
        uploadDate: new Date().toISOString(),
      };

      return {
        ...audit,
        evidences: {
          ...audit.evidences,
          [newId]: newEvidence,
        },
        metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
      };
    });
    setShowAddModal(false);
  };

  const handleDeleteEvidence = (evidenceId) => {
    if (window.confirm("Eliminare questa evidenza?")) {
      updateCurrentAudit((audit) => {
        const updatedEvidences = { ...audit.evidences };
        delete updatedEvidences[evidenceId];

        return {
          ...audit,
          evidences: updatedEvidences,
          metadata: {
            ...audit.metadata,
            lastModified: new Date().toISOString(),
          },
        };
      });
    }
  };

  return (
    <div className="evidence-manager">
      <div className="evidence-header">
        <h3>📎 Gestione Evidenze</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          ➕ Aggiungi Evidenza
        </button>
      </div>

      <div className="evidence-stats">
        <div className="stat-badge">
          Totali: <strong>{stats.total}</strong>
        </div>
        <div className="stat-badge">
          Documenti: <strong>{stats.documents}</strong>
        </div>
        <div className="stat-badge">
          Foto: <strong>{stats.photos}</strong>
        </div>
        <div className="stat-badge">
          Registrazioni: <strong>{stats.records}</strong>
        </div>
      </div>

      <div className="evidence-filters">
        <label>Filtra per categoria:</label>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">Tutte</option>
          <option value={EVIDENCE_CATEGORY.DOCUMENT}>Documenti</option>
          <option value={EVIDENCE_CATEGORY.PHOTO}>Foto</option>
          <option value={EVIDENCE_CATEGORY.RECORD}>Registrazioni</option>
          <option value={EVIDENCE_CATEGORY.OTHER}>Altro</option>
        </select>
      </div>

      {filteredEvidences.length === 0 ? (
        <div className="evidence-empty">
          <p>
            Nessuna evidenza{" "}
            {filterCategory !== "all" ? "in questa categoria" : "caricata"}
          </p>
        </div>
      ) : (
        <div className="evidence-grid">
          {filteredEvidences.map((evidence) => (
            <div key={evidence.id} className="evidence-card">
              <div className="evidence-icon">
                {evidence.category === EVIDENCE_CATEGORY.PHOTO && "📷"}
                {evidence.category === EVIDENCE_CATEGORY.DOCUMENT && "📄"}
                {evidence.category === EVIDENCE_CATEGORY.RECORD && "📋"}
                {evidence.category === EVIDENCE_CATEGORY.OTHER && "📎"}
              </div>
              <div className="evidence-info">
                <h4>{evidence.fileName}</h4>
                <p className="evidence-desc">{evidence.description}</p>
                <div className="evidence-meta">
                  <span className="evidence-category">{evidence.category}</span>
                  <span className="evidence-date">
                    {new Date(evidence.uploadDate).toLocaleDateString("it-IT")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteEvidence(evidence.id)}
                className="evidence-delete"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddEvidenceModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddEvidence}
        />
      )}
    </div>
  );
}

function AddEvidenceModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    fileName: "",
    description: "",
    category: EVIDENCE_CATEGORY.DOCUMENT,
    filePath: "",
    fileData: null,
    fileSize: 0,
  });
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Aggiorna nome file se vuoto
    if (!formData.fileName) {
      setFormData((prev) => ({ ...prev, fileName: file.name }));
    }

    // Crea preview per immagini
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
        setFormData((prev) => ({
          ...prev,
          fileData: reader.result,
          fileSize: file.size,
          category: EVIDENCE_CATEGORY.PHOTO,
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setFormData((prev) => ({
        ...prev,
        fileSize: file.size,
        filePath: file.name,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Aggiungi Evidenza</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Upload File / Fotocamera */}
          <div className="form-group">
            <label>📎 Carica File / Foto</label>
            <div className="file-upload-actions">
              <label className="btn btn-secondary file-upload-btn">
                📁 Scegli File
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                  style={{ display: "none" }}
                />
              </label>

              <label className="btn btn-primary file-upload-btn">
                📷 Fotocamera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {previewUrl && (
              <div className="image-preview">
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "200px",
                    marginTop: "10px",
                    borderRadius: "8px",
                  }}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Nome File *</label>
            <input
              type="text"
              value={formData.fileName}
              onChange={(e) =>
                setFormData({ ...formData, fileName: e.target.value })
              }
              className="form-control"
              required
              placeholder="Es: Foto reparto produzione"
            />
          </div>

          <div className="form-group">
            <label>Categoria *</label>
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              className="form-control"
            >
              <option value={EVIDENCE_CATEGORY.DOCUMENT}>Documento</option>
              <option value={EVIDENCE_CATEGORY.PHOTO}>Foto</option>
              <option value={EVIDENCE_CATEGORY.RECORD}>Registrazione</option>
              <option value={EVIDENCE_CATEGORY.OTHER}>Altro</option>
            </select>
          </div>

          <div className="form-group">
            <label>Descrizione</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="form-control"
              rows={3}
              placeholder="Descrivi brevemente l'evidenza (cosa documenta, contesto, ecc.)"
            />
          </div>

          <div className="form-group">
            <label>Riferimento / Note</label>
            <input
              type="text"
              value={formData.filePath}
              onChange={(e) =>
                setFormData({ ...formData, filePath: e.target.value })
              }
              className="form-control"
              placeholder="Es: Clausola 7.1.5 - Risorse di monitoraggio"
            />
          </div>
        </form>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Annulla
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn btn-primary"
          >
            ✓ Salva
          </button>
        </div>
      </div>
    </div>
  );
}

export default EvidenceManager;
