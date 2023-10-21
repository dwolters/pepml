import { type AttributeAssignment, type AssociatedObject, type Create, type Pattern, type Association, Modifier, type AttributeType, TypedValue } from '../types/mapping'
import { type Rule } from './Rule'
import NameGenerator from './NameGenerator'
import type { Metamodel } from './Metamodel'
import { Class } from '../types/emsl-metamodel'

export class RuleObject {
  name: string
  class: string
  attributes: AttributeAssignment[]
  associatedObjects: AssociatedObject[]
  associatedParentObjects: AssociatedObject[]
  inCorrespondence: boolean
  create: Create
  hide?: string | boolean
  isParent: boolean
  isOrigin: boolean
  isSource: boolean
  rule: Rule

  constructor (objectClass: string, rule: Rule, create: Create, inCorrespondence: boolean, isParent: boolean, isSource: boolean) {
    this.name = NameGenerator.generateObjectName(objectClass, rule.name)
    this.class = objectClass
    this.attributes = []
    this.associatedObjects = []
    this.associatedParentObjects = []
    this.inCorrespondence = inCorrespondence
    this.create = create
    this.isParent = isParent
    this.isOrigin = false
    this.rule = rule
    this.isSource = isSource
  }

  addAttribute (attribute: AttributeAssignment): void {
    if (!this.attributes.some(a => a.name === attribute.name)) {
      this.attributes.push(attribute)
    }
  }

  addAssociatedObject (associatedObject: AssociatedObject): void {
    if (!this.hasAssociatedObject(associatedObject.associationName, associatedObject.objectName)) {
      this.associatedObjects.push(associatedObject)
    }
  }

  addAssociatedParentObject (associatedObject: AssociatedObject): void {
    if (!this.hasAssociatedParentObject(associatedObject.associationName)) {
      this.associatedParentObjects.push(associatedObject)
    }
  }

  hasAssociatedObject (associationName: string, objectName: string): boolean {
    if (!this.getMetamodel().getAssociation(this.class, associationName)) { throw new Error(`Unknown association "${associationName}" in class "${this.class}"`) }
    return this.associatedObjects.some(r => r.associationName === associationName && r.objectName === objectName)
  }

  hasAssociatedParentObject (associationName: string): boolean {
    return this.associatedParentObjects.some(p => p.associationName === associationName)
  }

  addPattern (pattern: Pattern | undefined, disableAugmentation: boolean = false): void { // TODO check compatibilit of pattern
    const mm = this.getMetamodel()
    const parentPattern: Association[] = []
    const cl = mm.getClass(this.class) as Class
    if (!pattern) { pattern = [] as Pattern }
    cl.associations?.forEach(association => {
      const lower = association.lower
      if (lower == 0 || this.rule.tgg.options.disableLowerBoundAugmentation || disableAugmentation) { return }
      const current = pattern.filter(p => p.type == 'association' && p.associationName == association.name && mm.isAnySubSuper(p.targetClass, association.target)).length || 0
      for (let i = current; i < lower; i++) {
        console.warn(`Adding implicit association for meet lower bound for assocation ${association.name} of class ${cl.name}`)
        pattern?.push({ type: 'association', associationName: association.name, targetClass: association.target, targetModifier: Modifier.exist, isOutgoing: true, explicit: false })
      }
    })
    pattern.forEach(p => {
      if (p.type == 'attribute_value') {
        mm.getAttribute(this.class, p.name) // throws error if attribute does not exist
        if (Array.isArray(p.value)) {
          const paramID = this.rule.addIndexParameter(p.value.map(v => '_' + p.name + 'EQ' + v))
          p.parameter = paramID
        }
        this.attributes.push(p)
      } else if(p.type == 'associated_attribute') {
        //TODO: Convert into association with pattern!

      } else if (p.type == 'association') {
        if (p.isOutgoing) {
          if (!p.targetClass) { p.targetClass = mm.getAssociation(this.class, p.associationName).target }
          const multipleObjectsNeed = pattern.filter(p2 => p2.type == 'association' && p2.associationName == p.associationName && mm.isAnySubSuper(p.targetClass, p2.targetClass)).length > 1
          this.rule.createObjectForAssociationPattern(p, this, multipleObjectsNeed)
        } else {
          if (!p.targetClass) {
            p.targetClass = mm.findParentClass(this.class, p.associationName)
          }
          parentPattern.push(p)
        }
      }
    })
    cl.partOf?.forEach(partOfRelation => {
      if (!disableAugmentation && !this.rule.tgg.options.disableCompositionAugmentation && !parentPattern.find(p => p.associationName == partOfRelation.association && p.targetClass == partOfRelation.class)) {
        parentPattern.push({ type: 'association', associationName: partOfRelation.association, targetClass: partOfRelation.class, targetModifier: Modifier.exist, isOutgoing: false, explicit: false })
      }
    })
    parentPattern.forEach(parentPattern => {
      this.rule.addParentPatternToParentObject(this, parentPattern)
    })
  }

