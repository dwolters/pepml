import { Connector, Item } from '@mirohq/websdk-types';
import { getSession, closeSession, driver } from './neo';
import { deleteModel, registerModel } from './neocore-utils';
import {runPreprocessors} from './preprocessors'
import { adjustConnectorDirection, getNameFromContent, placeDecorator } from './miro-board-utils';
import { Decorator } from './decorators';
import decorators from './decorators';
export interface MappedGeometricItem {
    labels: string[]
    id: string
    x?: number
    y?: number
    xMin?: number
    yMin?: number
    xMax?: number
    yMax?: number
    width?: number
    height?: number
    title?: string
    url?: string
    rotation?: number
    content?: string
    borderStyle?: string
}
export async function geometricItemMapping(item: Item) {
    let obj: MappedGeometricItem = {
        labels: ['Item'],
        id: item.id,
    }
    addDimensionMinMax(item, obj);
    let relevantProperties = ['x', 'y', 'width', 'height'];
    let metaData = await item.getMetadata();
    for (let key in metaData) {
        // @ts-ignore
        obj['meta_' + key] = metaData[key];
    }
    obj.labels.push('GeometricItem')
    switch (item.type) {
        case 'connector':
            return obj;
        case 'app_card':
            relevantProperties.push('title');
            obj.labels.push('AppCard')
            return finalizeMapping(item, obj, relevantProperties);
        case 'image':
            relevantProperties.push('title', 'url', 'rotation');
            obj.labels.push('Image')
            return finalizeMapping(item, obj, relevantProperties);
        case 'frame':
            relevantProperties.push('title');
            obj.labels.push('Frame')
            return finalizeMapping(item, obj, relevantProperties);
        case 'text':
            relevantProperties.push('content', 'rotation');
            obj.labels.push('ContentItem')
            obj.labels.push('Text')
            return finalizeMapping(item, obj, relevantProperties);
        case 'shape':
            relevantProperties.push('content', 'rotation', 'style.borderStyle');
            obj.labels.push('ContentItem')
            obj.labels.push('Shape')
            obj.labels.push(item.shape)
            return finalizeMapping(item, obj, relevantProperties);
        case 'sticky_note':
            relevantProperties.push('content');
            obj.labels.push('ContentItem')
            obj.labels.push('StickyNote')
            return finalizeMapping(item, obj, relevantProperties);
    }
    return obj
}

function generateQueryForDecorator(decorator: Decorator) {
    let query = `MATCH (s${decorator.sourceType ? ':' + decorator.sourceType : ''} {enamespace: $sourceModel})-[:corr]->(t${decorator.targetType ? ':' + decorator.targetType : ''} {enamespace: $targetModel})`;
    if(decorator.targetType == 'PEPML__EducationComponent') {
        query = `MATCH (s${decorator.sourceType ? ':' + decorator.sourceType : ''} {enamespace: $sourceModel})-[:corr]->(t:PEPML__EducationComponent {enamespace: $targetModel})
                OPTIONAL MATCH (t)<-[:contains*]-(c:PEPML__EducationComposite {enamespace: $targetModel})
                WITH s,t, coalesce(t.isSync, head(collect(c.isSync))) as isSync, coalesce(t.isOnline,head(collect(c.isOnline))) as isOnline`
    } else if (decorator.optionalMatch && decorator.value) {
        query += '\nOPTIONAL MATCH ' + decorator.optionalMatch
        query += '\nWITH s,t,' + decorator.value + ' as value'
    } else if (decorator.optionalMatch || decorator.value) {
        console.log(decorator)
        throw new Error('Optional Match and Value must be set together for a decorator');
    }
    if (decorator.constraint) {
        let constraint = decorator.constraint;
        if(decorator.nullAsFalse)
            constraint = constraint.replace(
                /([\w\d-_]+\.[\w\d-_]+)\s=\sfalse/g,
                (_, p1) => `coalesce(${p1}, false) = false`
            )
        query += '\nWHERE ' + constraint;
    }
    query += '\nRETURN s.id AS itemId';
    if (decorator.value)
        query += ', value';
    return query;
}

