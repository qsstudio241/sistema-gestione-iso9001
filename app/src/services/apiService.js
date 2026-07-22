/**
 * API Service - Client HTTP centralizzato
 * Sistema Gestione ISO 9001 - QS Studio
 * 
 * Features:
 * - Configurazione automatica ambiente (dev/prod)
 * - Gestione token JWT con refresh automatico
 * - Interceptor per errori e retry
 * - Supporto offline con fallback
 */

// Configurazione ambiente - usa VITE_API_URL se presente
const API_CONFIG = {
    development: {
        baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:10443/api/v1',
        timeout: 10000
    },
    production: {
        baseUrl: import.meta.env.VITE_API_URL || 'https://www.fr-busato.it:8443/api/v1',
        timeout: 15000
    }
};

// Rileva ambiente
const ENV = import.meta.env.MODE || 'development';
const config = API_CONFIG[ENV] || API_CONFIG.development;

// Storage keys
const TOKEN_KEY = 'sgq_auth_token';
const REFRESH_TOKEN_KEY = 'sgq_refresh_token';
const USER_KEY = 'sgq_user';

/**
 * Token lock audit per UUID e per audit_id numerico (header X-Audit-Lock-Token sulle scritture).
 *
 * Persistenza sessionStorage: i token sopravvivono a page refresh e SW update
 * all'interno della stessa tab del browser. Vengono eliminati alla chiusura tab
 * o al logout (clearAllAuditLockTokens).
 * Questo evita che la sync queue (IndexedDB) rimanga bloccata con AUDIT_LOCK_REQUIRED
 * dopo un reload silenzioso causato da un aggiornamento del Service Worker.
 */
const LOCK_TOKEN_SS_KEY = 'sgq:lockTokens';
const AUDIT_LOCK_TOKENS = new Map();

/**
 * Millisecondi di attesa consigliati da una risposta HTTP 429.
 * Usa Retry-After (secondi) se presente; altrimenti RateLimit-Reset (Unix secondi, draft standard).
 * Clamp 5s … 15 min per evitare sia burst sia attese infinite.
 */
function parseHttp429RetryAfterMs(response) {
    const minWait = 5000;
    const maxWait = 15 * 60 * 1000;
    const ra = response.headers?.get?.('retry-after');
    if (ra != null && String(ra).trim() !== '') {
        const sec = parseFloat(String(ra).trim());
        if (Number.isFinite(sec)) {
            return Math.min(Math.max(sec * 1000, minWait), maxWait);
        }
    }
    const rlReset = response.headers?.get?.('ratelimit-reset');
    if (rlReset != null && String(rlReset).trim() !== '') {
        const n = parseInt(String(rlReset).trim(), 10);
        if (!Number.isFinite(n)) return 60000;
        if (n > 1e9) {
            const ms = n * 1000 - Date.now();
            return Math.min(Math.max(ms, minWait), maxWait);
        }
        return Math.min(Math.max(n * 1000, minWait), maxWait);
    }
    return 60000;
}

/** Carica i token persistiti in sessionStorage (chiamato una sola volta all'avvio del modulo) */
(function _restoreLockTokensFromSession() {
    try {
        const raw = sessionStorage.getItem(LOCK_TOKEN_SS_KEY);
        if (!raw) return;
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) {
            if (k && v) AUDIT_LOCK_TOKENS.set(k, v);
        }
    } catch {
        // sessionStorage non disponibile o JSON malformato: non bloccare l'avvio
    }
})();

/** Salva la mappa corrente in sessionStorage */
function _persistLockTokens() {
    try {
        const obj = Object.fromEntries(AUDIT_LOCK_TOKENS);
        sessionStorage.setItem(LOCK_TOKEN_SS_KEY, JSON.stringify(obj));
    } catch {
        // sessionStorage pieno o non disponibile: ignora (non bloccante)
    }
}

/**
 * Registra il token lock per l'audit: stesso token sotto UUID (acquire) e sotto audit_id (PUT risposte / checklist custom).
 * Passa token null per rimuovere entrambe le chiavi.
 */
function setAuditLockTokensForAudit(auditUuid, serverAuditId, token) {
    if (!auditUuid) return;
    const u = String(auditUuid);
    if (token) {
        AUDIT_LOCK_TOKENS.set(u, token);
        if (serverAuditId != null && String(serverAuditId).trim() !== '') {
            AUDIT_LOCK_TOKENS.set(String(serverAuditId), token);
        }
    } else {
        AUDIT_LOCK_TOKENS.delete(u);
        if (serverAuditId != null && String(serverAuditId).trim() !== '') {
            AUDIT_LOCK_TOKENS.delete(String(serverAuditId));
        }
    }
    _persistLockTokens();
}

function clearAllAuditLockTokens() {
    AUDIT_LOCK_TOKENS.clear();
    try { sessionStorage.removeItem(LOCK_TOKEN_SS_KEY); } catch { /* no-op */ }
}

/**
 * Verifica se esiste un token di lock attivo per un audit UUID o ID.
 * Usato da syncService per evitare di tentare update_audit senza lock → 423.
 */
function hasAuditLockToken(auditRef) {
    if (!auditRef) return false;
    return AUDIT_LOCK_TOKENS.has(String(auditRef));
}

/**
 * Classe API Client
 */
class ApiService {
    constructor() {
        this.baseUrl = config.baseUrl;
        this.timeout = config.timeout;
        this.isRefreshing = false;
        this.refreshSubscribers = [];
    }

