// COACH20: catalogue dynamique DBus vers la vraie page jobs.company d'ETS2.
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
      var style=nativeServiceStyle(line,route,number||n);
      routes.push({background:style.background,foreground:style.foreground,badgeKey:style.badgeKey,lineUid:String(line.uid),routeUid:String(route.uid),category:category,line:style.label||number||n,destination:label(last)||name,origin:label(first),stops:stops.length||Number(route.stops&&route.stops.length)||0,search:name});
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
    if(Date.now()-nativeServicesSentAt>=1500){ws.send(JSON.stringify({type:'nativeServicesCatalog',protocol:3,generation:generation,heartbeat:true}));nativeServicesSentAt=Date.now();}
    return;
  }
  if(nativeServicesLoading)return;nativeServicesLoading=true;
  Promise.resolve(ensureDbusDataLoaded()).then(function(){
    if(ws!==telemetryWs||ws.readyState!==1||generation!==nativeGameModeGeneration||!window.GAME2_MANAGER.nativeGameMode||window.GAME2_MANAGER.nativeGameMode.mode!=='bus')return;
    var catalog=buildNativeServiceCatalog(dbusLines,getRouteStopEntries,getLineNumber);
    ws.send(JSON.stringify(Object.assign({type:'nativeServicesCatalog',protocol:3,generation:generation},catalog)));
    nativeServicesSocket=ws;nativeServicesGeneration=generation;nativeServicesSource=dbusLines;nativeServicesSentAt=Date.now();
    syncNativeServiceBadges(catalog,ws,generation);
  }).catch(function(err){console.warn('[Service ETS2] Catalogue indisponible',err);}).finally(function(){nativeServicesLoading=false;});
}
function receiveNativeServiceAction(m){
  if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration||!nativeGameModeApplied||normalizeGameMode(currentGameMode)!=='bus'||!Number.isInteger(m.id)||m.id<1||!Number.isInteger(m.session)||!Number.isInteger(m.catalog)||typeof m.lineUid!=='string'||typeof m.routeUid!=='string')return false;
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
      nativeServicePendingSound={generation:m.generation,lineUid:m.lineUid,routeUid:m.routeUid,scheduledAt:Date.now(),readyAt:0};
      return {ok:true};
    }).catch(function(err){return {ok:false,error:String(err&&err.message||err)};});
    nativeServiceActions.set(key,promise);
    if(nativeServiceActions.size>128)nativeServiceActions.delete(nativeServiceActions.keys().next().value);
  }
  promise.then(function(result){if(telemetryWs&&telemetryWs.readyState===1&&m.generation===nativeGameModeGeneration)telemetryWs.send(JSON.stringify(Object.assign({type:'nativeServiceResult',protocol:3,generation:m.generation,session:m.session,catalog:m.catalog,id:m.id},result)));});
  return true;
}

