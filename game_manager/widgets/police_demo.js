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
 var labels={disabled:'Désactivé',unavailable:'Démo activée',ready:'Prêt',pursuing:'Poursuite',approaching:'Agent en approche',returning:'Retour au véhicule',paid:'Contrôle terminé',escaped:'Interception abandonnée',fault:'Erreur — intervention arrêtée'};
 var pursuitLabels={waiting_resume:'Poursuite en attente de reprise du jeu',preparing:'Préparation de la poursuite',pursuing:'Poursuite de test',parked:'Police arrêtée derrière toi',blocked:'Police arrêtée : passage ou sol indisponible',native_collision:'Collision : physique native en cours',invalid_scene:'Contrôleur indisponible dans cette scène',vehicle_lost:'Le moteur a retiré la Mégane'};
 var blockedLabels={disabled:'Active d’abord le module Police.',no_scene:'Charge une partie avant de lancer la poursuite.',driver_unavailable:'Le contrôleur natif ne s’est pas initialisé. Consulte le journal de la DLL.',thread_changed:'La phase native a changé de thread : poursuite suspendue.',not_solo:'Une scène solo doit être confirmée par la DLL.',cleanup_pending:'Attends la fin du nettoyage.',spawn_pending:'Attends la création de la Mégane.',spawn_required:'Fais apparaître la Mégane avant de lancer la poursuite.',vehicle_lost:'Le moteur a retiré la Mégane : crée une nouvelle patrouille.',position_unavailable:'La position de conduite n’est pas encore disponible.'};
 var offences={speeding:'Excès de vitesse',red_signal:'Feu rouge',wrong_way:'Contresens',speeding_camera:'Radar',crash:'Collision',no_lights:'Éclairage',avoid_sleeping:'Fatigue'};
 var reasons={accepted:'Commande reçue. Le résultat de création est affiché ci-dessous.',unsupported:'Opération verrouillée : les accès moteur nécessaires ne sont pas encore validés.',no_scene:'Reprends une partie chargée pour agir sur la scène.',disabled:'Active d’abord le module.',stale:'Le contexte de partie a changé. Renouvelle la commande.',invalid:'Commande non valide.',timeout:'Aucune confirmation reçue. L’état de la DLL fait foi.',busy:'Une commande est déjà en attente.',id_conflict:'Identifiant de commande déjà utilisé.',clients_full:'Trop de clients dans cette partie.'};
 function send(m){host.postMessage(m,origin==='null'?'*':origin);}
 function command(action){if(!state||Date.now()-last>=3000||pending)return;
  try{seq=Math.max(seq,Number(sessionStorage.getItem('idf.police.sequence'))||0);}catch(e){}
  pending=Date.now();seq++;
  try{sessionStorage.setItem('idf.police.sequence',String(seq));}catch(e){}
  send({type:'policeCommand',protocol:1,epoch:state.epoch,context:state.context,client:client,sequence:seq,action:action,offence:Number($('kind').value)});paint();}
 function paint(){var live=state&&Date.now()-last<3000;
  $('toggle').disabled=!live||!!pending;$('toggle').textContent=state&&state.enabled?'Désactiver':'Activer';
  $('status').textContent=live?((state.pursuitActive&&state.paused?'Poursuite en attente de reprise du jeu':state.pursuitActive&&pursuitLabels[state.pursuitState])||labels[state.phase]||state.phase):'Connexion à la DLL…';$('status').className=live&&state.enabled?'on':'off';
  document.querySelectorAll('[data-action]').forEach(function(b){var a=b.dataset.action;b.disabled=!live||!!pending||(a==='spawn'?!state.spawnAvailable:(a!=='reset'&&!state.pursuitAvailable));b.title=b.disabled?(blockedLabels[state&&state.pursuitBlockReason]||'En attente de la DLL'):'';});
  if(!live)return;
  $('notice').textContent=(blockedLabels[state.pursuitBlockReason]||(state.paused?'Tu peux demander la poursuite ici ; elle commencera en reprenant la conduite.':'Activer → Faire apparaître la Mégane → Poursuite de test.'))+' Conduite native limitée à 30 km/h. Les amendes habituelles restent actives ; agent et contrôle différé non raccordés.';
  $('offence').textContent=offences[state.nativeOffence]||state.nativeOffence||'—';
  $('amount').textContent=state.nativeFineCount?state.nativeFineAmount+' €':'—';$('deferred').textContent=state.deferredFine==null?'—':state.deferredFine+' €';
  $('distance').textContent=state.policeDistance==null?'—':Math.round(state.policeDistance)+' m';
  $('patrols').textContent=state.policeRegistryAvailable?String(state.registeredPolice):'—';
  var vehicleStates={idle:'aucune voiture créée',spawned:'Mégane créée dans le trafic natif',already_present:'Mégane déjà présente',native_rejected:'aucun emplacement accepté ; détail natif dans game.log.txt',traffic_full:'trafic complet : aucune place disponible',no_lane:'aucune voie compatible aux points recherchés',no_model:'Mégane absente du catalogue',invalid_registry:'création non confirmée : consulter le journal',removed:'voiture de démonstration retirée',lost:'voiture retirée par le moteur',no_scene:'scène indisponible'};
  var queryNames=['pas encore exécuté','indisponible','libre','bloqué'];
  var vehicle=state.spawnPending?('Recherche d’un emplacement '+(state.spawnAttempts||0)+'/45'+(state.demoVehicleState==='traffic_full'?' — attente d’une place dans le trafic':'')):vehicleStates[state.demoVehicleState]||'Diagnostic';
  $('caps').textContent=(state.build||'Police')+' — '+(state.cleanupPending?'Nettoyage en attente de reprise du jeu…':vehicle)+
   '. Collision de diagnostic : '+(queryNames[state.collisionProbeSweep]||'—')+' ; gabarit entier : '+(queryNames[state.bodyProbeSweep]||'—')+'. '+
   (state.nativePhaseThreadChanged?'Changement de thread détecté : commandes bloquées. ':'')+
   'Physique : '+(state.physicsTicks||0)+' appels, '+(state.pathSamples||0)+' déplacements, '+(state.stalePathFrames||0)+' plans expirés. '+
   (state.pursuitFault?'Diagnostic contrôleur : '+state.pursuitFault+'. ':'')+
   (state.sirenRequested?'Sirène native demandée. ':'')+
   'Arrêter / nettoyer retire la voiture de démonstration. Le suivi complet des voies et le contrôle par un agent restent indisponibles. La simulation d’infraction lance cette poursuite sans débit.';
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
