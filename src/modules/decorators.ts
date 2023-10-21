export type Decorator = {
    name: string,
    url: string,
    placement: "top_left" | "top_right"
    sourceType?: string
    targetType?: string,
    constraint?: string,
    optionalMatch?: string
    nullAsFalse?: boolean
    value?: string
    valueMap?: {value:string|number|boolean, url:string}[]
}
let decorators:Decorator[] = [{
    name: "Assessment",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/assessment.svg",
    targetType: "PEPML__Assessment"
},{
    name: "Online Session",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/online-session.svg",
    targetType: "PEPML__EducationComponent",
    constraint: "NOT t:PEPML__EducationComposite AND isSync = true AND isOnline = true"
},{
    name: "Instructor-Led Session",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/session.svg",
    targetType: "PEPML__EducationComponent",
    constraint: "NOT t:PEPML__EducationComposite AND isSync = true AND isOnline = false"
},{
    name: "Self Study",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/self-study.svg",
    targetType: "PEPML__EducationComponent",
    constraint: "NOT t:PEPML__EducationComposite AND isSync = false AND isOnline = false"
},{
    name: "Online Self Study",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/online-self-study.svg",
    targetType: "PEPML__EducationComponent",
    constraint: "NOT t:PEPML__EducationComposite AND isSync = false AND isOnline = true"
},{
    name: "Goal",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/goal.svg",
    targetType: "PEPML__Goal"
},{
    name: "Outcome",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/outcome.svg",
    targetType: "PEPML__Outcome",
},{
    name: "Open Tasks",
    placement: "top_left",
    url: "https://dwolt.de/pepml/assets/tasks-9plus.svg",
    targetType: "PEPML__Entity",
    optionalMatch: "(t)-[:hasTask]->(m {isClosed:false})",
    value: "count(m)",
    constraint: "value > 0",
    valueMap: [
        {value:1, url:"https://dwolt.de/pepml/assets/tasks-1.svg"},
        {value:2, url:"https://dwolt.de/pepml/assets/tasks-2.svg"},
        {value:3, url:"https://dwolt.de/pepml/assets/tasks-3.svg"},
        {value:4, url:"https://dwolt.de/pepml/assets/tasks-4.svg"},
        {value:5, url:"https://dwolt.de/pepml/assets/tasks-5.svg"},
        {value:6, url:"https://dwolt.de/pepml/assets/tasks-6.svg"},
        {value:7, url:"https://dwolt.de/pepml/assets/tasks-7.svg"},
        {value:8, url:"https://dwolt.de/pepml/assets/tasks-8.svg"},
        {value:9, url:"https://dwolt.de/pepml/assets/tasks-9.svg"},
    ]
}];

export default decorators;