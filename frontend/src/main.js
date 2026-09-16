import { createApp } from 'vue';
import ElementPlus from 'element-plus';

import App from './App.vue';
import ScForm from './components/ScForm.vue';
import ScTable from './components/ScTable.vue';
import ScTemplate from './components/ScTemplate.vue';
import router from './router';

import 'element-plus/dist/index.css';
import './styles.css';

const app = createApp(App);

app.use(ElementPlus);
app.use(router);
app.component(ScForm.name, ScForm);
app.component(ScTable.name, ScTable);
app.component(ScTemplate.name, ScTemplate);
app.mount('#app');
