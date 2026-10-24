// The route metrics are supplied by ETS2's private GPS provider, never by the
// website nav graph. Preserve the accepted timetable throughout an active run.
function nativeServiceWaypoints(stops){
 return (stops||[]).map(function(e){
  var p=typeof getSaeivStopGpsOverrideWorldPoint==='function'?getSaeivStopGpsOverrideWorldPoint(e):null;
  return p?[Number(p.x),Number(p.h),Number(p.y)]:[Number(e.X),Number(e.Y),Number(e.Z)];
 });
}
// XML objects are immutable between loads. Reuse normalized stop probabilities
// and expected counts until the catalogue/stops or time-band percentage changes.
var nativeServiceDemandSource=null,nativeServiceDemandStops=null,nativeServiceDemandDefaults=null,nativeServiceDemandCache=new WeakMap();
function nativeServiceDemand(line,route,now){
 var stops=typeof dbusStopsById==='undefined'?null:dbusStopsById;
 if(nativeServiceDemandSource!==dbusLines||nativeServiceDemandStops!==stops||nativeServiceDemandDefaults!==saeivPassengerDefaults){
  nativeServiceDemandSource=dbusLines;nativeServiceDemandStops=stops;nativeServiceDemandDefaults=saeivPassengerDefaults;nativeServiceDemandCache=new WeakMap();
 }
 var value=nativeServiceDemandCache.get(route);
 if(!value){
  var configs=getRouteStopEntries(route).slice(0,-1).map(function(e){return normalizeSaeivPassengerConfig(e,saeivPassengerDefaults);});
  var peak=configs.reduce(function(sum,cfg){var band=getSaeivPassengerSpawnRange(cfg.passengersMin,cfg.passengersMax,100);return sum+(band.min+band.max)*.5*cfg.coefOn/100;},0);
  value={configs:configs,peak:peak,expected:0,percentage:null};nativeServiceDemandCache.set(route,value);
 }
 var rule=getSaeivPassengerTimeRule(now,line,route),percentage=rule?rule.percentage:(isSaeivPeakPassengerTime(now)?100:25);
 if(value.percentage!==percentage){
  value.expected=value.configs.reduce(function(sum,cfg){var band=getSaeivPassengerSpawnRange(cfg.passengersMin,cfg.passengersMax,percentage);return sum+(band.min+band.max)*.5*cfg.coefOn/100;},0);
  value.percentage=percentage;
 }
 return value;
}
function nativeServiceDemandCatalog(now){
 var values=[],linePeaks=new Map();
 (dbusLines||[]).forEach(function(line){(line.routes||[]).forEach(function(route){
  var value=nativeServiceDemand(line,route,now),key=String(line.uid);
  linePeaks.set(key,Math.max(linePeaks.get(key)||0,value.peak));values.push([key,String(route.uid),value]);
 });});
 // One reference per line: hundreds of school variants must not skew the
 // distribution. Sum actual boarding expectations, so longer trips contribute.
 var peaks=Array.from(linePeaks.values()).filter(function(v){return v>0;}).sort(function(a,b){return a-b;});
 var reference=peaks.length?peaks[peaks.length-1]:0;
 function percentile(q){var at=(peaks.length-1)*q,lo=Math.floor(at);return peaks[lo]+(peaks[Math.ceil(at)]-peaks[lo])*(at-lo);}
 var low=reference*.4,high=reference*.75;
 if(peaks.length>1&&peaks[peaks.length-1]>peaks[0]*1.1){low=percentile(.35);high=percentile(.8);}
 return values.map(function(v){var expected=v[2].expected,ratio=reference>0?expected/reference:0;
  return [v[0],v[1],expected<=0||expected<low?0:expected<high?1:2,ratio];
 });
}
function sendNativeServiceStatus(ws,generation){
 if(typeof getSaeivPassengerSpawnRange!=='function'||typeof saeivPassengerDefaults==='undefined')return;
 var demand=nativeServiceDemandCatalog(getSaeivNowTimestampMs());
 var active=typeof saeivRouteState==='object'&&saeivRouteState&&saeivRouteState.selectedKey?[String(saeivRouteState.lineUid),String(saeivRouteState.routeUid)]:null;
 ws.send(JSON.stringify({type:'nativeServicesStatus',protocol:3,generation:generation,demand:demand,active:active}));
}
function receiveNativeServiceMetrics(m){
 if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration||!Array.isArray(m.legs)||m.legs.length>511)return false;
 if(m.legs.some(function(v){return !Array.isArray(v)||v.length!==2||!v.every(Number.isFinite)||v[0]<0||v[0]>500000||v[1]<0||v[1]>604800;}))return false;
 var line=(dbusLines||[]).find(function(l){return String(l.uid)===m.lineUid;});
 var route=line&&(line.routes||[]).find(function(r){return String(r.uid)===m.routeUid;});
 if(!route||getRouteStopEntries(route).length!==m.legs.length+1)return false;
 if(m.waypoints&&JSON.stringify(m.waypoints)!==JSON.stringify(nativeServiceWaypoints(getRouteStopEntries(route))))return false;
 if(m.legs.reduce(function(n,v){return n+v[0];},0)>500000||m.legs.reduce(function(n,v){return n+v[1];},0)>604800)return false;
 route.nativeGpsMetrics=m.legs.map(function(v){return v.slice();});
 route.totalMinutes=m.legs.reduce(function(n,v){return n+v[1]/60;},0);
 var active=typeof saeivRouteState==='object'&&saeivRouteState;
 if(active&&String(active.lineUid)===m.lineUid&&String(active.routeUid)===m.routeUid&&Array.isArray(active.stops)&&active.stops.length===m.legs.length+1){
  active.stops.forEach(function(e,i){
   // Do not slide a running timetable when a late packet/retry arrives.
   if(typeof e.nextStopDurationS!=='number'||!Number.isFinite(e.nextStopDurationS)){
    e.nextStopDurationS=i<m.legs.length?m.legs[i][1]:0;e.nextStopDistanceM=i<m.legs.length?m.legs[i][0]:0;
   }
  });
 }
 return true;
}