// Same runtime LINE_STYLES source used by map.html. No frozen list of routes.
function nativeServiceStyle(line,route,number){
 var candidates=typeof collectLineStyleCandidates==='function'?collectLineStyleCandidates(line,route,{}):[number],entry=null;
 if(typeof findLineStyleEntryForRuntimeCandidate==='function')for(var i=0;i<candidates.length&&!entry;i++){var found=findLineStyleEntryForRuntimeCandidate(candidates[i]);if(found)entry=found.entry;}
 var n=String(number||''),all=n+' '+String(line&&line.number||'')+' '+String(route&&route.name||''),night=/^N\d+$/i.test(n);
 var hex=function(c,d){c=String(c||'');if(/^#[0-9a-f]{3}$/i.test(c))c='#'+c.slice(1).split('').map(function(x){return x+x;}).join('');return /^#[0-9a-f]{6}$/i.test(c)?c:d;};
 // These image rules are the existing map.html renderLineItem rules.
 var parsed=typeof parseRouteName==='function'?String(parseRouteName(route&&route.name).lineNumber||'').trim():'',label=number;
 if(/^express\b/i.test(parsed))label=parsed;
 else if(/^titus\s*\d+/i.test(n))label=n.replace(/^titus\s*/i,'');
 else if(/^(RER|M[ée]tro)\s+/i.test(n))label=n.replace(/^(RER|M[ée]tro)\s+/i,'');
 var badgeKey=/navette\s+(?:de\s+)?nogent/i.test(all)?'navette_nogent.png':/^scolaire\b/i.test(n)?'bus_school.png':'';
 // Additional explicit image badges may be supplied by future DBus adapters.
 if(typeof line.badgeImage==='string'&&line.badgeImage)badgeKey=line.badgeImage;
 var bg=night?'#080080':hex(entry&&entry[0],'#3a3a3a'),fg=night?'#ffffff':hex(entry&&entry[1],'#ffffff');
 var kind=/^M[ée]tro\b/i.test(n)?'metro':/^RER\b/i.test(n)?'rer':'bus';
 return {label:label,background:bg,foreground:fg,badgeKey:badgeKey||'webbadge:'+JSON.stringify([label,bg,fg,kind])};
}
// Browser-only offscreen rasterization: same 72x32 rounded badge, bold sans
// and measured label as map.html. Pixels go to native buttons, no visible web layer.
function nativeServiceDrawBadge(ctx,spec){
 var label=String(spec[0]||''),bg=spec[1],fg=spec[2],kind=spec[3];
 var x=0,w=72,r=8;if(kind==='metro'){x=20;w=32;r=16;}else if(kind==='rer')r=5;
 ctx.fillStyle=bg;ctx.beginPath();
 ctx.moveTo(x+r,0);ctx.lineTo(x+w-r,0);ctx.quadraticCurveTo(x+w,0,x+w,r);
 ctx.lineTo(x+w,32-r);ctx.quadraticCurveTo(x+w,32,x+w-r,32);
 ctx.lineTo(x+r,32);ctx.quadraticCurveTo(x,32,x,32-r);
 ctx.lineTo(x,r);ctx.quadraticCurveTo(x,0,x+r,0);ctx.closePath();ctx.fill();
 var size=Math.max(8,Math.min(Math.floor(32*.62),Math.floor((w-10)/(Math.max(1,label.length)*.62))));
 ctx.font='700 '+size+'px sans-serif';while(size>8&&ctx.measureText(label).width>w-8)ctx.font='700 '+(--size)+'px sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=fg;
 ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
 ctx.fillText(label,36,16);ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
}
function nativeServiceCanvasPixels(canvas){
 var bytes=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,72,32).data,binary='';
 for(var i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary);
}
var nativeServiceBadgeCache=new Map();
function nativeServiceImagePixels(key){
 if(nativeServiceBadgeCache.has(key))return nativeServiceBadgeCache.get(key);
 if(key.indexOf('webbadge:')===0){var generated=Promise.resolve().then(function(){var c=document.createElement('canvas');c.width=72;c.height=32;nativeServiceDrawBadge(c.getContext('2d',{willReadFrequently:true}),JSON.parse(key.slice(9)));return nativeServiceCanvasPixels(c);}).catch(function(){return null;});nativeServiceBadgeCache.set(key,generated);return generated;}
 var p=Promise.resolve(typeof loadBestNavGraphVersion==='function'?loadBestNavGraphVersion():null).then(function(version){
  var source=/\.(png|jpe?g|webp)(?:[?#]|$)/i.test(key)&&/[/:]/.test(key)?key:gameMapFilePathForVersion(version,'Overlays/'+key);
  return new Promise(function(resolve,reject){
   var image=new Image(),timer=setTimeout(function(){image.src='';reject(new Error('Image indisponible'));},6000);
   image.crossOrigin='anonymous';image.onerror=function(){clearTimeout(timer);reject(new Error('Image indisponible'));};
   image.onload=function(){clearTimeout(timer);try{
    var canvas=document.createElement('canvas');canvas.width=72;canvas.height=32;var ctx=canvas.getContext('2d',{willReadFrequently:true});
    var scale=Math.min(72/image.naturalWidth,32/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.drawImage(image,(72-w)/2,(32-h)/2,w,h);var bytes=ctx.getImageData(0,0,72,32).data,binary='';
    for(var i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);resolve(btoa(binary));
   }catch(e){reject(e);}};image.src=new URL(source,location.href).href;
  });
 }).catch(function(){return null;});
 nativeServiceBadgeCache.set(key,p);return p;
}
function syncNativeServiceBadges(catalog,ws,generation){
 Array.from(new Set(catalog.routes.map(function(r){return r.badgeKey;}).filter(Boolean))).forEach(function(key){
  nativeServiceImagePixels(key).then(function(pixels){if(pixels&&telemetryWs===ws&&ws.readyState===1&&generation===nativeGameModeGeneration)ws.send(JSON.stringify({type:'nativeServiceBadge',protocol:3,generation:generation,key:key,pixels:pixels}));});
 });
}
function simplifyNativeServiceRoute(points,tolerance){
 if(points.length<3)return points;
 var keep=new Uint8Array(points.length),stack=[[0,points.length-1]],limit=tolerance*tolerance;keep[0]=keep[points.length-1]=1;
 while(stack.length){var pair=stack.pop(),a=points[pair[0]],b=points[pair[1]],dx=b[0]-a[0],dy=b[2]-a[2],len=dx*dx+dy*dy,max=limit,at=-1;
  for(var i=pair[0]+1;i<pair[1];++i){var p=points[i],u=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dy)/len)):0,d=(p[0]-a[0]-u*dx)**2+(p[2]-a[2]-u*dy)**2;if(d>max){max=d;at=i;}}
  if(at>=0){keep[at]=1;stack.push([pair[0],at],[at,pair[1]]);}
 }
 return points.filter(function(_,i){return keep[i];});
}
var nativeServicePreviews=new Map(),nativeServiceLatestPreview='';
function receiveNativeServicePreviewRequest(m){
 if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration||!nativeGameModeApplied||normalizeGameMode(currentGameMode)!=='bus'||!Number.isInteger(m.row)||m.row<1||!Number.isInteger(m.query)||typeof m.lineUid!=='string'||typeof m.routeUid!=='string')return false;
 var key=[m.generation,m.session,m.catalog,m.query,m.row].join(':'),promise=nativeServicePreviews.get(key);nativeServiceLatestPreview=key;
 if(!promise){promise=Promise.all([ensureDbusDataLoaded(),ensureNavGraphLoaded(),ensureNavStopLinksLoaded(),ensureNavBridgesLoaded()]).then(function(){
  var line=(dbusLines||[]).find(function(l){return String(l.uid)===m.lineUid;}),route=line&&(line.routes||[]).find(function(r){return String(r.uid)===m.routeUid;});
  if(!route||nativeServiceLatestPreview!==key)return null;
  var entries=getRouteStopEntries(route),state={lineNumber:getLineNumber(line,route),routeName:route.name,lineUid:line.uid,routeUid:route.uid};
  var rule=(Array.isArray(navBridgeRules)?navBridgeRules:[]).find(function(r){return matchSaeivNavBridgeRule(r,state);})||null,options=getNavBridgeOptionsForRule(rule);
  // Preview uses its own scope; it never changes the active service or its GPS.
  var routePoints=buildSaeivWorldPolylineFromStops(entries,0,entries.length-1,options);
  if(rule)routePoints=applyNavBridgeRuleToRouteWorldPoints(routePoints,entries,rule,options);
  var points=(routePoints||[]).map(function(p){var v=parseWorldPoint3D(p);return v?[v.x,Number.isFinite(v.h)?v.h:0,v.y]:null;}).filter(function(p){return p&&p.every(Number.isFinite);});
  var tolerance=.8;while(points.length>4096){points=simplifyNativeServiceRoute(points,tolerance);tolerance*=2;}
  var stops=entries.map(function(e){return [Number(e.X),Number(e.Y)||0,Number(e.Z)];}).filter(function(p){return p.every(Number.isFinite);}).slice(0,512);
  return points.length>=2?{points:points,stops:stops}:null;
 }).catch(function(err){console.warn('[Service ETS2] Aperçu du trajet indisponible',err);return null;});nativeServicePreviews.set(key,promise);
 if(nativeServicePreviews.size>8)nativeServicePreviews.delete(nativeServicePreviews.keys().next().value);}
 promise.then(function(preview){if(preview&&key===nativeServiceLatestPreview&&m.generation===nativeGameModeGeneration&&telemetryWs&&telemetryWs.readyState===1)telemetryWs.send(JSON.stringify({type:'nativeServicePreview',protocol:3,generation:m.generation,session:m.session,catalog:m.catalog,query:m.query,row:m.row,points:preview.points,stops:preview.stops}));});
 return true;
}

