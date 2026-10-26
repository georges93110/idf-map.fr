(function(root){
 'use strict';
 const number=value=>String(value??'').trim().toUpperCase();
 const numbered=value=>/^[A-Z]{0,3}\d+[A-Z]?$/.test(number(value));
 const colour=(value,fallback)=>{
  let c=String(value||'');if(/^#[0-9a-f]{3}$/i.test(c))c='#'+[...c.slice(1)].map(v=>v+v).join('');
  return /^#[0-9a-f]{6}$/i.test(c)?c:fallback;
 };
 function catalogue(entries){
  const byLine=new Map();
  for(const entry of Array.isArray(entries)?entries:[]){
   if(!entry||entry.badge===false||!numbered(entry.line)||number(entry.line)==='0')continue;
   const line=number(entry.line);if(byLine.has(line))continue;
   const night=/^N\d+$/i.test(line);
   byLine.set(line,{line,badge:true,...(entry.hideGirouetteAgoraAnim===true?{hideGirouetteAgoraAnim:true}:{}),...(Array.isArray(entry.hiddenVariants)?{hiddenVariants:entry.hiddenVariants}:{}),background:night?'#080080':colour(entry.background,'#000000'),foreground:night?'#ffffff':colour(entry.foreground,'#ffffff'),stripe:colour(entry.stripe,night?colour(entry.background,'#080080'):'')});
  }
  return [{line:'0',badge:false,partial:false,background:'#000000',foreground:'#ffffff',stripe:''},...[...byLine.values()].sort((a,b)=>a.line.localeCompare(b.line,'fr',{numeric:true,sensitivity:'base'})).flatMap(entry=>[false,true].map(partial=>{const {hiddenVariants,...state}=entry;return {...state,partial,...(entry.hideGirouetteAgoraAnim===true||hiddenVariants?.includes(partial?'partial':'full')?{hideGirouetteAgoraAnim:true}:{})};}))];
 }
 function steps(from,to,entries){
  from=from||{line:'0',badge:false};
  const index=catalogue(entries),key=s=>s.badge===false||!number(s.line)||number(s.line)==='0'?'0:false':number(s.line)+':'+(s.partial===true),a=index.findIndex(s=>key(s)===key(from)),b=index.findIndex(s=>key(s)===key(to));
  if(a<0||b<0||a===b)return [to];
  const result=[],direction=b>a?1:-1;
  for(let i=a+direction;i!==b;i+=direction)if(!index[i].hideGirouetteAgoraAnim)result.push(index[i]);
  // The selected service is always reachable, even when hidden in transit.
  // Keep hidden prints in the catalogue so direction/reversal still work.
  // The chosen badge keeps any explicit colour override from the editor/route.
  result.push(to);return result;
 }
 const api={numbered,catalogue,steps};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.IDFAgoraBadgeIndex=api;
})(typeof window==='object'?window:globalThis);
