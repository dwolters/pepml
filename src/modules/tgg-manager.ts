import { ModelTransformer, RuleOption } from "./model-transformer";
import { Metamodel } from '../classes/Metamodel'
import { parse } from '../parsers/emsl-tgg'
import Mapping from '../classes/Mapping'
import NameGenerator from '../classes/NameGenerator'
import * as Constants from "./constants"
import { getTGGDefaults, getAllTGGs } from '../modules/tggs';
function getContent(tggName: string, key: string) {
    return localStorage.getItem(tggName + '_' + key) || '';
}
export function getAllReady() {
    let item = localStorage.getItem(Constants.KEY_READY_TGG_LIST);
    if (item === null) return [];
    let list = item.split(',');
    return list;
}

export function get(name: string) {
    let tggStr = getContent(name, Constants.KEY_TGG);
    tggStr += getContent(name, Constants.KEY_GENERATED_TGG);
    let transformer = new ModelTransformer(getContent(name, Constants.KEY_SOURCE), getContent(name, Constants.KEY_TARGET), tggStr);
    transformer.setRuleOptions(getOptions(name));
    return transformer;
}

function getStatus(tggName: string, key: string) {
    let status = localStorage.getItem(tggName + '_' + key);
    if (status === null)
        return false;
    return JSON.parse(status) as boolean;
}

function setStatus(tggName: string, key: string, value: boolean) {
    localStorage.setItem(tggName + '_' + key, '' + value);
    if (!value)
        removeFromReadyList(tggName);
}

export function getSourceMetamodelStatus(tggName: string) { return getStatus(tggName, Constants.KEY_SOURCE_STATUS) }
export function getTargetMetamodelStatus(tggName: string) { return getStatus(tggName, Constants.KEY_TARGET_STATUS) }
export function getTGGStatus(tggName: string) { return getStatus(tggName, Constants.KEY_TGG_STATUS) }
export function getGeneratedStatus(tggName: string) { return getStatus(tggName, Constants.KEY_GENTGG_STATUS) }

function setSourceMetamodelStatus(tggName: string, value: boolean) { return setStatus(tggName, Constants.KEY_SOURCE_STATUS, value) }
function setTargetMetamodelStatus(tggName: string, value: boolean) { return setStatus(tggName, Constants.KEY_TARGET_STATUS, value) }
function setTGGStatus(tggName: string, value: boolean) { return setStatus(tggName, Constants.KEY_TGG_STATUS, value) }
function setGeneratedStatus(tggName: string, value: boolean) { return setStatus(tggName, Constants.KEY_GENTGG_STATUS, value) }


function getKey(name: string, suffix: string) {
    return name + '_' + suffix;
}

function getValue(suffix: string, key: string): string {
    let actualKey = getKey(key, suffix)
    console.log('getting from key: ', actualKey);
    return localStorage.getItem(actualKey) || '';
}

function saveValue(suffix: string, key: string, content: string): void {
    let actualKey = getKey(key, suffix);
    console.log('saving to key: ', actualKey);
    localStorage.setItem(actualKey, content);
}

function saveSourceMetamodelName(tggName: string, value: string) { return saveValue(Constants.KEY_SOURCE_NAME, tggName, value) }
function saveTargetMetamodelName(tggName: string, value: string) { return saveValue(Constants.KEY_TARGET_NAME, tggName, value) }
function saveSourceMetamodel(tggName: string, value: string) { return saveValue(Constants.KEY_SOURCE, tggName, value) }
function saveTargetMetamodel(tggName: string, value: string) { return saveValue(Constants.KEY_TARGET, tggName, value) }
function saveTGG(tggName: string, value: string) { return saveValue(Constants.KEY_TGG, tggName, value) }
function saveGenTGG(tggName: string, value: string) { return saveValue(Constants.KEY_GENTGG, tggName, value) }
function saveGeneratedTGG(tggName: string, value: string) { return saveValue(Constants.KEY_GENERATED_TGG, tggName, value) }

export function getSourceMetamodelName(tggName: string) { return getValue(Constants.KEY_SOURCE_NAME, tggName) }
export function getTargetMetamodelName(tggName: string) { return getValue(Constants.KEY_TARGET_NAME, tggName) }
export function getSourceMetamodel(tggName: string) { return getValue(Constants.KEY_SOURCE, tggName) }
export function getTargetMetamodel(tggName: string) { return getValue(Constants.KEY_TARGET, tggName) }
export function getTGG(tggName: string) { return getValue(Constants.KEY_TGG, tggName) }
export function getGenTGG(tggName: string) { return getValue(Constants.KEY_GENTGG, tggName) }
export function getGeneratedTGG(tggName: string) { return getValue(Constants.KEY_GENERATED_TGG, tggName) }

export function isReady(tggName: string): boolean {
    let ready = getTGGStatus(tggName) &&
        getSourceMetamodelStatus(tggName) &&
        getTargetMetamodelStatus(tggName) &&
        getGeneratedStatus(tggName)
    if (ready) {
        let options = getOptions(tggName);
        if (options)
            checkRuleOptions(tggName, options);
        else
            options = setDefaultRuleOptions(tggName);
        addToReadyList(tggName);
    }
    return ready;
}

