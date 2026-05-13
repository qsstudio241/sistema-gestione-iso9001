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

    async getCompany(id) {
        return this.get(`/companies/${id}`);
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
        return this.get(`/nc/${id}`);
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

    async getNcStats() {
        return this.get('/non-conformities/statistics/overview');
    }

    async updateNcStatus(id, data) {
        return this.put(`/non-conformities/${id}`, data);
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
        return `${this.baseUrl}/attachments/${attachmentId}/download?token=${token}`;
    }

    /**
     * URL visualizzazione inline — manteniamo per compatibilità legacy.
     * NOTA: preferire fetchAttachmentBlob() per evitare problemi token in URL.
     * @deprecated usa fetchAttachmentBlob invece
     */
    getAttachmentViewUrl(attachmentId) {
        const token = this.getToken();
        return `${this.baseUrl}/attachments/${attachmentId}/view?token=${token}`;
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
        return this.post('/documents', data);
    }

    async updateDocument(id, data) {
        return this.put(`/documents/${id}`, data);
    }

    /** Soft delete: porta il documento a status='obsoleto' */
    async archiveDocument(id) {
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

    // ─── WebDAV / Office Round-trip (Sprint 12-A) ────────────────────────────

    async getWebdavLink(docId) {
        return this.post(`/documents/${docId}/webdav-link`, {});
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

    // ─── Qualifiche (Sprint 4) ────────────────────────────────────────────────

    async getQualificationsStats() {
        return this.get('/qualifications/stats');
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

    async patchAdminLicenses(body) {
        return this.patch('/admin/licenses', body);
    }

    /** Superadmin: aggiorna licensed_modules di un'organizzazione specifica (studio cliente) */
    async patchOrgLicenses(organizationId, body) {
        return this.patch(`/admin/organizations/${organizationId}/licenses`, body);
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
