import { Session, Transaction } from "neo4j-driver";
import { getSession, closeSession, driver } from "./neo";

export async function getAttributes(types: string[]) {
    let attributeTypes = [];
    const session = getSession();
    try {
        let results = await session.run(`
        MATCH (n:NeoCore__EClass)-[:eAttributes]->(a)-[:eAttributeType]->(t)
        WHERE n.ename IN $types
        RETURN a.ename AS name, t.ename AS type
    `, { types });
        for (let i = 0; i < results.records.length; i++) {
            let record = results.records[i];
            let name = record.get<string>("name");
            let type = record.get<string>("type");
            let typeMap: { [id: string]: string } = {
                "EString": "string",
                "EBoolean": "boolean",
                "EInt": "number",
                "EDouble": "number",
            }
            if (!typeMap[type]) throw new Error('Unknown type');
            type = typeMap[type];
            attributeTypes.push({ name, type });
        }
        return attributeTypes;
    } finally {
        await closeSession();
    }
}

export async function getSubclasses(type: string): Promise<string[]> {
    const session = driver.session();
    try {
        let results = await session.run(`
            MATCH (n)<-[:eSuperType*]-(connectedNode)
            WHERE n.ename = $type
            RETURN connectedNode.ename AS name
        `, { type });

        return results.records.map(r => r.get<string>('name'));
    } finally {
        session.close();
    }
}

// export async function getLabelsForType(type: string, metamodel: string): Promise<string[]> {
//     const session = driver.session();
//     try {
//         let results = await session.run(`
//             MATCH (s)<-[:eSuperType*]-(n)
//             WHERE n.ename = $type AND n.enamespace = $metamodel
//             RETURN s.enamespace + '__' + s.ename AS name
//         `, { type, metamodel });
//         let labels = results.records.map(r => r.get<string>('name'));
//         labels.push(metamodel + '__' + type);
//         return labels;
//     } finally {
//         session.close();
//     }
// }

export async function deleteModel(modelName: string, corrModelName: string | undefined = undefined) {
    const session = getSession();
    try {
        await session.run('MATCH (n:NeoCore__Model) WHERE n.ename = $modelName DETACH DELETE n', { modelName });
        await session.run('MATCH (n {enamespace: $modelName}) DETACH DELETE n', { modelName });

    } finally {
        await closeSession();
    }
}

export async function deleteFromMergedModel(sourceModel: string, mergedModel: string) {
    const session = getSession();
    try {
        let results = await session.run(`MATCH (n {enamespace:$sourceModel})-[:corr]->(m {enamespace: $mergedModel})
                         WHERE size([x IN m.__created WHERE x STARTS WITH $sourceModel]) = 1
                         RETURN id(m) as id, properties(m) as props, labels(m) as labels`,
            { sourceModel, mergedModel });
        let deleteNodes: number[] = [];
        let updateNodes: Record<number, { remove: string[], update: string[] }> = {};
        results.records.forEach(r => {
            let id = r.get('id');
            let props = r.get('props');
            let labels: string[] = r.get('labels');
            if (props.__created.length == 1) {
                //TODO store unique properties
                deleteNodes.push(id);
            } else {
                updateNodes[id] = getPropertyChanges(sourceModel, props)

                // Find labels solely added by the model
                let labelsFromOtherModels: string[] = [];
                props.__created.forEach((entry: string) => {
                    let labels = entry.split(':');
                    let name = labels.shift();
                    if (sourceModel == name) return;
                    labels.forEach(l => { if (!labelsFromOtherModels.includes(l)) labelsFromOtherModels.push(l) });
                });
                let removeLabels = labels.filter(l => !labelsFromOtherModels.includes(l));
                if (removeLabels.length > 0)
                    updateNodes[id].remove.push(':' + removeLabels.join(':'))

                let filteredCreated = props['__created'].filter((e: string) => e.indexOf(sourceModel + ':') != 0);
                updateNodes[id].update.push(`__created = ["${filteredCreated.join('","')}"]`)
            }
        })
        //Delete nodes that are solely added by the source model
        await session.run('MATCH (n) WHERE id(n) IN $deleteNodes DETACH DELETE n', { deleteNodes })

        //Removing information from source model from remaining nodes
        for (let id in updateNodes) {
            let remove = updateNodes[id].remove;
            let update = updateNodes[id].update;
            if (remove.length == 0 && update.length == 0) continue;
            let query = 'MATCH (n) WHERE id(n) = ' + id;
            if (update.length)
                query += ' SET n.' + update.join(', n.')
            if (remove.length)
                query += ' REMOVE n' + remove.join(', n')
            await session.run(query);
        }

        //Delete all relationships solely added by this model
        //This affects all relationships that cannot be merged due to property conflicts
        await session.run(`MATCH ()-[r]->()
                         WHERE size([x IN r.__created WHERE x STARTS WITH $sourceModel]) = 1
                         AND size(r.__created) = 1
                         DELETE r`,
            { sourceModel });

        results = await session.run(`MATCH ()-[r]->()
                         WHERE size([x IN r.__created WHERE x STARTS WITH $sourceModel]) = 1
                         RETURN id(r) as id, properties(r) as props`,
            { sourceModel });
        let updateRelationships: Record<number, { remove: string[], update: string[] }> = {};
        results.records.forEach(r => {
            let id = r.get('id');
            let props = r.get('props');
            updateRelationships[id] = getPropertyChanges(sourceModel, props)
        })

        //Remove information from relationships
        for (let id in updateRelationships) {
            let remove = updateRelationships[id].remove;
            let update = updateRelationships[id].update;
            if (remove.length == 0 && update.length == 0) continue;
            let query = 'MATCH ()-[n]->() WHERE id(n) = ' + id;
            if (update.length)
                query += ' SET n.' + update.join(', n.')
            if (remove.length)
                query += ' REMOVE n' + remove.join(', n')
            console.log(query);
            await session.run(query);
        }

    } finally {
        await closeSession();
    }
}

