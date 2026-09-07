/**
 * ComplianceMapsPage — CM-4/CM-5 UI mappa requisito↔norma (read + HITL + export).
 * Schermata 2 (KPI + lista) + dettaglio items. Ambito = company_id.
 * Niente auto-confirm: Accetta/Rifiuta solo su azione utente.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiService from '../services/apiService';
import { useCompanyScope } from '../contexts/CompanyScopeContext';
import SgqDataGrid from '../components/SgqDataGrid';
import StatusBadge from '../components/StatusBadge';
import AiDisclaimer from '../components/AiDisclaimer';
import {
  HITL_LABELS,
  MAP_STATUS_LABELS,
  COVERAGE_LABELS,
  countByHitl,
  filterItemsByHitl,
  hitlRowClass,
  canHitlAction,
  hitlActionTitle,
  canCompile,
  compileTitle,
  canProposeLinks,
  proposeLinksTitle,
  canExportMap,
  exportMapTitle,
  MUTABLE_MAP_STATUSES,
} from '../utils/complianceMapHitl';
import './QualificationsPage.css';
import './ComplianceMapsPage.css';

const MAP_COLUMNS = [
  { id: 'title', label: 'Titolo', sortable: true },
  { id: 'source_label', label: 'Fonte', sortable: true },
  { id: 'map_version', label: 'Ver.', sortable: true },
  { id: 'status', label: 'Stato', sortable: true },
  { id: 'updated_at', label: 'Aggiornata', sortable: true },
];

const ITEM_COLUMNS = [
  { id: 'req_key', label: 'Chiave', sortable: true },
  { id: 'req_text', label: 'Requisito', sortable: false },
  { id: 'clause', label: 'Norma / clausola', sortable: false },
  { id: 'coverage', label: 'Copertura', sortable: true },
  { id: 'hitl_status', label: 'HITL', sortable: true },
  { id: 'actions', label: 'Azioni', sortable: false },
];

function formatTs(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(v);
  }
}

function unwrapMaps(payload) {
  const data = payload?.data ?? payload;
  return Array.isArray(data?.maps) ? data.maps : [];
}

function unwrapDetail(payload) {
  const data = payload?.data ?? payload;
  return {
    map: data?.map || null,
    items: Array.isArray(data?.items) ? data.items : [],
  };
}

function unwrapCases(payload) {
  const raw = payload?.data ?? payload;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.cases)) return raw.cases;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

export default function ComplianceMapsPage() {
  const { companyId, scopeCompanyName, isStudioWide } = useCompanyScope();
  const [maps, setMaps] = useState([]);
  const [selectedMapId, setSelectedMapId] = useState(null);
  const [detailMap, setDetailMap] = useState(null);
  const [items, setItems] = useState([]);
  const [hitlFilter, setHitlFilter] = useState(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState('');
  const [highlightItemId, setHighlightItemId] = useState(null);

  // Deep link citazioni Assistente: ?select=mapId&highlight=itemId
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search || '');
      const sel = qs.get('select');
      const hi = qs.get('highlight');
      if (sel) setSelectedMapId(Number.isFinite(parseInt(sel, 10)) ? parseInt(sel, 10) : sel);
      if (hi) setHighlightItemId(hi);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMaps = useCallback(async () => {
    if (!companyId) {
      setMaps([]);
      setSelectedMapId(null);
      setDetailMap(null);
      setItems([]);
      return;
    }
    setLoadingList(true);
    setError(null);
    try {
      const res = await apiService.listComplianceMaps(companyId);
      const list = unwrapMaps(res);
      setMaps(list);
      setSelectedMapId((prev) => {
        if (prev && list.some((m) => String(m.id) === String(prev))) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      setError(err.message || 'Errore caricamento mappe');
      setMaps([]);
    } finally {
      setLoadingList(false);
    }
  }, [companyId]);

  const loadDetail = useCallback(async (mapId) => {
    if (!companyId || !mapId) {
      setDetailMap(null);
      setItems([]);
      return;
    }
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await apiService.getComplianceMap(companyId, mapId);
      const { map, items: rows } = unwrapDetail(res);
      setDetailMap(map);
      setItems(rows);
    } catch (err) {
      setError(err.message || 'Errore dettaglio mappa');
      setDetailMap(null);
      setItems([]);
    } finally {
      setLoadingDetail(false);
    }
  }, [companyId]);

  const loadCases = useCallback(async () => {
    if (!companyId) {
      setCases([]);
      setCaseId('');
      return;
    }
    try {
      const res = await apiService.getContractReviews();
      const all = unwrapCases(res);
      // Solo casi legati all'Ambito: company_id null passa il filtro UI ma
      // compile richiede company_id = Ambito → 404 «non trovato in questo ambito».
      const scoped = all.filter((c) => String(c.company_id) === String(companyId));
      setCases(scoped);
      setCaseId((prev) => {
        if (prev && scoped.some((c) => String(c.id) === String(prev))) return prev;
        return scoped[0]?.id != null ? String(scoped[0].id) : '';
      });
    } catch {
      setCases([]);
    }
  }, [companyId]);

  useEffect(() => {
    loadMaps();
    loadCases();
  }, [loadMaps, loadCases]);

  useEffect(() => {
    if (selectedMapId) loadDetail(selectedMapId);
    else {
      setDetailMap(null);
      setItems([]);
    }
  }, [selectedMapId, loadDetail]);

  const hitlCounts = useMemo(() => countByHitl(items), [items]);
  const filteredItems = useMemo(
    () => filterItemsByHitl(items, hitlFilter),
    [items, hitlFilter]
  );

  const compileOk = canCompile({ companyId, commercialCaseId: caseId, busy });
  const proposeOk = canProposeLinks({ companyId, map: detailMap, items, busy });
  const exportOk = canExportMap({ companyId, map: detailMap, items, busy });

  async function handleCompile() {
    if (!compileOk) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await apiService.compileComplianceMap(companyId, {
        commercial_case_id: parseInt(caseId, 10),
      });
      const data = res?.data ?? res;
      const newId = data?.map?.id ?? data?.id;
      setInfo('Mappa compilata: items in stato proposto (HITL obbligatorio).');
      await loadMaps();
      if (newId) setSelectedMapId(newId);
    } catch (err) {
      setError(err.message || 'Errore compilazione');
    } finally {
      setBusy(false);
    }
  }

  async function handleProposeLinks() {
    if (!proposeOk || !selectedMapId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await apiService.proposeComplianceMapLinks(companyId, selectedMapId, {});
      const data = res?.data ?? res;
      const n = data?.updated_count ?? data?.meta?.updated ?? data?.items?.length;
      setInfo(
        typeof n === 'number'
          ? `Link proposti su ${n} item (HITL: conferma o rifiuta).`
          : 'Link norma/legge proposti (HITL: conferma o rifiuta).'
      );
      await loadDetail(selectedMapId);
    } catch (err) {
      setError(err.message || 'Errore propose-links');
    } finally {
      setBusy(false);
    }
  }

  async function handleHitl(item, hitlStatus) {
    if (!canHitlAction(hitlStatus === 'accepted' ? 'accept' : 'reject', item, detailMap)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiService.patchComplianceMapItemHitl(
        companyId,
        selectedMapId,
        item.id,
        { hitl_status: hitlStatus }
      );
      await loadDetail(selectedMapId);
    } catch (err) {
      setError(err.message || 'Errore HITL');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!exportOk || !selectedMapId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await apiService.exportComplianceMap(companyId, selectedMapId, {
        format: 'json',
      });
      const payload = res?.data ?? res;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safe = String(detailMap?.title || `map-${selectedMapId}`)
        .replace(/[^\w\-]+/g, '_')
        .slice(0, 60);
      a.href = url;
      a.download = `compliance-map-${safe}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setInfo(
        `Export: ${payload?.itemCount ?? 0} nodi confermati (accepted/edited).`
      );
    } catch (err) {
      setError(err.message || 'Errore export');
    } finally {
      setBusy(false);
    }
  }

  function toggleHitlFilter(key) {
    setHitlFilter((prev) => (prev === key ? null : key));
  }

  return (
    <div className="page-container cm-page">
      <header className="cm-page-header">
        <div>
          <h1 className="cm-page-title">Mappa conformità</h1>
          <p className="cm-page-sub">
            Requisiti cliente ↔ norma/legge ↔ copertura. Revisione umana obbligatoria (HITL).
          </p>
        </div>
        <p className="cm-ambito" data-testid="cm-ambito">
          Ambito:{' '}
          <strong>
            {isStudioWide || !companyId
              ? "Seleziona un'azienda nell'Ambito in alto"
              : scopeCompanyName || `Azienda #${companyId}`}
          </strong>
        </p>
      </header>

      <section className="cm-toolbar" aria-label="Azioni mappa">
        <label className="cm-field">
          <span>Caso commerciale</span>
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            disabled={!companyId || cases.length === 0}
            title={
              !companyId
                ? "Seleziona un'azienda nell'Ambito in alto"
                : cases.length === 0
                  ? 'Nessun caso commerciale per questo Ambito'
                  : undefined
            }
            data-testid="cm-case-select"
          >
            {cases.length === 0 ? (
              <option value="">Nessun caso</option>
            ) : (
              cases.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  #{c.id} {c.title || c.case_title || c.reference || ''}
                </option>
              ))
            )}
          </select>
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={!compileOk}
          title={compileTitle({ companyId, commercialCaseId: caseId })}
          onClick={handleCompile}
          data-testid="cm-compile-btn"
        >
          {busy ? 'Attendere\u2026' : 'Compila da caso'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!proposeOk}
          title={proposeLinksTitle({ companyId, map: detailMap, items })}
          onClick={handleProposeLinks}
          data-testid="cm-propose-links-btn"
        >
          Propone link norma
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!exportOk}
          title={exportMapTitle({ companyId, map: detailMap, items })}
          onClick={handleExport}
          data-testid="cm-export-btn"
        >
          Esporta JSON
        </button>
      </section>

      {error && (
        <div className="cm-banner cm-banner-error" role="alert">
          {error}
        </div>
      )}
      {info && (
        <div className="cm-banner cm-banner-info" role="status">
          {info}
        </div>
      )}

      {!companyId && (
        <div className="cm-banner cm-banner-warn" role="status">
          Seleziona un&apos;azienda nell&apos;Ambito in alto per caricare le mappe.
        </div>
      )}

      <section className="cm-maps-section" aria-label="Elenco mappe">
        <h2 className="cm-section-title">Mappe</h2>
        {loadingList ? (
          <p className="cm-muted">{"Caricamento\u2026"}</p>
        ) : (
          <SgqDataGrid
            columns={MAP_COLUMNS}
            rows={maps}
            emptyMessage={companyId ? 'Nessuna mappa per questo Ambito' : 'Ambito non selezionato'}
            onRowClick={(row) => setSelectedMapId(row.id)}
            rowClassName={(row) =>
              selectedMapId != null && String(row.id) === String(selectedMapId)
                ? 'cm-map-row-selected'
                : ''
            }
            renderCell={(row, col) => {
              if (col.id === 'status') {
                return (
                  <StatusBadge
                    type="audit"
                    status={row.status === 'draft' ? 'draft' : row.status === 'approved' ? 'approved' : row.status === 'archived' ? 'archived' : 'in_progress'}
                    label={MAP_STATUS_LABELS[row.status] || row.status}
                  />
                );
              }
              if (col.id === 'updated_at') return formatTs(row.updated_at);
              if (col.id === 'source_label') return row.source_label || '—';
              if (col.id === 'map_version') return row.map_version ?? '—';
              return row[col.id] ?? '—';
            }}
          />
        )}
      </section>

      <section className="cm-items-section" aria-label="Requisiti mappa">
        <div className="cm-items-header">
          <h2 className="cm-section-title">
            Requisiti
            {detailMap ? (
              <span className="cm-muted">
                {' '}
                — {detailMap.title}
                {MUTABLE_MAP_STATUSES.has(String(detailMap.status || '').toLowerCase())
                  ? ''
                  : ' (sola lettura)'}
              </span>
            ) : null}
          </h2>
        </div>

        <div className="sq-stats-bar" role="group" aria-label="Filtro HITL">
          {Object.keys(HITL_LABELS).map((key) => {
            const active = hitlFilter === key;
            const cls =
              key === 'accepted'
                ? 'sq-stat-verde'
                : key === 'rejected'
                  ? 'sq-stat-rosso'
                  : key === 'proposed'
                    ? 'sq-stat-giallo'
                    : 'sq-stat-grigio';
            return (
              <button
                key={key}
                type="button"
                className={`sq-stat sq-stat-clickable ${cls}${active ? ' sq-stat-active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleHitlFilter(key)}
                data-testid={`cm-hitl-kpi-${key}`}
              >
                <span className="sq-stat-num">{hitlCounts[key] || 0}</span>
                <span className="sq-stat-lbl">{HITL_LABELS[key]}</span>
              </button>
            );
          })}
        </div>

        {loadingDetail ? (
          <p className="cm-muted">{"Caricamento dettaglio\u2026"}</p>
        ) : (
          <SgqDataGrid
            columns={ITEM_COLUMNS}
            rows={filteredItems}
            rowClassName={(row) => {
              const hitl = hitlRowClass(row.hitl_status);
              if (
                highlightItemId != null &&
                String(row.id) === String(highlightItemId)
              ) {
                return `${hitl} cm-item-row-highlight`.trim();
              }
              return hitl;
            }}
            emptyMessage={
              detailMap
                ? hitlFilter
                  ? `Nessun item «${HITL_LABELS[hitlFilter]}»`
                  : 'Nessun requisito in questa mappa'
                : 'Seleziona una mappa'
            }
            renderCell={(row, col) => {
              if (col.id === 'req_text') {
                const t = String(row.req_text || '');
                return t.length > 160 ? `${t.slice(0, 157)}\u2026` : t || '—';
              }
              if (col.id === 'clause') {
                const parts = [row.standard_code, row.clause_ref].filter(Boolean);
                const leg = row.legislation_ref ? ` · ${row.legislation_ref}` : '';
                return (parts.join(' ') || '—') + leg;
              }
              if (col.id === 'coverage') {
                return COVERAGE_LABELS[row.coverage] || row.coverage || '—';
              }
              if (col.id === 'hitl_status') {
                const st = String(row.hitl_status || '').toLowerCase();
                return (
                  <StatusBadge
                    type="material_certificate"
                    status={
                      st === 'accepted'
                        ? 'compliant'
                        : st === 'rejected'
                          ? 'non_compliant'
                          : 'pending_review'
                    }
                    label={HITL_LABELS[st]?.replace(/i$/, 'o') || row.hitl_status}
                  />
                );
              }
              if (col.id === 'actions') {
                const acceptOk = canHitlAction('accept', row, detailMap) && !!companyId && !busy;
                const rejectOk = canHitlAction('reject', row, detailMap) && !!companyId && !busy;
                return (
                  <div className="cm-item-actions">
                    <button
                      type="button"
                      className="btn-primary cm-btn-sm"
                      disabled={!acceptOk}
                      title={hitlActionTitle('accept', row, detailMap, { companyId })}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHitl(row, 'accepted');
                      }}
                      data-testid={`cm-accept-${row.id}`}
                    >
                      Accetta
                    </button>
                    <button
                      type="button"
                      className="btn-secondary cm-btn-sm"
                      disabled={!rejectOk}
                      title={hitlActionTitle('reject', row, detailMap, { companyId })}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHitl(row, 'rejected');
                      }}
                      data-testid={`cm-reject-${row.id}`}
                    >
                      Rifiuta
                    </button>
                  </div>
                );
              }
              return row[col.id] ?? '—';
            }}
          />
        )}
      </section>

      <AiDisclaimer style={{ marginTop: '1.25rem' }} />
    </div>
  );
}
