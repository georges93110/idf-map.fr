(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.IDFAdminConvoy = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clean = (v, n = 256) => typeof v === 'string' ? v.replace(/[\x00-\x1f\x7f]/g, '').slice(0, n) : '';
  const number = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
  class Model {
    constructor(now = Date.now) { this.now = now; this.sessions = new Map(); this.players = new Map(); this.at = 0; this.received = false; }
    receive(doc) {
      if (!doc || doc.type !== 'admin.convoys' || doc.version !== 1 || !Array.isArray(doc.sessions) || doc.sessions.length > 1024) return false;
      const sessions = new Map(), players = new Map();
      for (const source of doc.sessions) {
        if (!source || typeof source.id !== 'string' || typeof source.epoch !== 'string' || !Array.isArray(source.players) || source.players.length > 128) return false;
        const id = clean(source.id, 128), epoch = clean(source.epoch, 128), key = id + '/' + epoch;
        if (!id || !epoch || sessions.has(key)) return false;
        const session = { id, epoch, key, label: 'Convoi ' + id.slice(-12), players: [] };
        for (const raw of source.players) {
          if (!raw || !/^7656119\d{10}$/.test(raw.player)) continue;
          const p = { player: raw.player, session, clientId: number(raw.clientId, 0, 65534), synchronized: raw.synchronized === true, bus: raw.bus !== false && raw.vehicle !== 'none',
            ageMs: number(raw.ageMs, 0, 86400000), vehicle: clean(raw.vehicle), generation: clean(raw.generation),
            line: clean(raw.line, 64), service: clean(raw.service, 64), stop: clean(raw.stop, 128),
            occupancy: number(raw.occupancy, 0, 500), powered: raw.powered === true, stopRequested: raw.stopRequested === true,
            speed: number(raw.speed, -150, 150), visiblePeers: number(raw.visiblePeers, 0, 128), stages: {} };
          if (raw.pose && ['x','y','z','yaw'].every(k => number(raw.pose[k], -16000000, 16000000) !== null)) p.pose = raw.pose;
          p.doors = Array.isArray(raw.doors) ? raw.doors.slice(0, 3).filter(v => number(v, 0, 1) !== null) : [];
          for (const k of ['waiting','approach','enter','toPlace','resident','toExit','leave','outside','returning']) p.stages[k] = number(raw.stages?.[k], 0, 256) || 0;
          const eventLabels = {door_open:'Ouverture de porte',door_close:'Fermeture de porte',stop_request:'Arrêt demandé',destination_announcement:'Annonce destination',bus_audio:'Annonce sonore'};
          if (raw.lastEvent && eventLabels[raw.lastEvent.kind] && number(raw.lastEvent.at,0,Number.MAX_SAFE_INTEGER) !== null)
            p.lastEvent = {label:eventLabels[raw.lastEvent.kind] + (raw.lastEvent.action === 'stop' ? ' · fin' : ''), at:raw.lastEvent.at};
          if (raw.sign) p.sign = { line: clean(raw.sign.line, 24), destination: clean(raw.sign.destination), powered: raw.sign.powered === true,
            layout: raw.sign.layout === 'agora' ? 'Agora' : 'Standard' };
          // An identity observed in two sessions is ambiguous. Never assign its
          // legacy telemetry to an arbitrary server.
          players.set(p.player, players.has(p.player) ? null : p); session.players.push(p);
        }
        sessions.set(key, session);
      }
      this.sessions = sessions; this.players = players; this.at = this.now(); this.received = true; return true;
    }
    fresh() { return this.received && this.now() - this.at < 7000; }
    get(player) { return this.fresh() ? this.players.get(player.steamid || player.player) || null : null; }
    key(player) { return this.get(player)?.session.key || (player.inServer === false || player.group === 'solo' ? 'solo' : 'unknown'); }
    label(player) { return this.get(player)?.session.label || (this.key(player) === 'solo' ? 'Solo' : 'Convoi non identifié'); }
    matches(player, server, search = '') {
      if (server && server !== 'all' && server !== this.key(player)) return false;
      const p = this.get(player), q = search.trim().toLocaleLowerCase('fr');
      return !q || [player.label, player.name, player.steamid, player.vehicleName, player.busLine?.lineNumber, player.busLine?.lineName,
        p?.line, p?.service, p?.sign?.destination, p?.stop, this.label(player)].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(q);
    }
    values(player) {
      const p = this.get(player);
      return { convoyServer: this.label(player), convoyId: p?.session.id || '—', convoySync: p ? (p.synchronized ? 'Actif' : 'En attente du véhicule') : 'Indisponible',
        convoyLine: p ? [p.line && 'Ligne ' + p.line, p.service && 'Service ' + p.service].filter(Boolean).join(' · ') || 'Hors service' : '—',
        convoySign: p?.sign ? (p.sign.powered ? [p.sign.line, p.sign.destination].filter(Boolean).join(' → ') || 'Vide' : 'Éteinte') : '—',
        convoyDoors: p?.synchronized ? p.doors.map((v,i) => (i ? 'Arrière ' + i : 'Avant') + ' : ' + (v <= .01 ? 'fermée' : v >= .99 ? 'ouverte' : Math.round(v * 100) + '%')).join(' · ') : '—',
        convoyPower: p?.synchronized ? (p.powered ? 'Allumé' : 'Éteint') : '—',
        convoyOccupancy: p?.synchronized ? String(p.occupancy ?? '—') : '—',
        convoyExchange: p?.synchronized ? 'Montée ' + (p.stages.approach + p.stages.enter + p.stages.toPlace) + ' · Descente ' + (p.stages.toExit + p.stages.leave) : '—',
        convoyStop: p?.synchronized ? [p.stop, p.stopRequested ? 'Arrêt demandé' : ''].filter(Boolean).join(' · ') || '—' : '—',
        convoyPeers: p?.synchronized ? String(p.visiblePeers ?? '—') : '—',
        convoyEvent: p?.lastEvent ? p.lastEvent.label + ' · il y a ' + Math.max(0,Math.floor((this.now()-p.lastEvent.at)/1000)) + ' s' : '—' };
    }
    disconnect() { this.at = 0; this.received = false; this.sessions.clear(); this.players.clear(); }
  }
  return { Model };
});
