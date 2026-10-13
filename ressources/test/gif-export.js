/* Local GIF89a encoder for the girouette test editor. No upload or dependency. */
(function(root){
 'use strict';
 class GirouetteGIF {
  constructor(width,height,samples){
   this.width=width;this.height=height;this.parts=[];this.lookup=new Int16Array(32768).fill(-1);
   const counts=new Uint32Array(32768),sums=new Float64Array(32768*3);
   for(const rgba of samples)for(let i=0;i<rgba.length;i+=4){const r=rgba[i],g=rgba[i+1],b=rgba[i+2],k=(r>>3)<<10|(g>>3)<<5|(b>>3);counts[k]++;sums[k*3]+=r;sums[k*3+1]+=g;sums[k*3+2]+=b;}
   const colors=Array.from(counts.keys()).filter(k=>counts[k]).sort((a,b)=>counts[b]-counts[a]).slice(0,256);
   this.palette=new Uint8Array(768);colors.forEach((k,i)=>{for(let c=0;c<3;c++)this.palette[i*3+c]=Math.round(sums[k*3+c]/counts[k]);});
   this.colors=colors.length||1;
   this.parts.push(Uint8Array.from([71,73,70,56,57,97,width&255,width>>8,height&255,height>>8,247,0,0]),this.palette,
    Uint8Array.from([33,255,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0]));
  }
  indexed(rgba){
   const out=new Uint8Array(this.width*this.height);
   for(let i=0,j=0;i<rgba.length;i+=4,j++){
    const r=rgba[i],g=rgba[i+1],b=rgba[i+2],key=(r>>3)<<10|(g>>3)<<5|(b>>3);
    let best=this.lookup[key];if(best<0){let min=Infinity;for(let n=0;n<this.colors;n++){const p=n*3,d=(r-this.palette[p])**2+(g-this.palette[p+1])**2+(b-this.palette[p+2])**2;if(d<min){min=d;best=n;}}this.lookup[key]=best;}out[j]=best;
   }return out;
  }
  frame(rgba,centiseconds){
   const pixels=this.indexed(rgba),bytes=[];let bits=0,acc=0,size=9,next=258,dict=new Map();
   const emit=code=>{acc|=code<<bits;bits+=size;while(bits>=8){bytes.push(acc&255);acc>>>=8;bits-=8;}};
   emit(256);let prefix=pixels[0];
   for(let i=1;i<pixels.length;i++){const value=pixels[i],key=prefix*256+value,found=dict.get(key);
    if(found!==undefined){prefix=found;continue;}
    emit(prefix);
    // Encoder dictionary runs one entry ahead of the decoder.
    if(next>=(1<<size)&&size<12)size++;
    if(next<4096)dict.set(key,next++);else{emit(256);dict=new Map();next=258;size=9;}
    prefix=value;
   }
   emit(prefix);if(next>=(1<<size)&&size<12)size++;emit(257);if(bits)bytes.push(acc&255);
   const delay=Math.max(2,Math.min(65535,Math.round(centiseconds)));
   this.parts.push(Uint8Array.from([33,249,4,4,delay&255,delay>>8,0,0,44,0,0,0,0,this.width&255,this.width>>8,this.height&255,this.height>>8,0,8]));
   for(let i=0;i<bytes.length;i+=255){const chunk=bytes.slice(i,i+255);this.parts.push(Uint8Array.from([chunk.length,...chunk]));}this.parts.push(Uint8Array.of(0));
  }
  finish(){return new Blob([...this.parts,Uint8Array.of(59)],{type:'image/gif'});}
 }
 root.GirouetteGIF=GirouetteGIF;
})(globalThis);