function getPropertyChanges(sourceModel: string, props: any) {
    let update: string[] = [];
    let remove: string[] = [];
    let filtered = props['__created'].filter((e: string) => e.indexOf(sourceModel) != 0);
    update.push(`__created = ["${filtered.join('","')}"]`);
    // Find properties solely added by this model
    for (let key in props) {
        if (props['__created_' + key] && props['__created_' + key].includes(sourceModel)) {
            if (props['__created_' + key].length == 1) {
                // The '.' is needed to also allow the removal of labels
                remove.push('.' + key)
                remove.push('.__created_' + key)
            } else {
                filtered = props['__created_' + key].filter((e: string) => e != sourceModel);
                update.push(`__created_${key} = ["${filtered.join('","')}"]`)
            }
        }
    }
    return { update, remove };
}


export async function deleteCreateFlag(modelName: string) {
    const session = getSession();
    try {
        // Remove all _cr_ properties on already extracted items.
        await session.run('MATCH (n) WHERE n.enamespace = $modelName and n.`_cr_`=true REMOVE n.`_cr_`', { modelName })
        await session.run('MATCH (n)-[r]->(m) WHERE n.enamespace = $modelName AND m.enamespace=n.enamespace and r.`_cr_`=true REMOVE r.`_cr_`', { modelName })
    } finally {
        await closeSession();
    }
}

export async function getModelsForMetamodel(metamodelName: string, filterTemp = true): Promise<string[]> {
    let session = getSession()
    let results = await session.run(`MATCH (n:NeoCore__Model)-[r:conformsTo]->(m:NeoCore__MetaModel {ename: $metamodelName}) RETURN n.ename AS name`, { metamodelName });
    let names = results.records.map(r => r.get('name')).filter(n => filterTemp && n.indexOf('_tmp') == -1);
    await closeSession();
    return names;
}

