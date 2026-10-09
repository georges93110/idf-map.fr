// Native presentation is paused by product decision. Widgets remain authoritative.
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
  if(status)status.textContent="Widgets HTML actifs. Le mode en jeu est temporairement désactivé.";
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
