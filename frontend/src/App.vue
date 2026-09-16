<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="app-brand">
        <span class="app-brand__mark" aria-hidden="true">X</span>
        <div>
          <strong>XLSX Tools</strong>
          <span>组件与数据示例</span>
        </div>
      </div>
      <ExampleMenu :items="exampleRoutes" />
    </aside>

    <main class="app-content">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import ExampleMenu from './components/ExampleMenu.vue';
import { exampleRoutes } from './router';

defineOptions({ name: 'App' });
</script>
