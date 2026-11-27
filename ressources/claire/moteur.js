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
async function download(name){const r=await fetch('moteur/'+name+(name==='claire.zip'?'?v=2':''),{credentials:'same-origin'});if(!r.ok)throw Error('Fichier absent ou inaccessible : moteur/'+name);return new Uint8Array(await r.arrayBuffer());}
async function prepare(){
  const B=BrowserFS.BFSRequire('buffer').Buffer;
  const [wineData,claireData]=await Promise.all([download('wine.zip'),download('claire.zip')]);
  const [wine,claire]=await Promise.all([createFS(BrowserFS.FileSystem.ZipFS,{zipData:B.from(wineData)}),createFS(BrowserFS.FileSystem.ZipFS,{zipData:B.from(claireData)})]);
  const [root,files]=await Promise.all([createFS(BrowserFS.FileSystem.OverlayFS,{readable:wine,writable:new BrowserFS.FileSystem.InMemory()}),createFS(BrowserFS.FileSystem.OverlayFS,{readable:claire,writable:new BrowserFS.FileSystem.InMemory()})]);
  const mounts=new BrowserFS.FileSystem.MountableFileSystem();mounts.mount('/root/base',root);mounts.mount('/root/files',files);
  BrowserFS.initialize(mounts);FS.mkdir('/root');FS.mount(new BrowserFS.EmscriptenFS(),{root:'/root'},'/root');
  // Create the inbox before Wine starts: the emulator caches missing paths.
  FS.writeFile(resultPath+'text.txt','');FS.writeFile(resultPath+'request.id','');
  notify('progress',{message:'Préparation de la voix…'});
  poll=setInterval(checkResult,75);
  Module.removeRunDependency('claire-files');
}
function submit(){
  if(!ready||!request||request.sent||failed)return;
  FS.writeFile(resultPath+'text.txt',new TextEncoder().encode(request.text));
  FS.writeFile(resultPath+'request.id',request.id);
  request.sent=true;notify('progress',{message:'Génération de la voix…'});
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
