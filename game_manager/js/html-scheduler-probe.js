(function (root) {
  'use strict';
  // Diagnostic only: no readiness ACK, heartbeat, retry or lifetime changes.
  // Runs only in our floating game host. Reports stay on the local bridge.
  function create(connection) {
    if (new URLSearchParams(root.location.search).get('idfFloatUi') !== '1' || !root.performance) return null;
    var now = function () { return root.performance.now(); };
    var lastTick = now(), lastReport = -Infinity, observer = null, closed = false;
    var active = false, phase = '', phaseAt = 0, startedAt = 0, messageKind = '';
    var lag = 0, handler = 0, tasks = 0, frames = 0, received = 0, stages = [], scripts = [];
    function remember(list, value) { list.push(value); if (list.length > 4) list.shift(); }
    function finishPhase(at) {
      if (active && at - phaseAt >= 100) remember(stages, { phase: phase, durationMs: Math.round(at - phaseAt) });
    }
    function step(name) {
      if (!active) return;
      var at = now(); finishPhase(at); phase = String(name).slice(0,48); phaseAt = at;
    }
    function begin(data) {
      received++; active = true; startedAt = phaseAt = now(); phase = 'dispatch';
      var match = typeof data === 'string' && /"type"\s*:\s*"([A-Za-z0-9:_-]{1,48})"/.exec(data.slice(0,180));
      messageKind = match ? match[1] : 'telemetry';
    }
    function end() {
      var at = now(); finishPhase(at);
      var elapsed = at - startedAt;
      if (elapsed >= 250) remember(stages, { phase: 'message:' + messageKind, durationMs: Math.round(elapsed) });
      handler = Math.max(handler, elapsed); active = false;
    }
    if (root.PerformanceObserver) {
      try {
        var supported = root.PerformanceObserver.supportedEntryTypes || [];
        var types = ['longtask','long-animation-frame'].filter(function (type) { return supported.indexOf(type) >= 0; });
        if (types.length) {
          observer = new root.PerformanceObserver(function (list) {
            list.getEntries().forEach(function (entry) {
              if (entry.entryType === 'longtask') tasks = Math.max(tasks, entry.duration);
              if (entry.entryType === 'long-animation-frame') {
                frames = Math.max(frames, entry.duration);
                Array.from(entry.scripts || []).filter(function (s) { return s.duration >= 100; }).slice(0,4).forEach(function (s) {
                  var file = '';
                  try { file = new URL(s.sourceURL).pathname.split('/').pop().slice(0,80); } catch (_) {}
                  remember(scripts, { file: file, functionName: String(s.sourceFunctionName || '').slice(0,80), durationMs: Math.round(s.duration) });
                });
              }
            });
          });
          observer.observe({ entryTypes: types });
        }
      } catch (_) { if (observer) observer.disconnect(); observer = null; }
    }
    var timer = root.setInterval(function () {
      if (closed) return;
      var at = now(); lag = Math.max(lag, at - lastTick - 1000); lastTick = at;
      // A normal 60 Hz frame or a small scheduling jitter produces no log.
      if (Math.max(lag, handler, tasks, frames) < 250) { handler = 0; received = 0; return; }
      if (connection.readyState !== 1 || at - lastReport < 5000) return;
      var doc = root.document;
      try {
        connection.send(JSON.stringify({ type:'htmlSchedulerDiagnostic', protocol:1,
          loopLagMs:Math.round(lag), handlerMs:Math.round(handler), longTaskMs:Math.round(tasks), longFrameMs:Math.round(frames),
          received:received, stages:stages, scripts:scripts,
          visibility:doc ? doc.visibilityState : 'unknown', focused:!!(doc && doc.hasFocus && doc.hasFocus()) }));
        lastReport = at; lag = handler = tasks = frames = received = 0; stages = []; scripts = [];
      } catch (_) {}
    }, 1000);
    return { begin:begin, step:step, end:end, close:function () {
      closed = true; root.clearInterval(timer); if (observer) observer.disconnect();
    } };
  }
  root.IdfHtmlSchedulerProbe = { create:create };
})(window);
