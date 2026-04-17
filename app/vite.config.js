import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

export default defineConfig({
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
    plugins: [react()],
    resolve: {
        // Mantiene i path del workspace (C:\ProgettoISO) senza risolvere sul drive reale.
        preserveSymlinks: true
    },
    build: {
        rollupOptions: {
            // Evita che Rollup emetta un fileName assoluto su Windows+symlink.
            input: 'index.html'
        }
    }
});
