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
          return { type: "nativeGpsDestination", version: 2, enabled: false };
        }
        // Queue from the native Service menu too, even while paused. These
        // are fixed stop coordinates; the DLL owns the world/actor/pause gate.
        // Hidden browser timers are only a fallback, never the sole trigger.
        var stops = saeivRouteState.stops;
        var reached = clampReachedStopIndex(saeivRouteState.reachedIndex, stops.length - 1);
        var target = clampRouteStopIndex(saeivRouteState.targetIndex, stops.length - 1);
        if (saeivRouteState.started && (reached >= stops.length - 1 || target <= reached)) {
          return { type: "nativeGpsDestination", version: 2, enabled: false };
        }
        var index = saeivRouteState.started ? clampRouteStopIndex(saeivRouteState.targetIndex, stops.length - 1) : 0;
        var points=[];
        // COACH1 owns native map storage for the complete remaining route.
        // Reject oversize missions explicitly rather than silently truncating.
        if(stops.length-index>128){nativeGpsStatus={status:"too_many_stops",count:stops.length-index};return null;}
        for(var i=index;i<stops.length;i++){
          var point=getSaeivStopRouteEntryWorldPoint(stops[i]);
          if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.h)){
            nativeGpsStatus={status:"missing_stop_coordinates",index:i};return null;
          }
          points.push({x:point.x,y:point.h,z:point.y});
        }
        if(points.length>128){nativeGpsStatus={status:"too_many_stops",count:points.length};return null;}
        return {type:"nativeGpsDestination",version:2,enabled:true,firstStop:index+1,
          stopKey:String(saeivRouteState.selectedKey)+":"+index+":"+String(stops[index].uid||""),points:points};
      }
      function syncNativeGpsDestination(force) {
        if (!telemetryWs || telemetryWs.readyState !== 1) return false;
        if (nativeGpsSocket !== telemetryWs) {
          nativeGpsSocket = telemetryWs;
          nativeGpsLastKey = "";
        }
        var payload = buildNativeGpsPayload();
        // Repeat the disabled state too: a dropped cancellation or a restored
        // empty tab must not leave an old DLL-owned route behind. The relay
        // ignores idle clears when the driver owns ordinary game navigation.
        if (!payload) return false;
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
