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
var busSpatialAudio = { context: null, records: new WeakMap(), active: new Set(), telemetry: null, stamp: 0, seen: false, timer: null, pending: new Set() };
// Relative clip levels are distinct from the native master volume. A clip
// preloaded while mute/telemetry is unavailable must not retain a zero gain.
function setBusAudioLevel(audio, level) {
  if (!audio) return;
  var record = busSpatialAudio.records.get(audio);
  level = Math.max(0, Math.min(1, Number(level) || 0));
  if (!record) { audio.volume = level * getGlobalAudioVolumeFactor(); return; }
  record.followMaster = true; record.base = level; updateBusSpatialRecord(record);
}
function busAudioReady(record) {
  if (!record.followMaster) return true;
  var a = nativeGameAudio, s = busSpatialAudio;
  if (record.kind === "previewAnnouncement" || record.kind === "serviceSelection") return a.seen && a.available && Date.now()-a.stamp<2000;
  return a.seen && a.available && Date.now()-a.stamp < 2000 && s.seen &&
    Date.now()-s.stamp < 1500 && s.telemetry && s.telemetry.audioCameraAvailable && !s.telemetry.paused;
}
function reportBusAudio(record, event, error) {
  var s=busSpatialAudio, a=nativeGameAudio, now=Date.now();
  var status = error ? String(error.name || error.message || error).slice(0,80) :
    !a.available ? 'master-unavailable' : now-a.stamp>=2000 ? 'master-stale' :
    a.muted ? 'master-muted' : a.volume===0 ? 'master-zero' :
    !s.telemetry || !s.telemetry.audioCameraAvailable ? 'camera-unavailable' :
    s.telemetry.paused ? 'paused' : now-s.stamp>=1500 ? 'camera-stale' :
    record.source && s.context.state!=='running' ? 'context-'+s.context.state : 'ready';
  var signature=event+':'+status;
  if(record.lastReport===signature && now-record.reportAt<10000)return;
  // The diagnostics stay local in the existing bridge log; no clip URL or user data.
  if(typeof telemetryWs==='undefined'||!telemetryWs||telemetryWs.readyState!==1)return;
  record.lastReport=signature;record.reportAt=now;
  try { telemetryWs.send(JSON.stringify({type:'busAudioDiagnostic',event:event,status:status,
    kind:record.kind,context:s.context?s.context.state:'ordinary',
    master:a.volume,muted:a.muted,volume:record.audio.volume,
    time:record.audio.currentTime||0,readyState:record.audio.readyState||0,
    paused:record.audio.paused===true,networkState:record.audio.networkState||0,
    engine:record.audio.idfSource?'decoded':'media',visibility:typeof document==='object'?document.visibilityState:'unknown'})); } catch (_) {}
}
function tickBusAudio() {
  resumeBusAudioContext();
  busSpatialAudio.pending.forEach(function(r){if(r.tryPlay)r.tryPlay();});
  busSpatialAudio.active.forEach(function(r){updateBusSpatialRecord(r);reportBusAudio(r,r.audio.readyState>=2&&!r.audio.paused?'playing':'loading');});
  if (!busSpatialAudio.pending.size && !busSpatialAudio.active.size && busSpatialAudio.timer) {
    clearInterval(busSpatialAudio.timer);busSpatialAudio.timer=null;
  }
}
function ensureBusAudioTimer() {
  if(!busSpatialAudio.timer)busSpatialAudio.timer=setInterval(tickBusAudio,100);
}
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
  var mix = (record.kind === "previewAnnouncement" || record.kind === "serviceSelection") ? {gain:1,cutoff:20000,pan:0} : state.seen ? busSpatialMix(record.kind, Date.now() - state.stamp < 1500 ? state.telemetry : null) : { gain: 1, cutoff: 20000, pan: 0 };
  // COACH54: relative to COACH53: route speech x2, shortcut speech x0.75.
  // Stop-request chime, validator and notifications keep their own levels.
  var boost = record.kind === "routeAnnouncement" ? 4 : (record.kind === "shortcutAnnouncement" || record.kind === "previewAnnouncement") ? 1.5 : record.kind === "announcement" ? 2 : 1;
  var volume = record.base * (record.followMaster ? getGlobalAudioVolumeFactor() : 1);
  if (record.gain) {
    record.audio.volume = Math.max(0, Math.min(1, volume));
    var t = state.context.currentTime;
    record.gain.gain.setTargetAtTime(mix.gain * boost, t, .075);
    record.filter.frequency.setTargetAtTime(mix.cutoff, t, .075);
    if (record.pan) record.pan.pan.setTargetAtTime(mix.pan, t, .075);
  } else record.audio.volume = Math.max(0, Math.min(1, volume * mix.gain * boost));
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
  tickBusAudio();
  if(typeof publishNativeBusAnnouncementKeys === "function")publishNativeBusAnnouncementKeys();
  if(typeof saeivRouteAudio!=="undefined"&&saeivRouteAudio.queue.length&&typeof processSaeivRouteAudioQueue==="function")processSaeivRouteAudioQueue();
}
function setBusAudioVolume(audio, volume) {
  if (!audio) return;
  volume = Math.max(0, Math.min(1, Number(volume) || 0));
  var record = busSpatialAudio.records.get(audio);
  if (!record) { audio.volume = volume; return; }
  record.followMaster = false; record.base = volume;
  if (record.gain) audio.volume = volume;
  updateBusSpatialRecord(record);
}
// Bus clips use explicit fetch/decode, so a hidden WebView never waits for
// HTMLMediaElement's first visible frame before loading its first sound.
var busDecodedClips = new Map();
var busDecodedBytes = 0;
function fetchBusDecodedClip(url, context) {
  var existing = busDecodedClips.get(url);
  if (existing) { busDecodedClips.delete(url); busDecodedClips.set(url, existing); return existing.promise; }
  var controller = new AbortController();
  var entry = { bytes: 0, pending: true }, timeout;
  var limited = new Promise(function (_, reject) {
    timeout = setTimeout(function () {
      controller.abort(); var e = new Error('Bus audio loading timed out'); e.name = 'AudioLoadTimeout'; reject(e);
    }, 12000);
  });
  var request = fetch(url, { signal: controller.signal, credentials: 'same-origin' }).then(function (response) {
    if (!response.ok) throw new Error('Audio HTTP ' + response.status);
    if (Number(response.headers.get('content-length')) > 8 * 1024 * 1024) throw new Error('Audio file too large');
    return response.arrayBuffer();
  }).then(function (bytes) {
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('Audio file too large');
    return context.decodeAudioData(bytes);
  });
  entry.promise = Promise.race([request, limited]).then(function (buffer) {
    clearTimeout(timeout); entry.pending = false;
    if (!Number.isFinite(buffer.duration) || buffer.duration > 180) throw new Error('Audio duration invalid');
    entry.bytes = buffer.length * buffer.numberOfChannels * 4;
    busDecodedBytes += entry.bytes;
    // Only cache bounded decoded data. Players retain their own current clip.
    busDecodedClips.forEach(function (v, key) {
      if (!v.pending && (busDecodedBytes > 16 * 1024 * 1024 || busDecodedClips.size > 32)) {
        busDecodedClips.delete(key); busDecodedBytes -= v.bytes;
      }
    });
    return buffer;
  }).catch(function (error) {
    clearTimeout(timeout); if (busDecodedClips.get(url) === entry) busDecodedClips.delete(url); throw error;
  });
  busDecodedClips.set(url, entry); return entry.promise;
}
function createDecodedBusAudio(url, context) {
  var audio = new EventTarget(), output = context.createGain();
  var src = url, buffer = null, loading = null, source = null;
  var offset = 0, startedAt = 0, paused = true, ended = false, volume = 1, muted = false;
  var generation = 0, playPromise = null, loadGeneration = 0, failure = null;
  audio.idfSource = output; audio.preload = 'auto';
  function emit(type) {
    var event = new Event(type); audio.dispatchEvent(event);
    if (typeof audio['on' + type] === 'function') audio['on' + type](event);
  }
  function position() { return source ? Math.min(buffer.duration, offset + Math.max(0, context.currentTime - startedAt)) : offset; }
  function stopSource() { if (source) { var old = source; source = null; old.onended = null; old.stop(); old.disconnect(); } }
  function aborted() { var e = new Error('Playback cancelled'); e.name = 'AbortError'; return e; }
  function load() {
    if (buffer) return Promise.resolve(buffer);
    if (loading) return loading;
    if (!src) return Promise.reject(new Error('Audio source cleared'));
    var token = loadGeneration; failure = null;
    loading = fetchBusDecodedClip(src, context).then(function (value) {
      if (token !== loadGeneration) throw aborted();
      buffer = value; loading = null; emit('loadedmetadata'); emit('canplay'); return buffer;
    }, function (error) { if (token === loadGeneration) loading = null; throw error; });
    return loading;
  }
  audio.load = function () { load().catch(function (error) {
    if (error.name === 'AbortError' || !src) return;
    failure = { code: 2, message: error.message }; emit('error');
  }); };
  audio.play = function () {
    if (playPromise) return playPromise;
    if (source && !paused) return Promise.resolve();
    var token = ++generation; if (ended) offset = 0; ended = false; paused = false; emit('play');
    playPromise = load().then(function () {
      if (token !== generation || paused) throw aborted();
      if (context.state === 'running') return;
      return new Promise(function (resolve, reject) {
        var timeout = setTimeout(function () { var e = new Error('Audio context resume timed out'); e.name = 'AudioContextUnavailable'; reject(e); }, 3000);
        Promise.resolve(context.resume()).then(function () { clearTimeout(timeout); resolve(); }, function (error) { clearTimeout(timeout); reject(error); });
      });
    }).then(function () {
      if (token !== generation || paused) throw aborted();
      if (context.state !== 'running') { var e = new Error('Audio context unavailable'); e.name = 'AudioContextUnavailable'; throw e; }
      offset = Math.min(offset, Math.max(0, buffer.duration - .001));
      var node = context.createBufferSource(); node.buffer = buffer; node.connect(output);
      source = node; startedAt = context.currentTime;
      node.onended = function () {
        if (source !== node || token !== generation) return;
        offset = buffer.duration; source = null; node.disconnect(); paused = true; ended = true; emit('ended');
      };
      node.start(0, offset); emit('playing');
    }).catch(function (error) {
      if (token === generation && error.name !== 'AbortError') {
        paused = true; failure = { code: error.name === 'AudioContextUnavailable' ? 1 : 2, message: error.message };
        emit('error');
      }
      throw error;
    }).finally(function () { if (token === generation) playPromise = null; });
    return playPromise;
  };
  audio.pause = function () {
    ++generation; playPromise = null; offset = position(); stopSource(); paused = true; emit('pause');
  };
  Object.defineProperties(audio, {
    paused: { get: function () { return paused; } }, ended: { get: function () { return ended; } },
    error: { get: function () { return failure; } }, readyState: { get: function () { return buffer ? 4 : 0; } },
    networkState: { get: function () { return loading ? 2 : buffer ? 1 : 0; } },
    duration: { get: function () { return buffer ? buffer.duration : NaN; } },
    currentSrc: { get: function () { return src; } },
    src: { get: function () { return src; }, set: function (value) {
      audio.pause(); ++loadGeneration; src = value ? new URL(value, window.location.href).href : '';
      buffer = loading = null; offset = 0; ended = false; failure = null; emit('emptied');
    } },
    currentTime: { get: position, set: function (value) {
      if (!Number.isFinite(value) || value < 0) return;
      var resume = !paused; audio.pause(); offset = value; ended = false;
      if (resume) audio.play().catch(function () {});
    } },
    volume: { get: function () { return volume; }, set: function (value) {
      volume = Math.max(0, Math.min(1, Number(value) || 0)); output.gain.value = muted ? 0 : volume;
    } },
    muted: { get: function () { return muted; }, set: function (value) { muted = !!value; output.gain.value = muted ? 0 : volume; } }
  });
  return audio;
}

