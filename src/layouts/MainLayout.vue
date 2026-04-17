<script setup lang="ts">
import AppHeader from '@/components/AppHeader.vue'
import AppSidebar from '@/components/AppSidebar.vue'
</script>

<template>
  <div class="layout">
    <aside class="sidebar-wrap">
      <AppSidebar />
    </aside>
    <div class="main-column">
      <AppHeader />
      <section class="content">
        <router-view />
      </section>
    </div>
  </div>
</template>

<style scoped>
.layout {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

.main-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100vh;
  overflow: hidden;
}

.sidebar-wrap {
  width: 90px;
  flex-shrink: 0;
  background: #2563eb;
  position: sticky;
  top: 0;
  height: 100vh;
}

.content {
  flex: 1;
  position: relative;
  background: #f1f5f9;
  overflow-y: auto;
}
</style>
