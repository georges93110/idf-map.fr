(function (root) {
  'use strict';
  const fr = {
    checking: 'Vérification des mises à jour…', downloading: 'Téléchargement de la mise à jour…',
    verifying: 'Vérification des fichiers téléchargés…', restart: 'Mise à jour téléchargée. Elle sera installée à la fermeture du jeu.',
    incompatible: 'Une mise à jour compatible avec cette version du jeu est nécessaire.',
    update_failed: 'Mise à jour non installée : la vérification des fichiers a échoué.',
    offline: 'Vérification des mises à jour indisponible. La version installée est conservée.',
    map_pending: 'Plugin à jour. La carte sera vérifiée au chargement de la carrière.',
    map_unsupported: 'Cette carte ne dispose pas de données IDF-RP compatibles.',
    resources_pending: 'Chargement des données et de l’interface IDF-RP…',
    resources_failed: 'Interface IDF-RP indisponible. Nouvelle tentative en cours.',
    runtime_failed: 'IDF-RP a rencontré une erreur. Consultez le journal du jeu.',
    game_pending: 'Plugin à jour. Vérification de la compatibilité du jeu…',
    ready: 'IDF-RP prêt.', active: 'IDF-RP actif.', disconnected: 'Connexion au plugin interrompue. Nouvelle tentative…',
    game: 'ETS2', map: 'Carte', resources: 'Données', pending: 'à vérifier', compatible: 'compatible',
    unsupported: 'incompatible', supported: 'reconnue', loaded: 'chargées', loading: 'chargement', download: 'Téléchargement'
  };
  const en = {
    checking: 'Checking for updates…', downloading: 'Downloading the update…', verifying: 'Verifying downloaded files…',
    restart: 'Update downloaded. It will be installed when the game closes.',
    incompatible: 'An update compatible with this game version is required.',
    update_failed: 'Update not installed: file verification failed.',
    offline: 'Update check unavailable. Keeping the installed version.',
    map_pending: 'Plugin up to date. The map will be checked when the career loads.',
    map_unsupported: 'This map has no compatible IDF-RP data.', resources_pending: 'Loading IDF-RP data and interface…',
    resources_failed: 'IDF-RP interface unavailable. Retrying.', game_pending: 'Plugin up to date. Checking game compatibility…',
    runtime_failed: 'IDF-RP encountered an error. Check the game log.',
    ready: 'IDF-RP ready.', active: 'IDF-RP active.', disconnected: 'Connection to the plugin lost. Retrying…',
    game: 'ETS2', map: 'Map', resources: 'Data', pending: 'pending', compatible: 'compatible',
    unsupported: 'incompatible', supported: 'recognised', loaded: 'loaded', loading: 'loading', download: 'Download'
  };
  function present(s) {
    if (!s || s.protocol !== 1 || !Object.hasOwn(fr, s.phase)) return null;
    const t = /^fr(?:$|[-_])/i.test(s.language || 'fr') ? fr : en;
    const progress = s.phase === 'downloading' && Number.isFinite(s.progress) ? Math.max(0, Math.min(100, s.progress)) : null;
    return { message: t[s.phase === 'ready' && s.active ? 'active' : s.phase],
      tone: ['pending', 'warning', 'error', 'success'].includes(s.tone) ? s.tone : 'pending', progress,
      version: typeof s.pluginVersion === 'string' ? s.pluginVersion.slice(0, 64) : '', download: t.download,
      detail: `${t.game} : ${s.game === 'ready' ? t.compatible : s.game === 'update_required' ? t.unsupported : t.pending} · ${t.map} : ${t[s.map] || t.pending} · ${t.resources} : ${s.resources === 'ready' ? t.loaded : t.loading}`,
      // Downloads/errors remain visible; successful startup is a notification,
      // not a permanent HUD. Reappears when its meaningful status changes.
      lifetime: s.phase === 'ready' ? 8000 : ['map_pending', 'offline'].includes(s.phase) ? 15000 : Infinity,
      key: `${s.phase}:${!!s.active}:${s.pluginVersion || ''}:${s.game}:${s.map}:${s.resources}` };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { present }; return; }
  const el = id => document.getElementById(id);
  let lastKey = '', since = performance.now(), lastPaint = '', visible = null, failures = 0, stopped = false;
  function host(message) { try { root.chrome?.webview?.postMessage('idf:notification:' + message); } catch (_) {} }
  function render(state) {
    const p = present(state); if (!p) throw Error('notification state');
    document.documentElement.lang = /^fr(?:$|[-_])/i.test(state.language || 'fr') ? 'fr' : 'en';
    if (p.key !== lastKey) { since = performance.now(); lastKey = p.key; }
    const show = performance.now() - since < p.lifetime;
    if (show !== visible) { visible = show; host(show ? 'show' : 'hide'); }
    const paint = JSON.stringify(p);
    if (paint === lastPaint) return;
    lastPaint = paint;
    el('notice').dataset.tone = p.tone;
    el('message').textContent = p.message; el('detail').textContent = p.detail; el('version').textContent = p.version;
    el('symbolPath').setAttribute('d', p.tone === 'success' ? 'M10 18l5 5 11-12' : 'M18 9v11m0 5v1');
    el('meterRow').hidden = p.progress === null;
    el('fill').style.width = (p.progress ?? 0) + '%'; el('percent').textContent = (p.progress ?? 0) + ' %';
    el('meter').setAttribute('aria-valuenow', String(p.progress ?? 0)); el('meter').setAttribute('aria-label', p.download);
    host('changed');
  }
  async function poll() {
    let delay = 1000;
    try {
      const response = await fetch('/api/startup-notification', { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw Error('status');
      const state = await response.json(); render(state); failures = 0;
      if (state.phase === 'downloading') delay = 250;
    } catch (_) {
      if (++failures >= 2) render({ protocol: 1, phase: 'disconnected', tone: 'warning', language: document.documentElement.lang });
      delay = 2000;
    }
    if (!stopped) setTimeout(poll, delay);
  }
  root.addEventListener('pagehide', () => { stopped = true; host('hide'); });
  host('show'); poll();
})(typeof window === 'undefined' ? globalThis : window);