function createBusSpatialAudio(url, kind) {
  var state = busSpatialAudio, audio;
  var Context = window.AudioContext || window.webkitAudioContext;
  var sameOrigin = false;
  try { url = new URL(url, window.location.href).href; sameOrigin = new URL(url).origin === window.location.origin; } catch (_) {}
  if (sameOrigin && Context && typeof fetch === "function" && typeof EventTarget === "function") {
    if (!state.context) state.context = new Context();
    audio = createDecodedBusAudio(url, state.context);
  } else audio = new Audio(url);
  var record = { audio: audio, kind: kind || "announcement", base: 1, gain: null, filter: null, pan: null };
  state.records.set(audio, record);
  // Cross-origin clips without CORS would become silent if routed through a
  // MediaElementAudioSourceNode. Keep their ordinary player with distance gain.
  try {
    var Context = window.AudioContext || window.webkitAudioContext;
    if (sameOrigin && Context) {
      if (!state.context) state.context = new Context();
      var context = state.context;
      resumeBusAudioContext();
      // Capturing an element into a suspended context silences it even when
      // audio.play() resolves. Keep ordinary distance gain until Web Audio runs.
      if (!audio.idfSource && context.state !== "running") throw new Error("context_not_running");
      record.filter = context.createBiquadFilter(); record.filter.type = "lowpass"; record.filter.Q.value = .707;
      record.gain = context.createGain(); record.gain.gain.value = state.seen ? 0 : 1;
      record.pan = context.createStereoPanner ? context.createStereoPanner() : null;
      record.filter.connect(record.gain);
      if (record.pan) { record.gain.connect(record.pan); record.pan.connect(context.destination); }
      else record.gain.connect(context.destination);
      var source = audio.idfSource || context.createMediaElementSource(audio);record.source = source;
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
  // A short clip must not finish silently before the first valid native sample.
  // Preserve normal play() promises; pause()/route cancellation cancels the wait.
  var playNative=audio.play.bind(audio), pauseNative=audio.pause.bind(audio);
  audio.play=function(){
    if(record.pendingPlay)return record.pendingPlay;
    var resolvePlay,rejectPlay;
    var result=new Promise(function(resolve,reject){resolvePlay=resolve;rejectPlay=reject;});
    record.pendingPlay=result;record.playDeadline=Date.now()+8000;
    function clear(){state.pending.delete(record);record.tryPlay=null;record.pendingPlay=null;record.cancelPlay=null;}
    record.cancelPlay=function(){clear();var e=new Error('Playback cancelled');e.name='AbortError';rejectPlay(e);};
    record.tryPlay=function(){
      if(!busAudioReady(record)){
        reportBusAudio(record,'waiting');
        if(Date.now()<record.playDeadline)return;
        clear();var e=new Error('Native audio data unavailable');e.name='AudioDataTimeout';
        reportBusAudio(record,'failed',e);rejectPlay(e);return;
      }
      clear();updateBusSpatialRecord(record);resumeBusAudioContext();
      try { Promise.resolve(playNative()).then(resolvePlay,function(e){reportBusAudio(record,'failed',e);rejectPlay(e);}); }
      catch(e){reportBusAudio(record,'failed',e);rejectPlay(e);}
    };
    state.pending.add(record);ensureBusAudioTimer();record.tryPlay();return result;
  };
  audio.pause=function(){if(record.cancelPlay)record.cancelPlay();return pauseNative();};
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
    ensureBusAudioTimer();reportBusAudio(record,"started");
  }
  function stop(event) {
    // Media events are queued: an old pause/emptied must not disconnect a
    // newer play() that already resumed the same preloaded element.
    if(event && event.type!=="error" && audio.paused===false && !audio.ended)return;
    if(event && event.type==="error")reportBusAudio(record,"failed",audio.error||new Error("media-error"));
    state.active.delete(record);
    if(record.source && record.connected){record.source.disconnect();if(record.filter)record.filter.disconnect();if(record.gain)record.gain.disconnect();if(record.pan)record.pan.disconnect();record.connected=false;}
    if (!state.active.size && !state.pending.size && state.timer) { clearInterval(state.timer); state.timer = null; }
  }
  audio.addEventListener("play", start); audio.addEventListener("playing", start);
  ["pause", "ended", "error", "emptied"].forEach(function (event) { audio.addEventListener(event, stop); });
  updateBusSpatialRecord(record);
  if(typeof attachConvoyBusAudio === 'function')attachConvoyBusAudio(audio,record);
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
