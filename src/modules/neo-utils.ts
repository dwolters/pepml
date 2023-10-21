import { closeSession, getSession } from './neo';

export async function deleteProperty(id: number, propertyName: string) {
    const session = getSession();
    try {
        await session.run(`MATCH (n) WHERE id(n) = $id REMOVE n.${propertyName}`, { id });
    } finally {
        await closeSession();
    }
}

export async function addProperty(id: number, propertyName: string, value: string | number | boolean) {
    const session = getSession();
    try {
        await session.run(`MATCH (n) WHERE id(n) = $id SET n.\`${propertyName}\` = $value`, { id, value });
    } finally {
        await closeSession();
    }
}

export async function cleanDatabase() {
    const session = getSession();
    try {
        await session.run('MATCH (n) DETACH DELETE n');
    } finally {
        await closeSession()
    }
}