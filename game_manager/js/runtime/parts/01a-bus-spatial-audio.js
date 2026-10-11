/* Shared bus audio: existing announcement/validator players, no extra widget.
   Coefficients are tunable acoustics, not a claim of physical wall simulation.
   Web Audio media -> low-pass -> gain -> stereo pan -> output. */
var nativeGameAudio = { seen:false, available:false, volume:0, muted:false, stamp:0 };
function updateNativeGameAudio(data) {
  if (!data || typeof data.audioMasterAvailable !== "boolean") return;
  var before = getGlobalAudioVolumeFactor();
  nativeGameAudio.seen=true; nativeGameAudio.stamp=Date.now();
  nativeGameAudio.available=data.audioMasterAvailable === true && Number.isFinite(data.audioMasterVolume) && data.audioMasterVolume >= 0 && data.audioMasterVolume <= 1;
  nativeGameAudio.volume=data.audioMasterVolume; nativeGameAudio.muted=data.audioMasterMuted === true;
  if (getGlobalAudioVolumeFactor() !== before) {
    if(typeof syncSaeivRuntimeAudioVolumes === "function") syncSaeivRuntimeAudioVolumes();
    if(typeof syncPccVoiceActiveAudioVolume === "function") syncPccVoiceActiveAudioVolume();
    if(typeof syncSaeivExternalState === "function") syncSaeivExternalState(true);
  }
}
var busSpatialAudio = { context: null, records: new WeakMap(), active: new Set(), telemetry: null, stamp: 0, seen: false, timer: null };
function resumeBusAudioContext() {
  var state = busSpatialAudio, context = state.context;
  if (!context || context.state === "running" || context.state === "closed") return;
  if (Date.now() - (state.resumeAt || 0) < 1000) return;
  state.resumeAt = Date.now();
  try { context.resume().catch(function (error) {
    if (!state.resumeWarned) console.warn("[Bus audio] Audio context resume failed", error);
    state.resumeWarned = true;
  }); } catch (error) { console.warn("[Bus audio] Audio context unavailable", error); }
}
function busSpatialMix(kind, data) {
  if (!data || !data.audioCameraAvailable || data.paused) return { gain: 0, cutoff: 650, pan: 0 };
  var inside = data.audioCameraInside === true;
  var source = inside && kind !== "validator" ? "audioAnnouncement" : "audioFrontDoor";
  var dx = data[source + "X"] - data.audioCameraX;
  var dy = data[source + "Y"] - data.audioCameraY;
  var dz = data[source + "Z"] - data.audioCameraZ;
  var distance = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(distance)) return { gain: 0, cutoff: 650, pan: 0 };
  var opening = Math.max(0, Math.min(1, Number(data.busEntryDoorPosition) || 0));
  // Continuous leakage while the door moves. Fully closed: 3.5%, low-pass.
  var leakage = inside ? 1 : .035 + .765 * Math.sqrt(opening);
  var reference = inside ? 2.5 : 2;
  var far = inside ? 24 : 35;
  var gain = leakage / (1 + Math.pow(Math.max(0, distance - reference) / (inside ? 9 : 7), 1.5));
  gain *= Math.max(0, Math.min(1, (far - distance) / 5));
  var right = dx * data.audioCameraRightX + dy * data.audioCameraRightY + dz * data.audioCameraRightZ;
  return { gain: gain, cutoff: inside ? 20000 : 650 + 17350 * opening, pan: Number.isFinite(right) ? Math.max(-.9, Math.min(.9, right / Math.max(1, distance))) : 0 };
}
function updateBusSpatialRecord(record) {
  var state = busSpatialAudio;
  // Keep ordinary playback for an older DLL. Once native support was seen,
  // stale/disconnected camera data must never keep sounding at full volume.
  var mix = state.seen ? busSpatialMix(record.kind, Date.now() - state.stamp < 1500 ? state.telemetry : null) : { gain: 1, cutoff: 20000, pan: 0 };
  if (record.gain) {
    var t = state.context.currentTime;
    record.gain.gain.setTargetAtTime(mix.gain, t, .075);
    record.filter.frequency.setTargetAtTime(mix.cutoff, t, .075);
    if (record.pan) record.pan.pan.setTargetAtTime(mix.pan, t, .075);
  } else record.audio.volume = Math.max(0, Math.min(1, record.base * mix.gain));
}
function updateBusSpatialAudioTelemetry(raw) {
  var data = raw && raw.data && typeof raw.data === "object" ? raw.data : raw;
  updateNativeGameAudio(data);
  if (!data || typeof data.audioCameraAvailable !== "boolean") return;
  var filtered = {};
  Object.keys(data).forEach(function (key) { if (/^audio/.test(key) || key === "paused" || key === "busEntryDoorPosition") filtered[key] = data[key]; });
  busSpatialAudio.stamp = Number.isFinite(data.audioCameraTimestamp) ? Math.min(Date.now(), data.audioCameraTimestamp) : Date.now();
  filtered.audioCameraTimestamp = busSpatialAudio.stamp;
  busSpatialAudio.telemetry = filtered; busSpatialAudio.seen = true;
  if (filtered.audioCameraAvailable && !filtered.paused) resumeBusAudioContext();
  busSpatialAudio.active.forEach(updateBusSpatialRecord);
}
function setBusAudioVolume(audio, volume) {
  if (!audio) return;
  volume = Math.max(0, Math.min(1, Number(volume) || 0));
  var record = busSpatialAudio.records.get(audio);
  if (!record) { audio.volume = volume; return; }
  record.base = volume;
  if (record.gain) audio.volume = volume;
  updateBusSpatialRecord(record);
}
function createBusSpatialAudio(url, kind) {
  var audio = new Audio(url), state = busSpatialAudio;
  var record = { audio: audio, kind: kind || "announcement", base: 1, gain: null, filter: null, pan: null };
  state.records.set(audio, record);
  // Cross-origin clips without CORS would become silent if routed through a
  // MediaElementAudioSourceNode. Keep their ordinary player with distance gain.
  var sameOrigin = false;
  try { sameOrigin = new URL(url, window.location.href).origin === window.location.origin; } catch (_) {}
  try {
    var Context = window.AudioContext || window.webkitAudioContext;
    if (sameOrigin && Context) {
      if (!state.context) state.context = new Context();
      var context = state.context;
      resumeBusAudioContext();
      // Capturing an element into a suspended context silences it even when
      // audio.play() resolves. Keep ordinary distance gain until Web Audio runs.
      if (context.state !== "running") throw new Error("context_not_running");
      record.filter = context.createBiquadFilter(); record.filter.type = "lowpass"; record.filter.Q.value = .707;
      record.gain = context.createGain(); record.gain.gain.value = state.seen ? 0 : 1;
      record.pan = context.createStereoPanner ? context.createStereoPanner() : null;
      record.filter.connect(record.gain);
      if (record.pan) { record.gain.connect(record.pan); record.pan.connect(context.destination); }
      else record.gain.connect(context.destination);
      var source = context.createMediaElementSource(audio);record.source = source;
      source.connect(record.filter);record.connected = true;
    }
  } catch (error) {
    if (record.source) {
      // A captured media element cannot be uncaptured. Restore an audible
      // path on graph failure; still apply the ordinary distance gain.
      record.source.disconnect(); record.source.connect(state.context.destination);
      record.direct = true; record.connected = true;
    }
    if (record.filter) record.filter.disconnect();
    if (record.gain) record.gain.disconnect();
    if (record.pan) record.pan.disconnect();
    if (error.message !== "context_not_running") console.warn("[Bus audio] Spatial filter unavailable", error);
    record.gain = null; record.filter = null; record.pan = null;
  }
  function start() {
    if (record.source && !record.connected) {
      if(record.direct) record.source.connect(state.context.destination);
      else { record.source.connect(record.filter);record.filter.connect(record.gain);
      if(record.pan){record.gain.connect(record.pan);record.pan.connect(state.context.destination);}
      else record.gain.connect(state.context.destination); }
      record.connected = true;
    }
    state.active.add(record); updateBusSpatialRecord(record);
    resumeBusAudioContext();
    if (!state.timer) state.timer = setInterval(function () { resumeBusAudioContext(); state.active.forEach(updateBusSpatialRecord); }, 100);
  }
  function stop() {
    state.active.delete(record);
    if(record.source && record.connected){record.source.disconnect();if(record.filter)record.filter.disconnect();if(record.gain)record.gain.disconnect();if(record.pan)record.pan.disconnect();record.connected=false;}
    if (!state.active.size && state.timer) { clearInterval(state.timer); state.timer = null; }
  }
  audio.addEventListener("play", start); audio.addEventListener("playing", start);
  ["pause", "ended", "error", "emptied"].forEach(function (event) { audio.addEventListener(event, stop); });
  updateBusSpatialRecord(record);
  return audio;
}
["pointerdown", "keydown"].forEach(function (event) {
  window.addEventListener(event, function () {
    var c = busSpatialAudio.context;
    if (!c) {
      var Context = window.AudioContext || window.webkitAudioContext;
      if (Context) { try { c = busSpatialAudio.context = new Context(); } catch (_) {} }
    }
    busSpatialAudio.resumeAt = 0; resumeBusAudioContext();
  }, { passive: true });
});
