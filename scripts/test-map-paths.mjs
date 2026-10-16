import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const files = ['nav_graph.json', 'nav_bridges.json', 'nav_stop_links.json', 'traffic_areas.json', 'uber_eats_restaurants.json', 'TileMapInfo.json', 'Cities.json', 'Overlays.json', 'Monuments.json', 'CentreCommerciaux.json', 'Countries.json', 'Mode%20Bus/lines.xml', 'Mode Bus/stops.xml', 'DBus/city.xml'];
function assertExisting(url, page) {
  const absolute = new URL(url, 'http://localhost/' + page);
  assert(fs.statSync(path.join(root, decodeURIComponent(absolute.pathname))).isFile(), absolute.href);
}
for (const file of ['map.html', 'game_manager/widgets/gps_mini.html', 'game_manager/html_divers/admin_map.html']) {
  for (const [, attrs, script] of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/\bsrc=|\btype=["']application\//.test(attrs)) new vm.Script(script, {filename: file});
  }
}
for (const [page, flag, versionName] of [['map.html', 'NEXT_VERSION_MODE', 'SELECTED_VERSION'], ['game_manager/widgets/gps_mini.html', 'DEV_MAP_MODE', 'EFFECTIVE_VERSION']]) {
  const source = read(page), start = source.indexOf('function mapFileCandidatePaths('), end = source.indexOf('async function fetchMapFile(', start);
  const prefix = page === 'map.html' ? './map_files' : '../../map_files';
  for (const version of ['website', 'IDF-RP']) for (const dev of [false, true]) {
    const ctx = vm.createContext({ MAP_FILES_ROOT: prefix, DATA_BASE: `${prefix}/${version}`, DEV_DATA_BASE: `${prefix}/IDF-RP`, [flag]: dev, [versionName]: version });
    vm.runInContext(source.slice(start, end), ctx);
    for (const file of files) {
      const paths = Array.from(ctx.mapFileCandidatePaths(file));
      assert.equal(paths.length, new Set(paths).size);
      assertExisting(paths[0], page);
      if (/^nav_|^traffic_/.test(file)) assert.equal(paths[0], `${prefix}/${file}`);
      if (/^(?:Mode|DBus)/.test(file)) assert(paths[0].includes('/IDF-RP/Mode%20Bus/'));
      if (file === 'uber_eats_restaurants.json') assert.equal(paths[0], dev || version === 'IDF-RP' ? `${prefix}/IDF-RP/${file}` : `${prefix}/${file}`);
    }
  }
}
const runtime = read('game_manager/js/runtime/parts/00-state-and-config.js');
new vm.Script(runtime);
const helpers = runtime.slice(runtime.indexOf('function normalizeGameMapFilePath('), runtime.indexOf('function fetchGameMapJson('));
for (const dev of [false, true]) {
  const calls = [];
  const ctx = vm.createContext({ GAME_DEV_MAP_BASE_VERSION: 'website', GAME_DEV_MAP_LAYER_VERSION: 'IDF-RP', isGameDevMapModeEnabled: () => dev, fetch: async url => { calls.push(url); return {ok: false, status: 404}; } });
  vm.runInContext(helpers, ctx);
  for (const version of ['website', 'IDF-RP', '0.1.6a', 'Dev']) {
    for (const file of files) assertExisting(ctx.gameMapFilePathForVersion(version, file), 'game_manager/game.html');
  }
  await ctx.fetchGameMapFile('nav_graph.json', 'website');
  assert.deepEqual(calls, ['../map_files/nav_graph.json']); // No duplicate retries of the shared URL.
  calls.length = 0;
  const controller = new AbortController();controller.abort();
  ctx.fetch = async url => { calls.push(url); throw new Error('aborted'); };
  await assert.rejects(ctx.fetchGameMapFile('Cities.json', 'website', {signal: controller.signal}), /aborted/);
  assert.equal(calls.length, 1);
}
const admin = read('game_manager/html_divers/admin_map.html');
assert(admin.includes('fetchJsonDoc(`${MAP_FILES_ROOT}/nav_graph.json`)'));
assert(admin.includes('fetchJsonDoc(`${MAP_FILES_ROOT}/nav_bridges.json`)'));
console.log('PASS: current on-disk map assets, website/IDF-RP/development paths, legacy aliases, shared request deduplication, abort priority and page syntax.');
