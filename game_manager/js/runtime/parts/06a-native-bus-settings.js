// One authoritative local bridge store shared by HTML and native controls.
var nativeBusSettingsState = { revision: 0, current: null, applying: false, readOnly: false, sent: "" };
var nativeBusSettingsScopes = ["idf_telemetry", "idf_telemetry_destination_announcement", "idf_telemetry_hide_ui", "idf_telemetry_zoom_gps"];
function nativeBusSettingsValues() {
  return [Math.round(globalAudioVolumePercent), +notificationSoundsEnabled,
    +saeivStopAnnouncementSoundsEnabled, +saeivPassengerValidationSoundsEnabled,
    Math.max(0, ["always", "solo", "convoy", "never"].indexOf(pccVoiceReceptionMode)),
    Math.min(200, Math.max(1, Math.round(saeivUnknownBusCapacityInputValue))), +saeivForceListedCapacityForAllBuses,
    +saeivUnknownBusCapacityUnlimited, +hideUiWhenManagerHidden, Math.round(telemetryOverlayAlphaPercent),
    Math.round(notificationScalePercent), +(saeivTimeSystem === "irl"), +showExperimentalWidgets,
    +showUnavailablePlayModes, +discordPresenceEnabled, Math.max(0,["menu", "bus", "free"].indexOf(defaultStartupMode))];
}
function nativeBusSettingsPayload(action) {
  return {type:"nativeBusSettings", protocol:1, action:action, revision:nativeBusSettingsState.revision,
    values:nativeBusSettingsValues(), keys:nativeBusSettingsScopes.map(getEffectiveShortcutForScope)};
}
function nativeBusSettingsConnect() {
  nativeBusSettingsState.readOnly = false;
  nativeBusSettingsState.sent = "";
  try { telemetryWs.send(JSON.stringify(nativeBusSettingsPayload("get"))); } catch(error) { console.warn("[Bus settings] Connection",error); }
}
function publishNativeBusSettings() {
  var state = nativeBusSettingsState;
  if (state.applying || state.readOnly || !state.revision || !telemetryWs || telemetryWs.readyState !== 1) return;
  var packet = nativeBusSettingsPayload("set"), signature = JSON.stringify([packet.values,packet.keys]);
  if (signature === state.sent) return;
  state.sent = signature;
  telemetryWs.send(JSON.stringify(packet));
}
function applyNativeBusSettings(packet) {
  var state = nativeBusSettingsState, v = packet.values;
  if (state.applying || !Array.isArray(v) || v.length !== 16) return;
  state.applying = true;
  try {
    var opts = {syncUi:true, syncState:false};
    if (typeof busSpatialAudio !== "undefined" && busSpatialAudio.telemetry && typeof packet.passengerEffectsEnabled === "boolean") {
      busSpatialAudio.telemetry.passengerEffectsEnabled = packet.passengerEffectsEnabled;
      if (typeof tickPassengerCabinAudio === "function") tickPassengerCabinAudio();
    }
    applyGlobalAudioVolumePercent(v[0]); applyNotificationSoundsEnabled(!!v[1],opts);
    applyStopAnnouncementSoundsEnabled(!!v[2],opts); applyPassengerValidationSoundsEnabled(!!v[3],opts);
    applyPccVoiceReceptionMode(["always","solo","convoy","never"][v[4]],opts);
    applyUnknownBusCapacityInputValue(v[5],opts);
    saeivUnknownBusCapacityUnlimited = !!v[7];
    applyForceListedCapacityForAllBuses(!!v[6],opts); syncBusCapacitySettingsUi();
    applyHideUiWhenManagerHidden(!!v[8],opts); applyTelemetryOverlayAlphaPercent(v[9]);
    applyNotificationScalePercent(v[10]); applySaeivTimeSystem(v[11] ? "irl" : "game",opts);
    applyShowExperimentalWidgets(!!v[12],opts); applyShowUnavailablePlayModes(!!v[13],opts);
    applyDiscordPresenceEnabled(!!v[14],{syncUi:true}); applyDefaultStartupMode(["menu","bus","free"][v[15]],opts);
    if (Array.isArray(packet.keys) && packet.keys.length === 4) packet.keys.forEach(function(key,i){
      setShortcutStateForScope(nativeBusSettingsScopes[i],key); updateShortcutUIForScope(nativeBusSettingsScopes[i],key);
    });
    state.sent = JSON.stringify([nativeBusSettingsValues(),nativeBusSettingsScopes.map(getEffectiveShortcutForScope)]);
    saveWidgetLayoutState(); syncSaeivExternalState(true);
  } finally { state.applying = false; }
}
function nativeBusAnnouncementAllowed(announcement) {
  if (!announcement || normalizeGameMode(currentGameMode)!=="bus" || managerState.visible || telemetryPaused || !telemetryConnected || !saeivStopAnnouncementSoundsEnabled) return false;
  var family=String(getSaeivGlobalAudioFolderNameForCurrentState()||"").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  return family === String(announcement.family).toLowerCase();
}
function publishNativeBusAnnouncementKeys() {
  var state=nativeBusSettingsState,now=Date.now();
  if(now-(state.hotkeysAt||0)<250||state.readOnly||!state.revision||!telemetryWs||telemetryWs.readyState!==1)return;
  state.hotkeysAt=now;var list=state.current&&state.current.announcements,indices=[];
  if(Array.isArray(list))list.forEach(function(a,i){if(a.key&&nativeBusAnnouncementAllowed(a))indices.push(i);});
  telemetryWs.send(JSON.stringify({type:"nativeBusSettings",protocol:1,action:"hotkeys",revision:state.revision,indices:indices,destinationEnabled:canPlaySaeivRouteAudio() && !!(saeivRouteState && saeivRouteState.selectedKey)}));
}
function handleBusAnnouncementKey(raw) {
  if (!raw || raw.phase!=="down" || raw.repeat) return false;
  var mods=(isRawShortcutModifierActive(raw,"ctrl")?1:0)|(isRawShortcutModifierActive(raw,"shift")?2:0)|(isRawShortcutModifierActive(raw,"alt")?4:0)|(isRawShortcutModifierActive(raw,"win")?8:0);
  var list=nativeBusSettingsState.current && nativeBusSettingsState.current.announcements;
  if (!Array.isArray(list)) return false;
  var a=list.find(function(item){return item.key && item.key.vk===Number(raw.vk) && item.key.mods===mods && nativeBusAnnouncementAllowed(item);});
  if (!a) return false;
  // Immutable catalogue path, not arbitrary HTML. Preserve the ordered audio
  // queue so a manual announcement cannot cut the line/terminus introduction.
  if (!/^sounds\/bus\/voix_bus\/global\/[^.][^\\]*\.mp3$/i.test(a.path) || a.path.split("/").indexOf("..")>=0) return false;
  stopBusAnnouncementPreview(true);
  var now=Date.now();if(now-(nativeBusSettingsState.lastSoundAt||0)<350)return true;
  nativeBusSettingsState.lastSoundAt=now;
  saeivRouteAudio.queue.push({clipName:a.label,globalUrl:a.path.split("/").map(encodeURIComponent).join("/")});
  processSaeivRouteAudioQueue();return true;
}
function receiveNativeBusSettings(packet) {
  var state=nativeBusSettingsState;
  if(packet.protocol !== 1) return;
  if(packet.action === "preview"){receiveBusAnnouncementPreview(packet);return;}
  if(packet.action === "request"){ if(Date.now()-(state.requestAt||0)>1000){state.requestAt=Date.now();nativeBusSettingsConnect();} return; }
  if(packet.action === "readOnly"){state.readOnly=true;return;}
  if(packet.action !== "current" || !Number.isInteger(packet.revision) || !Array.isArray(packet.values) || packet.values.length!==16) return;
  if(state.revision === packet.revision && state.current && state.current.passengerEffectsEnabled===packet.passengerEffectsEnabled && state.current.destinationAutomatic===packet.destinationAutomatic && state.current.saeivEnabled===packet.saeivEnabled && state.current && JSON.stringify(state.current.values)===JSON.stringify(packet.values) && JSON.stringify(state.current.keys)===JSON.stringify(packet.keys) && JSON.stringify(state.current.announcements)===JSON.stringify(packet.announcements)) return;
  state.revision=packet.revision;state.current=packet;applyNativeBusSettings(packet);
}

