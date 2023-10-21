import { type Association, type Mapping, type MappingOption, Modifier, type Property, type AttributeType, type ValueMapping, type AssociatedAttribute, Attribute, ReferenceAttributeMapping, AttributeAssignment } from '../types/mapping'
import NameGenerator from './NameGenerator'
import '../helpers/handlebars-helper'
import { Rule } from './Rule'
import { type RuleObject } from './RuleObject'
import { TGG } from './TGG'
import * as parser from '../parsers/emsl-mapping'

export default class MappingProcessor {
  tgg: TGG

  constructor(mappingStr: string, sourceMetamodelStr: string, targetMetamodelStr: string) {
    this.tgg = TGG.createTGG(sourceMetamodelStr, targetMetamodelStr)

    const mapping = this.readMapping(mappingStr)

    this.processOptions(mapping.options)

    this.generateRules(mapping)
    
    //this.tgg.generateRuleVariants(true)

    this.tgg.applyAssociationMappings()

    this.tgg.inferCorrespondences()

    this.tgg.generateRuleVariants()

    this.tgg.createContraints()
  }

  processOptions(options: MappingOption[]): void {
    options.forEach(option => {
      switch (option.name) {
        case 'set':
          this.tgg.options.set = option.values.map(e => {
            if (!e.includes('.')) {
              throw new Error(`Value ${e} for option set does not follow the pattern Class.Assocation`)
            }
            const [sourceClass, associationName] = e.split('.')
            return { sourceClass, associationName }
          })
          return
        case 'root':
          this.tgg.options.root = option.values
          return
        case 'disableCompositionAugmentation':
          this.tgg.options.disableCompositionAugmentation = true
          return
        case 'disableLowerBoundAugmentation':
          this.tgg.options.disableLowerBoundAugmentation = true
          return
        case 'excludeRules':
        case 'includeRules':
        case 'excludeCorrespondences':
        case 'includeCorrespondences':
        case 'excludeConstraints':
        case 'includeConstraints':
          this.tgg.options[option.name] = option.values
          return
        case 'keepCompositionRules':
          this.tgg.options.keepCompositionRules = true
          return
        case 'matchCommonAttributes':
          if (option.values.length == 0 || option.values[0] == 'false')
            this.tgg.options.matchCommonAttributes = false;
          else if (option.values[0] == 'true')
            this.tgg.options.matchCommonAttributes = true;
          else
            this.tgg.options.matchCommonAttributes = options.values;
          return;
        case 'constraints':
          this.tgg.options.constraints = option.values
          return
        case 'name':
          this.tgg.name = option.values[0]
      }
    })
  }

  generateCorrespondences(mapping: Mapping): void {
    mapping.classMapping.forEach(mapping => {
      const sourceClassName = mapping.source
      const targetClassName = mapping.target
      mapping.name = NameGenerator.generateRuleNameForClassMapping(mapping)
      const correspondenceName = mapping.correspondenceName = mapping.correspondenceName || `${sourceClassName}2${targetClassName}`
      if (!this.tgg.sourceMetamodel.hasClass(sourceClassName)) { throw new Error('Unknown class of source metamodel: ' + sourceClassName) }
      if (!this.tgg.targetMetamodel.hasClass(targetClassName)) { throw new Error('Unknown class of target metamodel: ' + targetClassName) }
      this.tgg.addCorrespondence(sourceClassName, targetClassName, correspondenceName)
    })
  }

