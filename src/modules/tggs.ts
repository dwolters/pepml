import { parseContent } from "./preprocessors/parse-content";
import { determineContainment, determineSpatialRelation } from "./preprocessors/spatial-relations";
import { createIgnoreItemsPreprocessor } from './preprocessors/ignore-items'
import { determineTimePlanningComposite } from './preprocessors/time-planning';
import { Session } from "neo4j-driver";
import { AssociationType } from "./model-transformer";

type Preprocessor = (moduleName: String, session: Session, associationTypes: AssociationType[] | undefined) => Promise<void>

type TGGDefaults = {
    name: string
    sourceMetamodelName: string
    targetMetamodelName: string
    gentgg: string
    tgg: string
    preprocessors: Preprocessor[]
}

let tggs: TGGDefaults[] = [
    //WARNING the content of this is auto generated using `npm run convert`. Source files are in the folder /tggs
//Begin:ActivityCanvas.json
{
    "name": "ActivityCanvas",
    "sourceMetamodelName": `metamodel Miro {
	Board {
		.id: EString
		<+>-items(0..*)->Item
	}
	abstract Item {
		.id : EString
		-connectedTo(0..*)->Item {
			.startCap: EString
			.endCap: EString
		    .caption: EString
		}
	}
	abstract GeometricItem : Item {
		.x: EDouble
		.y: EDouble
		.width: EDouble
		.height: EDouble
		.meta_type: EString
        .meta_area: EString
		.isArea: EBoolean
		.borderStyle: EString
		-contains(0..*)->GeometricItem
		-east(0..*)->GeometricItem
		-south(0..*)->GeometricItem
        -spans(0..*)->GeometricItem
	}
	abstract ContentItem : GeometricItem {
        .duration: EString
        .text: EString
        .startTime: EString
        .name: EString							  
		.content: EString
	}
	abstract TitleItem: GeometricItem {
		.title: EString
    }
	Shape : ContentItem {
		.rotation: EInt
	}
	Rectangle : Shape
	Circle : Shape
	RoundRectangle : Shape
	Text : ContentItem {
		.rotation: EInt
	}
	StickyNote : ContentItem
	Image : TitleItem {
		.url: EString
		.rotation: EInt
	}
    Card: TitleItem {
        <+>-fields(0..*)->Field
    }
    Field {
        .icon: EString
		.tooltip: EString
        .value: EString
    }
    AppCard: Card						 
	Frame : TitleItem {
		<>-children(0..*)->GeometricItem
	}
}`,
    "targetMetamodelName": `metamodel PEPML {
    EducationProgramme {
        .name: EString
        .description: EString
        <+>-entities(0..*)->Entity
    }
    Entity {
        .name: EString
        .description: EString
        -categories(0..*)->Category
		-hasTask(0..*)->Task
        -hasComment(0..*)->Comment
        -hasDecision(0..*)->Decision
        -relatesTo(0..*)->Entity {
            .label: EString
            .sourceLabel: EString
            .targetLabel: EString
            .type: EString
        }
        -hasStatus(0..1)->Status
    }
    Category : Entity {
        .colour: EString
    }
    Objective : Entity {
        -subObjectiveOf(0..*)->Objective
        -relevantFor(0..*)->Persona
        -refersTo(0..*)->Topic
    }
    Person : Entity {
        .isAbstract: EBoolean
    }

    Comment : Entity {
        .author: EString
    }
    Task : Entity {
	    -associatedTo(0..1)->Entity
	}
    Status: Entity {
        .isClosed: EBoolean
    }
    TaskConstraint: Entity {
        .constraintStr: EString
        -definedFor(0..*)->Task
        -appliesTo(0..*)->Status
        -failureStatus(1..1)->Status
    }
    Decision: Task {
        .decision: EString
        .consequences: EString
    }
    
    Educator : Person {
        -familiarWith(0..*)->Topic {
		  .label: EString
		}
        -involvedIn(0..*)->EducationComponent {
            .role: EString
        }
    }
    Persona: Person
    Company: Person
    Audience: Person {
        .sizeMin: EInt
        .sizeMax: EInt
        <>-representedBy(0..*)->Persona
    }        
    Topic : Entity {
        .isOptional: EBoolean
        -subTopicOf(0..*)->Topic {
          .label:EString
        }
    }
    Goal: Objective
    
    Outcome: Objective

    EducationComponent : Entity {
        .startDate: EString
        .startTime: EString
        .duration: EString
        .language: EString
        .isOnline: EBoolean
        .isSync: EBoolean
        .isMandatory: EBoolean
        -requires(0..*)->EducationComponent
        -previousVersion(0..*)->EducationComponent
        -next(0..*)->EducationComponent        
        -parallel(0..*)->EducationComponent
        <>-objectives(0..*)->Objective
        -covers(0..*)->Topic
        -in(0..*)->Location
        -resources(0..*)->Resource
        -activities(0..*)->Activity
        -inTracks(0..*)->Track
    }
    EducationComposite: EducationComponent {
        <>-contains(0..*)->EducationComponent
    }
   TimePlanningComposite: EducationComposite {
     -hasTracks(0..*)->Track
   }
   Track: Entity 
    Gap: EducationComponent {
    	.type: EString
    }
    InstructorLedSession: EducationComponent
    Feedback: EducationComponent
    Deliverable: EducationComponent {
    	.deadline: EString
    }
    ProjectBasedLearning: EducationComponent {
    	.groupSizeMin: EInt
    	.groupSizeMax: EInt
    	.groupCountMin: EInt
    	.groupCountMax: EInt
    }
    Assessment: Entity {
        .duration: EString
        .isMandatory: EBoolean
    }
    
	Activity: Entity {
        .duration: EString
        -addresses(0..*)->Objective
        -next(0..*)->Activity
        -in(0..*)->Location
        -uses(0..*)->Resource
	}
	Quiz: Activity
	Presentation: Activity
	Discussion: Activity
	Exercise: Activity {
		.groupSizeMin: EInt
		.groupSizeMax: EInt
	}

    Resource: Entity
    Material: Resource
    Tool: Resource
    Location: Entity
    DigitalLocation: Location

	EvaluationStrategy: Entity {
		-evaluates(0..*)->Entity
	}
	Survey: EvaluationStrategy
	Interview: EvaluationStrategy
	EvaluationResult: Entity {
		-basedOn(1..1)->EvaluationStrategy
		-resultFor(0..*)->Entity
	}
}`,
    "gentgg": `Board <=> EducationProgramme
-items <=> -entities

Rectangle{-south->Rectangle{.meta_type="TimePlanning"}} <=> EducationComponent
.name <=> .name

StickyNote{<-contains-Rectangle?{.meta_area="Outcome"}} <=> Outcome
.name <=> .name

StickyNote{<-contains-Rectangle?{.meta_area="Resource"}} <=> Resource
.name <=> .name

Rectangle{<-contains-Rectangle?{.meta_type="TimePlanning"}} <=> Activity
.name <=> .name
.duration <=> .duration
-south <=> -next
-connectedTo <=> -uses
-connectedTo <=> -addresses`,
    "tgg": `tripleRule AddAllResourcesToComponent: MiroToPEPMLTemporal {
	target {
		ec: EducationComponent {
			++-resources->r
		}
		r: Resource
	}
} forbid trg(ExistingResourceRelation)

pattern ExistingResourceRelation {
		ec: EducationComponent {
			-resources->r
		}
		r: Resource
}

tripleRule AddAllObjectivesToComponent: MiroToPEPMLTemporal {
	target {
		ec: EducationComponent {
			++-objectives->o
		}
		o: Objective
	}
} forbid trg(ExistingObjectivesRelation)

pattern ExistingObjectivesRelation {
		ec: EducationComponent {
			-objectives->o
		}
		o: Objective
}


tripleRule AddAllActivitiesToComponent: MiroToPEPMLTemporal {
	target {
		ec: EducationComponent {
			++-activities->a
		}
		a: Activity
	}
} forbid trg(ExistingActivitiesRelation)

pattern ExistingActivitiesRelation {
		ec: EducationComponent {
			-activities->a
		}
		a: Activity
}`,
    "preprocessors": [
        parseContent,
        createIgnoreItemsPreprocessor(["EmptyContentItems"]),
        determineContainment,
        determineTimePlanningComposite,
        determineSpatialRelation,
        createIgnoreItemsPreprocessor(["Decorators", "TimeFrames"])
    ]
},
//End:ActivityCanvas.json
//Begin:PEPMLDependency.json
{
    "name": "PEPMLDependency",
    "sourceMetamodelName": `metamodel Miro {
	Board {
		.id: EString
		<+>-items(0..*)->Item
	}
	abstract Item {
		.id : EString
		-connectedTo(0..*)->Item {
			.startCap: EString
			.endCap: EString
		    .caption: EString
		}
	}
	abstract GeometricItem : Item {
		.x: EDouble
		.y: EDouble
		.width: EDouble
		.height: EDouble
		.meta_type: EString
        .meta_area: EString
		.isArea: EBoolean
		.borderStyle: EString
		-contains(0..*)->GeometricItem
		-east(0..*)->GeometricItem
		-south(0..*)->GeometricItem
        -spans(0..*)->GeometricItem
	}
	abstract ContentItem : GeometricItem {
        .duration: EString
        .text: EString
        .startTime: EString
        .name: EString							  
		.content: EString
	}
	abstract TitleItem: GeometricItem {
		.title: EString
    }
	Shape : ContentItem {
		.rotation: EInt
	}
	Rectangle : Shape
	Circle : Shape
	RoundRectangle : Shape
	Text : ContentItem {
		.rotation: EInt
	}
	StickyNote : ContentItem
	Image : TitleItem {
		.url: EString
		.rotation: EInt
	}
    Card: TitleItem {
        <+>-fields(0..*)->Field
    }
    Field {
        .icon: EString
		.tooltip: EString
        .value: EString
    }
    AppCard: Card						 
	Frame : TitleItem {
		<>-children(0..*)->GeometricItem
	}
}`,
    "targetMetamodelName": `metamodel PEPML {
    EducationProgramme {
        .name: EString
        .description: EString
        <+>-entities(0..*)->Entity
    }
    Entity {
        .name: EString
        .description: EString
        -categories(0..*)->Category
		-hasTask(0..*)->Task
        -hasComment(0..*)->Comment
        -hasDecision(0..*)->Decision
        -relatesTo(0..*)->Entity {
            .label: EString
            .sourceLabel: EString
            .targetLabel: EString
            .type: EString
        }
        -hasStatus(0..1)->Status
    }
    Category : Entity {
        .colour: EString
    }
    Objective : Entity {
        -subObjectiveOf(0..*)->Objective
        -relevantFor(0..*)->Persona
        -refersTo(0..*)->Topic
    }
    Person : Entity {
        .isAbstract: EBoolean
    }

    Comment : Entity {
        .author: EString
    }
    Task : Entity {
	    -associatedTo(0..1)->Entity
	}
    Status: Entity {
        .isClosed: EBoolean
    }
    TaskConstraint: Entity {
        .constraintStr: EString
        -definedFor(0..*)->Task
        -appliesTo(0..*)->Status
        -failureStatus(1..1)->Status
    }
    Decision: Task {
        .decision: EString
        .consequences: EString
    }
    
    Educator : Person {
        -familiarWith(0..*)->Topic {
		  .label: EString
		}
        -involvedIn(0..*)->EducationComponent {
            .role: EString
        }
    }
    Persona: Person
    Company: Person
    Audience: Person {
        .sizeMin: EInt
        .sizeMax: EInt
        <>-representedBy(0..*)->Persona
    }        
    Topic : Entity {
        .isOptional: EBoolean
        -subTopicOf(0..*)->Topic {
          .label:EString
        }
    }
    Goal: Objective
    
    Outcome: Objective

    EducationComponent : Entity {
        .startDate: EString
        .startTime: EString
        .duration: EString
        .language: EString
        .isOnline: EBoolean
        .isSync: EBoolean
        .isMandatory: EBoolean
        -requires(0..*)->EducationComponent
        -previousVersion(0..*)->EducationComponent
        -next(0..*)->EducationComponent        
        -parallel(0..*)->EducationComponent
        <>-objectives(0..*)->Objective
        -covers(0..*)->Topic
        -in(0..*)->Location
        -resources(0..*)->Resource
        -activities(0..*)->Activity
        -inTracks(0..*)->Track
    }
    EducationComposite: EducationComponent {
        <>-contains(0..*)->EducationComponent
    }
   TimePlanningComposite: EducationComposite {
     -hasTracks(0..*)->Track
   }
   Track: Entity 
    Gap: EducationComponent {
    	.type: EString
    }
    InstructorLedSession: EducationComponent
    Feedback: EducationComponent
    Deliverable: EducationComponent {
    	.deadline: EString
    }
    ProjectBasedLearning: EducationComponent {
    	.groupSizeMin: EInt
    	.groupSizeMax: EInt
    	.groupCountMin: EInt
    	.groupCountMax: EInt
    }
    Assessment: Entity {
        .duration: EString
        .isMandatory: EBoolean
    }
    
	Activity: Entity {
        .duration: EString
        -addresses(0..*)->Objective
        -next(0..*)->Activity
        -in(0..*)->Location
        -uses(0..*)->Resource
	}
	Quiz: Activity
	Presentation: Activity
	Discussion: Activity
	Exercise: Activity {
		.groupSizeMin: EInt
		.groupSizeMax: EInt
	}

    Resource: Entity
    Material: Resource
    Tool: Resource
    Location: Entity
    DigitalLocation: Location

	EvaluationStrategy: Entity {
		-evaluates(0..*)->Entity
	}
	Survey: EvaluationStrategy
	Interview: EvaluationStrategy
	EvaluationResult: Entity {
		-basedOn(1..1)->EvaluationStrategy
		-resultFor(0..*)->Entity
	}
}`,
    "gentgg": `
Circle <=Circle2Topic=> Topic
.name <=> .name
.borderStyle <=> .isOptional
["dashed"=true,"normal"=false]
-connectedTo{.endCap="triangle"} <=> -subTopicOf

Image{.url="https://dwolt.de/pepml/assets/educator.svg"} <=> Educator
-south->Text.name <=> .name
-connectedTo{.endCap="rounded_stealth"} <=> -involvedIn
(.caption <=> .role)

Image{.url="https://dwolt.de/pepml/assets/persona.svg"} <=> Persona
-south->Text.name <=> .name

Board <=> EducationProgramme
-items <=> -entities

Rectangle <=> EducationComponent
.name <=> .name
.text <=> .description
-connectedTo{.endCap="filled_oval"} <=> -covers
-connectedTo{.startCap="filled_diamond"} <=> -objectives
-connectedTo{.endCap="erd_many"} <=> -requires
forbid src(ContainsOtherRectangle) && trg(IsComposite)

Rectangle <=> EducationComposite
.name <=> .name
.text <=> .description
-connectedTo{.endCap="filled_oval"} <=> -covers
-connectedTo{.startCap="filled_diamond"} <=> -objectives
-connectedTo{.startCap="filled_diamond"} <=> -contains

RoundRectangle <=> Objective
.name <=> .name
.text <=> .description
-connectedTo <=> -relevantFor

AppCard <=> Task
.title <=> .name
-fields- <=> -hasStatus
-connectedTo <=> <-hasTask

Field{<-fields-AppCard .tooltip="Status"} <=> Status
.value <=> .name`,
    "tgg": `pattern ContainsOtherRectangle {
  r: Rectangle {
    -connectedTo->r2 {
      .startCap := "filled_diamond"
    }
  }
  r2: Rectangle
}

pattern IsComposite {
  ec: EducationComposite
}`,
    "preprocessors": [
        parseContent,
        determineSpatialRelation
    ]
},
//End:PEPMLDependency.json
//Begin:PEPMLTemporal.json
{
    "name": "PEPMLTemporal",
    "sourceMetamodelName": `metamodel Miro {
	Board {
		.id: EString
		<+>-items(0..*)->Item
	}
	abstract Item {
		.id : EString
		-connectedTo(0..*)->Item {
			.startCap: EString
			.endCap: EString
		    .caption: EString
		}
	}
	abstract GeometricItem : Item {
		.x: EDouble
		.y: EDouble
		.width: EDouble
		.height: EDouble
		.meta_type: EString
        .meta_area: EString
		.isArea: EBoolean
		.borderStyle: EString
		-contains(0..*)->GeometricItem
		-east(0..*)->GeometricItem
		-south(0..*)->GeometricItem
        -spans(0..*)->GeometricItem
	}
	abstract ContentItem : GeometricItem {
        .duration: EString
        .text: EString
        .startTime: EString
        .name: EString							  
		.content: EString
	}
	abstract TitleItem: GeometricItem {
		.title: EString
    }
	Shape : ContentItem {
		.rotation: EInt
	}
	Rectangle : Shape
	Circle : Shape
	RoundRectangle : Shape
	Text : ContentItem {
		.rotation: EInt
	}
	StickyNote : ContentItem
	Image : TitleItem {
		.url: EString
		.rotation: EInt
	}
    Card: TitleItem {
        <+>-fields(0..*)->Field
    }
    Field {
        .icon: EString
		.tooltip: EString
        .value: EString
    }
    AppCard: Card						 
	Frame : TitleItem {
		<>-children(0..*)->GeometricItem
	}
}`,
    "targetMetamodelName": `metamodel PEPML {
    EducationProgramme {
        .name: EString
        .description: EString
        <+>-entities(0..*)->Entity
    }
    Entity {
        .name: EString
        .description: EString
        -categories(0..*)->Category
		-hasTask(0..*)->Task
        -hasComment(0..*)->Comment
        -hasDecision(0..*)->Decision
        -relatesTo(0..*)->Entity {
            .label: EString
            .sourceLabel: EString
            .targetLabel: EString
            .type: EString
        }
        -hasStatus(0..1)->Status
    }
    Category : Entity {
        .colour: EString
    }
    Objective : Entity {
        -subObjectiveOf(0..*)->Objective
        -relevantFor(0..*)->Persona
        -refersTo(0..*)->Topic
    }
    Person : Entity {
        .isAbstract: EBoolean
    }

    Comment : Entity {
        .author: EString
    }
    Task : Entity {
	    -associatedTo(0..1)->Entity
	}
    Status: Entity {
        .isClosed: EBoolean
    }
    TaskConstraint: Entity {
        .constraintStr: EString
        -definedFor(0..*)->Task
        -appliesTo(0..*)->Status
        -failureStatus(1..1)->Status
    }
    Decision: Task {
        .decision: EString
        .consequences: EString
    }
    
    Educator : Person {
        -familiarWith(0..*)->Topic {
		  .label: EString
		}
        -involvedIn(0..*)->EducationComponent {
            .role: EString
        }
    }
    Persona: Person
    Company: Person
    Audience: Person {
        .sizeMin: EInt
        .sizeMax: EInt
        <>-representedBy(0..*)->Persona
    }        
    Topic : Entity {
        .isOptional: EBoolean
        -subTopicOf(0..*)->Topic {
          .label:EString
        }
    }
    Goal: Objective
    
    Outcome: Objective

    EducationComponent : Entity {
        .startDate: EString
        .startTime: EString
        .duration: EString
        .language: EString
        .isOnline: EBoolean
        .isSync: EBoolean
        .isMandatory: EBoolean
        -requires(0..*)->EducationComponent
        -previousVersion(0..*)->EducationComponent
        -next(0..*)->EducationComponent        
        -parallel(0..*)->EducationComponent
        <>-objectives(0..*)->Objective
        -covers(0..*)->Topic
        -in(0..*)->Location
        -resources(0..*)->Resource
        -activities(0..*)->Activity
        -inTracks(0..*)->Track
    }
    EducationComposite: EducationComponent {
        <>-contains(0..*)->EducationComponent
    }
   TimePlanningComposite: EducationComposite {
     -hasTracks(0..*)->Track
   }
   Track: Entity 
    Gap: EducationComponent {
    	.type: EString
    }
    InstructorLedSession: EducationComponent
    Feedback: EducationComponent
    Deliverable: EducationComponent {
    	.deadline: EString
    }
    ProjectBasedLearning: EducationComponent {
    	.groupSizeMin: EInt
    	.groupSizeMax: EInt
    	.groupCountMin: EInt
    	.groupCountMax: EInt
    }
    Assessment: Entity {
        .duration: EString
        .isMandatory: EBoolean
    }
    
	Activity: Entity {
        .duration: EString
        -addresses(0..*)->Objective
        -next(0..*)->Activity
        -in(0..*)->Location
        -uses(0..*)->Resource
	}
	Quiz: Activity
	Presentation: Activity
	Discussion: Activity
	Exercise: Activity {
		.groupSizeMin: EInt
		.groupSizeMax: EInt
	}

    Resource: Entity
    Material: Resource
    Tool: Resource
    Location: Entity
    DigitalLocation: Location

	EvaluationStrategy: Entity {
		-evaluates(0..*)->Entity
	}
	Survey: EvaluationStrategy
	Interview: EvaluationStrategy
	EvaluationResult: Entity {
		-basedOn(1..1)->EvaluationStrategy
		-resultFor(0..*)->Entity
	}
}`,
    "gentgg": `Board <=> EducationProgramme
-items <=> -entities

Rectangle{.meta_type="Track"} <=> Track

Rectangle{.meta_type="TimePlanning"}<=>TimePlanningComposite
.name <=> .name
-contains <=> -contains
-contains <=> -hasTracks
-east <=> -next
-south <=> -parallel

Rectangle<=>EducationComponent
.name <=> .name
.duration <=> .duration
.startTime <=> .startTime
.borderStyle <=> .isMandatory
["dashed"=false,"normal"=true]
-east <=> -next
-south <=> -parallel
forbid src(ContainsOtherRectangle) && src(NotInTimePlanning) && trg(IsComposite)

Rectangle{<-contains-Rectangle{.meta_type="TimePlanning"}}<=Rect2EC_inTPC:Rect2EC_inTPC=>EducationComponent{<-contains-TimePlanningComposite}
.name <=> .name
.duration <=> .duration
.startTime <=> .startTime
-east <=> -parallel
-south <=> -next
-spans <=> -inTracks

Rectangle<=>EducationComposite
.name <=> .name
-contains <=> -contains
-east <=> -next`,
    "tgg": `pattern IsComposite{
  ec: EducationComposite
}

pattern NotInTimePlanning {
  r2: Rectangle {
    .meta_type:="TimePlanning"
    -contains->r
  }
  r: Rectangle
}

pattern ContainsOtherRectangle {
  r: Rectangle {
    -contains->r2
  }
  r2: Rectangle
}`,
    "preprocessors": [
        parseContent,
        determineContainment,
        determineTimePlanningComposite,
        determineSpatialRelation,
        createIgnoreItemsPreprocessor(["Decorators", "EmptyContentItems", "TimeFrames"])
    ]
},
//End:PEPMLTemporal.json
//TGG_PLACEHOLDER
]
let preprocessorMapping: Record<string, Preprocessor[]> = {}
tggs.forEach(tgg => preprocessorMapping[tgg.name] = tgg.preprocessors)

export function getPreprocessors(tggName: string) {
    return preprocessorMapping[tggName];
}


let AVAILABLE_TGGS = tggs.map(tgg => tgg.name);

export function getAllTGGs() {
    return AVAILABLE_TGGS;
}

export function getTGGDefaults(tggName: string) {
    let defaults = tggs.find(tgg => tgg.name == tggName);
    if (!defaults)
        throw new Error('No defaults exist for the TGG ' + tggName)
    return defaults;
}
