import { Session } from "neo4j-driver";
import { stripHtml } from "string-strip-html";

export async function parseContent(modelName: string, session: Session) {
    console.log('Running running parse content');
    let results = await session.run('MATCH (n:Miro__ContentItem {enamespace: $modelName}) RETURN id(n) AS id, n.content AS content', { modelName });
    let parseProps: Array<{
        id: number
        name: string | null
        text: string | null
        startDate: string | null
        startTime: string | null
        duration: string | null
    }> = [];
    results.records.forEach(r => {
        let id = r.get('id');
        let content = r.get('content');
        let paragraphs = getParagraphs(content);
        let name = null;
        let text = null;
        let startDate = null;
        let startTime = null;
        let duration = null;
        if (paragraphs.length == 1) {
            name = paragraphs[0];
        } else {
            if (containsTimeInformation(paragraphs[0])) {
                paragraphs.shift(); // TODO parse time information
                name = paragraphs.shift() || null
            } else if (containsTimeInformation(paragraphs[1])) {
                name = paragraphs.shift() || null
                paragraphs.shift(); // TODO parse time information
            } else {
                name = paragraphs.shift() || null
            }
            text = paragraphs.join('\n');
        }
        parseProps.push({
            id,
            name,
            text: text,
            startDate,
            startTime,
            duration
        })
    })

    await session.run(`UNWIND $parseProps as parseProp
                       MATCH (n)
                       WHERE id(n) = parseProp.id
                       SET n.name = parseProp.name, n.text = parseProp.text`, { parseProps })
}

function getParagraphs(str: string): string[] {
    return str.replaceAll('<p>', '').replace(/<\/p>$/, '').replaceAll('<br>', '\n').split('</p>').map(l => stripHtml(l).result);
}

let regExDateYYYYMMDD = /(\d{4})-(\d{2})-(\d{2})/;
let regExDateDDMMYYYY = /(\d{2})\.(\d{2})\.(\d{4})/
let regExTime = /[01]?[0-9]:[0-5][0-9]/;

function containsTimeInformation(str: string) {
    let timeRegEx: RegExp[] = [
        regExDateYYYYMMDD,
        regExDateDDMMYYYY,
        regExTime
    ];
    for (let i = 0; i < timeRegEx.length; i++) {
        if (str.match(timeRegEx[i]))
            return true;
    }
    return false;
}


// function parseTimeInformation(str: string) {
//     let startDate = parseDateString(str);
//     if(startDate)
//         str.replace(startDate.str,'');
//     let endDate = parseDateString(str);
//     if(endDate)
//         str.replace(endDate.str,'');
//     let startTime = parseTimeStr(str);
//     if(startTime)
//         str.replace(startTime.str,'');
//     let endTime = parseTimeStr(str);
//     if(endTime)
//         str.replace(endTime.str,'');   
//     if(endTime && endDate === null) 
//         endDate = startDate;
//     let duration = null;    
//     if(startDate) {
//         Temporal.PlainDateTime.from({year: startDate.year})
//     }
// }

// function parseTimeStr(dateStr: string): {hour: number, minute: number, str: string} | null {
//     let hour: number, minute: number;

//     const dotMatch = dateStr.match(regExTime);

//     if (dotMatch) {
//         hour = parseInt(dotMatch[1]);
//         minute = parseInt(dotMatch[2]); // JavaScript's Date uses 0-based months
//         return {hour, minute, str: dotMatch[0]};
//     } 
//     return null;
// }

// function parseDateString(str: string): {year: number, month: number, day:number, str: string} | null {
//     const hyphenFormat = regExDateYYYYMMDD; // YYYY-mm-dd
//     const dotFormat = regExDateDDMMYYYY; // dd.mm.YYYY

//     let year: number, month: number, day: number;

//     const hyphenMatch = str.match(hyphenFormat);
//     const dotMatch = str.match(dotFormat);

//     if (hyphenMatch) {
//         year = parseInt(hyphenMatch[1]);
//         month = parseInt(hyphenMatch[2]); // JavaScript's Date uses 0-based months
//         day = parseInt(hyphenMatch[3]);
//         return {year, month, day, str: hyphenMatch[0]};
//     } else if (dotMatch) {
//         day = parseInt(dotMatch[1]);
//         month = parseInt(dotMatch[2]); // JavaScript's Date uses 0-based months
//         year = parseInt(dotMatch[3]);
//         return {year, month, day, str: dotMatch[0]};
//     } 
//     return null;
// }