<template>
  <div>
    <span class="hours">{{ time.split(':')[0] }}</span>
    <span class="divider" :style="{opacity: blink ? 1 : .3}">:</span>
    <span class="minutes">{{ time.split(':')[1] }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useClock } from "../../composables/useClock";

import { useDiscreteBlink } from "../../composables/useDiscreteBlink";
const blink = useDiscreteBlink(1000);
const { now } = useClock();

const time = computed(() =>
  new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    // clockNowMs already encodes the game clock in the local browser zone.
    // Applying Paris a second time introduces an offset on non-Paris PCs.
  }).format(now.value)
);
</script>
