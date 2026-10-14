// Local cabin foley. Sources belong to the native passenger-controller owner.
// All coordinates are bus-local, like audioCamera*: driving cannot add lag.
var passengerCabinAudio = { actors:new Map(),voices:new Set(),identity:'',stamp:0,
  timer:null,nextStep:0,nextPhone:0,step:0,lastPhone:{1:-1,2:-1} };
function passengerCabinMix(kind, actor, data) {
  if(!actor||!data||!data.audioCameraAvailable||!data.audioCameraInside||data.paused)
    return {gain:0,pan:0,cutoff:10000};
  var dx=actor.x-data.audioCameraX,dy=actor.y-data.audioCameraY,dz=actor.z-data.audioCameraZ;
  var distance=Math.hypot(dx,dy,dz),far=kind==='passengerStep'?14:12;
  if(!Number.isFinite(distance)||distance>=far)return {gain:0,pan:0,cutoff:10000};
  var right=dx*data.audioCameraRightX+dy*data.audioCameraRightY+dz*data.audioCameraRightZ;
  return {gain:Math.min(1,(far-distance)/3)/(1+Math.pow(Math.max(0,distance-1.5)/4,2)),
    pan:Number.isFinite(right)?Math.max(-.9,Math.min(.9,right/Math.max(1,distance))):0,
    cutoff:Math.max(2500,13000-distance*700)};
}
function passengerCabinReady() {
  var s=busSpatialAudio,now=Date.now();
  return typeof currentGameMode!=='undefined'&&normalizeGameMode(currentGameMode)==='bus'&&
    now-passengerCabinAudio.stamp<750&&now-s.stamp<1000&&s.telemetry&&
    s.telemetry.audioCameraAvailable&&s.telemetry.audioCameraInside&&!s.telemetry.paused&&
    nativeGameAudio.available&&now-nativeGameAudio.stamp<2000&&getGlobalAudioVolumeFactor()>0;
}
function stopPassengerCabinVoice(v) {
  if(!passengerCabinAudio.voices.delete(v))return;
  v.audio.pause();v.audio.src='';
}
function resetPassengerCabinAudio() {
  var s=passengerCabinAudio;
  Array.from(s.voices).forEach(stopPassengerCabinVoice);s.actors.clear();s.identity='';s.stamp=0;
  if(s.timer){clearInterval(s.timer);s.timer=null;}
}
function receivePassengerCabinAudio(m) {
  var s=passengerCabinAudio,snapshot=m&&m.snapshot;
  if(!m||m.status!=='active'||!m.ready||!snapshot||!snapshot.lease||!Array.isArray(snapshot.audioActors)){
    resetPassengerCabinAudio();return;
  }
  var now=Date.now(),identity=m.missionKey+':'+snapshot.epoch;
  if(identity!==s.identity){resetPassengerCabinAudio();s.identity=identity;s.nextPhone=now+4000+Math.random()*7000;}
  var valid=new Set();
  snapshot.audioActors.slice(0,64).forEach(function(p){
    if(!p||!Number.isInteger(p.id)||p.id<1||![1,2].includes(p.sex)||
       !['x','y','z'].every(function(k){return Number.isFinite(p[k])&&Math.abs(p[k])<=32;})||
       typeof p.walk!=='boolean'||typeof p.phone!=='boolean'||valid.has(p.id))return;
    valid.add(p.id);var a=s.actors.get(p.id);
    if(!a){a={id:p.id,walked:0,nextPhone:0};s.actors.set(p.id,a);}
    else if(p.walk&&a.walk&&now-s.stamp<500&&passengerCabinReady()){
      var d=Math.hypot(p.x-a.x,p.z-a.z);
      if(d<1.2)a.walked=Math.min(.9,a.walked+d);else a.walked=0;
    }else a.walked=0;
    Object.assign(a,p);
  });
  s.actors.forEach(function(a,id){if(!valid.has(id))s.actors.delete(id);});s.stamp=now;
  if(!s.timer&&s.actors.size)s.timer=setInterval(tickPassengerCabinAudio,100);
  tickPassengerCabinAudio();
}
function playPassengerCabinVoice(a,kind,file) {
  var s=passengerCabinAudio;
  if(!passengerCabinReady())return;
  var audio=createBusSpatialAudio('sounds/passengers/'+file,kind),r=busSpatialAudio.records.get(audio);
  r.passenger=a;setBusAudioLevel(audio,kind==='passengerStep'?.38:.55);
  var v={audio:audio,actor:a,kind:kind,deadline:Date.now()+15000};s.voices.add(v);
  ['ended','error'].forEach(function(event){audio.addEventListener(event,function(){stopPassengerCabinVoice(v);});});
  audio.play().catch(function(){stopPassengerCabinVoice(v);});
}
function tickPassengerCabinAudio() {
  var s=passengerCabinAudio,now=Date.now(),ready=passengerCabinReady();
  s.voices.forEach(function(v){
    if(!ready||!s.actors.has(v.actor.id)||now>v.deadline||
       (v.kind==='passengerPhone'&&!v.actor.phone))stopPassengerCabinVoice(v);
  });
  if(!ready){s.actors.forEach(function(a){a.walked=0;});
    if(now-s.stamp>=750)resetPassengerCabinAudio();return;
  }
  var nearby=Array.from(s.actors.values()).map(function(a){return {a:a,m:passengerCabinMix('passengerPhone',a,busSpatialAudio.telemetry)};})
    .filter(function(v){return v.m.gain>.015;}).sort(function(a,b){return b.m.gain-a.m.gain;});
  var steps=0,phone=false;s.voices.forEach(function(v){if(v.kind==='passengerPhone')phone=true;else ++steps;});
  if(steps<3&&now>=s.nextStep){
    var walker=nearby.find(function(v){return v.a.walk&&v.a.walked>=.43;});
    if(walker){walker.a.walked=0;s.nextStep=now+100;
      s.step=(s.step+1+Math.floor(Math.random()*5))%6;
      playPassengerCabinVoice(walker.a,'passengerStep','step-'+(s.step+1)+'.wav');}
  }
  if(!phone&&now>=s.nextPhone){
    var caller=nearby.find(function(v){return v.a.phone&&now>=v.a.nextPhone;});
    if(caller){var a=caller.a,clip=(s.lastPhone[a.sex]+1+Math.floor(Math.random()*7))%8;s.lastPhone[a.sex]=clip;
      a.nextPhone=now+60000+Math.random()*45000;s.nextPhone=now+22000+Math.random()*18000;
      playPassengerCabinVoice(a,'passengerPhone',(a.sex===1?'female':'male')+'-'+(clip+1)+'.wav');}
  }
  if(!s.actors.size&&!s.voices.size&&s.timer){clearInterval(s.timer);s.timer=null;}
}
window.addEventListener('pagehide',resetPassengerCabinAudio);
