/*
 * Game2 runtime chunk: 01-bridge-and-saeiv-state.js
 * Singleton, bridge widgets, etat SAEIV/passagers.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function shouldYieldToGameInstance(payload) {
        if (!payload || typeof payload !== "object") return false;
        if (String(payload.type || "") !== "claim") return false;
        var otherId = String(payload.id || "");
        if (!otherId || otherId === gameSingletonId) return false;
        var otherOpenedAt = Number(payload.openedAt);
        if (!Number.isFinite(otherOpenedAt)) otherOpenedAt = 0;
        if (otherOpenedAt > gameSingletonOpenedAt) return true;
        if (otherOpenedAt < gameSingletonOpenedAt) return false;
        return otherId > gameSingletonId;
      }
      function closeThisGameInstanceAsDuplicate() {
        if (gameSingletonClosing) return;
        gameSingletonClosing = true;
        try {
          if (gameSingletonChannel) {
            gameSingletonChannel.close();
            gameSingletonChannel = null;
          }
        } catch (err) { }
        try { stopTelemetryConnectionWatch(); } catch (err) { }
        try {
          if (pipWindow && !pipWindow.closed) pipWindow.close();
        } catch (err) { }
        Object.keys(tabRefs).forEach(function (id) {
          var ref = tabRefs[id];
          if (!ref || ref.closed) return;
          try { ref.close(); } catch (err) { }
        });
        try { window.close(); } catch (err) { }
        setTimeout(function () {
          if (window.closed) return;
          try {
            document.body.innerHTML =
              '<style>html,body{margin:0;width:100%;height:100%;background:#000;color:#d1d5db;font-family:Arial,"Helvetica Neue",Helvetica,sans-serif;display:grid;place-items:center;padding:14px;text-align:center} .msg{max-width:620px;border:1px solid rgba(148,163,184,.34);border-radius:14px;background:rgba(17,24,39,.92);padding:20px} .msg h2{margin:0 0 8px;font-size:28px;color:#f3f4f6} .msg p{margin:0;color:#9ca3af;line-height:1.45}</style>' +
              '<div class="msg"><h2>Instance fermee</h2><p>Une autre fenetre game2.html a pris la main.</p></div>';
          } catch (err) { }
          try { window.location.replace("about:blank"); } catch (err) { }
        }, 50);
      }
      function handleGameSingletonClaim(payload) {
        if (!shouldYieldToGameInstance(payload)) return;
        closeThisGameInstanceAsDuplicate();
      }
      function broadcastGameSingletonClaim() {
        var payload = {
          type: "claim",
          id: gameSingletonId,
          openedAt: gameSingletonOpenedAt
        };
        if (gameSingletonChannel) {
          try { gameSingletonChannel.postMessage(payload); } catch (err) { }
        }
        try { localStorage.setItem(GAME_SINGLETON_STORAGE_KEY, JSON.stringify(payload)); } catch (err) { }
      }
      function startGameSingletonGuard() {
        if (typeof BroadcastChannel === "function") {
          try {
            gameSingletonChannel = new BroadcastChannel(GAME_SINGLETON_CHANNEL);
          } catch (err) {
            gameSingletonChannel = null;
          }
        }
        if (gameSingletonChannel) {
          gameSingletonChannel.onmessage = function (event) {
            handleGameSingletonClaim(event ? event.data : null);
          };
        }
        window.addEventListener("storage", function (event) {
          if (!event || event.key !== GAME_SINGLETON_STORAGE_KEY || !event.newValue) return;
          var payload = null;
          try { payload = JSON.parse(event.newValue); } catch (err) { payload = null; }
          handleGameSingletonClaim(payload);
        });
        broadcastGameSingletonClaim();
        setTimeout(broadcastGameSingletonClaim, 140);
      }
      function buildWidgetBridgeEnvelope(channel, payload) {
        return {
          scope: WIDGET_BRIDGE_SCOPE,
          channel: String(channel || "").trim().toLowerCase(),
          payload: payload && typeof payload === "object" ? payload : {},
          clientId: widgetBridgeClientId,
          ts: Date.now()
        };
      }
      function queueWidgetBridgeEnvelope(envelope) {
        if (!envelope || typeof envelope !== "object") return;
        widgetBridgeOutbox.push(envelope);
        if (widgetBridgeOutbox.length > 220) widgetBridgeOutbox.shift();
      }
      function flushWidgetBridgeOutbox() {
        var ws = telemetryWs;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        if (!widgetBridgeOutbox.length) return;
        var pending = widgetBridgeOutbox.slice();
        widgetBridgeOutbox.length = 0;
        pending.forEach(function (envelope) {
          try {
            ws.send(JSON.stringify(envelope));
          } catch (err) {
            queueWidgetBridgeEnvelope(envelope);
          }
        });
      }
      function sendWidgetBridgeMessage(channel, payload) {
        var envelope = buildWidgetBridgeEnvelope(channel, payload);
        if (!envelope.channel) return false;
        var ws = telemetryWs;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          queueWidgetBridgeEnvelope(envelope);
          return false;
        }
        try {
          ws.send(JSON.stringify(envelope));
          return true;
        } catch (err) {
          queueWidgetBridgeEnvelope(envelope);
          return false;
        }
      }
      function handleWidgetBridgeEnvelope(parsed) {
        if (!parsed || typeof parsed !== "object") return false;
        if (String(parsed.scope || "") !== WIDGET_BRIDGE_SCOPE) return false;
        if (String(parsed.clientId || "") === widgetBridgeClientId) return true;
        var channel = String(parsed.channel || "").trim().toLowerCase();
        var payload = parsed.payload && typeof parsed.payload === "object" ? parsed.payload : null;
        if (!payload) return true;
        if (channel === WIDGET_BRIDGE_CHANNEL_SAEIV) {
          handleSaeivBridgeData(payload);
          return true;
        }
        if (channel === WIDGET_BRIDGE_CHANNEL_WAZE) {
          if (String(payload.type || "") === "waze:request_state") {
            if (!activeBridgeDestinationPoint) {
              ensureSaeivRouteDestinationSynced(true);
            }
            if (!lastBridgeArrowPoint && telemetryLastSignal && typeof telemetryLastSignal === "object") {
              updateWazeBridgePoseFromTelemetry(telemetryLastSignal);
            }
            if (!lastBridgeArrowPoint) {
              ensureWazeBridgeStartPointFallback(null);
            }
            var published = false;
            if (activeBridgeDestinationPoint && lastBridgeArrowPoint) {
              published = publishActiveRouteFromState(true, { allowRecompute: true });
            }
            if (!published && lastWazeBridgePacket) {
              sendWidgetBridgeMessage(WIDGET_BRIDGE_CHANNEL_WAZE, lastWazeBridgePacket);
            }
          }
          return true;
        }
        return true;
      }
      function postSaeivBridgeMessage(message) {
        if (!message || typeof message !== "object") return false;
        var body = Object.assign({}, message, { sourceId: SAEIV_SOURCE_ID });
        return sendWidgetBridgeMessage(WIDGET_BRIDGE_CHANNEL_SAEIV, body);
      }
      function setBusStatusPassengerState(passengersInBus, updatedAtMs, serviceActive, serviceReady, boardingTotal, boardingDone, alightingTotal, alightingDone) {
        var n = Math.round(Number(passengersInBus));
        if (!Number.isFinite(n) || n < 0) return false;
        busStatusPassengerCount = n;
        if (typeof serviceActive === "boolean") {
          busStatusPassengerServiceActive = serviceActive;
        }
        if (typeof serviceReady === "boolean") {
          busStatusPassengerServiceReady = serviceReady;
        } else if (typeof serviceActive === "boolean") {
          busStatusPassengerServiceReady = !serviceActive;
        }
        var bTotal = Math.round(Number(boardingTotal));
        var bDone = Math.round(Number(boardingDone));
        var aTotal = Math.round(Number(alightingTotal));
        var aDone = Math.round(Number(alightingDone));
        if (Number.isFinite(bTotal) && bTotal >= 0) busStatusPassengerBoardingTotal = bTotal;
        if (Number.isFinite(bDone) && bDone >= 0) busStatusPassengerBoardingDone = bDone;
        if (Number.isFinite(aTotal) && aTotal >= 0) busStatusPassengerAlightingTotal = aTotal;
        if (Number.isFinite(aDone) && aDone >= 0) busStatusPassengerAlightingDone = aDone;
        var ts = Number(updatedAtMs);
        busStatusPassengerUpdatedAt = Number.isFinite(ts) && ts > 0 ? ts : Date.now();
        saeivLastStateKey = "";
        syncSaeivExternalState(true);
        return true;
      }
      function getBusStatusPassengerCountNow() {
        if (!Number.isFinite(Number(busStatusPassengerCount))) return null;
        var age = Date.now() - Number(busStatusPassengerUpdatedAt || 0);
        if (!Number.isFinite(age) || age < 0 || age > BUS_STATUS_PASSENGER_STATE_MAX_AGE_MS) return null;
        return Math.max(0, Math.round(Number(busStatusPassengerCount) || 0));
      }
      function getBusStatusPassengerServiceStateNow() {
        var age = Date.now() - Number(busStatusPassengerUpdatedAt || 0);
        if (!Number.isFinite(age) || age < 0 || age > BUS_STATUS_PASSENGER_STATE_MAX_AGE_MS) return null;
        var active = typeof busStatusPassengerServiceActive === "boolean" ? busStatusPassengerServiceActive : null;
        var ready = typeof busStatusPassengerServiceReady === "boolean" ? busStatusPassengerServiceReady : null;
        if (active === null && ready === null) return null;
        if (active === null && ready !== null) active = !ready;
        if (ready === null && active !== null) ready = !active;
        return {
          active: active === true,
          ready: ready === true,
          boardingTotal: Math.max(0, Math.round(Number(busStatusPassengerBoardingTotal) || 0)),
          boardingDone: Math.max(0, Math.round(Number(busStatusPassengerBoardingDone) || 0)),
          alightingTotal: Math.max(0, Math.round(Number(busStatusPassengerAlightingTotal) || 0)),
          alightingDone: Math.max(0, Math.round(Number(busStatusPassengerAlightingDone) || 0))
        };
      }
      function handleBusStatusWindowMessage(data) {
        if (!data || typeof data !== "object") return false;
        if (String(data.type || "") !== "bus_status:passenger_state") return false;
        return setBusStatusPassengerState(
          data.passengersInBus,
          data.ts,
          data.passengerServiceActive,
          data.passengerServiceReady,
          data.passengerBoardingTotal,
          data.passengerBoardingDone,
          data.passengerAlightingTotal,
          data.passengerAlightingDone
        );
      }
      function handleGameWindowMessage(event) {
        var data = event && event.data;
        if (handleBusStatusWindowMessage(data)) return;
        handleWidgetBridgeEnvelope(data);
      }
      function ensureBackgroundBusStatusRuntime() {
        if (!document.body) return false;
        var widgetId = typeof findWidgetIdByType === "function" ? findWidgetIdByType("bus_status") : null;
        var shouldRunBackground = !widgetId;
        var frame = document.getElementById(BUS_STATUS_BACKGROUND_IFRAME_ID);
        if (!shouldRunBackground) {
          if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
          return false;
        }
        if (frame) return true;
        frame = document.createElement("iframe");
        frame.id = BUS_STATUS_BACKGROUND_IFRAME_ID;
        frame.setAttribute("aria-hidden", "true");
        frame.tabIndex = -1;
        frame.style.position = "fixed";
        frame.style.left = "-9999px";
        frame.style.top = "-9999px";
        frame.style.width = "1px";
        frame.style.height = "1px";
        frame.style.opacity = "0";
        frame.style.pointerEvents = "none";
        frame.style.border = "0";
        frame.style.zIndex = "-1";
        frame.src = new URL("widgets/bus_status.html?host=game&source=game&background=1", location.href).href;
        document.body.appendChild(frame);
        return true;
      }
      function handleSaeivBridgeData(data) {
        if (!data || typeof data !== "object") return;
        if (String(data.sourceId || "") !== SAEIV_SOURCE_ID) return;
        var type = String(data.type || "").trim();
        if (type === "saeiv:catalog_request") {
          ensureDbusDataLoaded()
            .then(function () {
              var filter = String(data.filter || "").trim();
              postSaeivBridgeMessage({
                type: "saeiv:catalog",
                payload: {
                  routes: listLineRouteCatalog(filter)
                }
              });
            })
            .catch(function (err) {
              postSaeivBridgeMessage({
                type: "saeiv:action_result",
                action: "catalog_request",
                ok: false,
                error: String(err && err.message || err || "Chargement DBUS impossible.")
              });
            });
          return;
        }
        if (type === "saeiv:select_route") {
          var lineUid = String(data.lineUid || "").trim();
          var routeUid = String(data.routeUid || "").trim();
          if (!lineUid || !routeUid) {
            postSaeivBridgeMessage({
              type: "saeiv:action_result",
              action: "select_route",
              ok: false,
              error: "lineUid/routeUid manquants."
            });
            return;
          }
          Promise.all([
            ensureDbusDataLoaded(),
            ensureNavStopLinksLoaded().catch(function () { return new Map(); })
          ])
            .then(function () {
              var result = selectRouteByReferences(lineUid, routeUid, { uidOnly: true });
              postSaeivBridgeMessage(Object.assign({
                type: "saeiv:action_result",
                action: "select_route"
              }, result || { ok: false, error: "Selection impossible." }));
              syncSaeivExternalState(true);
            })
            .catch(function (err) {
              postSaeivBridgeMessage({
                type: "saeiv:action_result",
                action: "select_route",
                ok: false,
                error: String(err && err.message || err || "Chargement DBUS impossible.")
              });
            });
          return;
        }
        if (type === "saeiv:clear_route") {
          clearSaeivRouteSelection();
          postSaeivBridgeMessage({
            type: "saeiv:action_result",
            action: "clear_route",
            ok: true
          });
          return;
        }
        if (type === "saeiv:start_route") {
          var startResult = startSaeivSelectedRoute();
          postSaeivBridgeMessage(Object.assign({
            type: "saeiv:action_result",
            action: "start_route"
          }, startResult || { ok: false, error: "Demarrage impossible." }));
          syncSaeivExternalState(true);
          return;
        }
        if (type === "saeiv:service_accept_displayed") {
          if (typeof playSaeivServiceAcceptAudio === "function") {
            playSaeivServiceAcceptAudio();
          }
          return;
        }
        if (type === "saeiv:service_start_route") {
          var serviceLineUid = String(data.lineUid || "").trim();
          var serviceRouteUid = String(data.routeUid || "").trim();
          if (!serviceLineUid || !serviceRouteUid) {
            postSaeivBridgeMessage({
              type: "saeiv:action_result",
              action: "service_start_route",
              ok: false,
              error: "lineUid/routeUid manquants."
            });
            return;
          }
          Promise.all([
            ensureDbusDataLoaded(),
            ensureNavStopLinksLoaded().catch(function () { return new Map(); })
          ])
            .then(function () {
              var selectResult = selectRouteByReferences(serviceLineUid, serviceRouteUid, { uidOnly: true });
              if (!selectResult || selectResult.ok !== true) {
                postSaeivBridgeMessage(Object.assign({
                  type: "saeiv:action_result",
                  action: "service_start_route"
                }, selectResult || { ok: false, error: "Selection impossible." }));
                syncSaeivExternalState(true);
                return;
              }
              var serviceStartResult = startSaeivSelectedRoute();
              postSaeivBridgeMessage(Object.assign({
                type: "saeiv:action_result",
                action: "service_start_route",
                select: selectResult
              }, serviceStartResult || { ok: false, error: "Demarrage impossible." }));
              syncSaeivExternalState(true);
            })
            .catch(function (err) {
              postSaeivBridgeMessage({
                type: "saeiv:action_result",
                action: "service_start_route",
                ok: false,
                error: String(err && err.message || err || "Chargement DBUS impossible.")
              });
            });
          return;
        }
        if (type === "saeiv:request_state" || type === "saeiv:ready") {
          syncSaeivExternalState(true);
          return;
        }
        if (type === "saeiv:action") {
          saeivLastAction = String(data.action || "").trim();
          saeivLastStateKey = "";
          syncSaeivExternalState(true);
        }
      }
      function normalizeSearchToken(value) {
        return String(value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim();
      }
      function parseRouteName(name) {
        var raw = String(name || "").trim();
        var hasColon = raw.indexOf(":") !== -1;
        var parts = hasColon ? raw.split(":") : [raw];
        var lineNumber = String(parts[0] || "").replace(/\s*\([^)]*\)/g, "").trim();
        var routeTitle = hasColon
          ? raw.substring(raw.indexOf(":") + 1).trim()
          : raw;
        return {
          lineNumber: lineNumber,
          routeTitle: routeTitle
        };
      }
      function normalizeNavBridgeText(value) {
        return String(value || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      }
      function matchSaeivNavBridgeRule(rule, state) {
        if (!rule || !state) return false;
        var scope = (rule.scope && typeof rule.scope === "object") ? rule.scope : {};
        var lineNumber = String(state.lineNumber || "").trim();
        var routeName = String(state.routeName || "").trim();
        var routeUid = String(state.routeUid || "").trim();
        var lineUid = String(state.lineUid || "").trim();
        var parsed = parseRouteName(routeName);
        var parsedLineNumber = String(parsed.lineNumber || "").trim();
        var routeTitle = String(parsed.routeTitle || "").trim();

        if (scope.line != null) {
          var wantedLine = normalizeNavBridgeText(scope.line);
          var lineNorm = normalizeNavBridgeText(lineNumber);
          var parsedLineNorm = normalizeNavBridgeText(parsedLineNumber);
          var hasLineMatch = wantedLine && (
            lineNorm === wantedLine ||
            parsedLineNorm === wantedLine ||
            lineNorm.indexOf(wantedLine) !== -1 ||
            parsedLineNorm.indexOf(wantedLine) !== -1
          );
          if (!hasLineMatch) return false;
        }
        if (scope.direction != null) {
          var wantedDirection = normalizeNavBridgeText(scope.direction);
          var titleNorm = normalizeNavBridgeText(routeTitle);
          var routeNorm = normalizeNavBridgeText(routeName);
          var hasDirectionMatch = wantedDirection && (
            titleNorm === wantedDirection ||
            routeNorm === wantedDirection ||
            titleNorm.indexOf(wantedDirection) !== -1 ||
            routeNorm.indexOf(wantedDirection) !== -1
          );
          if (!hasDirectionMatch) return false;
        }
        if (scope.route_uid != null) {
          if (normalizeNavBridgeText(scope.route_uid) !== normalizeNavBridgeText(routeUid)) return false;
        }
        if (scope.line_uid != null) {
          if (normalizeNavBridgeText(scope.line_uid) !== normalizeNavBridgeText(lineUid)) return false;
        }
        return true;
      }
      function getActiveSaeivNavBridgeRule() {
        if (!saeivRouteState || typeof saeivRouteState !== "object") return null;
        if (!Array.isArray(navBridgeRules) || !navBridgeRules.length) return null;
        for (var i = 0; i < navBridgeRules.length; i += 1) {
          if (matchSaeivNavBridgeRule(navBridgeRules[i], saeivRouteState)) return navBridgeRules[i];
        }
        return null;
      }
      function getLineNumber(line, route) {
        var lineNumber = String((line && line.number) || "").trim();
        if (lineNumber && lineNumber !== "?") return lineNumber;
        var parsed = parseRouteName(route && route.name);
        var fallback = String(parsed.lineNumber || "").trim();
        return fallback || "?";
      }
      function normalizeSaeivTimeSystem(value) {
        var raw = String(value || "").trim().toLowerCase();
        if (raw === SAEIV_TIME_SYSTEM_IRL || raw === "irl") return SAEIV_TIME_SYSTEM_IRL;
        return SAEIV_TIME_SYSTEM_GAME;
      }
      function parseClockTextToSecondsOfDay(value) {
        var text = String(value || "").trim();
        var match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
        if (!match) return Number.NaN;
        var hh = Number(match[1]);
        var mm = Number(match[2]);
        var ss = Number(match[3] || 0);
        if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return Number.NaN;
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return Number.NaN;
        return (hh * 3600) + (mm * 60) + ss;
      }
      function parseTelemetryGameClockRaw(rawValue) {
        if (rawValue === undefined || rawValue === null) return null;
        if (typeof rawValue === "string") {
          var secs = parseClockTextToSecondsOfDay(rawValue);
          if (Number.isFinite(secs)) return { kind: "seconds", value: secs };
          var asNumber = Number(rawValue);
          if (Number.isFinite(asNumber)) rawValue = asNumber;
          else return null;
        }
        var n = Number(rawValue);
        if (!Number.isFinite(n)) return null;
        if (n >= 1e12) return { kind: "timestamp", value: Math.round(n) };
        if (n >= 0 && n <= 86400) return { kind: "seconds", value: Math.round(n) };
        var absInt = Math.abs(Math.round(n));
        if (absInt <= 2359) {
          var hhmmH = Math.floor(absInt / 100);
          var hhmmM = absInt % 100;
          if (hhmmH <= 23 && hhmmM <= 59) return { kind: "seconds", value: (hhmmH * 3600) + (hhmmM * 60) };
        }
        if (absInt <= 235959) {
          var hh = Math.floor(absInt / 10000);
          var mm = Math.floor((absInt % 10000) / 100);
          var ss = absInt % 100;
          if (hh <= 23 && mm <= 59 && ss <= 59) return { kind: "seconds", value: (hh * 3600) + (mm * 60) + ss };
        }
        return null;
      }
      function extractTelemetryGameClock(raw) {
        var payload = raw && typeof raw === "object" ? raw : null;
        if (!payload) return null;
        var pools = [payload, payload.data, payload.payload];
        var keys = [
          "gameTimeSim",
          "game_time_sim",
          "gameTime",
          "simTime",
          "timeSim"
        ];
        for (var i = 0; i < pools.length; i += 1) {
          var src = pools[i];
          if (!src || typeof src !== "object") continue;
          for (var k = 0; k < keys.length; k += 1) {
            var key = keys[k];
            if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
            var parsed = parseTelemetryGameClockRaw(src[key]);
            if (parsed) return parsed;
          }
        }
        return null;
      }
      function secondsOfDayToTimestampMs(secondsOfDay, fallbackTsMs) {
        var sec = Number(secondsOfDay);
        if (!Number.isFinite(sec)) return Number.NaN;
        sec = Math.max(0, Math.min(86399, Math.round(sec)));
        var baseNow = Date.now();
        var d = new Date(baseNow);
        var midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        var candidate = midnight + (sec * 1000);
        var prev = Number(fallbackTsMs);
        if (Number.isFinite(prev)) {
          var diff = candidate - prev;
          if (diff > 43200000) candidate -= 86400000;
          else if (diff < -43200000) candidate += 86400000;
        }
        return candidate;
      }
      function updateSaeivGameClockFromTelemetry(raw) {
        var clock = extractTelemetryGameClock(raw);
        if (!clock) return false;
        if (clock.kind === "timestamp") {
          saeivGameClockNowMs = Number(clock.value);
          saeivGameClockLastSourceTsMs = Number(clock.value);
          saeivGameClockLastWallNowMs = Date.now();
          return true;
        }
        if (clock.kind === "seconds") {
          var resolvedTs = secondsOfDayToTimestampMs(clock.value, saeivGameClockLastSourceTsMs);
          if (!Number.isFinite(resolvedTs)) return false;
          saeivGameClockNowMs = resolvedTs;
          saeivGameClockLastSourceTsMs = resolvedTs;
          saeivGameClockLastWallNowMs = Date.now();
          return true;
        }
        return false;
      }
      function getSaeivNowTimestampMs() {
        if (normalizeSaeivTimeSystem(saeivTimeSystem) === SAEIV_TIME_SYSTEM_IRL) {
          var now = Date.now() - saeivIrlPauseTotalMs;
          if (saeivIrlPauseStartAtMs > 0) {
            now -= (Date.now() - saeivIrlPauseStartAtMs);
          }
          return now;
        }
        var simNow = Number(saeivGameClockNowMs);
        if (Number.isFinite(simNow) && simNow > 0) return simNow;
        return Date.now();
      }
      function formatSaeivTimeForSelect(ms) {
        var date = new Date(ms);
        var h = String(date.getHours()).padStart(2, '0');
        var m = String(date.getMinutes()).padStart(2, '0');
        return h + ":" + m;
      }
      function syncSaeivTimeSystemUi() {
        if (!el.overlayTimeSystem || !el.overlayTimeSystemDisplay) return;
        var currentVal = normalizeSaeivTimeSystem(saeivTimeSystem);
        el.overlayTimeSystem.value = currentVal;

        var wallNow = Date.now();
        var irlTime = wallNow - saeivIrlPauseTotalMs;
        if (saeivIrlPauseStartAtMs > 0) irlTime -= (wallNow - saeivIrlPauseStartAtMs);

        var gameTime;
        if (Number.isFinite(saeivGameClockNowMs) && Number.isFinite(saeivGameClockLastWallNowMs)) {
          var elapsed = wallNow - saeivGameClockLastWallNowMs;
          if (typeof telemetryPaused !== "undefined" && telemetryPaused) elapsed = 0;
          gameTime = saeivGameClockNowMs + elapsed;
        } else {
          gameTime = wallNow;
        }

        var irlStr = formatSaeivTimeForSelect(irlTime);
        var gameStr = formatSaeivTimeForSelect(gameTime);

        // Update main display
        if (el.overlayTimeSystemLabel) el.overlayTimeSystemLabel.textContent = currentVal === "irl" ? "IRL" : "EN JEU";
        if (el.overlayTimeSystemClock) el.overlayTimeSystemClock.textContent = currentVal === "irl" ? irlStr : gameStr;

        // Update menu items
        if (el.overlayTimeSystemMenu) {
          var items = el.overlayTimeSystemMenu.querySelectorAll(".manager-widget-menu-item");
          items.forEach(function (item) {
            var val = item.dataset.value;
            var clockSpan = item.querySelector(".menu-item-clock");
            if (clockSpan) clockSpan.textContent = (val === "irl" ? irlStr : gameStr);
          });
        }
      }
      function applySaeivTimeSystem(value, options) {
        var opts = options && typeof options === "object" ? options : {};
        saeivTimeSystem = normalizeSaeivTimeSystem(value);
        if (opts.syncUi !== false) syncSaeivTimeSystemUi();
        if (saeivForcedStateRefreshTimer) startSaeivForcedStateRefresh();
        if (opts.persist !== false) {
          try { localStorage.setItem(SAEIV_TIME_SYSTEM_STORAGE_KEY, normalizeSaeivTimeSystem(saeivTimeSystem)); } catch (err) { }
        }
      }
      function restoreSaeivTimeSystemFromStorage() {
        var raw = "";
        try { raw = String(localStorage.getItem(SAEIV_TIME_SYSTEM_STORAGE_KEY) || ""); } catch (err) { raw = ""; }
        var normalized = normalizeSaeivTimeSystem(raw || SAEIV_TIME_SYSTEM_DEFAULT);
        applySaeivTimeSystem(normalized, { syncUi: true, persist: false });
      }
      function getSaeivClockText() {
        var now = new Date(getSaeivNowTimestampMs());
        var hh = String(now.getHours()).padStart(2, "0");
        var mm = String(now.getMinutes()).padStart(2, "0");
        return hh + ":" + mm;
      }
      function formatClockTextFromTimestamp(tsMs) {
        var ts = Number(tsMs);
        if (!Number.isFinite(ts) || ts <= 0) return getSaeivClockText();
        var date = new Date(ts);
        var hh = String(date.getHours()).padStart(2, "0");
        var mm = String(date.getMinutes()).padStart(2, "0");
        return hh + ":" + mm;
      }
      function computeSaeivPlannedArrivalTimestampMs(entries, stopIndex) {
        var list = Array.isArray(entries) ? entries : [];
        var idxRaw = Number(stopIndex);
        if (!list.length || !Number.isFinite(idxRaw)) return Number.NaN;
        var idx = Math.max(0, Math.min(list.length - 1, Math.floor(idxRaw)));
        var routeStartAt = Number(saeivRouteSelectedAtMs);
        if (!Number.isFinite(routeStartAt) || routeStartAt <= 0) routeStartAt = getSaeivNowTimestampMs();
        var cumulatedMinutes = 0;
        // `nextStopTime` = temps vers l'arret suivant.
        // Pour l'arrivee a l'arret `idx`, on cumule uniquement les segments precedents [0..idx-1].
        for (var i = 0; i < idx; i += 1) {
          var segmentMinutes = Number(list[i] && list[i].nextStopTime);
          if (!Number.isFinite(segmentMinutes) || segmentMinutes <= 0) continue;
          cumulatedMinutes += segmentMinutes;
        }
        return routeStartAt + Math.round(cumulatedMinutes * 60000);
      }
      function computeSaeivRefArrivalTimestampMs(entries, displayIndex, reachedIndex, targetIndex, vehiclePoint) {
        // L'heure "prévue" (Scheduled/Planned) doit rester fixe pour servir de référence.
        // En mode IRL, plannedTs est déjà ancré à l'heure de départ réelle du trajet.
        return computeSaeivPlannedArrivalTimestampMs(entries, displayIndex);
      }
      function computeSaeivDelayMinutesByTimestamp(actualTsMs, plannedTsMs) {
        var actual = Number(actualTsMs);
        var planned = Number(plannedTsMs);
        if (!Number.isFinite(actual) || !Number.isFinite(planned) || planned <= 0) return Number.NaN;
        return (actual - planned) / 60000;
      }
      function recordReachedStopStats(entries, reachedIndex, atTimestampMs) {
        var list = Array.isArray(entries) ? entries : [];
        var idx = Number(reachedIndex);
        if (!list.length || !Number.isFinite(idx)) return false;
        var nowTs = Number(atTimestampMs);
        if (!Number.isFinite(nowTs) || nowTs <= 0) nowTs = getSaeivNowTimestampMs();
        var lastIndex = list.length - 1;
        var clamped = Math.max(0, Math.min(lastIndex, Math.floor(idx)));
        if (clamped <= saeivStatsRecordedReachedIndex) return false;
        for (var i = saeivStatsRecordedReachedIndex + 1; i <= clamped; i += 1) {
          var plannedTs = computeSaeivPlannedArrivalTimestampMs(list, i);
          var deltaMin = computeSaeivDelayMinutesByTimestamp(nowTs, plannedTs);
          saeivReachedStopsCount += 1;
          if (Number.isFinite(deltaMin) && deltaMin > 0.5) saeivLateStopsCount += 1;

          // DEFINITION: served = marked in saeivStopServedLog (real-time tracking).
          // Un arrêt est considéré comme “desservi” uniquement si tous les passagers ont été traités.
          if (!saeivPassengerState || saeivStopServedLog[i] === true) {
            saeivServedStopsCount += 1;
          }
        }
        saeivStatsRecordedReachedIndex = clamped;
        if (saeivReachedStopsCount > list.length) saeivReachedStopsCount = list.length;
        if (saeivServedStopsCount > list.length) saeivServedStopsCount = list.length;
        return true;
      }
      function parsePassengerNumber(value, fallback) {
        var n = Number(value);
        if (!Number.isFinite(n)) n = Number(fallback);
        if (!Number.isFinite(n)) n = 0;
        return n;
      }
      function hasPassengerOverrides(options) {
        return !!(
          options &&
          typeof options === "object" &&
          (
            Object.prototype.hasOwnProperty.call(options, "passengersMin") ||
            Object.prototype.hasOwnProperty.call(options, "passengersMax") ||
            Object.prototype.hasOwnProperty.call(options, "coefOn")
          )
        );
      }
      function normalizeSaeivPassengerConfig(options, fallback) {
        var base = fallback && typeof fallback === "object" ? fallback : saeivPassengerDefaults;
        var minRaw = parsePassengerNumber(options && options.passengersMin, base && base.passengersMin);
        var maxRaw = parsePassengerNumber(options && options.passengersMax, base && base.passengersMax);
        var coefRaw = parsePassengerNumber(options && options.coefOn, base && base.coefOn);
        var passengersMin = Math.max(0, Math.round(minRaw));
        var passengersMax = Math.max(passengersMin, Math.round(maxRaw));
        var coefOn = Math.max(0, Math.min(100, coefRaw));
        return {
          passengersMin: passengersMin,
          passengersMax: passengersMax,
          coefOn: coefOn
        };
      }
      function deriveSaeivPassengerConfigFromEntries(entries, fallback) {
        var base = normalizeSaeivPassengerConfig(null, fallback && typeof fallback === "object" ? fallback : {
          passengersMin: 0,
          passengersMax: 0,
          coefOn: 0
        });
        var list = Array.isArray(entries) ? entries : [];
        var selectedMin = Number.NaN;
        var selectedMax = Number.NaN;
        var selectedCoef = Number.NaN;
        for (var i = 0; i < list.length; i += 1) {
          var entry = list[i];
          var minVal = Number(entry && entry.passengersMin);
          var maxVal = Number(entry && entry.passengersMax);
          var coefVal = Number(entry && entry.coefOn);
          if (!Number.isFinite(selectedMin) && Number.isFinite(minVal)) selectedMin = minVal;
          if (!Number.isFinite(selectedMax) && Number.isFinite(maxVal)) selectedMax = maxVal;
          if (!Number.isFinite(selectedCoef) && Number.isFinite(coefVal)) selectedCoef = coefVal;
          if (Number.isFinite(selectedMin) && Number.isFinite(selectedMax) && Number.isFinite(selectedCoef)) break;
        }
        return normalizeSaeivPassengerConfig({
          passengersMin: Number.isFinite(selectedMin) ? selectedMin : base.passengersMin,
          passengersMax: Number.isFinite(selectedMax) ? selectedMax : base.passengersMax,
          coefOn: Number.isFinite(selectedCoef) ? selectedCoef : base.coefOn
        }, base);
      }
      function isSaeivPeakPassengerMinute(minuteOfDay) {
        var m = Number(minuteOfDay);
        if (!Number.isFinite(m)) return false;
        return (m >= SAEIV_PASSENGER_PEAK_AM_START_MIN && m < SAEIV_PASSENGER_PEAK_AM_END_MIN) ||
          (m >= SAEIV_PASSENGER_PEAK_PM_START_MIN && m < SAEIV_PASSENGER_PEAK_PM_END_MIN);
      }
      function isSaeivPeakPassengerTime(nowTsMs) {
        var ts = Number(nowTsMs);
        if (!Number.isFinite(ts) || ts <= 0) ts = Date.now();
        var date = new Date(ts);
        var minuteOfDay = (date.getHours() * 60) + date.getMinutes() + (date.getSeconds() / 60);
        return isSaeivPeakPassengerMinute(minuteOfDay);
      }
      function pickRandomIntegerInRange(minInclusive, maxInclusive) {
        var minVal = Math.max(0, Math.round(Number(minInclusive) || 0));
        var maxVal = Math.max(minVal, Math.round(Number(maxInclusive) || 0));
        return minVal + Math.floor(Math.random() * ((maxVal - minVal) + 1));
      }
      function pickSignedRandomIntegerInRange(minInclusive, maxInclusive) {
        var minVal = Math.round(Number(minInclusive) || 0);
        var maxVal = Math.round(Number(maxInclusive) || 0);
        var from = Math.min(minVal, maxVal);
        var to = Math.max(minVal, maxVal);
        return from + Math.floor(Math.random() * ((to - from) + 1));
      }
      function getActiveSaeivPassengerCountVariationRange() {
        var config = typeof getActiveSaeivLineAudioConfig === "function" ? getActiveSaeivLineAudioConfig() : null;
        var minVal = Math.round(Number(config && config.passengerCountVariationMin));
        var maxVal = Math.round(Number(config && config.passengerCountVariationMax));
        if (!Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
          return { min: 0, max: 0 };
        }
        return {
          min: Math.min(minVal, maxVal),
          max: Math.max(minVal, maxVal)
        };
      }
      function applySaeivPassengerLineVariation(total) {
        var base = Math.max(0, Math.round(Number(total) || 0));
        var range = getActiveSaeivPassengerCountVariationRange();
        if (!range || (range.min === 0 && range.max === 0)) return base;
        return Math.max(0, base + pickSignedRandomIntegerInRange(range.min, range.max));
      }
      function pickSaeivPassengerSpawnCount(passengersMin, passengersMax, nowTsMs) {
        var minVal = Math.max(0, Math.round(Number(passengersMin) || 0));
        var maxVal = Math.max(minVal, Math.round(Number(passengersMax) || 0));
        var isPeak = isSaeivPeakPassengerTime(nowTsMs);
        var spawnMin = minVal;
        var spawnMax = maxVal;

        if (isPeak) {
          if (maxVal > SAEIV_PASSENGER_SMALL_VALUE_THRESHOLD) {
            var coefA = Math.max(1, Math.ceil(maxVal / SAEIV_PASSENGER_PEAK_RANGE_DIVISOR));
            spawnMin = Math.max(minVal, maxVal - coefA);
            spawnMax = maxVal;
          } else {
            // Small values only: simple direct range without coefficient.
            spawnMin = minVal;
            spawnMax = maxVal;
          }
        } else {
          if (minVal > SAEIV_PASSENGER_SMALL_VALUE_THRESHOLD) {
            var coefB = Math.max(1, Math.ceil(minVal / SAEIV_PASSENGER_PEAK_RANGE_DIVISOR));
            spawnMin = minVal;
            spawnMax = Math.min(maxVal, minVal + coefB);
          } else if (maxVal > SAEIV_PASSENGER_SMALL_VALUE_THRESHOLD) {
            // Common dataset fallback (min often 0): keep off-peak low but non-zero.
            var coefFallback = Math.max(1, Math.ceil(maxVal / SAEIV_PASSENGER_PEAK_RANGE_DIVISOR));
            spawnMin = minVal;
            spawnMax = Math.min(maxVal, minVal + coefFallback);
          } else {
            // Small values only: simple direct range without coefficient.
            spawnMin = minVal;
            spawnMax = maxVal;
          }
        }

        spawnMin = Math.max(minVal, Math.round(spawnMin));
        spawnMax = Math.min(maxVal, Math.round(spawnMax));
        if (spawnMax < spawnMin) spawnMax = spawnMin;
        return pickRandomIntegerInRange(spawnMin, spawnMax);
      }
      function computeSaeivPassengersAtStopValue(config, stopIndex, lastIndex, stopEntry) {
        var cfg = config && typeof config === "object" ? config : saeivPassengerDefaults;
        var idx = Number(stopIndex);
        var tail = Number(lastIndex);
        var entry = stopEntry && typeof stopEntry === "object" ? stopEntry : null;

        var pMin = Math.max(0, Number.isFinite(Number(entry && entry.passengersMin)) ? Number(entry.passengersMin) : (Number(cfg.passengersMin) || 0));
        var pMax = Math.max(pMin, Number.isFinite(Number(entry && entry.passengersMax)) ? Number(entry.passengersMax) : (Number(cfg.passengersMax) || 10));
        var cOn = Math.max(0, Math.min(100, Number.isFinite(Number(entry && entry.coefOn)) ? Number(entry.coefOn) : (Number(cfg.coefOn) || 75)));

        // Terminus: keep spawned pools at 0; actual alighting is computed from real in-bus count.
        if (Number.isFinite(idx) && Number.isFinite(tail) && idx >= tail) {
          return { board: 0, alight: 0 };
        }

        var nowTs = getSaeivNowTimestampMs();
        var totalN = applySaeivPassengerLineVariation(pickSaeivPassengerSpawnCount(pMin, pMax, nowTs));

        var board = 0;
        var alight = 0;
        for (var i = 0; i < totalN; i++) {
          if ((Math.random() * 100) < cOn) {
            board++;
          } else {
            alight++;
          }
        }

        return { board: board, alight: alight };
      }
      function resolveSaeivPassengerConfigForStop(baseConfig, stopEntry) {
        var base = normalizeSaeivPassengerConfig(baseConfig, saeivPassengerDefaults);
        var entry = stopEntry && typeof stopEntry === "object" ? stopEntry : null;
        return normalizeSaeivPassengerConfig({
          passengersMin: Number.isFinite(Number(entry && entry.passengersMin)) ? Number(entry.passengersMin) : base.passengersMin,
          passengersMax: Number.isFinite(Number(entry && entry.passengersMax)) ? Number(entry.passengersMax) : base.passengersMax,
          coefOn: Number.isFinite(Number(entry && entry.coefOn)) ? Number(entry.coefOn) : base.coefOn
        }, base);
      }
      function isSaeivStopOptionalByConfig(configOrEntry) {
        var config = normalizeSaeivPassengerConfig(configOrEntry, saeivPassengerDefaults);
        return Number(config.passengersMin) <= 0 || Number(config.passengersMax) <= 0;
      }
      function computeSaeivStopNecessaryState(stateLike, currentAtStop, currentRequestedDrop, currentInBus, isTerminus) {
        var atStop = Math.max(0, Math.round(Number(currentAtStop) || 0));
        var requestedDrop = Math.max(0, Math.round(Number(currentRequestedDrop) || 0));
        var inBus = Math.max(0, Math.round(Number(currentInBus) || 0));
        var latentAlightTotal = Math.max(0, Math.round(Number(stateLike && stateLike.stopAlightingTotal) || 0));
        var latentAlightDone = Math.max(0, Math.round(Number(stateLike && stateLike.stopAlightingDone) || 0));
        var plannedAlightTotal = Math.max(0, Math.round(Number(stateLike && stateLike.plannedStopAlightingTotal) || 0));
        var latentAlightRemaining = Math.max(0, Math.max(latentAlightTotal, plannedAlightTotal) - latentAlightDone);
        if (isTerminus === true) return inBus > 0;
        if (requestedDrop > 0) return true;
        if (stateLike && stateLike.stopOptionalByConfig === true) return false;
        return atStop > 0 || latentAlightRemaining > 0;
      }
      function createSaeivPassengerState(options, entries, targetIndex) {
        if (SAEIV_PASSENGERS_ENABLED !== true) return null;
        var config = normalizeSaeivPassengerConfig(options, saeivPassengerDefaults);
        var list = Array.isArray(entries) ? entries : [];
        var lastIndex = Math.max(0, list.length - 1);
        var idx = clampRouteStopIndex(targetIndex, lastIndex);
        var entry = list[idx] || null;
        var uid = String(list[idx] && list[idx].uid || "");
        var stopConfig = resolveSaeivPassengerConfigForStop(config, entry);
        var counts = computeSaeivPassengersAtStopValue(stopConfig, idx, lastIndex, entry);
        var initialPlannedBoard = Math.max(0, Math.round(Number(counts.board) || 0));
        var initialPlannedAlight = 0;
        var stopOptionalByConfig = idx > 0 && idx < lastIndex && initialPlannedBoard <= 0 && initialPlannedAlight <= 0;
        return {
          passengersMin: stopConfig.passengersMin,
          passengersMax: stopConfig.passengersMax,
          coefOn: stopConfig.coefOn,
          passengersInBus: 0,
          passengersAtStop: initialPlannedBoard,
          stopBoardingTotal: initialPlannedBoard,
          stopBoardingDone: 0,
          stopAlightingTotal: initialPlannedAlight,
          stopAlightingDone: 0,
          plannedStopBoardingTotal: initialPlannedBoard,
          plannedStopAlightingTotal: initialPlannedAlight,
          stopOptionalByPlan: stopOptionalByConfig,
          stopServiceProgressInitialized: false,
          stopRequested: false,
          requestedDropCount: 0,
          stopOptionalByConfig: stopOptionalByConfig,
          stopNecessary: computeSaeivStopNecessaryState({
            stopOptionalByConfig: stopOptionalByConfig,
            stopAlightingTotal: initialPlannedAlight,
            stopAlightingDone: 0
          }, initialPlannedBoard, 0, 0, false),
          transportedPassengers: 0,
          missedStops: 0,
          targetIndex: idx,
          targetUid: uid,
          targetMinDistanceM: Number.POSITIVE_INFINITY,
          lastRequestRollAtMs: 0,
          lastBoardStepAtMs: 0,
          lastAlightStepAtMs: 0
        };
      }
      function resetSaeivPassengerTargetState(entries, targetIndex) {
        if (SAEIV_PASSENGERS_ENABLED !== true) return false;
        if (!saeivPassengerState || typeof saeivPassengerState !== "object") return false;
        var list = Array.isArray(entries) ? entries : [];
        if (!list.length) return false;
        var lastIndex = list.length - 1;
        var idx = clampRouteStopIndex(targetIndex, lastIndex);
        var entry = list[idx] || null;
        var uid = String(entry && entry.uid || "");
        var sameTarget = Number(saeivPassengerState.targetIndex) === idx && String(saeivPassengerState.targetUid || "") === uid;
        if (sameTarget) return false;
        saeivPassengerState.targetIndex = idx;
        saeivPassengerState.targetUid = uid;
        saeivPassengerState.targetMinDistanceM = Number.POSITIVE_INFINITY;
        saeivPassengerState.lastRequestRollAtMs = 0;
        saeivPassengerState.lastBoardStepAtMs = 0;
        saeivPassengerState.lastAlightStepAtMs = 0;
        saeivPassengerState.stopBoardingTotal = 0;
        saeivPassengerState.stopBoardingDone = 0;
        saeivPassengerState.stopAlightingTotal = 0;
        saeivPassengerState.stopAlightingDone = 0;
        saeivPassengerState.stopServiceProgressInitialized = false;
        saeivPassengerState.stopRequested = false;
        saeivPassengerState.requestedDropCount = 0;
        var stopConfig = resolveSaeivPassengerConfigForStop(saeivPassengerState, entry);
        saeivPassengerState.passengersMin = stopConfig.passengersMin;
        saeivPassengerState.passengersMax = stopConfig.passengersMax;
        saeivPassengerState.coefOn = stopConfig.coefOn;
        saeivPassengerState.stopOptionalByConfig = isSaeivStopOptionalByConfig(stopConfig);
        var counts = computeSaeivPassengersAtStopValue(stopConfig, idx, lastIndex, entry);
        var plannedBoard = Math.max(0, Math.round(Number(counts.board) || 0));
        var plannedAlight = Math.min(
          Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0)),
          Math.max(0, Math.round(Number(counts.alight) || 0))
        );
        var stopOptionalByPlan = idx > 0 && idx < lastIndex && plannedBoard <= 0 && plannedAlight <= 0;
        saeivPassengerState.stopOptionalByConfig = stopOptionalByPlan;
        saeivPassengerState.stopOptionalByPlan = stopOptionalByPlan;
        saeivPassengerState.passengersAtStop = plannedBoard;
        saeivPassengerState.stopBoardingTotal = plannedBoard;
        saeivPassengerState.stopAlightingTotal = plannedAlight;
        saeivPassengerState.plannedStopBoardingTotal = plannedBoard;
        saeivPassengerState.plannedStopAlightingTotal = plannedAlight;
        saeivPassengerState.stopNecessary = computeSaeivStopNecessaryState(saeivPassengerState, plannedBoard, 0, saeivPassengerState.passengersInBus, false);
        return true;
      }
      function syncSaeivPassengerStateFromBusStatusCount() {
        if (SAEIV_PASSENGERS_ENABLED !== true) return false;
        if (!saeivPassengerState || typeof saeivPassengerState !== "object") return false;
        var externalCount = getBusStatusPassengerCountNow();
        if (externalCount === null) return false;
        var inBus = Math.max(0, Math.round(Number(externalCount) || 0));
        var changed = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0)) !== inBus;
        saeivPassengerState.passengersInBus = inBus;
        if (inBus > saeivMaxPassengersEverInBus) saeivMaxPassengersEverInBus = inBus;

        var plannedDrop = Math.max(0, Math.round(Number(saeivPassengerState.plannedStopAlightingTotal) || 0));
        if (plannedDrop > inBus) {
          plannedDrop = inBus;
          saeivPassengerState.plannedStopAlightingTotal = plannedDrop;
          if (Math.max(0, Math.round(Number(saeivPassengerState.stopAlightingTotal) || 0)) > plannedDrop) {
            saeivPassengerState.stopAlightingTotal = plannedDrop;
          }
          changed = true;
        }

        var requestedDrop = Math.max(0, Math.round(Number(saeivPassengerState.requestedDropCount) || 0));
        var maxRequestedDrop = Math.min(inBus, plannedDrop);
        if (requestedDrop > maxRequestedDrop) {
          requestedDrop = maxRequestedDrop;
          saeivPassengerState.requestedDropCount = requestedDrop;
          changed = true;
        }
        if (requestedDrop <= 0 && saeivPassengerState.stopRequested === true) {
          saeivPassengerState.stopRequested = false;
          changed = true;
        }
        if (changed) {
          saeivPassengerState.stopNecessary = computeSaeivStopNecessaryState(
            saeivPassengerState,
            saeivPassengerState.passengersAtStop,
            saeivPassengerState.requestedDropCount,
            inBus,
            false
          );
          saeivLastStateKey = "";
        }
        return changed;
      }
      function getSaeivPassengerRemainingRequestedDropCount(targetIndex, targetUid) {
        if (SAEIV_PASSENGERS_ENABLED !== true) return 0;
        if (!saeivPassengerState || typeof saeivPassengerState !== "object") return 0;
        syncSaeivPassengerStateFromBusStatusCount();
        var expectedIndex = Math.floor(Number(targetIndex));
        if (Number.isFinite(expectedIndex) && Math.floor(Number(saeivPassengerState.targetIndex)) !== expectedIndex) return 0;
        var expectedUid = String(targetUid || "");
        var stateUid = String(saeivPassengerState.targetUid || "");
        if (expectedUid && stateUid && expectedUid !== stateUid) return 0;
        if (saeivPassengerState.stopRequested !== true) return 0;
        var requestedDrop = Math.max(0, Math.round(Number(saeivPassengerState.requestedDropCount) || 0));
        var plannedDrop = Math.max(0, Math.round(Number(saeivPassengerState.plannedStopAlightingTotal) || 0));
        var inBus = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0));
        var remaining = Math.min(requestedDrop, plannedDrop, inBus);
        if (remaining <= 0) {
          saeivPassengerState.stopRequested = false;
          saeivPassengerState.requestedDropCount = 0;
          saeivLastStateKey = "";
          return 0;
        }
        return remaining;
      }
      function maybeRollSaeivStopRequested(targetDistanceM, nowMs, isTerminus) {
        if (SAEIV_PASSENGERS_ENABLED !== true) return false;
        if (!saeivPassengerState || typeof saeivPassengerState !== "object") return false;
        if (isTerminus) return false;
        if (saeivPassengerState.stopRequested === true) return false;
        syncSaeivPassengerStateFromBusStatusCount();
        var inBus = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0));
        if (inBus <= 0) return false;
        var plannedDrop = Math.min(
          inBus,
          Math.max(0, Math.round(Number(saeivPassengerState.plannedStopAlightingTotal) || 0))
        );
        if (plannedDrop <= 0) return false;
        var distance = Number(targetDistanceM);
        if (!Number.isFinite(distance) || distance <= Number(SAEIV_STOP_REQUEST_MIN_DISTANCE_M) || distance < 0) return false;
        var now = Number(nowMs);
        if (!Number.isFinite(now) || now <= 0) now = Date.now();
        var lastRollAt = Number(saeivPassengerState.lastRequestRollAtMs) || 0;
        if ((now - lastRollAt) < Number(SAEIV_STOP_REQUEST_ROLL_INTERVAL_MS)) return false;
        saeivPassengerState.lastRequestRollAtMs = now;
        var chance = Math.max(0, Math.min(0.85, Number(SAEIV_STOP_REQUEST_BASE_CHANCE) + Math.min(0.33, inBus / 170)));
        if (Math.random() > chance) return false;
        var requestedCount = Math.min(inBus, plannedDrop);
        saeivPassengerState.requestedDropCount = Math.max(1, requestedCount);
        saeivPassengerState.stopRequested = true;
        saeivPassengerState.stopOptionalByConfig = false;
        saeivPassengerState.stopOptionalByPlan = false;
        saeivPassengerState.stopNecessary = true;
        return true;
      }
      function applySaeivStopPassengerService(stopIndex, stopServed, isTerminus) {
        if (SAEIV_PASSENGERS_ENABLED !== true) return false;
        if (!saeivPassengerState || typeof saeivPassengerState !== "object") return false;
        var served = stopServed === true;
        var hasPeopleAtStop = Math.max(0, Math.round(Number(saeivPassengerState.passengersAtStop) || 0)) > 0;
        var hasRequestedDrop = saeivPassengerState.stopRequested === true;
        if (!served) {
          var requestedDropCount = Math.max(0, Math.round(Number(saeivPassengerState.requestedDropCount) || 0));
          var hasMissedWork = computeSaeivStopNecessaryState(saeivPassengerState, hasPeopleAtStop ? 1 : 0, requestedDropCount, saeivPassengerState.passengersInBus, isTerminus) === true;
          if (hasMissedWork) {
            saeivPassengerState.missedStops = Math.max(0, Math.round(Number(saeivPassengerState.missedStops) || 0)) + 1;
          }
          saeivPassengerState.stopNecessary = hasMissedWork;
          return false;
        }
        var inBus = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0));
        if (isTerminus) {
          saeivPassengerState.passengersAtStop = 0;
          saeivPassengerState.stopBoardingTotal = 0;
          // On s'assure que stopAlightingTotal couvre tout le bus
          var currentInBus = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0));
          saeivPassengerState.stopAlightingTotal = currentInBus;
          saeivPassengerState.stopRequested = false;
          saeivPassengerState.requestedDropCount = 0;
          saeivPassengerState.stopNecessary = currentInBus > 0;
          return true;
        }
        saeivPassengerState.passengersInBus = inBus;
        saeivPassengerState.stopNecessary = computeSaeivStopNecessaryState(
          saeivPassengerState,
          saeivPassengerState.passengersAtStop,
          saeivPassengerState.requestedDropCount,
          inBus,
          isTerminus
        );
        return true;
      }
      function processSaeivPassengerServiceTick(stopIndex, options) {
        if (SAEIV_PASSENGERS_ENABLED !== true) {
          return { completed: true, changed: false };
        }
        if (!saeivPassengerState || typeof saeivPassengerState !== "object") {
          return { completed: true, changed: false };
        }
        var opts = options && typeof options === "object" ? options : {};
        var inReach = opts.inReach === true;
        var isStopped = opts.isStopped === true;
        var isTerminus = opts.isTerminus === true;
        var now = Number(opts.nowMs);
        if (!Number.isFinite(now) || now <= 0) now = Date.now();
        var changed = false;
        var prevInBus = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0));
        var inBus = prevInBus;
        var activeCapacity = getSaeivActiveCapacityState(saeivVehicleName);
        var busCapacity = Math.max(1, Math.round(Number(activeCapacity.capacity) || SAEIV_BUS_UNLISTED_CAPACITY_DEFAULT));
        var busCapacityUnlimited = activeCapacity.unlimited === true;
        var externalPassengerCount = getBusStatusPassengerCountNow();
        var useExternalPassengerCount = externalPassengerCount !== null;
        if (useExternalPassengerCount) {
          inBus = Math.max(0, Math.round(Number(externalPassengerCount) || 0));
          var delta = inBus - prevInBus;
          if (delta > 0) {
            // External boarding: decrement passengers at stop AND increment transported sum
            saeivPassengerState.passengersAtStop = Math.max(0, Math.round(Number(saeivPassengerState.passengersAtStop) || 0) - delta);
            saeivPassengerState.transportedPassengers = Math.max(0, Math.round(Number(saeivPassengerState.transportedPassengers) || 0)) + delta;
          } else if (delta < 0) {
            // External alighting
            var alighted = Math.abs(delta);
            saeivPassengerState.requestedDropCount = Math.max(0, Math.round(Number(saeivPassengerState.requestedDropCount) || 0) - alighted);
          }
        }
        // CRITICAL: Always persist and track high-water mark
        saeivPassengerState.passengersInBus = inBus;
        if (inBus > saeivMaxPassengersEverInBus) saeivMaxPassengersEverInBus = inBus;

        var atStop = Math.max(0, Math.round(Number(saeivPassengerState.passengersAtStop) || 0));
        var hasRequestedDrop = saeivPassengerState.stopRequested === true;
        var requestedCount = Math.max(0, Math.round(Number(saeivPassengerState.requestedDropCount) || 0));
        if (!hasRequestedDrop || requestedCount <= 0) {
          hasRequestedDrop = false;
          requestedCount = 0;
          saeivPassengerState.stopRequested = false;
          saeivPassengerState.requestedDropCount = 0;
        }
        function refreshCurrentTargetServedFlag(isTerminusStop) {
          var currentTargetIdx = Number(saeivPassengerState.targetIndex);
          if (!Number.isFinite(currentTargetIdx) || currentTargetIdx < 0) return;
          var atStopNow = Math.max(0, Math.round(Number(saeivPassengerState.passengersAtStop) || 0));
          var reqDropNow = Math.max(0, Math.round(Number(saeivPassengerState.requestedDropCount) || 0));
          var inBusNow = Math.max(0, Math.round(Number(saeivPassengerState.passengersInBus) || 0));
          var servedCondition = (atStopNow === 0 && reqDropNow === 0);
          if (isTerminusStop === true && inBusNow > 0) servedCondition = false;
          if (servedCondition) {
            saeivStopServedLog[currentTargetIdx] = true;
          } else {
            delete saeivStopServedLog[currentTargetIdx];
          }
        }
        refreshCurrentTargetServedFlag(isTerminus);
        function updateStopServiceProgress(currentAtStop, currentRequestedDrop, currentInBus, forceReset) {
          if (forceReset === true) {
            saeivPassengerState.stopBoardingTotal = 0;
            saeivPassengerState.stopBoardingDone = 0;
            saeivPassengerState.stopAlightingTotal = 0;
            saeivPassengerState.stopAlightingDone = 0;
            saeivPassengerState.stopServiceProgressInitialized = false;
            return;
          }
          var atStopNow = Math.max(0, Math.round(Number(currentAtStop) || 0));
          var reqNow = Math.max(0, Math.round(Number(currentRequestedDrop) || 0));
          var inBusNow = Math.max(0, Math.round(Number(currentInBus) || 0));
          var hasWorkNow = reqNow > 0 || atStopNow > 0 || (isTerminus && inBusNow > 0);
          if (saeivPassengerState.stopServiceProgressInitialized !== true) {
            if (hasWorkNow) {
              saeivPassengerState.stopBoardingTotal = atStopNow;
              saeivPassengerState.stopAlightingTotal = isTerminus ? inBusNow : reqNow;
              saeivPassengerState.stopBoardingDone = 0;
              saeivPassengerState.stopAlightingDone = 0;
              saeivPassengerState.stopServiceProgressInitialized = true;
            } else {
              saeivPassengerState.stopBoardingTotal = 0;
              saeivPassengerState.stopBoardingDone = 0;
              saeivPassengerState.stopAlightingTotal = 0;
              saeivPassengerState.stopAlightingDone = 0;
            }
          }
          var boardTotal = Math.max(0, Math.round(Number(saeivPassengerState.stopBoardingTotal) || 0));
          var alightTotal = Math.max(0, Math.round(Number(saeivPassengerState.stopAlightingTotal) || 0));
          saeivPassengerState.stopBoardingDone = Math.max(0, Math.min(boardTotal, boardTotal - atStopNow));
          var remainingAlight = isTerminus ? inBusNow : reqNow;
          saeivPassengerState.stopAlightingDone = Math.max(0, Math.min(alightTotal, alightTotal - remainingAlight));
          if (!hasWorkNow && boardTotal <= 0 && alightTotal <= 0) {
            saeivPassengerState.stopServiceProgressInitialized = false;
          }
        }

        if (!inReach) {
          updateStopServiceProgress(atStop, requestedCount, inBus, true);
          saeivPassengerState.stopNecessary = computeSaeivStopNecessaryState(saeivPassengerState, atStop, requestedCount, inBus, isTerminus);
          refreshCurrentTargetServedFlag(isTerminus);
          return { completed: !saeivPassengerState.stopNecessary, changed: false };
        }

        if (!isStopped) {
          saeivPassengerState.stopNecessary = computeSaeivStopNecessaryState(saeivPassengerState, atStop, requestedCount, inBus, isTerminus);
          refreshCurrentTargetServedFlag(isTerminus);
          return { completed: !saeivPassengerState.stopNecessary, changed: false };
        }

        saeivCurrentStopWasServed = true; // Bus is stopped at the target stop
        updateStopServiceProgress(atStop, requestedCount, inBus, false);

        var lastAlightStep = Number(saeivPassengerState.lastAlightStepAtMs) || 0;
        var canAlightNow = (now - lastAlightStep) >= Number(SAEIV_PASSENGER_ALIGHT_STEP_INTERVAL_MS);
        var alightMin = Math.max(1, Math.round(Number(SAEIV_PASSENGER_ALIGHT_STEP_MIN) || 1));
        var alightMax = Math.max(alightMin, Math.round(Number(SAEIV_PASSENGER_ALIGHT_STEP_MAX) || alightMin));
        var nextAlightChunk = function () {
          if (alightMax <= alightMin) return alightMin;
          return alightMin + Math.floor(Math.random() * ((alightMax - alightMin) + 1));
        };

        if (hasRequestedDrop && inBus > 0 && requestedCount > 0 && canAlightNow) {
          var requestDropNow = Math.min(inBus, requestedCount, nextAlightChunk());
          if (requestDropNow > 0) {
            if (!useExternalPassengerCount) inBus -= requestDropNow;
            requestedCount -= requestDropNow;
            saeivPassengerState.lastAlightStepAtMs = now;
            changed = true;
          }
          if (requestedCount <= 0) {
            requestedCount = 0;
            hasRequestedDrop = false;
          }
          saeivPassengerState.requestedDropCount = requestedCount;
          saeivPassengerState.stopRequested = hasRequestedDrop;
        }

        if (isTerminus) {
          if (!useExternalPassengerCount && inBus > 0 && canAlightNow) {
            var terminusDrop = Math.min(inBus, nextAlightChunk());
            if (terminusDrop > 0) {
              inBus -= terminusDrop;
              saeivPassengerState.lastAlightStepAtMs = now;
              changed = true;
            }
          }
          saeivPassengerState.passengersInBus = Math.max(0, inBus);
          saeivPassengerState.passengersAtStop = 0;
          saeivPassengerState.stopRequested = false;
          saeivPassengerState.requestedDropCount = 0;
          saeivPassengerState.stopNecessary = computeSaeivStopNecessaryState(saeivPassengerState, 0, 0, inBus, true);
          saeivPassengerState.lastBoardStepAtMs = now;
          updateStopServiceProgress(0, 0, inBus, false);
          refreshCurrentTargetServedFlag(true);
          return { completed: inBus <= 0, changed: changed };
        }

        var lastBoardStep = Number(saeivPassengerState.lastBoardStepAtMs) || 0;
        var canBoardNow = (now - lastBoardStep) >= Number(SAEIV_PASSENGER_BOARD_STEP_INTERVAL_MS);
        if (atStop > 0 && canBoardNow) {
          var boardMin = Math.max(1, Math.round(Number(SAEIV_PASSENGER_BOARD_STEP_MIN) || 1));
          var boardMax = Math.max(boardMin, Math.round(Number(SAEIV_PASSENGER_BOARD_STEP_MAX) || boardMin));
          var boardingChunk = boardMin;
          if (boardMax > boardMin) {
            boardingChunk = boardMin + Math.floor(Math.random() * ((boardMax - boardMin) + 1));
          }
          var availableSeats = busCapacityUnlimited ? Number.MAX_SAFE_INTEGER : Math.max(0, busCapacity - inBus);
          var boarded = Math.min(atStop, boardingChunk, availableSeats);
          if (boarded > 0) {
            if (!useExternalPassengerCount) {
              // Internal simulation: decrement stop queue and count boarding
              atStop -= boarded;
              inBus += boarded;
              saeivPassengerState.transportedPassengers = Math.max(0, Math.round(Number(saeivPassengerState.transportedPassengers) || 0)) + boarded;
            }
            saeivPassengerState.lastBoardStepAtMs = now;
            changed = true;
          }
        }

        saeivPassengerState.passengersInBus = inBus;
        if (inBus > saeivMaxPassengersEverInBus) saeivMaxPassengersEverInBus = inBus;
        saeivPassengerState.passengersAtStop = atStop;
        saeivPassengerState.stopRequested = hasRequestedDrop;
        saeivPassengerState.requestedDropCount = requestedCount;
        saeivPassengerState.stopNecessary = computeSaeivStopNecessaryState(saeivPassengerState, atStop, requestedCount, inBus, false);
        updateStopServiceProgress(atStop, requestedCount, inBus, false);
        refreshCurrentTargetServedFlag(false);
        return { completed: !saeivPassengerState.stopNecessary, changed: changed };
      }
      function buildSaeivCompletionMetrics(entries, reachedIndex) {
        var list = Array.isArray(entries) ? entries : [];
        var out = {
          completed: false,
          elapsedMs: 0,
          finalDelayMinutes: Number.NaN,
          reachedStops: Math.max(0, Number(saeivReachedStopsCount) || 0),
          servedStops: Math.max(0, Number(saeivServedStopsCount) || 0),
          lateStops: Math.max(0, Number(saeivLateStopsCount) || 0),
          missedStops: Math.max(0, Number(saeivPassengerState && saeivPassengerState.missedStops) || 0),
          transportedPassengers: Math.max(0, Number(saeivPassengerState && saeivPassengerState.transportedPassengers) || 0),
          selectedAtMs: Number(saeivRouteSelectedAtMs) || 0,
          startedAtMs: Number(saeivRouteStartedAtMs) || 0,
          terminusReachedAtMs: Number(saeivTerminusReachedAtMs) || 0,
          plannedTerminusAtMs: Number.NaN
        };
        if (!list.length) return out;
        var lastIndex = list.length - 1;
        var clampedReached = Math.max(-1, Math.min(lastIndex, Math.floor(Number(reachedIndex) || -1)));
        out.completed = clampedReached >= lastIndex;
        out.plannedTerminusAtMs = computeSaeivPlannedArrivalTimestampMs(list, lastIndex);
        if (!out.completed) return out;
        var selectedAt = Number(saeivRouteSelectedAtMs);
        var startedAt = Number(saeivRouteStartedAtMs);
        var reachedAt = Number(saeivTerminusReachedAtMs);
        if (!Number.isFinite(reachedAt) || reachedAt <= 0) reachedAt = getSaeivNowTimestampMs();
        out.terminusReachedAtMs = reachedAt;
        var elapsedBase = Number.isFinite(startedAt) && startedAt > 0 ? startedAt : selectedAt;
        if (Number.isFinite(elapsedBase) && elapsedBase > 0) {
          out.elapsedMs = Math.max(0, reachedAt - elapsedBase);
        }
        if (saeivPassengerState) {
          var servedStopsLive = 0;
          for (var s = 0; s <= clampedReached; s += 1) {
            if (saeivStopServedLog[s] === true) servedStopsLive += 1;
          }
          out.servedStops = Math.max(0, servedStopsLive);
        }
        out.finalDelayMinutes = computeSaeivDelayMinutesByTimestamp(reachedAt, out.plannedTerminusAtMs);
        return out;
      }
