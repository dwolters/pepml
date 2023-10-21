import { type Constraint, type Correspondence, type ConstraintPattern, type ClassUsage } from '../types/mapping'
import { type Rule } from './Rule'
import NameGenerator from './NameGenerator'
import { Metamodel } from './Metamodel'
import metamodelTemplate from '../templates/metamodel'
import tggTemplate from '../templates/tgg'

export class TGG {
  name: string
  sourceMetamodel: Metamodel
  targetMetamodel: Metamodel
  constraints: Constraint[]
  patterns: ConstraintPattern[]
  private correspondences: Correspondence[]
  rules: Rule[]
  includeTripleGrammar = false;
  options: {
    set: Array<{
      sourceClass: string
      associationName: string
    }>
    root: string[]
    keepCompositionRules: boolean
    disableLowerBoundAugmentation: boolean
    disableCompositionAugmentation: boolean
    excludeRules: string[]
    excludeCorrespondences: string[]
    excludeConstraints: string[]
    excludePatterns: string[]
    constraints: string[]
    matchCommonAttributes: string[] | boolean
  }

  constructor(sourceMetamodel: Metamodel, targetMetamodel: Metamodel) {
    this.name = NameGenerator.generateTGGName(sourceMetamodel.name, targetMetamodel.name)
    this.sourceMetamodel = sourceMetamodel
    this.targetMetamodel = targetMetamodel
    this.correspondences = []
    this.rules = []
    this.constraints = []
    this.patterns = []
    this.options = {
      set: [],
      root: [],
      keepCompositionRules: false,
      disableLowerBoundAugmentation: false,
      disableCompositionAugmentation: false,
      excludeRules: [],
      excludeCorrespondences: [],
      excludeConstraints: [],
      excludePatterns: [],
      matchCommonAttributes: false,
      constraints: ['upperBounds', 'root', 'set', 'parentBounds']
    }
  }

  addPattern(pattern: ConstraintPattern): void {
    if (!this.patterns.find(p => p.name == pattern.name)) { this.patterns.push(pattern) }
  }

  addConstraint(constraint: Constraint): void {
    if (!this.constraints.find(c => c.name == constraint.name)) { this.constraints.push(constraint) }
  }

  static createTGG(sourceMetamodelStr: string, targetMetamodelStr: string): TGG {
    const sourceMetamodel = new Metamodel(sourceMetamodelStr, 'source')
    // console.log(JSON.stringify(sourceMetamodel, null, 2));
    const targetMetamodel = new Metamodel(targetMetamodelStr, 'target')
    return new TGG(sourceMetamodel, targetMetamodel)
  }

  addCorrespondence(sourceClass: string, targetClass: string, name: string): void {
    if (this.correspondences.find(c => c.name == name)) { return }

    const correspondence: Correspondence = {
      sourceClass,
      targetClass,
      name
    }

    this.correspondences.push(correspondence)
  }

  addRule(rule: Rule): void {
    this.rules.push(rule)
  }

  getApplicableCorrespondenceForSubclass(sourceClassName: string, targetClassName: string): Correspondence[] {
    const applicableCorrespondences: Correspondence[] = []
    this.correspondences.forEach(correspondence => {
      if (this.sourceMetamodel.isSameOrSubClass(sourceClassName, correspondence.sourceClass) &&
        this.targetMetamodel.isSameOrSubClass(targetClassName, correspondence.targetClass)) { applicableCorrespondences.push(correspondence) }
    })
    return applicableCorrespondences
  }

  getApplicableCorrespondenceForSuperclass(sourceClassName: string, targetClassName: string): Correspondence[] {
    const applicableCorrespondences: Correspondence[] = []
    this.correspondences.forEach(correspondence => {
      if (this.sourceMetamodel.isSameOrSubClass(correspondence.sourceClass, sourceClassName) &&
        this.targetMetamodel.isSameOrSubClass(correspondence.targetClass, targetClassName)) { applicableCorrespondences.push(correspondence) }
    })
    return applicableCorrespondences
  }

