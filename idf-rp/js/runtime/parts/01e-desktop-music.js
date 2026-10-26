// The DLL owns the selected plugin mode and replaces native music only while
// ETS2 plays it. Legacy desktopMusic wire names remain compatible.
// In stock mode, prewarmed PCM stays silent behind the DLL's zero music gain,
// ready for a fade on the same frame as the picture. Silent menus stay paused.
var desktopMenuMusic = { state: null, at: 0, source: null, context: null, gain: null,
  preparing: null, starting: false, generation: 0, retry: 0, timer: null, closed: false, abort: null };
function receiveDesktopMenuMusic(data) {
  if (!data || typeof data.desktopMusicActive !== 'boolean') return;
  desktopMenuMusic.state = data; desktopMenuMusic.at = Date.now();
  if (data.desktopMusicSupported && !desktopMenuMusic.closed &&
      Date.now() >= desktopMenuMusic.retry) prepareDesktopMenuMusic();
  tickDesktopMenuMusic();
}
function desktopMusicWanted() {
  var s = desktopMenuMusic, output = window.IDFGameAudio && window.IDFGameAudio.status();
  var stock = typeof nativeBusSettingsState !== 'undefined' && nativeBusSettingsState.current && nativeBusSettingsState.current.stockMenuMusic;
  return !!(!s.closed && !stock && s.state && s.state.desktopMusicSupported && (s.state.desktopMusicActive || s.state.desktopMusicPrewarm === true) &&
    Date.now() - s.at < 1800 && output && output.managed && output.ready);
}
function stopDesktopMenuMusic() {
  var s = desktopMenuMusic; ++s.generation; s.starting = false;
  // Suspending the dedicated context retains the loop position. No PCM is sent
  // while loading, in a silent menu, or after losing native audio ownership.
  if (s.context && s.context.state === 'running') s.context.suspend().catch(function () {});
}
function desktopMusicDeadline(promise, ms, message) {
  var timeout;
  return Promise.race([promise, new Promise(function (_, reject) {
    timeout = setTimeout(function () { reject(new Error(message)); }, ms);
  })]).finally(function () { clearTimeout(timeout); });
}
function prepareDesktopMenuMusic() {
  var s = desktopMenuMusic;
  if (s.preparing) return s.preparing;
  s.preparing = (async function () {
    var Context = window.AudioContext || window.webkitAudioContext;
    var context = s.context = new Context({ sampleRate: 48000 });
    await context.suspend();
    var controller = s.abort = new AbortController();
    try {
      // Hidden WebView2 can leave HTMLMediaElement.play() pending indefinitely,
      // even with autoplay enabled. Fetch/decode does not depend on visibility.
      var buffer = await desktopMusicDeadline((async function () {
        var response = await fetch(new URL('sounds/music/mode/bus.mp3', window.location.href).href,
          { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('Music HTTP ' + response.status);
        if (Number(response.headers.get('content-length')) > 16 * 1024 * 1024) throw new Error('Music file too large');
        var bytes = await response.arrayBuffer();
        if (bytes.byteLength > 16 * 1024 * 1024) throw new Error('Music file too large');
        var decoded = await context.decodeAudioData(bytes);
        if (!Number.isFinite(decoded.duration) || decoded.duration <= 0 || decoded.duration > 600 ||
            decoded.numberOfChannels > 2 || decoded.length * decoded.numberOfChannels * 4 > 128 * 1024 * 1024)
          throw new Error('Music duration or format invalid');
        return decoded;
      })(), 20000, 'Music loading timed out');
      if (s.closed) throw new Error('Music host closed');
      s.gain = context.createGain(); s.gain.gain.value = 0;
      s.source = context.createBufferSource(); s.source.buffer = buffer; s.source.loop = true;
      s.source.connect(s.gain); s.gain.connect(window.IDFGameAudio.output(context, { role: 'menu-music' }));
      s.source.start(); // Context stays suspended until all playback gates agree.
      return s.source;
    } finally { controller.abort(); if (s.abort === controller) s.abort = null; }
  })().catch(function (error) {
    stopDesktopMenuMusic(); if (s.context) s.context.close().catch(function () {});
    s.source = s.context = s.gain = null; s.preparing = null; s.retry = Date.now() + 30000;
    if (!s.closed) console.warn('[IDF-RP] Bus mode music unavailable:', error.message);
    return null;
  });
  return s.preparing;
}
function updateDesktopMusicVolume() {
  var s = desktopMenuMusic;
  if (!s.gain || !s.state) return;
  var volume = Number(s.state.desktopMusicVolume);
  var level = s.state.desktopMusicMuted ? 0 : Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0)) * getNativeGameMasterVolumeFactor();
  s.gain.gain.setTargetAtTime(level, s.context.currentTime, .08);
}
function tickDesktopMenuMusic() {
  var s = desktopMenuMusic;
  if (!desktopMusicWanted()) {
    if (s.starting || s.context && s.context.state === 'running') stopDesktopMenuMusic();
    return;
  }
  updateDesktopMusicVolume();
  if (s.starting || s.source && s.context.state === 'running' || Date.now() < s.retry) return;
  s.starting = true; var generation = ++s.generation;
  prepareDesktopMenuMusic().then(function (source) {
    if (generation !== s.generation) return;
    if (!source || !desktopMusicWanted()) { s.starting = false; return; }
    updateDesktopMusicVolume();
    return desktopMusicDeadline(s.context.resume(), 3000, 'Music context resume timed out').then(function () {
      if (generation !== s.generation) { if (!desktopMusicWanted()) stopDesktopMenuMusic(); return; }
      s.starting = false; if (!desktopMusicWanted()) stopDesktopMenuMusic();
    }).catch(function (error) {
      if (generation === s.generation) {
        s.retry = Date.now() + 5000; stopDesktopMenuMusic();
        console.warn('[IDF-RP] Bus mode music unavailable:', error.message);
      }
    });
  });
}
desktopMenuMusic.timer = setInterval(tickDesktopMenuMusic, 200);
window.addEventListener('pagehide', function () {
  var s = desktopMenuMusic; s.closed = true; clearInterval(s.timer); stopDesktopMenuMusic();
  if (s.abort) s.abort.abort();
  if (s.source) { s.source.stop(); s.source.disconnect(); }
  if (s.context) s.context.close().catch(function () {});
});
