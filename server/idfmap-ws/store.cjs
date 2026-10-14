'use strict';
const fs = require('node:fs'), path = require('node:path');
const num = v => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const truthy = v => v === true || v === 1 || v === '1';
function inner(doc) {
  if (!doc || typeof doc !== 'object') return {};
  const looks = v => v && typeof v === 'object' && (v.gameContext || v.playerIdentity || v.speedKmh !== undefined || v.steamid || v.steamId || v.x !== undefined);
  if (doc.type === 'telemetry' && doc.payload) return doc.payload;
  if (looks(doc.payload)) return doc.payload;
  if (looks(doc.data) || looks(doc.player)) return { ...(doc.player || {}), ...(doc.data || {}) };
  return doc;
}
function identity(v) { const g = v.gameContext || {}, p = g.playerIdentity || v.playerIdentity || {}; const s = p.steamid || p.steamId || v.steamid || v.steamId; return s ? String(s) : (v.profileId || v.profile_id || g.profile_id) ? 'profile:' + (v.profileId || v.profile_id || g.profile_id) : null; }
function telemetry(doc) { const v = inner(doc); return !!(v.gameContext || v.playerIdentity || v.speedKmh !== undefined || v.steamid || v.steamId || v.x !== undefined); }
const fields = {
  display_name: 'TEXT', profile_name: 'TEXT', profile_id: 'TEXT', ws_player_id: 'TEXT', pcc_client_id: 'TEXT', game_status: 'TEXT', map: 'TEXT',
  speed_kmh: 'REAL', fuel_liters: 'REAL', fuel_range_km: 'REAL', fuel_consumption_avg: 'REAL', game_time_minutes: 'INTEGER', truck_damage_percent: 'REAL',
  truck_brand: 'TEXT', truck_name: 'TEXT', vehicle_name: 'TEXT', x: 'REAL', y: 'REAL', z: 'REAL', heading: 'REAL', adblue_liters: 'REAL',
  adblue_warning: 'INTEGER NOT NULL DEFAULT 0', fuel_warning: 'INTEGER NOT NULL DEFAULT 0', paused: 'INTEGER NOT NULL DEFAULT 0',
  trailer_connected: 'INTEGER NOT NULL DEFAULT 0', in_server: 'INTEGER', ets2_version: 'TEXT'
};
class PlayerStore {
  constructor({ Database, file = path.join(__dirname, 'data/player_stats.sqlite'), env = process.env }) {
    fs.mkdirSync(path.dirname(file), { recursive: true }); this.db = new Database(file); this.env = env; this.odom = new Map();
    this.db.pragma('journal_mode = WAL'); this.db.pragma('foreign_keys = ON');
    this.db.exec("CREATE TABLE IF NOT EXISTS players (steam_id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL DEFAULT '{}')");
    const known = new Set(this.db.prepare('PRAGMA table_info(players)').all().map(c => c.name));
    for (const [name, type] of Object.entries(fields)) if (!known.has(name)) this.db.exec(`ALTER TABLE players ADD COLUMN ${name} ${type}`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_players_updated_at ON players(updated_at DESC);
      CREATE TABLE IF NOT EXISTS player_totals (steam_id TEXT PRIMARY KEY, total_distance_m_idfrp REAL NOT NULL DEFAULT 0, last_telemetry_at INTEGER, last_x REAL, last_y REAL, last_z REAL, last_fuel_liters REAL, last_server_ts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS bus_line_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, steam_id TEXT NOT NULL, line_id TEXT, started_at INTEGER, ended_at INTEGER NOT NULL, payload_json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_bus_runs_steam_ended ON bus_line_runs(steam_id, ended_at DESC);
      CREATE TABLE IF NOT EXISTS bus_line_segments (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, from_stop TEXT, to_stop TEXT, duration_s REAL, distance_m REAL, payload_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(run_id) REFERENCES bus_line_runs(id) ON DELETE CASCADE);
      CREATE INDEX IF NOT EXISTS idx_bus_segments_run ON bus_line_segments(run_id, sort_order);`);
    const names = ['steam_id', ...Object.keys(fields), 'updated_at', 'payload_json'];
    this.upsert = this.db.prepare(`INSERT INTO players (${names.join(',')}) VALUES (${names.map(n => '@' + n).join(',')}) ON CONFLICT(steam_id) DO UPDATE SET ${names.slice(1).map(n => `${n}=excluded.${n}`).join(',')}`);
    this.total = this.db.prepare(`INSERT INTO player_totals (steam_id,total_distance_m_idfrp,last_telemetry_at,last_x,last_y,last_z,last_fuel_liters,last_server_ts) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(steam_id) DO UPDATE SET total_distance_m_idfrp=player_totals.total_distance_m_idfrp+excluded.total_distance_m_idfrp,last_telemetry_at=excluded.last_telemetry_at,last_x=excluded.last_x,last_y=excluded.last_y,last_z=excluded.last_z,last_fuel_liters=excluded.last_fuel_liters,last_server_ts=excluded.last_server_ts`);
    this.runs = this.db.prepare('INSERT INTO bus_line_runs (steam_id,line_id,started_at,ended_at,payload_json) VALUES (?,?,?,?,?)');
    this.segments = this.db.prepare('INSERT INTO bus_line_segments (run_id,from_stop,to_stop,duration_s,distance_m,payload_json,sort_order) VALUES (?,?,?,?,?,?,?)');
    this.insertRun = this.db.transaction((id, p, now) => {
      const start = num(p.startedAt ?? p.started_at), end = num(p.endedAt ?? p.ended_at);
      const run = this.runs.run(id, p.lineId ?? p.line_id ?? null, start === null ? null : Math.floor(start), end === null ? now : Math.floor(end), JSON.stringify(p));
      for (const [i, s] of (Array.isArray(p.segments) ? p.segments.slice(0, 2000) : []).entries()) this.segments.run(run.lastInsertRowid, s.from ?? s.from_stop ?? s.fromStop ?? null, s.to ?? s.to_stop ?? s.toStop ?? null, num(s.durationS ?? s.duration_s), num(s.distanceM ?? s.distance_m), JSON.stringify(s), i);
    });
  }
  record(doc, now = Math.floor(Date.now() / 1000)) {
    if (doc.type === 'bus_line_complete') { const p = doc.payload || doc, id = identity(p); if (id) this.insertRun(id, p, now); return; }
    if (!telemetry(doc)) return; const v = inner(doc), id = identity(v); if (!id) return;
    const g = v.gameContext || {}, p = g.playerIdentity || v.playerIdentity || {};
    const row = { steam_id: id, display_name: v.displayname || v.displayName || p.displayname || p.displayName || p.name || null,
      profile_name: v.profileName || g.profileName || null, profile_id: v.profile_id || v.profileId || g.profile_id || null,
      ws_player_id: v.playerId || v.pccClientId || v.clientId || null, pcc_client_id: v.pccClientId || v.clientId || null,
      game_status: v.gameStatus || g.gameStatus || null, map: g.map || v.map || null, truck_brand: v.truckBrand || null, truck_name: v.truckName || null,
      vehicle_name: v.vehicleName || null, in_server: g.inServer === undefined ? null : +truthy(g.inServer), ets2_version: g.ets2version || g.ets2Version || null,
      updated_at: now, payload_json: JSON.stringify(doc) };
    for (const [to, from] of Object.entries({ speed_kmh: 'speedKmh', fuel_liters: 'fuelLiters', fuel_range_km: 'fuelRangeKm', fuel_consumption_avg: 'fuelConsumptionAverageLPerKm', game_time_minutes: 'gameTimeMinutes', truck_damage_percent: 'truckDamagePercent', x: 'x', y: 'y', z: 'z', heading: 'heading', adblue_liters: 'adblueLiters' })) row[to] = num(v[from]);
    if (row.game_time_minutes !== null) row.game_time_minutes = Math.round(row.game_time_minutes);
    for (const [to, from] of Object.entries({ adblue_warning: 'adblueWarning', fuel_warning: 'fuelWarning', paused: 'paused', trailer_connected: 'trailerConnected' })) row[to] = +truthy(v[from]);
    this.upsert.run(row); this.odometer(id, v, now);
  }
  odometer(id, v, now) {
    const g = v.gameContext || {}, status = String(v.gameStatus || g.gameStatus || '').toLowerCase();
    const enabled = String(g.map || v.map || '').toLowerCase().includes((this.env.WS_IDF_MAP_SUBSTR || 'idf').toLowerCase()) && !truthy(v.paused) && (status === 'en_jeu' || status.includes('drive'));
    const x = num(v.x), y = num(v.y), z = num(v.z), fuel = num(v.fuelLiters), previous = this.odom.get(id);
    if (!enabled || x === null || y === null || z === null) { this.odom.delete(id); return; }
    this.odom.set(id, { x, y, z, fuel, ts: now }); if (!previous || now <= previous.ts) return;
    const dt = Math.min(now - previous.ts, Number(this.env.WS_TELEPORT_MAX_DT_S) || 25), d = Math.hypot(x - previous.x, y - previous.y, z - previous.z);
    const speedDistance = Math.max(0, num(v.speedKmh) || 0) / 3.6 * dt, cap = Number(this.env.WS_TELEPORT_HARD_CAP_M) || 400;
    const plausible = Math.max(speedDistance * (Number(this.env.WS_TELEPORT_SPEED_MARGIN) || 1.5), 35);
    const fuelDelta = fuel !== null && previous.fuel !== null ? Math.abs(fuel - previous.fuel) : Infinity;
    const teleport = d > cap || d > plausible || (d > 30 && d > plausible && fuelDelta < (Number(this.env.WS_FUEL_STABLE_L) || .03));
    this.total.run(id, teleport ? 0 : Math.min(d, speedDistance), now, x, y, z, fuel, now);
    if (this.odom.size > 4096) for (const [key, p] of this.odom) if (now - p.ts > 120) this.odom.delete(key);
  }
  snapshot(now = Math.floor(Date.now() / 1000)) {
    return this.db.prepare('SELECT payload_json FROM players WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT 300').all(now - (Number(this.env.WS_PLAYER_TTL_SEC) || 30)).flatMap(r => { try { return [inner(JSON.parse(r.payload_json))]; } catch { return []; } });
  }
  close() { this.db.close(); }
}
module.exports = { PlayerStore, inner, identity, telemetry };
