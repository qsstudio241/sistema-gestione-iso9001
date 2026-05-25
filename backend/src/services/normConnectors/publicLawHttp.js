'use strict';

const https = require('https');
const http = require('http');

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SGQ-NormChecker/1.0)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
  'Accept-Encoding': 'identity',
  'Cache-Control': 'no-cache',
};

/**
 * HTTP GET con timeout e redirect (uso cataloghi pubblici Normattiva / EUR-Lex).
 */
function fetchPage(url, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const lib = url.startsWith('https') ? https : http;

    const req = lib.get(url, { headers: BROWSER_HEADERS }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        let nextUrl = res.headers.location;
        if (!nextUrl.startsWith('http')) {
          const base = new URL(url);
          nextUrl = `${base.origin}${nextUrl.startsWith('/') ? '' : '/'}${nextUrl}`;
        }
        resolve(fetchPage(nextUrl, redirectsLeft - 1));
        return;
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        if (timedOut) return;
        resolve({
          statusCode: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
          finalUrl: url,
        });
      });
      res.on('error', (e) => { if (!timedOut) reject(e); });
    });

    const timer = setTimeout(() => {
      timedOut = true;
      req.destroy();
      reject(new Error('fetch timeout'));
    }, FETCH_TIMEOUT_MS);

    req.on('error', (e) => { clearTimeout(timer); if (!timedOut) reject(e); });
    req.on('close', () => clearTimeout(timer));
  });
}

module.exports = { fetchPage, BROWSER_HEADERS, FETCH_TIMEOUT_MS };
