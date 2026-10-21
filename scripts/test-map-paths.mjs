import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
for(const file of ['map.html','idf-rp/widgets/gps_mini.html','idf-rp/html_divers/admin_map.html']){
 for(const [,attrs,script] of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
  if(!/\bsrc=|\btype=["'](?:module|application\/)/.test(attrs))new vm.Script(script,{filename:file});
 assert(read(file).includes('config/map-context.js'),file);
}
const source=read('idf-rp/js/runtime/parts/00-state-and-config.js');
const helpers=source.slice(source.indexOf('function normalizeGameMapFilePath('),source.indexOf('function fetchGameMapJson('));
for(const map of ['idf','grandutopia','unsupported']){
 const calls=[],ctx=vm.createContext({URL,URLSearchParams,Request,AbortController,location:new URL('http://localhost/idf-rp/game.html?map='+map),
  GAME_DEV_MAP_BASE_VERSION:'website',GAME_DEV_MAP_LAYER_VERSION:'IDF-RP',isGameDevMapModeEnabled:()=>false,
  fetch:async url=>{calls.push(url);return {ok:false,status:404};}});
 ctx.window=ctx;vm.runInContext(read('idf-rp/config/map-context.js'),ctx);vm.runInContext(helpers,ctx);
 for(const version of ['website','IDF-RP','0.1.6a','Dev']){
  for(const file of ['Mode Bus/lines.xml','DBus/stops.xml']){
   const url=ctx.gameMapFilePathForVersion(version,file);
   assert(url.startsWith('/idf-rp/maps/'+map+'/'),url);
   if(map!=='unsupported')assert(fs.statSync(path.join(root,decodeURIComponent(url))).isFile(),url);
  }
 }
 if(map==='idf'){
  await ctx.fetchGameMapFile('nav_graph.json','website');
  assert.equal(calls.length,1,'one web-map request');
  assert.equal(new URL(calls[0],ctx.location).pathname,'/map_files/nav_graph.json');
  const tileInfo=ctx.gameMapFilePathForVersion('IDF-RP','TileMapInfo.json');
  assert.equal(tileInfo,'../map_files/website/TileMapInfo.json');
  assert(fs.existsSync(path.join(root,'map_files/website/TileMapInfo.json')));
 }else{
  await assert.rejects(ctx.fetchGameMapFile('nav_graph.json','website'),/No website map/);
  assert.equal(calls.length,0,'never request IDF web geography for another game map');
 }
}
console.log('PASS bus XML follows map; IDF web exports stay at website/shared paths; no web map loaded for Grand Utopia.');
