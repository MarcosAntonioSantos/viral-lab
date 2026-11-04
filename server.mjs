import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = resolve(fileURLToPath(new URL('./public', import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;
const ENV_KEY = (process.env.YOUTUBE_API_KEY || '').trim();
const YT = 'https://www.googleapis.com/youtube/v3/';

const ALLOW = {
  search: ['part', 'q', 'type', 'order', 'maxResults', 'videoDuration', 'regionCode', 'relevanceLanguage', 'publishedAfter', 'channelId', 'safeSearch'],
  videos: ['part', 'id', 'chart', 'regionCode', 'maxResults'],
  channels: ['part', 'id', 'forHandle', 'forUsername', 'maxResults'],
  playlistItems: ['part', 'playlistId', 'maxResults'],
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const cache = new Map();
const TTL = 10 * 60_000;

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, headers);
  res.end(body);
};
const json = (res, status, data) =>
  send(res, status, JSON.stringify(data), { 'content-type': 'application/json; charset=utf-8' });

async function proxy(req, res, url) {
  const endpoint = url.pathname.slice('/api/yt/'.length);
  const allow = ALLOW[endpoint];
  if (!allow) return json(res, 404, { error: { message: 'Endpoint não suportado.' } });

  const key = String(req.headers['x-yt-key'] || ENV_KEY).trim();
  if (!key) {
    return json(res, 401, {
      error: { message: 'Chave da API ausente. Salve sua chave em Configurações.', reason: 'missingKey' },
    });
  }

  const params = new URLSearchParams();
  for (const p of allow) {
    const v = url.searchParams.get(p);
    if (v) params.set(p, v);
  }
  if (!params.has('part')) params.set('part', 'snippet');
  if (endpoint === 'search' && !params.get('q') && !params.get('channelId')) {
    return json(res, 400, { error: { message: 'Informe q ou channelId.' } });
  }
  if (endpoint === 'playlistItems' && !params.get('playlistId')) {
    return json(res, 400, { error: { message: 'Informe playlistId.' } });
  }

  const cacheKey = `${endpoint}?${params}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return json(res, 200, hit.data);

  params.set('key', key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(`${YT}${endpoint}?${params}`, { signal: ctrl.signal });
    const data = await r.json().catch(() => ({ error: { message: 'Resposta inválida do YouTube.' } }));
    if (r.ok) {
      if (cache.size > 400) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, { at: Date.now(), data });
    }
    return json(res, r.status, data);
  } catch (err) {
    const timeout = err.name === 'AbortError';
    return json(res, 504, {
      error: { message: timeout ? 'O YouTube não respondeu a tempo.' : 'Falha de rede ao falar com o YouTube.' },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(res, url) {
  const rel = decodeURIComponent(url.pathname);
  const file = rel === '/' ? 'index.html' : rel.replace(/^\/+/, '');
  const target = normalize(join(PUBLIC, file));
  if (target !== PUBLIC && !target.startsWith(PUBLIC + sep)) return send(res, 403, 'Forbidden');
  try {
    const buf = await readFile(target);
    const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
    send(res, 200, buf, { 'content-type': type, 'cache-control': 'no-cache' });
  } catch {
    try {
      const buf = await readFile(join(PUBLIC, 'index.html'));
      send(res, 200, buf, { 'content-type': MIME['.html'] });
    } catch {
      send(res, 404, 'Not found');
    }
  }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, envKey: Boolean(ENV_KEY) });
  if (url.pathname.startsWith('/api/yt/')) return proxy(req, res, url);
  return serveStatic(res, url);
}).listen(PORT, () => {
  console.log(`\n  Viral Lab  ->  http://localhost:${PORT}${ENV_KEY ? '  [chave via env]' : ''}\n`);
});
