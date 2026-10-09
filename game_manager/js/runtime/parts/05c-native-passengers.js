// Native physical transfers are authoritative for the measured Bluebus profile.
var nativePassengerStatus = null;
var nativePassengerReceivedAt = 0;
var nativePassengerLastSent = 0;
var nativePassengerLastPayload = "";
var nativePassengerLockedMission = "";
var nativePassengerValidationKey = "";
var nativePassengerValidationEpoch = null;
var nativePassengerValidationCount = 0;
var nativePassengerSelectionSerial = 0;
function nativePassengerMissionKey() {
  if (!saeivRouteState || !saeivRouteState.selectedKey) return "";
  // Selection owns the actors. Starting service must not recreate the crowd.
  if (!saeivRouteState.nativePassengerKey) saeivRouteState.nativePassengerKey =
    [saeivRouteState.selectedKey, Date.now(), ++nativePassengerSelectionSerial].join(":");
  return saeivRouteState.nativePassengerKey;
}
function nativePassengerStopKey() {
  var mission=nativePassengerMissionKey(),state=saeivPassengerState;
  return mission&&state ? [mission,state.targetIndex,state.targetUid].join(":") : "";
}
function nativePassengersExpected() {
  var mission = nativePassengerMissionKey();
  if (!mission || saeivRouteState.started !== true || normalizeGameMode(currentGameMode) !== "bus") return false;
  if (nativePassengerLockedMission === mission) return true;
  if (nativePassengerStatus && Date.now() - nativePassengerReceivedAt < 4000 && nativePassengerStatus.supported) return true;
  return /bluebus|evadys|solaris.*urbino|urbino.*solaris/i.test(String(saeivVehicleName || "") + " " + String((telemetryLastSignal || {}).vehicleName || ""));
}
// BUS6.4: always send the next plan, even while doors are closed. The DLL
// arms its visuals at 450 m or on first contact with the current stop zone.
// Freeze the next stop's demand once; promotion reuses these exact counts.
function nativePassengerNextPlan(stops,index,mission) {
  if(index+1>=stops.length)return null;
  var nextIndex=index+1,stop=stops[nextIndex],uid=String(stop.uid||""),state=saeivPassengerState;
  var cached=state.nextNativePlan;
  if(!cached||cached.index!==nextIndex||cached.uid!==uid){
    var config=resolveSaeivPassengerConfigForStop(state,stop);
    var capacity=getSaeivActiveCapacityState(saeivVehicleName);
    var projected=Math.max(0,Number(state.passengersInBus)-Math.max(0,state.plannedStopAlightingTotal-state.stopAlightingDone))+
      Math.max(0,state.plannedStopBoardingTotal-state.stopBoardingDone);
    if(!capacity.unlimited)projected=Math.min(projected,capacity.capacity);
    var counts=ensureSaeivPassengerWorkForConfiguredStop(
      computeSaeivPassengersAtStopValue(config,nextIndex,stops.length-1,stop),config,projected);
    if(nextIndex===stops.length-1)counts={board:0,alight:0};
    cached=state.nextNativePlan={index:nextIndex,uid:uid,counts:{board:counts.board,alight:counts.alight}};
  }
  var point=getSaeivStopExactWorldPoint(stop),yaw=Number(stop.stopHeading);
  if(!point||!Number.isFinite(point.h)||!Number.isFinite(yaw))return null;
  return {stopKey:[mission,nextIndex,uid].join(":"),board:Math.min(500,cached.counts.board),
    world:{x:point.x,y:point.h,z:point.y,yawDegrees:((yaw%360)+540)%360-180},
    radiusM:Math.max(SAEIV_STOP_REACH_DISTANCE,SAEIV_STOP_DWELL_REACH_DISTANCE)};
}
function buildNativePassengerPayload() {
  var off = {type:"nativePassengers",version:2,enabled:false};
  var key=nativePassengerStopKey(),mission=nativePassengerMissionKey();
  if (!mission || !key || normalizeGameMode(currentGameMode)!=="bus" || !saeivPassengerState) return off;
  // Coordinates, counts and identity must belong to the same stop snapshot.
  var stops=saeivRouteState.stops,index=saeivPassengerState.targetIndex;
  if (!Array.isArray(stops)||!stops[index]) return off;
  var stop=stops[index],point=getSaeivStopExactWorldPoint(stop),yaw=Number(stop.stopHeading);
  if (!point || !Number.isFinite(point.h) || !Number.isFinite(yaw)) return off;
  var state=saeivPassengerState,capacity=getSaeivActiveCapacityState(saeivVehicleName);
  var count=function(v){return Math.max(0,Math.min(500,Math.floor(Number(v)||0)));};
  return {type:"nativePassengers",version:2,enabled:true,missionKey:mission,stopKey:key,
    preview:saeivRouteState.started!==true,
    nextStop:nativePassengerNextPlan(stops,index,mission),
    running:!telemetryPaused && hasRecentTelemetryPositionSignal(),
    world:{x:point.x,y:point.h,z:point.y,yawDegrees:((yaw%360)+540)%360-180},
    radiusM:Math.max(SAEIV_STOP_REACH_DISTANCE,SAEIV_STOP_DWELL_REACH_DISTANCE),
    board:count(state.plannedStopBoardingTotal),alight:count(state.plannedStopAlightingTotal),
    onboard:count(state.passengersInBus),capacity:capacity.unlimited?500:Math.max(1,count(capacity.capacity)),
    boardDone:count(state.stopBoardingDone),alightDone:count(state.stopAlightingDone)};
}
function syncNativePassengers(force) {
  if (!telemetryWs||telemetryWs.readyState!==1) return false;
  var payload=buildNativePassengerPayload(),text=JSON.stringify(payload),now=Date.now();
  if (!force&&text===nativePassengerLastPayload&&now-nativePassengerLastSent<600) return false;
  try { telemetryWs.send(text); } catch(err) { return false; }
  nativePassengerLastPayload=text;nativePassengerLastSent=now;
  if(!payload.enabled)nativePassengerLockedMission="";
  return true;
}
function receiveNativePassengerStatus(message) {
  if(!message||message.protocol!==2)return;
  nativePassengerStatus=message;nativePassengerReceivedAt=Date.now();
  window.GAME2_MANAGER.nativePassengerStatus=message;
  var s=message.snapshot;
  if(message.status!=="active"||!s||message.stopKey!==nativePassengerStopKey()||message.missionKey!==nativePassengerMissionKey()||saeivRouteState.started!==true)return;
  nativePassengerLockedMission=message.missionKey;
  if(nativePassengerValidationKey!==message.stopKey||nativePassengerValidationEpoch!==s.epoch){
    nativePassengerValidationKey=message.stopKey;nativePassengerValidationEpoch=s.epoch;
    nativePassengerValidationCount=s.validations; // Do not replay historical beeps after refresh/restart.
  }
  var delta=Math.max(0,s.validations-nativePassengerValidationCount);
  nativePassengerValidationCount=Math.max(nativePassengerValidationCount,s.validations);
  if(delta>0&&message.ready&&s.lease)playSaeivBoardingValidationSound(delta);
}
function nativePassengerServiceView(key) {
  if(!nativePassengersExpected())return null;
  syncNativePassengers(false);
  var m=nativePassengerStatus,s=m&&m.snapshot;
  var valid=m&&m.status==="active"&&m.stopKey===nativePassengerStopKey()&&m.missionKey===nativePassengerMissionKey()&&s;
  var fresh=valid&&Date.now()-nativePassengerReceivedAt<1500&&m.ready&&s.lease;
  if(!valid){
    // Hold instead of silently running the HTML timer in parallel with real people.
    var pending=saeivBusService.snapshot();pending.native=true;pending.nativeStatus=m?m.status:"connecting";
    pending.flowComplete=false;pending.ready=false;pending.particles=[];return pending;
  }
  return {version:2,key:key,native:true,nativeStatus:fresh?(s.unplaced?"capacity_exceeded":s.failed?"model_error":"active"):"suspended",
    inBus:s.onboard,boardingTotal:s.board,boardingDone:s.boardDone,alightingTotal:s.alight,alightingDone:s.alightDone,
    waiting:s.waiting,entryNeedsOpen:s.boardDone<s.board&&s.onboard<s.capacity,exitNeedsOpen:s.alightDone<s.alight,
    leftBehind:s.flowComplete?Math.max(0,s.board-s.boardDone):0,flowComplete:!!(fresh&&s.flowComplete),ready:!!(fresh&&s.serviceReady),
    active:!s.serviceReady,entry:s.entry?"open":"closed",exit:s.exit?"open":"closed",particles:fresh&&Array.isArray(s.particles)?s.particles:[],
    capacity:s.capacity,seated:s.seated,standing:s.standing,exitMiddle:s.exitMiddle,exitRear:s.exitRear};
}
window.setInterval(function(){syncNativePassengers(false);},600);
// No off command on pagehide: a transient refresh must preserve physical occupants.
