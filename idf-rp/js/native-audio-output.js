(function (root) {
  'use strict';
  // Same-origin widgets share the authoritative page's connection and mixer.
  try { if (root.parent !== root && root.parent.IDFGameAudio) {
    root.IDFGameAudio = root.parent.IDFGameAudio;
    const widgetMedia = new Set(), knownMedia = new WeakSet();
    function route(audio) {
      widgetMedia.add(audio);
      if (!knownMedia.has(audio)) {
        knownMedia.add(audio);
        audio.addEventListener('play', () => widgetMedia.add(audio));
        audio.addEventListener('ended', () => widgetMedia.delete(audio));
      }
      return root.IDFGameAudio.media(audio);
    }
    // Detached `new Audio()` elements never bubble play to the document.
    // Preserve the native constructor/prototype and route those too.
    root.Audio = new Proxy(root.Audio, { construct(Target, args, NewTarget) {
      return route(Reflect.construct(Target, args, NewTarget));
    } });
    // HTMLMediaElement 'play' fires before 'playing'; widgets retain their own
    // playback/volume logic while their decoded output joins the parent's bus.
    root.addEventListener('play', e => { if (e.target instanceof HTMLMediaElement) route(e.target); }, true);
    root.addEventListener('ended', e => widgetMedia.delete(e.target), true);
    root.addEventListener('pagehide', () => { for (const audio of widgetMedia) { audio.pause(); root.IDFGameAudio.releaseMedia(audio); } widgetMedia.clear(); });
    return;
  } } catch (_) {}
  const url = new URL('native-audio-worklet.js?v=pcm-worker-20261026', document.currentScript.src).href;
  const workerUrl = new URL('native-audio-worker.js?v=pcm-worker-20261026', document.currentScript.src).href;
  const records = new Map(), mediaSources = new WeakMap();
  let socket = null, managed = false, ready = false, mediaContext = null;
  let transport = null, transportReady = false, transportToken = '', transportFailed = false;
  function routeTransport(record) {
    if (!record.node?.port) return;
    const useWorker = !!(transport && transportReady);
    if (record.workerTransport === useWorker) return;
    record.workerTransport = useWorker;
    if (useWorker) {
      const channel = new MessageChannel();
      transport.postMessage({ type: 'stream', id: record.id, generation: record.generation, port: channel.port1 }, [channel.port1]);
      record.node.port.postMessage({ type: 'transport', port: channel.port2 }, [channel.port2]);
    } else record.node.port.postMessage({ type: 'transport', port: null });
  }
  function configureTransport() {
    // Old bridges keep the original PCM path. Never route through a worker
    // without a private grant from this page's existing native audio owner.
    if (!transportToken || !ready || !socket?.url) {
      transport?.postMessage({ type: 'configure', url: '', token: '' }); return;
    }
    if (!transport && !transportFailed && root.Worker && root.MessageChannel) {
      try {
        transport = new Worker(workerUrl);
        transport.onmessage = e => {
          if (e.data?.type !== 'ready') return;
          transportReady = e.data.ready === true; for (const r of records.values()) routeTransport(r);
        };
        transport.onerror = () => {
          transportFailed = true; transport?.terminate(); transport = null; transportReady = false;
          for (const r of records.values()) routeTransport(r);
        };
      } catch (_) { transportFailed = true; }
    }
    if (transport) { const endpoint = new URL(socket.url); endpoint.pathname = '/idf-rp/native-audio'; endpoint.search = ''; endpoint.hash = '';
      transport.postMessage({ type: 'configure', url: endpoint.href, token: transportToken }); }
  }
  function reset(id) {
    if (socket?.readyState !== 1 || !ready) return;
    if (transport && transportReady) {
      const record = Array.from(records.values()).find(r => r.id === id);
      transport.postMessage({ type: 'reset', id, generation: record?.generation }); return;
    }
    const packet = new ArrayBuffer(24), bytes = new Uint8Array(packet), data = new DataView(packet);
    bytes.set([73,68,70,80,67,77,48,49]); data.setUint32(8, id, true); data.setUint32(20, 48000, true);
    try { socket.send(packet); } catch (_) {}
  }
  function send(record, pcm, seq, time) {
    if (!ready || socket?.readyState !== 1 || !record.capture ||
        (socket.bufferedAmount || 0) > Math.max(32768, records.size * 6 * (24 + 1024 * 8)) || record.context.currentTime - time > 0.12) return;
    const packet = new ArrayBuffer(24 + pcm.byteLength), data = new DataView(packet);
    new Uint8Array(packet).set([73,68,70,80,67,77,48,49]);
    data.setUint32(8, record.id, true); data.setUint32(12, seq >>> 0, true);
    data.setUint32(16, pcm.byteLength / 8, true); data.setUint32(20, 48000, true);
    new Uint8Array(packet, 24).set(new Uint8Array(pcm));
    try { socket.send(packet); } catch (_) {}
  }
  function state(record) {
    const capture = managed && ready && !!record.node;
    // Legacy DLL/site remains audible. Once negotiated, native outages are
    // silent: never unexpectedly switch to an overlay-only recording source.
    record.local.gain.value = managed ? 0 : 1;
    if (record.capture === capture) return;
    record.capture = capture; record.used = 0; record.previous = null; record.position = 0;
    record.generation = (record.generation || 0) + 1;
    reset(record.id);
    record.node?.port?.postMessage({ type: 'capture', enabled: capture, generation: record.generation });
  }
  function legacyCapture(record) {
    // Unlike the worklet, this fallback runs on the UI thread. Give it
    // ~43 ms per callback even at 96 kHz; a 2048-frame double buffer could
    // overwrite input while the hidden window dispatched its main-thread tasks.
    const ctx = record.context, node = ctx.createScriptProcessor(4096, 2, 2);
    record.node = node; record.buffer = new Float32Array(2048); record.seq = 0;
    node.onaudioprocess = event => {
      for (let c = 0; c < event.outputBuffer.numberOfChannels; ++c) event.outputBuffer.getChannelData(c).fill(0);
      if (!record.capture) return;
      const l = event.inputBuffer.getChannelData(0), r = event.inputBuffer.getChannelData(1), step = ctx.sampleRate / 48000;
      for (let i = 0; i < l.length; ++i) {
        if (!record.previous) { record.previous = [l[i], r[i]]; record.position = 1; }
        while (record.position <= 1) {
          const k = record.used++ * 2;
          record.buffer[k] = record.previous[0] + (l[i] - record.previous[0]) * record.position;
          record.buffer[k + 1] = record.previous[1] + (r[i] - record.previous[1]) * record.position;
          record.position += step;
          if (record.used === 1024) { send(record, record.buffer.buffer, ++record.seq, ctx.currentTime); record.used = 0; }
        }
        record.position -= 1; record.previous[0] = l[i]; record.previous[1] = r[i];
      }
    };
    // ScriptProcessor needs a downstream consumer even with zero audio.
    // An unconnected analyser is automatically pulled; connecting the silent
    // processor to destination would re-enable the 30 s fake-clock slowdown.
    record.sink = ctx.createAnalyser(); record.sink.fftSize = 32;
    record.input.connect(node); node.connect(record.sink); state(record);
  }
  function output(context, options) {
    if (records.has(context)) return records.get(context).input;
    const music = options && options.role === 'menu-music';
    let id = music ? 32 : 1; const used = new Set(Array.from(records.values(), r => r.id));
    if (!music) while (used.has(id)) ++id;
    if (used.has(id) || id > (music ? 32 : 31)) throw new Error('IDF-RP: too many live audio contexts');
    const input = context.createGain(), local = context.createGain();
    input.channelCount = 2; input.channelCountMode = 'explicit';
    input.connect(local); local.connect(context.destination);
    const record = { context, id, input, local, node: null, capture: false, used: 0 };
    records.set(context, record); state(record);
    context.addEventListener('statechange', () => {
      if (context.state !== 'closed') return;
      transport?.postMessage({ type: 'remove', id });
      reset(id); record.node?.port?.close(); record.node?.disconnect(); record.sink?.disconnect(); input.disconnect(); local.disconnect(); records.delete(context);
    });
    (async function () {
      try {
        if (!context.audioWorklet || !root.AudioWorkletNode) throw new Error('AudioWorklet unavailable');
        await context.audioWorklet.addModule(url);
        if (context.state === 'closed') return;
        const node = new AudioWorkletNode(context, 'idf-pcm-capture', { numberOfInputs: 1, numberOfOutputs: 0,
          channelCount: 2, channelCountMode: 'explicit' });
        record.node = node;
        node.port.onmessage = e => { if(e.data.generation === record.generation) send(record, e.data.pcm, e.data.seq, e.data.time); node.port.postMessage({ type: 'ack' }); };
        node.onprocessorerror = () => {
          node.disconnect(); input.disconnect(node); node.port.close(); record.node = null; record.capture = false;
          try { legacyCapture(record); } catch (error) { console.error('[IDF-RP] Native audio capture unavailable', error); }
        };
        // This is a capture sink, not a silent browser output. With an output
        // connected to destination, Chromium switches to its timer-driven
        // silent sink after 30 s. Hidden WebView2 then ran at ~32 kHz instead
        // of 48 kHz, starving native playback every half-second. A zero-output
        // worklet is automatically pulled on the real audio clock (default
        // interactive latency), while local remains silent in native mode.
        input.connect(node); state(record); routeTransport(record);
      } catch (error) {
        if (context.state !== 'closed') { try { legacyCapture(record); } catch (e) { console.error('[IDF-RP] Native audio capture unavailable', e); } }
      }
    })();
    return input;
  }
  function media(element) {
    if (!element) return element;
    if (mediaSources.has(element)) { mediaSources.get(element).connect(); return element; }
    try {
      if (!mediaContext || mediaContext.state === 'closed') mediaContext = new (root.AudioContext || root.webkitAudioContext)();
      const context = mediaContext, source = context.createMediaElementSource(element), destination = output(context);
      const record = { connected: false, connect() { if (!record.connected) { source.connect(destination); record.connected = true; } },
        disconnect() { source.disconnect(); record.connected = false; } };
      mediaSources.set(element, record); record.connect();
      const resume = () => { record.connect(); if (context.state === 'suspended') context.resume().catch(() => {}); };
      const suspend = () => { if (element.paused || element.ended) record.disconnect(); };
      element.addEventListener('pause', suspend); element.addEventListener('ended', suspend);
      element.addEventListener('play', resume); resume();
    } catch (e) { console.warn('[IDF-RP] Media audio routing failed', e); }
    return element;
  }
  function receive(message) {
    if (message?.type !== 'nativeAudioStatus' || message.protocol !== 1) return false;
    managed = message.supported === true; ready = managed && message.ready === true;
    transportToken = typeof message.transportToken === 'string' ? message.transportToken : '';
    configureTransport();
    for (const record of records.values()) state(record);
    return true;
  }
  function bind(connection) {
    socket = connection; ready = false; transportToken = ''; configureTransport(); for (const record of records.values()) state(record);
    connection?.addEventListener('close', () => { if (socket !== connection) return; ready = false; configureTransport(); for (const r of records.values()) state(r); });
  }
  root.IDFGameAudio = { output, media, releaseMedia: element => mediaSources.get(element)?.disconnect(), receive, bind,
    status: () => ({ managed, ready, workerTransport: transportReady, contexts: records.size, localGains: Array.from(records.values(), r => r.local.gain.value) }) };
  root.addEventListener('pagehide', () => { reset(0); transport?.terminate(); transport = null; transportReady = false; ready = false; for (const r of records.values()) state(r); });
})(window);
