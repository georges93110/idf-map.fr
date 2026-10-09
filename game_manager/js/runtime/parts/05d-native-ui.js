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
var nativeBusHudDiagnostics={version:"HUD1.1",lastSentAt:0,enabled:false,error:"",status:null};
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
  var service=s.busService||{},doors=s.busDoors||{},doorLabel="";
  // The telemetry provides two command channels; do not invent a third sensor.
  if(doors.available)doorLabel=" · P "+(doors.entry>=0.5?"O":"F")+"/"+(doors.exit>=0.5?"O":"F");
  var cap=s.busMaxCapacityUnlimited?"∞":String(count(s.busMaxCapacity));
  var occupancy=count(s.passengersInBus)+"/"+cap+doorLabel;
  var detail="",color=0;
  if(s.routeCompleted){detail="Service terminé";color=1;}
  else if(s.vehicleAtStop){
    var board=count(s.stopBoardingTotal),alight=count(s.stopAlightingTotal);
    detail="Montée "+Math.min(board,count(s.stopBoardingDone))+"/"+board+" · Desc. "+Math.min(alight,count(s.stopAlightingDone))+"/"+alight;
    color=service.ready||service.flowComplete?1:2;
  }else{
    var distance=Number(s.distanceToDisplayStopGpsM);
    if(!Number.isFinite(distance)||distance<0)distance=Number(s.distanceToDisplayStopM);
    var dist=Number.isFinite(distance)&&distance>=0?(distance<1000?Math.round(distance)+" m":(distance/1000).toFixed(1)+" km"):"";
    detail=(s.routeStarted&&s.refTime?"Horaire "+String(s.refTime):"Départ")+(dist?" · "+dist:"");
  }
  return {type:"nativeBusHud",protocol:1,enabled:enabled,color:color,
    line:nativeBusHudText("Ligne "+String(s.lineNumber||"Bus"),18),occupancy:nativeBusHudText(occupancy,22),
    progress:total?index+"/"+total:"",stop:nativeBusHudText(s.stopName||s.startStopName||"Sélectionne une ligne",34),detail:nativeBusHudText(detail,36)};
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
