import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const pages=['map.html','ressources/test/index.html','idf-rp/widgets/gps_mini.html',
 'idf-rp/widgets/apps/waze/index.html','idf-rp/html_divers/admin_map.html','idf-rp/html_divers/id_lignes_saeiv.html'];
for(const file of pages){
 for(const [,attrs,script] of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
  if(!/\bsrc=|\btype=["'](?:module|application\/)/.test(attrs))new vm.Script(script,{filename:file});
 for(const [,value]of read(file).matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)){
  const url=new URL(value,'https://idf-map.fr/'+file);
  if(url.hostname==='idf-map.fr'&&url.pathname.startsWith('/idf-rp/'))assert(fs.existsSync(path.join(root,decodeURIComponent(url.pathname))),file+': '+value);
 }
}
const mapContext=read('idf-rp/config/map-context.js');
for(const map of ['idf','grandutopia','unsupported']){
 const calls=[],ctx=vm.createContext({URL,URLSearchParams,Request,location:new URL('https://idf-map.fr/ressources/test/?map='+map),
  fetch:async url=>{calls.push(String(url));return {ok:true};}});
 ctx.window=ctx;vm.runInContext(mapContext,ctx);
 for(const file of ['Mode Bus/lines.xml','DBus/stops.xml']){
  const url=ctx.IDF_MAP_CONTEXT.file(file);
  assert(url.startsWith('/idf-rp/maps/'+map+'/'),url);
  if(map!=='unsupported')assert(fs.statSync(path.join(root,decodeURIComponent(url))).isFile(),url);
 }
 await ctx.fetch('/map_files/IDF-RP/Mode%20Bus/lines.xml');
 assert.equal(new URL(calls[0]).pathname,'/idf-rp/maps/'+map+'/Mode%20Bus/lines.xml');
 assert.equal(ctx.IDF_MAP_CONTEXT.hasWebsiteMap,map==='idf');
 assert.throws(()=>ctx.IDF_MAP_CONTEXT.file('../outside.xml'),/Invalid map path/);
}
const variants=fs.readdirSync(path.join(root,'idf-rp/maps/idf/Mode Bus'),{withFileTypes:true})
 .filter(e=>e.isDirectory()&&fs.existsSync(path.join(root,'idf-rp/maps/idf/Mode Bus',e.name,'lines.xml')));
for(const {name}of variants){
 const ctx=vm.createContext({URL,URLSearchParams,location:new URL('https://idf-map.fr/ressources/test/?map=idf&dataVersion='+encodeURIComponent(name))});
 ctx.window=ctx;vm.runInContext(mapContext,ctx);
 const file=ctx.IDF_MAP_CONTEXT.file('Mode Bus/lines.xml');
 assert(fs.existsSync(path.join(root,decodeURIComponent(file))),file);
 assert.equal(new URL(ctx.IDF_MAP_CONTEXT.remap(file)).pathname,new URL(file,ctx.location).pathname,'variant remapping is idempotent');
}
console.log('PASS website tools, scripts and map-specific bus catalogues, including selectable variants.');

const publicMap=read('map.html');
assert(!publicMap.includes('config/map-context.js'),'public map never remaps XML to IDFRP');
const publicPaths=publicMap.slice(publicMap.indexOf('    const DBUS_BASE ='),publicMap.indexOf('    async function fetchMapFile('));
const folders = JSON.parse(read('map_files/versions.json'));
assert(folders.length > 0);
for(const selected of folders){
 const base='./map_files/'+selected;
 const ctx=vm.createContext({MAP_FILES_ROOT:'./map_files',DATA_BASE:base,OVERLAY_BASE:base+'/Overlays'});
 vm.runInContext(publicPaths,ctx);
 for(const file of ['lines.xml','stops.xml','city.xml']){
  const urls=ctx.mapFileCandidatePaths('Mode%20Bus/'+file);
  assert.equal(urls.length,1);
  assert.equal(urls[0],base+'/Dbus%20World%20Lines/'+file);
  assert(fs.existsSync(path.join(root,decodeURIComponent(urls[0]))));
 }
 assert.equal(ctx.mapFileCandidatePaths('nav_graph.json')[0],'./map_files/nav_graph.json');
}
console.log('PASS public DBus catalogue and nav graph stay independent of plugin maps/versions.');

const mapUrlSource=publicMap.slice(publicMap.indexOf('    function buildWazeModeUrl(){'),publicMap.indexOf('    function openDevWazeWindow(){'));
const mapUrls=vm.createContext({URL,location:new URL('https://idf-map.fr/map.html'),SELECTED_VERSION:'IDF-RP'});
vm.runInContext(mapUrlSource,mapUrls);
const wazeUrl=new URL(mapUrls.buildWazeModeUrl());
assert(fs.existsSync(path.join(root,wazeUrl.pathname)),'public map opens an existing Waze page');
const waze=read(wazeUrl.pathname.slice(1));
const frameUrlSource=waze.slice(waze.indexOf('    function buildWazeUrl() {'),waze.indexOf('    frame.src = buildWazeUrl();'));
wazeUrl.searchParams.set('map','grandutopia');
const frameUrls=vm.createContext({URL,location:wazeUrl,isHostDevMapMode:()=>true});
vm.runInContext(frameUrlSource,frameUrls);
const gpsUrl=new URL(frameUrls.buildWazeUrl());
assert(fs.existsSync(path.join(root,gpsUrl.pathname)),'Waze GPS iframe exists');
for(const key of ['version','bridge','map'])assert.equal(gpsUrl.searchParams.get(key),wazeUrl.searchParams.get(key),'Waze forwards '+key);
assert(gpsUrl.searchParams.has('waze_app'));assert.equal(gpsUrl.searchParams.get('devmap'),'1');
console.log('PASS public-map Waze link and GPS iframe preserve the selected map and bridge context.');
