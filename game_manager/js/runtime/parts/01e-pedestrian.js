// Local native walking state and room-scoped Convoy avatars. No bus service ownership.
var pedestrianAudio={local:null,at:0,peers:new Map(),voices:new Set(),step:0,warmContext:null};
function stopPedestrianVoice(v){if(!pedestrianAudio.voices.delete(v))return;try{v.source.stop();}catch(_){}[v.source,v.gain,v.pan].forEach(function(n){if(n)n.disconnect();});}
function warmPedestrianAudio(){
 var s=pedestrianAudio,Context=window.AudioContext||window.webkitAudioContext,c=busSpatialAudio.context;
 if(!c&&Context)c=busSpatialAudio.context=new Context();if(!c||s.warmContext===c)return;
 s.warmContext=c;
 var files=Array.from({length:6},function(_,i){return 'sounds/passengers/step-lino-'+(i+1)+'.wav';});
 files.push('sounds/pedestrian/vehicle-door-open.wav','sounds/pedestrian/vehicle-door-close.wav');
 files.forEach(function(path){fetchBusDecodedClip(new URL(path,window.location.href).href,c).catch(function(){s.warmContext=null;});});
}
function pedestrianVehicleDoor(open){
 var s=pedestrianAudio,c=busSpatialAudio.context;if(!c||!s.local||s.local.bus||s.local.paused)return;
 var stamp=Date.now();resumeBusAudioContext();
 fetchBusDecodedClip(new URL('sounds/pedestrian/vehicle-door-'+(open?'open':'close')+'.wav',window.location.href).href,c).then(function(buffer){
  if(Date.now()-stamp>1200||!s.local||s.local.bus||s.local.paused||!nativeGameAudio.available)return;
  var v={source:c.createBufferSource(),gain:c.createGain(),pan:null};v.source.buffer=buffer;v.gain.gain.value=.65*getGlobalAudioVolumeFactor();
  v.source.connect(v.gain);v.gain.connect(c.destination);s.voices.add(v);v.source.onended=function(){stopPedestrianVoice(v);};v.source.start();
 }).catch(function(){});
}
function pedestrianStep(pose,own,crouch,owner,instance){
 var s=pedestrianAudio,l=s.local,now=Date.now(),audio=busSpatialAudio;
 if(!l||l.paused||!l.listener||now-s.at>750||s.voices.size>=8||!nativeGameAudio.available||now-nativeGameAudio.stamp>2000)return;
 var dx=pose.x-l.cameraX,dy=pose.y-l.cameraY,dz=pose.z-l.cameraZ,d=Math.hypot(dx,dy,dz);
 if(!Number.isFinite(d)||d>=18)return;
 var gain=(own?.55:.5/(1+d*d/16))*(crouch?.45:1)*getGlobalAudioVolumeFactor();if(gain<.005)return;
 var Context=window.AudioContext||window.webkitAudioContext,c=audio.context;if(!c&&Context)c=audio.context=new Context();if(!c)return;
 resumeBusAudioContext();var stamp=now;
 fetchBusDecodedClip(new URL('sounds/passengers/step-lino-'+((s.step++%6)+1)+'.wav',window.location.href).href,c).then(function(buffer){
  if(Date.now()-stamp>400||!s.local||s.local.paused||Date.now()-s.at>750||(!own&&s.peers.get(owner)?.instance!==instance))return;
  var v={owner:owner,instance:instance,source:c.createBufferSource(),gain:c.createGain(),pan:c.createStereoPanner?c.createStereoPanner():null};v.source.buffer=buffer;v.gain.gain.value=gain;
  v.source.connect(v.gain);if(v.pan){v.pan.pan.value=own?0:Math.max(-.95,Math.min(.95,(dx*l.rightX+dy*l.rightY+dz*l.rightZ)/Math.max(1,d)));v.gain.connect(v.pan);v.pan.connect(c.destination);}else v.gain.connect(c.destination);
  s.voices.add(v);v.source.onended=function(){stopPedestrianVoice(v);};v.source.start();
 }).catch(function(){});
}
function receivePedestrian(m){
 var s=pedestrianAudio,now=Date.now();
 if(m.type==='nativePedestrian'){
  var old=s.local,previousAt=s.at;s.local=m;s.at=now;
  if(m.listener&&!m.paused)warmPedestrianAudio();
  if(old&&now-previousAt<750&&old.active!==m.active&&m.bus===false)pedestrianVehicleDoor(m.active===true);
  document.documentElement.classList.toggle('idf-pedestrian',m.active===true);
  if(m.paused)Array.from(s.voices).forEach(stopPedestrianVoice);
  if(old&&old.active&&m.active&&m.steps>old.steps&&m.steps-old.steps<4&&[1,2,3].includes(m.motion))pedestrianStep(m,true,m.motion===3);
  return;
 }
 if(m.kind==='convoy.clear'){s.peers.clear();Array.from(s.voices).forEach(stopPedestrianVoice);return;}
 if(!m.player)return;
 if(m.kind==='convoy.remove'||!m.pedestrian){s.peers.delete(m.player);Array.from(s.voices).filter(function(v){return v.owner===m.player;}).forEach(stopPedestrianVoice);return;}
 var p=m.pedestrian,old=s.peers.get(m.player);s.peers.set(m.player,{instance:m.instance,steps:p.steps,at:now});
 if(old&&old.instance===m.instance&&now-old.at<750&&!p.paused&&p.steps>old.steps&&p.steps-old.steps<4&&[1,2,3].includes(p.motion))pedestrianStep(p.pose,false,p.motion===3,m.player,m.instance);
}
(function(){var style=document.createElement('style');style.textContent='.idf-pedestrian #widgetStage,.idf-pedestrian #overlayWorkspace{visibility:hidden!important;pointer-events:none!important}';document.head.appendChild(style);})();
setInterval(function(){var s=pedestrianAudio,now=Date.now();if(now-s.at>1000){s.local=null;document.documentElement.classList.remove('idf-pedestrian');Array.from(s.voices).forEach(stopPedestrianVoice);}s.peers.forEach(function(p,k){if(now-p.at>6000)s.peers.delete(k);});},500);
window.addEventListener('pagehide',function(){Array.from(pedestrianAudio.voices).forEach(stopPedestrianVoice);pedestrianAudio.peers.clear();});