function removeFromReadyList(tggName: string) {
    let item = localStorage.getItem(Constants.KEY_READY_TGG_LIST);
    if (item === null) return;
    let list = item.split(',');
    let index = list.indexOf(tggName);
    if (index > -1) {
        list.splice(index, 1);
        if (list.length == 0)
            localStorage.removeItem(Constants.KEY_READY_TGG_LIST)
        else
            localStorage.setItem(Constants.KEY_READY_TGG_LIST, list.join(','));
    }
}
function addToReadyList(tggName: string) {
    let item = localStorage.getItem(Constants.KEY_READY_TGG_LIST);
    if (item === null) {
        localStorage.setItem(Constants.KEY_READY_TGG_LIST, tggName);
    } else {
        let list = item.split(',');
        if (!list.includes(tggName)) {
            list.push(tggName)
            localStorage.setItem(Constants.KEY_READY_TGG_LIST, list.join(','));
        }
    }
}



export function checkTGG(tggName: string, tggStr: string) {
    saveTGG(tggName, tggStr)
    try {
        parse(tggStr);
        setTGGStatus(tggName, true)
    } catch (e) {
        console.error(e);
        setTGGStatus(tggName, false)
        throw e;
    }
}

export function checkSourceMetamodel(tggName: string, mmStr: string) {
    saveSourceMetamodel(tggName, mmStr)
    try {
        let mm = new Metamodel(mmStr, '');
        saveSourceMetamodelName(tggName, mm.name);
        setSourceMetamodelStatus(tggName, true)
    } catch (e) {
        console.error(e);
        setSourceMetamodelStatus(tggName, false)
        throw e;
    }
}
export function checkTargetMetamodel(tggName: string, mmStr: string) {
    saveTargetMetamodel(tggName, mmStr)
    try {
        let mm = new Metamodel(mmStr, '');
        saveTargetMetamodelName(tggName, mm.name);
        setTargetMetamodelStatus(tggName, true)
    } catch (e) {
        console.error(e);
        setTargetMetamodelStatus(tggName, false)
        throw e;
    }
}

export async function checkGenTGG(tggName: string, genTGGStr: string) {
    saveGenTGG(tggName, genTGGStr);
    try {
        let sourceMetamodel = getSourceMetamodel(tggName);
        let targetMetamodel = getTargetMetamodel(tggName);
        let mapping = genTGGStr
        if (mapping.trim().length) {
            NameGenerator.clearAll()
            console.log('Generating');
            const mappingHelper = new Mapping(mapping, sourceMetamodel, targetMetamodel)
            const tgg = mappingHelper.generateTGG()
            let generated = tgg.generateTGGString(false, false).trim()
            saveGeneratedTGG(tggName, generated)
        } else {
            saveGeneratedTGG(tggName, '')
        }
        setGeneratedStatus(tggName, true)
    } catch (e) {
        console.error(e);
        setGeneratedStatus(tggName, false)
        throw e;
    }
    return '';
}

export function getOptions(tggName: string): RuleOption[] {
    let options = localStorage.getItem(tggName + '_' + Constants.KEY_OPTIONS);
    if (!options) return [];
    return options.split(';').map(e => ({ name: e.substring(0, e.indexOf(':')), enabled: e.indexOf(':enabled') > -1, applyOnce: e.indexOf(':once') > -1, individualMatchApplication: e.indexOf(':individually') > -1 }))
}

function setOptions(tggName: string, options: RuleOption[]) {
    let optionsStr = options.map(e => e.name + (e.enabled ? ':enabled' : ':disabled') + (e.individualMatchApplication ? ':individually' : '') + (e.applyOnce ? ':once' : '')).join(';');
    localStorage.setItem(tggName + '_' + Constants.KEY_OPTIONS, optionsStr);
    console.log('storing:', optionsStr);
}

export function checkRuleOptions(tggName: string, currentOptions: RuleOption[]): RuleOption[] {
    let transformer = get(tggName)
    let rules = transformer.getRuleNames();
    let newOptions: RuleOption[] = [];
    //Check that all options refer to existing rules
    currentOptions.forEach(option => {
        if (rules.includes(option.name))
            newOptions.push(option)
        else
            console.log('Removing rule options for none existing rule:', option.name);
    });
    rules.forEach(rule => {
        if (!newOptions.find(option => option.name == rule)) {
            console.log('Adding default options for new rule:', rule)
            newOptions.push({ name: rule, enabled: true, individualMatchApplication: false, applyOnce: false })
        }
    })
    setOptions(tggName, newOptions);
    return newOptions;
}

export function setDefaultRuleOptions(tggName: string) {
    if (!isReady(tggName)) return []
    console.log('Setting default rule options');
    let transformer = get(tggName)
    let options = transformer.getRuleNames().map(name => ({ name, ind: false, enabled: true, individualMatchApplication: false, applyOnce: false }));
    setOptions(tggName, options);
    return options;
}

export function loadDefaults() {
    getAllTGGs().forEach(tggName => {
        let tggDefaults = getTGGDefaults(tggName);
        try {
            checkSourceMetamodel(tggName, tggDefaults.sourceMetamodelName)
            checkTargetMetamodel(tggName, tggDefaults.targetMetamodelName)
            checkGenTGG(tggName, tggDefaults.gentgg)
            checkTGG(tggName, tggDefaults.tgg)
            isReady(tggName)
        } catch (e) {
            console.error('Error while loading defaults for TGG: ', tggName)
        }
    })
}
