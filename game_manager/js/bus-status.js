(function () {
  "use strict";
  var scope = "idf_game_widget_bridge_v1";
  var hosted = /^(game|1|true)$/.test(new URLSearchParams(location.search).get("host") || "");
  var state = null, receivedAt = 0, hostTs = null, serviceKey = "", ws = null, retry = 0, frame = 0;
  var dead = false, waiting = [], walkers = new Map();
  var lastRenderAt = 0, sampleInterval = 150;
  var geometryFrom = null, geometryTarget = null, geometryAt = 0, geometryDuration = 150;
  var container = document.getElementById("dots-container");
  var platform = document.getElementById("platform-container");
  var entry = document.getElementById("door-entry"), exit = document.getElementById("door-exit");
  var info = document.getElementById("service-info");
  function number(value) { return typeof value === "number" && Number.isFinite(value); }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el.textContent !== text) el.textContent = text;
  }
  function setDoor(el, value, name) {
    var labels = { closed: "fermée", moving: "en cours", open: "ouverte", unknown: "indisponible" };
    value = labels[value] ? value : "unknown";
    el.dataset.state = value;
    el.setAttribute("aria-label", name + " : " + labels[value]);
    el.title = name + " : " + labels[value];
  }
  function dot(type) {
    var el = document.createElement("div");
    el.className = "dot " + type;
    container.appendChild(el);
    return el;
  }
  function put(el, point) {
    el.style.transform = "translate3d(" + point.x.toFixed(2) + "px," + point.y.toFixed(2) + "px,0) translate(-50%,-50%)";
  }
  function pose(s) {
    if (![s.busX, s.busZ, s.stopX, s.stopZ, s.busHeading].every(number)) return null;
    var h = s.busHeading * Math.PI / 180, dx = s.stopX - s.busX, dz = s.stopZ - s.busZ;
    var angle = ((number(s.stopHeading) ? s.stopHeading : s.busHeading) - s.busHeading) * Math.PI / 180;
    return { x: (dx * Math.cos(h) - dz * Math.sin(h)) * 8,
      y: -(dx * Math.sin(h) + dz * Math.cos(h)) * 8, angle: angle };
  }
  function smoothingDuration(now) {
    if (lastRenderAt > 0) {
      var gap = now - lastRenderAt;
      if (gap >= 16 && gap <= 1200) sampleInterval = sampleInterval * 0.65 + gap * 0.35;
    }
    lastRenderAt = now;
    return Math.max(100,Math.min(900,sampleInterval * 1.2));
  }
  function interpolatedGeometry(now) {
    if (!geometryTarget) return null;
    if (!geometryFrom) return {x:geometryTarget.x,y:geometryTarget.y,angle:geometryTarget.angle,moving:false};
    var f = Math.max(0,Math.min(1,(now-geometryAt)/Math.max(1,geometryDuration)));
    var delta = Math.atan2(Math.sin(geometryTarget.angle-geometryFrom.angle),Math.cos(geometryTarget.angle-geometryFrom.angle));
    return {x:geometryFrom.x+(geometryTarget.x-geometryFrom.x)*f,
      y:geometryFrom.y+(geometryTarget.y-geometryFrom.y)*f,
      angle:geometryFrom.angle+delta*f,moving:f<1};
  }
  function retargetGeometry(next, now, duration) {
    var current = interpolatedGeometry(now);
    geometryFrom = current || next;
    geometryTarget = next;
    geometryAt = now;
    geometryDuration = duration;
  }
  function platformPoint(pose, index) {
    // Stable positions prevent passengers from jumping on every telemetry packet.
    var x = 40 + (index % 3) * 10, y = 68 - Math.floor(index / 3) * 12;
    return { x: pose.x + x * Math.cos(pose.angle) - y * Math.sin(pose.angle),
      y: pose.y + x * Math.sin(pose.angle) + y * Math.cos(pose.angle) };
  }
  function pathFor(particle, geometry) {
    if (particle.type === "out") return null;
    var queueIndex = number(particle.queueIndex) && particle.queueIndex >= 0
      ? Math.floor(particle.queueIndex) : particle.id % 18;
    queueIndex=Math.min(59,queueIndex);
    var start = platformPoint(geometry,queueIndex);
    var points = [start];
    if (start.x < 30) {
      var around = start.y < 0 ? -90 : 90;
      points.push({x:Math.min(start.x,-40),y:around},{x:40,y:around});
    }
    points.push({x:35,y:46});
    return points;
  }
  function passengerPoint(w, progress) {
    // Exactly match the service clock's 0.6 boundary at x=25 (right bus wall).
    var p = Math.max(0,Math.min(1,progress));
    if (w.type === "out") {
      if (p <= .35) return {x:0,y:-46*p/.35};
      if (p <= .6) return {x:25*(p-.35)/.25,y:-46};
      return {x:25+33*(p-.6)/.4,y:-46};
    }
    if (p <= .4) return along(w.path,p/.4);
    if (p <= .6) return {x:35-10*(p-.4)/.2,y:46};
    if (p <= .8) return {x:25-25*(p-.6)/.2,y:46};
    return {x:0,y:46*(1-p)/.2};
  }
  function along(points, progress) {
    var lengths = [], total = 0;
    for (var i=1;i<points.length;i++) {
      var length = Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
      lengths.push(length); total += length;
    }
    var distance = Math.max(0,Math.min(1,progress)) * total;
    for (var j=0;j<lengths.length;j++) {
      if (distance <= lengths[j] || j === lengths.length-1) {
        var f = lengths[j] ? distance/lengths[j] : 0;
        return {x:points[j].x+(points[j+1].x-points[j].x)*f, y:points[j].y+(points[j+1].y-points[j].y)*f};
      }
      distance -= lengths[j];
    }
    return points[points.length-1];
  }
  function freshDoors() {
    var d = state && state.busDoors;
    return !!(d && d.available && number(d.sampleAt) && Date.now()-d.sampleAt >= 0 && Date.now()-d.sampleAt <= 1500 && Date.now()-receivedAt <= 1500);
  }
  function walkerProgressAt(w, now) {
    var fraction = Math.max(0,Math.min(1,(now-w.at)/Math.max(1,w.duration)));
    return { value:w.from+(w.target-w.from)*fraction, finished:fraction>=1 };
  }
  function animate(now) {
    frame = 0;
    var needsFrame = false;
    var geometry = interpolatedGeometry(now);
    if (geometry) {
      platform.style.transform = "translate3d("+geometry.x.toFixed(2)+"px,"+geometry.y.toFixed(2)+"px,0) rotate("+geometry.angle+"rad) translate(50px,8px)";
      waiting.forEach(function(el,i) { put(el,platformPoint(geometry,i)); });
      if (geometry.moving) needsFrame = true;
    }
    var finished = [];
    walkers.forEach(function (w,id) {
      // Always animate toward the last authoritative progress. Stale door data
      // changes the status display, but must never teleport a passenger.
      var visual = walkerProgressAt(w,now);
      w.drawn = visual.value;
      put(w.el,passengerPoint(w,w.drawn));
      if (!visual.finished) needsFrame = true;
      else if (w.finishing) finished.push(id);
    });
    finished.forEach(function(id) {
      var w = walkers.get(id);
      if (w) w.el.remove();
      walkers.delete(id);
    });
    if (needsFrame && !dead) frame = requestAnimationFrame(animate);
  }
  function clearPeople() {
    waiting.forEach(function (el) { el.remove(); }); waiting = [];
    walkers.forEach(function (w) { w.el.remove(); }); walkers.clear();
  }
  function render(s) {
    state = s; receivedAt = Date.now();
    var renderNow = performance.now();
    var duration = smoothingDuration(renderNow);
    var service = s.routeStarted === true ? s.busService : null;
    var nextKey = service ? service.key : "";
    if (nextKey !== serviceKey) { clearPeople(); serviceKey = nextKey; }
    setText("counterCurrent",String(Math.max(0,Number(s.passengersInBus)||0)));
    setText("counterMax"," / " + (s.busMaxCapacityUnlimited === true ? "∞" : String(s.busMaxCapacity || 100)));
    var geometry = pose(s);
    platform.hidden = !geometry || !s.routeSelected;
    if (geometry) retargetGeometry(geometry,renderNow,duration);
    else { geometryFrom=null; geometryTarget=null; }
    var displayGeometry = interpolatedGeometry(renderNow) || geometry;
    var amount = geometry && service ? Math.min(60,service.waiting) : 0;
    while(waiting.length > amount) waiting.pop().remove();
    while(waiting.length < amount) waiting.push(dot("waiting-dot"));
    var keep = new Set();
    if (geometry && service) {
      service.particles.forEach(function(p) {
        keep.add(p.id);
        var w = walkers.get(p.id);
        if (!w) {
          // Start at progress zero. queueIndex points to the waiting dot that was
          // just removed, producing one continuous path instead of a new dot jump.
          w = { el: dot(p.type === "out" ? "leaving" : "boarding"), type:p.type,
            id:p.id, path:pathFor(p,displayGeometry), drawn:0, from:0,
            target:0, at:renderNow, duration:duration, finishing:false };
          walkers.set(p.id,w);
        }
        var nextProgress=Math.max(0,Math.min(1,Number(p.progress)||0));
        if (nextProgress>w.target+0.000001 || w.finishing) {
          var visual=walkerProgressAt(w,renderNow);
          w.drawn=visual.value; w.from=w.drawn; w.target=nextProgress;
          w.at=renderNow; w.duration=duration;
        }
        w.finishing = false;
      });
    }
    walkers.forEach(function(w,id) {
      if (!keep.has(id) && !w.finishing) {
        // The authoritative clock removes a particle at progress=1. Finish the
        // last visual segment smoothly instead of making the dot disappear.
        var visual=walkerProgressAt(w,renderNow);
        w.drawn=visual.value; w.from=w.drawn; w.target=1; w.at=renderNow;
        w.duration=Math.max(140,Math.min(420,duration)); w.finishing=true;
      }
    });
    updateStatus();
    if (!frame) frame = requestAnimationFrame(animate);
  }
  function updateStatus() {
    var valid = freshDoors(), d = state && state.busDoors;
    setDoor(entry,valid ? d.entryState : "unknown","Entrée / porte avant");
    setDoor(exit,valid ? d.exitState : "unknown","Sortie / porte arrière");
    var service = state && state.busService;
    var message = "En attente du service";
    if (state && state.routeStarted) {
      if (!valid) message = "Portes : télémétrie indisponible";
      else if (state.stopOptionalByPlan === true) message = "Arrêt facultatif";
      else if (!state.vehicleAtStop) message = "Rejoindre l’arrêt et immobiliser le bus";
      else if (service && service.ready) message = "Prêt au départ";
      else if (service && service.flowComplete) message = service.leftBehind > 0 ? "Bus complet · refermer les portes" : "Échanges terminés · refermer les portes";
      else if (service && !service.entryNeedsOpen && service.exitNeedsOpen && d.exitState !== "open") message = "Ouvrir complètement la porte arrière";
      else if (service && !service.exitNeedsOpen && service.entryNeedsOpen && d.entryState !== "open") message = "Ouvrir complètement la porte avant";
      else if (service && service.entryNeedsOpen && service.exitNeedsOpen && d.entryState !== "open" && d.exitState !== "open") message = "Ouvrir complètement les portes";
      else message = "Échanges passagers";
    }
    if (info.textContent !== message) info.textContent = message;
  }
  function envelope(value) {
    if (!value || typeof value !== "object") return;
    if (value.scope && value.scope !== scope) return;
    if (value.channel && value.channel !== "saeiv") return;
    var p = value.payload || value;
    if (p.type === "saeiv:state") p = p.payload || p.state || p;
    else if (p.state) p = p.state;
    if (p.busServiceProtocol === 2) render(p);
  }
  function pollHost() {
    if (!hosted || dead) return;
    try {
      var p = window.parent.saeivGetBridgeState();
      if (p && p.ts !== hostTs) { hostTs=p.ts; envelope(p); }
    } catch (_) { /* Parent may not have finished loading. */ }
  }
  function requestState() {
    var payload = {type:"saeiv:request_state",source:"bus_status"};
    if (hosted) {
      try { window.parent.saeivPostBridgeMessage(payload); } catch (_) {}
    } else if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({scope:scope,channel:"saeiv",payload:payload,ts:Date.now()}));
    }
  }
  function connect() {
    if (dead || hosted) return;
    ws = new WebSocket("ws://localhost:3001");
    ws.onopen = requestState;
    ws.onmessage = function(event) { try { envelope(JSON.parse(event.data)); } catch (_) {} };
    ws.onclose = function() { if (!dead) retry=setTimeout(connect,1500); };
  }
  window.addEventListener("message",function(event) {
    if (event.source !== window.parent || event.origin !== location.origin) return;
    envelope(event.data);
  });
  function scale() {
    document.getElementById("scene-center").style.transform = "scale("+Math.max(.2,Math.min(2.5,innerWidth/180,innerHeight/250))+")";
  }
  window.addEventListener("resize",scale); scale();
  var poll = setInterval(function() { pollHost(); updateStatus(); },150);
  var request = setInterval(requestState,2000);
  window.addEventListener("pagehide",function() {
    dead=true; clearInterval(poll); clearInterval(request); clearTimeout(retry); cancelAnimationFrame(frame);
    if (ws) ws.close(); clearPeople();
  });
  pollHost(); requestState(); connect();
})();
