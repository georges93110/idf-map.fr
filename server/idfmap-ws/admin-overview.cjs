'use strict';
// Read-only summaries for the admin map. Never relays replication frames,
// passenger identities/poses, audio payloads, asset URLs or connection tokens.
const { LIMITS } = require('./convoy/protocol.cjs');
class AdminOverview {
  constructor(rooms, send, now = Date.now) { this.rooms = rooms; this.send = send; this.now = now; this.clients = new Set(); this.at = 0; this.events = new WeakMap(); }
  receive(peer, doc) {
    if (doc.type !== 'admin.subscribe' && doc.type !== 'admin.unsubscribe') return false;
    if (doc.version !== 1) return true;
    if (doc.type === 'admin.unsubscribe') this.clients.delete(peer);
    else if (!this.clients.has(peer)) { this.clients.add(peer); this.publish(peer); }
    return true;
  }
  event(peer, doc) {
    if (doc.type !== 'convoy.event') return;
    this.events.set(peer, { kind: doc.kind, category: doc.audio?.category || '', action: doc.audio?.action || '', at: this.now(), generation: doc.generation });
  }
  snapshot() {
    const now = this.now(), sessions = [];
    for (const room of this.rooms.rooms.values()) {
      const players = [];
      for (const p of room.peers.values()) {
        const s = p.state, stages = {}, event = this.events.get(p.peer);
        for (const item of s?.passengers || []) stages[item.stage] = (stages[item.stage] || 0) + 1;
        players.push({ player: p.hello.player, clientId: p.hello.clientId, ageMs: Math.max(0, now - p.seen),
          synchronized: !!s, bus: !!s && s.profile !== 'none', ...(s ? { vehicle: s.profile, generation: s.generation, pose: s.pose, speed: s.speed,
            powered: s.powered, doors: s.doors, stopRequested: s.stopRequested, occupancy: s.occupancy,
            line: s.line, service: s.service, stop: s.stop, sign: s.sign, stages,
            visiblePeers: p.visible.size, sequence: s.sequence, lastEvent: event?.generation === s.generation ? event : null } : {}) });
      }
      if (players.length) sessions.push({ id: room.id, epoch: room.epoch, players });
    }
    return { type: 'admin.convoys', version: 1, ts: now, sessions,
      ranges: { passengers: LIMITS.fullM, signs: LIMITS.enterM, sounds: LIMITS.audioM } };
  }
  publish(peer) { const doc = this.snapshot(); if (!this.send(peer, doc)) this.clients.delete(peer); }
  tick() {
    if (!this.clients.size || this.now() - this.at < 1000) return;
    this.at = this.now(); const doc = this.snapshot();
    for (const peer of this.clients) if (!this.send(peer, doc)) this.clients.delete(peer);
  }
  leave(peer) { this.clients.delete(peer); }
  close() { this.clients.clear(); }
}
module.exports = { AdminOverview };
