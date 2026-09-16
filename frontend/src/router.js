import { createRouter, createWebHashHistory } from 'vue-router';

import { examplePages } from './examples';
import Examples from './views/Examples.vue';
import XlsxManager from './views/XlsxManager.vue';

export const exampleRoutes = [
  { path: '/examples', component: Examples, meta: { title: '示例页面' } },
  { path: '/xlsx-manager', component: XlsxManager, meta: { title: 'XLSX 数据管理' } },
];

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/examples' },
    ...exampleRoutes,
    ...examplePages,
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});
