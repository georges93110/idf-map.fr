'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { PlayerStore } = require('../store.cjs');
let Database, driver;
try { Database = require('better-sqlite3'); driver = 'better-sqlite3'; }
catch {
  // Local source checks can use Node's SQLite engine without installing native
  // dependencies. Deployment CI uses the production better-sqlite3 driver.
  const { DatabaseSync } = require('node:sqlite'); driver = 'node:sqlite adapter';
  Database = class {
    constructor(file) { this.db = new DatabaseSync(file); }
    exec(sql) { return this.db.exec(sql); }
    pragma(sql) { return this.db.exec('PRAGMA ' + sql); }
    prepare(sql) { return this.db.prepare(sql); }
    transaction(fn) { return (...args) => { this.db.exec('BEGIN'); try { const r = fn(...args); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }; }
    close() { this.db.close(); }
  };
}
test('legacy SQLite migration, telemetry, odometer and complete-line transactions (' + driver + ')', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'idfmap-store-test-')), file = path.join(temp, 'test.sqlite');
  let store;
  try {
    const old = new Database(file);
    old.exec("CREATE TABLE players (steam_id TEXT PRIMARY KEY, updated_at INTEGER NOT NULL DEFAULT 0, payload_json TEXT NOT NULL DEFAULT '{}'); INSERT INTO players VALUES ('old-player',1,'{}')"); old.close();
    store = new PlayerStore({ Database, file, env: {} });
    assert.ok(store.db.prepare('SELECT steam_id FROM players WHERE steam_id=?').get('old-player'));
    const id = '76561198000000001';
    const frame = x => ({ source: 'game2', action: 'telemetry', player: { steamId: id }, data: { gameContext: { map: 'idf.mbd', inServer: true }, gameStatus: 'en_jeu', x, y: 0, z: 0, speedKmh: 36, fuelLiters: 100, displayName: 'Test', gameTimeMinutes: 123.8 } });
    store.record(frame(0), 100); store.record(frame(10), 101);
    assert.equal(store.db.prepare('SELECT total_distance_m_idfrp n FROM player_totals WHERE steam_id=?').get(id).n, 10);
    store.record(frame(10000), 102); assert.equal(store.db.prepare('SELECT total_distance_m_idfrp n FROM player_totals WHERE steam_id=?').get(id).n, 10);
    const row = store.db.prepare('SELECT * FROM players WHERE steam_id=?').get(id);
    assert.equal(row.display_name, 'Test'); assert.equal(row.in_server, 1); assert.equal(row.game_time_minutes, 124);
    assert.equal(store.snapshot(102).length, 1); assert.equal(store.snapshot(200).length, 0);
    store.record({ type: 'bus_line_complete', payload: { steamId: id, lineId: '351', startedAt: 80, endedAt: 110, segments: [{ from: 'A', to: 'B', durationS: 30, distanceM: 300 }] } }, 110);
    assert.equal(store.db.prepare('SELECT count(*) n FROM bus_line_runs').get().n, 1);
    assert.equal(store.db.prepare('SELECT distance_m FROM bus_line_segments').get().distance_m, 300);
    assert.throws(() => store.record({ type: 'bus_line_complete', payload: { steamId: id, lineId: 'bad', segments: [null] } }, 111));
    assert.equal(store.db.prepare('SELECT count(*) n FROM bus_line_runs').get().n, 1);
    store.close(); store = new PlayerStore({ Database, file, env: {} });
    assert.equal(store.db.prepare('SELECT count(*) n FROM bus_line_runs').get().n, 1);
  } finally {
    store?.close();
    const resolved = fs.realpathSync(temp), parent = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved), parent); assert.ok(path.basename(resolved).startsWith('idfmap-store-test-'));
    fs.rmSync(resolved, { recursive: true });
  }
});
