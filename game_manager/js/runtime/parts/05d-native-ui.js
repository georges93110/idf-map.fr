// The page remains the authority for routes/service. Native controls issue
// acknowledged commands; changing presentation never starts a second mission.
var nativeUiMode = "widgets";
var nativeUiStatus = null, nativeUiStatusAt = 0;
var nativeUiAck = 0, nativeUiActionSession = 0, nativeUiPending = 0;
var nativeUiFeedback = "", nativeUiCatalogKey = "", nativeUiCatalogSentAt = 0;
var nativeUiCatalogLoading = null;
var nativeUiCatalogRevision = 0;
try { if (localStorage.getItem("idf_bus_interface_v1") === "ingame") nativeUiMode = "ingame"; } catch (err) {}
function nativeUiIsActive() {
  return nativeUiMode === "ingame" && normalizeGameMode(currentGameMode) === "bus" &&
    nativeUiStatus && nativeUiStatus.active === true && Date.now() - nativeUiStatusAt < 3000;
}
function syncNativeUiSettings() {
  var select = document.getElementById("overlayInterfaceMode"), status = document.getElementById("overlayInterfaceModeStatus");
  if (select) select.value = nativeUiMode;
  if (status) {
    var reason = nativeUiStatus && nativeUiStatus.status;
    status.textContent = nativeUiMode === "widgets" ? "Interfaces dans les widgets." : nativeUiIsActive() ? "Interface bus active dans ETS2. Ferme le gestionnaire avec son raccourci habituel pour cliquer dans le jeu." :
      normalizeGameMode(currentGameMode) !== "bus" ? "Sélectionne le mode Bus pour utiliser l’interface intégrée." :
      reason === "owned_by_other_tab" ? "Interface utilisée par une autre fenêtre du site. Les widgets restent disponibles." :
      reason === "unsupported_build" ? "Cette version d’ETS2 n’est pas prise en charge. Les widgets restent disponibles." :
      reason === "native_ui_unavailable" ? "Interface native indisponible dans cette DLL. Les widgets restent disponibles." :
      reason === "native_ui_parse_failed" || reason === "native_ui_layout_failed" || reason === "native_ui_manager_changed" ? "ETS2 n’a pas pu initialiser l’interface bus ("+reason+"). Les widgets restent disponibles." :
      "Connexion à l’interface ETS2… Les widgets restent disponibles jusqu’à son activation.";
  }
}
function setNativeUiMode(value) {
  nativeUiMode = value === "ingame" ? "ingame" : "widgets";
  nativeUiStatus = null; nativeUiStatusAt = 0; nativeUiCatalogSentAt = 0;
  try { localStorage.setItem("idf_bus_interface_v1", nativeUiMode); } catch (err) {}
  syncNativeUiSettings();syncNativeUi(true);
  if (typeof renderManager === "function") renderManager();
}
function buildNativeUiState() {
  var state = buildSaeivStatePayloadFromGame();
  var count = function(v) { return Math.min(100000,Math.max(0,Math.floor(Number(v)||0))); };
  var board = count(state.stopBoardingTotal || state.plannedStopBoardingTotal), alight = count(state.stopAlightingTotal || state.plannedStopAlightingTotal);
  var distance = state.distanceToDisplayStopM == null ? NaN : Number(state.distanceToDisplayStopM);
  return {selected:!!state.selected,started:!!state.routeStarted,atStop:!!state.vehicleAtStop,completed:!!state.routeCompleted,
    line:String(state.lineNumber||""),route:String(state.routeName||""),stop:String(state.stopName||""),next:String(state.nextStopName||""),
    distance:Number.isFinite(distance)&&distance>=0?Math.min(32000000,distance):null,
    onboard:count(state.passengersInBus),board:board,boardDone:Math.min(board,count(state.stopBoardingDone)),
    alight:alight,alightDone:Math.min(alight,count(state.stopAlightingDone))};
}
function syncNativeUi(force) {
  if(!telemetryWs||telemetryWs.readyState!==1)return false;
  var message={type:"nativeUi",protocol:1,mode:nativeUiMode,bus:normalizeGameMode(currentGameMode)==="bus",state:buildNativeUiState(),ack:nativeUiAck,feedback:nativeUiFeedback};
  var catalogue=null;
  if(nativeUiMode==="ingame") {
    var routes=listLineRouteCatalog(""),key=JSON.stringify(routes),now=Date.now();
    if(force||key!==nativeUiCatalogKey||now-nativeUiCatalogSentAt>5000){catalogue=routes;nativeUiCatalogKey=key;nativeUiCatalogSentAt=now;}
    if(!routes.length&&!nativeUiCatalogLoading){
      nativeUiCatalogLoading=Promise.all([ensureDbusDataLoaded(),ensureNavStopLinksLoaded().catch(function(){return new Map();})])
        .then(function(){nativeUiCatalogSentAt=0;}).catch(function(err){nativeUiFeedback=String(err&&err.message||"Catalogue indisponible").slice(0,180);})
        .finally(function(){nativeUiCatalogLoading=null;});
    }
  }
  try{
    telemetryWs.send(JSON.stringify(message));
    // The bridge's WebSocket has a 64 KiB limit. Keep large line catalogues
    // transactional and split into bounded messages instead of disconnecting.
    if(catalogue){nativeUiCatalogRevision=(nativeUiCatalogRevision+1)>>>0||1;
      for(var offset=0;offset<Math.max(1,catalogue.length);offset+=32)telemetryWs.send(JSON.stringify({type:"nativeUiCatalog",protocol:1,id:nativeUiCatalogRevision,total:catalogue.length,offset:offset,routes:catalogue.slice(offset,offset+32)}));
    }
    return true;
  }catch(err){nativeUiCatalogSentAt=0;return false;}
}
function receiveNativeUiStatus(message) {
  if(!message||message.protocol!==1)return;
  if (nativeUiActionSession!==message.session && message.session) {
    nativeUiActionSession=message.session;nativeUiAck=0;nativeUiPending=0;
    nativeUiCatalogSentAt=0;
  }
  var wasActive=nativeUiIsActive();
  nativeUiStatus=message;nativeUiStatusAt=Date.now();window.GAME2_MANAGER.nativeUiStatus=message;syncNativeUiSettings();
  if(wasActive!==nativeUiIsActive())renderManager();
}
function receiveNativeUiAction(message) {
  if(!message||message.protocol!==1||nativeUiMode!=="ingame"||normalizeGameMode(currentGameMode)!=="bus"||
    !Number.isInteger(message.id)||message.id<1||!Number.isInteger(message.session)||!nativeUiStatus||message.session!==nativeUiStatus.session)return;
  if(nativeUiActionSession!==message.session){nativeUiActionSession=message.session;nativeUiAck=0;nativeUiPending=0;}
  if(message.id<=nativeUiAck||nativeUiPending)return;
  if(["select","start","clear","widgets"].indexOf(message.cmd)<0)return;
  var id=message.id,session=message.session,mode=nativeUiMode;nativeUiPending=id;
  Promise.resolve().then(function(){
    if(nativeUiMode!==mode||nativeUiActionSession!==session)return {ok:false,error:"Action annulée."};
    if(message.cmd==="select")return Promise.all([ensureDbusDataLoaded(),ensureNavStopLinksLoaded().catch(function(){return new Map();})])
      .then(function(){if(nativeUiMode!==mode||nativeUiActionSession!==session)return {ok:false,error:"Action annulée."};
        return selectRouteByReferences(String(message.lineUid||""),String(message.routeUid||""),{uidOnly:true});});
    if(message.cmd==="start")return startSaeivSelectedRoute();
    if(message.cmd==="clear"){clearSaeivRouteSelection();return {ok:true};}
    nativeUiMode="widgets";try{localStorage.setItem("idf_bus_interface_v1","widgets");}catch(err){}return {ok:true};
  }).then(function(result){nativeUiFeedback=result&&result.ok?"":String(result&&result.error||"Action impossible").slice(0,180);})
    .catch(function(err){nativeUiFeedback=String(err&&err.message||"Action impossible").slice(0,180);})
    .finally(function(){if(nativeUiActionSession===session){nativeUiAck=id;nativeUiPending=0;syncNativeUi(true);syncNativeUiSettings();syncSaeivExternalState(true);}});
}
function bindNativeUiSettings() {
  var select=document.getElementById("overlayInterfaceMode");if(select)select.addEventListener("change",function(){setNativeUiMode(select.value);});
  syncNativeUiSettings();
}
var nativeUiWasActive=false;
window.setInterval(function(){syncNativeUi(false);syncNativeUiSettings();var active=!!nativeUiIsActive();if(active!==nativeUiWasActive){nativeUiWasActive=active;renderManager();}},750);
