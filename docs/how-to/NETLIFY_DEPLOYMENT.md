# Deployment Netlify - Sistema Gestione ISO 9001:2015

## 🚀 Quick Deploy

### Opzione 1: Netlify CLI (Raccomandato)

```bash
# Installa Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Build + Deploy
cd app
npm run build
netlify deploy --prod --dir=dist
```

### Opzione 2: Netlify UI (Drag & Drop)

1. Build locale:

   ```bash
   cd app
   npm run build
   ```

2. Trascina cartella `app/dist` su [netlify.com/drop](https://app.netlify.com/drop)

### Opzione 3: Git Integration (CI/CD)

**File**: `netlify.toml` (root progetto)

```toml
[build]
  base = "app"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/manifest.json"
  [headers.values]
    Content-Type = "application/manifest+json"
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/icons/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.svg"
  [headers.values]
    Content-Type = "image/svg+xml"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

---

## 📱 Test PWA su Android

### Pre-Deploy Check

```bash
# Verifica manifest valido
cat app/public/manifest.json | jq .

# Verifica icone esistono
ls -lh app/public/icons/

# Test locale con HTTPS (richiesto per PWA)
npm install -g local-ssl-proxy
cd app
npm run build
npx serve dist -p 3000 &
local-ssl-proxy --source 3443 --target 3000
# Apri: https://localhost:3443
```

### Post-Deploy Test

1. **Lighthouse PWA Audit**:

   ```bash
   npm install -g @lhci/cli
   lhci autorun --collect.url=https://YOUR-SITE.netlify.app
   ```

2. **Android Chrome**:

   - Apri `https://YOUR-SITE.netlify.app`
   - Menu → "Aggiungi a schermata Home"
   - Verifica icona corretta
   - Apri app → verifica fullscreen

3. **iOS Safari**:
   - Apri URL
   - Condividi → "Aggiungi a Home"
   - Verifica icona e nome

---

## 🔧 Configurazione Backend

**IMPORTANTE**: App richiede backend API su `https://www.fr-busato.it:10443/api/v1`.

### Variabili Ambiente Netlify

**Settings → Build & Deploy → Environment Variables**:

```bash
# Se backend diverso da produzione
VITE_API_URL=https://YOUR-BACKEND-URL/api/v1
```

### CORS Backend

Backend deve permettere origine Netlify:

```javascript
// backend/src/middleware/cors.js
const allowedOrigins = [
  "http://localhost:3000",
  "https://YOUR-SITE.netlify.app",
];
```

---

## 📊 Checklist PWA

- [x] `manifest.json` creato
- [x] Icone 72-512px generate (SVG)
- [x] `theme-color` meta tag
- [x] Apple touch icons
- [x] Favicon moderna (SVG)
- [ ] Service Worker (Task #5 - prossimo)
- [ ] HTTPS deployment (Netlify auto)
- [ ] Offline fallback UI

---

## 🐛 Troubleshooting

### PWA non installabile

**Sintomo**: "Aggiungi a Home" non appare

**Cause**:

1. ❌ HTTP invece HTTPS → Usa Netlify (HTTPS auto)
2. ❌ Manifest invalid → Valida con [Manifest Validator](https://manifest-validator.appspot.com/)
3. ❌ Icone mancanti → Verifica `/icons/` directory pubblicata

**Fix**:

```bash
# Verifica build include manifest
ls dist/manifest.json
ls dist/icons/*.svg

# Se mancano, controlla public/
cp -r app/public/* app/dist/
```

### Icone non visibili

**Sintomo**: Icona generica invece logo QS Studio

**Fix**:

```bash
# Rigenera icone
cd app/public
node generate-icons.js

# Rebuild
cd ..
npm run build
```

### Backend unreachable

**Sintomo**: Login fallisce con "Failed to fetch"

**Fix**:

1. Verifica backend online: `curl https://www.fr-busato.it:10443/health`
2. Controlla CORS headers backend
3. Verifica `apiService.js` usa URL corretto

---

## 📈 Metriche Target

**Lighthouse PWA Score**: ≥ 80/100

**Breakdown**:

- ✅ Fast and reliable: `manifest.json` + icons
- ⏸️ Installable: Partial (serve Service Worker)
- ⏸️ PWA Optimized: Partial (offline support prossimo)

**Post Service Worker (Task #5)**: ≥ 90/100

---

## 🔐 Sicurezza

**Headers Netlify** (vedi `netlify.toml`):

- `X-Frame-Options: DENY` → Previene clickjacking
- `X-Content-Type-Options: nosniff` → Previene MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`

**JWT Cookie**:

- App usa `httpOnly` cookie per auth
- Netlify proxy `/api/*` a backend (opzionale)

---

## 📝 Note

- **File SVG**: Browser moderni supportano. Per PNG converti con ImageMagick
- **Screenshots manifest**: Opzionali, aggiungere dopo screenshot reali
- **Shortcuts manifest**: Funzionali solo con Service Worker registrato

**Prossimo**: Task #5 (Service Worker + vite-plugin-pwa)
