import { Assocation, Attribute, Constraint, CorrespondenceObject, Pattern, Rule, RuleObject, TGG } from '../types/emsl-tgg';
import { parse } from '../parsers/emsl-tgg';
import { driver } from "./neo";
import { Metamodel } from '../classes/Metamodel';
import * as NeoCoreUtils from '../modules/neocore-utils';

interface QueryParts {
    matchClause: string[],
    whereClause: string[],
    setClause: string[],
    createClause: string[],
    variableMap: Record<string, string>,
    elements: string[],
}

export type RuleOption = {
    name: string;
    enabled: boolean;
    individualMatchApplication: boolean;
    applyOnce: boolean;
}

export type UntransformedItem = {
    id: number
    type?: string
    labels?: string[]
    itemId: string | null
}

export type AssociationType = {
    name: string
    sourceClass: string
    targetClass: string
}

export class ModelTransformer {

    tgg: TGG[];
    sourceMetamodel: Metamodel;
    targetMetamodel: Metamodel;
    patterns: Record<string, Pattern> = {};
    constraints: Record<string, Constraint> = {};
    rules: Record<string, Rule> = {};
    ruleMatchQuery: Record<string, string> = {}
    ruleCreateQuery: Record<string, string> = {}
    ruleOrder: string[] = [];
    singleApplicationRule: Record<string, boolean> = {};

    constructor(sourceMetamodelStr: string, targetMetamodelStr: string, tggStr: string) {

        this.sourceMetamodel = new Metamodel(sourceMetamodelStr, 'Source');
        this.targetMetamodel = new Metamodel(targetMetamodelStr, 'target');
        this.tgg = parse(tggStr);

        // Create index for TGG
        this.tgg.forEach(r => {
            switch (r.type) {
                case "rule":
                    this.rules[r.name] = r;
                    this.ruleOrder.push(r.name);
                    return;
                case "pattern":
                    this.patterns[r.name] = r;
                    return;
                default:
                    this.constraints[r.name] = r;
            }
        })
    }

    private differentIDs(values: string[]) {
        const comparisons = [];

        for (let i = 0; i < values.length; i++) {
            for (let j = i + 1; j < values.length; j++) {
                comparisons.push(`NOT id(${values[i]}) = id(${values[j]})`);
            }
        }
        return comparisons.join(' AND ');
    }

    linkNames: string[] = [];
    private createOrGetLinkName(assoc: Assocation | CorrespondenceObject) {
        if (assoc.linkName)
            return assoc.linkName;
        let name;
        if (assoc.type == "correspondence_object")
            name = `${assoc.sourceObject}_corr_${assoc.targetObject}`;
        else
            name = `${assoc.sourceObject}_${assoc.assocationName}_${assoc.targetObject}`;
        let uniqueName = name;
        let count = 1;
        while (this.linkNames.includes(uniqueName))
            uniqueName = name + '_' + count++;
        this.linkNames.push(uniqueName);
        assoc.linkName = uniqueName;
        return uniqueName;
    }
    private resetLinkNames() {
        this.linkNames = [];
    }

    private createMatchStringForObject(obj: RuleObject, fwd: boolean, nac = false) {
        let sourceModel = 'sourceModel';
        let sourceMetamodelName = this.sourceMetamodel.name;
        let targetModel = 'targetModel';
        let targetMetamodelName = this.targetMetamodel.name;
        if (!fwd) {
            sourceModel = 'targetModel';
            sourceMetamodelName = this.targetMetamodel.name;
            targetModel = 'sourceModel';
            targetMetamodelName = this.sourceMetamodel.name;
        }        
        if (!nac && (obj.isSource && fwd || !obj.isSource && !fwd))
            return `(${obj.name}:${sourceMetamodelName}__${obj.class} {enamespace:$${sourceModel}, _tr_:${!obj.created}})`;
        if(nac)
            return `(${obj.name}:${sourceMetamodelName}__${obj.class} {enamespace:$${sourceModel}})`;
        return `(${obj.name}:${targetMetamodelName}__${obj.class} {enamespace:$${targetModel}})`;
    }

