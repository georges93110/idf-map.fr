/* PCM transport stays off the page/UI thread, including its acknowledgements.
   Only the existing authenticated page can grant this audio-only connection. */
'use strict';
let socket = null, endpoint = '', token = '', retry = 0, ready = false;
const streams = new Map(), generations = new Map();
function status(value) { ready = value; postMessage({ type: 'ready', ready }); }
function connect() {
  clearTimeout(retry);
  if (!endpoint || !token || socket) return;
  const ws = socket = new WebSocket(endpoint, 'idf-audio-v1');
  ws.onopen = () => ws.send(JSON.stringify({ type: 'nativeAudioTransport', protocol: 1, token }));
  ws.onmessage = event => {
    if (socket !== ws) return;
    try { const m = JSON.parse(event.data); if (m.type === 'nativeAudioTransport' && m.protocol === 1) status(m.ready === true); } catch (_) {}
  };
  ws.onerror = () => {};
  ws.onclose = () => { if (socket !== ws) return; socket = null; status(false); retry = setTimeout(connect, 500); };
}
function remove(id) { streams.get(id)?.close(); streams.delete(id); }
onmessage = event => {
  const m = event.data;
  if (m?.type === 'configure') {
    if (endpoint === m.url && token === m.token) return;
    endpoint = m.url || ''; token = m.token || ''; clearTimeout(retry);
    const old = socket; socket = null; old?.close(); status(false); connect();
  } else if (m?.type === 'stream' && Number.isInteger(m.id) && m.id > 0 && m.id <= 32 && m.port) {
    remove(m.id); const port = m.port; streams.set(m.id, port); generations.set(m.id, m.generation);
    port.onmessage = event => {
      const data = event.data;
      try {
        if (!ready || socket?.readyState !== 1 || streams.get(m.id) !== port || data?.generation !== generations.get(m.id) || !(data?.pcm instanceof ArrayBuffer) || data.pcm.byteLength !== 8192) return;
        if (socket.bufferedAmount > Math.max(32768, streams.size * 6 * 8216)) return;
        const packet = new ArrayBuffer(24 + data.pcm.byteLength), view = new DataView(packet);
        new Uint8Array(packet).set([73,68,70,80,67,77,48,49]);
        view.setUint32(8, m.id, true); view.setUint32(12, data.seq >>> 0, true);
        view.setUint32(16, data.pcm.byteLength / 8, true); view.setUint32(20, 48000, true);
        new Uint8Array(packet, 24).set(new Uint8Array(data.pcm)); socket.send(packet);
      } finally { port.postMessage({ type: 'ack' }); }
    };
  } else if (m?.type === 'reset' && Number.isInteger(m.id) && m.id >= 0 && m.id <= 32) {
    if (!m.id) generations.clear(); else generations.set(m.id, m.generation);
    if (ready && socket?.readyState === 1) {
      const packet = new ArrayBuffer(24), view = new DataView(packet);
      new Uint8Array(packet).set([73,68,70,80,67,77,48,49]);view.setUint32(8,m.id,true);view.setUint32(20,48000,true);socket.send(packet);
    }
  } else if (m?.type === 'remove') { remove(m.id); generations.delete(m.id); }
};
