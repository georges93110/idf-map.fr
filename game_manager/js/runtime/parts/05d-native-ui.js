// Experimental native menus remain paused. HUD1 reuses only the stock driving job_info panel.
// Keep the wire-off command for installations still running an older DLL.
var nativeUiMode = "widgets";
var nativeUiStatus = null, nativeUiStatusAt = 0;
var nativeUiDisabledSocket = null;
try {
  localStorage.setItem("idf_bus_interface_v1", "widgets");
  localStorage.removeItem("idf_bus_interface_pending_v1");
} catch (err) {}
function nativeUiIsActive() { return false; }
function syncNativeUiSettings() {
  var select=document.getElementById("overlayInterfaceMode");
  if(select){select.value="widgets";select.disabled=true;select.setAttribute("aria-disabled","true");}
  var status=document.getElementById("overlayInterfaceModeStatus");
  if(status){
    var fresh=nativeBusHudStatus&&Date.now()-nativeBusHudStatusAt<3000;
    var reason=fresh?nativeBusHudStatus.status:"backend_unavailable";
    var label=reason==="stock_widget_bound"?"Panneau de livraison ETS2 relié au service bus.":
      reason==="stock_widget_hidden"?"Panneau bus relié, mais le HUD est masqué dans ETS2.":
      reason==="stock_layout_mismatch"?"Disposition du panneau ETS2 incompatible : consulte le journal NativeBusHUD.":
      reason==="unsupported_build"?"DLL HUD1 : version du jeu ou fonctions natives incompatibles.":
      reason==="owned_by_other_tab"?"Le panneau ETS2 est utilisé par une autre fenêtre du site.":
      reason==="waiting_for_driving_hud"?"En attente du panneau de livraison en conduite.":
      reason==="stock"?"Panneau ETS2 standard ; sélectionne une ligne en mode Bus.":
      "En attente de la DLL HUD1 et du jeu.";
    if(nativeBusHudSendError)label="Envoi du panneau ETS2 impossible : "+nativeBusHudSendError;
    var message="Paramètres dans le HTML ; sélection également dans le menu Service d’ETS2. "+label+"";
    if(status.textContent!==message)status.textContent=message;
  }
}
function setNativeUiMode() { nativeUiMode="widgets";syncNativeUiSettings();syncNativeUi(true); }
function bindNativeUiSettings() { syncNativeUiSettings(); }
function receiveNativeUiPreference() { nativeUiMode="widgets";syncNativeUiSettings(); }
function receiveNativeUiStatus(message) { nativeUiStatus=message;nativeUiStatusAt=Date.now(); }
function receiveNativeUiAction() { return false; }
function syncNativeUi(force) {
  if(!telemetryWs||telemetryWs.readyState!==1)return false;
  if(nativeUiDisabledSocket===telemetryWs&&!force)return true;
  try {
    telemetryWs.send(JSON.stringify({type:"nativeUi",protocol:1,mode:"widgets",bus:false,ack:0,feedback:"",state:{selected:false,started:false,atStop:false,completed:false,line:"",route:"",stop:"",next:"",onboard:0,board:0,boardDone:0,alight:0,alightDone:0,distance:null}}));
    telemetryWs.send(JSON.stringify({type:"nativeUiPreference",protocol:1,action:"set",mode:"widgets",id:1}));
    nativeUiDisabledSocket=telemetryWs;return true;
  } catch(err){return false;}
}
window.setInterval(function(){syncNativeUi(false);},1500);