  generateRules(mapping: Mapping): void {
    this.generateCorrespondences(mapping)
    mapping.classMapping.forEach(mapping => {
      const sourceClassName = mapping.source
      const targetClassName = mapping.target
      const ruleName = mapping.name as string //Rule name is set as part of generateCorrespondences
      const correspondenceName = mapping.correspondenceName as string //Correspondence name is set as part of generateCorrespondences

      const rule = new Rule(ruleName, this.tgg, false, mapping.nacs)
      const sourceCreate = rule.modifierToCreate(mapping.sourceModifier || Modifier.create, sourceClassName)
      const sourceObject = rule.createSourceObject(sourceClassName, sourceCreate, true)
      sourceObject.isOrigin = true
      const targetCreate = rule.modifierToCreate(mapping.targetModifier || Modifier.create, targetClassName)
      const targetObject = rule.createTargetObject(targetClassName, targetCreate, true)
      targetObject.isOrigin = true
      rule.addCorrespondenceObject(correspondenceName, sourceObject, targetObject, true)
      sourceObject.addPattern(mapping.sourcePattern)
      targetObject.addPattern(mapping.targetPattern)

      let processedAttributes: string[] = [];
      mapping.properties?.forEach(propMapping => {
        const source = propMapping.source
        if (typeof source === 'string')
          processedAttributes.push(source);
        const target = propMapping.target
        if (typeof target === 'string')
          processedAttributes.push(target);
        this.handlePropertyMapping(rule, sourceObject, targetObject, source, target, propMapping.valueMapping, propMapping.referenceAttributeMapping)
      })
      if (this.tgg.options.matchCommonAttributes) {
        let sourceClassAttributes = this.tgg.sourceMetamodel.getAttributeNames(sourceClassName)
        let targetClassAttributes = this.tgg.targetMetamodel.getAttributeNames(targetClassName)
        let commonAttributes = sourceClassAttributes.filter(a => targetClassAttributes.includes(a) && !processedAttributes.includes(a))
        if (Array.isArray(this.tgg.options.matchCommonAttributes))
          commonAttributes = commonAttributes.filter(a => this.tgg.options.matchCommonAttributes.includes(a))
        for (let attr of commonAttributes) {
          console.log(`Adding attribute mapping for common attribute '${attr}' to rule ${rule.name}`)
          this.handleAttributeMapping(rule, sourceObject, targetObject, { type: 'attribute', name: attr }, { type: 'attribute', name: attr }, null);
        }
      }
    })
  }

  private handlePropertyMapping(rule: Rule, sourceObject: RuleObject, targetObject: RuleObject,
    source: Property, target: Property, valueMapping: ValueMapping[] | null, referenceAttributeMapping: ReferenceAttributeMapping[]): void {
    if (source.type == 'attribute' && target.type == 'attribute') {
      this.handleAttributeMapping(rule, sourceObject, targetObject, source, target, valueMapping)
    } else if (source.type == 'attribute' && target.type == 'associated_attribute') {
      this.handleAttributeToAssociatedAttributeMapping(rule, sourceObject, targetObject, source, target, valueMapping)
    } else if (source.type == 'associated_attribute' && target.type == 'attribute') {
      this.handleAttributeToAssociatedAttributeMapping(rule, targetObject, sourceObject, target, source, valueMapping, true)
    } else if (source.type == 'associated_attribute' && target.type == 'associated_attribute') {
      this.handleAssociatedAttributeToAssociatedAttributeMapping(rule, sourceObject, targetObject, source, target, valueMapping)
    } else if (source.type == 'association' && target.type == 'association') {
      this.handleAssociationMapping(rule, sourceObject, targetObject, source, target, referenceAttributeMapping)
    } else {
      throw new Error('Unknown mapping type')
    }
  }

