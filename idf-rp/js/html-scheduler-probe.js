(function (root) {
  'use strict';
  // Diagnostic only: no readiness ACK, heartbeat, retry or lifetime changes.
  // Runs only in our floating game host. Reports stay on the local bridge.
  var fullBrowserVersion = '';
  try {
    var hints = root.navigator && root.navigator.userAgentData;
    if (hints && hints.getHighEntropyValues) hints.getHighEntropyValues(['fullVersionList']).then(function (data) {
      var list = Array.isArray(data.fullVersionList) ? data.fullVersionList : [];
      var brand = list.find(function (b) { return /Microsoft Edge/i.test(b.brand); }) || list.find(function (b) { return b.brand === 'Chromium'; });
      if (brand && /^[0-9.]{1,40}$/.test(brand.version)) fullBrowserVersion = brand.version;
    }).catch(function () {});
  } catch (_) {}
  function browserInfo() {
    var ua = String(root.navigator && root.navigator.userAgent || '');
    var match = /Edg\/([0-9.]{1,40})/.exec(ua) || /Chrome\/([0-9.]{1,40})/.exec(ua);
    return (root.chrome && root.chrome.webview ? 'WebView2/' : 'Chromium/') + (fullBrowserVersion || (match ? match[1] : 'unknown'));
  }
  // A worker has its own event loop. Its timestamps distinguish a blocked page
  // thread from a gap affecting both loops, without sending any game heartbeat.
  // This is evidence about scheduling, not proof of a GPU/driver failure.
  function workerProbe() {
    var worker = null, url = '', status = 'unavailable', ticks = 0, gap = 0, delivery = 0;
    if (root.Worker && root.Blob && root.URL && root.URL.createObjectURL) try {
      url = root.URL.createObjectURL(new root.Blob([
        "var last=performance.now();setInterval(function(){var at=performance.now();postMessage({at:performance.timeOrigin+at,gap:Math.max(0,at-last-1000)});last=at;},1000);"
      ], {type:'text/javascript'}));
      worker = new root.Worker(url); status = 'starting';
      worker.onmessage = function (event) {
        var d = event.data;
        if (!d || !Number.isFinite(d.at) || !Number.isFinite(d.gap)) return;
        status = 'running'; ticks++;
        gap = Math.max(gap, Math.max(0, d.gap));
        delivery = Math.max(delivery, Math.max(0, root.performance.timeOrigin + root.performance.now() - d.at));
      };
      worker.onerror = function () { status = 'failed'; worker.terminate(); };
    } catch (_) { status = 'failed'; if (worker) worker.terminate(); }
    return { sample:function () { return {status:status,ticks:ticks,gapMs:Math.round(gap),deliveryLagMs:Math.round(delivery)}; },
      reset:function () { ticks = gap = delivery = 0; },
      close:function () { if (worker) worker.terminate(); if (url) root.URL.revokeObjectURL(url); } };
  }
  function create(connection) {
    if (new URLSearchParams(root.location.search).get('idfFloatUi') !== '1' || !root.performance) return null;
    var now = function () { return root.performance.now(); };
    var lastTick = now(), lastReport = -Infinity, observer = null, closed = false;
    var worker = workerProbe(), lifecycle = '', lifecycleAt = 0;
    function life(event) { lifecycle = event.type; lifecycleAt = now(); }
    if (root.document && root.document.addEventListener) ['freeze','resume','visibilitychange'].forEach(function (name) {
      root.document.addEventListener(name, life);
    });
    var errors = [], omittedErrors = 0;
    function scriptError(event) {
      var reason = event.reason, file = '';
      try { file = new URL(event.filename || '').pathname.split('/').pop().slice(0,80); } catch (_) {}
      var message = String(event.message || reason && reason.message || reason || 'Script error').replace(/[\r\n]/g,' ').slice(0,300);
      var row = {kind:event.type,message:message,file:file,line:Number(event.lineno)||0,count:1};
      var last = errors[errors.length-1];
      if (last && last.kind === row.kind && last.message === row.message && last.file === row.file && last.line === row.line) last.count++;
      else if (errors.length < 8) errors.push(row); else omittedErrors++;
    }
    if (root.addEventListener) ['error','unhandledrejection'].forEach(function (name) { root.addEventListener(name, scriptError); });
    function flushErrors() {
      if (connection.readyState !== 1 || !errors.length) return;
      try {
        connection.send(JSON.stringify({type:'htmlRuntimeError',protocol:1,errors:errors,omitted:omittedErrors}));
        errors = []; omittedErrors = 0;
      } catch (_) {}
    }
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
      flushErrors();
      var at = now(); lag = Math.max(lag, at - lastTick - 1000); lastTick = at;
      // A normal 60 Hz frame or a small scheduling jitter produces no log.
      var sample = worker.sample();
      if (Math.max(lag, handler, tasks, frames, sample.gapMs, sample.deliveryLagMs) < 250) {
        handler = 0; received = 0; worker.reset(); return;
      }
      if (connection.readyState !== 1 || at - lastReport < 5000) return;
      var doc = root.document;
      try {
        connection.send(JSON.stringify({ type:'htmlSchedulerDiagnostic', protocol:1,
          loopLagMs:Math.round(lag), handlerMs:Math.round(handler), longTaskMs:Math.round(tasks), longFrameMs:Math.round(frames),
          received:received, stages:stages, scripts:scripts,
          browser:browserInfo(), worker:sample,
          lifecycle:lifecycle, lifecycleAgeMs:lifecycle ? Math.round(at-lifecycleAt) : null,
          visibility:doc ? doc.visibilityState : 'unknown', focused:!!(doc && doc.hasFocus && doc.hasFocus()) }));
        lastReport = at; lag = handler = tasks = frames = received = 0; stages = []; scripts = []; worker.reset();
      } catch (_) {}
    }, 1000);
    return { begin:begin, step:step, end:end, close:function () {
      flushErrors();
      if (root.removeEventListener) ['error','unhandledrejection'].forEach(function (name) { root.removeEventListener(name, scriptError); });
      closed = true; root.clearInterval(timer); if (observer) observer.disconnect(); worker.close();
      if (root.document && root.document.removeEventListener) ['freeze','resume','visibilitychange'].forEach(function (name) {
        root.document.removeEventListener(name, life);
      });
    } };
  }
  root.IdfHtmlSchedulerProbe = { create:create, browserInfo:browserInfo };
})(window);
