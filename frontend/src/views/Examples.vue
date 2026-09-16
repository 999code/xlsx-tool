<template>
  <div class="examples-overview">
    <h1>示例页面</h1>
    <el-tabs v-model="activeExample" class="examples-overview__tabs">
      <el-tab-pane
        v-for="item in examplePages"
        :key="item.path"
        :name="item.meta.example"
        :label="`${item.meta.example} · ${item.meta.title}`"
        lazy
      >
        <component :is="item.component" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { examplePages } from '../examples';

const activeExample = ref(examplePages[0].meta.example);
</script>

<style scoped>
.examples-overview h1 {
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 600;
}

.examples-overview__tabs :deep(.el-tabs__content) {
  padding-top: 24px;
}
</style>
