<script setup lang="ts">
import {computed,shallowRef,onMounted,onUnmounted,nextTick} from 'vue';
import ScreenHeader from './components/ScreenHeader.vue';
import StopList from './components/MainPanel/StopList.vue';
import CurrentStop from './components/MainPanel/CurrentStop.vue';
import DataUnavailable from './components/MainPanel/DataUnavailable.vue';
import NoData from './components/SidePanel/NoData.vue';
import {Mode} from './types';import {setGameTime} from './composables/useClock';
const snapshot=shallowRef<any>({powered:false,state:null});
const data=computed(()=>snapshot.value.state||{});
const names=computed(()=>Array.isArray(data.value.audioStopNames)?data.value.audioStopNames.slice(0,512).map(String):[]);
const valid=computed(()=>!!data.value.lineNumber&&names.value.length>0&&!data.value.routeCompleted&&!data.value.lumiplan?.finished);
const direction=computed(()=>names.value.at(-1)||data.value.routeName||'');
const line=computed(()=>({id:String(data.value.selectedLineUid||data.value.lineNumber||''),name:String(data.value.lineNumber||''),color:snapshot.value.color||'#009b7a',textColor:snapshot.value.textColor||'#ffffff',mode:/^N\d/.test(data.value.lineNumber)?Mode.NOCTILIEN:Mode.BUS}));
const journey=computed(()=>data.value.lumiplan||{index:0,inStation:false});
const index=computed(()=>Math.min(Math.max(0,Number(journey.value.index)||0),Math.max(0,names.value.length-1)));
const stops=computed(()=>names.value.map((name:string,i:number)=>({stop:{id:String(i),name,isAccessible:true,hasGapWhenSteppingOff:false,connectedLines:[]},timeOfArrival:'',timeOfDeparture:'',isTerminus:i===names.value.length-1,isFirstStop:i===0,isStopSkipped:false})).slice(index.value));
const atStop=computed(()=>journey.value.inStation===true&&!journey.value.finished);
let last=0,timer:any;
onMounted(()=>{const api={ready:true,revision:0,update:async(value:any)=>{
 if(!value||typeof value!=='object')return false;last=performance.now();snapshot.value=value;setGameTime(Number(value.state?.clockNowMs)||0);await nextTick();api.revision++;return true;
 }};(window as any).IDFLumiplan=api;timer=setInterval(()=>{if(snapshot.value.powered&&performance.now()-last>6000){snapshot.value={powered:false,state:null};api.revision++;}},1000);});
onUnmounted(()=>{clearInterval(timer);delete (window as any).IDFLumiplan;});
</script>
<template><div class="canvas"><div v-if="snapshot.powered" class="screen" :class="{'no-data-available':!valid}">
<ScreenHeader :line="line" :direction="valid?direction:''" :is-limited-service="false" :is-wheel-chair-accessible="true" :serves-airport="false" :is-at-stop="atStop" />
<main v-if="valid"><StopList :stops="stops" :primary-color="line.color" :text-color="line.textColor"/><Transition name="stop"><CurrentStop v-if="atStop&&stops[0]" class="current" :stop-with-time="stops[0]" :line-id="line.id"/></Transition></main>
<main v-else class="error"><DataUnavailable/><NoData/></main></div></div></template>
<style>
html,body,#app{margin:0!important;width:100%;height:100%;overflow:hidden;background:#000!important;min-width:0!important;max-width:none!important;padding:0!important}
/* Original DDS: 2048 x 1024. Its useful rectangle is (0, 0, 2048, 578).
   Native CSS pixels, no scale/zoom: the remaining texture rows stay black. */
.canvas{position:absolute;left:0;top:0;width:2048px;height:578px;overflow:hidden;container-type:inline-size;background:#000}
.screen{height:100%;width:100%;display:grid;grid-template-rows:120px 1fr;container-type:inline-size;font-size:3cqw;position:relative;overflow:hidden}
.screen>main{position:relative;overflow:hidden;background:var(--ratp-beige)}.screen>main.error{display:grid;grid-template-columns:65% 35%}.current{position:absolute;inset:0;width:100%;height:100%}
.stops-list{width:100%!important}.stop-enter-active,.stop-leave-active{transition:transform .6s}.stop-enter-from,.stop-leave-to{transform:translateY(100%)}
</style>
