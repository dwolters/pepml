import {createApp} from 'vue';
import Components from './components/tabs/tabs'
import App from './components/app.vue';
let vueApp = createApp(App);
Components.forEach(component => vueApp.component(component.name, component.component));

vueApp.mount('#root');
