(function(){'use strict';
 var state=null,last=0,seq=0,pending=0;
 var words=new Uint32Array(2);crypto.getRandomValues(words);
 var client=Array.from(words,function(v){return v.toString(16).padStart(8,'0');}).join('');
 if(client==='0000000000000000')client='0000000000000001';
 try{var saved=sessionStorage.getItem('idf.police.client');
  if(/^[0-9a-f]{16}$/.test(saved||'')&&saved!=='0000000000000000')client=saved;
  else sessionStorage.setItem('idf.police.client',client);
  seq=Number(sessionStorage.getItem('idf.police.sequence'))||0;
 }catch(e){}
 var host=window.parent;
 try{if(host.opener&&host.opener!==window)host=host.opener;}catch(e){}
 var origin=location.origin, $=function(id){return document.getElementById(id);};
 var labels={disabled:'Désactivé',unavailable:'Diagnostic activé — poursuite indisponible',ready:'Prêt',pursuing:'Poursuite',approaching:'Agent en approche',returning:'Retour au véhicule',paid:'Contrôle terminé',escaped:'Interception abandonnée',fault:'Erreur — intervention arrêtée'};
 var offences={speeding:'Excès de vitesse',red_signal:'Feu rouge',wrong_way:'Contresens',speeding_camera:'Radar',crash:'Collision',no_lights:'Éclairage',avoid_sleeping:'Fatigue'};
 var reasons={accepted:'Commande exécutée.',unsupported:'Opération verrouillée : les accès moteur nécessaires ne sont pas encore validés.',no_scene:'Reprends une partie chargée pour agir sur la scène.',disabled:'Active d’abord le module.',stale:'Le contexte de partie a changé. Renouvelle la commande.',invalid:'Commande non valide.',timeout:'Aucune confirmation reçue. L’état de la DLL fait foi.',busy:'Une commande est déjà en attente.',id_conflict:'Identifiant de commande déjà utilisé.',clients_full:'Trop de clients dans cette partie.'};
 function send(m){host.postMessage(m,origin==='null'?'*':origin);}
 function command(action){if(!state||Date.now()-last>=3000||pending)return;
  try{seq=Math.max(seq,Number(sessionStorage.getItem('idf.police.sequence'))||0);}catch(e){}
  pending=Date.now();seq++;
  try{sessionStorage.setItem('idf.police.sequence',String(seq));}catch(e){}
  send({type:'policeCommand',protocol:1,epoch:state.epoch,context:state.context,client:client,sequence:seq,action:action,offence:Number($('kind').value)});paint();}
 function paint(){var live=state&&Date.now()-last<3000;
  $('toggle').disabled=!live||!!pending;$('toggle').textContent=state&&state.enabled?'Désactiver':'Activer';
  $('status').textContent=live?(labels[state.phase]||state.phase):'Connexion à la DLL…';$('status').className=live&&state.enabled?'on':'off';
  document.querySelectorAll('[data-action]').forEach(function(b){b.disabled=!live||!!pending||(b.dataset.action!=='reset'&&!state.sceneCommands);});
  if(!live)return;
  $('notice').textContent=state.operational?'Module opérationnel.':'Préparation technique : la poursuite physique et le spawn natif sont indisponibles dans cette version. Toutes les amendes du jeu restent actives.';
  $('offence').textContent=offences[state.nativeOffence]||state.nativeOffence||'—';
  $('amount').textContent=state.nativeFineCount?state.nativeFineAmount+' €':'—';$('deferred').textContent=state.deferredFine==null?'—':state.deferredFine+' €';
  $('distance').textContent=state.policeDistance==null?'—':Math.round(state.policeDistance)+' m';
  $('patrols').textContent=state.policeRegistryAvailable?String(state.registeredPolice):'—';
  $('caps').textContent='POLICE1 · Diagnostic player.fined '+(state.fineDiagnosticsAvailable?'connecté':'indisponible')+'. À vérifier : véhicule natif, contrôleur de poursuite, obstacles/hors route, marche de l’agent, débit différé, identification du témoin, cycle de vie et confirmation du mode solo. Fuite prévue : '+state.escapeDistance+' m / '+state.escapeSeconds+' s hors pause.';
 }
 window.addEventListener('message',function(e){if(e.source!==host||e.origin!==origin||!e.data||e.data.protocol!==1)return;var m=e.data;
  if(m.type==='policeOffline'){last=0;paint();return;}
  if(m.type==='policeCommandResult'&&m.client===client&&m.sequence===seq){pending=0;$('feedback').textContent=reasons[m.reason]||m.reason;paint();return;}
  if(m.type!=='policeState')return;
  if(state&&(m.epoch!==state.epoch||m.context!==state.context)){pending=0;$('feedback').textContent='Nouvelle partie : module désactivé.';}
  state=m;last=Date.now();
  if(pending&&m.client===client&&m.sequence===seq){pending=0;$('feedback').textContent=reasons[m.receipt]||m.receipt;}paint();
 });
 $('toggle').addEventListener('click',function(){command(state&&state.enabled?'disable':'enable');});
 document.querySelectorAll('[data-action]').forEach(function(b){b.addEventListener('click',function(){command(b.dataset.action);});});
 setInterval(function(){if(pending&&Date.now()-pending>4500){pending=0;$('feedback').textContent=reasons.timeout;}send({type:'policeSubscribe',protocol:1});paint();},1000);
 send({type:'policeSubscribe',protocol:1});
})();