export async function addDecorators(sourceModel: string, targetModel: string) {
    decorators.forEach(async decorator => {
        let session = driver.session();
        try {
            let query = generateQueryForDecorator(decorator);
            console.log(query);
            let results = await session.run(query, { sourceModel, targetModel });
            results.records.forEach(r => {
                let itemId = r.get('itemId')
                let url = decorator.url;
                if (decorator.value && decorator.valueMap) {
                    let value = r.get('value');
                    let mappedvalue = decorator.valueMap.find(e => e.value == value);
                    if (mappedvalue)
                        url = mappedvalue.url
                }
                console.log(`Applying decator ${decorator.name} to ${itemId}`);
                return placeDecorator(itemId, url, decorator.name, decorator.placement)
            })

        } finally {
            session.close();
        }
    })
}

function finalizeMapping(item: Item, obj: MappedGeometricItem, relevantProperties: string[]) {
    relevantProperties.forEach(prop => assignProperty(obj, item, prop));
    return obj;
}

function assignProperty(target: object, source: object, prop: string) {
    if (prop.indexOf('.') == -1) {
        // @ts-ignore
        target[prop] = source[prop];
    } else {
        let first = prop.substring(0, prop.indexOf('.'));
        let second = prop.substring(prop.indexOf('.') + 1);
        // @ts-ignore
        assignProperty(target, source[first], second);
    }
}

function addDimensionMinMax(item: Item, properties: MappedGeometricItem) {
    if (item.type == "connector" || item.type == "unsupported") return;
    // @ts-ignore
    properties.xMin = item.x - item.width / 2;
    // @ts-ignore
    properties.xMax = item.x + item.width / 2;
    // @ts-ignore
    properties.yMin = item.y - item.height / 2;
    // @ts-ignore
    properties.yMax = item.y + item.height / 2;
}

export function mapToLabel(type: string) {
    return "Miro__" + type[0].toUpperCase() + type.substring(1).replace(/_./g, match => match.charAt(1).toUpperCase());
}

export function mapToLabels(labels: string[]) {
    return labels.map(label => mapToLabel(label));
}


export function generateSetStatement(obj: MappedGeometricItem) {
    let setStatement = [];
    setStatement.push('i.ename = $id');
    setStatement.push('i.enamespace = $modelName');
    for (let key in obj) {
        if (key == 'labels') continue;
        // @ts-ignore
        if (obj[key] === undefined) {
            continue;
        }
        setStatement.push('i.' + key + " = $" + key);
    }
    return setStatement.join(',\n');
}

export interface CorrespondingNode {
    id: number,
    name: string,
    types: string[]
    properties: CorrespondingNodeProperty[]
}

export interface CorrespondingNodeProperty {
    name: string
    value: unknown
    valueType: "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";
    isPredefined?: boolean
    error?: string
}

export async function getCorrespondingNode(itemId: string): Promise<CorrespondingNode | undefined> {
    const session = getSession();
    try {
        let results = await session.run('MATCH (i:Miro__Item)-[:corr]->(p:PEPML__Entity) WHERE i.id = $itemId RETURN id(p) as id, labels(p) as labels, properties(p) as props', { itemId });
        if (results.records.length) {
            let record = results.records[0];
            let id = record.get('id');
            let types: string[] = record.get('labels');
            types = types.map(l => l.substring(l.indexOf('__') + 2));
            types = types.filter(t => t != 'EObject');
            let propertiesObject = record.get('props');
            let name = propertiesObject.name;
            delete propertiesObject.enamespace;
            let properties = Object.entries(propertiesObject).map(([name, value]) => { return { name, value, valueType: typeof value } });
            return { id, name, types, properties };
        };
        return;
    } finally {
        await closeSession();
    }
}

export function getTypeFromLabels(labels: string[]) {
    if (!labels || !Array.isArray(labels) || labels.length == 0) throw new Error('Cannot get type from empty or undefined labels array');
    return labels[labels.length - 1].replace(/^\w+__/, '');
}

