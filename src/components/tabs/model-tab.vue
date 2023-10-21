<script setup lang="ts">
import { ref, onMounted, Ref } from 'vue';
import * as MiroBoardUtils from '../../modules/miro-board-utils';
import * as MiroNeoUtils from '../../modules/miro-neo-utils';
import * as NeoCoreUtils from '../../modules/neocore-utils';
import { UnclearContainmentError } from '../../modules/preprocessors/spatial-relations';
import * as TGGManager from '../../modules/tgg-manager';
import { UntransformedItem } from '../../modules/model-transformer';
import { layout } from '../../modules/layouting';

let defaultSourceModelName = 'MiroModel';
miro.board.getInfo().then(info => selectedSourceModel.value = defaultSourceModelName += '_' + info.id);

let waiting = ref(false);
let isMiroSource = ref(true);
let availableTGGs = ref<string[]>([]);
let availableSourceModels = ref<string[]>([]);
let availableTargetModels = ref<string[]>([]);
let selectedTGG = ref('');
miro.board.getAppData<string>('selectedTGG').then(tgg => selectedTGG.value = tgg);
let selectedSourceModel = ref('');
let selectedTargetModel = ref('');
miro.board.getAppData<string>('selectedTargetModel').then(model => selectedTargetModel.value = model);
let showModelAdd = ref(false);
let newModelName = ref('');
let newModelNameError = ref('');
let unclearContainments: Ref<Array<{ parentId: string, parentName: string, childId: string, childName: string }>> = ref([]);
let invalidConnectors: Ref<Array<{ id: string, reason: string }>> = ref([]);
let untransformed = ref<UntransformedItem[]>([]);

async function reset() {
    MiroBoardUtils.undoHighlightStyling();
    waiting.value = false;
    unclearContainments.value = [];
    invalidConnectors.value = []
    untransformed.value = [];
}


async function extract() {
    let sourceModelName = defaultSourceModelName;
    reset();
    let items = await MiroBoardUtils.getAllItems();
    try {
        await MiroNeoUtils.extractModel(items, sourceModelName, selectedTGG.value);
    } catch (e) {
        if (e instanceof UnclearContainmentError) {
            unclearContainments.value = await Promise.all(e.unclearContainmentIds.map(async pair => {
                let parentItem = await MiroBoardUtils.getItemById(pair[0]);
                let childItem = await MiroBoardUtils.getItemById(pair[1]);
                if (!parentItem) throw new Error('Cannot find item: ' + pair[0])
                if (!childItem) throw new Error('Cannot find item: ' + pair[1])
                return { parentId: parentItem.id, parentName: MiroBoardUtils.getNameFromItem(parentItem), childId: childItem.id, childName: MiroBoardUtils.getNameFromItem(childItem), }
            }));
        } else if (e instanceof MiroNeoUtils.InvalidConnector) {
            invalidConnectors.value = e.invalidConnectors;
        }
    }
}

// async function cleanDatabase() {
//     reset();
//     waiting.value = true;
//     await neoUtils.cleanDatabase();
//     waiting.value = false;
// }

async function deleteSource() {
    reset();
    waiting.value = true;
    console.log('Deleting model:', selectedSourceModel.value)
    await NeoCoreUtils.deleteModel(selectedSourceModel.value);
    waiting.value = false;
}

async function deleteTarget() {
    reset();
    waiting.value = true;
    console.log('Deleting model:', selectedTargetModel.value)
    await NeoCoreUtils.deleteModel(selectedTargetModel.value);
    waiting.value = false;
}

function openTGGModal() {
    miro.board.ui.openModal({
        url: 'modal.html#TGG',
        fullscreen: true,
    });
}

async function transform(fwd: boolean) {
    let tggName = selectedTGG.value;
    let transformer = TGGManager.get(tggName);
    if (!transformer) {
        updateAvailableTransformers();
        throw new Error('Transformer does not seem to exist')
    }
    let untransformedElements = await transformer.transform(fwd, selectedSourceModel.value, selectedTargetModel.value + '_tmp');
    untransformed.value = untransformedElements.filter(e => e.itemId);
}

async function validateAndExtract() {
    await extract()
    await transform(true)
    await merge()
}

async function merge() {
    NeoCoreUtils.mergeInto(selectedTargetModel.value + '_tmp', selectedTargetModel.value)
}

