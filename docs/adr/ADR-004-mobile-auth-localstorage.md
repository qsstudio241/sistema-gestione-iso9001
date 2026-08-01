# ADR-004: Mobile Auth — JWT in localStorage per Android PWA Standalone

**Data**: 2026-03-02  
**Stato**: PROPOSTO — implementazione in backlog (priorità alta)  
**Autori**: Team SGQ, sessione Cursor 02/03/2026  
**Contesto ADR precedente**: [ADR-003-pwa-mobile-android-strategy.md](ADR-003-pwa-mobile-android-strategy.md)

---

## Contesto

Il sistema usa JWT in cookie `httpOnly` come meccanismo di autenticazione principale (soluzione sicura per browser desktop). Su Android, quando l'app è installata come PWA in modalità **standalone** (aggiunta alla home screen), il comportamento dei cookie è diverso:

- Chrome Android in modalità standalone usa un cookie store separato dal browser
- `SameSite=None; Secure` richiede HTTPS (ok), ma il cross-origin cookie sharing tra Netlify (`systemgest.netlify.app`) e il backend (`sistemi.fr-busato.it:8443`) è soggetto a restrizioni crescenti
- L'effetto pratico osservato: dopo il login, il redirect ricarica e AuthContext non trova la sessione → **loop login infinito su Android PWA standalone**
- Ticket di riferimento: `open_points.md` issue #008

---

## Decisione

**Implementare dual-mode authentication**:

1. **Desktop (browser standard)**: mantenere cookie httpOnly — nessuna modifica (sicurezza massima)
2. **Mobile/PWA standalone**: aggiungere token JWT anche nel response body del login → salvare in `localStorage` → inviare via header `Authorization: Bearer <token>`

La scelta di `localStorage` (anziché `sessionStorage`) è motivata dalla necessità di mantenere la sessione tra riavvii dell'app installata.

---

## Conseguenze

### Positive
- Risolve il loop login su Android PWA (problema critico per adozione mobile)
- Retrocompatibile: il backend continua a rilasciare cookie per desktop
- Bassa complessità implementativa (2–3 file)

### Negative / Risk
- `localStorage` è accessibile da JavaScript → rischio XSS se malicious script iniettato
- Mitigazioni obbligatorie (see sotto)
- Token `localStorage` sopravvive a `window.close` → richiede invalidazione esplicita

---

## Mitigazioni XSS

| Mitigazione | Implementazione |
|---|---|
| Content Security Policy | `app/index.html` `<meta http-equiv="Content-Security-Policy">` — vietare eval, script inline |
| Token expiry 4h | `auth.controller.js` → `expiresIn: '4h'` (già in uso) |
| Auto-logout inattività | `AuthContext.jsx` → `setTimeout` reset su ogni click/keypress |
| HTTPS obbligatorio | Già garantito da Nginx + Netlify |
| Token refresh | Futuro: `POST /auth/refresh` con refresh token separato (non in scope ora) |

---

## Implementazione

### `backend/src/controllers/auth.controller.js`

```javascript
// Aggiungere token nel response body (mantenere il cookie per desktop)
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '4h' });

res
  .cookie('token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'None',
    maxAge: 4 * 60 * 60 * 1000
  })
  .json({
    success: true,
    token,                    // ← AGGIUNTO: per localStorage su mobile
    user: { id, email, role, organization_id }
  });
```

### `app/src/services/apiService.js`

```javascript
// login() — salva token se presente nel body
async login(email, password) {
  const response = await axios.post('/auth/login', { email, password });
  if (response.data?.token) {
    localStorage.setItem('authToken', response.data.token);
  }
  return response.data;
}

// interceptor request — aggiunge header se token in localStorage
axiosInstance.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

### `app/src/contexts/AuthContext.jsx`

```javascript
// All'avvio: validare token in localStorage (per PWA standalone riavviata)
const validateStoredToken = async () => {
  const token = localStorage.getItem('authToken');
  if (!token) return setLoading(false);
  try {
    const { data } = await apiService.validateToken(); // GET /auth/validate
    if (data.valid) setUser(data.user);
    else localStorage.removeItem('authToken');
  } catch {
    localStorage.removeItem('authToken');
  } finally {
    setLoading(false);
  }
};

// logout() — pulire localStorage e cookie
const logout = async () => {
  localStorage.removeItem('authToken');
  await apiService.logout(); // invalida cookie server-side
  setUser(null);
};
```

### `backend/src/middleware/auth.middleware.js`

```javascript
// Aggiungere fallback su Bearer token se cookie assente
const authenticate = (req, res, next) => {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
};
```

---

## Test di accettazione

1. Android Chrome → installa PWA → login → chiudi app → riaprire → nessun redirect a /login
2. Desktop Chrome → login → cookie httpOnly presente in DevTools → localStorage NON contiene token (comportamento invariato)
3. Logout → `localStorage.authToken` rimosso + cookie cancellato
4. Token scaduto (4h) → redirect a /login con messaggio "Sessione scaduta"

---

## Alternativa scartata

**Soluzione cookie custom domain**: configurare un dominio comune tra Netlify e backend (es. `app.sgq.it` e `api.sgq.it`) per usare cookie SameSite=Lax. Scartata perché richiede modifica DNS + configurazione SSL separata + costi aggiuntivi non giustificati nella fase attuale.
