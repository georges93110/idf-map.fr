'use strict';
const crypto = require('node:crypto');
const P = require('./protocol.cjs');
// One waiting population per physical stop in a room. Reservations are leases,
// boarding is an idempotent committed transfer; it is never undone on disconnect.
class StopCrowds {
  constructor({ now = Date.now, maxStops = 128, maxPeople = 128 } = {}) {
    this.now = now; this.maxStops = maxStops; this.maxPeople = maxPeople; this.rooms = new Map();
  }
  open(room, stopId, position, count) {
    if (!P.key(room) || !P.key(stopId) || !P.pose(position) || !P.integer(count, 0, this.maxPeople)) return null;
    let stops = this.rooms.get(room); if (!stops) { stops = new Map(); this.rooms.set(room, stops); }
    let stop = stops.get(stopId);
    if (stop) { if (P.distance(stop.pose, position) > 5) return null; stop.seen = this.now(); return stop; }
    if (stops.size >= this.maxStops) return null;
    stop = { id: stopId, pose: { ...position }, seen: this.now(), revision: 1, people: new Map() };
    for (let n = 0; n < count; ++n) {
      const id = crypto.createHash('sha256').update(`${room}:${stopId}:${n}`).digest('hex').slice(0, 24);
      stop.people.set(id, { id, model: parseInt(id.slice(0, 8), 16) % 104, reservedBy: null, generation: null, until: 0, boarded: false });
    }
    stops.set(stopId, stop); return stop;
  }
  reserve(room, stopId, player, generation, count, position) {
    const stop = this.rooms.get(room)?.get(stopId);
    if (!stop || !P.player(player) || !P.key(generation) || !P.integer(count, 0, this.maxPeople) || !P.pose(position) || P.distance(stop.pose, position) > 40) return [];
    const now = this.now(), assigned = [];
    for (const p of stop.people.values()) {
      if (p.boarded) continue;
      if (p.reservedBy && p.until <= now) { p.reservedBy = null; p.generation = null; ++stop.revision; }
      if (assigned.length >= count || (p.reservedBy && (p.reservedBy !== player || p.generation !== generation))) continue;
      if (!p.reservedBy) ++stop.revision;
      p.reservedBy = player; p.generation = generation; p.until = now + 6000; assigned.push({ ...p });
    }
    stop.seen = now; return assigned;
  }
  board(room, stopId, player, generation, id) {
    const stop = this.rooms.get(room)?.get(stopId), p = stop?.people.get(id);
    if (!p || p.reservedBy !== player || p.generation !== generation || (!p.boarded && p.until <= this.now())) return false;
    if (!p.boarded) { p.boarded = true; p.until = 0; ++stop.revision; }
    return true;
  }
  release(room, player, generation) {
    for (const stop of this.rooms.get(room)?.values() || []) for (const p of stop.people.values()) {
      if (!p.boarded && p.reservedBy === player && (!generation || p.generation === generation)) { p.reservedBy = null; p.generation = null; p.until = 0; ++stop.revision; }
    }
  }
  snapshot(room, stopId) {
    const s = this.rooms.get(room)?.get(stopId); if (!s) return null;
    return { id: s.id, pose: { ...s.pose }, revision: s.revision, people: [...s.people.values()].filter(p => !p.boarded).map(p => ({ ...p })) };
  }
  clear(room) { this.rooms.delete(room); }
}
module.exports = { StopCrowds };