  applyAssociationMappings(): void {
    this.rules.forEach(associationMapping => {
      if (associationMapping.isAssociationMapping) {
        if(!associationMapping.sourceChildObject) throw new Error("")
        if(!associationMapping.sourceParentObject) throw new Error("")
        if(!associationMapping.targetChildObject) throw new Error("")
        if(!associationMapping.targetParentObject) throw new Error("")
        if(!associationMapping.childCorrespondence) throw new Error("")
        if(!associationMapping.parentCorrespondence) throw new Error("")
        const sourceParentClassName = associationMapping.sourceParentObject.class
        const sourceChildClassName = associationMapping.sourceChildObject.class
        const sourceAssociationIsOutgoing = (associationMapping.sourceParentObject.associatedObjects.length > 0)
        const sourceAssociationName = (sourceAssociationIsOutgoing ? associationMapping.sourceParentObject.associatedObjects[0].associationName : associationMapping.sourceChildObject.associatedObjects[0].associationName)
        const parentCorrespondenceName = associationMapping.parentCorrespondence.type
        const targetParentClassName = associationMapping.targetParentObject.class
        const targetChildClassName = associationMapping.targetChildObject.class
        const targetAssociationIsOutgoing = (associationMapping.targetParentObject.associatedObjects.length > 0)
        const targetAssociationName = (targetAssociationIsOutgoing ? associationMapping.targetParentObject.associatedObjects[0].associationName : associationMapping.targetChildObject.associatedObjects[0].associationName)
        const childCorrespondenceName = associationMapping.childCorrespondence.type
        this.rules.forEach(rule => {
          if (rule.isAssociationMapping) { return }
          const sourceMatch = rule.matchAssociationMapping(rule.sourceObjects, sourceParentClassName, sourceChildClassName, sourceAssociationName, sourceAssociationIsOutgoing, parentCorrespondenceName, childCorrespondenceName, this.sourceMetamodel)
          const targetMatch = rule.matchAssociationMapping(rule.targetObjects, targetParentClassName, targetChildClassName, targetAssociationName, targetAssociationIsOutgoing, parentCorrespondenceName, childCorrespondenceName, this.targetMetamodel)
          if (sourceMatch && !targetMatch) {
            console.log('Applying association mapping: ' + associationMapping.name + ' to rule: ' + rule.name)
            rule.applyAssociationMapping(sourceMatch, targetParentClassName, parentCorrespondenceName, targetChildClassName, childCorrespondenceName, targetAssociationName)
          } else if (!sourceMatch && targetMatch) {
            console.log('Applying association mapping: ' + associationMapping.name + ' to rule: ' + rule.name)
            rule.applyAssociationMapping(targetMatch, sourceParentClassName, parentCorrespondenceName, sourceChildClassName, childCorrespondenceName, sourceAssociationName, true)
          }
        })
      }
    })
  }

  inferCorrespondences(): void {
    this.rules.forEach(rule => {
      this.inferCorrespondencesForRule(rule)
    })
  }

