import Example1 from './views/Example1.vue';
import Example2 from './views/Example2.vue';
import Example3 from './views/Example3.vue';
import Example4 from './views/Example4.vue';
import Example5 from './views/Example5.vue';
import Example6 from './views/Example6.vue';

export const examplePages = [
    { path: '/example1', component: Example1, meta: { title: '基础表单', example: 'Example1' } },
    { path: '/example2', component: Example2, meta: { title: '事件与插槽', example: 'Example2' } },
    { path: '/example3', component: Example3, meta: { title: '表单布局', example: 'Example3' } },
    { path: '/example4', component: Example4, meta: { title: '动态表单', example: 'Example4' } },
    { path: '/example5', component: Example5, meta: { title: '详情组件', example: 'Example5' } },
    { path: '/example6', component: Example6, meta: { title: '表格示例', example: 'Example6' } },
];
