'use strict';
const $=id=>document.getElementById(id);
const text=$('text'),audio=$('audio'),status=$('status');
let active=null, engine=null, audioURL=null, unlockingURL=null, warmTimer=null;
let cacheBytes=0;
const cache=new Map(),MAX_CACHE_BYTES=12*1024*1024;
const defaultText="Ligne, 114, cet autobus a pour terminus, Le Raincy - Villemomble - Monfermeil RER.";
const extra1252=new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
function validate(value){
  if(!value.trim())throw Error('Saisis un texte à lire.');
  if(value.length>5000)throw Error('Le texte est limité à 5 000 caractères.');
  for(const c of value){const n=c.codePointAt(0);if(c==='\\'||(n<32&&!['\n','\r','\t'].includes(c)))throw Error('Ce texte contient une commande ou un caractère de contrôle non accepté.');if(n>127&&!(n>=160&&n<=255)&&!extra1252.has(c))throw Error('Cette ancienne voix accepte le français, mais pas les emojis ni certains caractères.');}
}
function update(){ $('generate').disabled=!!active;$('cancel').hidden=!active; }
function showProgress(message,percent=null,estimated=false){
  status.textContent=message;$('progress').hidden=false;
  if(Number.isFinite(percent)){
    const value=Math.max(0,Math.min(100,Math.floor(percent)));
    $('progressBar').value=value;$('progressText').textContent=value+' %'+(estimated?' (estimé)':'');
  }else{$('progressBar').removeAttribute('value');$('progressText').textContent='';}
}
function dropEngine(){if(engine){clearTimeout(engine.timeout);engine.frame.remove();engine=null;}}
function stop(reset=false){if(active){clearTimeout(active.timeout);active=null;}if(reset)dropEngine();update();}
function fail(message){stop(true);audio.pause();status.textContent=message;$('progress').hidden=true;if(audioURL){audio.src=audioURL;$('result').hidden=false;}}
function checkAudio(raw){
  if(!(raw instanceof ArrayBuffer)||raw.byteLength<46||raw.byteLength>32*1024*1024)throw Error('Le moteur a produit un fichier audio invalide.');
  const bytes=new Uint8Array(raw),v=new DataView(raw),ascii=(p,n)=>String.fromCharCode(...bytes.slice(p,p+n));
  if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WAVE'||ascii(12,4)!=='fmt '||ascii(36,4)!=='data'||v.getUint32(40,true)+44!==raw.byteLength||v.getUint32(24,true)!==22050||v.getUint16(22,true)!==1||v.getUint16(34,true)!==16)throw Error('Le moteur a produit un WAV incorrect.');
}
function remember(input,raw){
  if(raw.byteLength>MAX_CACHE_BYTES)return;
  if(cache.has(input)){cacheBytes-=cache.get(input).byteLength;cache.delete(input);}
  cache.set(input,raw);cacheBytes+=raw.byteLength;
  while(cacheBytes>MAX_CACHE_BYTES){const key=cache.keys().next().value;cacheBytes-=cache.get(key).byteLength;cache.delete(key);}
}
function dispatch(){
  if(!active||active.mode!=='engine'||active.sent||!engine?.loaded)return;
  active.sent=true;
  engine.frame.contentWindow.postMessage({kind:'generate',session:engine.id,id:active.id,text:active.text},location.origin);
  if(engine.ready)showProgress('Génération de la voix…',0,true);
  else{const p=engine.progress;showProgress(p?.message||'Préparation de la voix…',p?.percent??null);}
}
function ensureEngine(){
  if(engine)return;
  const id=crypto.randomUUID(),frame=document.createElement('iframe');frame.hidden=true;frame.title='Moteur vocal Claire';
  engine={id,frame,loaded:false,ready:false,progress:null,timeout:setTimeout(()=>{
    if(engine?.id!==id)return;
    if(active?.mode==='engine')fail('Le chargement du moteur a dépassé cinq minutes. Réessaie.');
    else{dropEngine();if(!active&&!audioURL){status.textContent='Le chargement du moteur a dépassé cinq minutes. Clique sur Générer pour réessayer.';$('progress').hidden=true;}}
  },300000)};
  frame.addEventListener('load',()=>{
    if(engine?.id!==id)return;
    engine.loaded=true;frame.contentWindow.postMessage({kind:'boot',session:id},location.origin);dispatch();
  },{once:true});
  if(!active&&!audioURL)showProgress('Chargement du moteur…');
  frame.src='moteur.html?v=3';document.body.appendChild(frame);
}
async function playResult(raw,id){
  if(active?.id!==id)return;
  try{
    checkAudio(raw);remember(active.text,raw);stop();
    if(audioURL)URL.revokeObjectURL(audioURL);
    const url=audioURL=URL.createObjectURL(new Blob([raw],{type:'audio/wav'}));
    audio.src=url;audio.playbackRate=1;$('download').href=url;$('result').hidden=false;
    showProgress('Son prêt.',100);
    try{await audio.play();if(audioURL===url&&!active)status.textContent='Lecture du son.';}
    catch{if(audioURL===url&&!active)status.textContent='Son prêt. Clique sur Lecture si ton navigateur bloque le démarrage automatique.';}
  }catch(e){if(active?.id===id)fail(e.message);}
}
function unlock(){
  const raw=new ArrayBuffer(204),v=new DataView(raw),b=new Uint8Array(raw);
  for(const [p,s] of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']])for(let i=0;i<s.length;i++)b[p+i]=s.charCodeAt(i);
  v.setUint32(4,196,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,160,true);
  if(unlockingURL)URL.revokeObjectURL(unlockingURL);
  const url=unlockingURL=URL.createObjectURL(new Blob([raw],{type:'audio/wav'}));audio.src=url;
  audio.play().catch(()=>{}).finally(()=>{URL.revokeObjectURL(url);if(unlockingURL===url)unlockingURL=null;});
}
async function generate(){
  if(active)return;
  try{validate(text.value);if(location.protocol==='file:')throw Error('Publie ce dossier sur ton hébergement web puis ouvre index.html via son adresse HTTPS. Le navigateur ne peut pas charger ce moteur depuis une adresse file://.');if(typeof WebAssembly!=='object')throw Error('Ce navigateur ne prend pas en charge WebAssembly.');}catch(e){status.textContent=e.message;return;}
  audio.pause();$('result').hidden=true;unlock();
  const input=text.value;
  const id=crypto.randomUUID();
  active={id,text:input,mode:'cache',sent:false,timeout:setTimeout(()=>fail('La génération a dépassé cinq minutes. Essaie un texte plus court.'),300000)};
  update();showProgress('Préparation du son…',0);
  if(cache.has(input)){const raw=cache.get(input);cache.delete(input);cache.set(input,raw);await playResult(raw,id);return;}
  if(input===defaultText){showProgress('Chargement de l’annonce…');const raw=await defaultAudio;if(active?.id!==id)return;if(raw){await playResult(raw,id);return;}}
  active.mode='engine';status.textContent=engine?.ready?'Génération de la voix…':'Préparation de la voix…';ensureEngine();dispatch();
}
window.addEventListener('message',async event=>{
  const data=event.data;
  if(!engine||event.source!==engine.frame.contentWindow||event.origin!==location.origin||data?.session!==engine.id)return;
  if(data.kind==='ready'){engine.ready=true;clearTimeout(engine.timeout);if(!active&&!audioURL)showProgress('Voix prête.',100);dispatch();return;}
  if(data.kind==='progress'){
    engine.progress=data;
    if(active?.mode==='engine'||(!active&&!audioURL))showProgress(data.message,data.percent,data.estimated===true);
    return;
  }
  if(data.kind==='error'){
    if(active?.mode==='engine')fail(data.message);
    else{dropEngine();if(!active&&!audioURL){status.textContent=data.message;$('progress').hidden=true;}}
    return;
  }
  if(data.kind==='audio'&&active?.id===data.id)await playResult(data.audio,data.id);
});
$('generate').addEventListener('click',generate);
$('cancel').addEventListener('click',()=>{clearTimeout(warmTimer);fail('Génération annulée.');});
text.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();generate();}});
const defaultAudio=location.protocol==='file:'?Promise.resolve(null):fetch('annonce-defaut.wav',{credentials:'same-origin'})
  .then(r=>{if(!r.ok)throw Error('Annonce absente');return r.arrayBuffer();}).then(raw=>{checkAudio(raw);remember(defaultText,raw);return raw;}).catch(()=>null);
function prewarm(){if(location.protocol!=='file:'&&typeof WebAssembly==='object')warmTimer=setTimeout(ensureEngine,200);}
prewarm();
window.addEventListener('pagehide',()=>{clearTimeout(warmTimer);stop(true);if(audioURL)URL.revokeObjectURL(audioURL);audioURL=null;if(unlockingURL)URL.revokeObjectURL(unlockingURL);});
window.addEventListener('pageshow',event=>{if(event.persisted){$('result').hidden=true;$('progress').hidden=true;status.textContent='Claire 22 kHz — Vitesse 90 % — Pitch 90 %';prewarm();}});
