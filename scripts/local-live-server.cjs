'use strict';
// Local-only static preview, with no npm packages or global installation.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const root = fs.realpathSync(path.join(__dirname, '..'));
const identity = crypto.createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0, 20);
const stateFile = path.join(os.tmpdir(), `idf-map-live-${identity}.json`);
const action = process.argv[2] || 'start';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wasm': 'application/wasm'
};
function readState() {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return Number.isInteger(state.port) && state.port > 0 && state.port <= 65535 &&
      /^[a-f0-9]{48}$/.test(state.token) && state.identity === identity ? state : null;
  } catch { return null; }
}
function request(state, endpoint, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: state.port,
      path: '/__idf_live/' + endpoint, method, timeout: 1000,
      headers: { Authorization: 'Bearer ' + state.token } }, res => {
      let body = '';
      res.on('data', data => { body += data; if (body.length > 4096) req.destroy(); });
      res.on('end', () => res.statusCode === 200 ? resolve(body) : reject(Error('Not our server')));
    });
    req.on('timeout', () => req.destroy(Error('Timeout')));
    req.on('error', reject); req.end();
  });
}
async function running() {
  const state = readState();
  if (!state) return null;
  try { return await request(state, 'status') === identity ? state : null; } catch { return null; }
}
function openChrome(url) {
  const candidates = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
    .filter(Boolean).map(base => path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  const executable = candidates.find(file => fs.existsSync(file));
  if (!executable) { console.log(`Chrome introuvable. Ouvrez cette adresse dans Chrome : ${url}`); return; }
  const child = spawn(executable, [url], { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', error => console.error('Chrome : ' + error.message)); child.unref();
}
async function serve() {
  // Reuse an existing preview for this checkout.
  if (await running()) return;
  const token = crypto.randomBytes(24).toString('hex');
  const clients = new Set();
  let port = 5500, watcher, timer, heartbeat, closing = false;
  const origin = () => `http://127.0.0.1:${port}`;
  const finish = (res, status, body = '') => { res.writeHead(status); res.end(body); };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return finish(res, 403);
    let url;
    try { url = new URL(req.url, origin()); } catch { return finish(res, 400); }
    if (url.pathname.startsWith('/__idf_live/')) {
      if (url.pathname === '/__idf_live/events' && req.method === 'GET') {
        if (req.headers.origin && ![origin(), `http://localhost:${port}`].includes(req.headers.origin)) return finish(res, 403);
        res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
        res.write(`event: ready\ndata: ${token}\n\n`); clients.add(res);
        req.on('close', () => clients.delete(res)); return;
      }
      if (url.pathname === '/__idf_live/client.js' && ['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        return finish(res, 200, req.method === 'HEAD' ? '' : `(() => {
          const events = new EventSource('/__idf_live/events');
          let session = '';
          events.addEventListener('ready', event => {
            if (session && session !== event.data) location.reload();
            session = event.data;
          });
          events.addEventListener('reload', () => location.reload());
          window.addEventListener('pagehide', () => events.close(), { once: true });
        })();`);
      }
      if (req.headers.authorization !== 'Bearer ' + token) return finish(res, 403);
      if (url.pathname === '/__idf_live/status' && req.method === 'GET') return finish(res, 200, identity);
      if (url.pathname === '/__idf_live/stop' && req.method === 'POST') {
        finish(res, 200, 'Arret du serveur.'); setImmediate(shutdown); return;
      }
      return finish(res, 404);
    }
    if (!['GET', 'HEAD'].includes(req.method)) return finish(res, 405);
    let name;
    try { name = decodeURIComponent(url.pathname); } catch { return finish(res, 400); }
    if (name.includes('\\') || name.includes('\0') || name.includes(':') ||
        name.split('/').some(part => part.startsWith('.') || part === 'node_modules')) return finish(res, 404);
    let file = path.resolve(root, '.' + name);
    if (file !== root && !file.startsWith(root + path.sep)) return finish(res, 404);
    try {
      let stat = await fs.promises.stat(file).catch(() => null);
      if (stat?.isDirectory()) { file = path.join(file, 'index.html'); stat = await fs.promises.stat(file).catch(() => null); }
      if (!stat && !path.extname(file)) { file += '.html'; stat = await fs.promises.stat(file).catch(() => null); }
      if (!stat?.isFile()) return finish(res, 404);
      file = await fs.promises.realpath(file);
      if (!file.startsWith(root + path.sep)) return finish(res, 404);
      const ext = path.extname(file).toLowerCase();
      if (ext === '.php') return finish(res, 501, 'Ce serveur local sert les fichiers statiques ; PHP necessite un serveur PHP.');
      res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
      if (ext === '.html') {
        const html = await fs.promises.readFile(file, 'utf8');
        const script = '<script src="/__idf_live/client.js"></script>';
        const body = Buffer.from(/<\/body>/i.test(html) ? html.replace(/<\/body>/i, script + '</body>') : html + script);
        res.setHeader('Content-Length', body.length); return finish(res, 200, req.method === 'HEAD' ? '' : body);
      }
      let start = 0, end = stat.size - 1, status = 200;
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) { res.setHeader('Content-Range', `bytes */${stat.size}`); return finish(res, 416); }
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
          res.setHeader('Content-Range', `bytes */${stat.size}`); return finish(res, 416);
        }
        status = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
      res.setHeader('Content-Length', Math.max(0, end - start + 1)); res.writeHead(status);
      if (req.method === 'HEAD' || !stat.size) return res.end();
      const stream = fs.createReadStream(file, { start, end });
      stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
    } catch { if (!res.headersSent) finish(res, 404); else res.destroy(); }
  });
  function shutdown() {
    if (closing) return; closing = true;
    clearTimeout(timer); clearInterval(heartbeat); watcher?.close();
    for (const client of clients) client.end();
    try { if (readState()?.token === token) fs.unlinkSync(stateFile); } catch {}
    server.close(() => process.exit(0)); server.closeAllConnections?.();
    setTimeout(() => process.exit(0), 1500).unref();
  }
  for (; port < 5520; port++) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
      }); break;
    } catch (error) { if (error.code !== 'EADDRINUSE') throw error; if (await running()) return; }
  }
  if (!server.listening) throw Error('Ports locaux 5500-5519 indisponibles.');
  watcher = fs.watch(root, { recursive: true }, (_, filename) => {
    if (!filename || String(filename).split(/[\\/]/).some(part => part.startsWith('.') || part === 'node_modules')) return;
    clearTimeout(timer); timer = setTimeout(() => { for (const client of clients) client.write('event: reload\ndata: changed\n\n'); }, 180);
  });
  watcher.on('error', shutdown);
  heartbeat = setInterval(() => { for (const client of clients) client.write(': keepalive\n\n'); }, 15000);
  // Do not overwrite another preview's state when launchers overlap.
  const existing = readState();
  if (existing && await running()) return shutdown();
  if (existing ? readState()?.token === existing.token : !readState()) { try { fs.unlinkSync(stateFile); } catch {} }
  try { fs.writeFileSync(stateFile, JSON.stringify({ identity, token, port, pid: process.pid }), { flag: 'wx', mode: 0o600 }); }
  catch { return shutdown(); }
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
async function main() {
  if (action === 'serve') return serve();
  if (!['start', 'stop', 'status'].includes(action)) throw Error('Usage : start | stop | status');
  let state = await running();
  if (action === 'stop') {
    if (!state) return console.log('Le serveur local est deja arrete.');
    await request(state, 'stop', 'POST');
    for (let i = 0; i < 25 && await running(); i++) await delay(100);
    if (await running()) throw Error('Le serveur ne confirme pas encore son arret.');
    return console.log('Serveur local arrete.');
  }
  if (action === 'status') return console.log(state ? `Serveur actif : http://127.0.0.1:${state.port}/` : 'Serveur arrete.');
  if (!state) {
    const child = spawn(process.execPath, [__filename, 'serve'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; }); child.unref();
    for (let i = 0; i < 50 && !state; i++) { await delay(100); state = await running(); }
    if (!state) throw Error('Impossible de lancer le serveur local. Verifiez les ports 5500-5519 et les droits du dossier.');
  }
  const url = `http://127.0.0.1:${state.port}/`;
  console.log(`Serveur actif : ${url}\nRechargement automatique a chaque modification.`);
  if (!process.argv.includes('--no-browser')) openChrome(url);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; if (action === 'serve') process.exit(1); });
