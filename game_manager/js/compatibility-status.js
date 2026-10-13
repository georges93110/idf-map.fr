(function (root) {
  'use strict';
  const labels = Object.freeze({ shutdown: 'Fermeture native', windows: 'Portes', ui: 'Interface native',
    mode: 'Menus Bus', hud: 'HUD', gps: 'GPS', models: 'Modèles et passagers',
    textures: 'Textures et écrans HTML', saeiv: 'Interaction SAEIV', horn: 'Klaxons', audio: 'Réglages audio' });
  const readingLabels = Object.freeze({ language: 'Langue du jeu' });
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
      if (!Array.isArray(message.readings) || message.readings.length > 1) return null;
      for (const entry of message.readings) {
        if (!entry || !Object.hasOwn(readingLabels, entry.id) || !['pending', 'ready', 'update_required'].includes(entry.state)) return null;
        readings.push({ id: entry.id, state: entry.state });
      }
    }
    const errors = [];
    if (message.errors !== undefined) {
      if (!Array.isArray(message.errors) || message.errors.length > 256) return null;
      const codes = new Set();
      for (const entry of message.errors) {
        if (!entry || !/^E[1-6][0-9]{3}$/.test(entry.code) || codes.has(entry.code) ||
            typeof entry.blocking !== 'boolean' || typeof entry.simulated !== 'boolean' ||
            !Number.isSafeInteger(entry.count) || entry.count < 0) return null;
        codes.add(entry.code); errors.push({ code: entry.code, blocking: entry.blocking, simulated: entry.simulated, count: entry.count });
      }
    }
    return { type: 'nativeCompatibilityBackend' , protocol: 1, status: message.status, systems, ...(readings.length ? { readings } : {}), ...(message.errors !== undefined ? { errors } : {}) };
  }
  function receive(message) {
    const state = normalize(message); if (!state) return false;
    if (!root.document) return true;
    const disabled = [...state.systems, ...(state.readings || [])].filter(s => s.state === 'update_required').map(s => labels[s.id] || readingLabels[s.id]);
    const errors = state.errors || [], blocked = errors.some(e => e.blocking);
    const codes = errors.map(e => e.code + (e.simulated ? ' (démo)' : '')).join(', ');
    const reason = errors.some(e => e.code === 'E1001')
      ? 'Le plugin IDF-RP est disponible uniquement sur la map Ile-de-France.'
      : "Quelque chose s'est mal passé, veuillez nous excuser. Relancez le jeu.";
    const text = (disabled.length ? 'UPDATE REQUIRED — ' + disabled.join(', ') : blocked ? reason : '') +
      (codes ? ' — Codes : ' + codes : '');
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