// HUD1: the existing ETS2 delivery panel. Route selection/service stay in HTML.
// No window or new on-screen widget is created by this channel.
var nativeBusHudStatus=null,nativeBusHudStatusAt=0,nativeBusHudLastSend=0;
var nativeBusHudLastPayload=null,nativeBusHudLastPayloadAt=0,nativeBusHudSocket=null;
var nativeBusHudSendError="";
var nativeBusHudDiagnostics={version:"HUD4",lastSentAt:0,enabled:false,error:"",status:null};
window.GAME2_MANAGER.nativeBusHud=nativeBusHudDiagnostics;
function receiveNativeBusHudStatus(m){nativeBusHudStatus=m;nativeBusHudStatusAt=Date.now();nativeBusHudDiagnostics.status=m;syncNativeUiSettings();}
function nativeBusHudText(value,max){
  var chars=Array.from(String(value==null?"":value).replace(/[\x00-\x1f|@<>]/g," ").replace(/\s+/g," ").trim());
  return chars.length<=max?chars.join(""):chars.slice(0,max-1).join("")+"…";
}
function buildNativeBusHudMessage(s){
  var count=function(v){return Math.max(0,Math.floor(Number(v)||0));};
  var enabled=normalizeGameMode(currentGameMode)==="bus"&&!!s.selected;
  var total=count(s.routeStopCount),index=Math.min(total,count(s.audioCurrentIndex)+1);
  var cap=s.busMaxCapacityUnlimited?"∞":String(count(s.busMaxCapacity));
  var names=Array.isArray(s.audioStopNames)?s.audioStopNames:[];
  var destination=names.length?names[names.length-1]:(s.routeName||"");
  var remaining=[];
  if(s.vehicleAtStop){
    var board=Math.max(0,count(s.stopBoardingTotal)-count(s.stopBoardingDone));
    var alight=Math.max(0,count(s.stopAlightingTotal)-count(s.stopAlightingDone));
    if(board)remaining.push("Montée : "+board);
    if(alight)remaining.push("Descente : "+alight);
  }
  if(!s.vehicleAtStop&&s.stopRequestAnnounced&&s.stopRequested)remaining.push("Arrêt demandé");
  var delay=Number(s.routeLiveDelayMinutes);
  var late=s.routeStarted&&Number.isFinite(delay)&&delay>0?Math.min(999,Math.ceil(delay)):0;
  var doors=s.busDoors||{};
  function indicator(value){
    if(!doors.available||typeof value!=="number"||!Number.isFinite(value))return 0;
    return value<=0.01?1:value>=0.99?3:2; // Unknown / closed / moving / open.
  }
  return {type:"nativeBusHud",protocol:2,enabled:enabled,atStop:s.vehicleAtStop===true,color:0,
    line:nativeBusHudText("Ligne "+String(s.lineNumber||"Bus"),22),
    destination:nativeBusHudText(destination,128),
    occupancy:nativeBusHudText(count(s.passengersInBus)+"/"+cap+" passagers",26),
    progress:total?index+"/"+total+" arrêts":"",
    stop:nativeBusHudText(s.stopName||s.startStopName||"Sélectionne une ligne",128),
    detail:nativeBusHudText(remaining.join(" · "),64),
    lateMinutes:late,doorFront:indicator(doors.entry),doorRear:indicator(doors.exit)};
}
function syncNativeBusHud(force,payload){
  var now=Date.now();
  if(payload){nativeBusHudLastPayload=payload;nativeBusHudLastPayloadAt=now;}
  if(!telemetryWs||telemetryWs.readyState!==1||telemetryWs.bufferedAmount>32768)return false;
  if(nativeBusHudSocket!==telemetryWs){nativeBusHudSocket=telemetryWs;force=true;}
  if(!force&&now-nativeBusHudLastSend<250)return false;
  try{
    var state=payload||nativeBusHudLastPayload;
    if(!state||now-nativeBusHudLastPayloadAt>2000){
      state=buildSaeivStatePayloadFromGame();nativeBusHudLastPayload=state;nativeBusHudLastPayloadAt=now;
    }
    syncNativeBusCompletion(state);
    var message=buildNativeBusHudMessage(state);
    telemetryWs.send(JSON.stringify(message));nativeBusHudLastSend=now;
    telemetryWs.send(JSON.stringify(buildNativeGirouetteMessage(state)));
    nativeBusHudDiagnostics.lastSentAt=now;nativeBusHudDiagnostics.enabled=message.enabled;
    nativeBusHudDiagnostics.error="";
    if(nativeBusHudSendError){nativeBusHudSendError="";syncNativeUiSettings();}
    return true;
  }catch(err){
    var reason=String(err&&err.message||err);
    if(nativeBusHudSendError!==reason)console.error("[NativeBusHUD] Envoi impossible",err);
    nativeBusHudSendError=reason;nativeBusHudDiagnostics.error=reason;
    syncNativeUiSettings();return false;
  }
}
window.setInterval(function(){syncNativeBusHud(false);},1000);

