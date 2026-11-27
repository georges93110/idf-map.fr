'use strict';
// The original x86 engine runs ONLY inside this WebAssembly instance.
var Module;
let request=null, finished=false, poll=null, lastLogs=[];
const resultPath='/root/files/';
function notify(kind,details={},transfer=[]){if(request)parent.postMessage({kind,id:request.id,...details},location.origin,transfer);}
function failure(message){if(finished)return;finished=true;clearInterval(poll);notify('error',{message});}
function output(...args){const line=args.join(' ');lastLogs.push(line);if(lastLogs.length>25)lastLogs.shift();}
window.addEventListener('error',e=>failure('Erreur du moteur web : '+e.message));
window.addEventListener('unhandledrejection',e=>failure('Erreur du moteur web : '+String(e.reason?.message||e.reason)));
function createFS(type,options){return new Promise((resolve,reject)=>type.Create(options,(err,fs)=>err?reject(err):resolve(fs)));}
async function download(name){const r=await fetch('moteur/'+name,{credentials:'same-origin'});if(!r.ok)throw Error('Fichier absent ou inaccessible : moteur/'+name);return new Uint8Array(await r.arrayBuffer());}
async function prepare(){
  const B=BrowserFS.BFSRequire('buffer').Buffer;
  const [wineData,claireData]=await Promise.all([download('wine.zip'),download('claire.zip')]);
  const [wine,claire]=await Promise.all([createFS(BrowserFS.FileSystem.ZipFS,{zipData:B.from(wineData)}),createFS(BrowserFS.FileSystem.ZipFS,{zipData:B.from(claireData)})]);
  const [root,files]=await Promise.all([createFS(BrowserFS.FileSystem.OverlayFS,{readable:wine,writable:new BrowserFS.FileSystem.InMemory()}),createFS(BrowserFS.FileSystem.OverlayFS,{readable:claire,writable:new BrowserFS.FileSystem.InMemory()})]);
  const mounts=new BrowserFS.FileSystem.MountableFileSystem();mounts.mount('/root/base',root);mounts.mount('/root/files',files);
  BrowserFS.initialize(mounts);FS.mkdir('/root');FS.mount(new BrowserFS.EmscriptenFS(),{root:'/root'},'/root');
  FS.writeFile(resultPath+'text.txt',new TextEncoder().encode(request.text));
  notify('progress',{message:'Génération de la voix dans le navigateur…'});
  poll=setInterval(checkResult,200);
  Module.removeRunDependency('claire-files');
}
function checkResult(){
  if(finished)return;
  try{const err=FS.readFile(resultPath+'error.txt',{encoding:'utf8'});if(err){failure(err);return;}}catch{}
  try{
    const data=FS.readFile(resultPath+'audio.wav');
    if(data.length>32*1024*1024){failure('Audio trop volumineux : raccourcis le texte.');return;}
    if(data.length<=44)return;
    const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
    if(v.getUint32(40,true)+44!==data.length)return;
    finished=true;clearInterval(poll);
    const audio=data.slice().buffer;notify('audio',{audio},[audio]);
  }catch{}
}
function launch(data){
  if(request||!data||data.kind!=='start'||typeof data.id!=='string'||typeof data.text!=='string'||!data.text.trim()||data.text.length>5000)return;
  request={id:data.id,text:data.text};
  Module={
    locateFile:name=>'moteur/'+name,
    arguments:['-root','/root/base','-mount_drive','/root/files','d','-nozip','-nosound','-w','/home/username/.wine/dosdevices/d:/','/bin/wine','D:\\claire-render.exe','D:\\text.txt','D:\\audio.wav','D:\\error.txt'],
    canvas:document.getElementById('canvas'),print:output,printErr:output,
    preRun:[()=>{Module.addRunDependency('claire-files');prepare().catch(e=>failure(e.message));}],
    onAbort:()=>failure('Le moteur WebAssembly s’est arrêté. Réessaie avec un texte plus court.'),
  };
  const script=document.createElement('script');script.src='moteur/boxedwine.js';script.onerror=()=>failure('Le fichier moteur/boxedwine.js est introuvable.');document.body.appendChild(script);
}
window.addEventListener('message',event=>{if(event.source===parent&&event.origin===location.origin)launch(event.data);});
