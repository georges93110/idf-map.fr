/*
 * Game2 runtime chunk: 04-waze-bridge.js
 * Bridge Waze, position manuelle, helpers debug.
 * Charge par ../game2-main.js dans une fermeture runtime partagee.
 */
      function postWazeBridgePayload(payload) {
        if (!payload || typeof payload !== "object") return;
        var now = Date.now();
        var previousPacketTs = Number(lastWazeBridgePacket && lastWazeBridgePacket.ts);
        if (Number.isFinite(previousPacketTs) && now <= previousPacketTs) {
          now = previousPacketTs + 1;
        }
        var saeivMiniVisible = typeof findWidgetIdByType === "function" ? !!findWidgetIdByType("saeiv_mini") : false;
        var busStatusVisible = typeof findWidgetIdByType === "function" ? !!findWidgetIdByType("bus_status") : false;
        var saeivStateForWaze = null;
        if (typeof buildSaeivStatePayloadFromGame === "function") {
          try {
            saeivStateForWaze = buildSaeivStatePayloadFromGame();
          } catch (err) {
            saeivStateForWaze = null;
          }
        }
        var packet = {
          kind: "waze-dev",
          source: "game",
          ts: now,
          refTime: getSaeivClockText(),
          clockNowMs: getSaeivNowTimestampMs(),
          timeSystem: normalizeSaeivTimeSystem(saeivTimeSystem),
          gameMode: normalizeGameMode(currentGameMode),
          saeivMiniWidgetVisible: saeivMiniVisible,
          busStatusWidgetVisible: busStatusVisible,
          gpsMiniPassengerBadgeAllowed:
            normalizeGameMode(currentGameMode) === GAME_MODES.BUS &&
            !saeivMiniVisible &&
            !busStatusVisible,
          truckDamage: (telemetryLastSignal && Number.isFinite(telemetryLastSignal.truckDamagePercent)) ? telemetryLastSignal.truckDamagePercent : 0,
          trailerDamage: (telemetryLastSignal && Number.isFinite(telemetryLastSignal.trailerDamagePercent)) ? telemetryLastSignal.trailerDamagePercent : 0,
          cargoDamage: (telemetryLastSignal && Number.isFinite(telemetryLastSignal.cargoDamagePercent)) ? telemetryLastSignal.cargoDamagePercent : 0
        };
        if (saeivStateForWaze && typeof saeivStateForWaze === "object") {
          [
            "selected",
            "lineSelected",
            "routeSelected",
            "selectedKey",
            "selectedLineUid",
            "selectedRouteUid",
            "lineNumber",
            "routeName",
            "routeWaitingStart",
            "routeStarted",
            "routeCompleted",
            "routeReachedIndex",
            "routeTargetIndex",
            "routeStopCount",
            "currentStopName",
            "currentStopLabel",
            "startStopName",
            "stopName",
            "nextStopName",
            "distanceToDisplayStopM",
            "startStopDistanceM",
            "vehicleAtStop",
            "vehicleAtStopIndex",
            "passengersInBus",
            "passengersAtStop",
            "busMaxCapacity",
            "busMaxCapacityUnlimited",
            "busMaxCapacityDisplay",
            "stopBoardingTotal",
            "stopBoardingDone",
            "stopAlightingTotal",
            "stopAlightingDone",
            "busStatusPassengerServiceActive",
            "busStatusPassengerServiceReady",
            "passengerServiceActive",
            "passengerServiceReady"
          ].forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(saeivStateForWaze, key)) {
              packet[key] = saeivStateForWaze[key];
            }
          });
        }
        if (
          !Object.prototype.hasOwnProperty.call(payload, "routeStops") &&
          saeivRouteState &&
          typeof saeivRouteState === "object" &&
          Array.isArray(saeivRouteState.stops) &&
          saeivRouteState.stops.length
        ) {
          var bridgeRouteLastIndex = saeivRouteState.stops.length - 1;
          packet.routeStops = saeivRouteState.stops.map(function (entry, index) {
            var isOptionalStop = typeof isSaeivRouteStopOptionalForMarker === "function"
              ? isSaeivRouteStopOptionalForMarker(entry, index, bridgeRouteLastIndex)
              : false;
            return {
              index: index,
              uid: Number(entry && entry.uid),
              name: String(entry && entry.name || ""),
              x: Number(entry && entry.X),
              y: Number(entry && entry.Y),
              z: Number(entry && entry.Z),
              optional: isOptionalStop === true,
              stopOptional: isOptionalStop === true
            };
          }).filter(function (stop) {
            return Number.isFinite(stop.x) && Number.isFinite(stop.y) && Number.isFinite(stop.z);
          });
        }
        Object.keys(payload).forEach(function (key) {
          packet[key] = payload[key];
        });
        lastWazeBridgePacket = packet;
        if (
          !lastWazeBridgeWsSendAt ||
          (now - lastWazeBridgeWsSendAt) >= WAZE_BRIDGE_WS_MIN_SEND_INTERVAL_MS ||
          Array.isArray(packet.routePoints) ||
          String(packet.step || "") === "off"
        ) {
          sendWidgetBridgeMessage(WIDGET_BRIDGE_CHANNEL_WAZE, packet);
          lastWazeBridgeWsSendAt = now;
        }
        return packet;
      }
      function postWazeBridgePayloadToVisibleWidgets(packet) {
        if (!packet || typeof packet !== "object") return false;
        var sent = false;
        document
          .querySelectorAll('iframe[data-widget-type="gps_mini"], iframe[data-widget-type="waze"]')
          .forEach(function (frame) {
            try {
              var win = frame && frame.contentWindow;
              if (!win) return;
              if (
                (packet.clearNavigation === true || packet.clearDestination === true) &&
                typeof win.wazeClearNavigationDestination === "function"
              ) {
                win.wazeClearNavigationDestination();
              }
              win.postMessage({
                scope: WIDGET_BRIDGE_SCOPE,
                channel: WIDGET_BRIDGE_CHANNEL_WAZE,
                payload: packet,
                ts: Number(packet.ts) || Date.now()
              }, "*");
              sent = true;
            } catch (err) { }
          });
        return sent;
      }
      function updateWazeBridgePoseFromTelemetry(signal) {
        if (!signal || typeof signal !== "object") return;
        var x = Number(signal.x);
        var y = Number(signal.y);
        var z = Number(signal.z);
        var headingRaw = Number(signal.heading);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || !Number.isFinite(headingRaw)) return;
        var heading = headingRaw;
        // Keep XYZ as-is: waze bridge normalizer maps z->planar Y and y->height.
        var arrow = { x: x, y: y, z: z };
        lastBridgeArrowPoint = arrow;
        lastBridgeHeadingDeg = heading;
      }
      function ensureWazeBridgeStartPointFallback(fallbackPoint, options) {
        if (lastBridgeArrowPoint) return true;
        var opts = options && typeof options === "object" ? options : {};
        var signal = telemetryLastSignal && typeof telemetryLastSignal === "object" ? telemetryLastSignal : null;
        if (signal) {
          var sx = Number(signal.x);
          var sy = Number(signal.y);
          var sz = Number(signal.z);
          if (Number.isFinite(sx) && Number.isFinite(sy) && Number.isFinite(sz)) {
            lastBridgeArrowPoint = { x: sx, y: sy, z: sz };
            var sh = Number(signal.heading);
            if (Number.isFinite(sh)) lastBridgeHeadingDeg = sh;
            if (!Number.isFinite(lastBridgeHeadingDeg)) lastBridgeHeadingDeg = 0;
            return true;
          }
        }
        var packetStart = null;
        if (lastWazeBridgePacket && typeof lastWazeBridgePacket === "object") {
          packetStart =
            parseWorldPoint3D(lastWazeBridgePacket.arrow) ||
            parseWorldPoint3D(lastWazeBridgePacket.start) ||
            parseWorldPoint3D(lastWazeBridgePacket.from) ||
            null;
        }
        var startPoint = parseWorldPoint3D(saeivRouteStartPoint) || packetStart || null;
        if (!startPoint && opts.allowFallbackPoint === true) {
          startPoint = parseWorldPoint3D(fallbackPoint) || null;
        }
        if (!startPoint) return false;
        lastBridgeArrowPoint = {
          x: Number(startPoint.x),
          y: Number(startPoint.y),
          z: Number(startPoint.z)
        };
        if (!Number.isFinite(lastBridgeHeadingDeg)) lastBridgeHeadingDeg = 0;
        return true;
      }
      function publishTelemetryToWazeBridge(signal) {
        if (!signal || typeof signal !== "object") return;
        updateWazeBridgePoseFromTelemetry(signal);
        if (activeBridgeDestinationPoint) {
          var now = Date.now();
          var forceRecomputeNow = false;
          if (saeivRouteState && typeof saeivRouteState === "object") {
            var entries = Array.isArray(saeivRouteState.stops) ? saeivRouteState.stops : [];
            if (entries.length) {
              var lastIndex = entries.length - 1;
              var routeStarted = saeivRouteState.started === true;
              var routeTargetIndex = clampRouteStopIndex(saeivRouteState.targetIndex, lastIndex);
              if (!routeStarted) {
                var firstTarget =
                  (typeof getSaeivStopExactWorldPoint === "function" ? getSaeivStopExactWorldPoint(entries[0]) : null) ||
                  (typeof getSaeivStopNavWorldPoint === "function" ? getSaeivStopNavWorldPoint(entries[0]) : null) ||
                  parseWorldPoint3D(entries[0] && entries[0].point);
                var hasStartCache =
                  firstTarget &&
                  Array.isArray(activeBridgeRoutePoints) &&
                  activeBridgeRoutePoints.length >= 2 &&
                  worldPointDistance(activeBridgeRouteEndPoint, firstTarget) <= 0.001;
                forceRecomputeNow = !hasStartCache;
              } else {
                var routeCacheKey = getSaeivRouteCacheBaseKey(entries);
                var hasComposedCache =
                  Array.isArray(activeBridgeComposedRoutePoints) &&
                  activeBridgeComposedRoutePoints.length >= 2 &&
                  String(activeBridgeComposedRouteKey || "") === String(routeCacheKey || "") &&
                  Number(activeBridgeComposedRouteTargetIndex) === Number(routeTargetIndex);
                forceRecomputeNow = !hasComposedCache;
              }
            }
          } else {
            var hasFallbackCache =
              Array.isArray(activeBridgeRoutePoints) &&
              activeBridgeRoutePoints.length >= 2 &&
              worldPointDistance(activeBridgeRouteEndPoint, activeBridgeDestinationPoint) <= 0.001;
            forceRecomputeNow = !hasFallbackCache;
          }
          var allowRecompute = forceRecomputeNow || ((now - lastWazeRouteRecomputeAt) >= WAZE_ROUTE_RECOMPUTE_INTERVAL_MS);
          publishActiveRouteFromState(false, { allowRecompute: allowRecompute });
        } else {
          // Minimal update for clock and pose
          postWazeBridgePayload({
            arrow: lastBridgeArrowPoint
          });
        }
      }
      function publishManualWazeBridgePositionXYZ(x, y, z, heading) {
        var px = Number(x);
        var py = Number(y);
        var pz = Number(z);
        var h = Number(heading);
        if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return false;
        if (!Number.isFinite(h)) h = 0;
        var arrow = { x: px, y: py, z: pz };
        lastBridgeArrowPoint = arrow;
        lastBridgeHeadingDeg = h;
        var payload = {
          arrow: arrow,
          start: arrow,
          heading: h,
          headingUnit: "deg",
          headingConvention: "north_ccw",
          X: px,
          Y: py,
          Z: pz,
          Heading: h
        };
        if (activeBridgeDestinationPoint) {
          publishActiveRouteFromState(true);
          return true;
        }
        postWazeBridgePayload(payload);
        return true;
      }
      function publishManualWazeBridgeHeading(heading) {
        var h = Number(heading);
        if (!Number.isFinite(h)) return false;
        lastBridgeHeadingDeg = h;
        postWazeBridgePayload({
          heading: h,
          headingUnit: "deg",
          headingConvention: "north_ccw",
          Heading: h
        });
        return true;
      }
      function publishManualWazeBridgeDestinationXYZ(x, y, z) {
        var dx = Number(x);
        var dy = Number(y);
        var dz = Number(z);
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz)) return false;
        var rawDest = { x: dx, y: dy, z: dz };
        var dest = rawDest;
        ensureWazeBridgeStartPointFallback(saeivRouteStartPoint, { allowFallbackPoint: true });
        var prevDest = activeBridgeDestinationPoint;
        if (prevDest && worldPointDistance(prevDest, dest) <= 0.001) {
          return true;
        }
        activeBridgeDestinationPoint = dest;
        clearActiveRouteCache();
        ensureNavGraphLoaded();
        var start = lastBridgeArrowPoint || null;
        var heading = Number.isFinite(lastBridgeHeadingDeg) ? lastBridgeHeadingDeg : 0;
        var hasSaeivRoute = !!(saeivRouteState && Array.isArray(saeivRouteState.stops) && saeivRouteState.stops.length);
        if (hasSaeivRoute && start) {
          publishActiveRouteFromState(true);
          ensureNavGraphLoaded().then(function (g) {
            if (!g) return;
            publishActiveRouteFromState(true);
          });
          return true;
        }
        var routePoints = start ? getActiveRoutePoints(start, dest, true, { forceNav: true }) : [];
        postWazeBridgePayload({
          start: start,
          arrow: start,
          end: dest,
          routePoints: start ? routePointsForBridge(start, routePoints) : [],
          routeStops: [],
          routeReachedIndex: -1,
          routeTargetIndex: -1,
          etaArrivalTimestampMs: null,
          etaRemainingMinutes: null,
          etaSegmentDurationMinutes: null,
          heading: heading,
          headingUnit: "deg",
          headingConvention: "north_ccw"
        });
        ensureNavGraphLoaded().then(function (g) {
          if (!g) return;
          publishActiveRouteFromState(true);
        });
        return true;
      }
      function clearManualWazeBridgeDestination() {
        activeBridgeDestinationForceNav = false;
        activeBridgeDestinationPoint = null;
        clearActiveRouteCache();
        var start = lastBridgeArrowPoint || null;
        var packet = postWazeBridgePayload({
          step: start ? "A" : "ready",
          clearNavigation: true,
          clearDestination: true,
          routeSelected: false,
          routeWaitingStart: false,
          routeStarted: false,
          start: start,
          arrow: start,
          end: null,
          routePoints: [],
          routeStops: [],
          routeReachedIndex: -1,
          routeTargetIndex: -1,
          etaArrivalTimestampMs: null,
          etaRemainingMinutes: null,
          etaSegmentDurationMinutes: null,
          heading: Number.isFinite(lastBridgeHeadingDeg) ? lastBridgeHeadingDeg : 0,
          headingUnit: "deg",
          headingConvention: "north_ccw"
        });
        postWazeBridgePayloadToVisibleWidgets(packet);
        return true;
      }
      function computeForceNavRoutePreviewXYZ(fromX, fromY, fromZ, toX, toY, toZ) {
        var fromPoint = parseWorldPoint3D({ x: fromX, y: fromY, z: fromZ });
        var toPoint = parseWorldPoint3D({ x: toX, y: toY, z: toZ });
        if (!fromPoint || !toPoint) {
          return { ok: false, error: "invalid_points", routePoints: [] };
        }
        if (!navGraph) {
          return { ok: false, pending: true, error: "nav_graph_loading", routePoints: [] };
        }
        var route = buildShortestRoutePoints(fromPoint, toPoint, {
          forceNav: true,
          maxNearbyCandidates: NAV_FORCE_NEARBY_CANDIDATES_MAX
        });
        if (!Array.isArray(route) || route.length < 2) {
          return { ok: false, error: "no_nav_route", routePoints: [] };
        }
        var bridgeRoute = routePointsForBridge(fromPoint, route);
        var effectiveRoute = (Array.isArray(bridgeRoute) && bridgeRoute.length >= 2) ? bridgeRoute : route;
        var normalizedRoute = effectiveRoute
          .map(function (point) { return parseWorldPoint3D(point); })
          .filter(Boolean);
        if (normalizedRoute.length < 2) {
          return { ok: false, error: "no_nav_route", routePoints: [] };
        }
        var resolvedEnd = parseWorldPoint3D(normalizedRoute[normalizedRoute.length - 1]) || toPoint;
        return {
          ok: true,
          routePoints: normalizedRoute,
          distanceWorld: worldPolylineDistance(normalizedRoute),
          resolvedEnd: resolvedEnd
        };
      }
      // Debug helpers accessibles depuis la console de game.html.
      window.wazeComputeForceNavRoutePreviewXYZ = function wazeComputeForceNavRoutePreviewXYZ(fromX, fromY, fromZ, toX, toY, toZ) {
        return ensureNavGraphLoaded()
          .then(function () {
            return computeForceNavRoutePreviewXYZ(fromX, fromY, fromZ, toX, toY, toZ);
          })
          .catch(function () {
            return { ok: false, error: "nav_graph_unavailable", routePoints: [] };
          });
      };
      window.wazeGetBridgeState = function wazeGetBridgeState() {
        if (!lastWazeBridgePacket || typeof lastWazeBridgePacket !== "object") return null;
        try {
          return JSON.parse(JSON.stringify(lastWazeBridgePacket));
        } catch (err) {
          return Object.assign({}, lastWazeBridgePacket);
        }
      };
      window.saeivGetBridgeState = function saeivGetBridgeState() {
        var packet = {
          type: "saeiv:state",
          sourceId: SAEIV_SOURCE_ID,
          payload: buildSaeivStatePayloadFromGame(),
          ts: Date.now()
        };
        try {
          return JSON.parse(JSON.stringify(packet));
        } catch (err) {
          return Object.assign({}, packet);
        }
      };
      window.saeivPostBridgeMessage = function saeivPostBridgeMessage(message) {
        if (!message || typeof message !== "object") return false;
        var body = Object.assign({}, message, { sourceId: SAEIV_SOURCE_ID });
        handleSaeivBridgeData(body);
        return true;
      };
      window.wazeSetRouteRefreshSeconds = function wazeSetRouteRefreshSeconds(seconds) {
        var sec = Number(seconds);
        if (!Number.isFinite(sec) || sec <= 0) return false;
        WAZE_FORCE_ROUTE_REFRESH_INTERVAL_MS = Math.max(1, sec) * 1000;
        if (telemetryWatchdogTimer || (telemetryWs && telemetryWs.readyState === WebSocket.OPEN)) {
          startWazeForcedRouteRefresh();
        }
        return true;
      };
      window.wazeGetRouteRefreshSeconds = function wazeGetRouteRefreshSeconds() {
        return Math.max(1, Math.round((Number(WAZE_FORCE_ROUTE_REFRESH_INTERVAL_MS) || 1000) / 1000));
      };
      window.saeivSetStateRefreshSeconds = function saeivSetStateRefreshSeconds(seconds) {
        var sec = Number(seconds);
        if (!Number.isFinite(sec) || sec <= 0) return false;
        SAEIV_FORCE_STATE_REFRESH_INTERVAL_MS = Math.max(0.5, sec) * 1000;
        if (telemetryWatchdogTimer || (telemetryWs && telemetryWs.readyState === WebSocket.OPEN)) {
          startSaeivForcedStateRefresh();
        }
        return true;
      };
      window.saeivGetStateRefreshSeconds = function saeivGetStateRefreshSeconds() {
        return Math.max(0.5, Math.round((Number(SAEIV_FORCE_STATE_REFRESH_INTERVAL_MS) || 1000) / 100) / 10);
      };
      window.wazeSetNavigationPositionXYZ = function wazeSetNavigationPositionXYZ(X, Y, Z, headingDeg) {
        return publishManualWazeBridgePositionXYZ(X, Y, Z, headingDeg);
      };
      window.wazeSetNavigationHeading = function wazeSetNavigationHeading(headingDeg) {
        return publishManualWazeBridgeHeading(headingDeg);
      };
      window.wazeSetNavigationDestinationXYZ = function wazeSetNavigationDestinationXYZ(X, Y, Z) {
        return publishManualWazeBridgeDestinationXYZ(X, Y, Z);
      };
      window.wazeClearNavigationDestination = function wazeClearNavigationDestination() {
        return clearManualWazeBridgeDestination();
      };