    private createStringForAssociation(assoc: Assocation, fwd: boolean, nac = false) {          
        if (!nac && (assoc.isSource && fwd || !assoc.isSource && !fwd))
            return `(${assoc.sourceObject})-[${this.createOrGetLinkName(assoc)}:${assoc.assocationName} {_tr_:${!assoc.created}}]->(${assoc.targetObject})`;
        return `(${assoc.sourceObject})-[${this.createOrGetLinkName(assoc)}:${assoc.assocationName}]->(${assoc.targetObject})`;
    }

    private createStringForCorrespondence(c: CorrespondenceObject) {
        return `(${c.sourceObject})-[${this.createOrGetLinkName(c)}:corr {_type_:'${c.name}'}]->(${c.targetObject})`;
    }

    private processMatchElement(objOrAssoc: RuleObject | Assocation, q: QueryParts, basedOnMatch: boolean, fwd: boolean, nac = false) {
        let name: string;
        if (objOrAssoc.type == 'rule_object') {
            name = objOrAssoc.name
            q.matchClause.push(this.createMatchStringForObject(objOrAssoc, fwd, nac))
        } else {
            name = this.createOrGetLinkName(objOrAssoc);
            q.matchClause.push(this.createStringForAssociation(objOrAssoc, fwd, nac))
        }
        q.elements.push(name)
        if (objOrAssoc.created)
            q.setClause.push(`${name}._tr_ = true`)
        if (basedOnMatch) {
            q.whereClause.push(`id(${name}) = match.${name}`)
            // Pattern does not need to be checked again but all variables must be added to the map
            this.processAttributes(objOrAssoc.attributes, name, [], q.variableMap);
        } else {
            this.processAttributes(objOrAssoc.attributes, name, q.whereClause, q.variableMap);
        }
    }

    private processAttributes(attributes: Attribute[] | undefined | null, name: string, clause: string[], variableMap: Record<string, string>, modelName: string | undefined = undefined) {
        attributes?.forEach(attr => {
            switch (attr.type) {
                case "variable_attribute":
                    if (!variableMap[attr.value]) {
                        variableMap[attr.value] = `${name}.${attr.name}`;
                    } else {
                        clause.push(`${name}.${attr.name} = ${variableMap[attr.value]}`)
                    }
                    break;
                case "string_attribute":
                case "enum_attribute":
                    if(attr.value == 'null')
                        clause.push(`${name}.${attr.name} IS NULL`) //TODO: Properly identify null values in TGG parser. Add valueType to attribute
                    else
                        clause.push(`${name}.${attr.name} = "${attr.value}"`)
                    break;
                default:
                    clause.push(`${name}.${attr.name} = ${attr.value}`)
            }
            if (modelName)
                clause.push(`${name}.__created_${attr.name} = [$${modelName}]`)
        })
    }

    private processCreateObject(obj: RuleObject, q: QueryParts, fwd: boolean, flagCreatedModel = true) {
        q.elements.push(obj.name)
        let metamodel = obj.isSource ? this.sourceMetamodel : this.targetMetamodel;
        let labels = metamodel.getClassHierarchy(obj.class).map(c => metamodel.name + '__' + c);
        labels.unshift('NeoCore__EObject');
        let modelName = fwd ? 'targetModel' : 'sourceModel';
        let oppositeModel = fwd ? 'sourceModel' : 'targetModel';
        q.createClause.push(`(${obj.name}:${labels.join(':')} {enamespace:$${modelName}})`);
        if (flagCreatedModel)
            q.setClause.push(`${obj.name}.__created = [$${oppositeModel}+":${labels.join(':')}"]`)
        this.processAttributes(obj.attributes, obj.name, q.setClause, q.variableMap, flagCreatedModel ? oppositeModel : '');
    }

