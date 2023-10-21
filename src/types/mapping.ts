export interface Correspondence {
  sourceClass: string
  targetClass: string
  name: string
}

export interface Mapping {
  options: MappingOption[]
  classMapping: ClassMapping[]
}

export interface MappingOption {
  name: string
  values: string[]
}

export interface ClassMapping {
  name?: string
  correspondenceName?: string
  source: string
  sourcePattern?: Pattern
  sourceModifier: Modifier
  target: string
  targetPattern?: Pattern
  targetModifier: Modifier
  properties?: PropertyMapping[]
  nacs?: NAC[]
}

export interface NAC {
  isSource:boolean
  name: string
}

export interface PropertyMapping {
  source: Property
  sourceDefault?: AttributeType
  target: Property
  targetDefault?: AttributeType
  valueMapping: ValueMapping[] | null
  referenceAttributeMapping: ReferenceAttributeMapping[] | null
}

export interface ReferenceAttributeMapping {
  source: Attribute
  target: Attribute
  valueMapping: ValueMapping[]
}

export interface ValueMapping {
  source: TypedValue
  target: TypedValue
}

export type Property = Attribute | AssociatedAttribute | Association

export type AttributeType = boolean | number | string | boolean[] | number[] | string[]
export type Pattern = Array<AttributeAssignment | AssociatedAttribute | Association>
export type AttributePattern = AttributeAssignment[]

export interface Attribute {
  type: 'attribute'
  name: string
  default?: TypedValue
}

export interface TypedValue {
  value:AttributeType
  valueType: AttributeAssignmentValueType
}

export interface AssociatedAttribute {
  type: 'associated_attribute'
  associationName: string
  associationPattern?: Pattern
  targetPattern?: Pattern
  targetClass: string
  targetModifier: Modifier
  isOutgoing: boolean
  explicit?: boolean
  targetAttribute: Attribute
}

export enum Modifier {
  create = 'create',
  exist = 'exist',
  any = 'any'
}

export type Create = boolean | string | string[]

export type AttributeAssignmentValueType = "string" | "number" | "boolean" | "null" | "enum" | "alternatives" | "variable";

export interface AttributeAssignment {
  type: 'attribute_value'
  name: string
  value: TypedValue | TypedValue[]
  parameter?: string
}

export interface Association {
  type: 'association'
  associationName: string
  associationPattern?: Pattern
  targetPattern?: Pattern
  targetClass: string
  targetModifier: Modifier
  isOutgoing: boolean
  explicit?: boolean
}

export interface AssociatedObject {
  associationName: string
  associationPattern?: Pattern
  objectName: string
  objectClass: string
  objectPattern?: Pattern
  isOutgoing: boolean
  create?: Create
  negated?: boolean
}

export interface CorrespondenceObject {
  type: string
  sourceObjectName: string
  targetObjectName: string
  create: Create
}

export type RuleParameter = BooleanRuleParameter | IndexRuleParameter

export interface BooleanRuleParameter {
  valueType: 'boolean'
  type: string
  name: string
}

export interface IndexRuleParameter {
  valueType: 'index'
  name: string
  names: string[]
}

export type Constraint = IfThenConstraint | ForbidContraint
export interface IfThenConstraint {
  type: 'IfThenConstraint'
  name: string
  premiseName: string
  conclusionName: string
}

export interface ForbidContraint {
  type: 'ForbidContraint'
  name: string
  patternName: string
}

export type ConstraintPattern = ParentBoundConstraintPattern | ExistContraintPattern | BoundConstraintPattern | SetPattern | RootPattern

export interface ExistContraintPattern {
  type: 'ExistPattern'
  name: string
  class: string
}

export interface RootPattern {
  type: 'RootPattern'
  name: string
  class: string
}

export interface BoundConstraintPattern {
  type: 'BoundPattern'
  name: string
  sourceClass: string
  associationName: string
  bound: number
  targetClass: string
}

export interface ParentBoundConstraintPattern {
  type: 'ParentBoundPattern'
  name: string
  childClass: string
  associationName: string
  bound: number
  parentClass: string
}

export interface SetPattern {
  type: 'SetPattern'
  name: string
  sourceClass: string
  associationName: string
  targetClass: string
}

export interface ClassUsage {
  all: string[]
  used: string[]
  unused: string[]
  created: string[]
  neverCreated: string[]
}