    /**
     * Ottieni token dal localStorage
     */
    getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    /**
     * Salva token
     */
    setToken(token, refreshToken = null) {
        localStorage.setItem(TOKEN_KEY, token);
        if (refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
    }

    /**
     * Rimuovi token (logout)
     */
    clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    /**
     * Ottieni user salvato
     */
    getStoredUser() {
        const user = localStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    }

    /**
     * Salva user
     */
    setStoredUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    /**
     * Headers comuni per le richieste
     */
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (includeAuth) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    /**
     * Esegue richiesta HTTP con gestione errori
     */
    async request(method, endpoint, data = null, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const { includeAuth = true, timeout = this.timeout } = options;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const fetchOptions = {
                method,
                headers: { ...this.getHeaders(includeAuth) },
                signal: controller.signal
            };

            if (options.lockAuditUuid) {
                const lt = AUDIT_LOCK_TOKENS.get(String(options.lockAuditUuid));
                if (lt) {
                    fetchOptions.headers['X-Audit-Lock-Token'] = lt;
                }
            }

            if (data && method !== 'GET') {
                fetchOptions.body = JSON.stringify(data);
            }

            console.log(`🌐 [API] ${method} ${endpoint}`);
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            // Gestione errori HTTP
            if (!response.ok) {
                // Token scaduto → tenta refresh
                if (response.status === 401 && includeAuth) {
                    const refreshed = await this.refreshToken();
                    if (refreshed) {
                        // Riprova la richiesta originale
                        return this.request(method, endpoint, data, options);
                    } else {
                        // Refresh fallito → logout
                        this.clearToken();
                        window.dispatchEvent(new CustomEvent('auth:logout'));
                        throw new ApiError('Sessione scaduta', 401, 'SESSION_EXPIRED');
                    }
                }

                const errorData = await response.json().catch(() => ({}));
                let errorPayload = errorData;
                if (response.status === 429) {
                    const retryAfterMs = parseHttp429RetryAfterMs(response);
                    errorPayload = { ...errorData, retryAfterMs };
                }
                throw new ApiError(
                    errorData.error || `HTTP ${response.status}`,
                    response.status,
                    errorData.code || 'API_ERROR',
                    errorPayload // ← preserva serverData, conflict info, retryAfterMs su 429
                );
            }

            const result = await response.json();
            console.log(`✅ [API] ${method} ${endpoint} OK`);
            return result;

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new ApiError('Richiesta timeout', 408, 'TIMEOUT');
            }

            if (error instanceof ApiError) {
                throw error;
            }

            // Errore di rete (offline)
            if (!navigator.onLine) {
                throw new ApiError('Connessione assente', 0, 'OFFLINE');
            }

            throw new ApiError(error.message, 0, 'NETWORK_ERROR');
        }
    }

    /**
     * Tenta refresh token
     */
    async refreshToken() {
        if (this.isRefreshing) {
            // Attendi refresh in corso
            return new Promise((resolve) => {
                this.refreshSubscribers.push(resolve);
            });
        }

        this.isRefreshing = true;
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

        if (!refreshToken) {
            this.isRefreshing = false;
            return false;
        }

        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            if (!response.ok) {
                throw new Error('Refresh failed');
            }

            const data = await response.json();
            this.setToken(data.token, data.refreshToken);

            // Notifica tutti i subscribers
            this.refreshSubscribers.forEach(callback => callback(true));
            this.refreshSubscribers = [];

            console.log('🔄 [API] Token refreshed');
            return true;

        } catch (error) {
            console.error('❌ [API] Token refresh failed:', error);
            this.refreshSubscribers.forEach(callback => callback(false));
            this.refreshSubscribers = [];
            return false;

        } finally {
            this.isRefreshing = false;
        }
    }

    // ==========================================
    // METODI HTTP
    // ==========================================

    async get(endpoint, options = {}) {
        return this.request('GET', endpoint, null, options);
    }

    async post(endpoint, data, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    async put(endpoint, data, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    async patch(endpoint, data, options = {}) {
        return this.request('PATCH', endpoint, data, options);
    }

    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    // ==========================================
    // AUTH ENDPOINTS
    // ==========================================

    /**
     * Login con email e password
     */
    async login(email, password) {
        const response = await this.post('/auth/login', { email, password }, { includeAuth: false });

        if (response.success && response.token) {
            this.setToken(response.token, response.refreshToken);
            this.setStoredUser(response.user);
            return response;
        }

        throw new ApiError(response.error || 'Login fallito', 401, 'LOGIN_FAILED');
    }

    /**
     * Logout
     */
    async logout() {
        // JWT stateless: logout server-side è no-op.
        // Evita chiamate rete che possono generare rumore in console
        // (es. 403 MODULE_NOT_LICENSED su ambienti con middleware non coerenti).
        this.clearToken();
    }

    /**
     * Verifica sessione corrente con il server.
     * 
     * Semantica deliberata:
     * - Ritorna `user` se il token è valido.
     * - Ritorna `null` SOLO se il token è confermato non valido (401 dopo tentativo refresh).
     * - LANCIA un errore per qualsiasi problema di rete/timeout, così il
     *   chiamante può distinguere "token invalido" da "rete assente" e
     *   usare la sessione in cache senza fare il logout dell'utente.
     */
    async checkSession() {
        try {
            const response = await this.get('/auth/me');
            return response.user || null;
        } catch (error) {
            // Token confermato invalido/scaduto (dopo il tentativo di refresh)
            if (error.code === 'SESSION_EXPIRED' || error.status === 401) {
                this.clearToken();
                return null; // segnale esplicito: token non valido
            }
            // Errore di rete, timeout, server offline → rilancia
            // Il caller (AuthContext.initSession) userà la sessione in cache
            // senza cancellare il token (fix auth loop su Android PWA)
            throw error;
        }
    }

    // ==========================================
    // AUDIT ENDPOINTS
    // ==========================================

    async getAudits(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/audits${query ? '?' + query : ''}`);
    }

    async getAudit(id) {
        return this.get(`/audits/${id}`);
    }

    async createAudit(data) {
        return this.post('/audits', data);
    }

    async updateAudit(id, data) {
        // Stesso lock delle risposte: PUT /audits/:id richiede assertWriteAllowed se esiste lock attivo
        const lockKey = id != null && id !== '' ? String(id) : undefined;
        return this.put(`/audits/${id}`, data, lockKey ? { lockAuditUuid: lockKey } : {});
    }

    /**
     * Upsert audit (INSERT or UPDATE per sync offline-first)
     * Usa audit_uuid come chiave stabile
     */
    async upsertAudit(auditData) {
        const uuid = auditData?.audit_uuid || auditData?.id;
        return this.post('/audits/sync', auditData, { lockAuditUuid: uuid || undefined });
    }

    /** Acquisisce lock pessimistico sull'audit (ref = UUID o audit_id) */
    async acquireAuditLock(auditRef) {
        return this.post(`/audits/${encodeURIComponent(auditRef)}/lock`, {});
    }

    async renewAuditLock(auditRef) {
        return this.request('PUT', `/audits/${encodeURIComponent(auditRef)}/lock`, null, {
            lockAuditUuid: String(auditRef),
        });
    }

    async releaseAuditLock(auditRef) {
        return this.request('DELETE', `/audits/${encodeURIComponent(auditRef)}/lock`, null, {
            lockAuditUuid: String(auditRef),
        });
    }

    async getAuditLockStatus(auditRef) {
        return this.get(`/audits/${encodeURIComponent(auditRef)}/lock/status`);
    }

    async deleteAudit(id) {
        return this.delete(`/audits/${id}`);
    }

    async checkReaudit(clientName, currentAuditUuid = null) {
        return this.post('/audits/check-reaudit', { client_name: clientName, current_audit_uuid: currentAuditUuid });
    }

    /**
     * Rilievi pendenti (NC/OSS/OM) di un audit già esistente
     * :auditId = audit_id INTEGER (dal campo last_audit_id di checkReaudit)
     */
    async getNcResponses(auditId) {
        return this.get(`/audits/${auditId}/nc-responses`);
    }

    /**
     * Storico ultimi audit completati per un cliente (modal re-audit — GAP 13)
     * @param {object} params - { client_name?, company_id?, limit? }
     */
    async getClientAuditHistory(params = {}) {
        const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
        return this.get(`/audits/client-history${qs ? '?' + qs : ''}`);
    }

    /**
     * Pending issues associati a un audit corrente
     * :auditId = audit_id INTEGER
     */
    async getPendingIssues(auditId) {
        return this.get(`/audits/${auditId}/pending-issues`);
    }

    /**
     * Aggiorna stato di risoluzione di un rilievo pendente
     * { status: 'resolved'|'persists'|'in_progress', resolution_notes?: string }
     */
    async updatePendingIssue(auditId, issueId, data) {
        return this.put(`/audits/${auditId}/pending-issues/${issueId}`, data);
    }

    /**
     * Chiude formalmente l'audit (status → completed)
     */
    async completeAudit(auditId) {
        return this.post(`/audits/${auditId}/complete`, {});
    }

    /**
     * Approva l'audit completato (status → approved, definitivamente bloccato)
     */
    async approveAudit(auditId) {
        return this.post(`/audits/${auditId}/approve`, {});
    }

    // ==========================================
    // COMPANIES (Fase 1 Multi-Tenant)
    // ==========================================

    async getCompanies(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/companies${query ? '?' + query : ''}`);
    }

    async getCompany(id, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/companies/${id}${query ? '?' + query : ''}`);
    }

    async createCompany(data) {
        return this.post('/companies', data);
    }

    async updateCompany(id, data) {
        return this.put(`/companies/${id}`, data);
    }

    async deleteCompany(id) {
        return this.delete(`/companies/${id}`);
    }

    async uploadCompanyLogo(id, file) {
        const formData = new FormData();
        formData.append('logo', file);
        const token = this.getToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch(`${this.baseUrl}/companies/${id}/logo`, {
            method: 'POST',
            headers,
            body: formData
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Errore upload logo' }));
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        return response.json();
    }

    async deleteCompanyLogo(id) {
        return this.delete(`/companies/${id}/logo`);
    }

    getCompanyLogoUrl(id) {
        return `${this.baseUrl}/companies/${id}/logo`;
    }

    async getCompanyPersonnel(companyId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/companies/${companyId}/personnel${query ? '?' + query : ''}`);
    }

    async createCompanyPersonnel(companyId, data, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.post(`/companies/${companyId}/personnel${query ? '?' + query : ''}`, data);
    }

    async updateCompanyPersonnel(companyId, personnelId, data, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.put(`/companies/${companyId}/personnel/${personnelId}${query ? '?' + query : ''}`, data);
    }

    async deleteCompanyPersonnel(companyId, personnelId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.delete(`/companies/${companyId}/personnel/${personnelId}${query ? '?' + query : ''}`);
    }

    async importPersonnelFromQualifications(companyId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.post(`/companies/${companyId}/personnel/import-from-qualifications${query ? '?' + query : ''}`, {});
    }

    async linkPersonnelQualifications(companyId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.post(`/companies/${companyId}/personnel/link-qualifications${query ? '?' + query : ''}`, {});
    }

    async getPersonnelQualifications(companyId, personnelId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/companies/${companyId}/personnel/${personnelId}/qualifications${query ? '?' + query : ''}`);
    }

    async getCompanyCounterparties(companyId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/companies/${companyId}/counterparties${query ? '?' + query : ''}`);
    }

    async getCompanyCounterparty(companyId, counterpartyId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.get(`/companies/${companyId}/counterparties/${counterpartyId}${query ? '?' + query : ''}`);
    }

    async createCompanyCounterparty(companyId, data, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.post(`/companies/${companyId}/counterparties${query ? '?' + query : ''}`, data);
    }

    async updateCompanyCounterparty(companyId, counterpartyId, data, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.put(`/companies/${companyId}/counterparties/${counterpartyId}${query ? '?' + query : ''}`, data);
    }

    async deactivateCompanyCounterparty(companyId, counterpartyId, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.patch(`/companies/${companyId}/counterparties/${counterpartyId}/deactivate${query ? '?' + query : ''}`, {});
    }

    // ==========================================
    // ORGANIZATION (tenant — P.IVA, logo)
    // ==========================================

    async getMyOrganization() {
        return this.get('/organizations/me');
    }

    async patchMyOrganization(body) {
        return this.patch('/organizations/me', body);
    }

    getOrganizationLogoUrl() {
        return `${this.baseUrl}/organizations/me/logo`;
    }

    async uploadOrganizationLogo(file) {
        const formData = new FormData();
        formData.append('logo', file);
        const token = this.getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${this.baseUrl}/organizations/me/logo`, {
            method: 'POST',
            headers,
            body: formData,
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Errore upload logo organizzazione' }));
            throw new Error(err.error || `HTTP ${response.status}`);
        }
        return response.json();
    }

    async deleteOrganizationLogo() {
        return this.delete('/organizations/me/logo');
    }

    async getAuditorOrgs() {
        return this.get('/auditor-orgs');
    }

    async getAuditorOrg(id) {
        return this.get(`/auditor-orgs/${id}`);
    }

    /**
     * Lista utenti organizzazione (solo admin)
     * @returns {Promise<{ success: boolean, data: Array }>}
     */
    async getAdminUsers() {
        return this.get('/admin/users');
    }

    /**
     * Crea utente nella propria organizzazione (solo admin)
     * @param {{ email: string, password: string, full_name: string, role?: string, auditor_org_id?: number|null }} body
     */
    async createAdminUser(body) {
        return this.post('/admin/users', body);
    }

    /**
     * Aggiorna utente (PATCH parziale)
     * @param {number} userId
     * @param {Record<string, unknown>} body - full_name, role, is_active, auditor_org_id, password
     */
    async patchAdminUser(userId, body) {
        return this.patch(`/admin/users/${userId}`, body);
    }

    /**
     * Disattiva utente (soft delete)
     * @param {number} userId
     */
    async deactivateAdminUser(userId) {
        return this.delete(`/admin/users/${userId}`);
    }

    /**
     * Aggiorna standard consentiti per utente (solo admin)
     * @param {number} userId
     * @param {number[]} standardIds - array di standard_id (es. [1,2,3] per 9001, 14001, 45001)
     */
    async updateUserStandards(userId, standardIds) {
        return this.put(`/admin/users/${userId}/standards`, { standard_ids: standardIds });
    }

    // ==========================================
    // CHECKLIST ENDPOINTS
    // ==========================================

    async getChecklist(auditId) {
        return this.get(`/checklists/audit/${auditId}`);
    }

    async updateChecklistItem(auditId, sectionId, itemId, data) {
        return this.put(`/checklists/audit/${auditId}/section/${sectionId}/item/${itemId}`, data);
    }

    async saveChecklist(auditId, data) {
        return this.put(`/checklists/audit/${auditId}`, data);
    }

    // ==========================================
    // AUDIT RESPONSES ENDPOINTS (Checklist Answers)
    // ==========================================

    /**
     * Recupera tutte le risposte per un audit
     */
    async getAuditResponses(auditId) {
        return this.get(`/audits/${auditId}/responses`);
    }

    /**
     * Salva singola risposta
     * @param {number} auditId 
     * @param {Object} response - { question_id, conformity_status, notes, evidence, client_updated_at }
     */
    async saveAuditResponse(auditId, response) {
        return this.post(`/audits/${auditId}/responses`, response, { lockAuditUuid: String(auditId) });
    }

    /**
     * Salva multiple risposte in batch (per sync offline)
     * @param {number} auditId 
     * @param {Array} responses - Array di risposte
     */
    async bulkSaveResponses(auditId, responses) {
        return this.post(`/audits/${auditId}/responses/bulk`, { responses }, { lockAuditUuid: String(auditId) });
    }

    /**
     * Elimina risposta
     */
    async deleteAuditResponse(auditId, questionId) {
        return this.delete(`/audits/${auditId}/responses/${questionId}`, { lockAuditUuid: String(auditId) });
    }

    // ==========================================
    // SYNC ENDPOINTS
    // ==========================================

    /**
     * Sincronizza audit offline → online
     * @param {Array} audits - Array di audit da sincronizzare
     * @param {number} lastSyncTimestamp - Timestamp ultima sync
     */
    async syncAudits(audits, lastSyncTimestamp = null) {
        return this.post('/sync/audits', { audits, lastSyncTimestamp });
    }

    /**
     * Aggiorna sync metadata
     */
    async updateSyncMetadata(entityType, entityId, entityUuid, syncVersion) {
        return this.post('/sync/metadata', { entityType, entityId, entityUuid, syncVersion });
    }

    // ==========================================
    // NON-CONFORMITY ENDPOINTS
    // ==========================================

    async getNonConformities(auditId = null) {
        const endpoint = auditId ? `/nc?audit_id=${auditId}` : '/nc';
        return this.get(endpoint);
    }

    async getNonConformity(id) {
        return this.get(`/non-conformities/${id}`);
    }

    async createNonConformity(data) {
        return this.post('/non-conformities', data);
    }

    async updateNonConformity(id, data) {
        return this.put(`/nc/${id}`, data);
    }

    async deleteNonConformity(id) {
        return this.delete(`/nc/${id}`);
    }

    // ─── NC cross-audit (Sprint 5) ───────────────────────────────────────────
    async getAllNonConformities(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/non-conformities${qs ? '?' + qs : ''}`);
    }

    async getNcStats(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/non-conformities/statistics/overview${qs ? '?' + qs : ''}`);
    }

    /** Alias per HomePage e codice legacy — delega a getNcStats */
    async getNonConformitiesStatistics(params = {}) {
        return this.getNcStats(params);
    }

    async updateNcStatus(id, data) {
        return this.put(`/non-conformities/${id}`, data);
    }

    async approveNcClosure(id) {
        return this.post(`/non-conformities/${id}/approve-closure`, {});
    }

    async getAggregateDueNcActions(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/non-conformities/actions/due${qs ? '?' + qs : ''}`);
    }

    async getChecklistSectionsByStandard(standardId) {
        return this.get(`/checklist/sections?standard_id=${standardId}`);
    }

    // NC Actions
    async getNcActions(ncId) {
        return this.get(`/non-conformities/${ncId}/actions`);
    }

    async createNcAction(ncId, data) {
        return this.post(`/non-conformities/${ncId}/actions`, data);
    }

    async updateNcAction(ncId, actionId, data) {
        return this.put(`/non-conformities/${ncId}/actions/${actionId}`, data);
    }

    async deleteNcAction(ncId, actionId) {
        return this.delete(`/non-conformities/${ncId}/actions/${actionId}`);
    }

    // ─── Audit -> Registro NC (push bulk con undo) ────────────────────────────
    // Trasferisce tutte le NC/OSS rilevate nella checklist di un audit al modulo
    // organizzativo non_conformities. Idempotente (skip se gia presenti per
    // stessa coppia audit_id + question_id).
    async pushAuditToNcRegister(auditRef) {
        return this.post(`/audits/${auditRef}/push-to-nc-register`, {});
    }

    // Annulla push: elimina le NC create con source_type 'audit_nc'/'audit_oss'
    // ancora in stato 'open' e senza azioni correttive. Usato dalla UI per
    // l'undo entro 10 secondi dalla pressione del pulsante.
    async undoPushAuditToNcRegister(auditRef) {
        return this.delete(`/audits/${auditRef}/push-to-nc-register`);
    }

    // ==========================================
    // STANDARDS ENDPOINTS
    // ==========================================

    async getStandards() {
        return this.get('/standards');
    }

    async getStandard(id) {
        return this.get(`/standards/${id}`);
    }

    async getStandardSections(standardId) {
        return this.get(`/standards/${standardId}/sections`);
    }

    async getChecklistQuestions(standardId, sectionCode) {
        return this.get(`/checklist/questions?standard_id=${standardId}&section_code=${sectionCode}`);
    }

    // ==========================================
    // ATTACHMENT ENDPOINTS
    // ==========================================

    /**
     * Lista allegati per audit (+ filtro opzionale per question_id o nc_id)
     */
    async getAttachments(auditId = null, ncId = null, questionId = null, customItemId = null) {
        const params = new URLSearchParams();
        if (auditId) params.append('audit_id', auditId);
        if (ncId) params.append('nc_id', ncId);
        if (questionId) params.append('question_id', questionId);
        if (customItemId) params.append('custom_item_id', customItemId);
        return this.get(`/attachments${params.toString() ? '?' + params.toString() : ''}`);
    }

    /**
     * Upload allegato (usa FormData, non JSON)
     */
    async uploadAttachment(file, options = {}) {
        const { auditId, ncId, questionId, customItemId, category = 'evidence', description } = options;

        const formData = new FormData();
        formData.append('file', file);
        if (auditId) formData.append('audit_id', auditId);
        if (ncId) formData.append('nc_id', ncId);
        if (questionId) formData.append('question_id', questionId);
        if (customItemId) formData.append('custom_item_id', customItemId);
        formData.append('category', category);
        if (description) formData.append('description', description);

        const token = this.getToken();
        const headers = {
            'Authorization': `Bearer ${token}`,
        };
        if (auditId) {
            const lt = AUDIT_LOCK_TOKENS.get(String(auditId));
            if (lt) headers['X-Audit-Lock-Token'] = lt;
        }
        const response = await fetch(`${this.baseUrl}/attachments/upload`, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.error || 'Upload fallito',
                response.status,
                errorData.code || 'UPLOAD_ERROR'
            );
        }

        return response.json();
    }

    /**
     * URL download forzato (browser salva il file)
     * Usa ?token= così funziona anche in <a href> senza fetch
     */
    getAttachmentDownloadUrl(attachmentId) {
        const token = this.getToken();
        return `${this.baseUrl}/attachments/${attachmentId}/download?token=${encodeURIComponent(token || '')}`;
    }

    /**
     * URL visualizzazione inline — manteniamo per compatibilità legacy.
     * NOTA: preferire fetchAttachmentBlob() per evitare problemi token in URL.
     * @deprecated usa fetchAttachmentBlob invece
     */
    getAttachmentViewUrl(attachmentId) {
        const token = this.getToken();
        return `${this.baseUrl}/attachments/${attachmentId}/view?token=${encodeURIComponent(token || '')}`;
    }

    /**
     * Recupera un allegato come Blob usando Authorization: Bearer header.
     * Soluzione robusta per immagini/PDF/documenti in SPA cross-origin.
     * Ritorna: { blob, mimeType, fileName }
     */
    async fetchAttachmentBlob(attachmentId, mode = 'view') {
        const token = this.getToken();
        const url = `${this.baseUrl}/attachments/${attachmentId}/${mode}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.error || 'Caricamento allegato fallito',
                response.status,
                errorData.code || 'FETCH_BLOB_ERROR'
            );
        }

        const blob = await response.blob();
        const mimeType = response.headers.get('Content-Type') || blob.type;
        const disposition = response.headers.get('Content-Disposition') || '';
        const fileNameMatch = disposition.match(/filename="?([^";\n]+)"?/i);
        const fileName = fileNameMatch?.[1] || `allegato_${attachmentId}`;

        return { blob, mimeType, fileName };
    }

    /**
     * Scarica un allegato via fetch (Authorization header) e salva tramite link.
     * Funziona sempre, anche cross-origin.
     */
    async downloadAttachmentBlob(attachmentId, suggestedName) {
        const { blob, fileName } = await this.fetchAttachmentBlob(attachmentId, 'download');
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = suggestedName || fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }

    /**
     * Sostituisce un allegato esistente con un nuovo file (desktop-only).
     * Elimina il file vecchio dal server e salva il nuovo.
     */
    async replaceAttachment(attachmentId, file) {
        const formData = new FormData();
        formData.append('file', file);

        const token = this.getToken();
        const response = await fetch(`${this.baseUrl}/attachments/${attachmentId}/replace`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.error || 'Sostituzione fallita',
                response.status,
                errorData.code || 'REPLACE_ERROR'
            );
        }

        return response.json();
    }

    /**
     * Elimina allegato
     */
    async deleteAttachment(attachmentId) {
        return this.delete(`/attachments/${attachmentId}`);
    }

    // ==========================================
    // REPORT TEMPLATES (Phase 3 - Roadmap)
    // ==========================================

    /**
     * Risolve quale template usare per standard_id o custom_checklist_id.
     * Usato da wordExport prima di generare report.
     * @param {number|null} standardId - ID standard (1=9001, 2=14001, ...)
     * @param {number|null} customChecklistId - ID checklist custom (per audit solo-checklist)
     * @returns {Promise<{url: string, file_path: string, name: string}|null>} URL assoluto per fetch, o null se API non disponibile
     */
    async getReportTemplate(standardId, customChecklistId = null) {
        try {
            const params = new URLSearchParams();
            if (standardId != null) params.set('standardId', standardId);
            if (customChecklistId != null) params.set('customChecklistId', customChecklistId);
            const res = await this.get(`/report-templates/resolve?${params.toString()}`);
            if (!res?.success || !res?.data?.file_path) return null;
            const fp = res.data.file_path;
            const name = res.data.name;
            const id = res.data.id;
            // Template di sistema: /templates/xxx → path relativo, fetch usa origin dell'app
            if (fp.startsWith('/templates/')) {
                return { id, url: fp, file_path: fp, name };
            }
            // Template org: /uploads/xxx → URL assoluto backend
            const backendBase = this.baseUrl.replace(/\/api\/v1\/?$/, '');
            return { id, url: backendBase + (fp.startsWith('/') ? fp : '/' + fp), file_path: fp, name };
        } catch {
            return null;
        }
    }

    /**
     * Lista template disponibili (sistema + org)
     */
    async getReportTemplates(scope = 'audit') {
        return this.get(`/report-templates?scope=${scope}`);
    }

    /**
     * Carica un template Word (.docx) per l'organizzazione (admin/auditor)
     * @param {File} file - file .docx (max 5 MB)
     * @param {{ name?: string, scope?: string }} options
     */
    async uploadReportTemplate(file, options = {}) {
        const { name, scope = 'audit' } = options;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('scope', scope);
        if (name && String(name).trim()) {
            formData.append('name', String(name).trim());
        }

        const token = this.getToken();
        const response = await fetch(`${this.baseUrl}/report-templates`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.error || 'Caricamento template fallito',
                response.status,
                errorData.code || 'REPORT_TEMPLATE_UPLOAD_ERROR'
            );
        }

        return response.json();
    }

    /**
     * Assegna template a standard per l'org
     */
    async assignReportTemplateToStandard(standardId, reportTemplateId) {
        return this.put(`/report-template-assignments/standard/${standardId}`, { report_template_id: reportTemplateId });
    }

    /**
     * Assegna template a checklist custom per l'org (Phase 7)
     */
    async assignReportTemplateToCustomChecklist(customChecklistId, reportTemplateId) {
        return this.put(`/report-template-assignments/custom-checklist/${customChecklistId}`, { report_template_id: reportTemplateId });
    }

    /**
     * Assegnazioni template per standard (org corrente)
     */
    async getReportTemplateStandardAssignments() {
        return this.get('/report-template-assignments/standards');
    }

    /**
     * Assegnazione template export scheda NC (org corrente)
     */
    async getNcReportTemplateAssignment() {
        return this.get('/report-template-assignments/nc');
    }

    /**
     * Assegna template export NC dello studio (null = modello di sistema)
     */
    async assignReportTemplateToNc(reportTemplateId) {
        return this.put('/report-template-assignments/nc', {
            report_template_id: reportTemplateId ?? null,
        });
    }

    /**
     * Risolve template Word per export scheda NC
     * @returns {Promise<{url: string, file_path: string, name: string, id: number}|null>}
     */
    async resolveNcReportTemplate() {
        try {
            const res = await this.get('/report-templates/resolve?scope=nc');
            if (!res?.success || !res?.data?.file_path) return null;
            const fp = res.data.file_path;
            const name = res.data.name;
            const id = res.data.id;
            if (fp.startsWith('/templates/')) {
                return { id, url: fp, file_path: fp, name };
            }
            const backendBase = this.baseUrl.replace(/\/api\/v1\/?$/, '');
            return {
                id,
                url: backendBase + (fp.startsWith('/') ? fp : '/' + fp),
                file_path: fp,
                name,
            };
        } catch {
            return null;
        }
    }

    /**
     * Duplica template di sistema nello studio
     * @param {number} templateId
     * @param {string} name
     */
    async duplicateReportTemplate(templateId, name) {
        return this.post(`/report-templates/${templateId}/duplicate`, { name: String(name).trim() });
    }

    /**
     * Elimina template dello studio
     * @param {number} templateId
     */
    async deleteReportTemplate(templateId) {
        return this.delete(`/report-templates/${templateId}`);
    }

    // ==========================================
    // CUSTOM CHECKLISTS (Phase 5/6)
    // ==========================================

    async getCustomChecklists() {
        return this.get('/custom-checklists');
    }

    async getCustomChecklist(id) {
        return this.get(`/custom-checklists/${id}`);
    }

    async createCustomChecklist(data) {
        return this.post('/custom-checklists', data);
    }

    async seedLegislativoAmbientaleChecklist() {
        return this.post('/custom-checklists/seed/legislativo-ambientale', {});
    }

    async updateCustomChecklist(id, data) {
        return this.put(`/custom-checklists/${id}`, data);
    }

    async deleteCustomChecklist(id) {
        return this.delete(`/custom-checklists/${id}`);
    }

    async createCustomChecklistSection(checklistId, data) {
        return this.post(`/custom-checklists/${checklistId}/sections`, data);
    }

    async deleteCustomChecklistSection(checklistId, sectionId) {
        return this.delete(`/custom-checklists/${checklistId}/sections/${sectionId}`);
    }

    async updateCustomChecklistSection(checklistId, sectionId, data) {
        return this.put(`/custom-checklists/${checklistId}/sections/${sectionId}`, data);
    }

    async createCustomChecklistItem(checklistId, data) {
        return this.post(`/custom-checklists/${checklistId}/items`, data);
    }

    async deleteCustomChecklistItem(checklistId, itemId) {
        return this.delete(`/custom-checklists/${checklistId}/items/${itemId}`);
    }

    async updateCustomChecklistItem(checklistId, itemId, data) {
        return this.put(`/custom-checklists/${checklistId}/items/${itemId}`, data);
    }

    async getCustomChecklistResponses(auditId) {
        return this.get(`/audits/${auditId}/custom-checklist-responses`);
    }

    async saveCustomChecklistResponses(auditId, responses) {
        return this.put(`/audits/${auditId}/custom-checklist-responses`, { responses }, { lockAuditUuid: String(auditId) });
    }

    // ==========================================
    // HEALTH CHECK
    // ==========================================

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    // ==========================================
    // DOCUMENT REGISTRY ENDPOINTS (Sprint A)
    // ==========================================

    /**
     * Lista documenti con filtri opzionali.
     * params: { company_id, standard_id, doc_type, status, expiring_days, search, page, limit }
     */
    async getDocuments(params = {}) {
        const query = new URLSearchParams(
            Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))
        ).toString();
        return this.get(`/documents${query ? '?' + query : ''}`);
    }

    /** Statistiche registro (vigenti, scaduti, in_scadenza_30gg, ecc.) */
    async getDocumentStats() {
        return this.get('/documents/stats');
    }

    async getDocument(id) {
        return this.get(`/documents/${id}`);
    }

    async createDocument(data) {
        const body = data?.status != null
            ? { ...data, status: this._normalizeDocumentRegistryStatus(data.status) }
            : data;
        return this.post('/documents', body);
    }

    async updateDocument(id, data) {
        const body = data?.status != null
            ? { ...data, status: this._normalizeDocumentRegistryStatus(data.status) }
            : data;
        return this.put(`/documents/${id}`, body);
    }

    /** Configurazione tipi documento (prefissi, scadenza default mesi). */
    async getDocTypeConfig() {
        const res = await this.get('/doc-type-config');
        return Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    }

    /** Alias legacy "vigente" → "rilasciato" (registro documenti, non validity_status norme). */
    _normalizeDocumentRegistryStatus(raw) {
        if (raw == null || String(raw).trim() === '') return 'rilasciato';
        const s = String(raw).trim().toLowerCase();
        return s === 'vigente' ? 'rilasciato' : s;
    }

    /** Soft delete: porta il documento a status='obsoleto' */
    async archiveDocument(id) {
        return this.delete(`/documents/${id}`);
    }

    /** Elimina documento dal registro (soft-delete → obsoleto, rimosso dalla vista) */
    async deleteDocument(id) {
        return this.delete(`/documents/${id}`);
    }

    // ─── Alert Engine ────────────────────────────────────────────────────────

    /** Conteggio alert urgenti per badge sidebar */
    async getAlertCount() {
        return this.get('/alerts/count');
    }

    /** Lista dettagliata alert urgenti per HomePage */
    async getAlerts(days = 30) {
        return this.get(`/alerts?days=${days}`);
    }

    // ─── Notifiche config ────────────────────────────────────────────────────

    async getNotificationsConfig() {
        return this.get('/notifications-config');
    }

    async saveNotificationsConfig(data) {
        return this.put('/notifications-config', data);
    }

    async sendTestEmail() {
        return this.post('/notifications-config/test', {});
    }

    async runNcAlertsNow({ dryRun = false } = {}) {
        const qs = dryRun ? '?dryRun=true' : '';
        return this.post(`/notifications-config/run-nc-alerts${qs}`, { dryRun });
    }

    async getNotificationContacts(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/notification-contacts${qs ? '?' + qs : ''}`);
    }
    async createNotificationContact(data) { return this.post('/notification-contacts', data); }
    async updateNotificationContact(id, data) { return this.put(`/notification-contacts/${id}`, data); }
    async deleteNotificationContact(id) { return this.delete(`/notification-contacts/${id}`); }

    // ─── WebDAV / Office Round-trip (Sprint 12-A) ────────────────────────────

    async getWebdavLink(docId, mode = 'edit') {
        // mode: 'edit' (default) → permette PUT; 'read' → solo lettura, PUT rifiutato lato server
        return this.post(`/documents/${docId}/webdav-link`, { mode });
    }
    async releaseRevision(docId, data = {}) {
        return this.post(`/documents/${docId}/release-revision`, data);
    }

    // ─── Document Tags ──────────────────────────────────────────────────────
    async getDocumentTags()                     { return this.get('/document-tags'); }
    async createDocumentTag(data)               { return this.post('/document-tags', data); }
    async updateDocumentTag(id, data)           { return this.put(`/document-tags/${id}`, data); }
    async deleteDocumentTag(id)                 { return this.delete(`/document-tags/${id}`); }
    async getTagCategories()                    { return this.get('/tag-categories'); }
    async createTagCategory(data)               { return this.post('/tag-categories', data); }
    async assignDocumentTags(docId, tagIds)     { return this.post(`/documents/${docId}/tags`, { tag_ids: tagIds }); }
    async removeDocumentTag(docId, tagId)       { return this.delete(`/documents/${docId}/tags/${tagId}`); }
    async getDocumentsByTag(tagId)              { return this.get(`/documents/by-tag/${tagId}`); }

    // ─── Document Relations ─────────────────────────────────────────────────
    async getDocumentRelations(docId)           { return this.get(`/documents/${docId}/relations`); }
    async createDocumentRelation(docId, data)   { return this.post(`/documents/${docId}/relations`, data); }
    async deleteDocumentRelation(relationId)    { return this.delete(`/document-relations/${relationId}`); }

    // ─── Document Tree ──────────────────────────────────────────────────────
    async getDocumentTree(depth = 2, companyId = null, scope = null) {
        let url = `/documents/tree?depth=${depth}`;
        if (companyId != null && companyId !== '') {
            url += `&company_id=${encodeURIComponent(companyId)}`;
        }
        if (scope) {
            url += `&scope=${encodeURIComponent(scope)}`;
        }
        return this.get(url);
    }
    async getDocumentTreeChildren(parentId, companyId = null) {
        let url = `/documents/tree/${parentId}/children`;
        if (companyId != null && companyId !== '') {
            url += `?company_id=${encodeURIComponent(companyId)}`;
        }
        return this.get(url);
    }
    async moveDocument(docId, data)             { return this.put(`/documents/${docId}/move`, data); }
    async createFolder(data)                    { return this.post('/documents/folder', data); }
    async getDocumentBreadcrumb(docId)          { return this.get(`/documents/${docId}/breadcrumb`); }
    async getDocumentHistory(docId, page = 1)   { return this.get(`/documents/${docId}/history?page=${page}`); }
    async provisionDocumentTree(data)           { return this.post('/documents/provision-tree', data); }
    async provisionStudioPatrimony()            { return this.post('/documents/provision-studio-patrimony', {}); }
    async getDocumentTreeTemplates()            { return this.get('/document-tree-templates'); }

    /** Suggerimento cartella per tipo documento (AI classification helper) */
    async getFolderSuggestion(docType)          { return this.get(`/documents/folder-suggestion?doc_type=${encodeURIComponent(docType)}`); }

    /** Documenti orfani (senza parent_id, non in cartella) */
    async getOrphanDocuments()                  { return this.get('/documents/orphans'); }

    // ── Scadenzario da file (ADR-013) ────────────────────────────────────────
    async detectDeadlines(docId)                { return this.post(`/documents/${docId}/detect-deadlines`, {}); }
    async importDeadlines(docId, mapping)       { return this.post(`/documents/${docId}/import-deadlines`, mapping); }
    async getDeadlineConfig(docId)              { return this.get(`/documents/${docId}/deadline-config`); }
    async getDeadlineItems(params = {})         {
        const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v != null && v !== '')).toString();
        return this.get(`/deadline-items${q ? '?' + q : ''}`);
    }
    async getPriorityDeadlines(params = {})     {
        const q = new URLSearchParams(Object.entries(params).filter(([,v]) => v != null && v !== '')).toString();
        return this.get(`/deadline-items/priority${q ? '?' + q : ''}`);
    }
    async updateDeadlineItem(itemId, data)      { return this.patch(`/deadline-items/${itemId}`, data); }
    async completeDeadlineItem(itemId)          { return this.post(`/deadline-items/${itemId}/complete`, {}); }
    async deleteDeadlineItem(itemId)            { return this.delete(`/deadline-items/${itemId}`); }

    /**
     * Pre-estrazione metadati AI da un PDF (nessun record DB creato).
     * @param {File} file — oggetto File/Blob del PDF
     * @param {string} docType — chiave tipo documento (es. "norma", "patentino_saldatore")
     * @returns {Promise<{ metadata: object, confidence: number, model: string }>}
     */
    async preExtractDocumentMetadata(file, docType) {
        const formData = new FormData();
        formData.append('file', file);
        if (docType) formData.append('doc_type', docType);
        const token = this.getToken();
        const response = await fetch(
            `${this.baseUrl}/documents/pre-extract`,
            {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            }
        );
        if (!response.ok) {
            let errMsg = `Errore ${response.status}`;
            try {
                const errJson = await response.json();
                errMsg = errJson.error || errMsg;
            } catch { /* non json */ }
            const err = new Error(errMsg);
            err.status = response.status;
            throw err;
        }
        return response.json();
    }

    // ─── File allegati documenti (Sprint 2B) ──────────────────────────────────

    async getDocFiles(docId) {
        return this.get(`/documents/${docId}/files`);
    }

    async uploadDocFile(docId, file, version = '') {
        const formData = new FormData();
        formData.append('file', file);
        if (version) formData.append('version', version);
        const token = this.getToken();
        const response = await fetch(
            `${this.baseUrl}/documents/${docId}/file`,
            {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            }
        );
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(err.error || `Upload fallito (${response.status})`);
        }
        return response.json();
    }

    getDocFileDownloadUrl(docId, attId = null, inline = false) {
        const base = this.baseUrl;
        const token = this.getToken();
        const inlineParam = inline ? '&inline=1' : '';
        if (attId) {
            return `${base}/documents/${docId}/file/${attId}/download?token=${token}${inlineParam}`;
        }
        return `${base}/documents/${docId}/file/download?token=${token}${inlineParam}`;
    }

    // Scarica il file come Blob via fetch con Authorization header.
    // Usato da DocumentPdfViewer: evita il ?token= in querystring
    // (problematico quando il token è null su desktop con cookie httpOnly).
    async getDocFileBlob(docId, attId = null) {
        const path = attId
            ? `/documents/${docId}/file/${attId}/download?inline=1`
            : `/documents/${docId}/file/download?inline=1`;
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(true),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
    }

    /** Scarica file registro documenti via Bearer (affidabile anche senza token in URL). */
    async downloadDocFile(docId, attId = null, suggestedName = null) {
        const blob = await this.getDocFileBlob(docId, attId);
        const url = URL.createObjectURL(blob);
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = suggestedName || 'documento';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    // ─── Qualifiche (Sprint 4) ────────────────────────────────────────────────

    async getQualificationsStats(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/qualifications/stats${qs ? '?' + qs : ''}`);
    }

    async getQualifications(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/qualifications${qs ? '?' + qs : ''}`);
    }

    async getQualification(id) {
        return this.get(`/qualifications/${id}`);
    }

    async createQualification(data) {
        return this.post('/qualifications', data);
    }

    async updateQualification(id, data) {
        return this.put(`/qualifications/${id}`, data);
    }

    async deleteQualification(id) {
        return this.delete(`/qualifications/${id}`);
    }

    async approveQualification(id) {
        return this.post(`/qualifications/${id}/approve`, {});
    }

    async rejectQualification(id, rejection_reason) {
        return this.post(`/qualifications/${id}/reject`, { rejection_reason });
    }

    async renewQualification(id, data = {}) {
        return this.post(`/qualifications/${id}/renew`, data);
    }

    async getQualificationsCoverage(project_id) {
        return this.get(`/qualifications/coverage?project_id=${project_id}`);
    }

    async uploadQualificationCertificate(id, file) {
        const fd = new FormData();
        fd.append('certificate', file);
        const token = this.getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await fetch(`${this.baseUrl}/qualifications/${id}/certificate`, {
            method: 'POST', headers, body: fd,
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Upload certificato fallito (${response.status})`);
        }
        return response.json();
    }

    async uploadQualificationsBatch(files, companyId, docType) {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        if (companyId) fd.append('company_id', String(companyId));
        if (docType) fd.append('doc_type', String(docType));
        const token = this.getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        try {
            const response = await fetch(`${this.baseUrl}/qualifications/upload-batch`, {
                method: 'POST', headers, body: fd, signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Batch upload qualifiche fallito (${response.status})`);
            }
            return response.json();
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    }

    async getIngestStaging(stagingId) {
        return this.get(`/ingest-staging/${stagingId}`);
    }

    async getIngestStagingFileBlob(stagingId) {
        const url = `${this.baseUrl}/ingest-staging/${stagingId}/file`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(true),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
    }

    async confirmIngestStaging(stagingId, fields = {}) {
        return this.post(`/ingest-staging/${stagingId}/confirm`, { fields });
    }

    async rejectIngestStaging(stagingId) {
        return this.post(`/ingest-staging/${stagingId}/reject`, {});
    }

    async commitImportJobFileToQualification(jobId, fileId, data = {}) {
        return this.post(`/import-jobs/${jobId}/files/${fileId}/commit-to-qualification`, data);
    }

    async getQualificationHistory(id) {
        return this.get(`/qualifications/${id}/history`);
    }

    async getQualificationConfirmations(id) {
        return this.get(`/qualifications/${id}/confirmations`);
    }

    async confirmQualificationSemiannual(id, data = {}) {
        return this.post(`/qualifications/${id}/confirm-semiannual`, data);
    }

    async downloadQualificationConfirmationsExport(params = {}) {
        const qs = new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null && v !== '')
        ).toString();
        const token = this.getToken();
        const response = await fetch(
            `${this.baseUrl}/qualifications/confirmations/export${qs ? '?' + qs : ''}`,
            {
                method: 'GET',
                credentials: 'include',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
        );
        if (!response.ok) {
            let msg = 'Errore export Excel';
            try {
                const err = await response.json();
                msg = err.error || msg;
            } catch (_) { /* ignore */ }
            throw new Error(msg);
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const filename = match?.[1] || `conferme_semestrali_${new Date().toISOString().slice(0, 10)}.xlsx`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // ─── Risks (Sprint 6) ────────────────────────────────────────────────────
    async getRisksStats()           { return this.get('/risks/stats'); }
    async getRisks(params = {})     { const qs = new URLSearchParams(params).toString(); return this.get(`/risks${qs ? '?' + qs : ''}`); }
    async getRisk(id)               { return this.get(`/risks/${id}`); }
    async createRisk(data)          { return this.post('/risks', data); }
    async updateRisk(id, data)      { return this.put(`/risks/${id}`, data); }
    async deleteRisk(id)            { return this.delete(`/risks/${id}`); }

    // ─── Objectives (Sprint 6) ───────────────────────────────────────────────
    async getObjectivesStats()      { return this.get('/objectives/stats'); }
    async getObjectives(params = {}){ const qs = new URLSearchParams(params).toString(); return this.get(`/objectives${qs ? '?' + qs : ''}`); }
    async getObjective(id)          { return this.get(`/objectives/${id}`); }
    async createObjective(data)     { return this.post('/objectives', data); }
    async updateObjective(id, data) { return this.put(`/objectives/${id}`, data); }
    async deleteObjective(id)       { return this.delete(`/objectives/${id}`); }

    // ─── Context Factors §4.1 ────────────────────────────────────────────────
    async getContextFactors(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/context-factors${qs ? '?' + qs : ''}`); }
    async getContextFactor(id)           { return this.get(`/context-factors/${id}`); }
    async createContextFactor(data)      { return this.post('/context-factors', data); }
    async updateContextFactor(id, data)  { return this.put(`/context-factors/${id}`, data); }
    async deleteContextFactor(id)        { return this.delete(`/context-factors/${id}`); }

    // ─── Interested Parties §4.2 ─────────────────────────────────────────────
    async getInterestedParties(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/interested-parties${qs ? '?' + qs : ''}`); }
    async getInterestedParty(id)            { return this.get(`/interested-parties/${id}`); }
    async createInterestedParty(data)       { return this.post('/interested-parties', data); }
    async updateInterestedParty(id, data)   { return this.put(`/interested-parties/${id}`, data); }
    async deleteInterestedParty(id)         { return this.delete(`/interested-parties/${id}`); }

    // ─── Complaints (Sprint 7) ───────────────────────────────────────────────
    async getComplaintsStats()      { return this.get('/complaints/stats'); }
    async getComplaints(params = {}){ const qs = new URLSearchParams(params).toString(); return this.get(`/complaints${qs ? '?' + qs : ''}`); }
    async getComplaint(id)          { return this.get(`/complaints/${id}`); }
    async createComplaint(data)     { return this.post('/complaints', data); }
    async updateComplaint(id, data) { return this.put(`/complaints/${id}`, data); }
    async deleteComplaint(id)       { return this.delete(`/complaints/${id}`); }
    async promoteComplaintToNc(id, data) { return this.post(`/complaints/${id}/promote-to-nc`, data); }

    // ─── Suppliers & Evaluations (Sprint 7) ──────────────────────────────────
    async getSuppliers(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/suppliers${qs ? '?' + qs : ''}`); }
    async getSupplier(id)           { return this.get(`/suppliers/${id}`); }
    async createSupplier(data)      { return this.post('/suppliers', data); }
    async updateSupplier(id, data)  { return this.put(`/suppliers/${id}`, data); }
    async deleteSupplier(id)        { return this.delete(`/suppliers/${id}`); }

    async getSupplierEvaluations(id){ return this.get(`/suppliers/${id}/evaluations`); }
    async createSupplierEvaluation(id, data) { return this.post(`/suppliers/${id}/evaluations`, data); }
    async deleteSupplierEvaluation(id, evalId) { return this.delete(`/suppliers/${id}/evaluations/${evalId}`); }

    // ─── Departments (reparti produttivi) ────────────────────────────────────
    async getDepartments(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/departments${qs ? '?' + qs : ''}`); }
    async getDepartment(id)           { return this.get(`/departments/${id}`); }
    async createDepartment(data)      { return this.post('/departments', data); }
    async updateDepartment(id, data)  { return this.put(`/departments/${id}`, data); }
    async deleteDepartment(id)        { return this.delete(`/departments/${id}`); }

    // ─── Licenze moduli (Sprint 8) ───────────────────────────────────────────
    async getAdminLicenses() {
        return this.get('/admin/licenses');
    }

    async getAdminOrganizations() {
        return this.get('/admin/organizations');
    }

    async getOrgLicenses(organizationId) {
        return this.get(`/admin/organizations/${organizationId}/licenses`);
    }

    async patchAdminLicenses(body) {
        return this.patch('/admin/licenses', body);
    }

    /** Superadmin: aggiorna licensed_modules di un'organizzazione specifica (studio cliente) */
    async patchOrgLicenses(organizationId, body) {
        return this.patch(`/admin/organizations/${organizationId}/licenses`, body);
    }

    // ─── Fatturazione (solo superadmin) ──────────────────────────────────────
    async getBillingOverview() {
        return this.get('/admin/billing/overview');
    }

    async getBillingCompanies(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/admin/billing/companies${qs ? '?' + qs : ''}`);
    }

    async getBillingEvents(params = {}) {
        const qs = new URLSearchParams(params).toString();
        return this.get(`/admin/billing/events${qs ? '?' + qs : ''}`);
    }

    async downloadBillingExport(period) {
        const token = this.getToken();
        const qs = period ? `?period=${encodeURIComponent(period)}` : '';
        const response = await fetch(`${this.baseUrl}/admin/billing/export${qs}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) {
            let errMsg = 'Export fatturazione non riuscito';
            try {
                const j = await response.json();
                errMsg = j.error || errMsg;
            } catch (_) { /* ignore */ }
            throw new Error(errMsg);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `billing-${period || 'export'}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // ─── Import job PDF batch (Sprint 9) ─────────────────────────────────────
    async getImportJobs() {
        return this.get('/import-jobs');
    }

    async createImportJob(data) {
        return this.post('/import-jobs', data || {});
    }

    async getImportJob(id) {
        return this.get(`/import-jobs/${id}`);
    }

    async deleteImportJob(id) {
        return this.delete(`/import-jobs/${id}`);
    }

    async uploadImportJobFiles(jobId, fileList) {
        const formData = new FormData();
        for (let i = 0; i < fileList.length; i++) {
            formData.append('files', fileList[i]);
        }
        const token = this.getToken();
        const response = await fetch(`${this.baseUrl}/import-jobs/${jobId}/files`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: response.statusText }));
            throw new Error(err.error || `Upload fallito (${response.status})`);
        }
        return response.json();
    }

    async processImportJob(id) {
        return this.post(`/import-jobs/${id}/process`, {});
    }

    async patchImportJobFile(jobId, fileId, body) {
        return this.patch(`/import-jobs/${jobId}/files/${fileId}`, body);
    }

    /** Estrazione strutturata (OpenAI) su testo gia estratto dal PDF */
    async postImportJobFileAiExtract(jobId, fileId) {
        return this.post(`/import-jobs/${jobId}/files/${fileId}/ai-extract`, {});
    }

    /** Sprint 10: commit file processato al document_registry */
    async commitImportJobFileToRegistry(jobId, fileId, data) {
        return this.post(`/import-jobs/${jobId}/files/${fileId}/commit-to-registry`, data);
    }

    // ─── Riesame requisiti contratto (commercial_cases) ─────────────────────
    async getContractReviews(status) {
        const qs = new URLSearchParams(status ? { status } : {}).toString();
        return this.get(`/contract-reviews${qs ? `?${qs}` : ''}`);
    }

    async createContractReview(data) {
        return this.post('/contract-reviews', data);
    }

    /** Epic R2: crea caso Riesame da import job (conferma utente in ImportJobsPage) */
    async importContractCaseFromJob(payload) {
        return this.post('/contract-reviews/import-from-job', payload);
    }

    async getContractReview(id) {
        return this.get(`/contract-reviews/${id}`);
    }

    async updateContractReview(id, data) {
        return this.put(`/contract-reviews/${id}`, data);
    }

    async transitionContractReview(id, toStatus, reason) {
        return this.post(`/contract-reviews/${id}/transition`, {
            to_status: toStatus,
            reason,
        });
    }

    async registerContractReviewHandoff(id, payload) {
        return this.post(`/contract-reviews/${id}/handoff`, payload);
    }

    async generateReviewChecklist(id, phase) {
        return this.post(`/contract-reviews/${id}/generate-checklist`, { phase });
    }

    async saveChecklistAnswer(caseId, itemId, data) {
        return this.put(`/contract-reviews/${caseId}/checklist/${itemId}`, data);
    }

    async getContractReviewSummary() {
        return this.get('/contract-reviews/summary');
    }

    async getContractReviewInbox(kind = 'assigned_to_me', limit = 20) {
        const qs = new URLSearchParams({ kind, limit: String(limit) }).toString();
        return this.get(`/contract-reviews/inbox?${qs}`);
    }

    async getContractReviewTransitionOptions(caseId) {
        return this.get(`/contract-reviews/${caseId}/transition-options`);
    }

    async getContractReviewClarifications(caseId) {
        return this.get(`/contract-reviews/${caseId}/clarifications`);
    }

    async createContractReviewClarification(caseId, data) {
        return this.post(`/contract-reviews/${caseId}/clarifications`, data);
    }

    async updateContractReviewClarification(caseId, clarificationId, data) {
        return this.patch(`/contract-reviews/${caseId}/clarifications/${clarificationId}`, data);
    }

    async getContractReviewDocuments(caseId) {
        return this.get(`/contract-reviews/${caseId}/documents`);
    }

    async linkContractReviewDocument(caseId, data) {
        return this.post(`/contract-reviews/${caseId}/documents/link`, data);
    }

    async unlinkContractReviewDocument(caseId, linkId) {
        return this.delete(`/contract-reviews/${caseId}/documents/${linkId}`);
    }

    async getContractReviewAttachments(caseId) {
        return this.get(`/contract-reviews/${caseId}/attachments`);
    }

    async uploadContractReviewAttachment(caseId, file, options = {}) {
        const formData = new FormData();
        formData.append('file', file);
        if (options.category) formData.append('category', options.category);
        if (options.description) formData.append('description', options.description);
        if (options.direction) formData.append('direction', options.direction);
        if (options.counterparty) formData.append('counterparty', options.counterparty);
        if (options.doc_role) formData.append('doc_role', options.doc_role);

        const token = this.getToken();
        const response = await fetch(`${this.baseUrl}/contract-reviews/${caseId}/attachments/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.error || 'Upload allegato fallito',
                response.status,
                errorData.code || 'UPLOAD_ERROR',
                errorData,
            );
        }
        return response.json();
    }

    async analyzeContractRequirements(caseId, body = {}) {
        return this.post(`/contract-reviews/${caseId}/ai/analyze-requirements`, body, {
            timeout: 90000,
        });
    }

    // ── Estrazione requisiti tecnici dai disegni (AI vision, provider-agnostic) ──
    async extractDrawingRequirements(caseId, docId) {
        // Estrazione sincrona lato server: tempo AI vision potenzialmente lungo.
        return this.post(`/cases/${caseId}/documents/${docId}/extract`, {}, {
            timeout: 120000,
        });
    }

    async getDrawingExtraction(caseId, extractionId) {
        return this.get(`/cases/${caseId}/extractions/${extractionId}`);
    }

    async listDrawingExtractions(caseId) {
        return this.get(`/cases/${caseId}/extractions`);
    }

    async getExtractedRequirementsSummary(caseId) {
        return this.get(`/cases/${caseId}/extracted-requirements-summary`);
    }

    async analyzeCaseDocuments(caseId, body = {}) {
        return this.post(`/cases/${caseId}/analyze-documents`, body, { timeout: 60000 });
    }

    async getCaseExtractedCoverage(caseId, projectId) {
        return this.get(`/cases/${caseId}/extracted-coverage?project_id=${encodeURIComponent(projectId)}`);
    }

    async reviewExtractedRequirement(reqId, patch) {
        return this.patch(`/extracted-requirements/${reqId}`, patch);
    }

    async aiSuggest(feature, context) {
        return this.post('/ai/suggest', { feature, context }, { timeout: 90000 });
    }

    async aiFeedback({ feature, action, aiText, finalText, recommendation, auditId, contextSummary, modelUsed }) {
        return this.post('/ai/feedback', { feature, action, aiText, finalText, recommendation, auditId, contextSummary, modelUsed });
    }

    async aiChat(message, options = {}) {
        const body = { message };
        const opts = typeof options === 'object' && options !== null ? options : {};
        if (opts.companyId) body.companyId = opts.companyId;
        if (opts.standardId) body.standardId = opts.standardId;
        if (opts.auditId) body.auditId = opts.auditId;
        if (opts.clauseRef) body.clauseRef = opts.clauseRef;
        if (opts.questionId) body.questionId = opts.questionId;
        if (opts.questionText) body.questionText = opts.questionText;
        if (opts.standardKey) body.standardKey = opts.standardKey;
        return this.post('/ai/chat', body, { timeout: 120000 });
    }

    async getGapAnalysis({ companyId, standardCode = 'ISO_9001_2015' } = {}) {
        const qs = new URLSearchParams();
        if (companyId) qs.set('companyId', String(companyId));
        qs.set('standardCode', standardCode);
        return this.get(`/gap-analysis?${qs.toString()}`);
    }

    // ─── SAL — Stato Avanzamento Lavori (motore gap operativo, licenza sal) ──

    async getGapMatrix(companyId, { standardCode, dateFrom } = {}) {
        const qs = new URLSearchParams();
        if (standardCode) qs.set('standardCode', standardCode);
        if (dateFrom) qs.set('dateFrom', dateFrom);
        const query = qs.toString();
        return this.get(`/companies/${companyId}/gap-matrix${query ? `?${query}` : ''}`);
    }

    async updateGapStatus(companyId, normRequirementId, payload) {
        return this.put(`/companies/${companyId}/gap-statuses/${normRequirementId}`, payload);
    }

    async seedGapMatrix(companyId, { standardCodes } = {}) {
        const body = {};
        if (Array.isArray(standardCodes) && standardCodes.length) {
            body.standardCodes = standardCodes;
        }
        return this.post(`/companies/${companyId}/gap-matrix/seed`, body);
    }

    async getGapStatusHistory(companyId, normRequirementId) {
        return this.get(`/companies/${companyId}/gap-statuses/${normRequirementId}/history`);
    }

    async syncSalAuditHints(companyId, { monthsBack } = {}) {
        const body = {};
        if (monthsBack != null) body.monthsBack = monthsBack;
        return this.post(`/companies/${companyId}/gap-matrix/sync-audit-hints`, body);
    }

    // SAL Fase 5-A: suggeritore stato AI (licenza ai_norms + sal). Non scrive lo stato.
    async suggestSalGapStatus(companyId, { normRequirementId, normRequirementIds } = {}) {
        const body = {};
        if (Array.isArray(normRequirementIds) && normRequirementIds.length) {
            body.normRequirementIds = normRequirementIds;
        } else if (normRequirementId != null) {
            body.normRequirementId = normRequirementId;
        }
        return this.post(`/companies/${companyId}/gap-ai-suggest`, body);
    }

    async globalSearch(params = {}) {
        const qs = new URLSearchParams();
        if (params.q) qs.set('q', params.q);
        if (params.companyId != null && params.companyId !== '') {
            qs.set('companyId', String(params.companyId));
        }
        if (params.entityTypes) qs.set('entityTypes', params.entityTypes);
        if (params.limit) qs.set('limit', String(params.limit));
        const query = qs.toString();
        return this.get(`/search${query ? `?${query}` : ''}`);
    }

    async aiReindex() {
        return this.post('/ai/reindex', {}, { timeout: 300000 });
    }

    async getKnowledgeHealth() {
        return this.get('/ai/knowledge-health');
    }

    // ─── Welding / WPS + WPQR (Modulo Saldatura) ──────────────────────────
    async getWPSList(params = {})    { const qs = new URLSearchParams(params).toString(); return this.get(`/welding/wps${qs ? '?' + qs : ''}`); }
    async getWPS(id)                 { return this.get(`/welding/wps/${id}`); }
    async createWPS(data)            { return this.post('/welding/wps', data); }
    async updateWPS(id, data)        { return this.put(`/welding/wps/${id}`, data); }
    async deleteWPS(id)              { return this.delete(`/welding/wps/${id}`); }

    async getWPQRList(params = {})   { const qs = new URLSearchParams(params).toString(); return this.get(`/welding/wpqr${qs ? '?' + qs : ''}`); }
    async getWPQR(id)                { return this.get(`/welding/wpqr/${id}`); }
    async createWPQR(data)           { return this.post('/welding/wpqr', data); }
    async updateWPQR(id, data)       { return this.put(`/welding/wpqr/${id}`, data); }
    async deleteWPQR(id)             { return this.delete(`/welding/wpqr/${id}`); }

    // WPS Welders
    async getWpsWelders(wpsId)              { return this.get(`/welding/wps/${wpsId}/welders`); }
    async assignWpsWelder(wpsId, data)      { return this.post(`/welding/wps/${wpsId}/welders`, data); }
    async removeWpsWelder(wpsId, welderId)  { return this.delete(`/welding/wps/${wpsId}/welders/${welderId}`); }

    // WPQR — stats, approval, batch upload, coverage (Mason-ready)
    async getWPQRStats(params = {})    { const qs = new URLSearchParams(params).toString(); return this.get(`/welding/wpqr/stats${qs ? '?' + qs : ''}`); }
    async approveWPQR(id)              { return this.post(`/welding/wpqr/${id}/approve`, {}); }
    async rejectWPQR(id, reason)       { return this.post(`/welding/wpqr/${id}/reject`, { reason }); }
    async uploadWpqrBatch(files, companyId) {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        if (companyId) fd.append('company_id', String(companyId));
        const token = this.getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        try {
            const response = await fetch(`${this.baseUrl}/welding/wpqr/upload-batch`, {
                method: 'POST', headers, body: fd, signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Batch upload WPQR fallito (${response.status})`);
            }
            return response.json();
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') throw new Error('Timeout upload WPQR (180s)');
            throw err;
        }
    }
    async uploadWpsBatch(files, companyId) {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        if (companyId) fd.append('company_id', String(companyId));
        const token = this.getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);
        try {
            const response = await fetch(`${this.baseUrl}/welding/wps/upload-batch`, {
                method: 'POST', headers, body: fd, signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Batch upload WPS fallito (${response.status})`);
            }
            return response.json();
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') throw new Error('Timeout upload WPS (180s)');
            throw err;
        }
    }
    async getIngestLearningStats(docType) {
        const qs = docType ? `?doc_type=${encodeURIComponent(docType)}` : '';
        return this.get(`/ingest-staging/learning-stats${qs}`);
    }
    async getWpsCoverage(projectId)    { return this.get(`/welding/wps/coverage?project_id=${projectId}`); }

    // ─── CND — Strumenti e Attrezzature ─────────────────────────────────────
    async getEquipmentList(params = {})  { const qs = new URLSearchParams(params).toString(); return this.get(`/equipment${qs ? '?' + qs : ''}`); }
    async getEquipment(id)               { return this.get(`/equipment/${id}`); }
    async createEquipment(data)          { return this.post('/equipment', data); }
    async updateEquipment(id, data)      { return this.put(`/equipment/${id}`, data); }
    async deleteEquipment(id)            { return this.delete(`/equipment/${id}`); }
    async getEquipmentStats(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/equipment/stats${qs ? '?' + qs : ''}`); }
    async getEquipmentForReport(method, company_id) {
        const qs = new URLSearchParams({ ...(method ? { method } : {}), ...(company_id ? { company_id } : {}) }).toString();
        return this.get(`/equipment/for-report${qs ? '?' + qs : ''}`);
    }
    async addCalibration(assetId, data)  { return this.post(`/equipment/${assetId}/calibrations`, data); }
    async getCalibrations(assetId)       { return this.get(`/equipment/${assetId}/calibrations`); }

    // ─── CND — Verbali (VT/MT/PT/UT) ────────────────────────────────────────
    async getNdtReportList(params = {})  { const qs = new URLSearchParams(params).toString(); return this.get(`/ndt-reports${qs ? '?' + qs : ''}`); }
    async getNdtReport(id)               { return this.get(`/ndt-reports/${id}`); }
    async createNdtReport(data)          { return this.post('/ndt-reports', data); }
    async updateNdtReport(id, data)      { return this.put(`/ndt-reports/${id}`, data); }
    async deleteNdtReport(id)            { return this.delete(`/ndt-reports/${id}`); }
    async getNdtReportStats(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/ndt-reports/stats${qs ? '?' + qs : ''}`); }

    // ─── Saldatura — Welding Book (IOF ISO 3834) ─────────────────────────────
    async getWeldingBookList(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/welding-books${qs ? '?' + qs : ''}`); }
    async getWeldingBook(id)               { return this.get(`/welding-books/${id}`); }
    async createWeldingBook(data)          { return this.post('/welding-books', data); }
    async updateWeldingBook(id, data)      { return this.put(`/welding-books/${id}`, data); }
    async deleteWeldingBook(id)            { return this.delete(`/welding-books/${id}`); }
    async getWeldingBookStats(params = {}) { const qs = new URLSearchParams(params).toString(); return this.get(`/welding-books/stats${qs ? '?' + qs : ''}`); }

    // ─── Projects / Commesse (Modulo Saldatura) ─────────────────────────────
    async getProjects(params = {})   { const qs = new URLSearchParams(params).toString(); return this.get(`/projects${qs ? '?' + qs : ''}`); }
    async getProject(id)             { return this.get(`/projects/${id}`); }
    async createProject(data)        { return this.post('/projects', data); }
    async updateProject(id, data)    { return this.put(`/projects/${id}`, data); }
    async deleteProject(id)          { return this.delete(`/projects/${id}`); }
    async getProjectStats()          { return this.get('/projects/stats'); }
    async addProjectWelder(projectId, data) { return this.post(`/projects/${projectId}/welders`, data); }
    async removeProjectWelder(projectId, qualificationId) { return this.delete(`/projects/${projectId}/welders/${qualificationId}`); }

    /**
     * Verifica stato validit\u00e0 norma su catalogo pubblico ente (BSI / ISO / UNI).
     * Non bloccante: in caso di errore restituisce { status: 'unknown' }.
     *
     * @param {string} standardCode - Es. "BS EN ISO 9606-1:2017"
     * @param {string} issuingBody  - Es. "BSI", "ISO", "UNI"
     * @returns {Promise<{ status: 'active'|'withdrawn'|'superseded'|'unknown', supersededBy: string|null, catalogUrl: string|null, checkedAt: string }>}
     */
    async lookupNormStatus(standardCode, issuingBody, documentId) {
        try {
            const body = {
                standard_code: standardCode,
                issuing_body:  issuingBody || '',
            };
            if (documentId) body.document_id = documentId;
            const res = await this.post('/documents/norm-lookup', body, { timeout: 8000 });
            return res?.data || { status: 'unknown', supersededBy: null, catalogUrl: null, checkedAt: new Date().toISOString() };
        } catch {
            return { status: 'unknown', supersededBy: null, catalogUrl: null, checkedAt: new Date().toISOString() };
        }
    }

    /**
     * Import batch codici norma/legge (senza PDF obbligatorio).
     * @param {string|string[]} codes
     * @param {number|null} folderId
     */
    async importNormCodes(codes, folderId = null) {
        const body = { codes };
        if (folderId) body.folder_id = folderId;
        const res = await this.post('/documents/norm-import-codes', body, { timeout: 120000 });
        return res?.data ?? res;
    }

    // ─── Norme upload (Sprint Norme AI) ─────────────────────────────────────

    /**
     * @param {File[]} files
     * @param {number|string|null} folderId — cartella NORME E LEGGI (parent_folder_id)
     */
    async uploadNorms(files, folderId = null) {
        const formData = new FormData();
        for (const file of files) {
            formData.append('files', file);
        }
        if (folderId != null && folderId !== '') {
            formData.append('parent_folder_id', String(folderId));
        }
        const token = this.getToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        try {
            const response = await fetch(`${this.baseUrl}/documents/norms/upload`, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new ApiError(
                    errorData.error || `Upload norme fallito (${response.status})`,
                    response.status,
                    errorData.code || 'NORM_UPLOAD_ERROR'
                );
            }

            return response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new ApiError('Upload norme timeout (3 min)', 408, 'TIMEOUT');
            }
            if (error instanceof ApiError) throw error;
            throw new ApiError(error.message, 0, 'NETWORK_ERROR');
        }
    }
}

/**
 * Classe errore API personalizzata
 */
class ApiError extends Error {
    constructor(message, status, code, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.data = data; // Preserva il body completo della risposta (es. serverData da 409)
    }
}

// Singleton export
const apiService = new ApiService();
export { apiService, ApiError, config as apiConfig, setAuditLockTokensForAudit, clearAllAuditLockTokens, hasAuditLockToken };
export default apiService;