  private handleAttributeMapping(rule: Rule, sourceObject: RuleObject, targetObject: RuleObject, source: Attribute, target: Attribute, valueMapping: ValueMapping[] | null): void {
    let sourceName = source.name;
    let targetName = target.name;
    if (!this.tgg.sourceMetamodel.getAttribute(sourceObject.class, sourceName)) { throw new Error(`Unknown attribute '${sourceName}' of class '${sourceObject.class}'`) }
    if (!this.tgg.targetMetamodel.getAttribute(targetObject.class, targetName)) { throw new Error(`Unknown attribute '${targetName}' of class '${targetObject.class}'`) }

    if (!valueMapping) { //Without a value mapping we assume that the value shall be equal
      // First check if a variable for this attribute exists on source or target side
      const sourceVariable = sourceObject.getVariableNameForAttribute(sourceName)
      const targetVariable = targetObject.getVariableNameForAttribute(targetName)

      if (sourceVariable && targetVariable && sourceVariable != targetVariable) {
        throw new Error(`Attributes "${sourceName}" and "${targetName}" cannot be mapped. Attribute "${sourceName}" already mapped to "${sourceVariable}" and attribute "${targetName}" already mapped to "${targetVariable}"`)
      }

      const variable = sourceVariable ||
        targetVariable ||
        NameGenerator.generateVariableName(sourceName, targetName, rule.name)

      if (!sourceVariable) { sourceObject.setAttributeVariable(sourceName, variable) }
      if (!targetVariable) { targetObject.setAttributeVariable(targetName, variable) }

      valueMapping = [{ source: { value: variable, valueType: 'variable' }, target: { value: variable, valueType: 'variable' } }]
    }
    if (source.default) {
      valueMapping.push({ source: source.default, target: { value: 'null', valueType: 'null' } });
    }
    if (target.default) {
      valueMapping.push({ source: { value: 'null', valueType: 'null' }, target: target.default });
    }

    if (valueMapping.length > 1) {
      const paramID = rule.addIndexParameter(valueMapping.map(v => '_' + sourceName + 'EQ' + v.source.value + '_' + targetName + 'EQ' + v.target.value))
      sourceObject.setAttributeValue(sourceName, valueMapping.map(v => v.source), paramID)
      targetObject.setAttributeValue(targetName, valueMapping.map(v => v.target), paramID)
    } else if (valueMapping.length == 1) {
      sourceObject.setAttributeValue(sourceName, valueMapping[0].source)
      targetObject.setAttributeValue(targetName, valueMapping[0].target)
    } else
      throw new Error('A least a single value mapping is needed.');
  }

  private handleAttributeToAssociatedAttributeMapping(rule: Rule, sourceObject: RuleObject, targetObject: RuleObject,
    source: Attribute, associatedAttribute: AssociatedAttribute, valueMapping: ValueMapping[] | null, reversed: boolean = false): void {
    let sourceName = source.name;
    if (reversed) {
      if (!this.tgg.targetMetamodel.getAttribute(sourceObject.class, sourceName)) { throw new Error(`Unknown attribute '${sourceName}' of class '${sourceObject.class}'`) }
      if (!this.tgg.sourceMetamodel.getAssociation(targetObject.class, associatedAttribute.associationName)) { throw new Error(`Unknown association '${associatedAttribute.associationName}' of class '${targetObject.class}'`) }
    } else {
      if (!this.tgg.sourceMetamodel.getAttribute(sourceObject.class, sourceName)) { throw new Error(`Unknown attribute '${sourceName}' of class '${sourceObject.class}'`) }
      if (!this.tgg.targetMetamodel.getAssociation(targetObject.class, associatedAttribute.associationName)) { throw new Error(`Unknown association '${associatedAttribute.associationName}' of class '${targetObject.class}'`) }
    }

    const sourceVariable = sourceObject.getVariableNameForAttribute(sourceName)
    const variable = sourceVariable || NameGenerator.generateVariableName(sourceName, associatedAttribute.associationName, rule.name)
    if (!sourceVariable) { sourceObject.setAttributeVariable(sourceName, variable) }

    if (!associatedAttribute.targetClass) { associatedAttribute.targetClass = targetObject.getMetamodel().getAssociation(targetObject.class, associatedAttribute.associationName).target }

    const correspondenceName = rule.name + '_' + associatedAttribute.targetClass
    const associatedObject: RuleObject = rule.createObjectForAssociationPattern(associatedAttribute, targetObject, false, Modifier.create)
    if (reversed) {
      this.tgg.addCorrespondence(associatedObject.class, sourceObject.class, correspondenceName)
      rule.addCorrespondenceObject(correspondenceName, associatedObject, sourceObject, associatedObject.create)
    } else {
      this.tgg.addCorrespondence(sourceObject.class, associatedObject.class, correspondenceName)
      rule.addCorrespondenceObject(correspondenceName, sourceObject, associatedObject, sourceObject.create)
    }
    associatedObject.setAttributeVariable(associatedAttribute.targetAttribute.name, variable)
    associatedObject.inCorrespondence = true

    // TODO create should be false if both source and target of the association exist.
    // targetObject.addObjectAssociationWithObject(associatedAttribute.associationName, associatedAttribute.associationPattern, associatedObject, true);
  }

