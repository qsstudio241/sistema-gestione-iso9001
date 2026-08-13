/**
 * GapAnalysisPage — Gap analysis MVP (HK-8)
 * Visualizza la copertura documentale per clausole normative di un'azienda.
 */
import React, { useState } from 'react';
import apiService from '../services/apiService';
import { useCompanyScope } from '../contexts/CompanyScopeContext';
import AiDisclaimer from '../components/AiDisclaimer';
import { Link } from '../contexts/RouterContext';
import { buildDocumentRegistryPath } from '../utils/documentRegistryUrl';
import { buildSalDeepLink } from '../utils/salDeepLink';

const STANDARDS = [
  { code: 'ISO_9001_2015', label: 'ISO 9001:2015' },
  { code: 'ISO_3834_2_2021', label: 'ISO 3834-2:2021' },
  { code: 'ISO_45001_2018', label: 'ISO 45001:2018' },
];

const COVERAGE_LABEL = { covered: 'Coperta', partial: 'Parziale', missing: 'Mancante' };
const COVERAGE_CLASS = { covered: 'gap-covered', partial: 'gap-partial', missing: 'gap-missing' };

export default function GapAnalysisPage() {
  const { companyId, scopeCompanyName, isStudioWide } = useCompanyScope();
  const [standardCode, setStandardCode] = useState('ISO_9001_2015');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleRun() {
    if (!companyId) {
      setError("Seleziona un'azienda nell'Ambito in alto.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiService.getGapAnalysis({ companyId: parseInt(companyId, 10), standardCode });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Errore analisi gap');
    } finally {
      setLoading(false);
    }
  }

  const summary = result?.summary;

  return (
    <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Gap Analysis Normativa</h1>
      <p style={{ color: '#546e7a', marginBottom: '1.5rem' }}>
        Confronta le clausole normative con i documenti aziendali registrati.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 200 }}>
          <label htmlFor="gap-std" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Standard</label>
          <select
            id="gap-std"
            value={standardCode}
            onChange={(e) => setStandardCode(e.target.value)}
            style={{ padding: '0.45rem 0.7rem', borderRadius: 4, border: '1px solid #b0bec5' }}
          >
            {STANDARDS.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 220 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Azienda</span>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            {isStudioWide
              ? "Seleziona un'azienda nell'Ambito in alto."
              : scopeCompanyName}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="button"
            disabled={loading || !companyId}
            onClick={handleRun}
            style={{
              padding: '0.48rem 1.2rem',
              background: loading ? '#b0bec5' : '#1565c0',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {loading ? 'Analisi\u2026' : 'Avvia Gap Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fce4ec', color: '#c62828', padding: '0.75rem 1rem', borderRadius: 4, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {summary && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Coperte', value: summary.covered, color: '#e8f5e9', text: '#2e7d32' },
            { label: 'Parziali', value: summary.partial, color: '#fff8e1', text: '#f57f17' },
            { label: 'Mancanti', value: summary.missing, color: '#fce4ec', text: '#c62828' },
            { label: 'Totale clausole', value: summary.total, color: '#e3f2fd', text: '#1565c0' },
          ].map((kpi) => (
            <div key={kpi.label} style={{ background: kpi.color, color: kpi.text, padding: '0.75rem 1.2rem', borderRadius: 6, minWidth: 120, textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{kpi.value}</div>
              <div style={{ fontSize: '0.8rem' }}>{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {result?.matrix && result.matrix.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Clausola</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Titolo</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Copertura</th>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '2px solid #e0e0e0' }}>Evidenze</th>
              </tr>
            </thead>
            <tbody>
              {result.matrix.map((row) => (
                <tr key={row.clauseRef} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }}>{row.clauseRef}</td>
                  <td style={{ padding: '0.45rem 0.75rem' }}>{row.title}</td>
                  <td style={{ padding: '0.45rem 0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: 12,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: row.coverage === 'covered' ? '#e8f5e9' : row.coverage === 'partial' ? '#fff8e1' : '#fce4ec',
                        color: row.coverage === 'covered' ? '#2e7d32' : row.coverage === 'partial' ? '#e65100' : '#c62828',
                      }}>
                        {COVERAGE_LABEL[row.coverage] || row.coverage}
                      </span>
                      {row.coverageSource === 'sal' ? (
                        <span
                          title="Stato ufficiale tracciato nel modulo SAL (evidenze validate), non stima automatica"
                          style={{
                            fontSize: '0.65rem', fontWeight: 700, color: '#1565c0',
                            border: '1px solid #90caf9', borderRadius: 4, padding: '0 4px',
                          }}
                        >
                          SAL
                        </span>
                      ) : (
                        <span
                          title="Stima automatica per parole chiave, non verificata da un professionista"
                          style={{ fontSize: '0.65rem', color: '#90a4ae' }}
                        >
                          (stima)
                        </span>
                      )}
                    </div>
                    {row.sal && (
                      <Link
                        to={buildSalDeepLink({ companyId, standardCode, clauseRef: row.sal.macroClauseRef })}
                        style={{ fontSize: '0.72rem', display: 'inline-block', marginTop: '0.2rem' }}
                        title={row.sal.exactMatch
                          ? 'Apri questa clausola nel modulo SAL'
                          : `Apri la macro-clausola ${row.sal.macroClauseRef} nel modulo SAL`}
                      >
                        {row.coverageSource === 'sal' ? 'Apri in SAL' : `Verifica in SAL (${row.sal.macroClauseRef})`}
                      </Link>
                    )}
                  </td>
                  <td style={{ padding: '0.45rem 0.75rem', color: '#546e7a', fontSize: '0.82rem' }}>
                    {row.evidence.length > 0
                      ? row.evidence.map((e, idx) => (
                        <React.Fragment key={e.docId ?? `${row.clauseRef}-${idx}`}>
                          {idx > 0 && ', '}
                          {e.docId ? (
                            <Link
                              to={buildDocumentRegistryPath({ selectId: e.docId, companyId })}
                              title="Apri nel registro documenti"
                            >
                              {e.title}
                            </Link>
                          ) : e.title}
                        </React.Fragment>
                      ))
                      : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result?.matrix && result.matrix.length === 0 && (
        <p style={{ color: '#78909c', marginTop: '1rem' }}>
          Nessuna clausola trovata per lo standard selezionato.
        </p>
      )}

      <AiDisclaimer style={{ marginTop: '2rem' }} />
    </div>
  );
}
