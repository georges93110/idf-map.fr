(function(){
 'use strict';
 const policyUrl=new URL('../rendering/html-fps.json',document.currentScript.src);
 let configured=24,override=null,next=0;
 const valid=value=>Number.isInteger(value)&&value>=1&&value<=60;
 function reset(){next=0;}
 const api={
  get fps(){return override??configured;},
  set(value){if(value!==null&&!valid(value))return false;if(override!==value){override=value;reset();}return true;},
  due(now=performance.now()){
   const interval=1000/api.fps;
   if(!next){next=now+interval;return true;}
   if(now+.01<next)return false;
   // Keep the target cadence between monitor refreshes (e.g. 24 on 60 Hz),
   // without accumulating a burst of frames after a suspended browser tab.
   next+=(Math.floor(Math.max(0,now-next)/interval)+1)*interval;return true;
  },reset
 };
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 api.ready=fetch(policyUrl,{cache:'no-store',signal:controller.signal}).then(async response=>{
  if(!response.ok)throw Error('FPS policy unavailable');
  const policy=await response.json(),row=policy?.html?.girouette;
  if(policy.schema!==1||!row||!['low','medium','high'].every(k=>valid(row[k]))||row.low>row.medium||row.medium>row.high)throw Error('Invalid FPS policy');
  configured=row.high;reset();return true;
 }).catch(()=>false).finally(()=>clearTimeout(timer));
 window.IDFGirouetteFrameRate=api;
})();
