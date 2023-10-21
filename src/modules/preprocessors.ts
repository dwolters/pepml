import { Session } from "neo4j-driver";
import * as TGGManager from "./tgg-manager";
import {getPreprocessors} from "./tggs";


export async function runPreprocessors(modelName: string, tggName: string, session: Session) {
    let transformer = TGGManager.get(tggName);
    if (!transformer) throw new Error('Could not get transformer for given TGG');
    let associationTypes = transformer.getAssociationTypes(true);
    let preprocessors = getPreprocessors(tggName);
    if (!preprocessors) throw new Error('No preprocessors set for this TGG');
    for (let preprcessor of preprocessors) {
        await preprcessor(modelName, session, associationTypes);
    }
}