    private processCreateAssociation(assoc: Assocation, q: QueryParts, fwd: boolean, flagCreatedModel = true) {
        let oppositeModel = fwd ? 'sourceModel' : 'targetModel';
        let linkName = this.createOrGetLinkName(assoc);
        q.elements.push(linkName);
        q.createClause.push(this.createStringForAssociation(assoc, fwd));
        if (flagCreatedModel)
            q.setClause.push(`${linkName}.__created = [$${oppositeModel}]`)
        this.processAttributes(assoc.attributes, linkName, q.setClause, q.variableMap, flagCreatedModel ? oppositeModel : '');
    }

    private processRule(r: Rule, basedOnMatch: boolean, fwd: boolean, flagCreatedModel = true) {
        this.resetLinkNames()
        console.log('Processing: ' + r.name)
        let q: QueryParts = {
            matchClause: [],
            whereClause: [],
            setClause: [],
            createClause: [],
            variableMap: {},
            elements: []
        }
        let sourceObjects = r.source.objects;
        let sourceAssociations = r.source.associations;
        let targetObjects = r.target.objects;
        let targetAssociations = r.target.associations;

        let idle = sourceObjects.length == 0 || targetObjects.length == 0;

        if (!fwd) {
            sourceObjects = r.target.objects;
            sourceAssociations = r.target.associations;
            targetObjects = r.source.objects;
            targetAssociations = r.source.associations;
        }


        //Ensure that all match objects are different
        if (!basedOnMatch) {
            let sourceIDs = sourceObjects.map(obj => obj.name);
            if (sourceIDs.length > 1)
                q.whereClause.push(this.differentIDs(sourceIDs));
            let targetIDs = targetObjects.filter(o => !o.created).map(obj => obj.name)
            if (targetIDs.length > 1)
                q.whereClause.push(this.differentIDs(targetIDs));
        }
        sourceObjects.forEach(obj => this.processMatchElement(obj, q, basedOnMatch, fwd));
        for (let i = 0; i < targetObjects.length; i++) {
            let obj = targetObjects[i];
            if (obj.created && basedOnMatch) {
                this.processCreateObject(obj, q, fwd, flagCreatedModel)
            } else if (!obj.created) {
                this.processMatchElement(obj, q, basedOnMatch, fwd)
            }
        };
        sourceAssociations.forEach(assoc => this.processMatchElement(assoc, q, basedOnMatch, fwd));
        targetAssociations.forEach(assoc => {
            if (assoc.created && basedOnMatch) {
                this.processCreateAssociation(assoc, q, fwd, flagCreatedModel)
            } else if (!assoc.created) {
                this.processMatchElement(assoc, q, basedOnMatch, fwd)
            }
        })
        r.correspondences?.forEach(c => {
            if (c.created && basedOnMatch) {
                q.createClause.push(this.createStringForCorrespondence(c))
            } else if (!c.created) {
                q.matchClause.push(this.createStringForCorrespondence(c))
            }
        });
        r.nacs?.forEach(nac => {
            let qNac: QueryParts = {
                matchClause: [],
                whereClause: [],
                setClause: [],
                createClause: [],
                variableMap: {},
                elements: []
            }
            if (!idle && nac.isSource == fwd || idle && nac.isSource == (targetObjects.length == 0)) {
                let pattern = this.patterns[nac.name];
                pattern.objects.forEach(obj => {obj.isSource = nac.isSource; this.processMatchElement(obj, qNac, false, nac.isSource, true)})
                pattern.associations.forEach(assoc => {assoc.isSource = nac.isSource;  this.processMatchElement(assoc, qNac, false, nac.isSource,true)})
                qNac.elements = [];
                let queryNac = this.buildQuery(qNac);
                q.whereClause.push(`NOT EXISTS {${queryNac}}`)
            }
        })
        return this.buildQuery(q, r.name, basedOnMatch);
    }