export class InvalidConnector extends Error {
    invalidConnectors: Array<{ id: string, reason: string }>
    constructor(invalidConnectors: Array<{ id: string, reason: string }>) {
        super(`Invalid Connectors: ${invalidConnectors}`);
        this.invalidConnectors = invalidConnectors;
        this.name = "InvalidConnectorError";
    }
}


export async function extractModel(items: Item[], modelName: string, tggName: string) {
    adjustConnectorDirection();
    const info = await miro.board.getInfo()
    const boardId = info.id;
    //First all items but frames, then frames, connectors last (requires all items)
    items.sort((itemA, itemB) => {
        if (itemA.type == itemB.type)
            return itemA.id.localeCompare(itemB.id);
        if (itemA.type != 'frame' && itemA.type != 'connector')
            return -1;
        if (itemA.type == 'frame' && itemB.type == 'connector')
            return -1;
        return 1;
    });
    await deleteModel(modelName);
    const session = getSession();
    try {
        let connectors: Connector[] = [];
        await session.writeTransaction(async tx => {
            // Delete full model from Neo4j (TEMPORARY!!)
            //await tx.run('MATCH (n) WHERE n.ename = $modelName or n.enamespace = $modelName DETACH DELETE n', { modelName });

            // Add node for representing the model
            await registerModel(modelName, 'Miro', tx);
            // Add node representing the Miro Board
            await tx.run(`CREATE(n: NeoCore__EObject: Miro__Board { enamespace: $modelName, ename: $modelName, id: $boardId })`, { modelName, boardId });
            // Add all items except connectors
            await Promise.all(items.map(async item => {
                if (item.type == 'connector') {
                    connectors.push(item);
                    return;
                }
                let mappedItem = await geometricItemMapping(item);
                let query = `CREATE(i: NeoCore__EObject: ${mapToLabels(mappedItem.labels).join(':')
                    } { id: '${item.id}' })
                    SET ${generateSetStatement(mappedItem)} `;
                tx.run(query, { ...mappedItem, modelName });
                if(item.type == 'app_card' && Array.isArray(item.fields)) {
                    tx.run(`UNWIND $fields AS field
                    CREATE (f:NeoCore__EObject:Miro__Field {enamespace: $modelName, value: field.value, tooltip: field.tooltip, iconUrl: field.iconUrl})
                    WITH f
                    MATCH(ac: Miro__Item { id: $id })
                    CREATE (ac)-[r:fields]->(f)`, { fields: item.fields, id: item.id, modelName });
                }
                    
                if (item.type == 'frame') {
                    // Since frame are sorted such that they occur after other items, we can expect the child items to be in the database
                    tx.run(`UNWIND $children AS child
                    MATCH(c: Miro__Item { id: child }), (f: Miro__Frame { id: $frame })
                    CREATE (f) - [r: children] -> (c)`, { frame: item.id, children: item.childrenIds })
                }
            }));
        });
        await session.writeTransaction(async tx => {
            let connectorData: Array<{
                id: string
                startItem: string
                endItem: string
                startCap: string | undefined
                endCap: string | undefined
                startCaption: string | undefined
                caption: string | undefined
                endCaption: string | undefined
            }> = [];
            // Add all connectors
            let invalidConnectors: Array<{ id: string, reason: string }> = [];
            connectors.forEach(connector => {
                let startCaption: string | undefined;
                let caption: string | undefined;
                let endCaption: string | undefined;
                connector.captions?.forEach(c => {
                    console.log(c.position);
                    if (c.position && c.content && c.position <= 0.33) {
                        if (startCaption)
                            invalidConnectors.push({ id: connector.id, reason: "Multiple begin captions" });
                        startCaption = c.content;
                    }
                    if (c.position && c.content && c.position > 0.33 && c.position <= 0.67) {
                        if (caption)
                            invalidConnectors.push({ id: connector.id, reason: "Multiple middle captions" });
                        caption = c.content;
                    }
                    if (c.position && c.content && c.position > 0.67) {
                        if (endCaption)
                            invalidConnectors.push({ id: connector.id, reason: "Multiple end captions" });
                        endCaption = c.content;
                    }
                })
                if (!connector.start || !connector.end) {
                    invalidConnectors.push({ id: connector.id, reason: "Dangling connector" });
                    return;
                }
                connectorData.push({
                    id: connector.id,
                    startItem: connector.start.item,
                    endItem: connector.end.item,
                    startCap: connector.style.startStrokeCap,
                    endCap: connector.style.endStrokeCap,
                    startCaption,
                    caption,
                    endCaption
                })
            });
            if (invalidConnectors.length > 0)
                throw new InvalidConnector(invalidConnectors);
            let query = `UNWIND $connectorData as con
                        MATCH
                            (s: ${mapToLabel('Item')} { id: con.startItem }),
                            (e: ${mapToLabel('Item')} { id: con.endItem })
                        MERGE(s) - [c: connectedTo] -> (e)
                             SET c.id = con.id, c.startCap = con.startCap, c.endCap = con.endCap, c.startCaption = con.startCaption, c.caption = con.caption, c.endCaption = con.endCaption
                        `;
            tx.run(query, { connectorData });

        });
        // Add all items to the board.
        await session.run("MATCH (b:Miro__Board), (i:Miro__Item) WHERE i.enamespace = b.enamespace MERGE (b)-[r:items]->(i) RETURN r");
        //await session.run("MATCH (i:Miro__Item) WHERE i.enamespace = $modelName AND NOT i.id IN $itemIds SET i._de_ = true", { itemIds });
        //await session.run("MATCH (s:Miro__Item)-[r]->(t:Miro__Item) WHERE s.enamespace = t.enamespace AND t.enamespace = $modelName WHERE NOT i.id IN $itemIds SET r._de_ = true", { itemIds });
        //await session.run("MATCH (s:Miro__Item)-[r]->(t:Miro__Item) WHERE s.enamespace = t.enamespace AND t.enamespace = $modelName WHERE NOT r._cr_ AND NOT r._ex_ SET r._de_ = true");
        await runPreprocessors(modelName, tggName, session);
        // Remove all nodes that have been created and deleted without being transformed between that.
        //await session.run("MATCH (i:Miro__Item) WHERE i._cr_ = true AND i._de_ DETACH DELETE i");
    } finally {
        await closeSession()
    }
}