export async function mergeInto(sourceModel: string, targetModel: string) {
    let session = getSession()
    //Find common entities based on same name
    //TODO Information on how to compare nodes during merge should be specified exernally
    let results = await session.run(`
        MATCH (s {enamespace:$sourceModel}), (t {enamespace: $targetModel}) 
        WHERE (s.name = t.name) OR (s:PEPML__EducationProgramme AND t:PEPML__EducationProgramme)
        RETURN id(s) as sId, id(t) as tId, labels(s) as sLabels, labels(t) as tLabels, properties(s) as sProps, properties(t) as tProps`, { sourceModel, targetModel });
    //TODO catch problem that a node may have multiple partners.
    let matches: Array<{ source: number, target: number, props: any }> = [];
    for await (let r of results.records) {
        let sId = r.get('sId');
        let tId = r.get('tId');
        let sLabels = r.get('sLabels') as string[];
        let tLabels = r.get('tLabels') as string[];
        let sProps = r.get('sProps');
        let tProps = r.get('tProps');
        //Check type compatibility
        let sUniqueLabels = sLabels.filter(l => !tLabels.includes(l));
        let tUniqueLabels = tLabels.filter(l => !sLabels.includes(l));
        if (sUniqueLabels.length && tUniqueLabels.length) {
            console.warn(`Name (${sProps.name}) of entities ${sId} and ${tId} is equal, but types mismatch: ${sUniqueLabels} != ${tUniqueLabels}`);
            continue;
        }
        
        //Check property compatibility
        let props = compatibleProperties(sProps, tProps, sId, tId)
        if (!props) continue;
        props['__created'] = sProps['__created'].concat(tProps['__created']);
        props['enamespace'] = targetModel

        matches.push({ source: sId, target: tId, props});
    };
    console.log('Matching entities:', matches);

    //Merge entities
    try {
        await session.run(`
        UNWIND $matches as m
        MATCH (s),(t)
        WHERE id(s) = m.source AND id(t) = m.target
        WITH s,t, m.props AS props
        CALL apoc.refactor.mergeNodes([s,t], {properties: {
            \`.*\`: 'discard'
        }})
        YIELD node
        SET node = props
        RETURN node`, { matches });
    } catch (err) {
        console.log(`Error in query\n${err}`)
    }

    //Change enamespace of source model to target model
    console.log(`Changing ${sourceModel} to ${targetModel}`)
    await session.run(`MATCH (s {enamespace:$sourceModel}) SET s.enamespace = $targetModel`, { sourceModel, targetModel });
    
    //Merge relationships
    results = await session.run(`
        MATCH (s)-[r1]->(t)
        WHERE s.enamespace = t.enamespace AND s.enamespace = $targetModel
        MATCH (s)-[r2]->(t) 
        WHERE type(r1) = type(r2) AND id(r1) < id(r2)
        RETURN id(r1) as r1Id, id(r2) as r2Id, properties(r1) as r1Props, properties(r2) as r2Props`, { sourceModel, targetModel });
    matches = [];
    console.log("Results:", results.records);
    for (let r of results.records) {
        let r1Id = r.get('r1Id');
        let r2Id = r.get('r2Id');
        let r1Props = r.get('r1Props');
        let r2Props = r.get('r2Props');
        //Check property compatibility
        let props = compatibleProperties(r1Props, r2Props, r1Id, r2Id)
        if (!props) continue;
        props['__created'] = r1Props['__created'].concat(r2Props['__created']);
        props['enamespace'] = targetModel

        matches.push({ source: r1Id, target: r2Id, props });
    };
    console.log('Matching relations:', matches);

    //Merge entities
    try {
        //Delete one relations
        await session.run(`
        UNWIND $matches as m
        MATCH ()-[r]->()
        WHERE id(r) = m.target
        DELETE r`, { matches });

        //Add all properties to the other
        await session.run(`
        UNWIND $matches as m
        MATCH ()-[r]->()
        WHERE id(r) = m.source
        SET r = m.props`, { matches });
    } catch (err) {
        console.log(`Error in query\n${err}`)
    }

    //Delete old source model node
    await deleteModel(sourceModel)
    await closeSession();
}

function compatibleProperties(sProps: any, tProps: any, sId: number, tId: number) {
    let props: any = {};
    let keys = Object.keys(sProps).concat(Object.keys(tProps)).filter(k => k.indexOf('__created') == -1 && k != 'enamespace');
    for (let key of keys) {
        if(sProps[key] && !tProps[key]) {
            props[key] = sProps[key]
            props['__created_' + key] = sProps['__created_' + key]
        }
        if(!sProps[key] && tProps[key]) {
            props[key] = tProps[key]
            props['__created_' + key] = tProps['__created_' + key]
        }
        if(sProps[key] && tProps[key] && sProps[key] == sProps[key]) {
            props[key] = sProps[key]
            console.log(key)
            props['__created_' + key] = sProps['__created_' + key].concat(tProps['__created_' + key])
        }
        if (sProps[key] && tProps[key] && sProps[key] != sProps[key]) {
            console.warn(`Name (${sProps.name}) of entities ${sId} and ${tId} is equal, but properties for key '${key}' mismatch: ${sProps[key]} != ${tProps[key]}`)
            return undefined;
        }
    }
    return props;
}

export async function registerModel(modelName: string, metamodelName: string, session: Session | Transaction | undefined = undefined) {
    let newSession = false;
    if (!session) {
        newSession = true;
        session = getSession()
    }
    await session.run(`CREATE (n:NeoCore__EObject:NeoCore__Model {ename:$modelName})
                       WITH n
                       MERGE (m:NeoCore__MetaModel {ename: $metamodelName})
                       CREATE (n)-[r:conformsTo]->(m)`,
        { modelName, metamodelName });
    if (newSession)
        await closeSession();
}


