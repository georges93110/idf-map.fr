(function(){
 'use strict';
 const row=document.createElement('div');row.className='toolbar game-link';
 const button=document.createElement('button');button.className='btn primary';button.type='button';button.id='gameLinkButton';button.textContent='Relier au jeu';
 const status=document.createElement('span');status.className='hint';status.id='gameLinkStatus';status.setAttribute('role','status');status.textContent='Prévisualisez cette girouette sur votre bus dans ETS2.';
 row.append(button,status);document.querySelector('.preview-card').append(row);
 let connection=null,wanted=false,generation='',active=false,sequence=0,inflight=0,lastPng='',lastBeat=0,frameTimer=null;
 const send=data=>{if(connection?.readyState===1)connection.send(JSON.stringify({type:'girouetteEditor',protocol:1,generation,...data}));};
 function finish(message){wanted=false;active=false;generation='';lastPng='';inflight=0;clearInterval(frameTimer);frameTimer=null;button.disabled=false;button.textContent='Relier au jeu';status.textContent=message;}
 function stop(){send({action:'stop'});const old=connection;connection=null;old?.close();finish('Aperçu arrêté : girouette automatique du service.');}
 async function frame(){
  if(!wanted||connection?.readyState!==1)return;
  if(Date.now()-lastBeat>2000){lastBeat=Date.now();send({action:'heartbeat'});}
  if(!active||inflight)return;
  try{
   const capture=window.IDFGirouetteEditor?.capture();if(!capture||capture.png===lastPng)return;
   lastPng=capture.png;inflight=++sequence;send({action:'frame',sequence, ...capture});
  }catch{status.textContent='Impossible de préparer l’aperçu. Vérifiez les images et les polices.';}
 }
 button.addEventListener('click',()=>{
  if(wanted){stop();return;}
  wanted=true;button.textContent='Annuler la connexion';status.textContent='Recherche du plugin IDF-RP…';
  const socket=connection=window.IdfTelemetry.connect({purpose:'girouette-editor'});
  socket.onopen=()=>{
   if(socket!==connection)return;
   if(socket.hello?.girouetteEditor!==1){socket.close();finish('Mettez à jour le plugin pour relier le configurateur.');return;}
   send({action:'status'});frameTimer=setInterval(frame,250);button.textContent='Arrêter l’aperçu en jeu';
  };
  socket.onmessage=event=>{
   if(socket!==connection)return;let m;try{m=JSON.parse(event.data);}catch{return;}
   if(m.type!=='girouetteEditor'||m.protocol!==1)return;
   if(m.action==='applied'){if(m.sequence===inflight)inflight=0;status.textContent='Girouette appliquée en jeu — modifications en direct.';return;}
   if(m.action==='error'){inflight=0;lastPng='';status.textContent='Aperçu refusé par le plugin.';return;}
   if(m.action!=='status')return;
   const changed=generation!==m.generation;generation=m.generation;
   if(changed){active=false;inflight=0;lastPng='';}
   if(!m.bus||!m.enabled){active=false;status.textContent=!m.bus?'Activez le mode Bus dans le jeu.':'Activez le rendu de girouette dans les paramètres Bus.';return;}
   if(m.busy){active=false;status.textContent='Un autre configurateur utilise déjà la girouette.';return;}
   if(!m.active){active=false;inflight=0;lastPng='';if(!m.owned)send({action:'start'});status.textContent=m.powered?'Connexion au bus…':'Démarrez le moteur pour afficher la girouette.';return;}
   active=true;status.textContent=lastPng&&!inflight?'Girouette appliquée en jeu — modifications en direct.':'Bus connecté — envoi de l’aperçu…';void frame();
  };
  socket.onclose=()=>{if(socket!==connection)return;connection=null;finish(socket.localNetworkDenied?'Autorisez l’accès au réseau local pour relier le jeu.':'Plugin introuvable ou déconnecté. Lancez ETS2 avec IDF-RP puis réessayez.');};
 });
 window.addEventListener('pagehide',stop);
})();
