// COACH17: catalogue dynamique DBus vers la vraie page jobs.company d'ETS2.
// Les quatre premières sections suivent les dbus-sec de map.html. Les autres
// réseaux/autocars/scolaires sont proposés individuellement, sans liste figée.
function buildNativeServiceCatalog(lines,stopEntries,lineNumber){
  var categories=[{key:'all',label:'Tout'},{key:'urban',label:'Urbaines'}],extras=new Map(),routes=[],present=new Set();
  (lines||[]).forEach(function(line){
    var n=String(line.number||'').trim(),rs=Array.isArray(line.routes)?line.routes:[];
    var other=/titus|navette\s+de\s+nogent/i.test(n)||rs.some(function(r){return /navette\s+de\s+nogent/i.test(r.name||'');});
    var night=/^N\d+$/i.test(n),replacement=/^(RER\b|M[ée]tro\b)/i.test(n)||rs.some(function(r){return /^(RER\b|M[ée]tro\b)/i.test(r.name||'');});
    var autocar=/autocar|flix/i.test(n)||rs.some(function(r){return /autocar|flix/i.test(r.name||'');});
    rs.forEach(function(route){
      if(!line.uid||!route.uid)return;
      var number=String(lineNumber(line,route)||n).trim(),name=String(route.name||'').trim();
      var category=night?'noctilien':replacement?'replacement_bus':/^express\b/i.test(n+' '+name)?'express':!other&&!autocar&&/^\d+$/.test(n)?'urban':'line:'+String(line.uid);
      // Express and autocar routes can be stored alongside other directions.
      if(!night&&!replacement&&/^express\b/i.test(name))category='express';
      var stops=stopEntries(route)||[],first=stops[0],last=stops[stops.length-1];
      function label(s){return String(s&&(s.name||s.stop&&s.stop.name)||'').trim();}
      if(category.indexOf('line:')===0)extras.set(category,n||number||String(line.uid));
      present.add(category);
      routes.push({lineUid:String(line.uid),routeUid:String(route.uid),category:category,line:number||n,destination:label(last)||name,origin:label(first),stops:stops.length||Number(route.stops&&route.stops.length)||0,search:name});
    });
  });
  [['express','Express'],['noctilien','Noctilien'],['replacement_bus','Bus de remplacement']].forEach(function(p){if(present.has(p[0]))categories.push({key:p[0],label:p[1]});});
  Array.from(extras).sort(function(a,b){return a[1].localeCompare(b[1],'fr',{numeric:true,sensitivity:'base'});}).forEach(function(p){categories.push({key:p[0],label:p[1]});});
  routes.sort(function(a,b){return a.line.localeCompare(b.line,'fr',{numeric:true,sensitivity:'base'})||a.destination.localeCompare(b.destination,'fr')||a.routeUid.localeCompare(b.routeUid);});
  return {categories:categories,routes:routes};
}
var nativeServicesSocket=null,nativeServicesGeneration='',nativeServicesLoading=false,nativeServicesSource=null,nativeServicesSentAt=0;
var nativeServiceActions=new Map();
function syncNativeServices(){
  if(!telemetryWs||telemetryWs.readyState!==1||telemetryWs.bufferedAmount>65536||!nativeGameModeApplied||!window.GAME2_MANAGER.nativeGameMode||window.GAME2_MANAGER.nativeGameMode.mode!=='bus')return;
  var ws=telemetryWs,generation=nativeGameModeGeneration;
  if(nativeServicesSocket===ws&&nativeServicesGeneration===generation&&nativeServicesSource===dbusLines){
    if(Date.now()-nativeServicesSentAt>=1500){ws.send(JSON.stringify({type:'nativeServicesCatalog',protocol:1,generation:generation,heartbeat:true}));nativeServicesSentAt=Date.now();}
    return;
  }
  if(nativeServicesLoading)return;nativeServicesLoading=true;
  Promise.resolve(ensureDbusDataLoaded()).then(function(){
    if(ws!==telemetryWs||ws.readyState!==1||generation!==nativeGameModeGeneration||!window.GAME2_MANAGER.nativeGameMode||window.GAME2_MANAGER.nativeGameMode.mode!=='bus')return;
    var catalog=buildNativeServiceCatalog(dbusLines,getRouteStopEntries,getLineNumber);
    ws.send(JSON.stringify(Object.assign({type:'nativeServicesCatalog',protocol:1,generation:generation},catalog)));
    nativeServicesSocket=ws;nativeServicesGeneration=generation;nativeServicesSource=dbusLines;nativeServicesSentAt=Date.now();
  }).catch(function(err){console.warn('[Service ETS2] Catalogue indisponible',err);}).finally(function(){nativeServicesLoading=false;});
}
function receiveNativeServiceAction(m){
  if(!m||m.protocol!==1||m.generation!==nativeGameModeGeneration||!nativeGameModeApplied||normalizeGameMode(currentGameMode)!=='bus'||!Number.isInteger(m.id)||m.id<1||!Number.isInteger(m.session)||!Number.isInteger(m.catalog)||typeof m.lineUid!=='string'||typeof m.routeUid!=='string')return false;
  var key=[m.generation,m.session,m.catalog,m.id].join(':'),promise=nativeServiceActions.get(key);
  if(!promise){
    // Store the promise before touching the service. Duplicate UDP/WS delivery
    // must never restart boarding or cancel/recreate the same service.
    promise=Promise.resolve().then(function(){
      if(m.generation!==nativeGameModeGeneration)throw new Error('Le mode a changé.');
      return Promise.all([ensureDbusDataLoaded(),ensureNavStopLinksLoaded().catch(function(){})]);
    }).then(function(){
      if(m.generation!==nativeGameModeGeneration||normalizeGameMode(currentGameMode)!=='bus')throw new Error('Le mode a changé.');
      var line=(dbusLines||[]).find(function(l){return String(l.uid)===m.lineUid;}),route=line&&(line.routes||[]).find(function(r){return String(r.uid)===m.routeUid;});
      if(!route)throw new Error('Ce service ne figure plus dans le catalogue.');
      var result=activateSaeivRouteSelection(line,route,{});
      if(!result||!result.ok)throw new Error(result&&result.error||'Service indisponible.');
      if(typeof window.gamePlaySaeivServiceAcceptSound==='function')window.gamePlaySaeivServiceAcceptSound();
      return {ok:true};
    }).catch(function(err){return {ok:false,error:String(err&&err.message||err)};});
    nativeServiceActions.set(key,promise);
    if(nativeServiceActions.size>128)nativeServiceActions.delete(nativeServiceActions.keys().next().value);
  }
  promise.then(function(result){if(telemetryWs&&telemetryWs.readyState===1&&m.generation===nativeGameModeGeneration)telemetryWs.send(JSON.stringify(Object.assign({type:'nativeServiceResult',protocol:1,generation:m.generation,session:m.session,catalog:m.catalog,id:m.id},result)));});
  return true;
}
window.setInterval(syncNativeServices,750);