// COACH7: native desktop mode selection, separate from the disabled native
// mission-menu experiment. No widget preference or saved layout is erased.
var nativeGameModeGeneration="", nativeGameModeApplied=false;
try { nativeGameModeGeneration=localStorage.getItem("idf_native_mode_generation_v1")||""; } catch(err) {}
var nativeModeServiceObject=null,nativeModeServiceToken=0;
function nativeModeActiveServiceToken(){
  var state=typeof saeivRouteState==='undefined'?null:saeivRouteState;
  if(!state||!state.lineUid||!state.routeUid){nativeModeServiceObject=null;nativeModeServiceToken=0;return 0;}
  if(state!==nativeModeServiceObject){
    nativeModeServiceObject=state;
    // Distinguish two successive services on the same route, not only line UID.
    nativeModeServiceToken=(Math.floor(Math.random()*0xffffffff)>>>0)||1;
  }
  return nativeModeServiceToken;
}
var nativeModeStartupRetryAt=0;
function nativeModeRuntimeReady(){
  var runtime=window.GAME2_MANAGER&&window.GAME2_MANAGER.runtime;
  var ready=!!(runtime&&runtime.loadedAt&&!runtime.error&&
    typeof dbusLines!=='undefined'&&Array.isArray(dbusLines)&&dbusLines.length&&
    typeof dbusStopsById!=='undefined'&&dbusStopsById&&dbusStopsById.size&&
    typeof navGraph!=='undefined'&&navGraph);
  // Retry failed startup data loads even while Mode Camion is selected.
  // Existing loaders deduplicate their pending requests.
  if(!ready&&runtime&&runtime.loadedAt&&!runtime.error&&Date.now()-nativeModeStartupRetryAt>5000){
    nativeModeStartupRetryAt=Date.now();
    if(typeof ensureDbusDataLoaded==='function')ensureDbusDataLoaded().catch(function(){});
    if(typeof ensureNavGraphLoaded==='function')ensureNavGraphLoaded().catch(function(){});
  }
  return ready;
}
function receiveNativeGameMode(m){
  if(!m||m.protocol!==1||!Number.isSafeInteger(m.epoch)||m.epoch<=0||
     !Number.isInteger(m.revision)||m.revision<1||m.revision>0xffffffff||
     (m.mode!=="bus"&&m.mode!=="truck"))return false;
  var key=String(m.epoch)+":"+String(m.revision);
  if(nativeGameModeGeneration!==key||!nativeGameModeApplied){
    // A generation is accepted only after the clear and mode application
    // finish. If either throws, no ACK is sent and stale bus packets stay blocked.
    if(nativeGameModeGeneration!==key)clearSaeivRouteSelection();
    setGameMode(m.mode==="bus"?GAME_MODES.BUS:GAME_MODES.FREE,{clearRuntimeSession:false});
    nativeGameModeGeneration=key;nativeGameModeApplied=true;
    try { localStorage.setItem("idf_native_mode_generation_v1",key); } catch(err) {}
    window.GAME2_MANAGER.nativeGameMode={mode:m.mode,epoch:m.epoch,revision:m.revision};
  }
  if(telemetryWs&&telemetryWs.readyState===1){
    telemetryWs.send(JSON.stringify({type:"nativeGameModeAck",protocol:1,epoch:m.epoch,revision:m.revision,uiReady:nativeModeRuntimeReady(),serviceToken:m.mode==="bus"?nativeModeActiveServiceToken():0}));
    // ACK precedes GPS on the same socket, so generation authorization is
    // established before a restored/paused service submits its destination.
    syncNativeGpsDestination(false);
  }
  return true;
}

