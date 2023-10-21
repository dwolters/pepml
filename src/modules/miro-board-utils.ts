import { stripHtml } from "string-strip-html";
import { Connector, FontFamily, Item, StrokeStyle, TextAlign, TextAlignVertical } from '@mirohq/websdk-types';
import { DECORATOR_OFFSET } from "./constants";

interface ShapeStyle {
    color?: string;
    fillColor?: string;
    fillOpacity?: number;
    fontFamily?: FontFamily;
    fontSize?: number;
    textAlign?: TextAlign;
    textAlignVertical?: TextAlignVertical;
    borderStyle?: StrokeStyle;
    borderOpacity?: number;
    borderColor?: string;
    borderWidth?: number;
}

interface UndoStyle {
    type: string
    itemId: string
    style?: Style
}

interface Style {
    [key: string]: number | string | boolean
}

let undo: UndoStyle[] = [];

export async function undoHighlightStyling() {
    while (undo.length > 0) {
        let undoInformation = undo.pop();
        if (undoInformation && undoInformation.type == 'Item') {
            let item = await getItemById(undoInformation.itemId);
            if (!item) continue;
            // @ts-ignore
            item.style = Object.assign(item.style, undoInformation.style);
            item.sync();
        } else if (undoInformation && undoInformation.type == 'Marker') {
            let item = await getItemById(undoInformation.itemId);
            if (item)
                miro.board.remove(item);
        }
    }
}

export async function highlightItems(...items: string[]) {
    items.forEach(async itemId => {
        let item = await getItemById(itemId);
        if (!item) return;
        let highlightStyle;
        let markerShape;
        switch (item.type) {
            case 'connector':
                highlightStyle = {
                    strokeColor: '#FF0000'
                };
                break;
            case 'image':
                markerShape = {
                    x: item.x,
                    y: item.y,
                    width: item.width,
                    height: item.height,
                    shape: 'rectangle' as const,
                    style: {
                        color: '#ff0000', // Default text color: '#1a1a1a' (black)
                        fillColor: 'transparent', // Default shape fill color: transparent (no fill)                        
                        borderColor: '#FF0000',
                    }
                }
                break;
            case 'shape':
            case 'card':
            case 'app_card':
                highlightStyle = {
                    borderColor: '#FF0000',
                    borderOpacity: 1.0,
                    borderStyle: 'normal',
                    borderWidth: 4,
                };
                break;
            case 'text':
                highlightStyle = {
                    fillColor: '#FF00000'
                }
                break;
        }
        // @ts-ignore
        if (highlightStyle && item.style) {
            let undoStyle: UndoStyle = {
                type: 'Item',
                itemId: itemId,
                style: {}
            };
            for (let key in highlightStyle) {
                // @ts-ignore
                undoStyle.style[key] = item.style[key];
            }
            undo.push(undoStyle);
            // @ts-ignore
            item.style = Object.assign(item.style, highlightStyle);
            item.sync();
        }
        if (markerShape) {
            let marker = await miro.board.createShape(markerShape);
            undo.push({ itemId: marker.id, type: "Marker" })
        }
    });
}

export async function adjustConnectorDirection() {
    let connectors = await miro.board.get({ type: "connector" });
    connectors.forEach(async connector => {
        if ((connector.style.startStrokeCap != 'none' && connector.style.startStrokeCap != 'filled_diamond') && connector.style.endStrokeCap == 'none') {
            changeConnectorCaps(connector);            
        }
        if (connector.style.endStrokeCap == 'filled_diamond' && connector.style.startStrokeCap == 'none') {
            changeConnectorCaps(connector);            
        }
    })
}

function changeConnectorCaps(connector: Connector) {
    if (!connector.start || !connector.end) return;
    console.log('Adjusting connector: ', connector.id);
    connector.style.endStrokeCap = connector.style.startStrokeCap;
    connector.style.startStrokeCap = 'none';
    connector.captions?.forEach(cap => {
        if (cap.position) cap.position = 1 - cap.position
    })

    console.log(connector.start)
    console.log(connector.end);
    let tmpItem = connector.end.item
    connector.end.item = connector.start.item
    connector.start.item = tmpItem;

    let startPosition = connector.start.position
    let startSnapTo = connector.start.snapTo
    let endPosition = connector.end.position
    let endSnapTo = connector.end.snapTo
    if (startSnapTo) {
        connector.end.snapTo = startSnapTo
    } else {
        connector.end.position = startPosition
    }
    if (endSnapTo) {
        connector.start.snapTo = endSnapTo
    } else {
        connector.start.position = endPosition
    }
    connector.sync()
}


