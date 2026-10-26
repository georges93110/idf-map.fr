// Native physical transfers are authoritative for the measured Bluebus profile.
var nativePassengerStatus = null;
var nativePassengerReceivedAt = 0;
var nativePassengerLastSent = 0;
var nativePassengerLastPayload = "";
var nativePassengerLockedMission = "";
var nativePassengerValidationKey = "";
var nativePassengerValidationEpoch = null;
var nativePassengerValidationCount = 0;
var nativePassengerFareAudio = null;
var nativePassengerSelectionSerial = 0;
// Only real local playback calls this; previews and other Convoy buses do not.
function nativePassengerMoveBackAnnouncement(title) {
  if(!/fond/i.test(String(title||""))||!saeivRouteState||saeivRouteState.started!==true||
     normalizeGameMode(currentGameMode)!=="bus"||!telemetryWs||telemetryWs.readyState!==1)return false;
  var mission=nativePassengerMissionKey();if(!mission)return false;
  syncNativePassengers(true);
  try{telemetryWs.send(JSON.stringify({type:"nativePassengerCommand",version:1,action:"moveBack",missionKey:mission,title:String(title).slice(0,512)}));return true;}catch(_){return false;}
}
function nativePassengerValidationAnnouncement(title) {
  if(!/valid/i.test(String(title||""))||!saeivRouteState||saeivRouteState.started!==true||
     normalizeGameMode(currentGameMode)!=="bus"||!telemetryWs||telemetryWs.readyState!==1)return false;
  var mission=nativePassengerMissionKey();if(!mission)return false;
  syncNativePassengers(true);
  try{telemetryWs.send(JSON.stringify({type:"nativePassengerCommand",version:1,action:"validate",missionKey:mission,title:String(title).slice(0,512)}));return true;}catch(_){return false;}
}
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
  return /bluebus|evadys|agora|solaris.*urbino|urbino.*solaris/i.test(String(saeivVehicleName || "") + " " + String((telemetryLastSignal || {}).vehicleName || ""));
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
    cached=state.nextNativePlan={index:nextIndex,uid:uid,counts:{board:counts.board,alight:counts.alight,demandDisabled:counts.demandDisabled===true}};
  }
  var point=getSaeivStopExactWorldPoint(stop),yaw=saeivStopZoneHeading(stop);
  if(!point||!Number.isFinite(point.h)||!Number.isFinite(yaw))return null;
  return {stopKey:[mission,nextIndex,uid].join(":"),board:Math.min(500,cached.counts.board),
    world:{x:point.x,y:point.h,z:point.y,yawDegrees:((yaw%360)+540)%360-180},
    radiusM:Math.max(SAEIV_STOP_REACH_DISTANCE,SAEIV_STOP_DWELL_REACH_DISTANCE)};
}
// Only the imminent stop can be dispensable. A stale or unconfirmed shared
// population must never hide a required stop, especially an onboard exit.
function isSaeivNextStopOptional() {
  var route=saeivRouteState,state=saeivPassengerState;
  if(!route||!state||route.started!==true||state.targetIndex!==route.targetIndex||
     route.targetIndex>=route.stops.length-1)return false;
  var m=nativePassengerStatus,s=m&&m.snapshot;
  if(nativePassengersExpected()){
    if(!m||m.status!=="active"||m.stopKey!==nativePassengerStopKey()||m.missionKey!==nativePassengerMissionKey()||
       Date.now()-nativePassengerReceivedAt>=1500||!m.ready||!s||!s.lease)return false;
    if(s.alight>s.alightDone||s.board>s.boardDone)return false;
    if(m.sharing&&m.sharing.active)return !m.sharing.pending&&m.sharing.covered===true;
    return true;
  }
  return state.plannedStopBoardingTotal<=state.stopBoardingDone&&state.plannedStopAlightingTotal<=state.stopAlightingDone;
}
function sharedPassengerStopTriplets(stops) {
  var identities=stops.map(function(stop){
    var p=getSaeivStopExactWorldPoint(stop),yaw=saeivStopZoneHeading(stop);
    if(!p||![p.x,p.y,p.h,yaw].every(Number.isFinite))return null;
    // Physical platforms and their direction, independent of line number,
    // destination, GPS passage overrides and the service's starting ordinal.
    return [String(stop.uid||''),p.x,p.y,p.h,((yaw%360)+360)%360];
  });
  return identities.map(function(current,i){
    return i>0&&i+1<identities.length&&identities[i-1]&&current&&identities[i+1]?
      JSON.stringify([identities[i-1],current,identities[i+1]]):null;
  });
}
function sharedPassengerServiceMetadata(stops,index) {
  var route=saeivRouteState,state=saeivPassengerState;
  if(route.sharedServiceStops!==stops||route.sharedServiceSelection!==route.selectedKey){route.sharedServiceStops=stops;route.sharedServiceSelection=route.selectedKey;route.sharedServiceKey=JSON.stringify([route.selectedKey,stops.map(function(s){
    var p=getSaeivStopExactWorldPoint(s),via=typeof getSaeivStopGpsOverrideWorldPoint==='function'?getSaeivStopGpsOverrideWorldPoint(s):null;
    return [String(s.uid||''),p&&p.x,p&&p.y,p&&p.h,saeivStopZoneHeading(s),via];
  })]);route.sharedServiceTriplets=sharedPassengerStopTriplets(stops);}
  var first=Math.max(0,index-2);
  return {key:route.sharedServiceKey,index:index,last:stops.length-1,
    segment:{first:first,tokens:route.sharedServiceTriplets.slice(first,Math.min(stops.length,index+3))},
    demand:Math.max(0,Math.min(500,Math.floor(Number(state.sharedOriginalDemand===undefined?state.plannedStopBoardingTotal:state.sharedOriginalDemand)||0)))};
}

