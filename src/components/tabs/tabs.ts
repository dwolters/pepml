import {defineAsyncComponent} from 'vue';
export default [
    {name: 'Model', component: defineAsyncComponent(() => import('./model-tab.vue'))},
    {name: 'Entities', component: defineAsyncComponent(() => import('./entity-tab.vue'))},
    {name: 'Portfolio', component: defineAsyncComponent(() => import('./portfolio-tab.vue'))},
    {name: 'Properties', component: defineAsyncComponent(() => import('./properties-tab.vue')), events:['selection']}
    // Add new tabs here.
]