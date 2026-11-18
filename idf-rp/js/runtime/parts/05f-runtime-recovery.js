// Recovery data lives in the local bridge, independently of this WebView process.
// Cross-session recovery requires the separate save fingerprint and native confirmation protocol.
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
  if(saeivRouteState&&!saeivRouteState.resumeId)saeivRouteState.resumeId=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2);
  var fields={};Object.keys(nativeRuntimeSlots).forEach(function(k){fields[k]=nativeRuntimeSlots[k].get();});
  var status=typeof nativePassengerStatus==='undefined'?null:nativePassengerStatus,s=status&&status.snapshot,passengers=null;
  if(s&&status.missionKey===nativePassengerMissionKey()&&status.stopKey===nativePassengerStopKey()&&Array.isArray(s.resumePeople)&&s.resumePeople.length===s.onboard){
    passengers={people:s.resumePeople,validations:s.validations||0,missedExitUnits:s.missedExitUnits||0,missedExitPassengers:s.missedExitPassengers||0};
    if(fields.saeivPassengerState)fields.saeivPassengerState=Object.assign({},fields.saeivPassengerState,{passengersInBus:s.onboard,stopBoardingDone:s.boardDone,stopAlightingDone:s.alightDone});
  }
  return {nativePassengers:passengers,route:saeivRouteState,fields:fields,announced:Array.from(saeivAnnouncedStopUids),
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

var nativeServiceResumeDone=0,nativeServiceGenerationClear=false;
function nativeServiceResumeAck(m,action,valid){
  if(telemetryWs&&telemetryWs.readyState===1)telemetryWs.send(JSON.stringify({type:'nativeServiceResumeAck',protocol:1,generation:nativeGameModeGeneration,id:m.id,action:action,valid:valid}));
}
function nativeServiceCanResume(d){
  if(!d||!d.route||!d.fields||!Array.isArray(d.route.stops)||!d.route.started||d.fields.saeivRouteCompletedAtMs)return false;
  var count=Number(d.fields.saeivPassengerState&&d.fields.saeivPassengerState.passengersInBus)||0;
  if(count>0&&(!d.nativePassengers||!Array.isArray(d.nativePassengers.people)||d.nativePassengers.people.length!==count))return false;
  var line=dbusLines.find(function(l){return String(l.uid)===String(d.route.lineUid);});
  var route=line&&line.routes.find(function(r){return String(r.uid)===String(d.route.routeUid);});
  if(!route)return false;
  var current=getRouteStopEntries(route),saved=d.route.stops;
  // A changed physical stop or stop order is a different journey.
  if(saved.length<2||saved.length>current.length)return false;
  return current.some(function(_,offset){return offset+saved.length<=current.length&&saved.every(function(s,i){
    var c=current[offset+i];
    return c&&String(c.uid)===String(s.uid)&&c.point&&s.point&&['x','y','z'].every(function(axis){
      return Number.isFinite(Number(c.point[axis]))&&Number.isFinite(Number(s.point[axis]))&&Math.abs(Number(c.point[axis])-Number(s.point[axis]))<1;
    });
  });});
}
function receiveServiceResume(m){
  if(!m||m.protocol!==1||m.generation!==nativeGameModeGeneration||!Number.isInteger(m.id))return false;
  if(m.action==='discard'){
    if(saeivRouteState&&saeivRouteState.resumeId===m.run)clearSaeivRouteSelection();return true;
  }
  var d=m.checkpoint&&m.checkpoint.data;
  if(m.action==='prepare'){
    nativeServiceResumeAck(m,'prepared',nativeServiceCanResume(d)&&(!saeivRouteState||saeivRouteState.resumeId===d.route.resumeId));return true;
  }
  if(m.action!=='restore'&&m.action!=='continue')return false;
  if(nativeServiceResumeDone===m.id){nativeServiceResumeAck(m,'restored',true);return true;}
  if(!nativeServiceCanResume(d))return false;
  if(saeivRouteState){
    if(saeivRouteState.resumeId!==d.route.resumeId)return false;
    nativeServiceResumeDone=m.id;nativeServiceResumeAck(m,'restored',true);return true;
  }
  var c=JSON.parse(JSON.stringify(m.checkpoint)),token=(Math.floor(Math.random()*0xffffffff)>>>0)||1;
  c.generation=nativeGameModeGeneration;c.token=token;
  c.data.fields.nativeCompletionToken=token;
  c.data.route.nativePassengerKey=String(c.data.route.selectedKey)+':resume:'+m.id;
  c.data.fields.nativePassengerLockedMission='';c.data.fields.nativePassengerValidationKey='';
  c.data.fields.nativePassengerValidationEpoch=0;c.data.fields.nativePassengerValidationCount=0;
  if(c.data.nativePassengers)c.data.route.resumePassengers=Object.assign({ticket:m.id},c.data.nativePassengers);
  var now=getSaeivNowTimestampMs(),clock=saeivGameClockNowMs,lastSource=saeivGameClockLastSourceTsMs,nativeClock=saeivNativeGameClock;
  nativeRuntimeResumeGeneration='';
  if(!receiveNativeRuntimeResume({protocol:1,generation:nativeGameModeGeneration,token:token,checkpoint:c}))return false;
  saeivGameClockNowMs=clock;saeivGameClockLastSourceTsMs=lastSource;saeivNativeGameClock=nativeClock;
  var delta=Number(now)-Number(d.clock);if(Number.isFinite(delta)&&delta)rebaseSaeivServiceClock(delta);
  nativeRuntimePauseClock=null;saeivBusService.lastTime=null;
  if(saeivPassengerSatisfaction)saeivPassengerSatisfaction.delayAt=0;
  nativeServiceResumeDone=m.id;
  syncSaeivExternalState(true);syncNativePassengers(true);syncNativeRuntimeCheckpoint(true);nativeServiceResumeAck(m,'restored',true);return true;
}
function nativeServiceDiscardCurrent(){
  if(nativeServiceGenerationClear||!saeivRouteState||!saeivRouteState.resumeId||!telemetryWs||telemetryWs.readyState!==1)return;
  telemetryWs.send(JSON.stringify({type:'nativeServiceTerminal',protocol:1,generation:nativeGameModeGeneration,run:saeivRouteState.resumeId}));
}