    private buildQuery(q: QueryParts, name: String | null = null, basedOnMatch = false) {
        let query = '';
        if (name)
            query += `//${name}`
        if (basedOnMatch)
            query += '\nUNWIND $matches as match';
        query += `\nMATCH ${q.matchClause.join(',\n')}`;
        if (q.whereClause.length)
            query += `\nWHERE ${q.whereClause.join(' AND\n')}`;
        if (basedOnMatch) {
            query += `\nCREATE ${q.createClause.join(',\n')}`
            query += `\nSET ${q.setClause.join(',\n')}`
        }
        if (q.elements.length)
            query += '\nRETURN ' + q.elements.map(e => `id(${e}) as ${e}`).join(', ');
        return query;
    }

    private getMatchesToApply(ruleMatches: Record<string, Array<Record<string, number>>>): [string, Array<Record<string, number>>] | undefined {
        if (!this.ruleOrder || this.ruleOrder.length == 0)
            return Object.entries(ruleMatches).find((ruleMatch) => ruleMatch[1].length);
        for (let i = 0; i < this.ruleOrder.length; i++) {
            let rule = this.ruleOrder[i];
            if (ruleMatches[rule] && ruleMatches[rule].length)
                return [rule, ruleMatches[rule]];
        }
        return;
    }

    private async findMatches(ruleMatches: Record<string, Array<Record<string, number>>>, sourceModel: string, targetModel: string) {
        ruleMatches = {};
        let awaitingMatches = Object.entries(this.ruleMatchQuery).map(async ([name, ruleQuery]) => {
            let session = driver.session();
            let results = await session.run(ruleQuery, { sourceModel, targetModel });
            let matches = results.records.map(record => record.toObject() as Record<string, number>);
            ruleMatches[name] = matches;
            session.close();
        })
        await Promise.all(awaitingMatches);
        return ruleMatches;
    }

    private operationalize(fwd: boolean, flagCreatedModel = true) {
        this.ruleCreateQuery = {}
        this.ruleMatchQuery = {}
        this.resetLinkNames();
        // Generate Queries
        Object.entries(this.rules).map(([name, rule]) => {
            let query = this.processRule(rule, false, fwd, flagCreatedModel);
            this.ruleMatchQuery[name] = query;
            console.log(query)
            query = this.processRule(rule, true, fwd, flagCreatedModel);
            this.ruleCreateQuery[name] = query;
        })
        console.log('Queries ready');
    }

    getAssociationTypes(source: boolean) {
        let associations : Array<AssociationType> = []
        let metamodel = source ? this.sourceMetamodel : this.targetMetamodel;
        Object.values(this.rules).forEach(rule => {
            let side = source ? rule.source : rule.target;
            side.associations.forEach(assoc => {
                let sourceObject = side.objects.find(o => o.name == assoc.sourceObject);
                let targetObject = side.objects.find(o => o.name == assoc.targetObject);
                if(!sourceObject || !targetObject) throw new Error('Unknown object in association');
                associations.push({name: assoc.assocationName, sourceClass: sourceObject.class, targetClass: targetObject.class});
            })
        })
        Object.values(this.patterns).forEach(pattern => {
            pattern.associations.forEach(assoc => {
                let sourceObject = pattern.objects.find(o => o.name == assoc.sourceObject);
                let targetObject = pattern.objects.find(o => o.name == assoc.targetObject);
                if(!sourceObject || !targetObject) throw new Error('Unknown object in association');
                try {
                    metamodel.getAssociation(sourceObject.class, assoc.assocationName)
                    associations.push({name: assoc.assocationName, sourceClass: sourceObject.class, targetClass: targetObject.class});
                } catch(e) {
                    console.log('Ignoring pattern assocation since it does not belong to the metamodel of the relevant side');
                }
            })
        })
        return associations
    }

    getRuleNames() {
        return Object.keys(this.rules)
    }

    setRuleOptions(ruleOptions: RuleOption[]) {
        this.singleApplicationRule = {};
        ruleOptions = ruleOptions.filter(o => o.enabled);
        ruleOptions.forEach(r => {
            if(!this.rules[r.name])
                console.warn("Rule options contain unknown rule:", r.name);
            else
                this.singleApplicationRule[r.name] = r.individualMatchApplication;
        })
        this.ruleOrder = ruleOptions.map(o => o.name);      

    }

