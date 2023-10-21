import { Text, Shape, StickyNote, ConnectorCaption } from '@mirohq/websdk-types';
import { driver } from './neo';
import * as d3 from "d3-force";


export async function layout(modelName: string) {
    let session = driver.session();
    let results = await session.run(`MATCH (n {enamespace: $modelName}) WHERE n:Miro__Item RETURN id(n) AS id, properties(n) as props, labels(n) as labels`, { modelName });
    let nodes = results.records.map((r, index) => ({ index, id: r.get('id') as number, item: r.get('props'), labels: r.get('labels'), x:0, y:0 }));
    results = await session.run(`MATCH (n {enamespace: $modelName})-[r]->(m {enamespace: $modelName}) WHERE n:Miro__Item and m:Miro__Item RETURN id(n) AS nId, id(m) AS mId, properties(r) as props, type(r) as type`, { modelName });
    let links = results.records.map((r) => ({ source: r.get('nId') as number, target: r.get('mId') as number, connector: r.get('props'), type: r.get('type') }));
    await new Promise((resolve) => {
        d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id((d) => d.id))
            .force('charge', d3.forceManyBody())
            .force('center', d3.forceCenter())
            .force("x", d3.forceX().strength(0.01))
            .force("y", d3.forceY().strength(0.01))
            .force("collide", d3.forceCollide(150)).tick(300)
            .on('tick', () => { console.log('tick') })
            .on('end', () => resolve(true));
    });


    //await session.run(`UNWIND $nodes as node MATCH (n) WHERE id(n) = node.id SET n.x = node.x, n.y = node.y`, {nodes});
    let itemMap: Record<number, Shape | Text | StickyNote> = {}
    await Promise.all(nodes.map(async node => {
        let item;
        if (node.labels.includes('Miro__AppCard')) {
            //TODO query for fields.
            item = await miro.board.createAppCard({title: node.item.title, x: node.x, y: node.y, width: 150, height: 75 });
        } else if (node.labels.includes('Miro__Rectangle'))
            item = await miro.board.createShape({ shape: 'rectangle', content: `<p>${node.item.name}</p>`, x: node.x, y: node.y, width: 150, height: 75 });
        else if (node.labels.includes('Miro__Circle'))
            item = await miro.board.createShape({ shape: 'circle', content: `<p>${node.item.name}</p>`, x: node.x, y: node.y, width: 150, height: 75 });
        else if (node.labels.includes('Miro__RoundRectangle'))
            item = await miro.board.createShape({ shape: 'round_rectangle', content: `<p>${node.item.name}</p>`, x: node.x, y: node.y, width: 150, height: 75 });
        else if (node.labels.includes('Miro__Image'))
            item = await miro.board.createImage({ url: node.item.url, x: node.x, y: node.y, height: 75 });
        else if (node.labels.includes('Miro__Text'))
            item = await miro.board.createText({ content: `<p>${node.item.name}</p>`, x: node.x, y: node.y, style:{textAlign:'center'} });
        else
            item = await miro.board.createStickyNote({ content: `<p>${node.item.name}</p>`, x: node.x, y: node.y });
        itemMap[node.id] = item;
        console.log('adding item: ', node.id);
    }));
    console.log('end: ', itemMap);
    for (let link of links) {
        console.log('Link:', link);
        let startItem = itemMap[link.source.id];
        let endItem = itemMap[link.target.id]
        if (link.type == 'south') {
            endItem.x = startItem.x
            endItem.y = startItem.y + startItem.height / 2 + endItem.height / 2
            endItem.sync()
        } else {
            let startStrokeCap = link.connector.startCap || "none"
            let endStrokeCap = link.connector.endCap || "none"
            let captions: ConnectorCaption[] = [];
            if(link.connector.label)
                captions.push({content:link.connector.label, position:0.5})
            await miro.board.createConnector({ start: { item: startItem.id }, end: { item: endItem.id }, captions, style: { startStrokeCap, endStrokeCap } });
        }
    }
}