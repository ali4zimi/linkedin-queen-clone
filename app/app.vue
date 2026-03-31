<script setup lang="ts">
const isNavOpen = ref(false);
const route = useRoute();

watch(
  () => route.fullPath,
  () => {
    isNavOpen.value = false;
  },
);
</script>

<template>
  <NuxtRouteAnnouncer />
  <div class="app-shell">
    <div v-if="isNavOpen" class="nav-backdrop" @click="isNavOpen = false"></div>

    <header class="top-nav">
      <div class="top-nav-head">
        <h1 class="top-nav-brand">
          <span class="brand-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M24 6.25A3 3 0 1 0 19.74 9c-.47 1.38-1.53 3.79-3.24 3.79c-2.3 0-3-3.14-3.53-6.17a3 3 0 1 0-1.94 0c-.56 3.09-1.24 6.17-3.53 6.17c-1.71 0-2.77-2.41-3.24-3.79a3 3 0 1 0-2.13.15l1.63 9.8a1 1 0 0 0 1 .84h14.5a1 1 0 0 0 1-.84l1.63-9.8A3 3 0 0 0 24 6.25m-4.75 15H4.75a1 1 0 0 0 0 2h14.5a1 1 0 0 0 0-2"
              />
            </svg>
          </span>
          <span>Queens</span>
        </h1>
        <button
          class="burger-btn"
          type="button"
          :aria-expanded="isNavOpen"
          aria-controls="main-nav-menu"
          @click="isNavOpen = !isNavOpen"
        >
          <span class="burger-lines" aria-hidden="true"></span>
          <span class="sr-only">Toggle navigation menu</span>
        </button>
      </div>

      <nav
        id="main-nav-menu"
        class="nav-menu nav-sidebar"
        :class="{ 'nav-menu-open': isNavOpen }"
        @click.stop
      >
        <NuxtLink to="/">Play</NuxtLink>
        <NuxtLink to="/designer">Puzzle Designer</NuxtLink>
        <NuxtLink to="/about">About</NuxtLink>
      </nav>
    </header>
    <NuxtPage />
  </div>
</template>
