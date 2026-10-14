(function (root) {
  'use strict';
  const labels = Object.freeze({ shutdown: 'Fermeture native', windows: 'Portes', ui: 'Interface native',
    mode: 'Menus Bus', hud: 'HUD', gps: 'GPS', models: 'Modèles et passagers',
    textures: 'Textures et écrans HTML', saeiv: 'Interaction SAEIV', horn: 'Klaxons', audio: 'Réglages audio' });
  const readingLabels = Object.freeze({ language: 'Langue du jeu', convoyIdentity: 'Identification du Convoi', convoyVehicles: 'Véhicules du Convoi', convoyDoors: 'Portes des véhicules du Convoi' });
  let node, lastText = '', expiry;
  function normalize(message) {
    if (!message || message.type !== 'nativeCompatibilityBackend' || message.protocol !== 1 ||
        !['pending', 'ready', 'update_required'].includes(message.status) || !Array.isArray(message.systems) ||
        message.systems.length !== Object.keys(labels).length) return null;
    const seen = new Set(), systems = [];
    for (const entry of message.systems) {
      if (!entry || !Object.hasOwn(labels, entry.id) || seen.has(entry.id) ||
          !['pending', 'ready', 'update_required'].includes(entry.state)) return null;
      seen.add(entry.id); systems.push({ id: entry.id, state: entry.state });
    }
    const readings = [];
    if (message.readings !== undefined) {
      if (!Array.isArray(message.readings) || message.readings.length > Object.keys(readingLabels).length) return null;
      const readingIds = new Set();
      for (const entry of message.readings) {
        if (!entry || !Object.hasOwn(readingLabels, entry.id) || readingIds.has(entry.id) || !['pending', 'ready', 'update_required'].includes(entry.state)) return null;
        readingIds.add(entry.id);
        readings.push({ id: entry.id, state: entry.state });
      }
    }
    const notice = message.notice === undefined ? 'none' : message.notice;
    if (!['none', 'map', 'webview', 'other'].includes(notice)) return null;
    // Old DLLs may still send diagnostic arrays. Never forward their codes to UI.
    const identity = {};
    for (const key of ['executableSha256', 'catalogue']) {
      if (message[key] !== undefined) {
        if (typeof message[key] !== 'string' || !/^[0-9a-f]{64}$/.test(message[key])) return null;
        identity[key] = message[key];
      }
    }
    return { type: 'nativeCompatibilityBackend', protocol: 1, status: message.status,
      systems, ...(readings.length ? { readings } : {}), ...identity, notice };
  }

  function receive(message) {
    const state = normalize(message); if (!state) return false;
    if (!root.document) return true;
    const disabled = [...state.systems, ...(state.readings || [])].filter(s => s.state === 'update_required').map(s => labels[s.id] || readingLabels[s.id]);
    const notices = {
      map: 'Le plugin IDF-RP est disponible uniquement sur la map Ile-de-France.',
      webview: "Quelque chose s'est mal passé, veuillez nous excuser. Testez votre connexion internet et relancez le jeu. Si ça ne règle pas votre problème, signalez le problème sur notre discord.",
      other: "Quelque chose s'est mal passé, veuillez nous excuser. Relancez le jeu. Si ça ne règle pas votre problème, signalez le problème sur notre discord."
    };
    const text = disabled.length ? 'UPDATE REQUIRED — ' + disabled.join(', ') : notices[state.notice] || '';
    if (!node && text) {
      node = root.document.createElement('div'); node.id = 'idf-compatibility-status';
      node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite');
      // Outside widget containers: also works when native menus/HUD are unavailable.
      node.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;max-width:85vw;padding:10px 16px;border:1px solid #f4b942;border-radius:6px;background:#17191ff2;color:#ffd16d;font:600 15px/1.4 system-ui,sans-serif;pointer-events:none;';
      root.document.body.appendChild(node);
    }
    if (node && text !== lastText) { node.textContent = text; node.hidden = !text; lastText = text; }
    clearTimeout(expiry); expiry = setTimeout(() => { if (node) node.hidden = true; lastText = ''; }, 6000);
    return true;
  }
  const api = { normalize, receive, labels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.IDFRPCompatibility = api;
})(typeof window === 'undefined' ? globalThis : window);
