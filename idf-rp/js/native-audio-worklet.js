/* Final, already processed stereo bus -> bounded PCM transport. This
   zero-output capture sink is pulled automatically by the audio clock. */
class IDFPCMCapture extends AudioWorkletProcessor {
  constructor() {
    super(); this.enabled = false; this.seq = 0; this.pending = 0; this.generation = 0;
    this.transport = null;
    this.position = 0; this.previous = null; this.used = 0; this.buffer = new Float32Array(2048);
    this.port.onmessage = e => {
      if (e.data?.type === 'capture') {
        this.enabled = !!e.data.enabled; this.generation = e.data.generation; this.used = 0; this.position = 0; this.previous = null;
      } else if (e.data?.type === 'transport') {
        this.transport?.close(); this.transport = e.data.port || null; this.pending = 0;
        if (this.transport) this.transport.onmessage = e => { if (e.data?.type === 'ack') this.pending = Math.max(0, this.pending - 1); };
      } else if (e.data?.type === 'ack' && !this.transport) this.pending = Math.max(0, this.pending - 1);
    };
  }
  sample(left, right) {
    this.buffer[this.used * 2] = left; this.buffer[this.used * 2 + 1] = right;
    if (++this.used < 1024) return;
    ++this.seq;
    // Keep up to 128 ms while the UI thread handles a frame (menus/map).
    // Three packets dropped sound after only 64 ms, resetting every native stream.
    // A gap in sequence resets the receiving jitter buffer, never replays it.
    if (this.pending < 6) {
      const buffer = this.buffer.buffer;
      (this.transport || this.port).postMessage({ seq: this.seq, pcm: buffer, time: currentTime, generation: this.generation }, [buffer]);
      this.buffer = new Float32Array(2048); ++this.pending;
    }
    this.used = 0;
  }
  process(inputs, outputs) {
    for (const channel of outputs[0] || []) channel.fill(0);
    if (!this.enabled) return true;
    const input = inputs[0], left = input?.[0], right = input?.[1] || left;
    const length = left?.length || outputs[0]?.[0]?.length || 128;
    // Continuous linear resampling handles 44.1/48/96 kHz contexts without
    // changing pitch, duration or the interaural difference after HTML effects.
    const step = sampleRate / 48000;
    for (let i = 0; i < length; ++i) {
      const l = left?.[i] || 0, r = right?.[i] || 0;
      if (!this.previous) { this.previous = [l, r]; this.position = 1; }
      while (this.position <= 1) {
        this.sample(this.previous[0] + (l - this.previous[0]) * this.position,
          this.previous[1] + (r - this.previous[1]) * this.position);
        this.position += step;
      }
      this.position -= 1; this.previous[0] = l; this.previous[1] = r;
    }
    return true;
  }
}
registerProcessor('idf-pcm-capture', IDFPCMCapture);
