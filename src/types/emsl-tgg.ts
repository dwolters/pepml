export type Attribute = BooleanAttribute | NumberAttribute | StringAttribute
export type NumberAttribute = {
  type: 'number_attribute'
  name: string
  value: string | number | boolean
}
export type BooleanAttribute = {
  type: 'boolean_attribute'
  name: string
  value: string | number | boolean
}
export type StringAttribute = {
  type: 'string_attribute' | 'enum_attribute' | 'variable_attribute'
  name: string
  value: string
}

export type Assocation = {
  created: boolean
  type: 'association' | 'composition' | 'aggregation'
  sourceObject: string
  assocationName: string
  linkName?: string
  isSource?: boolean
  targetObject: string
  attributes?: Attribute[] | null
}

export type RuleObject = {
  type: 'rule_object'
  created: boolean
  name: string
  class: string
  isSource?: boolean
  attributes?: Attribute[] | null
}

export type CorrespondenceObject = {
  type: 'correspondence_object'
  created: boolean
  sourceObject: string
  linkName?: string
  name: string
  targetObject: string
}

export type NAC = {
  isSource: boolean
  name: string
}

export type Constraint = IfThenConstraint | EnforceConstraint | ForbidConstraint

export type IfThenConstraint = {
  type: 'constraint_ifthen'
  name: string
  premise: string
  conclusion: string
}
export type EnforceConstraint = {
  type: 'constraint_enforce'
  pattern: string
  name: string
}
export type ForbidConstraint = {
  type: 'constraint_forbid'
  pattern: string
  name: string
}

export type Pattern = {
  type: 'pattern'
  name: string
  objects: RuleObject[]
  associations: Assocation[]
}

export type Rule = {
  type: 'rule'
  name: string
  tggName: string
  source: { objects: RuleObject[], associations: Assocation[] }
  target: { objects: RuleObject[], associations: Assocation[] }
  correspondences: CorrespondenceObject[]
  nacs: NAC[] | null
}

export type TGG = Constraint | Pattern | Rule
