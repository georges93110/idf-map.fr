      // ETS2 snaps destinations against the currently loaded world's roads.
      // Never use exported web nav links here. Passage overrides affect only
      // routing; physical stop pins and boarding zones stay at the platform.
      // Map XYH -> native XYZ.
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
        var moverStops = [];
        if (stops.length > 128) return null;
        for (var m = 0; m < stops.length; m++) {
          var physicalStop = getSaeivStopExactWorldPoint(stops[m]);
          if (!physicalStop || ![physicalStop.x,physicalStop.y,physicalStop.h].every(Number.isFinite)) return null;
          moverStops.push({x:physicalStop.x,y:physicalStop.h,z:physicalStop.y});
        }
        var reached = clampReachedStopIndex(saeivRouteState.reachedIndex, stops.length - 1);
        var target = clampRouteStopIndex(saeivRouteState.targetIndex, stops.length - 1);
        if (saeivRouteState.started && (reached >= stops.length - 1 || target <= reached)) {
          return { type: "nativeGpsDestination", version: 2, enabled: false, moverStops:moverStops };
        }
        var index = saeivRouteState.started ? clampRouteStopIndex(saeivRouteState.targetIndex, stops.length - 1) : 0;
        var points=[],stopPoints=[];
        var usePassages=stops.slice(index).some(function(stop){return typeof getSaeivStopGpsOverrideWorldPoint==='function'&&getSaeivStopGpsOverrideWorldPoint(stop);});
        // COACH1 owns native map storage for the complete remaining route.
        // Reject oversize missions explicitly rather than silently truncating.
        if(stops.length-index>128){nativeGpsStatus={status:"too_many_stops",count:stops.length-index};return null;}
        var end=saeivRouteState.started?stops.length:1;
        for(var i=index;i<end;i++){
          var override=typeof getSaeivStopGpsOverrideWorldPoint==='function'?getSaeivStopGpsOverrideWorldPoint(stops[i]):null;
          var point=override||getSaeivStopExactWorldPoint(stops[i]);
          if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.h)){
            nativeGpsStatus={status:"missing_stop_coordinates",index:i};return null;
          }
          points.push({x:point.x,y:point.h,z:point.y});
          if(usePassages){
            var physical=getSaeivStopExactWorldPoint(stops[i]);
            if(!physical||![physical.x,physical.y,physical.h].every(Number.isFinite))return null;
            stopPoints.push({x:physical.x,y:physical.h,z:physical.y});
          }
        }
        if(points.length>128){nativeGpsStatus={status:"too_many_stops",count:points.length};return null;}
        var payload={type:"nativeGpsDestination",version:usePassages?3:2,enabled:true,firstStop:index+1,
          moverStops:moverStops,stopKey:String(saeivRouteState.selectedKey)+":"+index+":"+String(stops[index].uid||"")+(saeivRouteState.started?"":":approach"),points:points};
        if(usePassages)payload.stopPoints=stopPoints;
        return payload;
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
