/**
 * Auth Context - Gestione autenticazione utente
 * Sistema Gestione ISO 9001 - QS Studio
 *
 * Funzionalità:
 * - Login/Logout con API backend reale
 * - Gestione token JWT
 * - Ruoli utente (admin, auditor, viewer)
 * - Protezione route
 * - Refresh automatico sessione
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import apiService, { ApiError, clearAllAuditLockTokens } from "../services/apiService";
import { syncService } from "../services/syncService";

// Ruoli disponibili
export const USER_ROLES = {
  ADMIN: "admin",
  AUDITOR: "auditor",
  VIEWER: "viewer",
};

// Context
const AuthContext = createContext(null);

/**
 * Hook per accesso al contesto auth
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve essere usato dentro AuthProvider");
  }
  return context;
}

/**
 * Provider Autenticazione
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor connessione
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Ripristina sessione da token salvato
  useEffect(() => {
    const initSession = async () => {
      try {
        // Controlla se c'è un token salvato
        const token = apiService.getToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Prova a recuperare user salvato localmente (per offline)
        const storedUser = apiService.getStoredUser();

        if (isOnline) {
          // Verifica sessione con il server.
          // checkSession() ritorna null SOLO per 401 confermato.
          // Per errori di rete/timeout lancia un'eccezione gestita dal catch esterno.
          const serverUser = await apiService.checkSession();
          if (serverUser) {
            setUser(serverUser);
            apiService.setStoredUser(serverUser);
            console.log(`✅ Sessione verificata: ${serverUser.full_name}`);
          } else {
            // null = token confermato invalido/scaduto (401); logout obbligatorio
            apiService.clearToken();
            console.log("⏰ Token non valido o scaduto, sessione rimossa");
          }
        } else if (storedUser) {
          // Offline ma abbiamo user salvato
          setUser(storedUser);
          console.log(
            `📴 Offline - usando sessione cache: ${storedUser.full_name}`
          );
        }
      } catch (err) {
        // Errore di rete/timeout durante checkSession:
        // NON cancellare il token – l'utente potrebbe essere offline.
        // Usa la sessione in cache per permettere il funzionamento offline.
        const cachedUser = apiService.getStoredUser();
        if (cachedUser) {
          setUser(cachedUser);
          console.warn(
            `⚠️ Verifica sessione fallita (${err.code || err.message}), usando cache: ${cachedUser.full_name}`
          );
        } else {
          console.error("Errore ripristino sessione (nessuna cache):", err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [isOnline]);

  // Listener per logout forzato (token scaduto)
  useEffect(() => {
    const handleForceLogout = () => {
      window.dispatchEvent(new CustomEvent("sgq:userLoggedOut"));
      clearAllAuditLockTokens();
      setUser(null);
      setError("Sessione scaduta. Effettua nuovamente il login.");
    };

    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, []);

  /**
   * Login con email e password
   */
  const login = useCallback(async (email, password) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiService.login(email, password);

      if (response.success && response.user) {
        setUser(response.user);
        console.log(
          `✅ Login effettuato: ${response.user.full_name} (${response.user.role})`
        );
        
        // Emetti evento per triggerare download audit
        window.dispatchEvent(new CustomEvent('auth:login', { detail: response.user }));
        
        setIsLoading(false);
        return true;
      }

      setError("Credenziali non valide");
      setIsLoading(false);
      return false;
    } catch (err) {
      console.error("Errore login:", err);

      if (err instanceof ApiError) {
        if (err.code === "OFFLINE") {
          setError("Connessione assente. Verifica la rete.");
        } else if (err.code === "TIMEOUT") {
          setError("Server non raggiungibile. Riprova.");
        } else {
          setError(err.message || "Credenziali non valide");
        }
      } else {
        setError("Errore durante il login");
      }

      setIsLoading(false);
      return false;
    }
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    // Guard anti-perdita: considera solo item ATTIVI (non in stallo permanente).
    // Item con isStalled:true hanno già superato il max retry e non possono essere
    // recuperati — non devono bloccare il logout dell'utente.
    let pendingQueueItems = 0;
    try {
      pendingQueueItems = Number(await syncService.getActiveQueueSize()) || 0;
    } catch {
      pendingQueueItems = 0;
    }

    if (pendingQueueItems > 0 && navigator.onLine) {
      try {
        await syncService.processQueue();
      } catch {
        // Non bloccare: si rivaluta la coda sotto.
      }
      try {
        pendingQueueItems = Number(await syncService.getActiveQueueSize()) || pendingQueueItems;
      } catch {
        // keep previous value
      }
    }

    if (pendingQueueItems > 0) {
      const proceed = window.confirm(
        `Ci sono ancora ${pendingQueueItems} operazioni non sincronizzate.\n\n` +
          `Se esci ora, le bozze solo locali potrebbero andare perse.\n` +
          `Premi "Annulla" per restare dentro e completare la sincronizzazione.`
      );
      if (!proceed) {
        setError("Logout annullato: completa prima la sincronizzazione per evitare perdita dati.");
        return false;
      }
    }

    // Notifica StorageContext per rilasciare il lock PRIMA di cancellare il token JWT:
    // onUserLoggedOut fa releaseAuditLock fire-and-forget con il token ancora valido.
    window.dispatchEvent(new CustomEvent("sgq:userLoggedOut"));

    try {
      await apiService.logout(); // clearToken() avviene qui, dopo che il lock è già stato rilasciato
    } catch (err) {
      console.warn("Errore logout API:", err);
    }
    clearAllAuditLockTokens();
    setUser(null);
    setError(null);
    console.log("👋 Logout effettuato");
    return true;
  }, []);

  /**
   * Verifica permessi per ruolo
   */
  const hasRole = useCallback(
    (requiredRole) => {
      if (!user) return false;

      // Admin ha tutti i permessi
      if (user.role === USER_ROLES.ADMIN) return true;

      // Auditor può fare tutto tranne admin
      if (user.role === USER_ROLES.AUDITOR && requiredRole !== USER_ROLES.ADMIN)
        return true;

      // Viewer può solo visualizzare
      return user.role === requiredRole;
    },
    [user]
  );

  /**
   * Verifica se può modificare dati
   */
  const canEdit = useCallback(() => {
    return (
      user &&
      (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.AUDITOR)
    );
  }, [user]);

  /**
   * Verifica se è admin
   */
  const isAdmin = useCallback(() => {
    const r = user?.role;
    return r === USER_ROLES.ADMIN || r === "superadmin";
  }, [user]);

  /**
   * Ricarica utente da `/auth/me` (es. dopo PATCH licenze) senza rifare login.
   * Offline: no-op (mantiene cache).
   */
  const refreshUser = useCallback(async () => {
    if (!apiService.getToken() || !navigator.onLine) return null;
    try {
      const serverUser = await apiService.checkSession();
      if (serverUser) {
        setUser(serverUser);
        apiService.setStoredUser(serverUser);
        return serverUser;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  /** Sprint 8: moduli licenziati per organizzazione (assenza lista = tutti abilitati, retrocompatibilità) */
  const hasLicensedModule = useCallback(
    (moduleKey) => {
      const m = user?.licensed_modules;
      if (!m || !Array.isArray(m) || m.length === 0) return true;
      return m.includes(moduleKey);
    },
    [user]
  );

  // Valore context
  const value = {
    // Stato
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    isOnline,

    // Azioni
    login,
    logout,
    refreshUser,

    // Permessi
    hasRole,
    canEdit,
    isAdmin,
    hasLicensedModule,

    // Costanti
    USER_ROLES,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
