import { ref, computed, onUnmounted, type ComputedRef } from 'vue';

const globalTick = ref<number>(0);
let activeListeners = 0;
let timerId: ReturnType<typeof setInterval> | null = null;
let startId: ReturnType<typeof setTimeout> | null = null;

const DURATION_MS = 5000;

const updateTick = () => {
    globalTick.value = Math.floor(Date.now() / DURATION_MS);
};

const startGlobalTimer = () => {
    if (timerId || startId){
     return; 
    }
    updateTick(); 

    const msUntilNextTick = DURATION_MS - (Date.now() % DURATION_MS);

    startId = setTimeout(() => {
        startId = null;
        updateTick();
        timerId = setInterval(updateTick, DURATION_MS);
    }, msUntilNextTick);
};

const stopGlobalTimer = () => {
    if (startId) clearTimeout(startId);
    startId = null;
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
};

/**
 * Hook pour récupérer un texte qui change toutes les 5 secondes,
 * synchronisé globalement avec tous les autres textes.
 */
export function useRotatedText(textList: string[] | readonly string[]): ComputedRef<string> {
    updateTick();
    if (activeListeners === 0) {
        startGlobalTimer();
    }
    activeListeners++;

    onUnmounted(() => {
        activeListeners--;
        if (activeListeners === 0) {
            stopGlobalTimer();
        }
    });

    return computed(() => {
        if (!textList || textList.length === 0) return '';
        const index = globalTick.value % textList.length;
        return textList[index];
    });
}