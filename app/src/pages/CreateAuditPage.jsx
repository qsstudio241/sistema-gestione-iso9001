/**
 * Create Audit Page
 * Form creazione nuovo audit (Audit Certificazione o Gap Analysis)
 * Sistema Gestione ISO 9001 - QS Studio
 */

import React, { useState, useEffect } from 'react';
import { useStorage } from '../contexts/StorageContext';
import apiService from '../services/apiService';
import './CreateAuditPage.css';

function CreateAuditPage({ onCancel, onSuccess }) {
    const { createNewAudit, loadAuditsFromAPI } = useStorage();
    
    const [standards, setStandards] = useState([]);
    const [formData, setFormData] = useState({
        client_name: '',
        audit_date: new Date().toISOString().split('T')[0], // Data inizio
        audit_date_end: null,
        audit_type: 'audit', // 'audit' o 'gap_analysis'
        standard_ids: [1], // Default ISO 9001
        auditor_name: '',
        project_year: new Date().getFullYear(),
        audit_number: '', // Auto-generato
        notes: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [loadingStandards, setLoadingStandards] = useState(true);

    // Carica standard disponibili
    useEffect(() => {
        async function loadStandards() {
            try {
                setLoadingStandards(true);
                const response = await apiService.get('/standards?is_active=true');
                
                if (response.success && response.data) {
                    setStandards(response.data);
                } else {
                    console.warn('⚠️ Standard API: risposta senza dati, uso fallback');
                    // Fallback standard hardcoded
                    setStandards([
                        { standard_id: 1, standard_code: 'ISO_9001_2015', standard_name: 'ISO 9001:2015', category: 'quality' },
                        { standard_id: 2, standard_code: 'ISO_14001_2015', standard_name: 'ISO 14001:2015', category: 'environment' },
                        { standard_id: 3, standard_code: 'ISO_45001_2018', standard_name: 'ISO 45001:2018', category: 'safety' }
                    ]);
                }
            } catch (error) {
                console.error('❌ Errore caricamento standard:', error);
                // Fallback
                setStandards([
                    { standard_id: 1, standard_code: 'ISO_9001_2015', standard_name: 'ISO 9001:2015', category: 'quality' }
                ]);
            } finally {
                setLoadingStandards(false);
            }
        }
        
        loadStandards();
    }, []);

    const handleStandardToggle = (standardId) => {
        setFormData(prev => {
            const currentStandards = prev.standard_ids || [];
            
            if (currentStandards.includes(standardId)) {
                // Deseleziona (minimo 1 standard richiesto)
                if (currentStandards.length === 1) {
                    return prev; // Non permettere deselezionare ultimo standard
                }
                return {
                    ...prev,
                    standard_ids: currentStandards.filter(id => id !== standardId)
                };
            } else {
                // Seleziona
                return {
                    ...prev,
                    standard_ids: [...currentStandards, standardId]
                };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // audit_number assegnato dal server (formato PREFISSO-YYMMDD-NN, vedi organizations.audit_report_prefix)
            const { audit_number: _omitClientNumber, ...formWithoutNumber } = formData;
            const endNorm = formData.audit_date_end
                && formData.audit_date_end !== formData.audit_date
                ? formData.audit_date_end
                : null;
            const payload = {
                ...formWithoutNumber,
                audit_date_end: endNorm,
                standard_ids: formData.standard_ids // Array per multi-standard
            };

            console.log('[CreateAudit] Payload:', payload);

            // Crea audit via API
            const response = await apiService.post('/audits', payload);

            if (response.success && response.data) {
                const newAudit = response.data;
                console.log('✅ Audit creato:', newAudit);

                // Ricarica lista audit e torna alla dashboard
                await loadAuditsFromAPI();
                if (onSuccess) {
                    onSuccess(newAudit);
                }
            } else {
                throw new Error(response.error || 'Errore sconosciuto');
            }
        } catch (err) {
            console.error('❌ Errore creazione audit:', err);
            
            // Gestisci errori specifici
            if (err.response?.status === 409) {
                setError('Numero audit già esistente. Modifica il numero o lascia vuoto per auto-generarlo.');
            } else if (err.response?.status === 400) {
                setError(err.response?.data?.error || 'Dati non validi. Verifica i campi obbligatori.');
            } else {
                setError('Impossibile creare audit. Verifica connessione o riprova più tardi.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-audit-page">
            <div className="page-header">
                <h1>📋 Nuovo Audit</h1>
                <button 
                    className="btn-back" 
                    onClick={onCancel}
                    disabled={loading}
                >
                    ← Torna alla Dashboard
                </button>
            </div>

            {error && (
                <div className="alert alert-danger">
                    <strong>Errore:</strong> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="audit-form">
                {/* Tipo Audit */}
                <div className="form-section">
                    <h3>1. Tipologia</h3>
                    <div className="form-group">
                        <label className="label-required">Tipo di Audit</label>
                        <div className="radio-group">
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="audit_type"
                                    value="audit"
                                    checked={formData.audit_type === 'audit'}
                                    onChange={(e) => setFormData({ ...formData, audit_type: e.target.value })}
                                />
                                <span className="radio-text">
                                    <strong>Audit di Certificazione/Sorveglianza</strong>
                                    <small>Verifica conformità ai requisiti della norma</small>
                                </span>
                            </label>
                            <label className="radio-label">
                                <input
                                    type="radio"
                                    name="audit_type"
                                    value="gap_analysis"
                                    checked={formData.audit_type === 'gap_analysis'}
                                    onChange={(e) => setFormData({ ...formData, audit_type: e.target.value })}
                                />
                                <span className="radio-text">
                                    <strong>Gap Analysis (Pre-Audit)</strong>
                                    <small>Analisi preliminare per identificare gap vs requisiti norma</small>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Dati Cliente */}
                <div className="form-section">
                    <h3>2. Dati Cliente</h3>
                    <div className="form-group">
                        <label className="label-required">Nome Cliente/Azienda</label>
                        <input
                            type="text"
                            required
                            value={formData.client_name}
                            onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                            placeholder="Es: Raccorderia Piacentina SRL"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-row form-row-audit-dates">
                        <div className="form-group audit-date-field">
                            <label className="label-required">Data inizio</label>
                            <input
                                type="date"
                                required
                                value={formData.audit_date}
                                onChange={(e) => setFormData({ ...formData, audit_date: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group audit-date-field">
                            <label>Data fine</label>
                            <input
                                type="date"
                                value={formData.audit_date_end || ''}
                                min={formData.audit_date || undefined}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    audit_date_end: e.target.value || null,
                                })}
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <small className="form-hint audit-date-end-hint">
                        Opzionale (audit multi-giorno)
                    </small>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Numero Audit</label>
                            <input
                                type="text"
                                value={formData.audit_number}
                                onChange={(e) => setFormData({ ...formData, audit_number: e.target.value })}
                                placeholder="Lascia vuoto per auto-generare (AUD-2026-XXXX)"
                                disabled={loading}
                            />
                            <small className="form-hint">Opzionale - Generato automaticamente se lasciato vuoto</small>
                        </div>

                        <div className="form-group">
                            <label>Anno Progetto</label>
                            <input
                                type="number"
                                value={formData.project_year}
                                onChange={(e) => setFormData({ ...formData, project_year: parseInt(e.target.value) })}
                                min="2020"
                                max="2099"
                                disabled={loading}
                            />
                        </div>
                    </div>
                </div>

                {/* Standard */}
                <div className="form-section">
                    <h3>3. Standard da Verificare</h3>
                    <div className="form-group">
                        <label className="label-required">Seleziona Standard ISO</label>
                        {loadingStandards ? (
                            <div className="loading-message">Caricamento standard disponibili...</div>
                        ) : (
                            <div className="standards-checkbox-group">
                                {standards.map((std) => (
                                    <label key={std.standard_id} className="checkbox-card">
                                        <input
                                            type="checkbox"
                                            checked={formData.standard_ids.includes(std.standard_id)}
                                            onChange={() => handleStandardToggle(std.standard_id)}
                                            disabled={loading}
                                        />
                                        <span className={`checkbox-content badge-${std.category}`}>
                                            <strong>{std.standard_name}</strong>
                                            <small>{std.standard_code.replace(/_/g, ' ')}</small>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                        <small className="form-hint">
                            Selezionati: {formData.standard_ids.length} standard
                        </small>
                    </div>
                </div>

                {/* Auditor */}
                <div className="form-section">
                    <h3>4. Informazioni Auditor</h3>
                    <div className="form-group">
                        <label>Nome Auditor</label>
                        <input
                            type="text"
                            value={formData.auditor_name}
                            onChange={(e) => setFormData({ ...formData, auditor_name: e.target.value })}
                            placeholder="Es: Marco Camellini"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label>Note Aggiuntive</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Note opzionali (es: ambito audit, sedi coinvolte, obiettivi specifici...)"
                            rows={4}
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="form-actions">
                    <button 
                        type="button" 
                        onClick={onCancel} 
                        className="btn-secondary"
                        disabled={loading}
                    >
                        Annulla
                    </button>
                    <button 
                        type="submit" 
                        className="btn-primary"
                        disabled={loading || formData.standard_ids.length === 0}
                    >
                        {loading ? (
                            <>
                                <span className="spinner"></span> Creazione in corso...
                            </>
                        ) : (
                            <>💾 Crea Audit</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default CreateAuditPage;
