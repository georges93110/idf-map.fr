'use strict';
// The original x86 engine runs ONLY inside this WebAssembly instance.
var Module;
let session=null, request=null, failed=false, ready=false, poll=null, lastLogs=[];
const resultPath='/root/files/';
function notify(kind,details={},transfer=[]){if(session)parent.postMessage({kind,session,id:request?.id,...details},location.origin,transfer);}
function failure(message){if(failed)return;failed=true;clearInterval(poll);notify('error',{message});}
function output(...args){const line=args.join(' ');lastLogs.push(line);if(lastLogs.length>25)lastLogs.shift();}
window.addEventListener('error',e=>failure('Erreur du moteur web : '+e.message));
window.addEventListener('unhandledrejection',e=>failure('Erreur du moteur web : '+String(e.reason?.message||e.reason)));
function createFS(type,options){return new Promise((resolve,reject)=>type.Create(options,(err,fs)=>err?reject(err):resolve(fs)));}
const downloaded={'wine.zip':0,'claire.zip':0};
const downloadSizes={'wine.zip':11467345,'claire.zip':18927266};
function downloadProgress(){
  const total=Object.values(downloadSizes).reduce((a,b)=>a+b,0),bytes=Object.values(downloaded).reduce((a,b)=>a+b,0),percent=Math.min(100,Math.floor(bytes*100/total));
  notify('progress',{message:'Chargement du moteur…',percent});
}
async function download(name){
  const r=await fetch('moteur/'+name+(name==='claire.zip'?'?v=2':''),{credentials:'same-origin'});
  if(!r.ok)throw Error('Fichier absent ou inaccessible : moteur/'+name);
  const length=Number(r.headers?.get('content-length'));
  if(length>0&&!r.headers?.get('content-encoding'))downloadSizes[name]=length;
  if(!r.body?.getReader){const data=new Uint8Array(await r.arrayBuffer());downloaded[name]=data.length;downloadProgress();return data;}
  const reader=r.body.getReader(),chunks=[];let size=0,lastPercent=-1;
  while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;downloaded[name]=size;
    const percent=Math.floor(size*100/downloadSizes[name]);if(percent!==lastPercent){lastPercent=percent;downloadProgress();}}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  downloaded[name]=downloadSizes[name]=size;downloadProgress();return data;
}
async function prepare(){
  notify('progress',{message:'Chargement du moteur…',percent:0});
  const B=BrowserFS.BFSRequire('buffer').Buffer;
  const [wineData,claireData]=await Promise.all([download('wine.zip'),download('claire.zip')]);
  const [wine,claire]=await Promise.all([createFS(BrowserFS.FileSystem.ZipFS,{zipData:B.from(wineData)}),createFS(BrowserFS.FileSystem.ZipFS,{zipData:B.from(claireData)})]);
  // Expand the small, already-trimmed bundles once into Emscripten's native
  // in-memory filesystem. Synthesis avoids the BrowserFS/OverlayFS bridge.
  function populate(zip,dest){
    BrowserFS.initialize(zip);const source=BrowserFS.BFSRequire('fs');FS.mkdirTree(dest);
    function walk(dir){for(const name of source.readdirSync(dir)){
      const path=(dir==='/'?'':dir)+'/'+name,target=dest+path;
      if(source.statSync(path).isDirectory()){FS.mkdirTree(target);walk(path);}
      else FS.writeFile(target,source.readFileSync(path));
    }}
    walk('/');
  }
  populate(wine,'/root/base');populate(claire,'/root/files');
  BrowserFS.initialize(new BrowserFS.FileSystem.InMemory());
  // Create the inbox before Wine starts: the emulator caches missing paths.
  FS.writeFile(resultPath+'text.txt','');FS.writeFile(resultPath+'request.id','');
  notify('progress',{message:'Initialisation de la voix…',percent:null});
  poll=setInterval(checkResult,75);
  Module.removeRunDependency('claire-files');
}
function submit(){
  if(!ready||!request||request.sent||failed)return;
  // Clear the previous result before polling the number of bytes produced.
  FS.writeFile(resultPath+'audio.wav',new Uint8Array());
  FS.writeFile(resultPath+'text.txt',new TextEncoder().encode(request.text));
  FS.writeFile(resultPath+'request.id',request.id);
  request.sent=true;request.percent=0;
  // ELAN provides PCM blocks but no exact total. Estimate duration from text
  // length, and advance only when audio bytes have actually been produced.
  request.expectedBytes=Math.max(22050,request.text.trim().length*4800);
  notify('progress',{message:'Génération de la voix…',percent:0,estimated:true});
}
function checkResult(){
  if(failed)return;
  // This headless renderer does not need the emulator's display frame pacing.
  const interval=ready&&!request?100:1;
  if(typeof Browser!=='undefined'&&Browser.mainLoop?.func&&typeof _emscripten_set_main_loop_timing==='function'&&Browser.mainLoop.timingValue!==interval)_emscripten_set_main_loop_timing(0,interval);
  if(!ready){
    try{const err=FS.readFile(resultPath+'boot-error.txt',{encoding:'utf8'});if(err){failure(err);return;}}catch{}
    try{if(FS.readFile(resultPath+'engine.ready',{encoding:'utf8'})==='ready'){ready=true;notify('ready');submit();}}catch{}
    return;
  }
  if(!request?.sent)return;
  try{
    const bytes=Math.max(0,FS.stat(resultPath+'audio.wav').size-44);
    const percent=Math.min(95,Math.floor(bytes*100/request.expectedBytes));
    if(percent>request.percent){request.percent=percent;notify('progress',{message:'Génération de la voix…',percent,estimated:true});}
  }catch{}
  try{
    if(FS.readFile(resultPath+'result.id',{encoding:'utf8'})!==request.id)return;
    try{const err=FS.readFile(resultPath+'error.txt',{encoding:'utf8'});if(err){failure(err);return;}}catch{}
    const data=FS.readFile(resultPath+'audio.wav');
    if(data.length>32*1024*1024){failure('Audio trop volumineux : raccourcis le texte.');return;}
    if(data.length<=44)return;
    const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
    const bytes=v.getUint32(40,true)+44;
    if(bytes<46||bytes>data.length){failure('Le moteur a produit un fichier audio incomplet.');return;}
    const id=request.id;request=null;
    // Old Wine can leave the previous file's tail after truncating. result.id
    // confirms fclose completed; the fresh WAV header gives the exact length.
    const audio=data.slice(0,bytes).buffer;notify('audio',{id,audio},[audio]);
  }catch{}
}
function launch(data){
  if(!data||failed)return;
  if(data.kind==='generate'&&data.session===session&&!request&&typeof data.id==='string'&&typeof data.text==='string'&&data.text.trim()&&data.text.length<=5000){request={id:data.id,text:data.text,sent:false};submit();return;}
  if(session||data.kind!=='boot'||typeof data.session!=='string')return;
  session=data.session;
  Module={
    locateFile:name=>'moteur/'+name,
    arguments:['-root','/root/base','-mount_drive','/root/files','d','-nozip','-nosound','-w','/home/username/.wine/dosdevices/d:/','/bin/wine','D:\\claire-render.exe','--serve'],
    canvas:document.getElementById('canvas'),print:output,printErr:output,
    preRun:[()=>{Module.addRunDependency('claire-files');prepare().catch(e=>failure(e.message));}],
    onAbort:()=>failure('Le moteur WebAssembly s’est arrêté. Réessaie avec un texte plus court.'),
  };
  const script=document.createElement('script');script.src='moteur/boxedwine.js';script.onerror=()=>failure('Le fichier moteur/boxedwine.js est introuvable.');document.body.appendChild(script);
}
window.addEventListener('message',event=>{if(event.source===parent&&event.origin===location.origin)launch(event.data);});
