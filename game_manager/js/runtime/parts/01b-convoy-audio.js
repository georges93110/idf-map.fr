// Nearby Convoy doors use a bounded pneumatic effect. Original vehicle-bank
// sounds are not replaced. Playback belongs to one page selected by the bridge.
var convoyDoorAudio = { voices: new Map(), seen: new Map(), noise: null, timer: null };
function convoyDoorMix(pose, data, fresh) {
  if (!fresh || !pose || !data || data.paused || !data.audioCameraAvailable) return { gain: 0, pan: 0 };
  var dx = pose.x - data.audioCameraX, dy = pose.y - data.audioCameraY, dz = pose.z - data.audioCameraZ;
  var d = Math.hypot(dx, dy, dz);
  if (!Number.isFinite(d) || d >= 60) return { gain: 0, pan: 0 };
  var right = dx * data.audioCameraRightX + dy * data.audioCameraRightY + dz * data.audioCameraRightZ;
  return { gain: (data.audioCameraInside ? .55 : 1) * Math.min(1, (60 - d) / 10) / (1 + Math.pow(d / 8, 2)),
    pan: Number.isFinite(right) ? Math.max(-.95, Math.min(.95, right / Math.max(1, d))) : 0 };
}
function stopConvoyDoorVoice(key) {
  var v = convoyDoorAudio.voices.get(key); if (!v) return;
  convoyDoorAudio.voices.delete(key);
  if(v.source) { v.source.onended = null; try { v.source.stop(); } catch (_) {} }
  [v.source, v.filter, v.envelope, v.gain, v.pan].forEach(function (n) { if (n) n.disconnect(); });
  if (!convoyDoorAudio.voices.size && convoyDoorAudio.timer) { clearInterval(convoyDoorAudio.timer); convoyDoorAudio.timer = null; }
}
function tickConvoyDoorAudio() {
  var state = busSpatialAudio, now = Date.now();
  convoyDoorAudio.voices.forEach(function (v, key) {
    if (now >= v.until || now - state.stamp >= 1500 || !state.telemetry || state.telemetry.paused) { stopConvoyDoorVoice(key); return; }
    var mix = v.clip ? convoyBusClipMix(v.pose,v.doors,state.telemetry,now-state.stamp<1500) : convoyDoorMix(v.pose, state.telemetry, now - state.stamp < 1500);
    var master = nativeGameAudio.available && now - nativeGameAudio.stamp < 2000 ? getGlobalAudioVolumeFactor() : 0;
    v.gain.gain.setTargetAtTime(mix.gain * master * (v.level === undefined ? 1 : v.level), state.context.currentTime, .04);
    if(v.clip && v.filter)v.filter.frequency.setTargetAtTime(mix.cutoff,state.context.currentTime,.04);
    if (v.pan) v.pan.pan.setTargetAtTime(mix.pan, state.context.currentTime, .04);
  });
}
function receiveNativeConvoyAudio(m) {
  var s = convoyDoorAudio, now = Date.now();
  if (!m || m.type !== 'nativeConvoyAudio') return false;
  if (m.action === 'clear') { Array.from(s.voices.keys()).forEach(stopConvoyDoorVoice); s.seen.clear(); return true; }
  if (m.action === 'remove') { s.voices.forEach(function (v, k) { if (v.player === m.player) stopConvoyDoorVoice(k); }); return true; }
  if (!m.pose || !['x', 'y', 'z'].every(function (k) { return Number.isFinite(m.pose[k]) && Math.abs(m.pose[k]) <= 16000000; })) return false;
  if (m.action === 'position') { s.voices.forEach(function (v) { if (v.player === m.player) { v.pose = m.pose; v.doors=m.doors||v.doors; } }); return true; }
  if (m.action === 'clip') return receiveConvoyBusClip(m);
  if (m.action !== 'door' || !/^\d{17,20}$/.test(m.player) || typeof m.id !== 'string' || m.id.length > 128 ||
      ![0, 1].includes(m.door) || typeof m.opening !== 'boolean') return false;
  s.seen.forEach(function (at, id) { if (now - at > 6000) s.seen.delete(id); });
  var id = m.player + ':' + m.id; if (s.seen.has(id)) return false;
  if (s.seen.size >= 256) s.seen.delete(s.seen.keys().next().value);
  s.seen.set(id, now);
  var state = busSpatialAudio;
  var mix = convoyDoorMix(m.pose, state.telemetry, now - state.stamp < 1500);
  if (!mix.gain || !nativeGameAudio.available || now - nativeGameAudio.stamp >= 2000 || !getGlobalAudioVolumeFactor()) return false;
  var Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return false;
  var key = m.player + ':' + m.door;
  stopConvoyDoorVoice(key);
  if (s.voices.size >= 16) stopConvoyDoorVoice(s.voices.keys().next().value);
  try {
    var c = state.context || (state.context = new Context());
    // Do not replay an old door event after focus/autoplay restrictions end.
    if (c.state !== 'running') { resumeBusAudioContext(); return false; }
    if (!s.noise || s.noise.sampleRate !== c.sampleRate) {
      s.noise = c.createBuffer(1, Math.ceil(c.sampleRate * 1.6), c.sampleRate);
      var samples = s.noise.getChannelData(0), seed = 0x1df;
      for (var i = 0; i < samples.length; ++i) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; samples[i] = seed / 2147483648 - 1; }
    }
    var source = c.createBufferSource(), filter = c.createBiquadFilter(), envelope = c.createGain(), gain = c.createGain();
    var pan = c.createStereoPanner ? c.createStereoPanner() : null, duration = m.opening ? 1.4 : 1.1, t = c.currentTime;
    source.buffer = s.noise; filter.type = 'bandpass'; filter.Q.value = .65;
    filter.frequency.setValueAtTime(m.opening ? 1650 : 1100, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + duration);
    envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(.16, t + .04);
    envelope.gain.exponentialRampToValueAtTime(.035, t + duration * .75); envelope.gain.linearRampToValueAtTime(0, t + duration);
    gain.gain.value = mix.gain * getGlobalAudioVolumeFactor(); if (pan) pan.pan.value = mix.pan;
    source.connect(filter); filter.connect(envelope); envelope.connect(gain);
    if (pan) { gain.connect(pan); pan.connect(c.destination); } else gain.connect(c.destination);
    var voice = { source: source, filter: filter, envelope: envelope, gain: gain, pan: pan, pose: m.pose, player: m.player, until: now + 1700 };
    s.voices.set(key, voice); source.onended = function () { if (s.voices.get(key) === voice) stopConvoyDoorVoice(key); };
    source.start(); source.stop(t + duration);
    if (!s.timer) s.timer = setInterval(tickConvoyDoorAudio, 100);
    return true;
  } catch (_) { stopConvoyDoorVoice(key); return false; }
}


