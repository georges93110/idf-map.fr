import {computed,ref} from 'vue';
const gameTime=ref(0);export function setGameTime(ms:number, minutes?:number){
 if(typeof minutes==='number'&&Number.isFinite(minutes)&&minutes>=0){
  // Telemetry is a wall-clock count, not a UTC timestamp. Avoid any timezone/DST conversion.
  const m=Math.floor(minutes)%1440,d=new Date();d.setHours(Math.floor(m/60),m%60,0,0);gameTime.value=d.getTime();
 }else if(Number.isFinite(ms))gameTime.value=ms;
}
export function useClock(){return {now:computed(()=>new Date(gameTime.value)),offset:ref(0),setCurrentTime:(d:Date)=>setGameTime(d.getTime()),resetCurrentTime:()=>setGameTime(0)};}
