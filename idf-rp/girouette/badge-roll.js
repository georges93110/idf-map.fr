(function(root){
 'use strict';
 const duration=2500;
 const key=s=>!s||s.badge===false||!String(s.line||'').trim()||String(s.line).trim()==='0'?'0':String(s.line).trim().toUpperCase()+':'+(s.partial===true);
 function advance(track,now){
  while(track.roll&&now-track.roll.start>=duration){
   const start=track.roll.start+duration,from=track.image,fromState=track.imageState;
   if(track.queue.length){const next=track.queue.shift();track.image=next.image;track.imageState=next.state;track.roll={from,fromState,start,direction:next.direction};}
   else track.roll=null;
  }
 }
 function finish(track){
  if(track.queue.length){const last=track.queue.at(-1);track.image=last.image;track.imageState=last.state;}
  track.queue=[];track.roll=null;
 }
 function load(track,state,entries,now,render,index,{reload=false}={}){
  advance(track,now);
  const list=index.catalogue(entries),position=s=>list.findIndex(e=>key(e)===key(s));
  const target=position(state),previous=position(track.badgeState);
  const indexed=target>=0&&previous>=0&&key(state)!==key(track.badgeState);
  const make=(from,to)=>{
   const a=position(from),b=position(to),direction=a>=0&&b>=0&&a!==b?Math.sign(b-a):1;
   return index.steps(from,to,entries).map((step,i,all)=>({state:step,image:render(step,i===all.length-1),direction}));
  };
  let frames=[],retarget=false;
  if(indexed){
   // Discard the obsolete destination, never the current physical position.
   // Reversing swaps the same two prints and complements the elapsed time;
   // the visible pixels and the linear speed stay continuous.
   track.queue=[];retarget=true;
   if(track.roll){
    const a=position(track.roll.fromState),b=position(track.imageState);
    if(a>=0&&b>=0&&a!==b){
     const direction=Math.sign(b-a),t=Math.max(0,Math.min(1,(now-track.roll.start)/duration));
     if(Math.sign(target-(a+(b-a)*t))!==direction){
      const image=track.image,stateBefore=track.imageState;
      track.image=track.roll.from;track.imageState=track.roll.fromState;
      track.roll={from:image,fromState:stateBefore,start:now-(1-t)*duration,direction:-track.roll.direction};
     }
    }
    frames.push({image:track.image,state:track.imageState,direction:track.roll.direction});
    if(key(track.imageState)!==key(state))track.queue=make(track.imageState,state);
    frames.push(...track.queue);
   }else frames=make(track.imageState,state);
  }else frames=make(track.badgeState,state);
  if(!track.roll){
   const next=frames.shift();
   if(next){track.roll={from:track.image,fromState:track.imageState,start:now,direction:next.direction};track.image=next.image;track.imageState=next.state;track.queue.push(...frames);frames=[next,...frames];}
  }else if(!indexed)track.queue.push(...frames);
  track.badgeState=state;
  return {frames,retarget};
 }
 function paint(ctx,track,now){
  advance(track,now);ctx.clearRect(0,0,211,128);
  // Opaque backing keeps fractional edge filtering independent of the selected print below.
  ctx.fillStyle='#a6a396';ctx.fillRect(0,0,211,128);
  if(!track.roll){ctx.drawImage(track.image,0,0);return;}
  const direction=track.roll.direction||1,offset=direction*128*Math.max(0,Math.min(1,(now-track.roll.start)/duration));
  ctx.save();ctx.beginPath();ctx.rect(0,0,211,128);ctx.clip();
  // Keep physical top/bottom draw order unchanged during reversal, including
  // the antialiased seam at fractional-pixel offsets.
  if(direction===1){ctx.drawImage(track.image,0,offset-128);ctx.drawImage(track.roll.from,0,offset);}
  else{ctx.drawImage(track.roll.from,0,offset);ctx.drawImage(track.image,0,offset+128);}
  ctx.restore();
 }
 const api={duration,key,advance,finish,load,paint};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.IDFAgoraBadgeRoll=api;
})(typeof window==='object'?window:globalThis);
