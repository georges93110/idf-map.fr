      // The SAEIV mission remains authoritative: this publisher never advances
      // an index, starts a service, or marks a stop as served.
      var nativeStopMarkerLastKey = "";
      var nativeStopMarkerLastSentAt = 0;
      function buildNativeStopMarkerPayload(saeiv) {
        var off = { type: "nativeStopMarker", version: 1, enabled: false };
        if (normalizeGameMode(currentGameMode) !== "bus" || telemetryPaused ||
            !hasRecentTelemetryPositionSignal() || !saeiv || !saeiv.routeSelected || saeiv.routeCompleted) return off;
        var stops = saeivRouteState && saeivRouteState.stops;
        if (!Array.isArray(stops) || !stops.length) return off;
        var started = saeivRouteState.started === true;
        if (started && saeiv.stopOptionalByPlan === true) return off;
        var index = started ? clampRouteStopIndex(saeivRouteState.targetIndex, stops.length - 1) : 0;
        var stop = stops[index];
        // These are game XYZ, not map XY and not a snapped navigation node.
        var point = getSaeivStopExactWorldPoint(stop);
        if (!point || !Number.isFinite(point.h)) return off;
        var yaw = Number(stop.stopHeading);
        if (!Number.isFinite(yaw)) return off;
        yaw = ((yaw % 360) + 540) % 360 - 180;
        var vehicle = telemetryLastSignal ? { x: telemetryLastSignal.x, y: telemetryLastSignal.y, z: telemetryLastSignal.z } : null;
        var radius = started ? Math.max(SAEIV_STOP_REACH_DISTANCE, SAEIV_STOP_DWELL_REACH_DISTANCE) : SAEIV_STOP_REACH_DISTANCE;
        var distance = worldPointDistance(vehicle, point);
        return {
          type: "nativeStopMarker", version: 1, enabled: true,
          stopKey: String(saeiv.selectedKey || "") + ":" + index + ":" + String(stop.uid || ""),
          world: { x: point.x, y: point.h, z: point.y, yawDegrees: yaw },
          radiusM: radius,
          inZone: Number.isFinite(distance) && distance <= radius
        };
      }
      function syncNativeStopMarker(force, saeiv) {
        if (!telemetryWs || telemetryWs.readyState !== 1) return false;
        var payload = buildNativeStopMarkerPayload(saeiv || buildSaeivStatePayloadFromGame());
        var key = JSON.stringify(payload);
        var now = Date.now();
        if (!force && key === nativeStopMarkerLastKey && now - nativeStopMarkerLastSentAt < 750) return false;
        try { telemetryWs.send(key); } catch (err) { return false; }
        nativeStopMarkerLastKey = key;
        nativeStopMarkerLastSentAt = now;
        return true;
      }
      // A lease is renewed even when the bus and SAEIV widgets are stationary.
      window.setInterval(function () { syncNativeStopMarker(false); }, 750);
      window.addEventListener("pagehide", function () {
        if (telemetryWs && telemetryWs.readyState === 1) {
          telemetryWs.send(JSON.stringify({ type: "nativeStopMarker", version: 1, enabled: false }));
        }
      });