export function getNameFromItem(item: Item) {
    // @ts-ignore
    return getNameFromContent(item.content || "")
}

export function getNameFromContent(content: string | undefined) {
    return stripHtml(content || "").result
}

export function cleanString(str: string) {
    return stripHtml(str).result.replaceAll(/\s+/g, ' ').trim();
}

export function getItemType(item: Item) {
    if (item.type == 'shape')
        return item.shape;
    return item.type;
}

export async function placeDecorator(itemId: string, url: string, name: string, area: "top_left" | "top_right") {
    console.log(url)
    let item = await getItemById(itemId);
    if (!item) return;
    if (item.type == "connector" || item.type == "unsupported") return;
    if (!isGeometricItem(item)) return;
    // @ts-ignore
    let width = Math.max(25, item.width * 0.1);
    let decorator = await miro.board.createImage({
        title: name,
        url: url,
        // @ts-ignore
        x: 0,
        // @ts-ignore
        y: 0,
        width: width,
        rotation: 0.0,
    });
    await alignDecator(decorator, item, area);
    await decorator.setMetadata('meta_type', 'Decorator');
    await decorator.setMetadata('meta_origin', itemId);
    await decorator.setMetadata('meta_area', area);
}

async function alignDecator(decorator: Item, item: Item, area: "top_left" | "top_right") {
    if (area == 'top_left') {
        // @ts-ignore
        decorator.x = item.x - item.width / 2 + DECORATOR_OFFSET + decorator.width / 2;
        // @ts-ignore
        decorator.y = item.y - item.height / 2 + DECORATOR_OFFSET + decorator.height / 2;
    } else if (area == "top_right") {
        // @ts-ignore
        decorator.x = item.x + item.width / 2 - DECORATOR_OFFSET - decorator.width / 2;
        // @ts-ignore
        decorator.y = item.y + item.height / 2 - DECORATOR_OFFSET - decorator.height / 2;
    }
    return decorator.sync();
}

export async function realignDecorators() {
    let images = await miro.board.get({ type: "image" })
    images.forEach(async image => {
        let type = await image.getMetadata('meta_type')
        if (type != 'Decorator') return;
        let origin = await image.getMetadata('meta_origin') as string
        let item = await getItemById(origin);
        if(!item) return;
        let area = await image.getMetadata('meta_area') as "top_left" | "top_right"
        alignDecator(image, item, area);
    })
}

export async function removeDecorators() {
    let images = await miro.board.get({ type: "image" })
    images.forEach(async image => {
        let type = await image.getMetadata('meta_type')
        if (type != 'Decorator') return;
        miro.board.remove(image);
    })
}

export async function zoomTo(itemIds: string[]) {
    let items: Item[];
    if (Array.isArray(itemIds)) {
        // @ts-ignore
        items = await Promise.all(itemIds.map(item => getItemById(item)))
    } else {
        let item = await getItemById(itemIds);
        // @ts-ignore
        items = [item];
    }
    await miro.board.viewport.zoomTo(items);
}

export function isGeometricItem(item: Item): boolean {
    switch (item.type) {
        case "app_card":
        case "shape":
        case "card":
        case "frame":
        case "sticky_note":
        case "text":
            return true;
        default:
            return false;
    }
}

export async function getItemById(itemId: string): Promise<Item | null> {
    let item = await miro.board.getById(itemId);
    if (item.type == "tag" || !item) return null;
    return item;
}

export async function getAllItems(): Promise<Item[]> {
    let items = await miro.board.experimental.get();
    return items.filter(i => i.type != "tag") as Item[];
}

export function createRectangle(x: number, y: number, width: number, height: number, content = '', style: ShapeStyle = {}) {
    return miro.board.createShape({
        shape: 'rectangle',
        content: content,
        style: Object.assign({
            fillColor: '#FFFFFF', // Default color: transparent (no fill)
            fontFamily: 'arial', // Default font type for the text
            fontSize: 14, // Default font size in dp for the text
            textAlign: 'center', // Default alignment: center
            textAlignVertical: 'middle', // Default alignment: middle
        }, style),
        x: x, // Default value: center of the board
        y: y, // Default value: center of the board
        width: width,
        height: height,
    });
}

