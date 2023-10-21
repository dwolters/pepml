<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Item } from '@mirohq/websdk-types';
import { CorrespondingNode, CorrespondingNodeProperty, getCorrespondingNode } from '../../modules/miro-neo-utils';
import * as neoUtils from '../../modules/neo-utils';
import * as TGGManager from '../../modules/tgg-manager';

let props = defineProps<{ selection: Item[] }>()

watch(() => props.selection, async (selection: Item[]) => {
  if (selection.length == 0) return;
  loading.value = true;
  await loadAllProperties(selection[0].id);
  await updateAvailableClasses();
  loading.value = false;
})

//let componentTypes = ref(['SequentialComposite', 'InstructorLedSession', 'GroupWork', 'SelfStudy']);
//let componentType = ref('');
//let representations = ref([]);

let entity = ref<CorrespondingNode>({
  "name": "",
  "id": 0,
  "types": [],
  "properties": []
});

let loading = ref(false);
let newPropertyName = ref('');
let newPropertyType = ref('string');
let newPropertyString = ref('');
let newPropertyNumber = ref(0);
let newPropertyBoolean = ref(true);

let ignoreProperties = ['_cr_', '_de_', '_tr_', '_ex_', 'ename'];

let availableClasses = ref<string[]>([]);
let typeArea = ref('');
let isTypeArea = ref(false);

async function getTargetMetamodel() {
  let tgg = await miro.board.getAppData('selectedTGG') as string;
  if (!tgg)
    return;
  let transformer = TGGManager.get(tgg);
  return transformer.targetMetamodel;
}

async function updateAvailableClasses() {
  let mm = await getTargetMetamodel();
  if (!mm) return;
  availableClasses.value = mm.getAllClasses(false).sort();
  if (!props.selection.length) return;
  let item = props.selection[0];
  let area = await item.getMetadata<string>('area');
  if (area) {
    typeArea.value = area;
    isTypeArea.value = true;
  } else {
    typeArea.value = '';
    isTypeArea.value = false;
  }
}

async function setTypeArea() {
  if (!props.selection.length) return;
  let item = props.selection[0];
  if (typeArea.value && isTypeArea.value) {
    item.setMetadata('area', typeArea.value)
    console.log('Type Area set to: ', typeArea.value);
  } else {
    item.setMetadata('area', undefined);
    console.log('Type Area unset');
  }
}

async function loadAllProperties(itemId: string) {
  let mm = await getTargetMetamodel();
  if (!mm)
    return;
  let node = await getCorrespondingNode(itemId);
  if (!node) return false;
  let lowestClass = mm.findMostSpecificClass(node.types);
  let attributes = mm.getAttributes(lowestClass);
  entity.value.name = node.name;
  entity.value.id = node.id;
  entity.value.properties = node.properties;

  attributes.forEach(({ name, type }) => {
    let property = entity.value.properties.find(p => p.name == name);
    if (property) {
      property.isPredefined = true;
    } else {
      entity.value.properties.push({ name, valueType: toJavaScriptType(type), value: getDefaultPropertyValue(type), isPredefined: true })
    }
  })
  entity.value.properties = entity.value.properties.filter(p => !ignoreProperties.includes(p.name) && p.name.indexOf('__created') != 0)
  return true;
}

function toJavaScriptType(type: string) {
  switch (type) {
    case 'string':
    case 'String':
    case 'EString':
      return 'string';
    case 'EFloat':
    case 'EDouble':
    case 'EInt':
    case 'number':
    case 'Number':
      return 'number';
    case 'EBoolean':
    case 'Boolean':
    case 'boolean':
      return 'boolean';
    default:
      throw new Error(`Unkown type: ${type}`)
  }
}

// function readableName(name: string) {
//   let parts = name.split('-');
//   parts = parts.map(part => part[0].toUpperCase() + part.substring(1))
//   return parts.join(' ');
// }

function getDefaultPropertyValue(type: string) {
  switch (type) {
    case 'boolean':
      return false;
    case 'number':
      return 0;
    default:
      return '';
  }
}

async function saveProperty(property: CorrespondingNodeProperty) {
  if (!['string', 'number', 'boolean'].includes(typeof property.value)) return false;
  console.log("auto-save", property);
  await neoUtils.addProperty(entity.value.id, property.name, property.value as string | number | boolean);
  return true;
}

async function deleteProperty(index: number) {
  let propertyName = entity.value.properties[index].name;
  await neoUtils.deleteProperty(entity.value.id, propertyName);
  await loadAllProperties(props.selection[0].id);
}