  setAttributeValue (attrName: string, value: TypedValue | TypedValue[], parameter?: string): void {
    const attr = this.attributes.find(a => a.name == attrName && a.type == 'attribute_value')
    if (attr && (Array.isArray(attr.value) || Array.isArray(value) ||  attr.value.value != value.value || attr.value.valueType != attr.value.valueType)) { 
      throw new Error(`Attribute "${attrName}" already assigned to value with different value`) 
    }
    if(!attr)
      this.attributes.push({ type: 'attribute_value', name: attrName, value, parameter })
  }
  
  setAttributeVariable(name: string, variable: string) {
    this.setAttributeValue(name,  {value: variable, valueType:'variable'});
  }

  getVariableNameForAttribute (attrName: string): string | undefined {
    const attr = this.attributes.find(a => a.name == attrName)
    if(attr) {
      if(Array.isArray(attr.value)) {
        let variable = attr.value.find(value => value.valueType == 'variable')
        if(variable) return variable.value as string
      } else if(attr.value.valueType == 'variable') {
          return attr.value.value as string
      }
    }
    return
  }

  addObjectAssociationWithObject (associationName: string, associationPattern: Pattern | undefined, associatedObject: RuleObject, create: Create): AssociatedObject {
    this.addAssociationPattern(associationName, associationPattern)
    const association = {
      associationName,
      associationPattern,
      objectName: associatedObject.name,
      objectClass: associatedObject.class,
      create,
      isOutgoing: true
    }
    const existingAssociatedObject = this.associatedObjects.find(r => r.associationName == association.associationName && r.objectName == association.objectName && association.isOutgoing)
    if (!existingAssociatedObject) {
      this.addAssociatedObject(association)
      associatedObject.associatedParentObjects.push({ objectName: this.name, objectClass: this.class, associationName: association.associationName, isOutgoing: false })
    } else {
      // TODO merge pattern
    }
    return association
  }

  addAssociationPattern (associationName: string, associationPattern: Pattern | undefined): void {
    const mm = this.getMetamodel()
    associationPattern?.forEach(p => {
      if (p.type == 'attribute_value') {
        mm.getAssocationAttribute(this.class, associationName, p.name) // throws error if attribute does not exist
        if (Array.isArray(p.value)) {
          const paramID = this.rule.addIndexParameter(p.value.map(v => '_' + p.name + 'EQ' + v))
          p.parameter = paramID
        }
      }
      // Only attribute values can in a association pattern. No need to check other types
    })
  }

  getMetamodel (): Metamodel {
    return this.isSource ? this.rule.getSourceMetamodel() : this.rule.getTargetMetamodel()
  }

  clone (): any {
    const object = new RuleObject(this.class, this.rule, this.create, this.inCorrespondence, this.isParent, this.isSource)
    object.name = this.name
    object.attributes = this.attributes.map(a => structuredClone(a))
    object.associatedObjects = this.associatedObjects.map(r => structuredClone(r))
    object.associatedParentObjects = this.associatedParentObjects.map(p => structuredClone(p))
    object.hide = this.hide
    object.isOrigin = this.isOrigin
    return object
  }
}
