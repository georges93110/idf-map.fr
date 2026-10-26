(function(){
 'use strict';
 // A flip-dot controller refreshes each column from top to bottom, then
 // advances right. Keep this clock independent of the browser/texture FPS.
 const width=813,height=128,columns=115,rows=16,duration=250;
 function surface(){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
 class DestinationScan{
  constructor(){this.image=surface();this.previous=surface();this.frame=surface();this.key=null;this.started=0;this.active=false;}
  update(source,key,now,{skip=false,background='#000000'}={}){
   if(key!==this.key){
    const c=this.previous.getContext('2d');
    if(this.key===null){c.fillStyle=background;c.fillRect(0,0,width,height);}
    else{const visible=this.sample(now);c.clearRect(0,0,width,height);c.drawImage(visible,0,0);}
    this.started=now;this.active=!skip&&(this.key!==null||!!key);this.key=key;
   }
   const c=this.image.getContext('2d');c.clearRect(0,0,width,height);c.drawImage(source,211,0,width,height,0,0,width,height);
   if(skip)this.finish();
  }
  sample(now){
   const progress=Math.min(1,Math.max(0,(now-this.started)/duration));
   if(!this.active||progress>=1){this.active=false;return this.image;}
   const c=this.frame.getContext('2d'),cursor=Math.floor(progress*columns*rows);
   const column=Math.floor(cursor/rows),row=cursor%rows;
   const x=Math.round(column*width/columns),next=Math.round((column+1)*width/columns),y=Math.round(row*height/rows);
   c.clearRect(0,0,width,height);c.drawImage(this.previous,0,0);
   // A hard dot-by-dot replacement: neither transparency nor text movement.
   if(x)c.drawImage(this.image,0,0,x,height,0,0,x,height);
   if(y)c.drawImage(this.image,x,0,next-x,y,x,0,next-x,y);
   return this.frame;
  }
  paint(target,now,advanced){const image=this.sample(now);target.drawImage(image,211,0);if(advanced)target.drawImage(image,1235,0);}
  finish(){this.active=false;}
  resume(elapsed){if(this.active)this.started+=Math.max(0,Number(elapsed)||0);}
 }
 window.IDFAgoraDestination={create:()=>new DestinationScan(),duration};
})();
