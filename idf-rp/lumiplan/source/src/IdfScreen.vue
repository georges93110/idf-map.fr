<script setup lang="ts">
import {computed,shallowRef,onMounted,onUnmounted,nextTick} from 'vue';
import ScreenHeader from './components/ScreenHeader.vue';
import StopList from './components/MainPanel/StopList.vue';
import CurrentStop from './components/MainPanel/CurrentStop.vue';
import DataUnavailable from './components/MainPanel/DataUnavailable.vue';
import NoData from './components/SidePanel/NoData.vue';
import {Mode} from './types';import {idfLinePresentation} from './idf-line';import {setGameTime} from './composables/useClock';
const snapshot=shallowRef<any>({powered:false,state:null});
const data=computed(()=>snapshot.value.state||{});
const names=computed(()=>Array.isArray(data.value.audioStopNames)?data.value.audioStopNames.slice(0,512).map(String):[]);
const valid=computed(()=>!!data.value.lineNumber&&names.value.length>0&&!data.value.lumiplan?.finished);
const direction=computed(()=>names.value.at(-1)||data.value.routeName||'');
const line=computed(()=>({id:String(data.value.selectedLineUid||data.value.lineNumber||''),name:String(data.value.lineNumber||''),color:snapshot.value.color||'#009b7a',textColor:snapshot.value.textColor||'#ffffff',mode:/^N\d/.test(data.value.lineNumber)?Mode.NOCTILIEN:Mode.BUS,...idfLinePresentation(data.value)}));
const journey=computed(()=>data.value.lumiplan||{index:0,inStation:false});
const index=computed(()=>Math.min(Math.max(0,Number(journey.value.index)||0),Math.max(0,names.value.length-1)));
const stops=computed(()=>names.value.slice(index.value,index.value+6).map((name:string,j:number)=>({stop:{id:String(index.value+j),name,isAccessible:true,hasGapWhenSteppingOff:false,connectedLines:[]},timeOfArrival:'',timeOfDeparture:'',isTerminus:index.value+j===names.value.length-1,isFirstStop:index.value+j===0,isStopSkipped:false})));
const atStop=computed(()=>journey.value.inStation===true&&!journey.value.finished);
const viewEpoch=shallowRef(0);
let last=0,timer:any,visualKey="";
onMounted(()=>{const api={ready:true,revision:0,resumeVersion:1,resume:async(value:any)=>{
 // Replace the visual subtree so interrupted Vue leave/move transitions and
 // their timers cannot replay old stops after an offscreen interval.
 if(!value||typeof value!=='object')return false;
 viewEpoch.value++;await api.update(value);
 for(const animation of document.querySelector('.canvas')?.getAnimations({subtree:true})||[]){
  if(Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))animation.finish();
 }
 await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
 return true;
},update:async(value:any)=>{
 if(!value||typeof value!=='object')return false;last=performance.now();const state=value.state;const visual={powered:value.powered===true,color:value.color,textColor:value.textColor,state:state?{lineNumber:state.lineNumber,selectedLineUid:state.selectedLineUid,routeName:state.routeName,linePresentation:state.linePresentation,audioStopNames:state.audioStopNames,lumiplan:state.lumiplan}:null};const key=JSON.stringify(visual);if(key!==visualKey){snapshot.value=visual;visualKey=key;}setGameTime(Number(value.state?.clockNowMs)||0, value.gameTimeMinutes);await nextTick();api.revision++;return true;
 }};(window as any).IDFLumiplan=api;timer=setInterval(()=>{if(snapshot.value.powered&&performance.now()-last>6000){snapshot.value={powered:false,state:null};visualKey="";api.revision++;}},1000);});
onUnmounted(()=>{clearInterval(timer);delete (window as any).IDFLumiplan;});
</script>
<template><div class="canvas"><div v-if="snapshot.powered" :key="viewEpoch" class="screen" :class="{'no-data-available':!valid}">
<ScreenHeader :line="line" :direction="valid?direction:''" :is-limited-service="false" :is-wheel-chair-accessible="false" :serves-airport="false" :is-at-stop="atStop" />
<main v-if="valid"><StopList :stops="stops" :primary-color="line.color" :text-color="line.textColor"/><Transition name="stop"><CurrentStop v-if="atStop&&stops[0]" class="current" :stop-with-time="stops[0]" :line-id="line.id"/></Transition></main>
<main v-else class="error"><DataUnavailable/><NoData/></main></div></div></template>
<style>
html,body,#app{margin:0!important;width:100%;height:100%;overflow:hidden;background:#000!important;min-width:0!important;max-width:none!important;padding:0!important}
/* Original DDS: 2048 x 1024. Its useful rectangle is (0, 0, 2048, 578).
   Native CSS pixels, no scale/zoom: the remaining texture rows stay black. */
.canvas{position:absolute;left:0;top:0;width:2048px;height:578px;overflow:hidden;container-type:inline-size;background:#000}
.screen{height:100%;width:100%;display:grid;grid-template-rows:120px 1fr;container-type:inline-size;font-size:3cqw;position:relative;overflow:hidden}
.screen>main{position:relative;isolation:isolate;overflow:hidden;background:var(--ratp-beige)}.screen>main.error{display:grid;grid-template-columns:65% 35%}.current{position:absolute;inset:0;width:100%;height:100%;z-index:20}
.stops-list-container{isolation:isolate;z-index:0;position:relative}
.stops-list{width:100%!important}.stop-enter-active,.stop-leave-active{transition:transform .6s}.stop-enter-from,.stop-leave-to{transform:translateY(100%)}
</style>