window.setInterval(syncNativeServices,750);

// Service ACK must be immediate so ETS2 can leave the menu. Audio is independent
// and waits for fresh driving telemetry after the menu/loading transition.
var nativeServicePendingSound=null;
function flushNativeServiceSound(){
 var p=nativeServicePendingSound;if(!p)return;
 if(p.generation!==nativeGameModeGeneration||normalizeGameMode(currentGameMode)!=='bus'||typeof saeivRouteState==='undefined'||!saeivRouteState||String(saeivRouteState.lineUid)!==p.lineUid||String(saeivRouteState.routeUid)!==p.routeUid){nativeServicePendingSound=null;return;}
 var now=Date.now(),ready=typeof telemetryPaused!=='undefined'&&telemetryPaused===false&&typeof telemetryConnected!=='undefined'&&telemetryConnected===true&&typeof telemetryLastPacketAt!=='undefined'&&telemetryLastPacketAt>p.scheduledAt&&now-telemetryLastPacketAt<1000&&!(typeof managerState!=='undefined'&&managerState.visible)&&(typeof busSpatialAudio==='undefined'||(busSpatialAudio.seen&&busSpatialAudio.telemetry&&busSpatialAudio.telemetry.audioCameraAvailable&&now-busSpatialAudio.stamp<1000));
 if(!ready){p.readyAt=0;return;}
 if(!p.readyAt){p.readyAt=now;return;}if(now-p.readyAt<750)return;
 nativeServicePendingSound=null;
 if(typeof window.gamePlaySaeivServiceAcceptSound==='function')window.gamePlaySaeivServiceAcceptSound();
}
window.setInterval(flushNativeServiceSound,200);
