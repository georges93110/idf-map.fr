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
function receiveNativeBusSettings(packet) {
  var state=nativeBusSettingsState;
  if(packet.protocol !== 1) return;
  if(packet.action === "request"){ if(Date.now()-(state.requestAt||0)>1000){state.requestAt=Date.now();nativeBusSettingsConnect();} return; }
  if(packet.action === "readOnly"){state.readOnly=true;return;}
  if(packet.action !== "current" || !Number.isInteger(packet.revision) || !Array.isArray(packet.values) || packet.values.length!==16) return;
  if(state.revision === packet.revision && state.current && JSON.stringify(state.current.values)===JSON.stringify(packet.values) && JSON.stringify(state.current.keys)===JSON.stringify(packet.keys)) return;
  state.revision=packet.revision;state.current=packet;applyNativeBusSettings(packet);
}
