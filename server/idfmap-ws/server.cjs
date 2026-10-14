'use strict';
const { AdminOverview } = require('./admin-overview.cjs');
const http = require('node:http');
const { PlayerStore, inner, identity, telemetry } = require('./store.cjs');
const { ConvoyRooms } = require('./convoy/rooms.cjs');
const P = require('./convoy/protocol.cjs');

function createServer({ WebSocketServer, store, authorizeConvoy, log = console.error } = {}) {
  const clients = new Set(), identities = new Map(); let closed = false, lastLog = -Infinity;
  function report(error) { if (Date.now() - lastLog >= 60000) { lastLog = Date.now(); log('[idfmap-ws] ' + String(error.message || error)); } }
  function send(peer, message) {
    if (peer.readyState !== 1 || peer.bufferedAmount > 1024 * 1024) { peer.terminate(); return false; }
    try { peer.send(typeof message === 'string' ? message : JSON.stringify(message)); return true; } catch { return false; }
  }
  // The existing statistics endpoint uses self-reported Steam IDs. Bind them
  // to each connection; deployments with authenticated sessions can supply
  // authorizeConvoy to additionally check their server-verified identity.
  const rooms = new ConvoyRooms({ send, authorize: (peer, h) => identities.get(peer) === h.player && (!authorizeConvoy || authorizeConvoy(peer, h)) });
  const admin = new AdminOverview(rooms, send);
  const server = http.createServer((req, res) => {
    if (req.url !== '/' && req.url !== '/health') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ service: 'idfmap-ws', protocol: 2, convoy: 1, ready: !closed }));
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: P.LIMITS.bytes, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    if (closed || clients.size >= 1024) { socket.destroy(); return; }
    // Existing reverse proxies may strip /idfmap/ws/native/. Both forms work.
    const pathname = String(req.url || '').split('?')[0];
    if (!['/', '/idfmap/ws/native/', '/convoy'].includes(pathname)) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  function legacyForward(doc, depth = 0) {
    if (!doc || typeof doc !== 'object' || depth > 8) return false;
    const kind = String(doc.type || doc.action || doc.event || doc.kind || '').toLowerCase();
    if (['ping', 'pong', 'heartbeat', 'hello', 'subscribe', 'unsubscribe'].includes(kind)) return false;
    if (kind.startsWith('convoy.')) return false;
    return kind === 'bus_line_complete' || telemetry(doc) || doc.scope === 'idf_game_widget_bridge_v1' ||
      ['pcc_voice', 'pcc_voice_message', 'pcc_message_voice', 'pcc_audio'].includes(kind) || doc.pccVoice === true || doc.isPccVoice === true || legacyForward(doc.payload, depth + 1);
  }
  wss.on('connection', peer => {
    clients.add(peer); peer.alive = true;
    try { send(peer, { type: 'data', players: store.snapshot(), ts: Date.now() }); } catch (e) { report(e); }
    peer.on('pong', () => { peer.alive = true; });
    let allowance = 200, at = Date.now();
    peer.on('message', (bytes, binary) => {
      if (binary) { peer.close(1003, 'JSON required'); return; }
      const now = Date.now(); allowance = Math.min(200, allowance + Math.max(0, now - at) * .06); at = now;
      if (allowance < 1) { peer.close(1008, 'Rate limit'); return; } --allowance;
      const doc = P.decode(bytes); if (!doc) { peer.close(1007, 'Invalid message'); return; }
      if (admin.receive(peer, doc)) return;
      if (typeof doc.type === 'string' && doc.type.startsWith('admin.')) return;
      if (typeof doc.type === 'string' && doc.type.startsWith('convoy.')) {
        // Reserved messages must NEVER fall through to the global admin relay.
        if (doc.type === 'convoy.identify') {
          const old = identities.get(peer);
          if (doc.version !== 1 || !P.steam(doc.player) || (old && old !== doc.player)) { peer.close(1008, 'Identity refused'); return; }
          // Dedicated Convoy connections do not overwrite the complete player
          // telemetry row with an empty identity-only snapshot.
          identities.set(peer, doc.player); return;
        }
        if (!rooms.receive(peer, doc)) send(peer, { type: 'convoy.rejected', version: 1 });
        else admin.event(peer, doc);
        return;
      }
      if (telemetry(doc)) {
        const id = identity(inner(doc));
        if (P.steam(id)) { const old = identities.get(peer); if (old && old !== id) { peer.close(1008, 'Identity changed'); return; } identities.set(peer, id); }
      }
      if (!legacyForward(doc)) return;
      try { store.record(doc); } catch (e) { report(e); }
      for (const other of clients) if (other !== peer) send(other, bytes.toString('utf8'));
    });
    const cleanup = () => { clients.delete(peer); identities.delete(peer); rooms.leave(peer); admin.leave(peer); };
    peer.on('close', cleanup); peer.on('error', cleanup);
  });
  const tick = setInterval(() => { rooms.tick(); admin.tick(); }, 50); tick.unref();
  const heartbeat = setInterval(() => { for (const peer of clients) { if (!peer.alive) peer.terminate(); else { peer.alive = false; peer.ping(); } } }, 15000); heartbeat.unref();
  async function close() {
    if (closed) return; closed = true; clearInterval(tick); clearInterval(heartbeat); admin.close(); rooms.close();
    for (const peer of clients) peer.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve)); store.close();
  }
  return { server, close, rooms };
}
function start() {
  const { WebSocketServer } = require('ws'), Database = require('better-sqlite3');
  const app = createServer({ WebSocketServer, store: new PlayerStore({ Database, file: process.env.DB_PATH }) });
  app.server.listen(Number(process.env.WS_PORT || process.env.PORT || 9377), process.env.WS_HOST || '0.0.0.0');
  process.once('SIGINT', () => app.close()); process.once('SIGTERM', () => app.close());
  return app;
}
if (require.main === module) start();
module.exports = { createServer, start };
