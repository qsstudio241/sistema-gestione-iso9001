import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Plugin: inietta BUILD_DATE reale in dist/service-worker.js dopo la build.
// Più affidabile del postbuild npm script (che può fallire silenziosamente in CI).
function stampServiceWorker() {
    return {
        name: 'stamp-service-worker',
        writeBundle() {
            const swPath = path.resolve('dist', 'service-worker.js');
            if (!fs.existsSync(swPath)) return;
            const buildDate = new Date().toISOString();
            let content = fs.readFileSync(swPath, 'utf8');
            content = content.replace(/__BUILD_DATE__/g, buildDate);
            fs.writeFileSync(swPath, content, 'utf8');
            console.log(`[vite:stamp-sw] BUILD_DATE → ${buildDate}`);
        }
    };
}

export default defineConfig(({ mode }) => {
const isProd = mode === 'production';
return {
    // Workspace "ponte" su C: e percorso reale Google Drive
    // entrambi ammessi per evitare errori su symlink/junction Windows.
    server: {
        fs: {
            strict: true,
            allow: [process.cwd(), fs.realpathSync.native(process.cwd())]
        },
        port: 5173,
        open: true,
        proxy: {
            '/api/v1': {
                target: 'https://www.fr-busato.it:8443',
                changeOrigin: true,
                secure: false
            }
        }
    },
    plugins: [react(), stampServiceWorker()],
    resolve: {
        // Mantiene i path del workspace (C:\ProgettoISO) senza risolvere sul drive reale.
        preserveSymlinks: true
    },
    // Strip debugger statements in produzione.
    // console.log/debug/info marcati come "pure" → rimossi da tree-shaking (no side effects).
    // console.warn/error preservati per visibilità errori reali.
    esbuild: {
        drop: isProd ? ['debugger'] : [],
        pure: isProd ? ['console.log', 'console.debug', 'console.info'] : [],
    },
    build: {
        sourcemap: false, // nessuna source map in produzione (no leakage codice sorgente)
        rollupOptions: {
            // Evita che Rollup emetta un fileName assoluto su Windows+symlink.
            input: 'index.html',
            // docx-preview può mancare in ambienti senza npm install completo:
            // externalize per evitare errori build; il dynamic import fallisce
            // gracefully con messaggio "Anteprima non disponibile".
            external: (id) => id === 'docx-preview',
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react';
                    if (id.includes('/react/') || id.includes('\\react\\')) return 'vendor-react';
                    if (
                        id.includes('docxtemplater') ||
                        id.includes('pizzip') ||
                        id.includes('/docx/') ||
                        id.includes('\\docx\\')
                    ) {
                        return 'vendor-docx';
                    }
                    if (id.includes('jspdf')) return 'vendor-jspdf';
                    if (id.includes('file-saver')) return 'vendor-files';
                }
            }
        },
        chunkSizeWarningLimit: 500
    }
};
});
