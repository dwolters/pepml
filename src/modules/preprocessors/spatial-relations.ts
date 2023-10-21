import { Session } from 'neo4j-driver';
import { PLACEMENT_OFFSET } from '../constants-pepml'
import { AssociationType } from '../model-transformer';

export class UnclearContainmentError extends Error {
    unclearContainmentIds: Array<Array<string>>
    constructor(unclearContainmentIds: Array<Array<string>>) {
        super(`The following nodes violate containment rules: ${unclearContainmentIds}`);
        this.unclearContainmentIds = unclearContainmentIds;
        this.name = "UnclearContainmentError";
    }
}

function generateSpatialRelationQuery(spatialRelation: string, sourceType: string, targetType: string, sameParent: boolean) {
    let query = `MATCH(s:Miro__${sourceType} {enamespace: $modelName}), (t:Miro__${targetType} {enamespace: $modelName}) WHERE id(s) <> id(t)`
    if(sameParent && spatialRelation != 'contains') {
        query += `\nOPTIONAL MATCH (ps:Miro__GeometricItem)-[:contains]->(s)
        OPTIONAL MATCH (pt:Miro__GeometricItem)-[:contains]->(t)
        WITH s,t,ps,pt
        WHERE coalesce(id(pt),-1) = coalesce(id(ps),-1)\n`;
    }
    query += '\nWITH s,t WHERE ('
    let and = (left: string, right: string) => `(${left} AND ${right})`;
    let or = (left: string, right: string) => `(${left} OR ${right})`;
    let horizontal = (s: string, t: string) => `(${s}.yMin - ${PLACEMENT_OFFSET} <= ${t}.yMin  AND ${s}.yMax + ${PLACEMENT_OFFSET} >= ${t}.yMax)`;
    let vertical = (s: string, t: string) => `(${s}.xMin - ${PLACEMENT_OFFSET} <= ${t}.xMin AND ${s}.xMax + ${PLACEMENT_OFFSET} >= ${t}.xMax)`;
    let left = (s: string, t: string) => `(${s}.xMin + ${PLACEMENT_OFFSET} >= ${t}.xMax)`;
    let right = (s: string, t: string) => `(${s}.xMax - ${PLACEMENT_OFFSET} <= ${t}.xMin)`;
    let top = (s: string, t: string) => `(${s}.yMin + ${PLACEMENT_OFFSET} >= ${t}.yMax)`;
    let bottom = (s: string, t: string) => `(${s}.yMax - ${PLACEMENT_OFFSET} <= ${t}.yMin)`;
    let north = (s: string, t: string) => and(vertical(s,t),top(s,t));
    let east = (s: string, t: string) => and(right(s,t),horizontal(s,t));
    let south = (s: string, t: string) => and(vertical(s,t),bottom(s,t));
    let west = (s: string, t: string) => and(left(s,t) , horizontal(s,t));
    let contains = (s: string, t: string) => and(horizontal(s,t), vertical(s,t));

    let spatialRelations: { [id: string]: string } = {
        left: or(left('s', 't'),right('t','s')),
        right: or(right('s', 't'),left('t','s')),
        top: or(top('s', 't'),bottom('t','s')),
        bottom: or(bottom('s', 't'),top('t','s')),
        east: or(east('s', 't'),west('t','s')),
        west: or(west('s', 't'),east('t','s')),
        north: or(north('s', 't'),south('t','s')),
        south: or(south('s', 't'),north('t','s')),
        contains: contains('s','t')
    }
    query += spatialRelations[spatialRelation];
    query += ")\n CREATE (s)-[r:" + spatialRelation + "]->(t)";
    return query;
}

function deleteTransitiveRelationQuery(relationshipType: string) {
    return `MATCH (a)-[r:${relationshipType}]->(c),(a)-[:${relationshipType}]->(b), (b)-[:${relationshipType}]->(c) WHERE id(a) <> id(b) AND id(b) <> id(c) AND id(a) <> id(c) AND a.enamespace = b.enamespace AND b.enamespace = c.enamespace AND a.enamespace = $modelName DELETE r`
}

export async function determineSpatialRelation(modelName: string, session: Session, associationTypes: AssociationType[] = []) {
    let spatialRelations = ['left', 'right', 'top', 'bottom', 'north', 'east', 'south', 'west'];
    let relevantAssocationTypes = associationTypes.filter(at => spatialRelations.includes(at.name))
    let processedAssocationTypes: string[] = [];
    let usedSpatialRelations: string[] = []
    for await (const at of relevantAssocationTypes) {
        let serializedAssocationType = JSON.stringify(at);
        if (processedAssocationTypes.includes(serializedAssocationType)) continue;
        processedAssocationTypes.push(serializedAssocationType);
        if (!usedSpatialRelations.includes(at.name)) usedSpatialRelations.push(at.name);
        console.log(`Running spatial preprocessors for ${serializedAssocationType}`);
        await session.run(generateSpatialRelationQuery(at.name, at.sourceClass, at.targetClass, true), { modelName });
    }
    for await (const spatialRelation of usedSpatialRelations) {        
        await session.run(deleteTransitiveRelationQuery(spatialRelation), { modelName });
    }
}

export async function determineContainment(modelName: string, session: Session, associationTypes: AssociationType[] = []) {
    console.log('Running containment preprocessor:', modelName);
    let relevantAssocationTypes = associationTypes.filter(at => at.name == 'contains');
    let processedAssocationTypes: string[] = [];
    for await (const at of relevantAssocationTypes) {
        let serializedAssocationType = JSON.stringify(at);
        if (processedAssocationTypes.includes(serializedAssocationType)) continue;
        processedAssocationTypes.push(serializedAssocationType);  
        try {      
            await session.run(generateSpatialRelationQuery('contains', at.sourceClass, at.targetClass, false), { modelName });
        } catch(e) {
            console.log(e);
        }
    }
    await session.run(deleteTransitiveRelationQuery('contains'), { modelName });
    let query = `
        MATCH (p {enamespace: $modelName}), (c {enamespace: $modelName})
        WHERE id(p) <> id(c) AND NOT EXISTS { MATCH (p)-[:contains*]->(c) } AND NOT EXISTS { MATCH (c)-[:contains*]->(p) } AND 
        c.x >= p.xMin - ${PLACEMENT_OFFSET} AND c.x <= p.xMax + ${PLACEMENT_OFFSET} AND
        c.y >= p.yMin - ${PLACEMENT_OFFSET} AND c.y <= p.yMax + ${PLACEMENT_OFFSET} AND (
        c.xMin < p.xMin - ${PLACEMENT_OFFSET} OR c.xMax > p.xMax + ${PLACEMENT_OFFSET} OR
        c.yMin < p.yMin - ${PLACEMENT_OFFSET} OR c.yMax > p.yMax + ${PLACEMENT_OFFSET}
        )
        RETURN p.id AS parent, c.id AS child
    `
    let unclearContainment = await session.run(query, { modelName });
    if (unclearContainment.records.length > 0) {
        let e = new UnclearContainmentError(unclearContainment.records.map(r => [r.get('parent'), r.get('child')]));
        console.error(e);
        throw e;
    }
}


