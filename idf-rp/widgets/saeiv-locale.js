(function (root) {
  'use strict';
  const words = Object.freeze({
    'Avancez vers le fond': 'Move towards the rear',
    'Attention aux pickpockets': 'Beware of pickpockets',
    'Bienvenue sur cette ligne IDFM': 'Welcome aboard this IDFM line',
    "Montée par l'avant": 'Board at the front', 'Montée par l’avant': 'Board at the front',
    'Terminus': 'Last stop', 'Validez votre titre': 'Validate your ticket',
    'Ecran SAEIV': 'SAEIV display', 'Ouvrir les boutons': 'Show controls',
    'Basculer fenetre PIP': 'Toggle PIP window', 'Mode PIP': 'PIP mode',
    'Arreter annonce en cours': 'Stop current announcement', 'Arreter annonce': 'Stop announcement',
    'Quitter PIP': 'Close PIP', 'Quitter fenetre PIP': 'Close PIP window',
    'Basculer heure et date': 'Toggle time and date', 'APPEL SUP': 'CALL SUP',
    'APPEL REG': 'CALL CTRL', 'Appel sup': 'Call supervisor', 'Appel reg': 'Call control',
    'Onglet 1': 'Tab 1', 'Onglet 2': 'Tab 2', 'Onglet 3': 'Tab 3', 'Onglet 4': 'Tab 4',
    'Départ dans': 'Departure in', 'Nom Arrêt': 'Stop name', 'Arrêt': 'Stop',
    'inconnue': 'unknown', 'Point de régulation': 'Timing point',
    'Agent-Voiture :': 'Driver-Vehicle:', 'Agent-Voiture : --- ---': 'Driver-Vehicle: --- ---',
    'Menu SAE': 'SAE menu', 'MENU SAE': 'SAE MENU', 'Fermer menu': 'Close menu', 'Fermer': 'Close',
    'Liste des alarmes': 'Alarm list', 'LISTE DES ALARMES': 'ALARM LIST',
    'Signalement': 'Report', 'SIGNALEMENT': 'REPORT', 'Messagerie': 'Messages', 'MESSAGERIE': 'MESSAGES',
    'Diffusion sonore preregistree': 'Recorded announcements', 'Diffusion sonore': 'Recorded',
    'pré-enregistrée': 'announcements', 'DIFFUSION SONORE PRE-ENREGISTREE': 'RECORDED ANNOUNCEMENTS',
    'Releve': 'Driver change', 'Relève': 'Driver change',
    'Prise de service complete': 'Full service setup', 'Prise de service': 'Start service',
    'Prise de service<br>complète': 'Full service<br>setup', 'complète': 'setup',
    'Test d exploitation': 'Operation test', "Test d'exploitation": 'Operation test',
    'TEST EXPLOITATION : OK': 'OPERATION TEST: OK', 'Reglages': 'Settings', 'Réglages': 'Settings',
    'Info Voyageur': 'Passenger info', 'Info. Voyageur': 'Passenger info',
    'Menu precedent': 'Previous menu', 'Menu suivant': 'Next menu', 'Retour menu': 'Back to menu', 'Retour': 'Back',
    'Consultation': 'View', 'Signalement precedent': 'Previous report', 'Signalement suivant': 'Next report',
    'Diffusion precedente': 'Previous announcement', 'Diffusion suivante': 'Next announcement',
    'Alarme precedente': 'Previous alarm', 'Alarme suivante': 'Next alarm',
    'BROKER MQTT Flowbird INTROUVABLE': 'Flowbird MQTT BROKER NOT FOUND',
    'BROKER MQTT INDISPONIBLE': 'MQTT BROKER UNAVAILABLE', 'DEFAUT LIAISON BCV': 'BCV CONNECTION FAULT',
    'DEFAUT PORTE': 'DOOR FAULT', 'AERATEURS DE TOITURE': 'ROOF VENTS',
    'Messagerie regulateur': 'Control messages', 'Messagerie exploitant': 'Operator messages',
    'Messagerie visuelle passager': 'Passenger display messages', 'Cons. messagerie': 'View messages',
    'regulateur': 'control', 'exploitant': 'operator', 'visuelle passager': 'passenger display',
    'Table messagerie': 'Message table', 'Reçu': 'Received', 'Objet': 'Subject', 'PAS DE MESSAGE': 'NO MESSAGES',
    'Message precedent': 'Previous message', 'Message suivant': 'Next message',
    'Ligne': 'Line', 'LIGNE': 'LINE', 'Ligne : -': 'Line: -', 'Correction': 'Correction',
    'CORRECTION': 'CORRECT', 'Clavier numerique': 'Numeric keypad', 'SAISIE': 'ENTRY',
    'Prise de service validée.': 'Service setup confirmed.',
    'En attente des paramètres mission...': 'Waiting for service details...',
    'Prise de service acceptée': 'Service accepted', 'Fin de service': 'End service',
    'Souhaitez-vous forcer la fin de service ?': 'Do you want to end the service?',
    'OUI': 'YES', 'NON': 'NO', 'VALIDER': 'CONFIRM', 'ANNULER': 'CANCEL', 'ALARME DISCRETE': 'SILENT ALARM',
    'MERCI DE PAS FERMER CETTE PAGE': 'PLEASE DO NOT CLOSE THIS PAGE',
    'VOUS POUVEZ EN REVANCHE MINIMISER CETTE PAGE': 'YOU CAN MINIMISE THIS PAGE',
    'Appel REG temporairement desactive': 'Control calls temporarily disabled',
    'Aucun CRIV connecte sur cette ligne': 'No controller connected on this line',
    'N° VOITURE': 'VEHICLE NO.', 'N° AGENT': 'DRIVER NO.', 'N° MATRICULE': 'STAFF ID',
    'Numero voiture': 'Vehicle number', 'Numero agent': 'Driver number', 'Numero matricule': 'Staff ID',
    'AUCUN FICHIER AUDIO DISPONIBLE': 'NO AUDIO FILES AVAILABLE',
    'SERVICE TERMINE': 'SERVICE ENDED', 'PRISE SERVICE': 'START SERVICE', 'TOUS DESCENDUS': 'ALL ALIGHTED',
    'SERVICE ACCEPTE': 'SERVICE ACCEPTED', 'REJOINDRE LE DEPART': 'GO TO FIRST STOP',
    'DEPART NON AUTORISE': 'CANNOT START', 'FIN NON VALIDEE': 'END NOT CONFIRMED',
    'SERVICE INDISPONIBLE': 'SERVICE UNAVAILABLE', 'REESSAYER': 'TRY AGAIN', 'VALID : SUIVI': 'ENTER: TRACK SERVICE',
    'LIGNE INCONNUE': 'UNKNOWN LINE', 'VERIFIER LA SAISIE': 'CHECK YOUR ENTRY',
    'VOITURE INCORRECTE': 'INVALID VEHICLE', 'SAISIR DE 1 A 30': 'ENTER 1 TO 30',
    'LIGNE AMBIGUE': 'AMBIGUOUS LINE', 'SERVICE INCONNU': 'UNKNOWN SERVICE',
    'MATRICULE INCORRECT': 'INVALID STAFF ID', 'LIAISON INTERROMPUE': 'CONNECTION LOST',
    'TRANSMISSION SAEIV': 'SAEIV TRANSMISSION', 'PATIENTEZ...': 'PLEASE WAIT...',
    'VOITURE': 'VEHICLE', 'MATRICULE': 'STAFF ID', 'VALIDER LE SERVICE ?': 'CONFIRM SERVICE?',
    'TERMINER SERVICE ?': 'END SERVICE?', 'VALID:OUI ANNUL:NON': 'ENTER:YES CANCEL:NO',
    'LIAISON SAEIV': 'SAEIV CONNECTION', 'EN ATTENTE': 'WAITING',
    'ANNONCES ': 'ANNOUNCEMENTS ', 'AUCUNE ANNONCE': 'NO ANNOUNCEMENTS',
    'BONJOUR, APPUYER': 'WELCOME, PRESS', 'SUR PRISE SERVICE': 'START SERVICE',
    'ANNUL:FIN SERVICE': 'CANCEL: END SERVICE', 'A L ARRET': 'AT STOP', 'PROCHAIN ARRET': 'NEXT STOP',
    'HORAIRE ': 'TIMETABLE ', 'ECART ': 'DELAY ', 'SERVICE EN COURS': 'SERVICE IN PROGRESS',
    'VALID: DEPART': 'ENTER: START', ' VOITURE ': ' VEHICLE ',
    'Prise service': 'Start service', '0 · Localisation': '0 · Location', '3 · Sono': '3 · Audio',
    'Flèche haut': 'Up arrow', 'Flèche bas': 'Down arrow', 'Appel PCL': 'Call PCL', 'Appel PG': 'Call PG',
    'Annul': 'Cancel', 'Valid': 'Confirm', '5 · Tarif': '5 · Fare', '9 · Secteur': '9 · Area',
    'Annonce 1': 'Announcement 1', 'Annonce 2': 'Announcement 2', 'Annonce 3': 'Announcement 3', 'Annonce 4': 'Announcement 4'
  });
  const french = code => /^fr(?:$|[-_])/i.test(String(code || ''));
  function create(language) {
    let fr = french(language);
    const bindings = [], documents = new Set();
    const t = value => fr ? value : (Object.prototype.hasOwnProperty.call(words, value) ? words[value] : value);
    function announcement(value) {
      const source = String(value || ''), base = source.replace(/\s*\(Ancien\)$/i, '');
      if (fr || !Object.prototype.hasOwnProperty.call(words, base)) return source;
      return t(base) + (base === source ? '' : ' (old)');
    }
    function remember(read, write) {
      const source = read(), trimmed = source.trim();
      if (!Object.prototype.hasOwnProperty.call(words, trimmed)) return;
      const leading = source.slice(0, source.indexOf(trimmed)), trailing = source.slice(source.indexOf(trimmed) + trimmed.length);
      const binding = {source, last: source, read, write, translated: () => leading + t(trimmed) + trailing};
      bindings.push(binding); binding.last = binding.translated(); write(binding.last);
    }
    function bind(doc) {
      if (documents.has(doc)) return; documents.add(doc); doc.documentElement.lang = fr ? 'fr' : 'en';
      const walker = doc.createTreeWalker(doc.documentElement, 4);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('script,style,textarea,input,#stopNameA,#stopNameB,#stopNameC,#stopNamePlaceholder,#lineMainStop,#lineRefStop')) continue;
        const textNode = node;
        remember(() => textNode.data, value => { textNode.data = value; });
      }
      for (const element of doc.querySelectorAll('[aria-label],[title],[placeholder]')) {
        for (const attribute of ['aria-label','title','placeholder']) {
          if (element.hasAttribute(attribute)) remember(() => element.getAttribute(attribute), value => element.setAttribute(attribute, value));
        }
      }
    }
    function setLanguage(code) {
      const next = french(code); if (next === fr) return false; fr = next;
      for (const doc of documents) doc.documentElement.lang = fr ? 'fr' : 'en';
      for (const b of bindings) if (b.read() === b.last) { b.last = b.translated(); b.write(b.last); }
      return true;
    }
    return {t, announcement, bind, setLanguage, get language() { return fr ? 'fr' : 'en'; }};
  }
  const api = {create, french, words};
  if (typeof module !== 'undefined') module.exports = api;
  root.IdfSaeivLocale = api;
})(typeof globalThis === 'undefined' ? window : globalThis);