// Only the approved public asset catalogue crosses the Convoy boundary.
// Publish actual playback, not preloads, UI previews or a failed play().
var convoyClipPaths = null;
function convoyClipId(url) {
  if(typeof convoyClipCatalog !== 'object')return '';
  if(!convoyClipPaths) {
    convoyClipPaths=new Map();
    Object.keys(convoyClipCatalog).forEach(function(id){convoyClipPaths.set(convoyClipCatalog[id],id);});
  }
  try {
    var u=new URL(url,window.location.href),base=new URL('./',window.location.href);
    if(u.origin!==base.origin || u.search || u.hash || !u.pathname.startsWith(base.pathname))return '';
    return convoyClipPaths.get(decodeURIComponent(u.pathname.slice(base.pathname.length)))||'';
  }catch(_){return '';}
}
function attachConvoyBusAudio(audio,record) {
  if(!['routeAnnouncement','shortcutAnnouncement','announcement','validator'].includes(record.kind))return;
  var voice='';
  function send(a) {
    if(typeof telemetryWs==='undefined'||!telemetryWs||telemetryWs.readyState!==1)return false;
    try{telemetryWs.send(JSON.stringify({type:'nativeConvoyBusAudio',audio:a}));return true;}catch(_){return false;}
  }
  audio.addEventListener('playing',function(){
    if(voice || audio.paused || audio.ended)return;
    var clip=convoyClipId(audio.currentSrc||audio.src),duration=audio.duration,offset=audio.currentTime||0;
    if(!clip||!Number.isFinite(duration)||duration<=offset||duration>180)return;
    var id=window.crypto.randomUUID();
    if(send({action:'play',voice:id,clip:clip,category:record.kind,duration:duration,offset:offset,level:record.base}))voice=id;
  });
  ['pause','ended','error','emptied'].forEach(function(name){audio.addEventListener(name,function(){
    if(!voice || (name!=='error' && audio.paused===false && !audio.ended))return;
    send({action:'stop',voice:voice});voice='';
  });});
}
function convoyBusClipMix(pose,doors,data,fresh) {
  var mix=convoyDoorMix(pose,data,fresh);
  var open=Math.max(0,Math.min(1,Number((doors||[])[0])||0));
  mix.gain*=.035+.765*Math.sqrt(open);mix.cutoff=650+17350*open;
  return mix;
}
function receiveConvoyBusClip(m) {
  var s=convoyDoorAudio,a=m.audio,now=Date.now(),state=busSpatialAudio;
  if(!/^\d{17,20}$/.test(m.player)||typeof m.id!=='string'||m.id.length>256||!a||
      typeof a.voice!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(a.voice)||!['play','stop'].includes(a.action))return false;
  var key=m.player+':clip:'+a.voice;
  s.seen.forEach(function(at,id){if(now-at>6000)s.seen.delete(id);});
  var id=m.player+':'+m.id;if(s.seen.has(id))return false;
  if(s.seen.size>=256)s.seen.delete(s.seen.keys().next().value);s.seen.set(id,now);
  if(a.action==='stop'){stopConvoyDoorVoice(key);return true;}
  if(typeof convoyClipCatalog!=='object'||!Object.prototype.hasOwnProperty.call(convoyClipCatalog,a.clip)||
      !['routeAnnouncement','shortcutAnnouncement','announcement','validator'].includes(a.category)||
      !Number.isFinite(a.offset)||a.offset<0||!Number.isFinite(a.duration)||a.duration<=a.offset||a.duration>180||
      !Number.isFinite(a.level)||a.level<0||a.level>1)return false;
  var mix=convoyBusClipMix(m.pose,m.doors,state.telemetry,now-state.stamp<1500);
  if(!mix.gain||!nativeGameAudio.available||now-nativeGameAudio.stamp>=2000)return false;
  var Context=window.AudioContext||window.webkitAudioContext;if(!Context)return false;
  stopConvoyDoorVoice(key);
  if(s.voices.size>=16)stopConvoyDoorVoice(s.voices.keys().next().value);
  var c;
  try{c=state.context||(state.context=new Context());}catch(_){return false;}
  var filter=c.createBiquadFilter(),gain=c.createGain(),pan=c.createStereoPanner?c.createStereoPanner():null;
  filter.type='lowpass';filter.frequency.value=mix.cutoff;filter.connect(gain);
  if(pan){gain.connect(pan);pan.connect(c.destination);}else gain.connect(c.destination);
  var boost=a.category==='routeAnnouncement'?4:a.category==='shortcutAnnouncement'?1.5:a.category==='announcement'?2:1;
  var v={source:null,filter:filter,gain:gain,pan:pan,pose:m.pose,doors:m.doors,player:m.player,clip:true,
    level:a.level*boost,until:now+(a.duration-a.offset)*1000+2000};
  s.voices.set(key,v);tickConvoyDoorAudio();
  if(!s.timer)s.timer=setInterval(tickConvoyDoorAudio,100);
  var url=new URL(convoyClipCatalog[a.clip].split('/').map(encodeURIComponent).join('/'),new URL('./',window.location.href)).href;
  // Reuse bounded decoding/cache. Offset accounts for loading time; cancellation
  // while loading cannot resurrect a departed player's sound.
  Promise.all([fetchBusDecodedClip(url,c),c.state==='running'?Promise.resolve():c.resume()]).then(function(values){
    if(s.voices.get(key)!==v)return;
    var offset=a.offset+(Date.now()-now)/1000,buffer=values[0];
    if(Date.now()-now>3000||offset>=Math.min(buffer.duration,a.duration)||c.state!=='running'||
        !state.telemetry||state.telemetry.paused||Date.now()-state.stamp>=1500){stopConvoyDoorVoice(key);return;}
    var source=c.createBufferSource();v.source=source;source.buffer=buffer;source.connect(filter);
    source.onended=function(){if(s.voices.get(key)===v)stopConvoyDoorVoice(key);};
    tickConvoyDoorAudio();source.start(0,offset);source.stop(c.currentTime+Math.min(buffer.duration,a.duration)-offset);
  }).catch(function(){if(s.voices.get(key)===v)stopConvoyDoorVoice(key);});
  return true;
}