async function deleteFromMerged() {
    NeoCoreUtils.deleteFromMergedModel(selectedSourceModel.value, selectedTargetModel.value);
}

async function injectModel() {
    layout(selectedSourceModel.value);
}

async function addDecorators() {
    reset()
    MiroNeoUtils.addDecorators(selectedSourceModel.value, selectedTargetModel.value);
}

async function realignDecorators() {
    reset()
    MiroBoardUtils.realignDecorators();
}

async function removeDecorators() {
    reset()
    MiroBoardUtils.removeDecorators();
}

function highlightUntransformed() {
    let itemIds = untransformed.value.filter(i => i.itemId).map(i => i.itemId) as string[]
    if (itemIds)
        MiroBoardUtils.highlightItems(...itemIds);
}

function updateAvailableTransformers() {
    availableTGGs.value = TGGManager.getAllReady();
    if (availableTGGs.value.length > 0)
        selectedTGG.value = selectedTGG.value || availableTGGs.value[0];
    else
        selectedTGG.value = '';
    updateAvailableModels()
}

async function updateAvailableModels() {
    let tggName = selectedTGG.value;
    let sourceMetamodelName = TGGManager.getSourceMetamodelName(tggName)
    let targetMetamodelName = TGGManager.getTargetMetamodelName(tggName)
    if (sourceMetamodelName && sourceMetamodelName != 'Miro')
        availableSourceModels.value = await NeoCoreUtils.getModelsForMetamodel(sourceMetamodelName)
    else if (sourceMetamodelName && sourceMetamodelName == 'Miro') {
        selectedSourceModel.value = defaultSourceModelName;
        availableSourceModels.value = []
    } else {
        availableSourceModels.value = []
    }
    if (targetMetamodelName)
        availableTargetModels.value = await NeoCoreUtils.getModelsForMetamodel(targetMetamodelName)
    else
        availableTargetModels.value = []
    let model = await miro.board.getAppData<string>('selectedTargetModel');
    if (!availableTargetModels.value.includes(model))
        availableTargetModels.value.push(model)
    selectedTargetModel.value = model;
}

function showNewModelInput() {
    reset()
    showModelAdd.value = true;
}

function saveSelectedModel() {
    miro.board.setAppData('selectedTargetModel', selectedTargetModel.value);
}

function saveSelectedTGG() {
    miro.board.setAppData('selectedTGG', selectedTGG.value);
    isMiroSource.value = TGGManager.getSourceMetamodelName(selectedTGG.value) == 'Miro';
    updateAvailableModels()
}

async function addNewModel() {
    let tggName = selectedTGG.value;
    let metamodelName = TGGManager.getTargetMetamodelName(tggName)
    let modelName = newModelName.value.trim();
    if (!metamodelName) return;
    if (availableTargetModels.value.includes(modelName)) {
        newModelNameError.value = 'Name already exists';
        return;
    };
    if (modelName != '') {
        await NeoCoreUtils.registerModel(modelName, metamodelName);
    }
    newModelNameError.value = '';
    showModelAdd.value = false;
    await updateAvailableModels();
    selectedTargetModel.value = modelName;
    saveSelectedModel();
}

function loadDefaultTGGs() {
    TGGManager.loadDefaults();
    updateAvailableTransformers();
}


onMounted(() => {
    updateAvailableTransformers()
});
</script>

<style>
.viewpoint-selection {
    margin-top: 10px;
    margin-bottom: 10px;
}

.viewpoint-selection label {
    margin-bottom: 2px;
}
</style>

