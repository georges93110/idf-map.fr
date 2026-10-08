      // GPS destinations use the navigation link, while the visible stop marker
      // keeps using the exact platform position. Map XYH -> native XYZ.
      var nativeGpsLastKey = "";
      var nativeGpsLastSentAt = 0;
      var nativeGpsWasActive = false;
      var nativeGpsSocket = null;
      var nativeGpsStatus = { status: "idle" };
      function buildNativeGpsPayload() {
        if (normalizeGameMode(currentGameMode) !== "bus" || !saeivRouteState ||
            !saeivRouteState.selectedKey || !Array.isArray(saeivRouteState.stops) ||
            !saeivRouteState.stops.length) {
          return { type: "nativeGpsDestination", version: 1, enabled: false };
        }
        // Pause and brief telemetry loss hold the existing destination.
        if (telemetryPaused || !hasRecentTelemetryPositionSignal()) return null;
        var stops = saeivRouteState.stops;
        var reached = clampReachedStopIndex(saeivRouteState.reachedIndex, stops.length - 1);
        var target = clampRouteStopIndex(saeivRouteState.targetIndex, stops.length - 1);
        if (saeivRouteState.started && (reached >= stops.length - 1 || target <= reached)) {
          return { type: "nativeGpsDestination", version: 1, enabled: false };
        }
        var index = saeivRouteState.started ? clampRouteStopIndex(saeivRouteState.targetIndex, stops.length - 1) : 0;
        var stop = stops[index];
        var point = getSaeivStopRouteEntryWorldPoint(stop);
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.h)) return null;
        return {
          type: "nativeGpsDestination", version: 1, enabled: true,
          stopKey: String(saeivRouteState.selectedKey) + ":" + index + ":" + String(stop.uid || ""),
          world: { x: point.x, y: point.h, z: point.y }
        };
      }
      function syncNativeGpsDestination(force) {
        if (!telemetryWs || telemetryWs.readyState !== 1) return false;
        if (nativeGpsSocket !== telemetryWs) {
          nativeGpsSocket = telemetryWs;
          nativeGpsLastKey = "";
        }
        var payload = buildNativeGpsPayload();
        if (!payload || (!payload.enabled && !nativeGpsWasActive)) return false;
        var key = JSON.stringify(payload), now = Date.now();
        if (!force && key === nativeGpsLastKey && now - nativeGpsLastSentAt < 1000) return false;
        try { telemetryWs.send(key); } catch (_) { return false; }
        nativeGpsLastKey = key; nativeGpsLastSentAt = now;
        nativeGpsWasActive = payload.enabled;
        return true;
      }
      // Heartbeats keep the relay owner current; unchanged targets do not trigger
      // another native recalculation. Stop advancement remains owned by SAEIV.
      window.setInterval(function () { syncNativeGpsDestination(false); }, 1000);
