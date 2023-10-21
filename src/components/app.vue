<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Item } from '@mirohq/websdk-types';
import Components from './tabs/tabs';
let selection = ref<Item[]>([]);
let tabs = ref(Components.map(c => c.name));
let selectedTab = ref(tabs.value[0]);
if(window.location.hash) {
  let hash = window.location.hash.substring(1);
  if(tabs.value.includes(hash))
  selectTab(hash);
}

function selectTab(tab: string) {
  selectedTab.value = tab;
}

function passProps(tab: string) {
  let ret: {selection?: Item[]} = {}
  let comp = Components.find(c => c.name == tab);
  if(comp?.events?.includes('selection'))
    ret.selection = selection.value;
  return ret;
}

onMounted(() => {
  miro.board.ui.on('selection:update', async (event) => {
    if (event.items.length) {
      selection.value = event.items;
    }
    else
      selection.value = [];
  });
});
</script>

<template>
  <div class="tabs">
    <div class="tabs-header-list">
      <div v-for="tab in tabs" tabindex="0" :class="['tab', selectedTab == tab ? 'tab-active' : '']"
        @click="selectTab(tab)">
        <div class="tab-text">{{ tab }}</div>
      </div>
    </div>
  </div>
  <template v-for="tab in tabs">
    <component :is="tab" v-if="selectedTab == tab" v-bind="passProps(tab)"></component>
  </template>
</template>

<style>
.tabs {
  margin-bottom:8px;
}
</style>
