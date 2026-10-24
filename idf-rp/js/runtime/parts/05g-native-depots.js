// The current map AND selected data version own the entire depot catalogue.
var nativeDepotsSource='',nativeDepotsRows=[],nativeDepotsSocket=null,nativeDepotsAt=0,nativeDepotsLoading=false;
function parseNativeDepots(text){
 var doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror')||doc.documentElement.tagName!=='depots')throw Error('depots.xml invalide');
 return Array.from(doc.documentElement.children).filter(function(e){return e.tagName==='depot';}).map(function(e){
  var name=String(e.getAttribute('name')||'').trim(),reseau=String(e.getAttribute('reseau')||'').trim();
  var positions=Array.from(e.children).filter(function(p){return p.tagName==='placement';}).map(function(p){
   var raw=String(p.getAttribute('position')||'').split(';');
   if(raw.length!==5||raw.some(function(x){return !x.trim();}))throw Error('Position de dépôt invalide');
   var v=raw.map(Number);if(v.some(function(x){return !Number.isFinite(x);})||v.slice(0,3).some(function(x){return Math.abs(x)>5000000;})||v.slice(3).some(function(x){return Math.abs(x)>Math.PI*2;}))throw Error('Position de dépôt hors limites');
   return v;
  });
  if(!name||name.length>200||!positions.length||positions.length>256)throw Error('Dépôt incomplet');
  return {name:name,reseau:/^[a-zA-Z0-9_-]{1,64}$/.test(reseau)?reseau:'',positions:positions};
 });
}
function syncNativeDepots(){
 if(!telemetryWs||telemetryWs.readyState!==1||telemetryWs.bufferedAmount>65536||!nativeGameModeApplied||normalizeGameMode(currentGameMode)!=='bus'||!window.IDF_MAP_CONTEXT)return;
 var ws=telemetryWs,generation=nativeGameModeGeneration,url=IDF_MAP_CONTEXT.file('Mode Bus/depots.xml'),key=generation+'|'+url;
 if(nativeDepotsLoading||Date.now()-nativeDepotsAt<2000)return;
 if(nativeDepotsSource===key&&nativeDepotsSocket===ws&&Date.now()-nativeDepotsAt<15000)return;
 nativeDepotsLoading=true;nativeDepotsAt=Date.now();
 var abort=new AbortController(),timer=setTimeout(function(){abort.abort();},6000);
 fetch(url,{cache:'no-cache',signal:abort.signal}).then(function(r){if(r.status===404)return '<depots/>';if(!r.ok)throw Error('depots.xml HTTP '+r.status);return r.text();})
 .then(function(text){var rows=parseNativeDepots(text);if(rows.length>256)throw Error('Trop de dépôts');
  if(ws!==telemetryWs||generation!==nativeGameModeGeneration||key!==nativeGameModeGeneration+'|'+IDF_MAP_CONTEXT.file('Mode Bus/depots.xml'))return;
  ws.send(JSON.stringify({type:'nativeDepotsCatalog',protocol:1,generation:generation,source:url,depots:rows}));nativeDepotsRows=rows;nativeDepotsSource=key;nativeDepotsSocket=ws;
 }).catch(function(e){console.warn('[Dépôts] Catalogue indisponible',String(e.message||e));})
 .finally(function(){clearTimeout(timer);nativeDepotsLoading=false;});
}
