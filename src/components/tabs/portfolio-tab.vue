<script setup lang="ts">
import { DropEvent } from '@mirohq/websdk-types';
import { type Ref, ref, onMounted, onUnmounted } from 'vue';

const searchQuery = ref('');
let searchResults: Ref<Array<{
  id: number
  name: string
  type: string
  description: string
}>> = ref([]);

const search = () => {
  // Simulate fetching data from the server
  // Replace this with actual fetch code
  const fakeServerData = [
    { id: 1, name: 'Visit HNF', type: 'Social Event', description: 'Visit of the largest computer museum. Up to 15 people can take part in a single guided tour.' },
    { id: 2, name: 'Escape Game', type: 'Social Event', description: 'Description for Item 2.' },
    { id: 2, name: 'Football Golf', type: 'Social Event', description: 'Description for Item 2.' },
    { id: 2, name: 'City Tour', type: 'Social Event', description: 'Description for Item 2.' }
    // Add more items here...
  ];

  searchResults.value = fakeServerData.filter(item =>
    item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
};
let drop = async ({ x, y, target }: DropEvent) => {
  if (target instanceof HTMLElement) {
    let shape = await miro.board.createShape({
      type: 'shape',
      shape: 'rectangle',
      content: '<p>Person</p>',
      style: {
        textAlign: 'center', // Default alignment: left
      }, x, y
    });
    await shape.sync();
  }
}

onMounted(() => {
  miro.board.ui.on('drop', drop);
});
onUnmounted(() => {
  miro.board.ui.off('drop', drop);
})
</script>
<template>
  <div>
    <div class="form-group">
      <h2>Search:</h2>
      <input class="input input-small searchbox" v-model="searchQuery" @keydown.enter="search" placeholder="Search">
    </div>
    <div v-if="searchResults.length > 0">
      <div v-for="result in searchResults" :key="result.id">
        <details draggable="false" class="miro-draggable draggable-item">
          <summary>
            <strong>{{ result.name }} ({{ result.type }})</strong>
          </summary>
          <div>{{ result.description }}</div>
        </details>
      </div>
    </div>
    <div v-else>No results found.</div>
  </div>
</template>
  

  
<style>
.searchbox {
  margin-top: 10px;
  margin-bottom: 10px;
}

h2 {
  margin-bottom: 0px;
}
</style>
  