<template>
  <router-view v-slot="{ Component }">
      <component :key="$route.fullPath" :is="Component" />
  </router-view>
</template>
<script setup lang="ts">
import { useAnimatedFavicon } from "./composables/useAnimatedFavicon";
// The texture has no browser tab: avoid favicon requests on every heartbeat.
if (location.pathname.includes('/editor')) useAnimatedFavicon();
</script>
