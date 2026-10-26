'use strict';
const crypto=require('node:crypto'),P=require('./protocol.cjs');
const {validSegment,serviceGap,routeReference}=require('./service-match.cjs');
const key=v=>typeof v==='string'&&/^[a-f0-9]{16,64}$/.test(v);
function servicePlan(v){
 if(v===null)return null;
 if(!v||!key(v.service)||!key(v.run)||!P.integer(v.index,0,127)||!P.integer(v.last,v.index,127)||
  !P.integer(v.demand,0,500)||!P.integer(v.capacity,1,500)||!P.integer(v.onboard,0,500)||!P.integer(v.alight,0,v.onboard)||!P.pose(v.pose)||
  typeof v.atStop!=='boolean'||!Array.isArray(v.requested)||!Array.isArray(v.boarded)||
  [v.requested,v.boarded].some(a=>a.length>500||new Set(a).size!==a.length||a.some(x=>!P.integer(x,0,499)))||
  (v.pool!==undefined&&!key(v.pool))||
  (v.segment!==undefined&&!validSegment(v.segment,v.index,v.last,t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t))))return undefined;
 return {...v,...routeReference(v),requested:v.requested.slice(),boarded:v.boarded.slice()};
}
function nearVisit(pool,id,plan){
 const visit=pool.visits.get(id);
 return pool.members.get(id)===plan.run&&visit&&visit.service===plan.service&&Math.abs(plan.index-visit.index)<3;
}
// Relay-owned tokens. A native actor cannot cross the door until the relay
// commits its token; reassignment can only affect uncommitted waiting people.
class ServiceStops{
 constructor({now=Date.now,compatible=()=>true}={}){this.now=now;this.compatible=compatible;this.actors=new Map();this.pools=new Map();this.serial=0;}
 update(id,plan,pose,doors,speed){
  const old=this.actors.get(id);
  if(!plan){if(old)this.remove(id);return;}
  const same=old&&old.plan.run===plan.run&&old.plan.index===plan.index&&old.plan.service===plan.service;
  const actor={id,plan,pose,doors,speed,at:this.now(),arrived:same?old.arrived:0,pool:same?old.pool:null};
  if(plan.atStop&&P.distance(pose,plan.pose)<=40&&Math.abs(pose.y-plan.pose.y)<=4&&Math.abs(speed)<.2&&doors.some(x=>x>=.5))actor.arrived=actor.arrived||this.now()+1;
  else actor.arrived=0;
  this.actors.set(id,actor);
  if(actor.pool&&[...this.actors.values()].some(a=>a!==actor&&a.pool===actor.pool&&!this.compatible(id,a.id))){
   for(const p of actor.pool.people)if(p.owner===id&&!p.committed)p.owner=null;
   actor.pool.members.delete(id);actor.pool.visits.delete(id);actor.pool=null;
  }
  // Exact services or aligned previous/current/next stops, less than three
  // stops apart, may attach to an
  // existing stop population. A finished visit is retained for the followers.
  if(!actor.pool){
   for(const pool of this.pools.values())if(serviceGap(pool.route,plan)===0&&P.distance(pool.pose,plan.pose)<=5&&
    ![...this.actors.values()].some(a=>a.id!==id&&a.pool===pool&&!this.compatible(id,a.id))&&
    [...pool.members.keys()].some(member=>{const a=this.actors.get(member);return a&&(a.id===id||this.compatible(id,a.id))&&nearVisit(pool,member,a.plan);})){
     actor.pool=pool;break;
   }
   if(!actor.pool){
    if(this.pools.size>=2048)this.prune();if(this.pools.size>=2048){this.actors.delete(id);return;}
    const pool={id:crypto.randomBytes(16).toString('hex'),service:plan.service,index:plan.index,route:routeReference(plan),pose:plan.pose,
     total:plan.index===plan.last?0:plan.demand,members:new Map(),visits:new Map(),people:[],created:++this.serial,at:this.now(),revision:0};
    pool.people=Array.from({length:pool.total},(_,id)=>({id,owner:null,committed:false,boarded:false}));
    this.pools.set(pool.id,pool);actor.pool=pool;
   }
  }
  actor.pool.members.set(id,plan.run);actor.pool.visits.set(id,routeReference(plan));actor.pool.at=this.now();
  this.mergeNearby(actor);
  const pool=actor.pool;
  if(plan.pool===pool.id){
   for(const id of plan.boarded){const p=pool.people[id];if(p?.owner===actor.id&&p.ownerRun===actor.plan.run&&p.committed)p.boarded=true;}
   for(const id of plan.requested){const p=pool.people[id];if(p?.owner===actor.id&&p.ownerRun===actor.plan.run&&!p.committed&&p.canBoard&&actor.arrived){p.committed=true;}}
  }
 }
 mergeNearby(actor){
  for(const other of this.actors.values()){
   if(other===actor||!this.compatible(actor.id,other.id)||serviceGap(other.plan,actor.plan)!==0||other.pool===actor.pool)continue;
   const a=actor.pool,b=other.pool;if(!a||!b||P.distance(a.pose,b.pose)>5)continue;
   // A later independently generated waiting group is replaced, never its
   // onboard passengers. Account for both sets of already committed riders.
   const keep=a.created<=b.created?a:b,drop=keep===a?b:a;
   const committed=drop.people.filter(p=>p.committed).length;
   let debit=committed;for(const p of keep.people)if(debit&&!p.committed){p.committed=p.boarded=true;p.owner=null;--debit;}
   for(const x of this.actors.values())if(x.pool===drop)x.pool=keep;
   for(const [id,run] of drop.members){keep.members.set(id,run);keep.visits.set(id,drop.visits.get(id));}
   this.pools.delete(drop.id);
  }
 }
 allocate(pool){
  const actors=[...this.actors.values()].filter(a=>a.pool===pool&&this.now()-a.at<2500);
  const eligible=actors.filter(a=>a.arrived).sort((a,b)=>a.arrived-b.arrived||a.id.localeCompare(b.id));
  const display=actors.slice().sort((a,b)=>P.distance(a.pose,pool.pose)-P.distance(b.pose,pool.pose)||a.id.localeCompare(b.id))[0];
  const capacity=new Map(eligible.map(a=>[a.id,Math.max(0,a.plan.capacity-a.plan.onboard+a.plan.alight-
   pool.people.filter(p=>p.owner===a.id&&p.ownerRun===a.plan.run&&p.committed&&!p.boarded).length)]));
  for(const p of pool.people){
   if(p.committed)continue;
   const a=eligible.find(a=>capacity.get(a.id)>0);
   p.owner=a?.id||display?.id||null;p.ownerRun=(a||display)?.plan.run;p.canBoard=!!a;
   if(a)capacity.set(a.id,capacity.get(a.id)-1);
  }
  ++pool.revision;
  return actors.map(a=>{
   const owned=pool.people.filter(p=>p.owner===a.id&&p.ownerRun===a.plan.run&&!p.boarded);
   const waiting=pool.people.filter(p=>!p.committed);
   const covered=owned.length===0&&waiting.every(p=>p.owner!==a.id&&p.canBoard);
   const near=[...this.actors.values()].some(b=>b!==a&&this.compatible(a.id,b.id)&&(serviceGap(b.plan,a.plan)<3||nearVisit(pool,b.id,b.plan))&&this.now()-b.at<2500);
   return {id:a.id,type:'convoy.service.result',version:1,run:a.plan.run,index:a.plan.index,pool:pool.id,revision:pool.revision,
    shared:near,covered:a.plan.index!==a.plan.last&&covered,total:pool.total,
    slots:owned.map(p=>[p.id,p.committed?1:0,p.canBoard||p.committed?1:0])};
  });
 }
 results(){const out=[];for(const pool of this.pools.values())out.push(...this.allocate(pool));return out;}
 remove(id){this.actors.delete(id);for(const pool of this.pools.values())for(const p of pool.people)if(p.owner===id&&!p.committed)p.owner=null;}
 prune(){for(const [id,p]of this.pools)if(this.now()-p.at>120000&&!Array.from(this.actors.values()).some(a=>a.pool===p||nearVisit(p,a.id,a.plan)))this.pools.delete(id);}
 tick(){for(const [id,a]of this.actors)if(this.now()-a.at>=2500)this.remove(id);this.prune();}
}
module.exports={ServiceStops,servicePlan};