  inferCorrespondencesForRule(rule: Rule): void {
    rule.sourceObjects.forEach(srcObj => {
      if (srcObj.inCorrespondence) { return }
      const applicableCorrespondences: Correspondence[] = []
      rule.targetObjects.forEach(tgtObj => {
        if (tgtObj.inCorrespondence) { return }
        applicableCorrespondences.push(...this.getApplicableCorrespondenceForSubclass(srcObj.class, tgtObj.class))
      })
      if (applicableCorrespondences.length == 0) {
        console.warn('No correspondence found for object with name %s and of class %s ', srcObj.name, srcObj.class)
      } else {
        if (applicableCorrespondences.length > 1) {
          // TODO better ask users!
          console.warn('Multiple correspondences found for object of class: ', srcObj.class)
          console.warn('Taking first corresponde')
        }
        const correspondence = applicableCorrespondences[0]
        const correspondenceType = correspondence.name
        const tgtObjs = rule.targetObjects.filter(tgtObj => !tgtObj.inCorrespondence && this.targetMetamodel.isSameOrSubClass(tgtObj.class, correspondence.targetClass))
        if (tgtObjs.length > 1) {
          console.warn('Found multiple possible target objects %s for correspondence %s. Taking first.', tgtObjs.toString(), correspondence)
        }
        if (tgtObjs.length == 0) {
          throw new Error(`Cannot find a suitable object of class "${correspondence.targetClass}" for correspondence with object "${srcObj.name}" of class "${srcObj.class}" based on correspondence type "${correspondence.name}".`)
        }
        const tgtObj = tgtObjs[0]
        srcObj.inCorrespondence = true
        tgtObj.inCorrespondence = true
        tgtObj.create = srcObj.create

        if (srcObj.hide) {
          if (tgtObj.hide) { rule.parameters = rule.parameters.filter(m => m.valueType == 'boolean' && m.name != tgtObj.hide) }
          tgtObj.hide = srcObj.hide
        } else if (tgtObj.hide) {
          srcObj.hide = tgtObj.hide
        }
        rule.addCorrespondenceObject(correspondenceType, srcObj, tgtObj, srcObj.create, true)
        console.log('Inferred correspondence %s between %s and %s', correspondenceType, srcObj.name, tgtObj.name)
      }
    })
  }

  generateRuleVariants(justAssociationMapping = false): void {
    let rules: Rule[] = []
    this.rules.forEach(rule => {
      // Generate all rule variants
      if (((justAssociationMapping && rule.isAssociationMapping) || !rule.isAssociationMapping) && rule.parameters.length > 0) {
        rules.push(...rule.generateRuleVariants())
      } else {
        rules.push(rule)
      }
    })
    if (!justAssociationMapping) {
      // Filter all association mappings that contain a composition
      // All compositions should be handled and mapped when a child object is created
      rules = rules.filter(rule => {
        if (!rule.isAssociationMapping || this.options.keepCompositionRules) { return true }
        // First object is always the parent and the second the child. Need use the child if a incoming association is used.
        const sourceObject = (rule.sourceParentObject?.associatedObjects.length ? rule.sourceParentObject : rule.sourceChildObject)
        if(!sourceObject) throw new Error('Broken association rule since source object is not defined');
        const sourceAssociation = sourceObject.associatedObjects[0].associationName
        const targetObject = (rule.targetParentObject?.associatedObjects.length ? rule.targetParentObject : rule.targetChildObject)
        if(!targetObject) throw new Error('Broken association rule since target object is not defined');
        const targetAssociation = targetObject.associatedObjects[0].associationName
        return (!this.sourceMetamodel.isComposition(sourceObject.class, sourceAssociation) &&
          !this.targetMetamodel.isComposition(targetObject.class, targetAssociation))
      })
    }
    this.rules = rules
  }

