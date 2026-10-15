import { onScopeDispose, ref, watch, type WatchSource } from 'vue';

// A stepped CSS animation still keeps Chromium's compositor running at the
// monitor refresh rate. Change the two visible states only at their boundaries.
export function useDiscreteBlink(halfPeriod: number, enabled: WatchSource<boolean> = () => true) {
  const phase = ref(true);
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => { if (timer !== undefined) clearInterval(timer); timer = undefined; };
  watch(enabled, active => {
    stop(); phase.value = true;
    if (active) timer = setInterval(() => { phase.value = !phase.value; }, halfPeriod);
  }, { immediate: true });
  onScopeDispose(stop);
  return phase;
}