// COACH38: catalogue dynamique DBus vers la vraie page jobs.company d'ETS2.
// Le type XML est prioritaire ; les anciennes heuristiques ne servent que
// pour une ligne sans attribut type. Les types personnalisés restent dynamiques.
function buildNativeServiceCatalog(lines,stopEntries,lineNumber){
  var categories=[{key:'all',label:'Tout'}],extras=new Map(),routes=[],present=new Set();
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
      var xmlType=String(line.type||'').replace(/[\x00-\x1f|@<>]/g,' ').replace(/\s+/g,' ').trim();
      if(xmlType){
        var folded=xmlType.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
        var aliases={urbaine:'urban',urbaines:'urban',urbain:'urban',urbains:'urban',express:'express',noctilien:'noctilien',noctiliens:'noctilien','bus de remplacement':'replacement_bus',remplacement:'replacement_bus','bus remplacement':'replacement_bus'};
        category=aliases[folded]||'xml:'+folded;
        if(category.indexOf('xml:')===0&&!extras.has(category))extras.set(category,xmlType);
      }

      var generatedType=line.autogenerated&&/^(school|cars)$/.test(line.generatedType)?line.generatedType:'';
      if(generatedType){category='generated:'+generatedType;extras.set(category,xmlType||(generatedType==='school'?'Scolaire':'Autocars'));}
      var stops=stopEntries(route)||[],first=stops[0],last=stops[stops.length-1];
      function label(s){return String(s&&(s.name||s.stop&&s.stop.name)||'').trim();}
      if(category.indexOf('line:')===0)extras.set(category,n||number||String(line.uid));
      present.add(category);
      var style=nativeServiceStyle(line,route,number||n);
      // Pending until the game reports all native stop-to-stop segments.
      var duration=null,distance=null,waypoints=nativeServiceWaypoints(stops);
      var departure=first&&first.X!=null&&first.Z!=null&&String(first.X).trim()!==''&&String(first.Z).trim()!==''&&Number.isFinite(Number(first.X))&&Number.isFinite(Number(first.Z))?{x:Number(first.X),z:Number(first.Z)}:null;
      routes.push({generatedType:generatedType,departure:departure,duration:duration,distance:distance,waypoints:waypoints,background:style.background,foreground:style.foreground,badgeKey:style.badgeKey,lineUid:String(line.uid),lineCode:String(line.uidRaw||line.uid),routeUid:String(route.uid),category:category,line:style.label||number||n,destination:label(last)||name,origin:label(first),stops:stops.length||Number(route.stops&&route.stops.length)||0,search:name});
    });
  });
  // Keep the types in their XML appearance order. Do not interleave them
  // again by globally sorting line IDs (e.g. low-ID school/coach services).
  var labels={urban:'Urbaines',express:'Express',noctilien:'Noctilien',replacement_bus:'Bus de remplacement'};
  if(present.has('urban'))categories.push({key:'urban',label:labels.urban});
  present.forEach(function(key){if(key!=='urban')categories.push({key:key,label:extras.get(key)||labels[key]||key});});
  var ranks=new Map(categories.map(function(c,i){return [c.key,i];}));
  routes.sort(function(a,b){return ranks.get(a.category)-ranks.get(b.category)||a.lineUid.localeCompare(b.lineUid,'fr',{numeric:true,sensitivity:'base'})||a.routeUid.localeCompare(b.routeUid,'fr',{numeric:true,sensitivity:'base'});});
  var foldCategory=function(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();};
  var wanted=foldCategory(lines&&lines.defaultCategory);
  var selected=categories.find(function(c){return foldCategory(c.key)===wanted||foldCategory(c.label)===wanted;});
  // One real type is not a useful filter. Keep only All in the native control.
  if(present.size<=1&&!routes.some(function(r){return !!r.generatedType;})){categories=categories.slice(0,1);routes.forEach(function(r){r.category='all';});selected=null;}
  if(!selected&&present.size===1&&routes.some(function(r){return !!r.generatedType;}))selected=categories[1];
  return {categories:categories,routes:routes,defaultCategory:selected?selected.key:'all',mapZoom:lines&&lines.mapZoom||0,maxZoom:!lines||lines.maxZoom==null?null:lines.maxZoom};
}
var nativeServicesSocket=null,nativeServicesGeneration='',nativeServicesLoading=false,nativeServicesSource=null,nativeServicesSentAt=0;
var nativeServicesRetryAt=0;
var nativeServiceActions=new Map();
var nativeServicesReloads=new Map();
function receiveNativeServicesReload(m){
 if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration||!Number.isInteger(m.id)||m.id<1||!Number.isInteger(m.session))return false;
 var key=[m.generation,m.session,m.id].join(':'),promise=nativeServicesReloads.get(key);
 if(!promise){
  var previousLoad=dbusLoadPromise;
  promise=Promise.resolve(previousLoad).catch(function(){}).then(function(){
   if(m.generation!==nativeGameModeGeneration)throw new Error('stale_generation');
   return loadDbusDataForVersion(GAME_DEV_MAP_LAYER_VERSION);
  }).then(function(loaded){
   if(m.generation!==nativeGameModeGeneration)throw new Error('stale_generation');
   if(!(loaded.stops instanceof Map)||!loaded.stops.size||!Array.isArray(loaded.lines)||!loaded.lines.length)throw new Error('empty_catalogue');
   dbusDataVersion=String(loaded.version||'');dbusStopsById=loaded.stops;dbusLines=loaded.lines;
   dbusGpsPointsById=loaded.gpsPoints instanceof Map?loaded.gpsPoints:new Map();
   dbusLoadPromise=Promise.resolve(loaded);nativeServicesSource=null;nativeServicesRetryAt=0;
   nativeServicePreviews.clear();nativeServiceWarmPromise=null;
   nativeServicesSocket=null;syncNativeServices();return true;
  }).catch(function(error){
   console.warn('[Service ETS2] Rechargement XML impossible',error);return false;
  });
  nativeServicesReloads.set(key,promise);
  if(nativeServicesReloads.size>16)nativeServicesReloads.delete(nativeServicesReloads.keys().next().value);
 }
 promise.then(function(ok){if(m.generation===nativeGameModeGeneration&&telemetryWs&&telemetryWs.readyState===1)
  telemetryWs.send(JSON.stringify({type:'nativeServicesReloadResult',protocol:3,generation:m.generation,session:m.session,id:m.id,ok:ok}));});
 return true;
}
function receiveNativeServicesSync(m){
 if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration)return false;
 if(m.full===true)nativeServicesSocket=null;
 // WebSocket callbacks keep the catalogue alive even when hidden-page timers
 // are throttled. Never reload the page or reset an active service here.
 nativeServicesSentAt=0;syncNativeServices();return true;
}
function syncNativeServices(){
  syncNativeDepots();
  if(!telemetryWs||telemetryWs.readyState!==1||telemetryWs.bufferedAmount>65536||!nativeGameModeApplied||!window.GAME2_MANAGER.nativeGameMode||window.GAME2_MANAGER.nativeGameMode.mode!=='bus')return;
  var ws=telemetryWs,generation=nativeGameModeGeneration;
  if(dbusLines.length&&nativeServicesSocket===ws&&nativeServicesGeneration===generation&&nativeServicesSource===dbusLines){
    if(Date.now()-nativeServicesSentAt>=1500){ws.send(JSON.stringify({type:'nativeServicesCatalog',protocol:3,generation:generation,heartbeat:true}));nativeServicesSentAt=Date.now();sendNativeServiceStatus(ws,generation);}
    return;
  }
  if(nativeServicesLoading||Date.now()<nativeServicesRetryAt)return;nativeServicesLoading=true;
  Promise.resolve().then(function(){return ensureDbusDataLoaded();}).then(function(){
    if(ws!==telemetryWs||ws.readyState!==1||generation!==nativeGameModeGeneration||!window.GAME2_MANAGER.nativeGameMode||window.GAME2_MANAGER.nativeGameMode.mode!=='bus')return;
    var catalog=buildNativeServiceCatalog(dbusLines,getRouteStopEntries,getLineNumber);
    ws.send(JSON.stringify(Object.assign({type:'nativeServicesCatalog',protocol:3,generation:generation},catalog)));
    if(!catalog.routes.length){dbusLoadPromise=null;dbusLines=[];nativeServicesRetryAt=Date.now()+3000;return;}
    nativeServicesRetryAt=0;
    nativeServicesSocket=ws;nativeServicesGeneration=generation;nativeServicesSource=dbusLines;nativeServicesSentAt=Date.now();sendNativeServiceStatus(ws,generation);
    nativeServiceBadgeKeys=new Set(catalog.routes.map(function(r){return r.badgeKey;}));
    // Warm shared data before a selection. No service/GPS activation.
    prepareNativeServicePreviewData().catch(function(){});
  }).catch(function(err){
    nativeServicesRetryAt=Date.now()+3000;
    if(ws===telemetryWs&&ws.readyState===1&&generation===nativeGameModeGeneration&&window.GAME2_MANAGER.nativeGameMode&&window.GAME2_MANAGER.nativeGameMode.mode==='bus'){
      try{ws.send(JSON.stringify({type:'nativeServicesCatalog',protocol:3,generation:generation,categories:[{key:'all',label:'Tout'},{key:'urban',label:'Urbaines'}],routes:[]}));}catch(_){}
    }
    console.warn('[Service ETS2] Catalogue indisponible, nouvelle tentative automatique',err);
  }).finally(function(){nativeServicesLoading=false;});
}
function receiveNativeServiceAction(m){
  if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration||!nativeGameModeApplied||normalizeGameMode(currentGameMode)!=='bus'||!Number.isInteger(m.id)||m.id<1||!Number.isInteger(m.session)||!Number.isInteger(m.catalog)||typeof m.lineUid!=='string'||typeof m.routeUid!=='string')return false;
  var key=[m.generation,m.session,m.catalog,m.id].join(':'),promise=nativeServiceActions.get(key);
  if(!promise){
    // Store the promise before touching the service. Duplicate UDP/WS delivery
    // must never restart boarding or cancel/recreate the same service.
    promise=Promise.resolve().then(function(){
      if(m.generation!==nativeGameModeGeneration)throw new Error('Le mode a changé.');
      return ensureServiceSelectionData();
    }).then(function(){
      if(m.generation!==nativeGameModeGeneration||normalizeGameMode(currentGameMode)!=='bus')throw new Error('Le mode a changé.');
      var line=(dbusLines||[]).find(function(l){return String(l.uid)===m.lineUid;}),route=line&&(line.routes||[]).find(function(r){return String(r.uid)===m.routeUid;});
      if(!route)throw new Error('Ce service ne figure plus dans le catalogue.');
      var result=activateSaeivRouteSelection(line,route,{});
      if(!result||!result.ok)throw new Error(result&&result.error||'Service indisponible.');
      nativeServicePendingSound=null; // Selection itself owns the single chime.
      return {ok:true};
    }).catch(function(err){return {ok:false,error:String(err&&err.message||err)};});
    nativeServiceActions.set(key,promise);
    if(nativeServiceActions.size>128)nativeServiceActions.delete(nativeServiceActions.keys().next().value);
  }
  promise.then(function(result){if(telemetryWs&&telemetryWs.readyState===1&&m.generation===nativeGameModeGeneration)telemetryWs.send(JSON.stringify(Object.assign({type:'nativeServiceResult',protocol:3,generation:m.generation,session:m.session,catalog:m.catalog,id:m.id},result)));});
  return true;
}

