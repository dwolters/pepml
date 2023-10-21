<script setup lang="ts">
import { ref, Ref } from 'vue';
import * as Constants from '../../modules/constants'
import * as TGGManager from '../../modules/tgg-manager'
import { RuleOption } from "../../modules/model-transformer";
import { getAllTGGs } from '../../modules/tggs';
let tabs: Record<string, { name: string, showGenerated: boolean }> = {
    source: {
        name: Constants.KEY_SOURCE,
        showGenerated: false
    },
    target: {
        name: Constants.KEY_TARGET,
        showGenerated: false
    },
    gentgg: {
        name: Constants.KEY_GENTGG,
        showGenerated: true
    },
    tgg: {
        name: Constants.KEY_TGG,
        showGenerated: false
    },
    options: {
        name: Constants.KEY_OPTIONS,
        showGenerated: false
    }
}
let tabNames = ref(Object.values(tabs).map(v => v.name));
let selectedTab = ref(tabNames.value[0]);
let availableTGGs = ref(getAllTGGs());
let selectedTGG = ref('');
miro.board.getAppData<string>('selectedTGG').then(tgg => setSelectedTgg(tgg));
let ruleOptions: Ref<Array<RuleOption>> = ref([])
let textarea = ref("");
let generated = ref("");
let error = ref("");
let isReady = ref(false);


let typingTimer: number;                //timer identifier
var doneTypingInterval = 3000;  //time in ms, 5 seconds for example

function setTypingTimer() {
    clearTypingTimer();
    typingTimer = setTimeout(save, doneTypingInterval);
};

function clearTypingTimer() {
    clearTimeout(typingTimer);
};

function getTab(tab: string | undefined = undefined) {
    if (!tab) tab = selectedTab.value;
    console.log('selected tab: ', tab)
    let tabDef = Object.values(tabs).find(t => t.name == tab);
    if (!tabDef)
        throw new Error("Could not find tab definition");
    return tabDef;
}

async function save() {
    clearTypingTimer()
    error.value = '';
    try {
        switch (selectedTab.value) {
            case tabs.gentgg.name:
                await TGGManager.checkGenTGG(selectedTGG.value, textarea.value)
                generated.value = TGGManager.getGeneratedTGG(selectedTGG.value);
                break;
            case tabs.source.name:
                TGGManager.checkSourceMetamodel(selectedTGG.value, textarea.value);
                break;
            case tabs.target.name:
                TGGManager.checkTargetMetamodel(selectedTGG.value, textarea.value);
                break;
            case tabs.tgg.name:
                TGGManager.checkTGG(selectedTGG.value, textarea.value);
                break;
            case tabs.options.name:
                TGGManager.checkRuleOptions(selectedTGG.value, ruleOptions.value);
                break;
        }
        isReady.value = TGGManager.isReady(selectedTGG.value)
    } catch (e) {
        if (e instanceof Error)
            error.value = e.message;
        else
            error.value = 'Unkown error. See console.'
    }
}

function saveRuleOrder(oldIndex: number, newIndex: number) {
    const item = ruleOptions.value.splice(oldIndex, 1)[0];
    ruleOptions.value.splice(newIndex, 0, item);
    save();
}

async function selectTab(tab: string) {
    save()
    selectedTab.value = tab;
    showSelection()
}

function showSelection() {
    let tggName = selectedTGG.value;
    isReady.value = TGGManager.isReady(tggName);
    switch (selectedTab.value) {
        case tabs.gentgg.name:
            console.log('Showing Generated TGG')
            textarea.value = TGGManager.getGenTGG(tggName);
            generated.value = TGGManager.getGeneratedTGG(tggName);
            break;
        case tabs.source.name:
            textarea.value = TGGManager.getSourceMetamodel(tggName);
            break;
        case tabs.target.name:
            textarea.value = TGGManager.getTargetMetamodel(tggName);
            break;
        case tabs.tgg.name:
            textarea.value = TGGManager.getTGG(tggName);
            break;
        case tabs.options.name:
            ruleOptions.value = TGGManager.getOptions(tggName);
            break;
    }
}

function setSelectedTgg(tggName: string) {
    selectedTGG.value = tggName;
    showSelection();
}

function setDefaultRuleOptions() {
    ruleOptions.value = TGGManager.setDefaultRuleOptions(selectedTGG.value);
}
</script>

