(function (root) {
  'use strict';
  const labels = Object.freeze({ shutdown: 'Fermeture native', windows: 'Portes', ui: 'Interface native',
    mode: 'Menus Bus', hud: 'HUD', gps: 'GPS', models: 'Modèles et passagers',
    textures: 'Textures et écrans HTML', saeiv: 'Interaction SAEIV', horn: 'Klaxons', audio: 'Réglages audio' });
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
    return { type: 'nativeCompatibilityBackend', protocol: 1, status: message.status, systems };
  }
  function receive(message) {
    const state = normalize(message); if (!state) return false;
    if (!root.document) return true;
    const disabled = state.systems.filter(s => s.state === 'update_required').map(s => labels[s.id]);
    const text = disabled.length ? 'UPDATE REQUIRED — ' + disabled.join(', ') : '';
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