// XML metadata shared with map.html, including per-route overrides.
function nativeServiceStyle(line,route,number){
 var candidates=typeof collectLineStyleCandidates==='function'?collectLineStyleCandidates(line,route,{}):[number],entry=(route&&route.lineStyle)||(line&&line.lineStyle)||null;
 if(typeof findLineStyleEntryForRuntimeCandidate==='function')for(var i=0;i<candidates.length&&!entry;i++){var found=findLineStyleEntryForRuntimeCandidate(candidates[i]);if(found)entry=found.entry;}
 var n=String(number||''),all=n+' '+String(line&&line.number||'')+' '+String(route&&route.name||''),night=/^N\d+$/i.test(n);
 var hex=function(c,d){c=String(c||'');if(/^#[0-9a-f]{3}$/i.test(c))c='#'+c.slice(1).split('').map(function(x){return x+x;}).join('');return /^#[0-9a-f]{6}$/i.test(c)?c:d;};
 // Match map.html renderLineItem/appendRouteLogo, including network logos.
 var parsed=typeof parseRouteName==='function'?String(parseRouteName(route&&route.name).lineNumber||'').trim():'',label=n;
 var raw=String(line&&line.number||n),badgeNumber=parsed||n;
 var special=/^(RER|M[ée]tro)(?:\s*[-–—]\s*|\s+)(.+)$/i.exec(badgeNumber)||/^(RER|M[ée]tro)(?:\s*[-–—]\s*|\s+)(.+)$/i.exec(raw)||/^(RER|M[ée]tro)(?:\s*[-–—]\s*|\s+)(.+)$/i.exec(n);
 var logos=[],kind='bus',stripe='';
 if(special){kind=/^rer$/i.test(special[1])?'rer':'metro';label=special[2].trim();logos=['bus_logo_idfm.png',kind==='metro'?'o_metro.png':'rer_logo_idfm.png'];
  if(!entry&&typeof findLineStyleEntryForRuntimeCandidate==='function'){var exact=findLineStyleEntryForRuntimeCandidate((kind==='rer'?'RER ':'Métro ')+label);if(exact)entry=exact.entry;}}
 else if(/^express\b/i.test(parsed))label=parsed;
 else if(/^titus\s*\d+/i.test(badgeNumber)||/^titus\s*\d+/i.test(n)||/^titus\s*\d+/i.test(raw)){var titus=/^titus\s*(\d+)/i.exec(badgeNumber)||/^titus\s*(\d+)/i.exec(n)||/^titus\s*(\d+)/i.exec(raw);label=titus[1];logos=['reseau_titus.png'];}
 else if(night)stripe=hex(entry&&entry[0],'#080080');
 var badgeKey=/navette\s+(?:de\s+)?nogent/i.test(all)?'navette_nogent.png':/^scolaire\b/i.test(raw)?'bus_school.png':'';
 if(entry && entry.badgeImage){badgeKey=entry.badge===false?entry.badgeImage:'';logos=entry.badge===false?[]:[entry.badgeImage];}
 else if(typeof line.badgeImage==='string'&&line.badgeImage){badgeKey=line.badge===false?line.badgeImage:'';logos=line.badge===false?[]:[line.badgeImage];}
 var bg=night?'#080080':hex(entry&&entry[0],'#3a3a3a'),fg=night?'#ffffff':hex(entry&&entry[1],'#ffffff');
 var spec=badgeKey?['',bg,fg,'image',[badgeKey],'']:[label,bg,fg,kind,logos,stripe];
 if(route&&route.partiel===true)spec.push(true);
 return {label:label,background:bg,foreground:fg,stripe:stripe,badgeKey:badgeKey&&spec.length===6?badgeKey:'webbadge:'+JSON.stringify(spec)};
}
// Offscreen browser raster -> native button pixels. Logos are the site's actual
// PNG files, alongside the same rounded/circular line chip and Noctilien stripe.
function nativeServicePartialSlash(ctx,x,y,w,h,fg,label,textY){
 // Agora reference: ressources/test/index.html, agoraPartialGap. Project the
 // padded glyph mask onto the diagonal and leave ONE gap with straight ends.
 // Only the partial-service mark changes: keep the normal font and colours.
 var d={x:-12*w/211,y:136*h/128,dx:235*w/211,dy:-144*h/128,width:16*h/128};
 var length=Math.hypot(d.dx,d.dy),ux=d.dx/length,uy=d.dy/length;
 var first=length*.3,last=length*.7;
 if(label){
  var scale=4,mask=document.createElement('canvas');mask.width=Math.ceil(w*scale);mask.height=Math.ceil(h*scale);
  var c=mask.getContext('2d',{willReadFrequently:true});c.scale(scale,scale);c.font=ctx.font;c.textAlign='center';c.textBaseline='middle';
  c.fillStyle=c.strokeStyle='#fff';c.lineJoin='round';c.lineWidth=12*h/128;
  c.strokeText(label,w/2,textY-y);c.fillText(label,w/2,textY-y);
  var pixels=c.getImageData(0,0,mask.width,mask.height).data;first=length;last=0;
  for(var row=0;row<mask.height;row++)for(var col=0;col<mask.width;col++){
   if(!pixels[4*(row*mask.width+col)+3])continue;
   var px=(col+.5)/scale-d.x,py=(row+.5)/scale-d.y;
   if(Math.abs(-uy*px+ux*py)>d.width/2+.125)continue;
   var along=ux*px+uy*py;first=Math.min(first,along-.125);last=Math.max(last,along+.125);
  }
 }
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 ctx.strokeStyle=fg;ctx.lineWidth=d.width;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(x+d.x,y+d.y);
 if(last>first){ctx.lineTo(x+d.x+ux*Math.max(0,first),y+d.y+uy*Math.max(0,first));ctx.moveTo(x+d.x+ux*Math.min(length,last),y+d.y+uy*Math.min(length,last));}
 ctx.lineTo(x+d.x+d.dx,y+d.y+d.dy);ctx.stroke();ctx.restore();
}
function nativeServiceDrawBadge(ctx,spec,images){
 var label=String(spec[0]||''),bg=spec[1],fg=spec[2],kind=spec[3],logos=spec[4]||[],stripe=spec[5]||'';
 var x=0,y=0,w=72,h=32,r=8;
 if(kind==='image'){
  var img=images[0],scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
  ctx.drawImage(img,(w-iw)/2,(h-ih)/2,iw,ih);
  if(spec[6])nativeServicePartialSlash(ctx,(w-iw)/2,(h-ih)/2,iw,ih,fg,'',h/2);return;
 }
 if(kind==='metro'||kind==='rer'){x=46;y=3;w=h=26;r=kind==='metro'?13:5;}
 else if(logos.length){x=34;w=38;}
 (images||[]).forEach(function(img,i){var box=logos.length===2?20:30,scale=Math.min(box/img.naturalWidth,28/img.naturalHeight),iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;ctx.drawImage(img,i*23+(box-iw)/2,(32-ih)/2,iw,ih);});
 ctx.fillStyle=bg;ctx.beginPath();
 ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
 ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
 ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();
 if(stripe){ctx.save();ctx.clip();ctx.fillStyle=stripe;ctx.fillRect(x,y+h-6,w,6);ctx.restore();}
 var size=Math.max(8,Math.min(Math.floor(h*.62),Math.floor((w-10)/(Math.max(1,label.length)*.62))));
 if(kind==='metro'||kind==='rer')size*=1.15;
 ctx.font='700 '+size+'px sans-serif';while(size>8&&ctx.measureText(label).width>w-8)ctx.font='700 '+(--size)+'px sans-serif';
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=fg;
 var shadowScale=Math.abs(ctx.getTransform().a)||1;ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=2*shadowScale;ctx.shadowOffsetY=shadowScale;
 ctx.fillText(label,x+w/2,y+h/2);ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 if(spec[6]){ctx.save();ctx.clip();nativeServicePartialSlash(ctx,x,y,w,h-(stripe?6:0),fg,label,y+h/2);ctx.restore();}
}
function nativeServiceCanvasPixels(canvas){
 var bytes=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data,binary='';
 for(var i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary);
}
// Prepare pixels before Service opens. This performs no bridge send or mission
// activation; visible-page requests later reuse the completed browser cache.
var nativeServiceWarmSource=null,nativeServiceWarmPromise=null;
function warmNativeServiceBadges(){
 if(nativeServiceWarmPromise)return nativeServiceWarmPromise;
 nativeServiceWarmPromise=Promise.resolve(ensureDbusDataLoaded()).then(function(){
  if(nativeServiceWarmSource===dbusLines)return;
  nativeServiceWarmSource=dbusLines;var keys=new Set();
  (dbusLines||[]).forEach(function(line){(line.routes||[]).forEach(function(route){keys.add(nativeServiceStyle(line,route,getLineNumber(line,route)).badgeKey);});});
  return Promise.all(Array.from(keys).filter(Boolean).map(nativeServiceImagePixels));
 }).finally(function(){nativeServiceWarmPromise=null;});return nativeServiceWarmPromise;
}
if(typeof window.setTimeout==='function')window.setTimeout(function(){warmNativeServiceBadges().catch(function(){});},0);
var nativeServiceBadgeCache=new Map(),nativeServiceLogoCache=new Map(),nativeServiceBadgeKeys=new Set(),nativeServiceBadgePending=new Set();
function nativeServiceLoadLogo(key){
 if(nativeServiceLogoCache.has(key))return nativeServiceLogoCache.get(key);
 // Network logos are shared artwork, independent of the Dev route data.
 // Custom badge URLs and map-specific overlays retain their normal lookup.
 var shared=['reseau_titus.png','navette_nogent.png','bus_school.png','bus_logo_idfm.png','o_metro.png','rer_logo_idfm.png'];
 var p=Promise.resolve().then(function(){
  var source=shared.indexOf(key)>=0?'images/service-badges/'+key:
   /\.(png|jpe?g|webp|svg)(?:[?#]|$)/i.test(key)&&/[/:]/.test(key)?key:gameMapFilePathForVersion(GAME_DEV_MAP_LAYER_VERSION,'Overlays/'+key);
  return new Promise(function(resolve,reject){var image=new Image(),timer=setTimeout(function(){image.src='';reject(new Error('Image indisponible'));},6000);
   image.crossOrigin='anonymous';image.onerror=function(){clearTimeout(timer);reject(new Error('Image indisponible'));};
   image.onload=function(){clearTimeout(timer);resolve(image);};image.src=new URL(source,location.href).href;
  });
 }).catch(function(err){nativeServiceLogoCache.delete(key);throw err;});nativeServiceLogoCache.set(key,p);return p;
}
function nativeServiceImagePixels(key){
 if(nativeServiceBadgeCache.has(key))return nativeServiceBadgeCache.get(key);
 var spec=key.indexOf('webbadge:')===0?JSON.parse(key.slice(9)):null;
 var p=Promise.all((spec?spec[4]||[]:[key]).map(nativeServiceLoadLogo)).then(function(images){
  var partial=!!(spec&&spec[6]),scale=partial?4:1;
  var canvas=document.createElement('canvas');canvas.width=72*scale;canvas.height=32*scale;var ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.scale(scale,scale);
  if(spec)nativeServiceDrawBadge(ctx,spec,images);
  else{var img=images[0],scale=Math.min(72/img.naturalWidth,32/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,(72-w)/2,(32-h)/2,w,h);}
  if(partial){
   // Supersample the Agora diagonal, then retain 2x pixels through bridge/DLL.
   // Logical badge geometry stays 72x32. Never enlarge the low-resolution result.
   var reduced=document.createElement('canvas');reduced.width=144;reduced.height=64;
   var rc=reduced.getContext('2d',{willReadFrequently:true});rc.imageSmoothingEnabled=true;rc.imageSmoothingQuality='high';rc.drawImage(canvas,0,0,144,64);canvas=reduced;
  }
  return nativeServiceCanvasPixels(canvas);
 }).catch(function(){nativeServiceBadgeCache.delete(key);return null;});nativeServiceBadgeCache.set(key,p);return p;
}
function receiveNativeServiceBadgeRequest(m){
 if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration||!Array.isArray(m.keys)||m.keys.length>16)return false;
 var ws=telemetryWs,generation=m.generation;
 m.keys.forEach(function(key){var token=generation+':'+key;if(!nativeServiceBadgeKeys.has(key)||nativeServiceBadgePending.has(token))return;
  nativeServiceBadgePending.add(token);nativeServiceImagePixels(key).then(function(pixels){
   if(pixels&&telemetryWs===ws&&ws.readyState===1&&generation===nativeGameModeGeneration)ws.send(JSON.stringify({type:'nativeServiceBadge',protocol:3,generation:generation,key:key,pixels:pixels}));
  }).finally(function(){nativeServiceBadgePending.delete(token);});
 });return true;
}
// Every game map, including IDF, uses ETS2's private native route provider.
// HTML supplies ordered destinations only; native GPS owns snapping, routing
// and road curves. Physical stop pins remain separate from passage overrides.
var nativeServicePreviews=new Map(),nativeServiceLatestPreview='',nativeServicePreviewSource=null;
var nativeServicePreviewStops=null,nativeServicePreviewPassages=null;
function prepareNativeServicePreviewData(){
 return Promise.resolve(ensureDbusDataLoaded());
}
function receiveNativeServicePreviewRequest(m){
 if(!m||m.protocol!==3||m.generation!==nativeGameModeGeneration||!nativeGameModeApplied||normalizeGameMode(currentGameMode)!=='bus'||!Number.isInteger(m.row)||m.row<1||!Number.isInteger(m.query)||typeof m.lineUid!=='string'||typeof m.routeUid!=='string')return false;
 var stopSource=typeof dbusStopsById==='undefined'?null:dbusStopsById;
 var passageSource=typeof dbusGpsPointsById==='undefined'?null:dbusGpsPointsById;
 if(nativeServicePreviewSource!==dbusLines||nativeServicePreviewStops!==stopSource||nativeServicePreviewPassages!==passageSource){
  nativeServicePreviews.clear();nativeServicePreviewSource=dbusLines;nativeServicePreviewStops=stopSource;nativeServicePreviewPassages=passageSource;
 }
 var key=[m.generation,m.session,m.catalog,m.query,m.row].join(':'),cacheKey=JSON.stringify([m.generation,m.catalog,m.lineUid,m.routeUid]),promise=nativeServicePreviews.get(cacheKey);nativeServiceLatestPreview=key;
 if(!promise){promise=prepareNativeServicePreviewData().then(function(){
  var line=(dbusLines||[]).find(function(l){return String(l.uid)===m.lineUid;}),route=line&&(line.routes||[]).find(function(r){return String(r.uid)===m.routeUid;});
  if(!route)return null;
  var entries=getRouteStopEntries(route);
  var actualStops=entries.map(function(e){return [Number(e.X),Number(e.Y),Number(e.Z)];});
  var waypoints=nativeServiceWaypoints(entries);
  if(waypoints.length<2||waypoints.length>512||waypoints.concat(actualStops).some(function(p){return !p.every(Number.isFinite);}))return null;
  return {points:waypoints,stops:actualStops,nativeRoute:true};
 }).catch(function(err){console.warn('[Service ETS2] Aperçu du trajet indisponible',err);return null;}).then(function(preview){if(!preview&&nativeServicePreviews.get(cacheKey)===promise)nativeServicePreviews.delete(cacheKey);return preview;});nativeServicePreviews.set(cacheKey,promise);
 if(nativeServicePreviews.size>32)nativeServicePreviews.delete(nativeServicePreviews.keys().next().value);}
 promise.then(function(preview){if(preview&&key===nativeServiceLatestPreview&&m.generation===nativeGameModeGeneration&&telemetryWs&&telemetryWs.readyState===1)telemetryWs.send(JSON.stringify({type:'nativeServicePreview',protocol:3,generation:m.generation,session:m.session,catalog:m.catalog,query:m.query,row:m.row,points:preview.points,stops:preview.stops,nativeRoute:preview.nativeRoute===true}));});
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