<template>
    <div>
        <h1>Model Transformer Control Center</h1>
    </div>
    <div>
        <div class="tabs">
            <div class="tabs-header-list">
                <div class="tab">
                    <select class="select select-small" v-model="selectedTGG" @change="showSelection">
                        <option v-for="tgg in availableTGGs" :value="tgg">{{ tgg }}</option>
                    </select>
                </div>
                <div v-if="selectedTGG" v-for="tab in tabNames" tabindex="0"
                    :class="['tab', selectedTab == tab ? 'tab-active' : '']" @click="selectTab(tab)">
                    <div class="tab-text">{{ tab }}</div>
                </div>
            </div>
        </div>
    </div>
    <div v-if="selectedTGG" class="main">
        <div v-if="error" class="error">{{ error }}</div>
        <div class="form-group-small textarea-container" v-if="selectedTab != 'Options'">
            <div class="leftsection">
                <textarea @keyup="setTypingTimer" @keydown="clearTypingTimer" class="textarea" spellcheck="false"
                    v-model="textarea"></textarea>
            </div>
            <div class="rightsection" v-if="getTab().showGenerated">
                <textarea class="textarea" placeholder="Placeholder text" spellcheck="false" readonly
                    v-model="generated"></textarea>
            </div>
        </div>
        <div v-if="selectedTab == 'Options' && !isReady">Cannot set options when TGG is not ready.</div>
        <div v-if="selectedTab == 'Options' && isReady">
            <table>
                <tr>
                    <th>Order</th>
                    <th>Enabled</th>
                    <th>Name</th>
                    <th>Apply matches<br>individually?</th>
                    <th>Apply rule<br>only once?</th>
                    <th>Up</th>
                    <th>Down</th>
                </tr>
                <tr v-for="(option, index) in ruleOptions">
                    <td>{{ index + 1 }}</td>
                    <td>
                        <label class="toggle">
                            <input type="checkbox" v-model="option.enabled" @change="save" />
                            <span></span>
                        </label>
                    </td>
                    <td>{{ option.name }}</td>
                    <td><input type="checkbox" v-model="option.individualMatchApplication" @change="save" /></td>
                    <td><input type="checkbox" v-model="option.applyOnce" @change="save" /></td>
                    <td><span class="arrow" v-if="index > 0" @click="saveRuleOrder(index, index - 1)"><img
                                src='data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTI4cHQiIGhlaWdodD0iMTI4cHQiIHZlcnNpb249IjEuMSIgdmlld0JveD0iMCAwIDEyOCAxMjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiA8cGF0aCBkPSJtOTUuMjgxIDgwLjMyYzAuMzA0NjkgMCAwLjU3ODEyLTAuMTgzNTkgMC42OTkyMi0wLjQ3MjY2IDAuMTIxMDktMC4yODkwNiAwLjA0Njg3NS0wLjYwOTM4LTAuMTY3OTctMC44MjAzMWwtMzEuMjU4LTMxLjI1OGMtMC4xNTIzNC0wLjE1MjM0LTAuMzUxNTYtMC4yMjY1Ni0wLjUzMTI1LTAuMjI2NTYtMC4xODM1OSAwLTAuMzk0NTMgMC4wNzQyMTktMC41MzEyNSAwLjIyNjU2bC0zMS4yNDYgMzEuMjQyYy0wLjIxMDk0IDAuMTk5MjItMC4yODkwNiAwLjUzMTI1LTAuMTY3OTcgMC44MzU5NCAwLjEyMTA5IDAuMjg5MDYgMC4zOTQ1MyAwLjQ3MjY2IDAuNjk5MjIgMC40NzI2NnoiLz4KPC9zdmc+Cg==' /></span>
                    </td>
                    <td><span class="arrow down" v-if="index + 1 < ruleOptions.length"
                            @click="saveRuleOrder(index, index + 1)"><img
                                src='data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyB3aWR0aD0iMTI4cHQiIGhlaWdodD0iMTI4cHQiIHZlcnNpb249IjEuMSIgdmlld0JveD0iMCAwIDEyOCAxMjgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiA8cGF0aCBkPSJtOTUuMjgxIDgwLjMyYzAuMzA0NjkgMCAwLjU3ODEyLTAuMTgzNTkgMC42OTkyMi0wLjQ3MjY2IDAuMTIxMDktMC4yODkwNiAwLjA0Njg3NS0wLjYwOTM4LTAuMTY3OTctMC44MjAzMWwtMzEuMjU4LTMxLjI1OGMtMC4xNTIzNC0wLjE1MjM0LTAuMzUxNTYtMC4yMjY1Ni0wLjUzMTI1LTAuMjI2NTYtMC4xODM1OSAwLTAuMzk0NTMgMC4wNzQyMTktMC41MzEyNSAwLjIyNjU2bC0zMS4yNDYgMzEuMjQyYy0wLjIxMDk0IDAuMTk5MjItMC4yODkwNiAwLjUzMTI1LTAuMTY3OTcgMC44MzU5NCAwLjEyMTA5IDAuMjg5MDYgMC4zOTQ1MyAwLjQ3MjY2IDAuNjk5MjIgMC40NzI2NnoiLz4KPC9zdmc+Cg==' /></span>
                    </td>
                </tr>
            </table>
            <p><button @click="setDefaultRuleOptions">Reset</button></p>
        </div>
    </div>
</template>

<style>
.main {
    height: 100%;
}

.arrow {
    width: 20px;
    padding: 1px;
    cursor: pointer;
}

.arrow img {
    width: 18px;
}

.down img {
    transform: rotate(180deg);
}

.error {
    background-color: var(--red700);
    margin-top: 10px;
    padding: .5em;
    margin-bottom: 10px;
}

h1 {
    padding-top: 10px;
    padding-bottom: 10px;
}

table {
    border-spacing: 0
}

th {
    padding-left: 3px;
    padding-right: 3px;
}

td:nth-child(1) {
    text-align: right;
    width: 60px;
    padding-right: 10px;
}

td:nth-child(2) {
    text-align: center;
    vertical-align: middle;
    width: 60px;
}

td:nth-child(4),
td:nth-child(5),
td:nth-child(6),
td:nth-child(7) {
    text-align: center;
}

td .toggle {
    min-height: 0px;
    display: inline;
    min-width: 0px;
}

tr:nth-child(even) {
    background: #EEEEEE
}

.textarea-container {
    margin-top: 10px;
    display: flex;
    flex-direction: row;
    /* stack children vertically */
    box-sizing: border-box;
    height: 90%;
}

.leftsection,
.rightsection {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex-grow: 1;
}

.textarea-container textarea {
    flex-grow: 1;
    width: 100%;
    /* This will make the textarea take up all available vertical space */
    min-height: 150px;
    /* Set a minimum height if needed */
    padding: 10px;
    box-sizing: border-box;
    /* Allow vertical resizing of the textarea */
}
</style>
