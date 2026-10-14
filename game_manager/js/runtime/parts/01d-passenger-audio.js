// Own-bus cabin audio only. Positions are bus-local; no Convoy events.
var passengerCabinAudio = { actors:new Map(),voices:new Set(),identity:'',stamp:0,
  timer:null,nextStep:0,step:0,onboard:0,ambience:null,retryAt:0 };
function passengerCrowdLevel(count) {
  if(!Number.isInteger(count)||count<=15)return 0;
  return .34*Math.pow(Math.min(1,(count-15)/60),.65);
}
function passengerCabinMix(kind, actor, data) {
  if(!actor||!data||!data.audioCameraAvailable||!data.audioCameraInside||data.paused)
    return {gain:0,pan:0,cutoff:10000};
  var dx=actor.x-data.audioCameraX,dy=actor.y-data.audioCameraY,dz=actor.z-data.audioCameraZ;
  var distance=Math.hypot(dx,dy,dz),far=14;
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
function stopPassengerAmbience() {
  var s=passengerCabinAudio,v=s.ambience;s.ambience=null;
  if(!v)return;
  if(v.source){v.source.onended=null;try{v.source.stop();}catch(_){}v.source.disconnect();}
  if(v.gain)v.gain.disconnect();
}
function tickPassengerAmbience(ready) {
  var s=passengerCabinAudio,now=Date.now();
  // Camera/pause/owner changes stop immediately, including pending decoding.
  if(!ready){stopPassengerAmbience();return;}
  var level=passengerCrowdLevel(s.onboard),v=s.ambience,c=busSpatialAudio.context;
  if(!v){
    if(!level||now<s.retryAt)return;
    var Context=window.AudioContext||window.webkitAudioContext;
    if(!c&&Context){try{c=busSpatialAudio.context=new Context();}catch(_){s.retryAt=now+30000;return;}}
    if(!c)return;
    resumeBusAudioContext();
    v={source:null,gain:null,target:-1,silentAt:0};s.ambience=v;
    // One cached, seamless buffer; never restart it when the passenger count changes.
    fetchBusDecodedClip(new URL('sounds/passengers/cabin-murmur-v2.wav',window.location.href).href,c).then(function(buffer){
      if(s.ambience!==v)return;
      if(!passengerCabinReady()||!passengerCrowdLevel(s.onboard)){stopPassengerAmbience();return;}
      v.gain=c.createGain();v.gain.gain.value=0;
      v.source=c.createBufferSource();v.source.buffer=buffer;v.source.loop=true;
      v.source.connect(v.gain);v.gain.connect(c.destination);
      v.source.start(0,Math.random()*buffer.duration);
      tickPassengerAmbience(true);
    }).catch(function(){if(s.ambience===v){stopPassengerAmbience();s.retryAt=Date.now()+30000;}});
  }
  if(!v.gain)return;
  var target=level*getGlobalAudioVolumeFactor();
  if(target!==v.target){v.target=target;v.gain.gain.setTargetAtTime(target,c.currentTime,level?1.2:.2);}
  if(level)v.silentAt=0;
  else if(!v.silentAt)v.silentAt=now;
  else if(now-v.silentAt>=1500)stopPassengerAmbience();
}
function stopPassengerCabinVoice(v) {
  if(!passengerCabinAudio.voices.delete(v))return;
  v.audio.pause();v.audio.src='';
}
function resetPassengerCabinAudio() {
  var s=passengerCabinAudio;
  Array.from(s.voices).forEach(stopPassengerCabinVoice);stopPassengerAmbience();
  s.actors.clear();s.identity='';s.stamp=0;s.onboard=0;s.retryAt=0;
  if(s.timer){clearInterval(s.timer);s.timer=null;}
}
function receivePassengerCabinAudio(m) {
  var s=passengerCabinAudio,snapshot=m&&m.snapshot;
  if(!m||m.status!=='active'||!m.ready||!snapshot||!snapshot.lease){resetPassengerCabinAudio();return;}
  var now=Date.now(),identity=m.missionKey+':'+snapshot.epoch;
  if(identity!==s.identity){resetPassengerCabinAudio();s.identity=identity;}
  s.onboard=Number.isInteger(snapshot.onboard)&&snapshot.onboard>=0&&snapshot.onboard<=500?snapshot.onboard:0;
  var valid=new Set();
  (Array.isArray(snapshot.audioActors)?snapshot.audioActors:[]).slice(0,64).forEach(function(p){
    if(!p||!Number.isInteger(p.id)||p.id<1||p.walk!==true||
       !['x','y','z'].every(function(k){return Number.isFinite(p[k])&&Math.abs(p[k])<=32;})||valid.has(p.id))return;
    valid.add(p.id);var a=s.actors.get(p.id);
    if(!a){a={id:p.id,walked:0};s.actors.set(p.id,a);}
    else if(a.walk&&now-s.stamp<500&&passengerCabinReady()){
      var d=Math.hypot(p.x-a.x,p.z-a.z);
      if(d<1.2)a.walked=Math.min(.9,a.walked+d);else a.walked=0;
    }else a.walked=0;
    Object.assign(a,{id:p.id,x:p.x,y:p.y,z:p.z,walk:true});
  });
  s.actors.forEach(function(a,id){if(!valid.has(id))s.actors.delete(id);});s.stamp=now;
  if(!s.timer&&(s.actors.size||s.onboard>15))s.timer=setInterval(tickPassengerCabinAudio,100);
  tickPassengerCabinAudio();
}
function playPassengerCabinVoice(a,kind,file) {
  var s=passengerCabinAudio;
  if(!passengerCabinReady())return;
  var audio=createBusSpatialAudio('sounds/passengers/'+file,kind),r=busSpatialAudio.records.get(audio);
  r.passenger=a;setBusAudioLevel(audio,.32);
  var v={audio:audio,actor:a,deadline:Date.now()+2500};s.voices.add(v);
  ['ended','error'].forEach(function(event){audio.addEventListener(event,function(){stopPassengerCabinVoice(v);});});
  audio.play().catch(function(){stopPassengerCabinVoice(v);});
}
function tickPassengerCabinAudio() {
  var s=passengerCabinAudio,now=Date.now(),ready=passengerCabinReady();
  s.voices.forEach(function(v){if(!ready||!s.actors.has(v.actor.id)||now>v.deadline)stopPassengerCabinVoice(v);});
  tickPassengerAmbience(ready);
  if(!ready){s.actors.forEach(function(a){a.walked=0;});if(now-s.stamp>=750)resetPassengerCabinAudio();return;}
  if(s.voices.size<3&&now>=s.nextStep){
    var nearby=Array.from(s.actors.values()).map(function(a){return {a:a,m:passengerCabinMix('passengerStep',a,busSpatialAudio.telemetry)};})
      .filter(function(v){return v.a.walked>=.43&&v.m.gain>.015;}).sort(function(a,b){return b.m.gain-a.m.gain;});
    if(nearby.length){var walker=nearby[0].a;walker.walked=0;s.nextStep=now+100;
      s.step=(s.step+1+Math.floor(Math.random()*5))%6;
      playPassengerCabinVoice(walker,'passengerStep','step-lino-'+(s.step+1)+'.wav');}
  }
  if(!s.actors.size&&!s.voices.size&&!s.ambience&&s.onboard<=15&&s.timer){clearInterval(s.timer);s.timer=null;}
}
window.addEventListener('pagehide',resetPassengerCabinAudio);