  handleAssociatedAttributeToAssociatedAttributeMapping(rule: Rule, sourceObject: RuleObject, targetObject: RuleObject, source: AssociatedAttribute, target: AssociatedAttribute, valueMapping: ValueMapping[] | null): void {
    if (!this.tgg.sourceMetamodel.getAssociation(sourceObject.class, source.associationName)) { throw new Error(`Unknown association '${source.associationName}' of class '${targetObject.class}'`) }
    if (!this.tgg.targetMetamodel.getAssociation(targetObject.class, target.associationName)) { throw new Error(`Unknown association '${target.associationName}' of class '${targetObject.class}'`) }

    if (!source.targetClass) { source.targetClass = sourceObject.getMetamodel().getAssociation(sourceObject.class, source.associationName).target }
    if (!target.targetClass) { target.targetClass = targetObject.getMetamodel().getAssociation(targetObject.class, target.associationName).target }

    const variable = NameGenerator.generateVariableName(source.targetAttribute.name, target.targetAttribute.name, rule.name)

    const sourceChildObject = rule.createObjectForAssociationPattern(source, sourceObject, false, Modifier.create)
    sourceChildObject.inCorrespondence = true
    sourceChildObject.setAttributeVariable(source.targetAttribute.name, variable)
    const targetChildObject = rule.createObjectForAssociationPattern(target, targetObject, false, Modifier.create)
    targetChildObject.inCorrespondence = true
    targetChildObject.setAttributeVariable(target.targetAttribute.name, variable)

    const correspondenceName = NameGenerator.generateRuleName(source.targetClass, target.targetClass, rule.name)

    this.tgg.addCorrespondence(sourceChildObject.class, targetChildObject.class, correspondenceName)
    rule.addCorrespondenceObject(correspondenceName, sourceChildObject, targetChildObject, Rule.determineAssociationCreate(sourceChildObject.create, targetChildObject.create))

    sourceObject.addObjectAssociationWithObject(source.associationName, source.associationPattern, sourceChildObject, sourceChildObject.create)
    targetObject.addObjectAssociationWithObject(target.associationName, target.associationPattern, targetChildObject, targetChildObject.create)
  }

