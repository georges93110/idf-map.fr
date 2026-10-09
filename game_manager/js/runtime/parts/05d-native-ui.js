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
    var message="Sélection et paramètres dans le HTML. "+label+" Les menus expérimentaux restent désactivés.";
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
    var message=buildNativeBusHudMessage(state);
    telemetryWs.send(JSON.stringify(message));nativeBusHudLastSend=now;
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