async function addProperty() {
  await neoUtils.addProperty(entity.value.id, newPropertyName.value, getNewPropertyValue());
  await loadAllProperties(props.selection[0].id);
  newPropertyName.value = '';
  newPropertyType.value = 'string';
  newPropertyBoolean.value = true;
  newPropertyNumber.value = 0;
  newPropertyString.value = '';
}

function getNewPropertyValue() {
  switch (newPropertyType.value) {
    case 'boolean':
      return newPropertyBoolean.value;
    case 'number':
      return newPropertyNumber.value;
    default:
      return newPropertyString.value;
  }
}

function checkNewProperty() {
  let name = newPropertyName.value;
  let type = newPropertyType.value;
  if (!name || !isValidPropertyName() || !type) return false;
  return true;
}

function isValidPropertyName() {
  let name = newPropertyName.value;
  if (name.length && entity.value.properties.find(p => p.name == name)) return false;
  return true;
}

function readableName(s: string): string {
  s = s[0].toUpperCase() + s.substring(1);
  return s.replace('Is', '').replaceAll(/([a-z])([A-Z])/g, '$1 $2');
}

onMounted(() => {
  updateAvailableClasses();
})

</script>

<template>
  <p v-if="selection.length == 0">No item select</p>
  <p v-else-if="loading">Loading properties</p>
  <div v-else class="grid form-group-small">
    <details class="cs1 ce12">
      <summary>Representations</summary>
      <ul>
        <li>...</li>
      </ul>
    </details>
    <details class="cs1 ce12" open>
      <summary class="cs1 ce12">Manual Typing</summary>
      <label class="checkbox">
        <input type="checkbox" v-model="isTypeArea" @change="setTypeArea">
        <span>Is Type Area?</span>
      </label>      
      <select class="select select-small" v-model="typeArea" @change="setTypeArea" :disabled="!isTypeArea">
        <option value="">None</option>
        <option v-for="cl in availableClasses" :value="cl">{{ cl }}</option>
      </select>
    </details>
    <details class="cs1 ce12 grid" open>
      <summary class="cs1 ce12">Properties</summary>
      <div v-for="(property, index) in entity.properties" :key="index" class="cs1 ce12 grid">
        <div class="cs1 ce10" v-if="property.valueType == 'boolean'">
          <label class="checkbox">
            <input type="checkbox" v-model="property.value" @change="saveProperty(property)" tabindex="0" />
            <span>{{ readableName(property.name) }}</span>
          </label>
        </div>
        <div class="cs1 ce10" v-else>
          <label>{{ readableName(property.name) }}:</label>
          <input v-if="property.valueType == 'string'" class="input input-small" type="text" v-model="property.value"
            @blur="saveProperty(property)" @keyup.enter="saveProperty(property)" />
          <input v-else-if="property.valueType == 'number'" class="input input-small" type="number"
            v-model="property.value" @blur="saveProperty(property)" @keyup.enter="saveProperty(property)" />
        </div>
        <button type="button" @click="deleteProperty(index)" v-if="!property.isPredefined"
          class="button button-primary button-small cs11 ce12">X</button>
        <div class="cs1 cs12 error" v-if="property.error">{{ property.error }}</div>
      </div>
    </details>
    <details class="cs1 ce12 grid">
      <summary class="cs1 ce12">Add New Property</summary>
      <div class="cs1 ce7">
        <label>Name:</label>
        <input class="input input-small" v-model="newPropertyName" />
      </div>
      <div class="cs8 ce12">
        <label>Type:</label>
        <select class="select select-small" v-model="newPropertyType">
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
        </select>
      </div>
      <span :hidden="isValidPropertyName()" class="error cs1 ce12">Name taken</span>
      <div class="cs1 ce10">
        <label>Value:</label>
        <input v-if="newPropertyType == 'string'" class="input input-small" type="text" v-model="newPropertyString" />
        <input v-else-if="newPropertyType == 'number'" class="input input-small" type="number"
          v-model="newPropertyNumber" />
        <input v-else class="input input-small" type="checkbox" v-model="newPropertyBoolean" />
      </div>
      <button type="button" :disabled="!checkNewProperty()" @click="addProperty"
        class="button button-primary button-small cs11 ce12">Add</button>
    </details>
  </div>
</template>

<style scoped>
.error {
  color: red;
  font-size: 0.8rem;
}

button {
  align-self: last baseline;
}

.prop {
  margin-top: 5px;
}

label {
  margin-top: var(--space-xsmall);
  margin-bottom: 3px;
}

summary {
  font-weight: bold;

}
</style>