  private handleAssociationMapping(rule: Rule, sourceObject: RuleObject, targetObject: RuleObject,
    sourceAssociation: Association, targetAssociation: Association, referenceAttributeMapping: ReferenceAttributeMapping[]): void {
    if (!Array.isArray(sourceAssociation.associationPattern)) sourceAssociation.associationPattern = []
    if (!Array.isArray(targetAssociation.associationPattern)) targetAssociation.associationPattern = []
    let valueMapping : ValueMapping[] = [];
    let parameters:  string[][] = [];
    let pendingParameters: Array<Array<AttributeAssignment>> = [];
    for (let attributeMapping of referenceAttributeMapping) {
      //TODO duplicate code
      let variable = NameGenerator.generateVariableName(attributeMapping.source.name, attributeMapping.target.name, rule.name)
      valueMapping = [{source:{ value: variable, valueType: 'variable' },target:{ value: variable, valueType: 'variable' }}];
      if (attributeMapping.source.default) {
        valueMapping.push({ source: attributeMapping.source.default, target: { value: 'null', valueType: 'null' } });
      }
      if (attributeMapping.target.default) {
        valueMapping.push({ source: { value: 'null', valueType: 'null' }, target: attributeMapping.target.default });
      }
      
      if (valueMapping.length > 1) {
        parameters.push(valueMapping.map(v => '_' + attributeMapping.source.name + 'EQ' + v.source.value.replaceAll(' ','') + '_' + attributeMapping.target.name + 'EQ' + v.target.value.replaceAll(' ','')))
        let sourceAttributeValue : AttributeAssignment = {type:'attribute_value', name: attributeMapping.source.name, value: valueMapping.map(v => v.source)};
        let targetAttributeValue : AttributeAssignment = {type:'attribute_value', name: attributeMapping.target.name, value: valueMapping.map(v => v.target)}
        sourceAssociation.associationPattern.push(sourceAttributeValue)
        targetAssociation.associationPattern.push(targetAttributeValue)
        pendingParameters.push([sourceAttributeValue,targetAttributeValue])
      } else if (valueMapping.length == 1) {
        sourceAssociation.associationPattern.push({type:'attribute_value', name: attributeMapping.source.name, value: valueMapping[0].source})
        targetAssociation.associationPattern.push({type:'attribute_value', name: attributeMapping.target.name, value: valueMapping[0].target})
      } else
        throw new Error('A least a single value mapping is needed.');
    }
    sourceAssociation.targetClass = this.tgg.sourceMetamodel.inferTargetClassofAssociation(sourceObject.class, sourceAssociation.associationName, sourceAssociation.targetClass, sourceAssociation.isOutgoing)
    targetAssociation.targetClass = this.tgg.targetMetamodel.inferTargetClassofAssociation(targetObject.class, targetAssociation.associationName, targetAssociation.targetClass, targetAssociation.isOutgoing)
    const applicableCorrespondences = this.tgg.getApplicableCorrespondenceForSuperclass(sourceAssociation.targetClass, targetAssociation.targetClass)
    if (applicableCorrespondences.length === 0) {
      throw new Error(`Cannot find correspondences between targets "${sourceAssociation.targetClass}" and "${targetAssociation.targetClass}" of mapped associations "${sourceAssociation.associationName}" and "${targetAssociation.associationName}"`)
    }
    applicableCorrespondences.forEach(correspondence => {
      const name = NameGenerator.generateAssociationRuleName(sourceObject.class, sourceAssociation.associationName, targetObject.class, targetAssociation.associationName)
      const newRule = new Rule(name, this.tgg, true)
      for(let i = 0; i < parameters.length; i++) {
        let parameter = parameters[i];
        let pendingParameter = pendingParameters[i];
        let paramID = newRule.addIndexParameter(parameter);
        pendingParameter.forEach(p => p.parameter = paramID);
      }
      const sourceParentObject = newRule.createSourceObject(sourceObject.class, false, true)
      sourceParentObject.isOrigin = true
      const sourceChildObject = newRule.createSourceObject(correspondence.sourceClass, false, true)
      if (sourceAssociation.targetPattern) {
        sourceChildObject.addPattern(sourceAssociation.targetPattern, true)
      }
      if (sourceAssociation.isOutgoing) {
        sourceParentObject.addObjectAssociationWithObject(sourceAssociation.associationName, sourceAssociation.associationPattern, sourceChildObject, true)
      } else {
        sourceChildObject.addObjectAssociationWithObject(sourceAssociation.associationName, sourceAssociation.associationPattern, sourceParentObject, true)
      }
      const targetParentObject = newRule.createTargetObject(targetObject.class, false, true)
      targetParentObject.isOrigin = true
      const targetChildObject = newRule.createTargetObject(correspondence.targetClass, false, true)
      if (targetAssociation.targetPattern) {
        targetChildObject.addPattern(targetAssociation.targetPattern, true)
      }
      if (targetAssociation.isOutgoing) {
        targetParentObject.addObjectAssociationWithObject(targetAssociation.associationName, targetAssociation.associationPattern, targetChildObject, true)
      } else {
        targetChildObject.addObjectAssociationWithObject(targetAssociation.associationName, targetAssociation.associationPattern, targetParentObject, true)
      }
      
      newRule.sourceParentObject = sourceParentObject;
      newRule.sourceChildObject = sourceChildObject;
      newRule.targetParentObject = targetParentObject;
      newRule.targetChildObject = targetChildObject;
      newRule.childCorrespondence = newRule.addCorrespondenceObject(correspondence.name, sourceChildObject, targetChildObject, false);
      newRule.parentCorrespondence = newRule.addCorrespondenceObject(rule.correspondences[0].type, sourceParentObject, targetParentObject, false);
    })
  }

  private readMapping(mappingStr: string): Mapping {
    // Remove one line comments
    mappingStr = mappingStr.replaceAll(/^\/\/.*/g, '')
    mappingStr = mappingStr.replaceAll(/[^:]\/\/.*/g, '')
    const mapping: Mapping = parser.parse(mappingStr, { grammarSource: 'Mapping' })
    return mapping
  }

  generateTGG(): TGG {
    return this.tgg
  }
}
