'use strict';

/**
 * Versioni minime dopo gli advisory e guardia mail.
 * nodemailer è il pacchetto vero (niente mock): con DISABLE_EMAIL non deve aprire SMTP.
 */

const net = require('net');

function versionAtLeast(actual, minimum) {
    const a = String(actual).split('.').map((n) => parseInt(n, 10) || 0);
    const b = String(minimum).split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
        const av = a[i] || 0;
        const bv = b[i] || 0;
        if (av > bv) return true;
        if (av < bv) return false;
    }
    return true;
}

describe('dipendenze backend (advisory)', () => {
    it('multer 2.x almeno 2.3.0, compression almeno 1.8.2, nodemailer almeno 10.0.6', () => {
        const multerV = require('multer/package.json').version;
        const compressionV = require('compression/package.json').version;
        const nodemailerV = require('nodemailer/package.json').version;
        expect(multerV.startsWith('2.')).toBe(true);
        expect(versionAtLeast(multerV, '2.3.0')).toBe(true);
        expect(versionAtLeast(compressionV, '1.8.2')).toBe(true);
        expect(versionAtLeast(nodemailerV, '10.0.6')).toBe(true);
    });

    it('compression resta un middleware Express', async () => {
        const express = require('express');
        const request = require('supertest');
        const compression = require('compression');
        const app = express();
        app.use(compression());
        app.get('/ping', (_req, res) => res.type('text/plain').send('ok'));
        const res = await request(app).get('/ping').set('Accept-Encoding', 'identity');
        expect(res.status).toBe(200);
        expect(res.text).toBe('ok');
    });

    it('createTransport accetta ancora host, porta, secure e auth', () => {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: '127.0.0.1',
            port: 2525,
            secure: false,
            auth: { user: 'utente', pass: 'segreto' },
        });
        expect(typeof transporter.sendMail).toBe('function');
        if (typeof transporter.close === 'function') transporter.close();
    });
});

describe('mail spenta: nessun invio', () => {
    const ENV_KEYS = ['NODE_ENV', 'DISABLE_EMAIL', 'ENABLE_EMAIL_IN_TEST', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_PORT', 'SMTP_FROM'];
    let saved;

    beforeEach(() => {
        saved = {};
        ENV_KEYS.forEach((k) => {
            saved[k] = process.env[k];
            delete process.env[k];
        });
    });

    afterEach(() => {
        ENV_KEYS.forEach((k) => {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        });
    });

    async function expectNoSmtp(env, send) {
        const hits = [];
        const server = net.createServer((socket) => {
            hits.push('conn');
            socket.destroy();
        });
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address();
        Object.assign(process.env, env, {
            SMTP_HOST: '127.0.0.1',
            SMTP_PORT: String(port),
            SMTP_USER: 'utente',
            SMTP_PASS: 'segreto',
            SMTP_FROM: 'noreply@example.invalid',
        });
        const { sendAlertEmail } = require('../services/alertMail.service');
        const started = Date.now();
        const ok = await send(sendAlertEmail);
        expect(ok).toBe(false);
        expect(Date.now() - started).toBeLessThan(1000);
        await new Promise((r) => setTimeout(r, 40));
        expect(hits).toEqual([]);
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }

    it('DISABLE_EMAIL=1 non apre una connessione SMTP nemmeno in produzione', async () => {
        await expectNoSmtp(
            { NODE_ENV: 'production', DISABLE_EMAIL: '1', ENABLE_EMAIL_IN_TEST: '1' },
            (sendAlertEmail) => sendAlertEmail('a@example.invalid', 'oggetto', '<p>corpo</p>', 'cc@example.invalid')
        );
    });

    it('NODE_ENV=test non apre una connessione SMTP', async () => {
        await expectNoSmtp(
            { NODE_ENV: 'test' },
            (sendAlertEmail) => sendAlertEmail('a@example.invalid', 'oggetto', '<p>corpo</p>')
        );
    });
});
