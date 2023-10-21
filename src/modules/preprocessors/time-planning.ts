import { Temporal } from '@js-temporal/polyfill';
import { Session } from 'neo4j-driver';

export async function determineTimePlanningComposite(modelName: string, session: Session) {
    console.log('Running day planning preprocessor');
    try {
        let results = await session.run(`MATCH (n {enamespace:$modelName})-[:contains]->(t {enamespace:$modelName})
    WHERE t.name =~ '^[0-9]{2}:[0-9]{2}\\s*-\\s*[0-9]{2}:[0-9]{2}$'
    SET t.meta_type = 'TimeFrame'
    WITH n, t, split(t.name,'-') AS startEndTime
    SET t.startTime = trim(startEndTime[0]), t.endTime = trim(startEndTime[1])
    WITH n, t
    WITH n, min(t.startTime) as minStartTime,max(t.endTime) as maxEndTime
    SET n.meta_type = 'TimePlanning', n.startTime = minStartTime, n.endTime = maxEndTime, n.meta_type='TimePlanning', n.numberOfDays = 1, n.numberOfTracks = 1
    WITH n
    OPTIONAL MATCH (n {enamespace:$modelName})-[:contains]->(t {enamespace:$modelName})
    WHERE t.name =~ 'Day [0-9]+'
    SET t.meta_type = 'TimePlanning'
    WITH n, toInteger(max(split(t.name,' ')[1])) AS maxDay
    SET n.numberOfDays = coalesce(maxDay,1)
    WITH n
    OPTIONAL MATCH (n {enamespace:$modelName})-[:contains]->(t {enamespace:$modelName})
    WHERE t.name =~ 'Track [0-9]+'
    SET t.meta_type = 'Track'
    WITH n, toInteger(max(split(t.name,' ')[1])) AS maxTrack
    SET n.numberOfTracks = maxTrack
    RETURN id(n) as id, n.startTime as startTime, n.endTime as endTime
    UNION
    MATCH (c {enamespace:$modelName})<-[r:contains]-(n {enamespace:$modelName})-[:contains]->(t {enamespace:$modelName})
    WHERE t.meta_type = 'TimeFrame' AND c.yMin - 1 <= t.yMin AND c.yMax + 1 >= t.yMax
    WITH c, min(t.startTime) as startTime, trim(max(t.endTime)) as endTime
    SET c.startTime = startTime, c.endTime = endTime
    RETURN id(c) as id, startTime, endTime`, { modelName });
        let durations: [number, string][] = [];
        for (const result of results.records) {
            let id: number = result.get('id');
            let startTime: string = result.get('startTime');
            let endTime: string = result.get('endTime');
            let duration = Temporal.PlainTime.from(startTime).until(Temporal.PlainTime.from(endTime))
            durations.push([id, duration.toString()])
        }
        await session.run(`UNWIND $durations as duration MATCH (n) WHERE id(n) = duration[0] SET n.duration = duration[1]`, { durations })

        // // Set start times and duration based on time frames
        // results = await session.run(``, { modelName })
        // for (const result of results.records) {
        //     let id: number = result.get('id');
        //     let startTime: string = result.get('startTime');
        //     let endTime: string = result.get('endTime');
        //     let duration = Temporal.PlainTime.from(startTime).until(Temporal.PlainTime.from(endTime), { smallestUnit: 'minute' })
        //     durations.push([id, duration.toString({ smallestUnit: 'minute' })])
        // }

        //Move component to Day that are used as columns
        await session.run(`MATCH (c {enamespace:$modelName})<-[r:contains]-(n {enamespace:$modelName})-[:contains]->(d {enamespace:$modelName})
    WHERE d.meta_type = 'TimePlanning' AND c.xMin >= d.xMin-1 AND c.xMax <= d.xMax+1
    DELETE r
    CREATE (d)-[:contains]->(c)`, { modelName })

        //Assign components to tracks
        await session.run(`MATCH (c {enamespace:$modelName})<-[r:contains]-(n {enamespace:$modelName})-[:contains]->(t {enamespace:$modelName})
    WHERE t.meta_type = 'Track' AND c.xMin - 1 <= t.xMin AND c.xMax + 1 >= t.xMax
    CREATE (c)-[:spans]->(t)`, { modelName })
    } catch (e) {
        console.error(e);
    }
}