export async function copyModel(sourceModelName: string, targetModelName: string) {
    console.log('Deleting: ', targetModelName);
    await deleteModel(targetModelName);

    try {
        const session = getSession()

        console.log(`Copying ${sourceModelName} to ${targetModelName}`);
        // Add node for representing the model
        await session.run('MERGE (n:NeoCore__EObject:NeoCore__Model {ename:$targetModelName})', { targetModelName });
        // Attach model to respective metamodel
        await session.run(`MATCH 
                (m:NeoCore__MetaModel {ename: "Miro"}),
                (n:NeoCore__Model {ename:$targetModelName})
                MERGE (n)-[r:conformsTo]->(m)`,
            { targetModelName });
        await session.run(`MATCH 
                      (s {enamespace:$sourceModelName})
                      CREATE (t)
                      SET t = s, t.enamespace = $targetModelName, t._copyOf_ = id(s)
                      WITH s,t
                      CALL apoc.create.addLabels(id(t),labels(s))
                      YIELD node
                      RETURN node
                      `,
            { sourceModelName, targetModelName });
        await session.run(`MATCH 
                (s1 {enamespace:$sourceModelName})-[sr]->(s2 {enamespace:$sourceModelName})
                MATCH (t1 {_copyOf_: id(s1), enamespace: $targetModelName}), (t2 {_copyOf_: id(s2), enamespace: $targetModelName})
                CALL apoc.create.relationship(t1, type(sr), properties(sr), t2)
                YIELD rel
                RETURN rel
                `,
            { sourceModelName, targetModelName });
        await session.run('MATCH (n {enamespace: $targetModelName}) REMOVE n._copyOf_', { targetModelName });
    } finally {
        await closeSession();
    }
}

export async function copyCorrespondences(originalSourceModelName: string, originalTargetModelName: string, copySourceModelName: string, copyTargetModelName: string) {
    try {
        const session = getSession()
        await session.run(`MATCH 
                (s1 {enamespace:$originalSourceModelName})-[sr:corr]->(s2 {enamespace:$originalTargetModelName})
                MATCH (t1 {ename:s1.ename, enamespace: $copySourceModelName}), (t2 {ename:s2.ename, enamespace: $copyTargetModelName})
                CREATE (t1)-[tr:corr]->(t2)
                SET tr._type_ = sr._type_
                `,
            { originalSourceModelName, originalTargetModelName, copySourceModelName, copyTargetModelName });
    } finally {
        await closeSession();
    }
}

export async function compareModels(originalModelName: string, alteredModelName: string) {
    const session = getSession();
    try {
        // Mark all nodes with _cr_ which are in altered model but not in original model
        await session.run(`MATCH (n)
                           WHERE n.enamespace = $alteredModelName
                           AND NOT EXISTS {
                                MATCH ({ename: n.ename, enamespace: $originalModelName})
                           }
                           SET n._cr_ = true`, { originalModelName, alteredModelName });
        // Mark all relationships with _cr_ which are in altered model but not in original model
        await session.run(`MATCH (s)-[r]->(t)
                           WHERE s.enamespace = $alteredModelName AND t.enamespace = s.enamespace
                           AND NOT EXISTS {
                                MATCH ({ename: s.ename, enamespace: $originalModelName})-[nr]->({ename: t.ename, enamespace: $originalModelName})
                                WHERE type(nr) = type(r)
                           }
                           SET r._cr_ = true`, { originalModelName, alteredModelName });
        // Add deleted nodes
        await session.run(`MATCH (o)
                           WHERE o.enamespace = $originalModelName
                           AND NOT EXISTS {
                                MATCH ({ename: o.ename, enamespace: $alteredModelName})
                           }
                           CREATE (t)
                           SET t = o, t._de_ = true, t.enamespace = $alteredModelName
                           WITH t,o
                           CALL apoc.create.addLabels(id(t),labels(o))
                           YIELD node
                           RETURN node
                           `, { originalModelName, alteredModelName });
        // Add deleted relationships
        await session.run(`MATCH 
                        (s1 {enamespace:$originalModelName})-[sr]->(s2 {enamespace:$originalModelName})
                        MATCH (t1 {ename:s1.ename, enamespace: $alteredModelName}), (t2 {ename:s2.ename, enamespace: $alteredModelName})
                        WHERE NOT EXISTS {                            
                            MATCH (t1)-[nr]->(t2) WHERE type(nr) = type(sr)
                        }
                        CALL apoc.create.relationship(t1, type(sr), properties(sr), t2)
                        YIELD rel
                        SET rel._de_ = true
                        RETURN rel`, { originalModelName, alteredModelName });

    } finally {
        await closeSession();
    }
}