(function (root) {
  "use strict";
  // Loopback only. These are the bridge's 32 automatic HTTP candidates.
  var FIRST = 3001, COUNT = 32, KEY = "idf.telemetry.port.v1";
  function validPort(value) {
    return /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= 65535 ? Number(value) : null;
  }
  function ports() {
    var result = [];
    function add(value) { var p = validPort(value); if (p && result.indexOf(p) < 0) result.push(p); }
    var hinted = new URLSearchParams(root.location.search).getAll("telemetryPort");
    add(hinted[hinted.length - 1]);
    if (/^(localhost|127\.0\.0\.1)$/.test(root.location.hostname)) add(root.location.port);
    try { add(root.localStorage.getItem(KEY)); } catch (_) {}
    for (var i = 0; i < COUNT; i++) add(FIRST + i);
    return result;
  }
  // A WebSocket-shaped connection: callers retain their existing reconnect,
  // send, onmessage and close handlers. No global WebSocket replacement.
  function connect() {
    var candidatePorts = ports(), next = 0, pending = new Set(), winner = null;
    var listeners = {}, scheduled = 0, stopped = false, handshakeTimeout = 900;
    var connection = { readyState: 0, url: "", onopen: null, onmessage: null, onerror: null, onclose: null };
    Object.defineProperty(connection, "bufferedAmount", { get: function () { return winner ? winner.bufferedAmount : 0; } });
    function emit(type, source) {
      var event = { type: type, target: connection, currentTarget: connection,
        data: source && source.data, code: source && source.code, reason: source && source.reason,
        wasClean: !!(source && source.wasClean) };
      if (typeof connection["on" + type] === "function") connection["on" + type](event);
      (listeners[type] || []).slice().forEach(function (listener) { listener.call(connection, event); });
    }
    connection.addEventListener = function (type, handler) {
      if (!listeners[type]) listeners[type] = [];
      if (listeners[type].indexOf(handler) < 0) listeners[type].push(handler);
    };
    connection.removeEventListener = function (type, handler) {
      listeners[type] = (listeners[type] || []).filter(function (value) { return value !== handler; });
    };
    connection.send = function (data) {
      if (connection.readyState !== 1 || !winner) throw new Error("IDF telemetry connection is not open");
      winner.send(data);
    };
    function discard(probe) {
      clearTimeout(probe.timer); pending.delete(probe);
      probe.socket.onopen = probe.socket.onmessage = probe.socket.onerror = probe.socket.onclose = null;
      try { probe.socket.close(); } catch (_) {}
    }
    function stopProbes() { clearTimeout(scheduled); Array.from(pending).forEach(discard); }
    connection.close = function (code, reason) {
      if (stopped) return;
      stopped = true; stopProbes();
      if (winner) { connection.readyState = 2; winner.close(code, reason); }
      else {
        connection.readyState = 3;
        setTimeout(function () { emit("close", { code: 1000, wasClean: true }); }, 0);
      }
    };
    function pump() {
      if (stopped || winner) return;
      // First use the last known/explicit endpoint alone; widen to four probes
      // only if needed. Reject unrelated listeners without sending app commands.
      while (pending.size < 4 && next < candidatePorts.length) probe(candidatePorts[next++]);
      if (!pending.size && next >= candidatePorts.length) {
        stopped = true; connection.readyState = 3;
        emit("error"); emit("close", { code: 1006, reason: "Pont IDF introuvable" });
      }
    }
    function probe(port) {
      var socket;
      var endpoint = "ws://127.0.0.1:" + port + "/idf-discovery";
      try {
        try { socket = new root.WebSocket(endpoint, { protocols: ["idf-telemetry-v1"], targetAddressSpace: "loopback" }); }
        catch (_) { socket = new root.WebSocket(endpoint, "idf-telemetry-v1"); }
      }
      catch (_) { scheduled = setTimeout(pump, 0); return; }
      var p = { socket: socket, timer: 0 };
      pending.add(p);
      function failed() { if (!pending.has(p)) return; discard(p); scheduled = setTimeout(pump, 0); }
      p.timer = setTimeout(failed, handshakeTimeout);
      socket.onerror = socket.onclose = failed;
      socket.onmessage = function (event) {
        var hello;
        try { hello = JSON.parse(event.data); } catch (_) { failed(); return; }
        if (!hello || hello.type !== "idfBridgeHello" || hello.service !== "idf_telemetry" ||
            hello.protocol !== 1 || hello.httpPort !== port || !validPort(hello.udpPort) ||
            !Number.isInteger(hello.pid) || hello.pid < 1 || socket.protocol !== "idf-telemetry-v1") {
          failed(); return;
        }
        if (winner || stopped) { discard(p); return; }
        winner = socket; clearTimeout(p.timer); pending.delete(p); stopProbes();
        connection.url = socket.url; connection.readyState = 1;
        try { root.localStorage.setItem(KEY, String(port)); } catch (_) {}
        socket.onmessage = function (message) { emit("message", message); };
        socket.onerror = function (error) { emit("error", error); };
        socket.onclose = function (event) { stopped = true; connection.readyState = 3; emit("close", event); };
        emit("open");
      };
    }
    function startDiscovery() {
      if (stopped || next > 0) return;
      clearTimeout(scheduled);
      probe(candidatePorts[next++]);
    }
    // A first-time browser permission prompt may take much longer than a
    // loopback handshake. Do not cancel it after 900 ms. Never query Chromium's
    // obsolete combined permission (unsafe in some older renderer versions).
    scheduled = setTimeout(startDiscovery, 1000);
    var permission;
    try { permission = root.navigator.permissions.query({ name: "loopback-network" }); }
    catch (_) { clearTimeout(scheduled); scheduled = setTimeout(startDiscovery, 0); }
    if (permission) permission.then(function (status) {
      if (stopped || next > 0) return;
      if (status.state === "denied" && !/^(localhost|127\.0\.0\.1)$/.test(root.location.hostname)) {
        clearTimeout(scheduled); stopped = true; connection.readyState = 3; connection.localNetworkDenied = true;
        emit("error"); emit("close", { code:1006, reason:"Accès au pont local refusé par le navigateur" });
        return;
      }
      if (status.state === "prompt") handshakeTimeout = 30000;
      startDiscovery();
    }, startDiscovery);
    return connection;
  }
  root.IdfTelemetry = { connect: connect };
})(window);
