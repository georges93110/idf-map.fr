import {computed,ref} from 'vue';
const gameTime=ref(0);export function setGameTime(ms:number){if(Number.isFinite(ms))gameTime.value=ms;}
export function useClock(){return {now:computed(()=>new Date(gameTime.value)),offset:ref(0),setCurrentTime:(d:Date)=>setGameTime(d.getTime()),resetCurrentTime:()=>setGameTime(0)};}