export interface NodeRef {
    id: string,
    type: string,
    name: string
}

export interface RelationshipRef {
    id: string,
    type: string,
    startId: string,
    startType: string,
    startName: string,
    endId: string,
    endType: string,
    endName: string
}

export async function decodeInconsistencies(nodeIds: number[], relationshipIds: number[]) {
    let nodes: NodeRef[] = [];
    let relationships: RelationshipRef[] = [];

    const session = getSession();
    try {
        let queryNodes = `UNWIND $nodeIds AS id
MATCH(n)
                          WHERE ID(n) = id
                          RETURN n.id, labels(n), n.content`;
        let result = await session.run(queryNodes, { nodeIds });
        result.records.forEach(record => {
            nodes.push({
                id: record.get(0),
                type: getTypeFromLabels(record.get(1)),
                name: getNameFromContent(record.get(2))
            });
        });
        let queryRelationships = `UNWIND $relationshipIds AS id
MATCH(s) - [r] -> (e)
                                  WHERE ID(r) = id
                                  RETURN r.id, type(r), s.id, labels(s), s.content, e.id, labels(e), e.content`;
        result = await session.run(queryRelationships, { relationshipIds });
        result.records.forEach(record => {
            relationships.push({
                id: record.get(0),
                type: record.get(1),
                startId: record.get(2),
                startType: getTypeFromLabels(record.get(3)),
                startName: getNameFromContent(record.get(4)),
                endId: record.get(5),
                endType: getTypeFromLabels(record.get(6)),
                endName: getNameFromContent(record.get(7))
            });
        });
    } finally {
        await closeSession();
    }
    return { nodes, relationships };
}