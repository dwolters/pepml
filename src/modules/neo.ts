import neo4j, { Session } from 'neo4j-driver';
import config from '../config';

export const driver = neo4j.driver(
    config.neo4j.connectionUri,
    neo4j.auth.basic(config.neo4j.username, config.neo4j.password),
    { disableLosslessIntegers: true }
);

let session : Session | undefined;

export function getSession(): Session {
    if (session === undefined) {
        session = driver.session();
    }
    return session;
}

export async function closeSession(): Promise<void> {
    if(!session) return;
    let promise = session.close();
    session = undefined;
    return promise;
}