<template>
    <div class="form-group">
        <div class="grid viewpoint-selection">
            <label class="cs1 ce12">Model Type: </label>
            <select class="select select-small cs1 ce9" v-model="selectedTGG" @dblclick="updateAvailableTransformers"
                @change="saveSelectedTGG">
                <option selected disabled v-if="availableTGGs.length == 0">No TGG available</option>
                <option v-for="tgg in availableTGGs" :value="tgg">{{ tgg }}</option>
            </select>
            <button class="button button-small button-primary cs10 ce12" style="text-align: center;display:inline"
                :disabled="waiting" @click="openTGGModal">Edit</button>
        </div>
        <div class="grid viewpoint-selection" v-if="!isMiroSource">
            <label class="cs1 ce12">Source Model: </label>
            <select class="select select-small cs1 ce12" v-model="selectedSourceModel" @dblclick="updateAvailableModels">
                <option selected disabled v-if="availableTargetModels.length == 0">No models available</option>
                <option v-for="model in availableSourceModels" :value="model">{{ model }}</option>
            </select>
        </div>
        <div class="grid viewpoint-selection" v-if="!showModelAdd">
            <label class="cs1 ce12">Target Model: </label>
            <select class="select select-small cs1 ce9" v-model="selectedTargetModel" @change="saveSelectedModel">
                <option selected disabled v-if="availableTargetModels.length == 0">No models available</option>
                <option v-for="model in availableTargetModels" :value="model">{{ model }}</option>
            </select>
            <button class="button button-small button-primary cs10 ce12" style="text-align: center;display:inline"
                @click="showNewModelInput">New</button>
            <div class="cs1 ce12" v-if="newModelNameError">{{ newModelNameError }}</div>
        </div>
        <div class="grid" v-if="showModelAdd">
            <label class="cs1 ce12">Model: </label>
            <input class="input input-small cs1 ce9" placeholder="New Model Name" v-model="newModelName">
            <button class="button button-small button-primary cs10 ce12" style="text-align: center;display:inline"
                @click="addNewModel">Add</button>
        </div>
        <button class="button button-small button-primary" style="width:100%; text-align:center; display:inline"
            :disabled="waiting" @click="validateAndExtract">Validate and Extract</button>

        <details open>
            <summary>Advanced Features</summary>
            <button class="button button-small button-primary" :disabled="waiting" @click="deleteSource()">Delete
                Source</button>
            <button class="button button-small button-primary" :disabled="waiting" @click="deleteTarget()">Delete
                Target</button>
            <button class="button button-small button-primary" :disabled="waiting" @click="deleteFromMerged()">Delete from
                Merged
                Target</button>

            <!-- <label for="tggName">TGG:</label>
        <select class="select select-small" v-model="tggName" id="tggName">
            <option v-for="name in tggNames" :value="name">{{ name }}</option>
        </select> -->
            <button class="button button-small button-primary " v-if="isMiroSource" :disabled="waiting"
                @click="extract()">Extract</button>
            <button class="button button-small button-primary" :disabled="waiting || selectedTGG == ''"
                @click="transform(true)">FWD</button>
            <button class="button button-small button-primary" :disabled="waiting || selectedTGG == ''"
                @click="merge()">Merge</button>
            <button class="button button-small button-primary" :disabled="waiting || selectedTGG == ''"
                @click="transform(false)">BWD</button>
            <button class="button button-small button-primary" v-if="isMiroSource" :disabled="waiting || selectedTGG == ''"
                @click="addDecorators">Add Decorators</button>
            <button class="button button-small button-primary" v-if="isMiroSource" :disabled="waiting || selectedTGG == ''"
                @click="realignDecorators">Realign Decorators</button>
            <button class="button button-small button-primary" v-if="isMiroSource" :disabled="waiting || selectedTGG == ''"
                @click="removeDecorators">Delete Decorators</button>
            <button class="button button-small button-primary" v-if="isMiroSource" :disabled="waiting || selectedTGG == ''"
                @click="injectModel">Inject</button>
            <button class="button button-small button-primary" 
                @click="loadDefaultTGGs">Load Default TGGs</button>
        </details>
    </div>
    <div v-if="untransformed.length > 0">
        Some items have not been transformed.
        <button class="button button-small button-primary" :disabled="waiting" @click="highlightUntransformed()">Highlight
            Untransformed Items</button>
    </div>
    <ol v-if="invalidConnectors">
        <li v-for="invalidConnector in invalidConnectors" @click="MiroBoardUtils.highlightItems(invalidConnector.id)">{{
            invalidConnector.reason }}</li>
    </ol>
    <div v-if="unclearContainments">
        <p @click="MiroBoardUtils.highlightItems(unclearContainment.parentId, unclearContainment.childId)"
            v-for="unclearContainment in unclearContainments">{{ unclearContainment.parentName ||
                unclearContainment.parentId }} &lt;-> {{ unclearContainment.childName }}</p>
    </div>
</template>