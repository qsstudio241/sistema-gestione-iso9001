/**
 * Non Conformities Manager Component
 * Gestione Non Conformità (punto 10.2 ISO 9001:2015)
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState } from "react";
import { useStorage } from "../contexts/StorageContext";
import {
  NC_CATEGORY,
  NC_STATUS,
  createNonConformity,
} from "../data/auditDataModel";
import "./NonConformitiesManager.css";

function NonConformitiesManager() {
  const { currentAudit, updateCurrentAudit } = useStorage();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedNC, setSelectedNC] = useState(null);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  if (!currentAudit) {
    return (
      <div className="nc-manager empty">
        <p>Seleziona un audit per gestire le non conformità</p>
      </div>
    );
  }

  const nonConformities = currentAudit.nonConformities || [];

  // Filtra NC
  const filteredNCs = nonConformities.filter((nc) => {
    if (filterCategory !== "all" && nc.category !== filterCategory)
      return false;
    if (filterStatus !== "all" && nc.status !== filterStatus) return false;
    return true;
  });

  // Statistiche
  const stats = {
    total: nonConformities.length,
    major: nonConformities.filter((nc) => nc.category === NC_CATEGORY.MAJOR)
      .length,
    minor: nonConformities.filter((nc) => nc.category === NC_CATEGORY.MINOR)
      .length,
    observation: nonConformities.filter(
      (nc) => nc.category === NC_CATEGORY.OBSERVATION
    ).length,
    open: nonConformities.filter((nc) => nc.status === NC_STATUS.OPEN).length,
    inProgress: nonConformities.filter(
      (nc) => nc.status === NC_STATUS.IN_PROGRESS
    ).length,
    completed: nonConformities.filter((nc) => nc.status === NC_STATUS.COMPLETED)
      .length,
  };

  const handleCreateNC = () => {
    setSelectedNC(null);
    setShowCreateModal(true);
  };

  const handleEditNC = (nc) => {
    setSelectedNC(nc);
    setShowCreateModal(true);
  };

  const handleDeleteNC = (ncId) => {
    if (
      window.confirm("Sei sicuro di voler eliminare questa non conformità?")
    ) {
      updateCurrentAudit((audit) => ({
        ...audit,
        nonConformities: audit.nonConformities.filter((nc) => nc.id !== ncId),
        metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
      }));
    }
  };

  return (
    <div className="nc-manager">
      <div className="nc-header">
        <div className="nc-title-section">
          <h3>Gestione Non Conformità (Punto 10.2)</h3>
          <p className="nc-description">
            Gestione secondo il ciclo: Reagire → Valutare → Attuare →
            Riesaminare → Aggiornare
          </p>
        </div>

        <button onClick={handleCreateNC} className="btn btn-primary">
          ➕ Nuova Non Conformità
        </button>
      </div>

      {/* Statistiche */}
      <div className="nc-stats-grid">
        <div className="nc-stat-card">
          <div className="nc-stat-value">{stats.total}</div>
          <div className="nc-stat-label">Totali</div>
        </div>
        <div className="nc-stat-card major">
          <div className="nc-stat-value">{stats.major}</div>
          <div className="nc-stat-label">Major</div>
        </div>
        <div className="nc-stat-card minor">
          <div className="nc-stat-value">{stats.minor}</div>
          <div className="nc-stat-label">Minor</div>
        </div>
        <div className="nc-stat-card observation">
          <div className="nc-stat-value">{stats.observation}</div>
          <div className="nc-stat-label">Osservazioni</div>
        </div>
        <div className="nc-stat-card open">
          <div className="nc-stat-value">{stats.open}</div>
          <div className="nc-stat-label">Aperte</div>
        </div>
        <div className="nc-stat-card progress">
          <div className="nc-stat-value">{stats.inProgress}</div>
          <div className="nc-stat-label">In Corso</div>
        </div>
      </div>

      {/* Filtri */}
      <div className="nc-filters">
        <div className="filter-group">
          <label>Categoria:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">Tutte</option>
            <option value={NC_CATEGORY.MAJOR}>Major</option>
            <option value={NC_CATEGORY.MINOR}>Minor</option>
            <option value={NC_CATEGORY.OBSERVATION}>Osservazioni</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tutti</option>
            <option value={NC_STATUS.OPEN}>Aperte</option>
            <option value={NC_STATUS.IN_PROGRESS}>In Corso</option>
            <option value={NC_STATUS.COMPLETED}>Completate</option>
            <option value={NC_STATUS.VERIFIED}>Verificate</option>
          </select>
        </div>
      </div>

      {/* Lista NC */}
      <div className="nc-list">
        {filteredNCs.length === 0 ? (
          <div className="nc-empty">
            <p>
              Nessuna non conformità{" "}
              {filterCategory !== "all" || filterStatus !== "all"
                ? "con i filtri selezionati"
                : "registrata"}
            </p>
          </div>
        ) : (
          filteredNCs.map((nc) => (
            <NCCard
              key={nc.id}
              nc={nc}
              onEdit={() => handleEditNC(nc)}
              onDelete={() => handleDeleteNC(nc.id)}
              onUpdateStatus={(status) => {
                updateCurrentAudit((audit) => ({
                  ...audit,
                  nonConformities: audit.nonConformities.map((item) =>
                    item.id === nc.id ? { ...item, status } : item
                  ),
                  metadata: {
                    ...audit.metadata,
                    lastModified: new Date().toISOString(),
                  },
                }));
              }}
            />
          ))
        )}
      </div>

      {/* Modal Create/Edit */}
      {showCreateModal && (
        <NCModal
          nc={selectedNC}
          audit={currentAudit}
          onClose={() => setShowCreateModal(false)}
          onSave={(ncData) => {
            updateCurrentAudit((audit) => {
              const ncs = [...audit.nonConformities];

              if (selectedNC) {
                // Edit
                const index = ncs.findIndex(
                  (item) => item.id === selectedNC.id
                );
                if (index !== -1) {
                  ncs[index] = { ...ncs[index], ...ncData };
                }
              } else {
                // Create
                const newNC = createNonConformity(
                  ncData.norm,
                  ncData.clauseReference,
                  ncData.category,
                  ncData.description
                );
                ncs.push(newNC);
              }

              return {
                ...audit,
                nonConformities: ncs,
                metrics: {
                  ...audit.metrics,
                  nonConformitiesCount: ncs.length,
                },
                metadata: {
                  ...audit.metadata,
                  lastModified: new Date().toISOString(),
                },
              };
            });
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

// === NC CARD ===

function NCCard({ nc, onEdit, onDelete, onUpdateStatus }) {
  const [showDetails, setShowDetails] = useState(false);

  const getCategoryClass = () => {
    switch (nc.category) {
      case NC_CATEGORY.MAJOR:
        return "major";
      case NC_CATEGORY.MINOR:
        return "minor";
      case NC_CATEGORY.OBSERVATION:
        return "observation";
      default:
        return "";
    }
  };

  const getStatusBadge = () => {
    switch (nc.status) {
      case NC_STATUS.OPEN:
        return { text: "Aperta", class: "open" };
      case NC_STATUS.IN_PROGRESS:
        return { text: "In Corso", class: "progress" };
      case NC_STATUS.COMPLETED:
        return { text: "Completata", class: "completed" };
      case NC_STATUS.VERIFIED:
        return { text: "Verificata", class: "verified" };
      case NC_STATUS.REJECTED:
        return { text: "Respinta", class: "rejected" };
      default:
        return { text: nc.status, class: "" };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className={`nc-card ${getCategoryClass()}`}>
      <div
        className="nc-card-header"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="nc-card-title">
          <span className={`nc-category-badge ${getCategoryClass()}`}>
            {nc.category.toUpperCase()}
          </span>
          <span className="nc-norm-badge">{nc.norm.replace("_", " ")}</span>
          <span className="nc-clause">{nc.clauseReference}</span>
          <span className="nc-description-preview">
            {nc.description.substring(0, 80)}...
          </span>
        </div>

        <div className="nc-card-actions">
          <span className={`nc-status-badge ${statusBadge.class}`}>
            {statusBadge.text}
          </span>
          <button className="nc-expand-btn">{showDetails ? "▲" : "▼"}</button>
        </div>
      </div>

      {showDetails && (
        <div className="nc-card-details">
          <div className="nc-detail-section">
            <strong>Descrizione completa:</strong>
            <p>{nc.description}</p>
          </div>

          {nc.correctiveActions.length > 0 && (
            <div className="nc-detail-section">
              <strong>
                Azioni Correttive ({nc.correctiveActions.length}):
              </strong>
              <ul className="nc-actions-list">
                {nc.correctiveActions.map((action, idx) => (
                  <li key={idx} className={action.completed ? "completed" : ""}>
                    {action.action}
                    {action.completed && (
                      <span className="action-check">✓</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nc.evidences.length > 0 && (
            <div className="nc-detail-section">
              <strong>Evidenze collegate:</strong> {nc.evidences.length}
            </div>
          )}

          <div className="nc-card-footer">
            <div className="nc-status-change">
              <label>Cambia status:</label>
              <select
                value={nc.status}
                onChange={(e) => onUpdateStatus(e.target.value)}
                className="status-select"
              >
                <option value={NC_STATUS.OPEN}>Aperta</option>
                <option value={NC_STATUS.IN_PROGRESS}>In Corso</option>
                <option value={NC_STATUS.COMPLETED}>Completata</option>
                <option value={NC_STATUS.VERIFIED}>Verificata</option>
                <option value={NC_STATUS.REJECTED}>Respinta</option>
              </select>
            </div>

            <div className="nc-buttons">
              <button onClick={onEdit} className="btn btn-sm btn-secondary">
                ✏️ Modifica
              </button>
              <button onClick={onDelete} className="btn btn-sm btn-danger">
                🗑️ Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === NC MODAL ===

function NCModal({ nc, audit, onClose, onSave }) {
  const [formData, setFormData] = useState({
    norm: nc?.norm || audit.metadata.selectedStandards[0],
    clauseReference: nc?.clauseReference || "",
    category: nc?.category || NC_CATEGORY.MINOR,
    description: nc?.description || "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.clauseReference.trim()) {
      newErrors.clauseReference = "Clausola obbligatoria";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Descrizione obbligatoria";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-large"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{nc ? "Modifica" : "Nuova"} Non Conformità</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>Norma *</label>
              <select
                value={formData.norm}
                onChange={(e) => handleChange("norm", e.target.value)}
                className="form-control"
              >
                {audit.metadata.selectedStandards.map((norm) => (
                  <option key={norm} value={norm}>
                    {norm.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Categoria *</label>
              <select
                value={formData.category}
                onChange={(e) => handleChange("category", e.target.value)}
                className="form-control"
              >
                <option value={NC_CATEGORY.MAJOR}>Major</option>
                <option value={NC_CATEGORY.MINOR}>Minor</option>
                <option value={NC_CATEGORY.OBSERVATION}>Osservazione</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Clausola di riferimento *</label>
            <input
              type="text"
              value={formData.clauseReference}
              onChange={(e) => handleChange("clauseReference", e.target.value)}
              placeholder="es. 8.4.1, 9.1.2"
              className={`form-control ${
                errors.clauseReference ? "error" : ""
              }`}
            />
            {errors.clauseReference && (
              <span className="error-message">{errors.clauseReference}</span>
            )}
          </div>

          <div className="form-group">
            <label>Descrizione Non Conformità *</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Descrivi la non conformità rilevata..."
              rows={5}
              className={`form-control ${errors.description ? "error" : ""}`}
            />
            {errors.description && (
              <span className="error-message">{errors.description}</span>
            )}
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

export default NonConformitiesManager;
