// Recovery data lives in the local bridge, independently of this WebView process.
// Never restore across native epochs/revisions (game/profile/mode/vehicle change).
var nativeRuntimeRestoring=false,nativeRuntimeResumeGeneration="",nativeRuntimeMessage=null;
var nativeRuntimeCheckpointAt=0,nativeRuntimeCheckpointText="",nativeRuntimeCheckpointState="",nativeRuntimePauseClock=null;
var nativeRuntimeSlots={
  saeivRouteState:{get:function(){return saeivRouteState;},set:function(v){saeivRouteState=v;}},
  saeivPassengerState:{get:function(){return saeivPassengerState;},set:function(v){saeivPassengerState=v;}},
  saeivPassengerDefaults:{get:function(){return saeivPassengerDefaults;},set:function(v){saeivPassengerDefaults=v;}},
  saeivPassengerSatisfaction:{get:function(){return saeivPassengerSatisfaction;},set:function(v){saeivPassengerSatisfaction=v;}},
  saeivRouteStartPoint:{get:function(){return saeivRouteStartPoint;},set:function(v){saeivRouteStartPoint=v;}},
  saeivRouteSelectedAtMs:{get:function(){return saeivRouteSelectedAtMs;},set:function(v){saeivRouteSelectedAtMs=v;}},
  saeivRouteStartedAtMs:{get:function(){return saeivRouteStartedAtMs;},set:function(v){saeivRouteStartedAtMs=v;}},
  saeivTerminusReachedAtMs:{get:function(){return saeivTerminusReachedAtMs;},set:function(v){saeivTerminusReachedAtMs=v;}},
  saeivRouteCompletedAtMs:{get:function(){return saeivRouteCompletedAtMs;},set:function(v){saeivRouteCompletedAtMs=v;}},
  saeivTerminusAnnouncedRouteKey:{get:function(){return saeivTerminusAnnouncedRouteKey;},set:function(v){saeivTerminusAnnouncedRouteKey=v;}},
  saeivTransdevTerminusApproachAnnouncedRouteKey:{get:function(){return saeivTransdevTerminusApproachAnnouncedRouteKey;},set:function(v){saeivTransdevTerminusApproachAnnouncedRouteKey=v;}},
  saeivReachedStopsCount:{get:function(){return saeivReachedStopsCount;},set:function(v){saeivReachedStopsCount=v;}},
  saeivLateStopsCount:{get:function(){return saeivLateStopsCount;},set:function(v){saeivLateStopsCount=v;}},
  saeivServedStopsCount:{get:function(){return saeivServedStopsCount;},set:function(v){saeivServedStopsCount=v;}},
  saeivMaxPassengersEverInBus:{get:function(){return saeivMaxPassengersEverInBus;},set:function(v){saeivMaxPassengersEverInBus=v;}},
  saeivRouteBoardedPassengers:{get:function(){return saeivRouteBoardedPassengers;},set:function(v){saeivRouteBoardedPassengers=v;}},
  saeivReachedStopDelayLog:{get:function(){return saeivReachedStopDelayLog;},set:function(v){saeivReachedStopDelayLog=v;}},
  saeivStopServedLog:{get:function(){return saeivStopServedLog;},set:function(v){saeivStopServedLog=v;}},
  saeivStatsRecordedReachedIndex:{get:function(){return saeivStatsRecordedReachedIndex;},set:function(v){saeivStatsRecordedReachedIndex=v;}},
  saeivStatsRecordedServedIndex:{get:function(){return saeivStatsRecordedServedIndex;},set:function(v){saeivStatsRecordedServedIndex=v;}},
  saeivCurrentStopWasServed:{get:function(){return saeivCurrentStopWasServed;},set:function(v){saeivCurrentStopWasServed=v;}},
  saeivLastStopAdvanceAt:{get:function(){return saeivLastStopAdvanceAt;},set:function(v){saeivLastStopAdvanceAt=v;}},
  saeivTargetArrivalUid:{get:function(){return saeivTargetArrivalUid;},set:function(v){saeivTargetArrivalUid=v;}},
  saeivTargetArrivalArmed:{get:function(){return saeivTargetArrivalArmed;},set:function(v){saeivTargetArrivalArmed=v;}},
  saeivTargetDwellUid:{get:function(){return saeivTargetDwellUid;},set:function(v){saeivTargetDwellUid=v;}},
  saeivTargetDwellStartAt:{get:function(){return saeivTargetDwellStartAt;},set:function(v){saeivTargetDwellStartAt=v;}},
  saeivStoppedAtStopIndex:{get:function(){return saeivStoppedAtStopIndex;},set:function(v){saeivStoppedAtStopIndex=v;}},
  saeivStoppedAtStopUid:{get:function(){return saeivStoppedAtStopUid;},set:function(v){saeivStoppedAtStopUid=v;}},
  saeivVehicleName:{get:function(){return saeivVehicleName;},set:function(v){saeivVehicleName=v;}},
  saeivTimeSystem:{get:function(){return saeivTimeSystem;},set:function(v){saeivTimeSystem=v;}},
  saeivGameClockNowMs:{get:function(){return saeivGameClockNowMs;},set:function(v){saeivGameClockNowMs=v;}},
  saeivGameClockLastSourceTsMs:{get:function(){return saeivGameClockLastSourceTsMs;},set:function(v){saeivGameClockLastSourceTsMs=v;}},
  saeivNativeGameClock:{get:function(){return saeivNativeGameClock;},set:function(v){saeivNativeGameClock=v;}},
  saeivRouteClockShiftKey:{get:function(){return saeivRouteClockShiftKey;},set:function(v){saeivRouteClockShiftKey=v;}},
  saeivRouteClockShiftMs:{get:function(){return saeivRouteClockShiftMs;},set:function(v){saeivRouteClockShiftMs=v;}},
  nativePassengerSelectionSerial:{get:function(){return nativePassengerSelectionSerial;},set:function(v){nativePassengerSelectionSerial=v;}},
  nativePassengerLockedMission:{get:function(){return nativePassengerLockedMission;},set:function(v){nativePassengerLockedMission=v;}},
  nativePassengerValidationKey:{get:function(){return nativePassengerValidationKey;},set:function(v){nativePassengerValidationKey=v;}},
  nativePassengerValidationEpoch:{get:function(){return nativePassengerValidationEpoch;},set:function(v){nativePassengerValidationEpoch=v;}},
  nativePassengerValidationCount:{get:function(){return nativePassengerValidationCount;},set:function(v){nativePassengerValidationCount=v;}},
  nativeCompletionToken:{get:function(){return nativeCompletionToken;},set:function(v){nativeCompletionToken=v;}},
  nativeCompletionId:{get:function(){return nativeCompletionId;},set:function(v){nativeCompletionId=v;}},
  nativeCompletionSequence:{get:function(){return nativeCompletionSequence;},set:function(v){nativeCompletionSequence=v;}}
};
function nativeRuntimeVisibility(hidden){
  if(document.documentElement)document.documentElement.classList.toggle('idf-plugin-suspended',hidden);
  if(hidden&&nativeRuntimePauseClock===null&&saeivRouteState)nativeRuntimePauseClock=getSaeivNowTimestampMs();
  if(!hidden&&nativeRuntimePauseClock!==null){
    var now=getSaeivNowTimestampMs();
    if(Number.isFinite(now)&&Number.isFinite(nativeRuntimePauseClock)&&now>nativeRuntimePauseClock)rebaseSaeivServiceClock(now-nativeRuntimePauseClock);
    nativeRuntimePauseClock=null;
    if(saeivPassengerSatisfaction)saeivPassengerSatisfaction.delayAt=0;
    saeivBusService.lastTime=null; // Never catch up transfers through the outage.
  }
}
function nativeRuntimeCapture(){
  var fields={};Object.keys(nativeRuntimeSlots).forEach(function(k){fields[k]=nativeRuntimeSlots[k].get();});
  return {route:saeivRouteState,fields:fields,announced:Array.from(saeivAnnouncedStopUids),
    announcementEnds:Array.from(saeivStopAnnounceEndedAtByUid),stopRequestPlayed:Array.from(saeivStopRequestAudioPlayedSegments),
    journey:Object.assign({},saeivLumiplanJourney),service:Object.assign({},saeivBusService,{nativeView:null}),
    clock:getSaeivNowTimestampMs()};
}
function syncNativeRuntimeCheckpoint(force){
  if(nativeRuntimeRestoring||!nativeGameModeApplied||!nativeRuntimeMessage||nativeRuntimeMessage.recovery!==1||
     !telemetryWs||telemetryWs.readyState!==1||telemetryWs.bufferedAmount>32768)return false;
  var token=nativeModeActiveServiceToken(),r=saeivRouteState;
  var state=[token,r&&r.started,r&&r.targetIndex,r&&r.reachedIndex,saeivRouteCompletedAtMs].join(':');
  var now=Date.now();if(now-nativeRuntimeCheckpointAt<500&&(!force||state===nativeRuntimeCheckpointState))return false;
  nativeRuntimeCheckpointState=state;
  nativeRuntimeCheckpointAt=now;
  try{
    var message={type:'nativeRuntimeCheckpoint',protocol:1,generation:nativeGameModeGeneration,
      token:token,data:token?nativeRuntimeCapture():{route:null}};
    var text=JSON.stringify(message);if(text===nativeRuntimeCheckpointText)return true;
    if(text.length>240000)return false;
    telemetryWs.send(text);nativeRuntimeCheckpointText=text;return true;
  }catch(e){console.warn('[IDF-RP] Service checkpoint failed',e);return false;}
}
function receiveNativeRuntimeResume(m){
  if(!m||m.protocol!==1||!nativeRuntimeMessage||m.generation!==nativeGameModeGeneration)return false;
  if(nativeRuntimeResumeGeneration===m.generation)return true;
  // A reconnect of a still-live page always keeps its newer state.
  if(!saeivRouteState&&m.token){
    var c=m.checkpoint,d=c&&c.data;
    if(!c||c.generation!==m.generation||c.token!==m.token||!d||!d.route||!d.fields||
       !Array.isArray(d.route.stops)||!d.route.stops.length){
      console.warn('[IDF-RP] Waiting for the active service checkpoint');return false;
    }
    Object.keys(nativeRuntimeSlots).forEach(function(k){if(Object.prototype.hasOwnProperty.call(d.fields,k))nativeRuntimeSlots[k].set(d.fields[k]);});
    saeivRouteState=d.route;
    saeivAnnouncedStopUids=new Set(d.announced||[]);saeivStopAnnounceEndedAtByUid=new Map(d.announcementEnds||[]);
    saeivStopRequestAudioPlayedSegments=new Set(d.stopRequestPlayed||[]);
    if(d.journey)Object.keys(saeivLumiplanJourney).forEach(function(k){if(k in d.journey)saeivLumiplanJourney[k]=d.journey[k];});
    if(d.service)Object.keys(saeivBusService).forEach(function(k){if(k in d.service)saeivBusService[k]=d.service[k];});
    saeivBusService.lastTime=null;saeivBusService.nativeView=null;
    nativeModeServiceObject=saeivRouteState;nativeModeServiceToken=m.token;
    nativeRuntimePauseClock=Number(d.clock);
    nativePassengerLastPayload='';nativePassengerLastSent=0;
    nativeGpsLastKey='';nativeGpsLastSentAt=0;saeivLastStateKey='';
    var cfg=getActiveSaeivLineAudioConfig();
    prepareSaeivGlobalAudioFolder(cfg.globalAudioFolderName).catch(function(){});
    // Do not call activate/start: they reroll passengers, play acceptance audio
    // and erase accounting. Native mission IDs and completion IDs are retained.
  }
  nativeRuntimeResumeGeneration=m.generation;nativeRuntimeRestoring=false;
  receiveNativeGameMode(nativeRuntimeMessage);
  syncNativeRuntimeCheckpoint(true);
  return true;
}
