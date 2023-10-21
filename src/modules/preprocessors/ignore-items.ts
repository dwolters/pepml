import { Session } from "neo4j-driver"

let options = {
    "Decorators": "MATCH (c {enamespace:$modelName, meta_type:'Decorator'}) DETACH DELETE c",
    "TimeFrames": "MATCH (c {enamespace:$modelName, meta_type:'TimeFrame'}) DETACH DELETE c",
    "EmptyContentItems": "MATCH (c:Miro__ContentItem {enamespace:$modelName}) WHERE c.name = '' DETACH DELETE c"
}

let optionNames: (keyof typeof options)[] = Object.keys(options) as (keyof typeof options)[];

export function availableOptions() {
    return optionNames;
}

export function createIgnoreItemsPreprocessor(selectedOptions: typeof optionNames) {
    return async function ignoreItems(modelName: string, session: Session) {
        console.log('Running ignore items preprocessor for ' + selectedOptions);
        for await (const option of selectedOptions) {
            if (!optionNames.includes(option)) throw new Error('Unknown option: ' + option)
            await session.run(options[option], { modelName });
        }
    }
}