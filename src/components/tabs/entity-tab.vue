<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import icons from '../../modules/icons'
import { DropEvent } from '@mirohq/websdk-types';

let drop = async ({ x, y, target }: DropEvent) => {
  if (target instanceof HTMLImageElement && target.title != 'time-planning') {
    let image = await miro.board.createImage({ x, y, url: target.src, height:50, title: target.title });
    let text = await miro.board.createText({
      content: `<p>${readableName(target.title)}</p>`,
      style: {
        textAlign: 'center',
      }, x, y
    });
    text.y = image.y + image.height / 2 + text.height / 2;
    await text.sync();
  } else if (target instanceof HTMLImageElement && target.title == 'time-planning') {
    miro.board.setAppData('timePlanningDrop',[x,y]);    
    miro.board.ui.openModal({
        url: 'modal.html#TimePlanning',
        width: 300,
        height:400
    });
    let image = await miro.board.createImage({ x, y, url: target.src, height:50, title: target.title });
    miro.board.setAppData('timePlanningPlaceholder',image.id);
    miro.board.ui.closePanel();
  }
}

function readableName(name: string) {
  let parts = name.split('-');
  parts = parts.map(part => part[0].toUpperCase() + part.substring(1))
  return parts.join(' ');
}

onMounted(() => {
  miro.board.ui.on('drop', drop);
});
onUnmounted(() => {
  miro.board.ui.off('drop', drop);
  console.log('unmounted')
})
</script>

<template>
  <h2>Find Entity</h2>
    <input class="input" type="text" placeholder="Entity Name" id="example-1"/>
  <h2>New Entity</h2>
  <div class="entity" v-for="(src, name, index) in icons">
    <img :src=src :title=name :key=index draggable="false" class="miro-draggable draggable-item">
    <span>{{ readableName(name) }}</span>
  </div>
</template>

<style scoped>
.entity {
  text-align: center;
  width:33%;
  height:100px;
  float:left;
  padding:5px;
  flex-direction: column; 
  display: flex;
  justify-content: space-between;
}

.entity span {
  width:100%;
  text-align:center;
}

input {
  width: 100%;
}
img {
  display: block;
  max-width:50px;
  max-height:50px;
  width: auto;
  height: auto;
  margin:auto;
}
</style>
