/* LCD glyphs and physical key coordinates adapted from the supplied Agora demo.
   Native face/material stay in ETS2. Only lit LCD characters have alpha. */
(function(root){
'use strict';
const SCOPE='idf_game_widget_bridge_v1';
const text=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const fit=(v,n)=>text(v).replace(/['’ʼ]/g,' ').slice(0,n).padEnd(n,' ');
const initials=v=>text(v).split(/[^A-Z0-9]+/).filter(Boolean).map(w=>w[0]).join('').slice(0,3);
class AgoraSaeiv {
 constructor(send,now=Date.now){this.send=send;this.now=now;this.state={};this.catalogue=[];this.page='home';this.line='';this.service='';this.vehicle='';this.matricule='';this.expectedMatricule='';this.resume='home';this.pending=null;this.notice=['',''];this.noticeAt=0;this.clock='';this.power=true;this.at=0;this.audio=0;}
 post(type,extra={}){this.send({scope:SCOPE,channel:'saeiv',clientId:'native_agora',payload:{sourceId:'game',type,...extra}});}
 request(){this.post('saeiv:request_state');this.post('saeiv:catalog_request');}
 message(lines,resume='home'){this.resume=resume;this.notice=lines;this.noticeAt=this.now()+3500;this.page='notice';}
 command(action,extra={}){if(this.pending)return;this.pending={action,at:this.now()};this.page='waiting';this.post('saeiv:'+action,extra);}
 receive(m){
  if(m?.scope!==SCOPE||m.channel!=='saeiv'||m.payload?.sourceId!=='game')return;
  const p=m.payload;
  if(p.type==='saeiv:catalog'){this.catalogue=Array.isArray(p.payload?.routes)?p.payload.routes:[];return;}
  if(p.type==='saeiv:state'){
   const old=this.state;this.state=p.payload||{};this.at=this.now();
   if(old.routeSelected&&!this.state.routeSelected&&this.page!=='waiting'){this.line='';this.service='';this.message(['SERVICE TERMINE','PRISE SERVICE']);}
   if(this.state.routeCompleted&&!old.routeCompleted)this.message(['SERVICE TERMINE','TOUS DESCENDUS']);
   return;
  }
  if(p.type==='saeiv:action_result'&&this.pending?.action===p.action){
   this.pending=null;
   if(!p.ok){if(p.action==='start_route'&&this.state.routeSelected&&!this.state.routeCanStart){this.message(['SERVICE ACCEPTE','REJOINDRE LE DEPART']);this.request();return;}this.message([p.action==='start_route'?'DEPART NON AUTORISE':p.action==='clear_route'?'FIN NON VALIDEE':'SERVICE INDISPONIBLE',p.action==='start_route'?'REJOINDRE LE DEPART':'REESSAYER']);this.request();return;}
   if(p.action==='select_route'){if(p.canStart===true&&!p.started&&!p.alreadyStarted){this.command('start_route');return;}this.message(['SERVICE ACCEPTE',p.started||p.alreadyStarted?'VALID : SUIVI':'REJOINDRE LE DEPART']);this.post('saeiv:request_state');return;}
   if(p.action==='clear_route'){this.line='';this.service='';}
   this.message([p.action==='clear_route'?'SERVICE TERMINE':'SERVICE ACCEPTE','VALID : SUIVI']);this.post('saeiv:request_state');
  }
 }
 routes(){const l=this.line;const exact=this.catalogue.filter(r=>r.lineUid===l||r.lineUidRaw===l);return exact.length?exact:this.catalogue.filter(r=>text(r.lineNumber)===text(l));}
 choose(delta){
  const list=this.page==='line'?[...new Set(this.catalogue.map(r=>String(r.lineUidRaw||r.lineUid)))]:[...new Set(this.routes().map(r=>String(r.routeUid)))];
  if(!list.length)return;const field=this.page==='line'?'line':'service';const i=list.indexOf(this[field]);this[field]=list[(i+delta+list.length)%list.length];
 }
 matriculeDefault(){
  const keys=['steamid','steamId','steamID','steam_id','idf_steamid','idf_steam_id'];
  for(const source of [this.state,this.state.player,this.state.identity,this.state.telemetry,this.state.raw]){
   for(const key of keys){const value=String(source?.[key]??'').replace(/[^0-9]/g,'').slice(0,32);if(value)return value;}
  }
  return String(Math.floor(Math.random()*900000)+100000);
 }
 validated(step){this.post('saeiv:action',{action:'prise-service-complete-'+step+'-validate',lineUid:this.line,...(step!=='line'?{vehicleNumber:this.vehicle}:{}),...(step==='route'||step==='matricule'?{routeUid:this.service}:{}),...(step==='matricule'?{matricule:this.matricule,expectedMatricule:this.expectedMatricule}:{})});}
 canPress(k){
  if(!this.power||this.pending)return false;
  if(/^ics[1-4]$/.test(k))return !!this.state.icsAnnouncementLabels?.[Number(k.slice(-1))-1];
  if(k==='ps'||k==='cancel')return true;
  const page=this.page==='notice'?this.resume:this.page;
  if(this.page==='notice'&&k==='valid')return true;
  if(['line','vehicle','service','matricule'].includes(page)){
   if(/^\d$/.test(k))return this[page].length<(page==='vehicle'?2:page==='matricule'?32:20);
   if(k==='erase')return !!this[page];
   if(k==='up'||k==='down')return page==='line'?this.catalogue.length>0:page==='service'&&this.routes().length>0;
   return k==='valid'&&!!this[page];
  }
  if(page==='confirm'||page==='end')return k==='valid';
  if(k==='up'||k==='down'||k==='valid')return page!=='audio'||(this.state.globalAudioLabels?.length||0)>0;
  return ['mission','0','1','3','test'].includes(k);
 }
 press(k){
  if(!this.canPress(k))return;
  if(/^ics[1-4]$/.test(k)){this.post('saeiv:action',{action:'saeiv-agora-ics-'+k.slice(-1),selectedLineUid:this.state.selectedLineUid||'',selectedRouteUid:this.state.selectedRouteUid||''});return;}
  if(k==='ps'){this.line='';this.service='';this.vehicle='';this.matricule='';this.expectedMatricule='';this.page='line';this.request();return;}
  if(this.page==='notice'){this.page=this.resume;if(k==='valid'||k==='cancel')return;}
  if(['line','vehicle','service','matricule'].includes(this.page)){
   const field=this.page;
   if(/^\d$/.test(k)){if(this[field].length<(field==='vehicle'?2:field==='matricule'?32:20))this[field]+=k;return;}
   if(k==='erase'){this[field]=this[field].slice(0,-1);return;}
   if(k==='up'||k==='down'){if(field==='line'||field==='service')this.choose(k==='up'?1:-1);return;}
   if(k==='cancel'){this.page=({line:'home',vehicle:'line',service:'vehicle',matricule:'service'})[field];return;}
   if(k==='valid'){
    if(!this[field])return;
    if(field==='line'){
     if(!this.routes().length){this.message(['LIGNE INCONNUE','VERIFIER LA SAISIE'],'line');return;}
     this.validated('line');this.page='vehicle';this.vehicle=String(Math.floor(Math.random()*30)+1);return;
    }
    if(field==='vehicle'){
     if(!/^\d+$/.test(this.vehicle)||Number(this.vehicle)<1||Number(this.vehicle)>30){this.message(['VOITURE INCORRECTE','SAISIR DE 1 A 30'],'vehicle');return;}
     this.validated('vehicle');this.page='service';this.service='';return;
    }
    if(field==='service'){
     const matches=this.routes().filter(r=>String(r.routeUid)===this.service);
     if(matches.length!==1){this.message([matches.length?'LIGNE AMBIGUE':'SERVICE INCONNU','VERIFIER LA SAISIE'],'service');return;}
     this.validated('route');this.expectedMatricule=this.matriculeDefault();this.matricule=this.expectedMatricule;this.page='matricule';return;
    }
    if(this.matricule!==this.expectedMatricule){this.message(['MATRICULE INCORRECT','VERIFIER LA SAISIE'],'matricule');return;}
    this.validated('matricule');this.page='confirm';
   }
   return;
  }
  if(this.page==='confirm'){
   if(k==='cancel'){this.page='matricule';return;}
   if(k==='valid'){
    const matches=this.routes().filter(r=>String(r.routeUid)===this.service);
    if(matches.length!==1){this.message(['SERVICE INDISPONIBLE','VERIFIER LA SAISIE'],'service');return;}
    this.command('select_route',{lineUid:matches[0].lineUid,routeUid:matches[0].routeUid});
   }
   return;
  }
  if(this.page==='end'){
   if(k==='valid')this.command('clear_route');else if(k==='cancel')this.page='home';return;
  }
  if(k==='cancel'){this.page=this.page==='home'&&this.state.routeSelected?'end':'home';return;}
  if(k==='mission'){this.page='destination';return;} // Girouette always follows host route; no manual override.
  if(k==='0'){this.page='stop';return;}
  if(k==='1'){this.page='schedule';return;}
  if(k==='3'){this.page='audio';this.audio=0;this.post('saeiv:request_state');return;}
  if(k==='test'){this.message(['####################','####################']);return;}
  if(k==='up'||k==='down'){
   if(this.page==='audio'){const n=this.state.globalAudioLabels?.length||0;if(n)this.audio=(this.audio+(k==='up'?1:-1)+n)%n;}
   else{const pages=['home','stop','schedule','destination'];this.page=pages[(pages.indexOf(this.page)+(k==='up'?1:3))%4];}
   return;
  }
  if(k==='valid'){
   if(this.page==='audio'){
    if(!this.state.globalAudioLabels?.[this.audio])return;
    this.post('saeiv:action',{action:'saeiv-native-diffusion-slot-'+(this.audio+1),diffusionSlot:this.audio+1,selectedLineUid:this.state.selectedLineUid||'',selectedRouteUid:this.state.selectedRouteUid||'',globalAudioFolderPath:this.state.globalAudioFolderPath||''});return;
   }
   if(this.page==='home'&&this.state.routeSelected&&!this.state.routeStarted&&!this.state.routeCompleted){if(this.state.routeCanStart)this.command('start_route');else this.message(['SERVICE ACCEPTE','REJOINDRE LE DEPART']);return;}
   this.page='home';
  }
 }
 displayLines(){return this.lines().map(s=>fit(s,20));}
 lines(){
  if(!this.power)return ['',''];
  if(this.pending&&this.now()-this.pending.at>7000){this.pending=null;this.message(['LIAISON INTERROMPUE','REESSAYER']);}
  if(this.page==='notice'&&this.now()>=this.noticeAt)this.page=this.resume;
  if(this.page==='notice')return this.notice;
  if(this.page==='waiting')return ['TRANSMISSION SAEIV','PATIENTEZ...'];
  if(['line','vehicle','service','matricule'].includes(this.page))return [({line:'LIGNE',vehicle:'VOITURE',service:'SERVICE',matricule:'MATRICULE'})[this.page],this[this.page].slice(-19)+(this.now()%1000<500?'_':' ')];
  if(this.page==='confirm')return ['VALIDER LE SERVICE ?',fit(this.line,4)+' '+fit(this.service,3)+' VOITURE '+this.vehicle];
  if(this.page==='end')return ['TERMINER SERVICE ?','VALID:OUI ANNUL:NON'];
  const s=this.state;if(!this.at||this.now()-this.at>6500)return ['LIAISON SAEIV','EN ATTENTE'];
  if(this.page==='audio')return ['ANNONCES '+(this.audio+1),s.globalAudioLabels?.[this.audio]||'AUCUNE ANNONCE'];
  if(!s.routeSelected)return ['BONJOUR, APPUYER','SUR PRISE SERVICE'];
  if(s.routeCompleted)return ['SERVICE TERMINE','ANNUL:FIN SERVICE'];
  if(this.page==='destination')return ['DESTINATION',s.terminusStopName||s.audioStopNames?.at(-1)||s.routeName||''];
  if(this.page==='stop')return [s.vehicleAtStop?'A L ARRET':'PROCHAIN ARRET',s.stopName||s.audioStopNames?.[s.audioCurrentIndex]||''];
  if(this.page==='schedule'){
   const delay=Number(s.routeLastStopDelayMinutes),hasDelay=s.routeLastStopDelayMinutes!=null&&Number.isFinite(delay);
   return ['HORAIRE '+(s.refTime||'--:--'),hasDelay?'ECART '+(delay>0?'+':'')+Math.round(delay)+' MIN':s.routeStarted?'SERVICE EN COURS':'VALID: DEPART'];
  }
  const time=this.clock||String(s.refTime||'--:--');
  return [fit(s.lineNumber||s.selectedLineUid,4)+' '+fit(s.selectedRouteUid,3)+' '+fit(time.replace(':',''),4)+' --- '+fit(s.zone||'',2),
   fit(initials(s.terminusStopName||s.audioStopNames?.at(-1)),3)+' '+(s.vehicleAtStop?'A':' ')+fit(initials(s.stopName),3)+' '+fit(String(s.refTime||'----').replace(':',''),4)+' --- '+fit(Number(s.audioCurrentIndex||0)+1,2)];
 }
}
root.AgoraSaeiv=AgoraSaeiv;
if(typeof module!=='undefined')module.exports={AgoraSaeiv};
if(typeof document==='undefined')return;
const KEYS=[
 ...[1,2,3,4].map((n)=>['ics'+n,'Annonce '+n,20,(n-1)*120+10,160,100]),
 ['ps','Prise service',248,556,141,139],['mission','Mission',403,556,140,139],
 ['0','0 · Localisation',556,556,139,139],['1','1 · SAE',710,557,140,139],['2','2 · AVTT',862,558,139,139],['3','3 · Sono',1017,559,137,139],['4','4 · Zone',1166,560,137,138],
 ['up','Flèche haut',1318,561,137,136],['pcl','Appel PCL',1469,561,176,137],['test','Test',1657,560,143,137],
 ['cancel','Annul',248,774,141,137],['5','5 · Tarif',556,774,139,137],['6','6 · SAM',710,774,140,137],['7','7',862,775,139,136],['8','8 · Radio',1017,775,137,136],['9','9 · Secteur',1166,775,138,136],
 ['down','Flèche bas',1318,775,137,137],['pg','Appel PG',1469,775,176,137],['valid','Valid',1657,775,143,137]
];
const GLYPHS={
 ' ':[0,0,0,0,0,0,0],'A':[14,17,17,31,17,17,17],'B':[30,17,17,30,17,17,30],'C':[14,17,16,16,16,17,14],'D':[30,17,17,17,17,17,30],'E':[31,16,16,30,16,16,31],'F':[31,16,16,30,16,16,16],'G':[14,17,16,23,17,17,15],'H':[17,17,17,31,17,17,17],'I':[14,4,4,4,4,4,14],'J':[7,2,2,2,18,18,12],'K':[17,18,20,24,20,18,17],'L':[16,16,16,16,16,16,31],'M':[17,27,21,21,17,17,17],'N':[17,25,21,19,17,17,17],'O':[14,17,17,17,17,17,14],'P':[30,17,17,30,16,16,16],'Q':[14,17,17,17,21,18,13],'R':[30,17,17,30,20,18,17],'S':[15,16,16,14,1,1,30],'T':[31,4,4,4,4,4,4],'U':[17,17,17,17,17,17,14],'V':[17,17,17,17,17,10,4],'W':[17,17,17,21,21,21,10],'X':[17,17,10,4,10,17,17],'Y':[17,17,10,4,4,4,4],'Z':[31,1,2,4,8,16,31],
 '0':[14,17,19,21,25,17,14],'1':[4,12,4,4,4,4,14],'2':[14,17,1,2,4,8,31],'3':[30,1,1,14,1,1,30],'4':[2,6,10,18,31,2,2],'5':[31,16,16,30,1,1,30],'6':[14,16,16,30,17,17,14],'7':[31,1,2,4,8,8,8],'8':[14,17,17,14,17,17,14],'9':[14,17,17,15,1,1,14],
 ':':[0,4,4,0,4,4,0],'.':[0,0,0,0,0,12,12],',':[0,0,0,0,0,4,8],'-':[0,0,0,31,0,0,0],'_':[0,0,0,0,0,0,31],'!':[4,4,4,4,4,0,4],'?':[14,17,1,2,4,0,4],"'":[4,4,8,0,0,0,0],'/':[1,2,2,4,8,8,16],'<':[2,4,8,16,8,4,2],'>':[8,4,2,1,2,4,8],'*':[0,21,14,31,14,21,0],'#':[31,31,31,31,31,31,31],'+':[0,4,4,31,4,4,0],'a':[0,0,14,1,15,17,15],'m':[0,0,26,21,21,21,21]
};
let last='',connection=null;const params=new URLSearchParams(location.search);
const sourceId=params.get('source')||'game';
const controller=new AgoraSaeiv(m=>{
 m.payload.sourceId=sourceId;
 if(parent!==window&&typeof parent.saeivNativePost==='function'){parent.saeivNativePost(m);return;}
 if(connection?.send)connection.send(m);
 if(parent!==window)parent.postMessage(m,location.origin);
});
const ctx=document.getElementById('lcd').getContext('2d');
function draw(){
 const lines=controller.displayLines();
 for(const button of document.querySelectorAll('.hit'))button.disabled=!controller.canPress(button.dataset.key);
 const key=lines.join('\n');if(key===last)return;last=key;
 ctx.clearRect(0,0,1280,220);ctx.fillStyle='rgb(8,12,2)';
 for(let row=0;row<2;row++)for(let col=0;col<20;col++){
  const bits=GLYPHS[lines[row][col]]||GLYPHS['?'];
  for(let y=0;y<7;y++)for(let x=0;x<5;x++)if(bits[y]&(1<<(4-x)))ctx.fillRect(col*64+x*11+2,row*108+y*13+9,9.2,11.2);
 }
 window.IDFAgoraNative.revision++;
}
window.IDFAgoraNative={ready:true,revision:0,receive(m){controller.receive(m);draw();},setPower(on,clock){controller.power=on;controller.clock=clock||'';draw();}};
window.AgoraICS={trigger(k){controller.press(k);draw();},getState:()=>({page:controller.page,line:controller.line,service:controller.service,vehicle:controller.vehicle,matricule:controller.matricule,lines:controller.lines(),state:controller.state})};
for(const [key,label,x,y,w,h] of KEYS){const b=document.createElement('button');b.className='hit';b.dataset.key=key;b.setAttribute('aria-label',label);b.style.cssText=`left:${x/20.48}%;top:${y/10.24}%;width:${w/20.48}%;height:${h/10.24}%`;b.addEventListener('click',()=>window.AgoraICS.trigger(key));document.getElementById('buttons').append(b);}
window.addEventListener('message',e=>{if(e.origin===location.origin)window.IDFAgoraNative.receive(e.data);});
window.addEventListener('keydown',e=>{let k=/^\d$/.test(e.key)?e.key:({Enter:'valid',Backspace:'erase',ArrowUp:'up',ArrowDown:'down'})[e.key];if(k){e.preventDefault();window.AgoraICS.trigger(k);}});
setInterval(draw,100);draw();
// The native parent supplies state and forwards clicks to the authoritative bus page.
if(parent!==window&&typeof parent.saeivNativePost==='function'){
 const initial=parent.saeivGetBridgeState?.();if(initial)controller.receive({scope:SCOPE,channel:'saeiv',payload:initial});
}else if(parent!==window){controller.request();}
})(typeof globalThis==='undefined'?window:globalThis);
