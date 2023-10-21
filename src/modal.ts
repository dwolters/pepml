import { createApp } from 'vue';
// Add imports for new modals here
import TGG from './components/modals/tgg.vue';
import TimePlanning from './components/modals/time-planning.vue';
let names: Record<string, any> = {
    TGG,
    TimePlanning
    // Add newly imported components here
}
let vueApp;
console.log(names);
console.log(window.location.hash)
if(window.location.hash.length <= 1)
    throw new Error('No name for modal provided');
let name = window.location.hash.substring(1);
let component = names[name];
if(!component)
    throw new Error('No component found for the given name');
vueApp = createApp(component);
vueApp.mount('#root');
