'use strict';
const crypto = require('node:crypto');
const P = require('./protocol.cjs');
const { StopCrowds } = require('./stops.cjs');

// Transport-independent. Authentication belongs to the host server; native client
// identity/roster is additional routing evidence, not an authentication credential.
class ConvoyRooms {
  constructor({ send, now = Date.now, authorize = () => false, maxRooms = 256, maxPeers = 512 } = {}) {
    this.send = send; this.now = now; this.authorize = authorize; this.maxRooms = maxRooms;
    this.rooms = new Map(); this.peers = new Map(); this.maxPeers = maxPeers; this.crowds = new StopCrowds({ now });
  }
  emit(peer, message) { try { return this.send(peer, message) !== false; } catch { return false; } }
  join(peer, raw) {
    const h = P.hello(raw); if (!h || !this.authorize(peer, h)) return false;
    // Rejoining the identical generation only refreshes roster/lease.
    const previous = this.peers.get(peer);
    if (previous && previous.hello.room === h.room && previous.hello.player === h.player && previous.hello.instance === h.instance && previous.hello.assets === h.assets && previous.hello.clientId === h.clientId) {
      previous.hello = h; previous.seen = this.now(); this.reconcile(previous.room, previous); return true;
    }
    this.leave(peer);
    if (this.peers.size >= this.maxPeers) return false;
    let room = this.rooms.get(h.room);
    if (!room) {
      if (this.rooms.size >= this.maxRooms) return false;
      room = { id: h.room, epoch: crypto.randomUUID(), peers: new Map() }; this.rooms.set(h.room, room);
    }
    // An active identity cannot be stolen by another connection. The old lease
    // must end or its socket close before a reconnect can replace it.
    if (room.peers.has(h.player) || room.peers.size >= P.LIMITS.peers || [...room.peers.values()].some(p => p.hello.clientId === h.clientId)) return false;
    const p = { peer, room, hello: h, seen: this.now(), state: null, sequence: 0, eventSequence: 0, visible: new Set(), sent: new Map(), pending: new Set(), lastEvents: new Set(), retired: new Set(), tokens: 40, tokenAt: this.now() };
    room.peers.set(h.player, p); this.peers.set(peer, p);
    this.emit(peer, { type: 'convoy.welcome', version: P.VERSION, epoch: room.epoch, player: h.player });
    return true;
  }
  permitted(a, b) {
    return a !== b && a.room === b.room && a.hello.assets === b.hello.assets &&
      P.member(a.hello.roster, b.hello.player, b.hello.clientId) &&
      P.member(b.hello.roster, a.hello.player, a.hello.clientId);
  }
  consume(p) {
    const now = this.now(); p.tokens = Math.min(40, p.tokens + Math.max(0, now - p.tokenAt) * .025); p.tokenAt = now;
    if (p.tokens < 1) return false; p.tokens -= 1; return true;
  }
  receive(peer, raw) {
    if (raw?.type === 'convoy.hello') return this.join(peer, raw);
    const p = this.peers.get(peer); if (!p || raw?.epoch !== p.room.epoch || !this.consume(p)) return false;
    if (raw.type === 'convoy.ping') { p.seen = this.now(); this.emit(peer, { type: 'convoy.pong', version: 1, epoch: p.room.epoch, time: this.now() }); return true; }
    if (raw.type === 'convoy.leave') { this.leave(peer); return true; }
    if (raw.type === 'convoy.stop') {
      if (!p.state || !P.key(raw.stop) || raw.generation !== p.state.generation || Math.abs(p.state.speed) > .2 || p.state.doors[0] < .1) return false;
      if (raw.action === 'reserve') {
        if (!P.integer(raw.count, 0, 128) || !P.integer(raw.waiting, 0, 128) || !P.pose(raw.pose) || P.distance(p.state.pose, raw.pose) > 40) return false;
        if (!this.crowds.open(p.room.epoch, raw.stop, raw.pose, raw.waiting)) return false;
        const people = this.crowds.reserve(p.room.epoch, raw.stop, p.hello.player, p.state.generation, raw.count, p.state.pose);
        this.emit(peer, { type: 'convoy.reservation', version: 1, epoch: p.room.epoch, stop: raw.stop, generation: p.state.generation, people });
      } else if (raw.action === 'board') {
        if (!this.crowds.board(p.room.epoch, raw.stop, p.hello.player, p.state.generation, raw.passenger)) return false;
        this.emit(peer, { type: 'convoy.boarded', version: 1, epoch: p.room.epoch, stop: raw.stop, generation: p.state.generation, passenger: raw.passenger });
      } else return false;
      p.seen = this.now(); const crowd = this.crowds.snapshot(p.room.epoch, raw.stop);
      for (const q of p.room.peers.values()) if ((q === p || this.permitted(p, q)) && q.state && P.distance(q.state.pose, crowd.pose) <= P.LIMITS.enterM)
        this.emit(q.peer, { type: 'convoy.crowd', version: 1, epoch: p.room.epoch, ...crowd });
      return true;
    }
    if (raw.type === 'convoy.state') {
      const s = P.snapshot(raw); if (!s || s.sequence <= p.sequence || p.retired.has(s.generation)) return false;
      if (p.state && p.state.generation !== s.generation) {
        p.retired.add(p.state.generation); if (p.retired.size > 1024) { this.leave(peer); return false; }
        this.removeVisible(p); p.eventSequence = 0; p.lastEvents.clear(); this.releaseReservations(p);
      }
      p.state = s; p.sequence = s.sequence; p.seen = this.now(); this.reconcile(p.room, p); return true;
    }
    if (raw.type === 'convoy.event') {
      const e = P.event(raw); if (!e || !p.state || e.generation !== p.state.generation || e.sequence <= p.eventSequence || p.lastEvents.has(e.id)) return false;
      p.eventSequence = e.sequence; p.seen = this.now(); p.lastEvents.add(e.id);
      if (p.lastEvents.size > 128) p.lastEvents.delete(p.lastEvents.values().next().value);
      for (const q of p.room.peers.values()) if (this.permitted(p, q) && q.state && P.distance(p.state.pose, q.state.pose) <= P.LIMITS.audioM)
        this.emit(q.peer, { ...e, player: p.hello.player, clientId: p.hello.clientId, instance: p.hello.instance, at: this.now() });
      return true;
    }
    return false;
  }
  reconcile(room, changed) {
    const now = this.now();
    for (const peer of room.peers.values()) if (peer !== changed) {
      this.reconcilePair(changed, peer, now);
      this.reconcilePair(peer, changed, now);
    }
  }
  reconcilePair(viewer, source, now) {
    const room = viewer.room, id = source.hello.player, had = viewer.visible.has(id);
    const d = source.state && viewer.state ? P.distance(source.state.pose, viewer.state.pose) : Infinity;
    const show = this.permitted(viewer, source) && d <= (had ? P.LIMITS.leaveM : P.LIMITS.enterM);
    if (!show) {
      viewer.pending.delete(source);
      if (had) { viewer.visible.delete(id); viewer.sent.delete(id); this.emit(viewer.peer, { type: 'convoy.remove', version: 1, epoch: room.epoch, player: id, clientId: source.hello.clientId, instance: source.hello.instance }); }
      return;
    }
    const lod = d <= P.LIMITS.fullM ? 'full' : 'reduced', last = viewer.sent.get(id);
    if (last && last.sequence === source.sequence && last.lod === lod) { viewer.pending.delete(source); return; }
    viewer.pending.add(source);
    if (last && last.lod === lod && now - last.at < (lod === 'full' ? 50 : 250)) return;
    const state = lod === 'full' ? source.state : { ...source.state, passengers: source.state.passengers.filter(p => p.stage === 'resident') };
    if (this.emit(viewer.peer, { ...state, player: id, clientId: source.hello.clientId, instance: source.hello.instance, lod, at: now })) {
      viewer.visible.add(id); viewer.sent.set(id, { sequence: source.sequence, lod, at: now }); viewer.pending.delete(source);
    }
  }
  removeVisible(p) {
    for (const q of p.room.peers.values()) if (q.visible.delete(p.hello.player)) {
      q.sent.delete(p.hello.player); this.emit(q.peer, { type: 'convoy.remove', version: 1, epoch: p.room.epoch, player: p.hello.player, clientId: p.hello.clientId, instance: p.hello.instance });
    }
  }
  releaseReservations(p) {
    this.crowds.release(p.room.epoch, p.hello.player);
  }
  leave(peer) {
    const p = this.peers.get(peer); if (!p) return;
    this.removeVisible(p); this.releaseReservations(p);
    for (const viewer of p.room.peers.values()) viewer.pending.delete(p);
    p.pending.clear(); p.room.peers.delete(p.hello.player); this.peers.delete(peer);
    if (!p.room.peers.size) { this.rooms.delete(p.room.id); this.crowds.clear(p.room.epoch); }
  }
  tick() {
    const now = this.now(); for (const [peer, p] of this.peers) if (now - p.seen >= P.LIMITS.leaseMs) this.leave(peer);
    for (const viewer of this.peers.values()) for (const source of viewer.pending) this.reconcilePair(viewer, source, now);
  }
  close() { for (const peer of [...this.peers.keys()]) this.leave(peer); }
}
module.exports = { ConvoyRooms };
