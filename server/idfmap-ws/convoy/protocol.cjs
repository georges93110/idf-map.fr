'use strict';
// Wire data only. Never accepts engine pointers, executable code, asset paths or URLs.
const VERSION = 1;
const LIMITS = Object.freeze({ peers: 128, passengers: 256, bytes: 196608, enterM: 200, leaveM: 230, fullM: 80, audioM: 60, leaseMs: 6000 });
const key = v => typeof v === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(v);
const steam = v => typeof v === 'string' && /^7656119\d{10}$/.test(v);
// Opaque connection identities are assigned by the relay, not inferred from
// an account or chosen from predictable native client numbers.
const nativePlayer = v => typeof v === 'string' && /^native:[0-9a-f]{32}$/.test(v);
const player = v => steam(v) || nativePlayer(v);
const integer = (v, lo, hi) => Number.isSafeInteger(v) && v >= lo && v <= hi;
const finite = (v, bound) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= bound;
const text = (v, max = 256) => typeof v === 'string' && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const colour = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
function pose(v, local = false) {
  if (!object(v) || !finite(v.x, local ? 30 : 16000000) || !finite(v.y, local ? 10 : 100000) || !finite(v.z, local ? 40 : 16000000) || !finite(v.yaw, 360)) return null;
  return { x: v.x, y: v.y, z: v.z, yaw: v.yaw };
}
function hello(v) {
  if (!object(v) || v.type !== 'convoy.hello' || v.version !== VERSION || !key(v.room) || !player(v.player) || !key(v.instance) ||
      !integer(v.clientId, 0, 65534) || typeof v.map !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,63}\.mbd$/.test(v.map) || !key(v.assets) || !Array.isArray(v.roster) || v.roster.length > LIMITS.peers) return null;
  const seen = new Set(), ids = new Set();
  const roster = [];
  for (const p of v.roster) {
    if (!object(p) || (p.player !== undefined && !player(p.player)) || !integer(p.clientId, 0, 65534) ||
        (p.player !== undefined && seen.has(p.player)) || ids.has(p.clientId)) return null;
    if (p.player !== undefined) seen.add(p.player);
    ids.add(p.clientId); roster.push(p.player === undefined ? { clientId: p.clientId } : { player: p.player, clientId: p.clientId });
  }
  if (!roster.some(p => p.player === v.player && p.clientId === v.clientId)) return null;
  return { type: v.type, version: VERSION, room: v.room, player: v.player, instance: v.instance, clientId: v.clientId, map: v.map, assets: v.assets, roster };
}
// Native membership and connection identity are separate checks. The relay
// assigns new opaque identities; a native slot alone never authorizes a peer.
function member(roster, player, clientId) {
  return roster.some(p => p.clientId === clientId && (p.player === undefined || p.player === player));
}
function sign(v) {
  if (v === null) return null;
  if (!object(v) || !text(v.line, 24) || !text(v.destination) || !colour(v.foreground) || !colour(v.background) || !colour(v.directionColour) ||
      typeof v.partial !== 'boolean' || typeof v.powered !== 'boolean' || !['standard', 'agora'].includes(v.layout)) throw Error('invalid sign');
  return { line: v.line, destination: v.destination, foreground: v.foreground, background: v.background, directionColour: v.directionColour,
    partial: v.partial, powered: v.powered, layout: v.layout, badge: v.badge !== false, stripe: colour(v.stripe) ? v.stripe : '' };
}
function linePresentation(v) {
 if(!object(v))return undefined;
 const image=value=>{
  if(value===false)return false;
  if(!text(value,2048)||!value)return undefined;
  try { const url=new URL(value);return /^https?:$/.test(url.protocol)?url.href:undefined; } catch { return undefined; }
 };
 return {badge:v.badge!==false,badgeImage:image(v.badgeImage)||false,prefixImage:image(v.prefixImage)};
}
function lumiplan(v) {
 if(v===undefined||v===null)return null;
 if(!object(v)||typeof v.powered!=='boolean'||!finite(v.gameTimeMinutes,1e10)||!colour(v.color)||!colour(v.textColor))throw Error('invalid Lumiplan');
 let state=null;
 if(v.state!==null){const s=v.state,j=s?.lumiplan;
  if(!object(s)||!text(s.lineNumber,24)||!text(s.selectedLineUid,64)||!text(s.routeName,256)||!Array.isArray(s.audioStopNames)||s.audioStopNames.length>512||!s.audioStopNames.every(n=>text(n,160))||!object(j)||!integer(j.index,0,512)||typeof j.inStation!=='boolean'||typeof j.finished!=='boolean')throw Error('invalid Lumiplan journey');
  state={linePresentation:linePresentation(s.linePresentation),lineNumber:s.lineNumber,selectedLineUid:s.selectedLineUid,routeName:s.routeName,audioStopNames:s.audioStopNames.slice(),lumiplan:{index:j.index,inStation:j.inStation,finished:j.finished}};
 }
 return {powered:v.powered,gameTimeMinutes:v.gameTimeMinutes,color:v.color,textColor:v.textColor,state};
}
function passenger(v) {
  // Action replication carries no rendered pedestrian coordinates. The anchor
  // is the fixed stop/departure frame, never the sender's collision contact.
  if(object(v)&&v.actionSequence!==undefined){
    const anchor=pose(v.anchor);
    if(!key(v.id)||!integer(v.model,0,103)||!integer(v.seat,-1,255)||!integer(v.door,0,2)||
       !['waiting','approach','enter','toPlace','resident','toExit','leave','outside','returning'].includes(v.stage)||
       !integer(v.actionSequence,1,0xffffffff)||!integer(v.progress,0,4)||!integer(v.queue,0,63)||
       (v.progressPermille!==undefined&&(!integer(v.progressPermille,0,1000)||Math.floor(v.progressPermille/250)!==v.progress))||
       !integer(v.animation,1,3)||!integer(v.standingVariant,0,6)||!integer(v.seatedVariant,0,2)||
       !finite(v.walkSpeed,4)||v.walkSpeed<0||!anchor||v.pose!==undefined||v.space!==undefined||
       (['toPlace','resident','toExit','leave'].includes(v.stage)&&v.seat<0))return null;
    return {id:v.id,model:v.model,seat:v.seat,door:v.door,stage:v.stage,actionSequence:v.actionSequence,
      progress:v.progress,queue:v.queue,animation:v.animation,standingVariant:v.standingVariant,
      seatedVariant:v.seatedVariant,walkSpeed:v.walkSpeed,anchor,
      ...(v.progressPermille!==undefined?{progressPermille:v.progressPermille}:{})};
  }
  if (!object(v) || !key(v.id) || !integer(v.model, 0, 255) || !integer(v.seat, -1, 255) || !integer(v.door, 0, 2) ||
      !['waiting', 'approach', 'enter', 'toPlace', 'resident', 'toExit', 'leave', 'outside', 'returning'].includes(v.stage) ||
      !['bus', 'world'].includes(v.space) || !integer(v.animation, 0, 255) || !finite(v.phase, 86400)) return null;
  const at = pose(v.pose, v.space === 'bus'); if (!at) return null;
  if (v.variant !== undefined && !integer(v.variant, 0, 255)) return null;
  if (v.walkSpeed !== undefined && (!finite(v.walkSpeed, 4) || v.walkSpeed < 0)) return null;
  return { id: v.id, model: v.model, seat: v.seat, door: v.door, stage: v.stage, space: v.space, pose: at, animation: v.animation, phase: v.phase,
    variant: v.variant ?? 0, walkSpeed: v.walkSpeed ?? .85 };
}
function moverStops(v) {
 if(v===undefined)return [];
 if(!Array.isArray(v)||v.length>128)return null;
 const points=[];
 for(const p of v){
  if(!object(p)||!finite(p.x,8000000)||!finite(p.y,100000)||!finite(p.z,8000000))return null;
  points.push({x:p.x,y:p.y,z:p.z});
 }
 return points;
}
function snapshot(v) {
  if (!object(v) || v.type !== 'convoy.state' || v.version !== VERSION || !key(v.epoch) || !integer(v.sequence, 1, Number.MAX_SAFE_INTEGER) ||
      !key(v.vehicle) || !key(v.profile) || !key(v.generation) || !finite(v.speed, 150) || typeof v.powered !== 'boolean' ||
      typeof v.stopRequested !== 'boolean' || !Array.isArray(v.doors) || v.doors.length < 1 || v.doors.length > 3 ||
      !v.doors.every(n => finite(n, 1) && n >= 0) || !Array.isArray(v.passengers) || v.passengers.length > LIMITS.passengers ||
      !integer(v.occupancy, 0, 500) || !text(v.line, 64) || !text(v.service, 64) || !text(v.stop, 128)) return null;
  const at = pose(v.pose); if (!at) return null;
  if(v.spectatorClient!==undefined&&!integer(v.spectatorClient,0,65534))return null;
  if(v.passengerMode!==undefined&&v.passengerMode!=='actions-v1')return null;
  const zones=moverStops(v.moverStops);if(!zones)return null;
  const actionMode=v.passengerMode==='actions-v1';
  const seen = new Set(), seats = new Set(), passengers = [];
  for (const item of v.passengers) {
    const p = passenger(item); if (!p || seen.has(p.id)||actionMode!==(p.actionSequence!==undefined)) return null;
    // Only seated residents own a seat; walking people may keep their target seat.
    if ((actionMode||p.space === 'bus') && p.stage === 'resident' && p.seat >= 0) { if (seats.has(p.seat)) return null; seats.add(p.seat); }
    seen.add(p.id); passengers.push(p);
  }
  let destination,screen; try { destination = sign(v.sign); screen=lumiplan(v.lumiplan); } catch { return null; }
  return { type: v.type, version: VERSION, epoch: v.epoch, sequence: v.sequence, vehicle: v.vehicle, profile: v.profile, generation: v.generation,
    pose: at, speed: v.speed, powered: v.powered, doors: v.doors.slice(), stopRequested: v.stopRequested, occupancy: v.occupancy,
    line: v.line, service: v.service, stop: v.stop, sign: destination, lumiplan:screen, passengers,
    ...(v.moverStops!==undefined?{moverStops:zones}:{}),
    ...(v.spectatorClient!==undefined?{spectatorClient:v.spectatorClient}:{}),
    ...(actionMode?{passengerMode:'actions-v1'}:{}) };
}
function busAudio(v) {
  if (!object(v) || !key(v.voice) || !['play','stop'].includes(v.action)) return null;
  if (v.action === 'stop') return { action: 'stop', voice: v.voice };
  if (typeof v.clip !== 'string' || !/^[a-f0-9]{32}$/.test(v.clip) ||
      !['routeAnnouncement','shortcutAnnouncement','announcement','validator'].includes(v.category) ||
      !finite(v.offset,180) || v.offset < 0 || !finite(v.duration,180) || v.duration <= v.offset ||
      !finite(v.level,1) || v.level < 0) return null;
  return {action:'play',voice:v.voice,clip:v.clip,category:v.category,offset:v.offset,duration:v.duration,level:v.level};
}
function event(v) {
  if (!object(v) || v.type !== 'convoy.event' || v.version !== VERSION || !key(v.epoch) || !key(v.generation) || !key(v.id) ||
      !integer(v.sequence, 1, Number.MAX_SAFE_INTEGER) || !['door_open', 'door_close', 'stop_request', 'destination_announcement', 'bus_audio'].includes(v.kind) ||
      !integer(v.door, 0, 2) || !integer(v.sound, 0, 65535)) return null;
  const result = { type: v.type, version: VERSION, epoch: v.epoch, generation: v.generation, id: v.id, sequence: v.sequence, kind: v.kind, door: v.door, sound: v.sound };
  if (v.kind === 'bus_audio') { const a = busAudio(v.audio); if (!a) return null; result.audio = a; }
  return result;
}
function decode(data) {
  try { if (typeof data !== 'string' && !Buffer.isBuffer(data)) return null; if (Buffer.byteLength(data) > LIMITS.bytes) return null;
    const v = JSON.parse(data); return object(v) ? v : null; } catch { return null; }
}
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); }
module.exports = { VERSION, LIMITS, key, steam, player, nativePlayer, integer, pose, hello, member, sign, lumiplan, passenger, snapshot, moverStops, busAudio, event, decode, distance };