    private printRuleMatches(ruleMatches: Record<string, Record<string, number>[]>) {
        Object.entries(ruleMatches).forEach(([name, matches]) => matches.length ? console.log(name + ': ' + matches.length) : '')
    }

    async transform(fwd: boolean, sourceModel: string, targetModel: string) {
        if(fwd)
            NeoCoreUtils.deleteModel(targetModel);
        else
            NeoCoreUtils.deleteModel(sourceModel);
        this.operationalize(fwd)
        let session = driver.session();

        let modelName = fwd ? sourceModel : targetModel;

        console.log("Adding transformation marker")
        await session.run('MATCH (n {enamespace: $modelName}) SET n._tr_ = false', { modelName });
        await session.run('MATCH (n {enamespace: $modelName})-[r]->(m {enamespace: $modelName}) SET r._tr_ = false', { modelName });

        await session.close();

        let matched;
        let ruleMatched: Record<string,number> = {};
        let ruleMatches: Record<string, Array<Record<string, number>>> = {};

        do {
            matched = false
            console.log("Gathering matches")
            ruleMatches = await this.findMatches(ruleMatches, sourceModel, targetModel);
            this.printRuleMatches(ruleMatches);
            let ruleMatch = this.getMatchesToApply(ruleMatches);
            if (ruleMatch) {
                let session = driver.session();
                let name = ruleMatch[0];
                let matches = ruleMatch[1];
                if(this.singleApplicationRule[name]) {
                    console.log("Only applying single match for:", name);
                    matches = [matches[0]];
                }
                console.log('Applying matches for:', name)
                let results = await session.run(this.ruleCreateQuery[name], { matches, sourceModel, targetModel })
                console.log(`Matched ${name}: ${results.records.length}`);
                matched = results.records.length > 0;
                if(!ruleMatched[name]) ruleMatched[name] = 0;
                ruleMatched[name] += results.records.length;
                session.close();
            } else {
                console.log('No more matches');
            }
        } while (matched)

        session = driver.session();
        // Remove transformation markers for transformed nodes and relationships
        await session.run('MATCH (n {enamespace: $modelName}) WHERE n._tr_ = true REMOVE n._tr_', { modelName })
        await session.run('MATCH (n {enamespace: $modelName})-[r]->(m {enamespace: $modelName}) WHERE r._tr_ = true REMOVE r._tr_', { modelName });

        let untransformed: UntransformedItem[] = [];

        // Identify nodes that have not been transformed
        let results = await session.run('MATCH (n {enamespace: $modelName}) WHERE n._tr_ = false REMOVE n._tr_ RETURN id(n) AS id, labels(n) AS labels, n.id AS itemId', { modelName });
        untransformed.push(...results.records.map(r => ({ id: r.get('id'), labels: r.get('labels'), itemId: r.get('itemId') })));

        // Identify relationships that have not been transformed
        results = await session.run('MATCH (n {enamespace: $modelName})-[r]->(m {enamespace: $modelName}) WHERE r._tr_ = false REMOVE r._tr_ RETURN id(r) AS id, r.id AS itemId, type(r) AS type', { modelName });
        untransformed.push(...results.records.map(r => ({ id: r.get('id'), type: r.get('type'), itemId: r.get('itemId') })));
        console.log("Untransformed: ", untransformed);

        // Attach model to respective metamodel
        if (fwd)
            await NeoCoreUtils.registerModel(targetModel, this.targetMetamodel.name, session)
        else
            await NeoCoreUtils.registerModel(sourceModel, this.sourceMetamodel.name, session)
        session.close();

        console.log("Ended");
        for(const [rule, count] of Object.entries(ruleMatched)) {
            console.log(`${rule} matched: ${count}`);
        }
        console.log(this.ruleOrder)
        return untransformed;
    }

}