  createContraints(): void {
    const classes = this.sourceMetamodel.classes.concat(this.targetMetamodel.classes)
    if (this.options.constraints.includes('set')) {
      this.options.set.forEach(e => {
        const { sourceClass, associationName } = e
        const association = this.sourceMetamodel.getAssociation(sourceClass, associationName, true) || this.targetMetamodel.getAssociation(sourceClass, associationName)
        const targetClass = association.target
        const name = `${sourceClass}_${associationName}IsSet`
        const patternName = `NoDouble${targetClass}In${sourceClass}_${associationName}`
        this.addConstraint({ type: 'ForbidContraint', name, patternName })
        this.addPattern({ type: 'SetPattern', name: patternName, associationName, sourceClass, targetClass })
      })
    }
    if (this.options.constraints.includes('root')) {
      this.options.root.forEach(className => {
        const name = `Single${className}`
        const patternName = `NoDouble${className}`
        this.addConstraint({ type: 'ForbidContraint', name, patternName })
        this.addPattern({ type: 'RootPattern', name: patternName, class: className })
      })
    }
    classes.forEach(cl => {
      cl.associations?.forEach(ref => {
        const sourceClass = cl.name
        const associationName = ref.name
        const targetClass = ref.target
        if ((ref.type == 'aggregation' || ref.type == 'composition') && this.options.constraints.includes('parentBounds')) {
          const bound = 1 // we imply a upper bound of 1 for aggregations and compositions
          const name = `${targetClass}HasNoMoreThan${bound}${sourceClass}AsParentOf${associationName}`
          const patternName = `${targetClass}Has${bound + 1}${sourceClass}AsParentOf${associationName}`
          this.addConstraint({ type: 'ForbidContraint', name, patternName })
          this.addPattern({ type: 'ParentBoundPattern', name: patternName, childClass: targetClass, parentClass: sourceClass, associationName, bound: bound + 1 })
        }
        if (ref.lower > 0 && this.options.constraints.includes('lowerBounds')) {
          const bound = ref.lower
          const name = `${sourceClass}HasMin${bound}${targetClass}As${associationName}`
          const premiseName = `Exist${sourceClass}`
          const conclusionName = name
          this.addConstraint({ type: 'IfThenConstraint', name, premiseName, conclusionName })
          this.addPattern({ type: 'ExistPattern', name: premiseName, class: sourceClass })
          this.addPattern({ type: 'BoundPattern', name: conclusionName, sourceClass, targetClass, associationName, bound })
        }
        if (ref.upper && this.options.constraints.includes('upperBounds')) {
          const bound = ref.upper + 1
          const name = `${sourceClass}HasMax${bound - 1}${targetClass}As${associationName}`
          const patternName = `${sourceClass}Has${bound}${targetClass}As${associationName}`
          this.addConstraint({ type: 'ForbidContraint', name, patternName })
          this.addPattern({ type: 'BoundPattern', name: patternName, sourceClass, targetClass, associationName, bound })
        }
      })
    })
  }

  performExclusion(): void {
    this.correspondences = this.correspondences.filter(c => !this.options.excludeCorrespondences.includes(c.name))
    this.rules = this.rules.filter(c => !this.options.excludeRules.includes(c.name))
    this.constraints = this.constraints.filter(c => !this.options.excludeConstraints.includes(c.name))
    this.patterns = this.patterns.filter(c => !this.options.excludePatterns.includes(c.name))
  }

  generateTGGString(includeMetamodels: boolean = true, includeTripleGrammar = true): string {
    this.performExclusion()
    this.analyzeClassUsage(true)
    this.analyzeClassUsage(false)
    this.includeTripleGrammar = includeTripleGrammar;

    let tggStr = ''
    if (includeMetamodels) {
      tggStr += metamodelTemplate(this.sourceMetamodel)
      tggStr += '\n'
      tggStr += metamodelTemplate(this.targetMetamodel)
      tggStr += '\n'
    }
    tggStr += tggTemplate(this)
    return tggStr
  }

  analyzeClassUsage(onSourceSide: boolean): ClassUsage {
    const mm = onSourceSide ? this.sourceMetamodel : this.targetMetamodel
    const all = mm.getAllClasses(false)
    const used: string[] = []
    let unused: string[] = []
    const created: string[] = []
    let neverCreated: string[] = []
    this.rules.forEach(rule => {
      const objects = onSourceSide ? rule.sourceObjects : rule.targetObjects
      objects.forEach(obj => {
        if (!used.includes(obj.class)) { used.push(obj.class) }
        if (obj.create && !created.includes(obj.class)) { created.push(obj.class) }
      })
    })
    unused = all.filter(c => !used.includes(c))
    neverCreated = used.filter(c => !created.includes(c))
    neverCreated.forEach(c => { console.warn(`The class "${c}" is used but never creaded. Consider creating a new rule or using a modifier to create it.`) })

    return { all, used, unused, created, neverCreated }
  }
}
