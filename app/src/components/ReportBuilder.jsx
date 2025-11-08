/**
 * Report Builder Component
 * Costruttore report audit con gestione capitoli
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState } from "react";
import { useStorage } from "../contexts/StorageContext";
import "./ReportBuilder.css";

function ReportBuilder() {
  const { currentAudit, updateCurrentAudit } = useStorage();
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  if (!currentAudit) {
    return (
      <div className="report-builder empty">
        <p>Seleziona un audit per costruire il report</p>
      </div>
    );
  }

  const chapters = currentAudit.reportChapters || [];

  const handleAddChapter = () => {
    const newChapter = {
      id: `chapter_${Date.now()}`,
      title: "Nuovo Capitolo",
      content: "",
      order: chapters.length,
    };
    setSelectedChapter(newChapter);
    setShowEditor(true);
  };

  const handleSaveChapter = (chapterData) => {
    updateCurrentAudit((audit) => {
      const updatedChapters = [...audit.reportChapters];
      const index = updatedChapters.findIndex((c) => c.id === chapterData.id);

      if (index >= 0) {
        updatedChapters[index] = chapterData;
      } else {
        updatedChapters.push(chapterData);
      }

      return {
        ...audit,
        reportChapters: updatedChapters.sort((a, b) => a.order - b.order),
        metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
      };
    });
    setShowEditor(false);
  };

  const handleDeleteChapter = (chapterId) => {
    if (window.confirm("Eliminare questo capitolo?")) {
      updateCurrentAudit((audit) => ({
        ...audit,
        reportChapters: audit.reportChapters.filter((c) => c.id !== chapterId),
        metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
      }));
    }
  };

  const moveChapter = (chapterId, direction) => {
    updateCurrentAudit((audit) => {
      const chapters = [...audit.reportChapters];
      const index = chapters.findIndex((c) => c.id === chapterId);

      if (direction === "up" && index > 0) {
        [chapters[index], chapters[index - 1]] = [
          chapters[index - 1],
          chapters[index],
        ];
      } else if (direction === "down" && index < chapters.length - 1) {
        [chapters[index], chapters[index + 1]] = [
          chapters[index + 1],
          chapters[index],
        ];
      }

      return {
        ...audit,
        reportChapters: chapters.map((c, i) => ({ ...c, order: i })),
        metadata: { ...audit.metadata, lastModified: new Date().toISOString() },
      };
    });
  };

  return (
    <div className="report-builder">
      <div className="report-header">
        <h3>📄 Report Builder</h3>
        <button onClick={handleAddChapter} className="btn btn-primary">
          ➕ Aggiungi Capitolo
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="report-empty">
          <p>
            Nessun capitolo nel report. Aggiungi il primo capitolo per iniziare.
          </p>
        </div>
      ) : (
        <div className="chapters-list">
          {chapters.map((chapter, index) => (
            <div key={chapter.id} className="chapter-card">
              <div className="chapter-header">
                <span className="chapter-number">{index + 1}.</span>
                <h4 className="chapter-title">{chapter.title}</h4>
                <div className="chapter-actions">
                  <button
                    onClick={() => moveChapter(chapter.id, "up")}
                    disabled={index === 0}
                    className="btn-icon"
                    title="Sposta su"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveChapter(chapter.id, "down")}
                    disabled={index === chapters.length - 1}
                    className="btn-icon"
                    title="Sposta giù"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => {
                      setSelectedChapter(chapter);
                      setShowEditor(true);
                    }}
                    className="btn-icon"
                    title="Modifica"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteChapter(chapter.id)}
                    className="btn-icon danger"
                    title="Elimina"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="chapter-preview">
                {chapter.content.substring(0, 200)}
                {chapter.content.length > 200 && "..."}
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <ChapterEditor
          chapter={selectedChapter}
          onSave={handleSaveChapter}
          onClose={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

function ChapterEditor({ chapter, onSave, onClose }) {
  const [title, setTitle] = useState(chapter?.title || "");
  const [content, setContent] = useState(chapter?.content || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...chapter,
      title,
      content,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-large"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{chapter?.id ? "Modifica" : "Nuovo"} Capitolo</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Titolo Capitolo *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label>Contenuto *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="form-control"
              rows={15}
              required
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

export default ReportBuilder;
