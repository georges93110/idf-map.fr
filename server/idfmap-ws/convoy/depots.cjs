"use strict";
// Atomic room-local round robin. A disconnected player cannot erase the cursor
// or an in-flight teleport lease; all clients share this one allocator.
class DepotReservations {
 constructor({now=Date.now}={}){this.now=now;this.rooms=new Map();}
 reserve(room,player,request,key,positions,occupied){
  const now=this.now();for(const [k,v]of this.rooms)if(now-v.at>86400000)this.rooms.delete(k);
  if(!this.rooms.has(room)){if(this.rooms.size>=256)return {ok:false,reason:'busy'};this.rooms.set(room,{at:now,depots:new Map(),requests:new Map()});}
  const r=this.rooms.get(room);r.at=now;
  const duplicate=r.requests.get(player+':'+request);if(duplicate)return duplicate;
  if(!r.depots.has(key)){if(r.depots.size>=256)return {ok:false,reason:'busy'};r.depots.set(key,{next:0,leases:new Map()});}
  const d=r.depots.get(key);for(const [i,until]of d.leases)if(until<=now)d.leases.delete(i);
  let result={ok:false,reason:'occupied'};
  for(let offset=0;offset<positions.length;offset++){
   const index=(d.next+offset)%positions.length,p=positions[index];
   if(d.leases.has(index)||occupied.some(q=>Math.abs(q.y-p[1])<4&&Math.hypot(q.x-p[0],q.z-p[2])<3.2))continue;
   d.next=(index+1)%positions.length;d.leases.set(index,now+30000);result={ok:true,index};break;
  }
  if(r.requests.size>=512)r.requests.delete(r.requests.keys().next().value);r.requests.set(player+':'+request,result);return result;
 }
}
module.exports={DepotReservations};