// Preview lease belongs to the currently open native settings page. Repeated
// heartbeats renew it without restarting a sound. Lost connection/page => stop.
var busAnnouncementPreview={epoch:0,command:-1,index:-1,audio:null,stamp:0,timer:null};
function reportBusAnnouncementPreview(playing) {
  var p=busAnnouncementPreview;
  if(telemetryWs&&telemetryWs.readyState===1)telemetryWs.send(JSON.stringify({type:"nativeBusSettings",protocol:1,action:"previewStatus",epoch:p.epoch,command:p.command,index:p.index,playing:!!playing}));
}
function stopBusAnnouncementPreview(report) {
  var p=busAnnouncementPreview,a=p.audio;p.audio=null;
  if(p.timer){clearInterval(p.timer);p.timer=null;}
  if(a){a.onended=a.onerror=null;a.pause();a.removeAttribute("src");}
  if(report)reportBusAnnouncementPreview(false);
}
function receiveBusAnnouncementPreview(packet) {
  var p=busAnnouncementPreview;
  if(!Number.isSafeInteger(packet.epoch)||!Number.isInteger(packet.command)||!Number.isInteger(packet.index))return;
  p.stamp=Date.now();
  if(p.epoch===packet.epoch&&p.command===packet.command&&p.index===packet.index)return;
  stopBusAnnouncementPreview(false);
  p.epoch=packet.epoch;p.command=packet.command;p.index=packet.index;
  var list=nativeBusSettingsState.current&&nativeBusSettingsState.current.announcements;
  var clip=Array.isArray(list)&&list[packet.index];
  if(!clip||!/^sounds\/bus\/voix_bus\/global\/[^.][^\\]*\.mp3$/i.test(clip.path)||clip.path.split("/").indexOf("..")>=0){reportBusAnnouncementPreview(false);return;}
  var audio=createBusSpatialAudio(clip.path.split("/").map(encodeURIComponent).join("/"),"previewAnnouncement");
  p.audio=audio;setBusAudioLevel(audio,1);
  function current(){return p.audio===audio;}
  audio.onended=audio.onerror=function(){if(current())stopBusAnnouncementPreview(true);};
  p.timer=setInterval(function(){if(Date.now()-p.stamp>1200||!telemetryWs||telemetryWs.readyState!==1)stopBusAnnouncementPreview(true);},100);
  Promise.resolve(audio.play()).then(function(){if(current())reportBusAnnouncementPreview(true);},function(){if(current())stopBusAnnouncementPreview(true);});
}
if(typeof window!=="undefined"&&window.addEventListener)window.addEventListener("pagehide",function(){stopBusAnnouncementPreview(true);});