function buildNativePassengerPayload() {
  var off = {type:"nativePassengers",version:2,enabled:false};
  var key=nativePassengerStopKey(),mission=nativePassengerMissionKey();
  if (!mission || !key || normalizeGameMode(currentGameMode)!=="bus" || !saeivPassengerState) return off;
  // Coordinates, counts and identity must belong to the same stop snapshot.
  var stops=saeivRouteState.stops,index=saeivPassengerState.targetIndex;
  if (!Array.isArray(stops)||!stops[index]) return off;
  var stop=stops[index],point=getSaeivStopExactWorldPoint(stop),yaw=saeivStopZoneHeading(stop);
  if (!point || !Number.isFinite(point.h) || !Number.isFinite(yaw)) return off;
  var state=saeivPassengerState,capacity=getSaeivActiveCapacityState(saeivVehicleName);
  var count=function(v){return Math.max(0,Math.min(500,Math.floor(Number(v)||0)));};
  return {type:"nativePassengers",version:2,enabled:true,missionKey:mission,stopKey:key,
    preview:saeivRouteState.started!==true,terminal:saeivRouteState.started===true&&index===stops.length-1,
    nextStop:nativePassengerNextPlan(stops,index,mission),service:sharedPassengerServiceMetadata(stops,index),
    // A late browser callback is not an SCS pause. The DLL checks its live
    // SDK state again before every physical transfer, in every camera.
    running:!telemetryPaused,
    world:{x:point.x,y:point.h,z:point.y,yawDegrees:((yaw%360)+540)%360-180},
    radiusM:Math.max(SAEIV_STOP_REACH_DISTANCE,SAEIV_STOP_DWELL_REACH_DISTANCE),
    // A heartbeat may run between a physical transfer and the UI service tick.
    // Never reject the lease merely because its planned total is still stale.
    board:Math.max(count(state.plannedStopBoardingTotal),count(state.stopBoardingDone)),
    alight:Math.max(count(state.plannedStopAlightingTotal),count(state.stopAlightingDone)),
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
  if(typeof receivePassengerCabinAudio==='function')receivePassengerCabinAudio(message);
  window.GAME2_MANAGER.nativePassengerStatus=message;
  var s=message.snapshot;
  if(message.status!=="active"||!s||message.stopKey!==nativePassengerStopKey()||message.missionKey!==nativePassengerMissionKey()||saeivRouteState.started!==true)return;
  nativePassengerLockedMission=message.missionKey;
  // Missed exits are carried into this stop by the DLL. Adopt its totals before
  // the next heartbeat, including when recovering an expired lease. The identity
  // check above prevents a previous stop or mission from changing this plan.
  if(saeivPassengerState){
    if(Number.isSafeInteger(s.missedExitUnits)&&s.missedExitUnits>=0){
      var previous=saeivPassengerState.nativeMissedExitCounter;
      var base=previous&&previous.epoch===s.epoch?previous.units:0;
      saeivPassengerState.missedExitPenalty=(Number(saeivPassengerState.missedExitPenalty)||0)+Math.max(0,s.missedExitUnits-base);
      saeivPassengerState.nativeMissedExitCounter={epoch:s.epoch,units:Math.max(base,s.missedExitUnits)};
    }
    var validTotal=function(total,done){return Number.isInteger(total)&&Number.isInteger(done)&&total>=0&&total<=500&&done>=0&&done<=total;};
    if(validTotal(s.board,s.boardDone))saeivPassengerState.plannedStopBoardingTotal=s.board;
    if(validTotal(s.alight,s.alightDone))saeivPassengerState.plannedStopAlightingTotal=s.alight;
  }
  if(s.fareVersion===1 && Number.isSafeInteger(s.farePassSounds) && s.farePassSounds>=0 && Number.isSafeInteger(s.fareErrorSounds) && s.fareErrorSounds>=0){
    var key=String(s.epoch)+":"+message.missionKey,previous=nativePassengerFareAudio;
    var accepted=previous&&previous.key===key?Math.max(0,s.farePassSounds-previous.accepted):0;
    var rejected=previous&&previous.key===key?Math.max(0,s.fareErrorSounds-previous.rejected):0;
    nativePassengerFareAudio={key:key,accepted:Math.max(previous&&previous.key===key?previous.accepted:0,s.farePassSounds),rejected:Math.max(previous&&previous.key===key?previous.rejected:0,s.fareErrorSounds)};
    if(message.ready&&s.lease){
      if(accepted)playSaeivBoardingValidationSound(accepted,"Pass");
      if(rejected)playSaeivBoardingValidationSound(rejected,"Error");
    }
    return;
  }
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
  var sharedPending=m.sharing&&m.sharing.active&&saeivRouteState.targetIndex<saeivRouteState.stops.length-1&&
    (m.sharing.pending||(!m.sharing.covered&&s.board<=s.boardDone));
  return {version:2,key:key,native:true,nativeStatus:fresh?(s.unplaced?"capacity_exceeded":s.failed?"model_error":"active"):"suspended",
    fresh:fresh,zoneTouched:s.zoneTouched===true,inBus:s.onboard,boardingTotal:s.board,boardingDone:s.boardDone,alightingTotal:s.alight,alightingDone:s.alightDone,
    waiting:s.waiting,entryNeedsOpen:s.boardDone<s.board&&s.onboard<s.capacity,exitNeedsOpen:s.alightDone<s.alight,
    leftBehind:s.flowComplete?Math.max(0,s.board-s.boardDone):0,flowComplete:!!(fresh&&!sharedPending&&s.flowComplete),ready:!!(fresh&&!sharedPending&&s.serviceReady),
    active:!s.serviceReady,entry:s.entry?"open":"closed",exit:s.exit?"open":"closed",particles:fresh&&Array.isArray(s.particles)?s.particles:[],
    capacity:s.capacity,seated:s.seated,standing:s.standing,exitMiddle:s.exitMiddle,exitRear:s.exitRear};
}
window.setInterval(function(){syncNativePassengers(false);},600);
// No off command on pagehide: a transient refresh must preserve physical occupants.
