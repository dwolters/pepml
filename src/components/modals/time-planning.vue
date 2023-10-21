<script setup>
import { ref, onMounted  } from 'vue';
import { Temporal } from '@js-temporal/polyfill';
import { createRectangle } from '../../modules/miro-board-utils';
import { TYPE_KEY, TRACK_NUMBER_KEY, DAY_NUMBER_KEY } from '../../modules/constants'
import MappingProcessor from '../../classes/Mapping';

let startTimes = ref([]);
let endTimes = ref([]);
let showTimespan = ref(false);
let granularities = ref([15, 30, 45, 60]);
let granularity = ref(30);
let startTime = ref("09:00");
let endTime = ref("17:00");
let tracks = ref(1);
let days = ref(1);
let name = ref('');
function calculateTimes() {
  let midnight = Temporal.PlainTime.from("00:00");
  startTimes.value.push(midnight.toString({ smallestUnit: "minute" }));
  let current = midnight;
  do {
    current = current.add({ minutes: granularity.value });
    startTimes.value.push(current.toString({ smallestUnit: "minute" }));
    endTimes.value.push(current.toString({ smallestUnit: "minute" }));
  } while (!midnight.equals(current));
  startTimes.value.pop();
  if (!startTimes.value.includes(startTime.value)) {
    startTime.value = undefined;
  }
  if (!endTimes.value.includes(endTime.value)) {
    endTime.value = undefined;
  }
}

async function generateDayPlanning(name, days, tracks, granularity, startTimeStr, endTimeStr, showTimespan) {
  let dropCoordinates = await miro.board.getAppData('timePlanningDrop');
  if(!dropCoordinates && !Array.isArray(dropCoordinates)) {
    miro.board.ui.closeModal();
    throw new Error("Drop Coordinates not set.");
  }
  let [compositeX, compositeY] = dropCoordinates;
  let startTime = Temporal.PlainTime.from(startTimeStr);
  let endTime = Temporal.PlainTime.from(endTimeStr);
  let times = [];
  let current = startTime;
  let TIME_WIDTH = 50;
  if (showTimespan)
    TIME_WIDTH *= 2;
  const TRACK_WIDTH = 100;
  const HEADING_HEIGHT = 70;
  const LINE_HEIGHT = 20;
  do {
    times.push(current);
    current = current.add({ minutes: granularity });
  } while (!endTime.equals(current))

  const compositeWidth = TIME_WIDTH + days * tracks * TRACK_WIDTH;
  const compositeHeight = HEADING_HEIGHT + times.length * LINE_HEIGHT + LINE_HEIGHT * (tracks > 1 ? 2 : 1);
  await createRectangle(compositeX, compositeY, compositeWidth, compositeHeight, name, { textAlignVertical: 'top' });
  //Waiting is necessary to ensure proper z-placement.
  const timeYOffset = HEADING_HEIGHT + LINE_HEIGHT * (tracks > 1 ? 2 : 1);
  for (let timeIndex = 0; timeIndex < times.length; timeIndex++) {
    let x = compositeX - compositeWidth / 2 + TIME_WIDTH / 2;
    let y = compositeY - compositeHeight / 2 + timeYOffset + LINE_HEIGHT * timeIndex + LINE_HEIGHT / 2;
    let label = times[timeIndex].toString({ smallestUnit: "minute" });
    if (showTimespan) {
      label += ' - ';
      if (timeIndex + 1 < times.length)
        label += times[timeIndex + 1].toString({ smallestUnit: "minute" });
      else
        label += endTime.toString({ smallestUnit: "minute" });
    }
    createRectangle(x, y, TIME_WIDTH, LINE_HEIGHT, label);
  }
  for (let day = 0; day < days; day++) {
    const baseX = compositeX - compositeWidth / 2 + TIME_WIDTH + day * tracks * TRACK_WIDTH;
    const baseY = compositeY - compositeHeight / 2 + HEADING_HEIGHT + LINE_HEIGHT / 2;
    let x = baseX + tracks * TRACK_WIDTH / 2; // Width of day element is different if multiple tracks are used
    let y = baseY; // Height is for all elements the same. Hence, it is part of baseY;
    let dayItem = await createRectangle(x, y, TRACK_WIDTH * tracks, LINE_HEIGHT, 'Day ' + (day + 1));
    dayItem.setMetadata(TYPE_KEY, 'day');
    dayItem.setMetadata(DAY_NUMBER_KEY, day+1);
    for (let track = 0; track < tracks; track++) {
      x = baseX + track * TRACK_WIDTH + TRACK_WIDTH / 2;
      y = baseY + LINE_HEIGHT;
      if (tracks > 1) {
        let trackItem = await createRectangle(x, y, TRACK_WIDTH, LINE_HEIGHT, 'Track ' + (track + 1));
        trackItem.setMetadata(TYPE_KEY, 'track');
        trackItem.setMetadata(TRACK_NUMBER_KEY, track+1);
        y += LINE_HEIGHT;
      }
      // for (let timeIndex = 0; timeIndex < times.length; timeIndex++) {
      //   createRectangle(x, y, TRACK_WIDTH, LINE_HEIGHT);
      //   y += LINE_HEIGHT;
      // }
    }
  }
  let placeholderId = await miro.board.getAppData('dayPlanningPlaceholder');
  let item = await miro.board.getById(placeholderId);
  miro.board.remove(item);
  miro.board.ui.closeModal();  
}

onMounted(() => {
  calculateTimes();
});
</script>

<template>
  <h1>Day Planning</h1>
  <div class="grid form-group-small">
    <div class="cs1 ce12">
      <label for="componentName">Name</label>
      <input v-model="name" class="input input-small" id="componentName" placeholder="Name" />
    </div>

    <div class="cs1 ce6">
      <label for="startTime">Start Time</label>
      <select id="startTime" class="select select-small" v-model="startTime">
        <option v-for="time in startTimes" :value="time" :key="time">
          {{ time }}
        </option>
      </select>
    </div>

    <div class="cs7 ce12">
      <label for="endTime">End Time</label>
      <select id="endTime" class="select select-small" v-model="endTime">
        <option v-for="time in endTimes" :value="time" :key="time">
          {{ time }}
        </option>
      </select>
    </div>


    <div class="cs1 ce6">
      <label for="granularity">Granularity</label>
      <select id="granularity" class="select select-small" v-model="granularity" @change="calculateTimes">
        <option v-for="minutes in granularities" :value="minutes" :key="minutes">
          {{ minutes }}
        </option>
      </select>
    </div>

    <div class="cs7 ce12">
      <label class="toggle">
        <input type="checkbox" class="input input-small" tabindex="0" v-model="showTimespan" />
        <span>Show Timespan</span>
      </label>
    </div>

    <div class="cs1 ce6">
      <label for="days" class="form-label">Number of days:</label>
      <input type="number" class="input input-small" v-model="days" min="1" max="10" id="days" />
    </div>
    <div class="cs7 ce12">
      <label for="tracks" class="form-label">Number of tracks:</label>
      <input v-model="tracks" type="number" class="input input-small" min="1" max="4" id="tracks" />
    </div>
    <div class="cs1 ce12">
      <button @click="generateDayPlanning(name, days, tracks, granularity, startTime, endTime, showTimespan)"
        class="button button-primary button-small">
        Generate
      </button>
    </div>
  </div>
</template>

<style scoped>
input {
  width: 100%;
}
</style>
