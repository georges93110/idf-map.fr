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
 var labels={disabled:'DÃ©sactivÃ©',unavailable:'Diagnostic activÃ© â€” poursuite indisponible',ready:'PrÃªt',pursuing:'Poursuite',approaching:'Agent en approche',returning:'Retour au vÃ©hicule',paid:'ContrÃ´le terminÃ©',escaped:'Interception abandonnÃ©e',fault:'Erreur â€” intervention arrÃªtÃ©e'};
 var offences={speeding:'ExcÃ¨s de vitesse',red_signal:'Feu rouge',wrong_way:'Contresens',speeding_camera:'Radar',crash:'Collision',no_lights:'Ã‰clairage',avoid_sleeping:'Fatigue'};
 var reasons={accepted:'Commande exÃ©cutÃ©e.',unsupported:'OpÃ©ration verrouillÃ©e : les accÃ¨s moteur nÃ©cessaires ne sont pas encore validÃ©s.',no_scene:'Reprends une partie chargÃ©e pour agir sur la scÃ¨ne.',disabled:'Active dâ€™abord le module.',stale:'Le contexte de partie a changÃ©. Renouvelle la commande.',invalid:'Commande non valide.',timeout:'Aucune confirmation reÃ§ue. Lâ€™Ã©tat de la DLL fait foi.',busy:'Une commande est dÃ©jÃ  en attente.',id_conflict:'Identifiant de commande dÃ©jÃ  utilisÃ©.',clients_full:'Trop de clients dans cette partie.'};
 function send(m){host.postMessage(m,origin==='null'?'*':origin);}
 function command(action){if(!state||Date.now()-last>=3000||pending)return;
  try{seq=Math.max(seq,Number(sessionStorage.getItem('idf.police.sequence'))||0);}catch(e){}
  pending=Date.now();seq++;
  try{sessionStorage.setItem('idf.police.sequence',String(seq));}catch(e){}
  send({type:'policeCommand',protocol:1,epoch:state.epoch,context:state.context,client:client,sequence:seq,action:action,offence:Number($('kind').value)});paint();}
 function paint(){var live=state&&Date.now()-last<3000;
  $('toggle').disabled=!live||!!pending;$('toggle').textContent=state&&state.enabled?'DÃ©sactiver':'Activer';
  $('status').textContent=live?(labels[state.phase]||state.phase):'Connexion Ã  la DLLâ€¦';$('status').className=live&&state.enabled?'on':'off';
  document.querySelectorAll('[data-action]').forEach(function(b){b.disabled=!live||!!pending||(b.dataset.action==='spawn'?!state.spawnAvailable:(b.dataset.action!=='reset'&&!state.sceneCommands));});
  if(!live)return;
  $('notice').textContent=state.operational?'Module opÃ©rationnel.':'PrÃ©paration technique : la poursuite physique et le spawn natif sont indisponibles dans cette version. Toutes les amendes du jeu restent actives.';
  $('offence').textContent=offences[state.nativeOffence]||state.nativeOffence||'â€”';
  $('amount').textContent=state.nativeFineCount?state.nativeFineAmount+' â‚¬':'â€”';$('deferred').textContent=state.deferredFine==null?'â€”':state.deferredFine+' â‚¬';
  $('distance').textContent=state.policeDistance==null?'â€”':Math.round(state.policeDistance)+' m';
  $('patrols').textContent=state.policeRegistryAvailable?String(state.registeredPolice):'â€”';
  var vehicleStates={idle:'aucune voiture créée',spawned:'Mégane créée dans le trafic natif',already_present:'Mégane déjà présente',native_rejected:'emplacement refusé par le moteur (place libre, visibilité ou ressource)',no_lane:'aucune voie compatible près du point demandé',no_model:'Mégane absente du catalogue',invalid_registry:'création non confirmée — consulter le journal',removed:'voiture de démonstration retirée',lost:'voiture retirée par le moteur',no_scene:'scène indisponible'};
  var queryNames=['pas encore exécuté','indisponible','libre','bloqué'];
  $('caps').textContent=(state.build||'Police')+' · '+(state.spawnPending?'Création en attente…':state.cleanupPending?'Nettoyage en attente de reprise du jeu…':vehicleStates[state.demoVehicleState]||'Diagnostic')+
   '. Collision de diagnostic : '+(queryNames[state.collisionProbeSweep]||'—')+' ; gabarit entier : '+(queryNames[state.bodyProbeSweep]||'—')+'. '+
   (state.nativePhaseThreadChanged?'Changement de thread détecté : commandes bloquées. ':'')+
   'Ce bouton crée une voiture gérée par le trafic normal ; il ne déclenche pas encore une poursuite.';
 }
 window.addEventListener('message',function(e){if(e.source!==host||e.origin!==origin||!e.data||e.data.protocol!==1)return;var m=e.data;
  if(m.type==='policeOffline'){last=0;paint();return;}
  if(m.type==='policeCommandResult'&&m.client===client&&m.sequence===seq){pending=0;$('feedback').textContent=reasons[m.reason]||m.reason;paint();return;}
  if(m.type!=='policeState')return;
  if(state&&(m.epoch!==state.epoch||m.context!==state.context)){pending=0;$('feedback').textContent='Nouvelle partie : module dÃ©sactivÃ©.';}
  state=m;last=Date.now();
  if(pending&&m.client===client&&m.sequence===seq){pending=0;$('feedback').textContent=reasons[m.receipt]||m.receipt;}paint();
 });
 $('toggle').addEventListener('click',function(){command(state&&state.enabled?'disable':'enable');});
 document.querySelectorAll('[data-action]').forEach(function(b){b.addEventListener('click',function(){command(b.dataset.action);});});
 setInterval(function(){if(pending&&Date.now()-pending>4500){pending=0;$('feedback').textContent=reasons.timeout;}send({type:'policeSubscribe',protocol:1});paint();},1000);
 send({type:'policeSubscribe',protocol:1});
})();
