import Kinto from "kinto";
import { RuleOption } from "./model-transformer";

const db = new Kinto();

interface MetamodelStorage {
    id: string
    metamodel: string
}

interface TGGStorage {
    id: string,
    gentgg: string,
    tggrules: string,
    options: RuleOption[]
}

function getMetamodels() {
    return db.collection("metamodels");
}

async function getMetamodelNames() {
    let mms = getMetamodels();
    let records = await mms.list();
    return records.data.map(r => r.id);
}

function getTGGs() {
    return db.collection("tggs");
}

export async function storeMetamodel(id: string, metamodel: string) {
    let mms = getMetamodels();
    let record = mms.getAny(id);
    if(record)
        return mms.update({...record, metamodel});
    return mms.create({id, metamodel});
}