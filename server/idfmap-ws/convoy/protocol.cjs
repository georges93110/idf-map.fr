'use strict';
// Wire data only. Never accepts engine pointers, executable code, asset paths or URLs.
const VERSION = 1;
const LIMITS = Object.freeze({ peers: 128, passengers: 256, bytes: 196608, enterM: 200, leaveM: 230, fullM: 80, audioM: 60, leaseMs: 6000 });
const key = v => typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(v);
const steam = v => typeof v === 'string' && /^7656119\d{10}$/.test(v);
const integer = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const finite = (v, bound) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= bound;
const text = (v, max = 256) => typeof v === 'string' && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const colour = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
function pose(v, local = false) {
  if (!object(v) || !finite(v.x, local ? 30 : 16000000) || !finite(v.y, local ? 10 : 100000) || !finite(v.z, local ? 40 : 16000000) || !finite(v.yaw, 360)) return null;
  return { x: v.x, y: v.y, z: v.z, yaw: v.yaw };
}
function hello(v) {
  if (!object(v) || v.type !== 'convoy.hello' || v.version !== VERSION || !key(v.room) || !steam(v.player) || !key(v.instance) ||
      !integer(v.clientId, 0, 65534) || v.map !== 'idf.mbd' || !key(v.assets) || !Array.isArray(v.roster) || v.roster.length > LIMITS.peers) return null;
  const seen = new Set(), ids = new Set();
  const roster = [];
  for (const p of v.roster) {
    if (!object(p) || (p.player !== undefined && !steam(p.player)) || !integer(p.clientId, 0, 65534) ||
        (p.player !== undefined && seen.has(p.player)) || ids.has(p.clientId)) return null;
    if (p.player !== undefined) seen.add(p.player);
    ids.add(p.clientId); roster.push(p.player === undefined ? { clientId: p.clientId } : { player: p.player, clientId: p.clientId });
  }
  if (!roster.some(p => p.player === v.player && p.clientId === v.clientId)) return null;
  return { type: v.type, version: VERSION, room: v.room, player: v.player, instance: v.instance, clientId: v.clientId, map: v.map, assets: v.assets, roster };
}
// The native roster proves current client membership. A Steam ID, when present,
// must agree as well. Stable Steam identity follows the relay authorization
// policy; session client IDs alone are never persistent player identities.
function member(roster, player, clientId) {
  return roster.some(p => p.clientId === clientId && (p.player === undefined || p.player === player));
}
function sign(v) {
  if (v === null) return null;
  if (!object(v) || !text(v.line, 24) || !text(v.destination) || !colour(v.foreground) || !colour(v.background) || !colour(v.directionColour) ||
      typeof v.partial !== 'boolean' || typeof v.powered !== 'boolean' || !['standard', 'agora'].includes(v.layout)) throw Error('invalid sign');
  return { line: v.line, destination: v.destination, foreground: v.foreground, background: v.background, directionColour: v.directionColour,
    partial: v.partial, powered: v.powered, layout: v.layout, badge: v.badge !== false, stripe: colour(v.stripe) ? v.stripe : '' };
}
function passenger(v) {
  if (!object(v) || !key(v.id) || !integer(v.model, 0, 255) || !integer(v.seat, -1, 255) || !integer(v.door, 0, 2) ||
      !['waiting', 'approach', 'enter', 'toPlace', 'resident', 'toExit', 'leave', 'outside', 'returning'].includes(v.stage) ||
      !['bus', 'world'].includes(v.space) || !integer(v.animation, 0, 255) || !finite(v.phase, 86400)) return null;
  const at = pose(v.pose, v.space === 'bus'); if (!at) return null;
  if (v.variant !== undefined && !integer(v.variant, 0, 255)) return null;
  if (v.walkSpeed !== undefined && (!finite(v.walkSpeed, 4) || v.walkSpeed < 0)) return null;
  return { id: v.id, model: v.model, seat: v.seat, door: v.door, stage: v.stage, space: v.space, pose: at, animation: v.animation, phase: v.phase,
    variant: v.variant ?? 0, walkSpeed: v.walkSpeed ?? .85 };
}
function snapshot(v) {
  if (!object(v) || v.type !== 'convoy.state' || v.version !== VERSION || !key(v.epoch) || !integer(v.sequence, 1, Number.MAX_SAFE_INTEGER) ||
      !key(v.vehicle) || !key(v.profile) || !key(v.generation) || !finite(v.speed, 150) || typeof v.powered !== 'boolean' ||
      typeof v.stopRequested !== 'boolean' || !Array.isArray(v.doors) || v.doors.length < 1 || v.doors.length > 3 ||
      !v.doors.every(n => finite(n, 1) && n >= 0) || !Array.isArray(v.passengers) || v.passengers.length > LIMITS.passengers ||
      !integer(v.occupancy, 0, 500) || !text(v.line, 64) || !text(v.service, 64) || !text(v.stop, 128)) return null;
  const at = pose(v.pose); if (!at) return null;
  const seen = new Set(), seats = new Set(), passengers = [];
  for (const item of v.passengers) {
    const p = passenger(item); if (!p || seen.has(p.id)) return null;
    // Only seated residents own a seat; walking people may keep their target seat.
    if (p.space === 'bus' && p.stage === 'resident' && p.seat >= 0) { if (seats.has(p.seat)) return null; seats.add(p.seat); }
    seen.add(p.id); passengers.push(p);
  }
  let destination; try { destination = sign(v.sign); } catch { return null; }
  return { type: v.type, version: VERSION, epoch: v.epoch, sequence: v.sequence, vehicle: v.vehicle, profile: v.profile, generation: v.generation,
    pose: at, speed: v.speed, powered: v.powered, doors: v.doors.slice(), stopRequested: v.stopRequested, occupancy: v.occupancy,
    line: v.line, service: v.service, stop: v.stop, sign: destination, passengers };
}
function event(v) {
  if (!object(v) || v.type !== 'convoy.event' || v.version !== VERSION || !key(v.epoch) || !key(v.generation) || !key(v.id) ||
      !integer(v.sequence, 1, Number.MAX_SAFE_INTEGER) || !['door_open', 'door_close', 'stop_request', 'destination_announcement'].includes(v.kind) ||
      !integer(v.door, 0, 2) || !integer(v.sound, 0, 65535)) return null;
  return { type: v.type, version: VERSION, epoch: v.epoch, generation: v.generation, id: v.id, sequence: v.sequence, kind: v.kind, door: v.door, sound: v.sound };
}
function decode(data) {
  try { if (typeof data !== 'string' && !Buffer.isBuffer(data)) return null; if (Buffer.byteLength(data) > LIMITS.bytes) return null;
    const v = JSON.parse(data); return object(v) ? v : null; } catch { return null; }
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
module.exports = { VERSION, LIMITS, key, steam, integer, pose, hello, member, sign, passenger, snapshot, event, decode, distance };
