'use strict';
const $=id=>document.getElementById(id);
const text=$('text'),audio=$('audio'),status=$('status');
let active=null, audioURL=null, unlockingURL=null;
const extra1252=new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
function validate(value){
  if(!value.trim())throw Error('Saisis un texte à lire.');
  if(value.length>5000)throw Error('Le texte est limité à 5 000 caractères.');
  for(const c of value){const n=c.codePointAt(0);if(c==='\\'||(n<32&&!['\n','\r','\t'].includes(c)))throw Error('Ce texte contient une commande ou un caractère de contrôle non accepté.');if(n>127&&!(n>=160&&n<=255)&&!extra1252.has(c))throw Error('Cette ancienne voix accepte le français, mais pas les emojis ni certains caractères.');}
}
function update(){ $('generate').disabled=!!active;$('cancel').hidden=!active; }
function stop(){if(active){clearTimeout(active.timeout);active.frame.remove();active=null;}update();}
function fail(message){stop();audio.pause();status.textContent=message;if(audioURL){audio.src=audioURL;$('result').hidden=false;}}
function unlock(){
  const raw=new ArrayBuffer(204),v=new DataView(raw),b=new Uint8Array(raw);
  for(const [p,s] of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']])for(let i=0;i<s.length;i++)b[p+i]=s.charCodeAt(i);
  v.setUint32(4,196,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,160,true);
  if(unlockingURL)URL.revokeObjectURL(unlockingURL);
  const url=unlockingURL=URL.createObjectURL(new Blob([raw],{type:'audio/wav'}));audio.src=url;
  audio.play().catch(()=>{}).finally(()=>{URL.revokeObjectURL(url);if(unlockingURL===url)unlockingURL=null;});
}
function generate(){
  if(active)return;
  try{validate(text.value);if(location.protocol==='file:')throw Error('Publie ce dossier sur ton hébergement web puis ouvre index.html via son adresse HTTPS. Le navigateur ne peut pas charger ce moteur depuis une adresse file://.');if(typeof WebAssembly!=='object')throw Error('Ce navigateur ne prend pas en charge WebAssembly.');}catch(e){status.textContent=e.message;return;}
  audio.pause();$('result').hidden=true;unlock();
  const id=crypto.randomUUID(),frame=document.createElement('iframe');frame.hidden=true;frame.title='Moteur vocal Claire';
  active={id,frame,timeout:setTimeout(()=>fail('La génération a dépassé cinq minutes. Essaie un texte plus court.'),300000)};
  const input=text.value;
  frame.addEventListener('load',()=>{if(active?.id===id)frame.contentWindow.postMessage({kind:'start',id,text:input},location.origin);},{once:true});
  frame.src='moteur.html';document.body.appendChild(frame);update();status.textContent='Chargement du moteur dans le navigateur…';
}
window.addEventListener('message',async event=>{
  const job=active, data=event.data;
  if(!job||event.source!==job.frame.contentWindow||event.origin!==location.origin||data?.id!==job.id)return;
  if(data.kind==='progress'){status.textContent=data.message;return;}
  if(data.kind==='error'){fail(data.message);return;}
  if(data.kind!=='audio')return;
  try{
    const raw=data.audio;
    if(!(raw instanceof ArrayBuffer)||raw.byteLength<46||raw.byteLength>32*1024*1024)throw Error('Le moteur a produit un fichier audio invalide.');
    const bytes=new Uint8Array(raw),v=new DataView(raw),ascii=(p,n)=>String.fromCharCode(...bytes.slice(p,p+n));
    if(ascii(0,4)!=='RIFF'||ascii(8,4)!=='WAVE'||ascii(12,4)!=='fmt '||ascii(36,4)!=='data'||v.getUint32(40,true)+44!==raw.byteLength||v.getUint32(24,true)!==22050||v.getUint16(22,true)!==1||v.getUint16(34,true)!==16)throw Error('Le moteur a produit un WAV incorrect.');
    stop();if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(new Blob([raw],{type:'audio/wav'}));
    audio.src=audioURL;audio.playbackRate=1;$('download').href=audioURL;$('result').hidden=false;
    status.textContent='Son généré.';
    try{await audio.play();if(audio.src===audioURL)status.textContent='Lecture du son généré.';}catch{status.textContent='Son prêt. Clique sur Lecture si ton navigateur bloque le démarrage automatique.';}
  }catch(e){fail(e.message);}
});
$('generate').addEventListener('click',generate);
$('cancel').addEventListener('click',()=>fail('Génération annulée.'));
text.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();generate();}});
window.addEventListener('pagehide',()=>{stop();if(audioURL)URL.revokeObjectURL(audioURL);if(unlockingURL)URL.revokeObjectURL(unlockingURL);});