// COACH52: settlement belongs to the DLL. Repeated snapshots are idempotent.
var nativeCompletionToken=0,nativeCompletionId=0,nativeCompletionSequence=0;
function syncNativeBusCompletion(s){
  var mode=window.GAME2_MANAGER.nativeGameMode;
  if(!mode||mode.mode!=="bus"||!s||!s.selected||!telemetryWs||telemetryWs.readyState!==1)return false;
  var token=nativeModeActiveServiceToken();if(!token)return false;
  if(token!==nativeCompletionToken){nativeCompletionToken=token;nativeCompletionId=Math.max(Date.now(),nativeCompletionId+1);nativeCompletionSequence=0;}
  var stops=Array.isArray(saeivRouteState&&saeivRouteState.stops)?saeivRouteState.stops:[];
  if(stops.length<2)return false;
  var distance=0;
  for(var i=1;i<stops.length;i++){
    var a=stops[i-1].point,b=stops[i].point;
    if(a&&b&&[a.x,a.z,b.x,b.z].every(Number.isFinite))distance+=Math.hypot(b.x-a.x,b.z-a.z);
  }
  var limit=function(v,min,max){return Math.max(min,Math.min(max,Math.round(Number(v)||0)));};
  var names=Array.isArray(s.audioStopNames)?s.audioStopNames:[];
  var onTime=0,late=0,early=0,lateUnits=0;
  // Count only served stops with observed arrival times. Early arrivals are
  // displayed without reward; missing times remain unknown, never "early".
  if(typeof saeivStopServedLog!=="undefined"&&typeof saeivReachedStopDelayLog!=="undefined"){
    for(var si=0;si<stops.length;si++){
      if(saeivStopServedLog[si]!==true)continue;
      var minutes=saeivReachedStopDelayLog[si];
      if(typeof minutes!=="number"||!Number.isFinite(minutes))continue;
      if(minutes<0)early++;else if(minutes<=1)onTime++;else{late++;lateUnits+=Math.min(25,Math.ceil(minutes-1));}
    }
  }
  telemetryWs.send(JSON.stringify({type:"nativeBusCompletion",protocol:1,epoch:mode.epoch,revision:mode.revision,
    satisfactionBasisPoints:typeof s.passengerSatisfactionPercent==="number" && Number.isFinite(s.passengerSatisfactionPercent)?limit(s.passengerSatisfactionPercent*100,0,10000):undefined,
    scheduled:Number.isFinite(s.routeFinalDelayMinutes),onTimeStops:onTime,lateStops:late,earlyStops:early,lateUnits:lateUnits,
    token:token,service:nativeCompletionId,sequence:++nativeCompletionSequence,started:s.routeStarted===true,completed:s.routeCompleted===true,
    stops:stops.length,served:limit(s.routeServedStopsCount,0,stops.length),passengers:limit(s.routeTransportedPassengers,0,10000),
    elapsedSeconds:limit(Number(s.routeElapsedMs)/1000,0,172800),distanceMetres:limit(distance,0,1000000),
    delaySeconds:limit(Number(s.routeFinalDelayMinutes)*60,-172800,172800),
    line:nativeBusHudText(s.lineNumber||"Bus",64),origin:nativeBusHudText(names[0]||stops[0].name||"Départ",160),
    destination:nativeBusHudText(names[names.length-1]||stops[stops.length-1].name||s.routeName||"Terminus",160)}));
  return true;
}

// COACH63: active service or "Sans voyageur", same native TOBJ targets.
function buildNativeGirouetteMessage(s){
 var bus=normalizeGameMode(currentGameMode)==='bus';
 var selected=bus&&!!s.selected&&s.routeCompleted!==true&&!!saeivRouteState&&!!saeivRouteState.lineUid;
 var line=selected&&(dbusLines||[]).find(function(l){return String(l.uid)===String(saeivRouteState.lineUid);});
 var route=line&&(line.routes||[]).find(function(r){return String(r.uid)===String(saeivRouteState.routeUid);});
 var stops=route?getRouteStopEntries(route):[],last=stops[stops.length-1];
 var number=route?getLineNumber(line,route):'';
 var style=route?nativeServiceStyle(line,route,number):{};
 return {type:'nativeGirouette',protocol:1,generation:nativeGameModeGeneration,enabled:bus,
   line:route?(style.label||number):'',destination:route?(last?String(last.name||last.stop&&last.stop.name||''):String(s.routeName||'')):'Sans voyageur',
   badge:!!route&&line.badge!==false,partial:!!route&&route.partiel===true,stripe:style.stripe||'',
   background:style.background||'#000000',foreground:style.foreground||'#ffffff'};
}
