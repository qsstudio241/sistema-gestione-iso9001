/**
 * Pending Issues Cascade Component
 * Gestione pending issues con carry-over da audit precedenti
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState } from "react";
import { useStorage } from "../contexts/StorageContext";
import "./PendingIssuesCascade.css";

function PendingIssuesCascade() {
  const { currentAudit, audits, updateCurrentAudit } = useStorage();
  const [showAddModal, setShowAddModal] = useState(false);

  if (!currentAudit) {
    return (
      <div className="pending-cascade empty">
        <p>Seleziona un audit per gestire pending issues</p>
      </div>
    );
  }

  const issues = currentAudit.pendingIssues || [];
  const resolvedCount = issues.filter((i) => i.resolved).length;

  const handleToggleResolved = (issueId) => {
    updateCurrentAudit((audit) => ({
      ...audit,
      pendingIssues: audit.pendingIssues.map((issue) =>
        issue.id === issueId ? { ...issue, resolved: !issue.resolved } : issue
      ),
      metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
    }));
  };

  const handleAddIssue = (issueData) => {
    updateCurrentAudit((audit) => {
      const newIssue = {
        id: `issue_${Date.now()}`,
        ...issueData,
        createdDate: new Date().toISOString(),
        resolved: false,
      };

      return {
        ...audit,
        pendingIssues: [...audit.pendingIssues, newIssue],
        metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
      };
    });
    setShowAddModal(false);
  };

  const handleDeleteIssue = (issueId) => {
    if (window.confirm("Eliminare questo pending issue?")) {
      updateCurrentAudit((audit) => ({
        ...audit,
        pendingIssues: audit.pendingIssues.filter((i) => i.id !== issueId),
        metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
      }));
    }
  };

  return (
    <div className="pending-cascade">
      <div className="pending-header">
        <div>
          <h3>⏳ Pending Issues</h3>
          <p className="pending-description">
            Gestione tematiche aperte con carry-over da audit precedenti
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
        >
          ➕ Aggiungi Issue
        </button>
      </div>

      <div className="pending-stats">
        <div className="stat-card">
          <span className="stat-value">{issues.length}</span>
          <span className="stat-label">Totali</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{issues.length - resolvedCount}</span>
          <span className="stat-label">Aperti</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{resolvedCount}</span>
          <span className="stat-label">Risolti</span>
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="pending-empty">
          <p>Nessun pending issue registrato</p>
        </div>
      ) : (
        <div className="issues-list">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className={`issue-card ${issue.resolved ? "resolved" : ""}`}
            >
              <div className="issue-header">
                <input
                  type="checkbox"
                  checked={issue.resolved}
                  onChange={() => handleToggleResolved(issue.id)}
                  className="issue-checkbox"
                />
                <div className="issue-title-section">
                  <h4 className="issue-title">{issue.description}</h4>
                  {issue.fromAuditNumber && (
                    <span className="issue-source">
                      Da audit {issue.fromAuditNumber}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteIssue(issue.id)}
                  className="issue-delete"
                >
                  🗑️
                </button>
              </div>
              {issue.notes && (
                <div className="issue-notes">
                  <strong>Note:</strong> {issue.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddIssueModal
          audits={audits}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddIssue}
        />
      )}
    </div>
  );
}

function AddIssueModal({ audits, onClose, onSave }) {
  const [formData, setFormData] = useState({
    description: "",
    notes: "",
    fromAuditNumber: "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Aggiungi Pending Issue</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Descrizione *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label>Da Audit Precedente (opzionale)</label>
            <select
              value={formData.fromAuditNumber}
              onChange={(e) =>
                setFormData({ ...formData, fromAuditNumber: e.target.value })
              }
              className="form-control"
            >
              <option value="">-- Nessuno --</option>
              {audits.map((audit) => (
                <option key={audit.id} value={audit.metadata.auditNumber}>
                  {audit.metadata.auditNumber} - {audit.metadata.clientName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Note</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="form-control"
              rows={3}
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

export default PendingIssuesCascade;
