import { type AttributeAssignment, type AttributeType, type AssociatedObject, type Constraint, type ConstraintPattern, AttributeAssignmentValueType } from '../types/mapping'
import { type RuleObject } from '../classes/RuleObject'
import Handlebars from 'handlebars'
import { NAC } from '../types/emsl-tgg'
function patternAttributeValueHelper(attr: AttributeAssignment, create: boolean): string {
  const attrName = attr.name
  let attrValue: string
  if (attr.type == 'attribute_value') {
    // TODO: escaping in strings necessary
    if (Array.isArray(attr.value)) throw new Error(`Value alternatives should be replaced before generating the TGG`);
    attrValue = wrapValue(attr.value.value, attr.value.valueType)
  } else
    throw new Error('Unknown attribute type');
  return `.${attrName} ${(create ? ' := ' : ' : ')} ${attrValue}`
}

function wrapValue(value: AttributeType, valueType: AttributeAssignmentValueType): string {
  if (valueType == 'string') { return '"' + value + '"' }
  if (valueType == 'variable') { return '<' + value + '>' }
  return '' + value
}

// Handlebars.registerHelper('value', function (value: AttributeType) {
//   return new Handlebars.SafeString(wrapValue(value) + '')
// })

Handlebars.registerHelper('attr', function (prop: AttributeAssignment, create: boolean) {
  return new Handlebars.SafeString(patternAttributeValueHelper(prop, create))
})
Handlebars.registerHelper('nacs', function (nacs: NAC[]) {
  if(!nacs || Array.isArray(nacs) && nacs.length == 0) return '';
  return new Handlebars.SafeString('forbid ' + nacs.map(nac => (nac.isSource ? 'src' : 'trg') + '(' + nac.name + ')').join(' && '))
})

Handlebars.registerHelper('assocprefix', function (type: string) {
  if (type == 'composition') { return new Handlebars.SafeString('<+>') }
  if (type == 'aggregation') { return new Handlebars.SafeString('<>') }
  return new Handlebars.SafeString('')
})

Handlebars.registerHelper('objref', function (prop: AssociatedObject) {
  let str = ''
  if (prop.create) { str += '++ ' }
  str += `-${prop.associationName}->${prop.objectName}`
  if (Array.isArray(prop.associationPattern) && (prop.associationPattern.length > 0)) {
    str += '{\n'
    prop.associationPattern.forEach(p => {
      str += '\t\t\t'
      if (p.type == 'attribute_value') { str += patternAttributeValueHelper(p, prop.create as boolean) }
      str += '\n'
    })
    str += '\t\t}'
  }
  return new Handlebars.SafeString(str)
})

Handlebars.registerHelper('ifOr', function (v1, v2, options) {
  if ((Array.isArray(v1) && v1.length > 0) || (Array.isArray(v2) && v2.length > 0)) {
    // @ts-ignore
    return options.fn(this)
  }
  return ''
})

Handlebars.registerHelper('objdef', function (obj: RuleObject) {
  return (obj.create === true ? '++ ' : '') + obj.name + ': ' + obj.class
})

Handlebars.registerHelper('constraint', function (constraint: Constraint) {
  let str = ''
  if (constraint.type == 'IfThenConstraint') {
    str = `constraint ${constraint.name} = if ${constraint.premiseName} then ${constraint.conclusionName}\n`
  } else if (constraint.type == 'ForbidContraint') {
    str = `constraint ${constraint.name} = forbid ${constraint.patternName}\n`
  }
  return new Handlebars.SafeString(str)
})

Handlebars.registerHelper('pattern', function (pattern: ConstraintPattern) {
  let str = ''
  if (pattern.type == 'BoundPattern') {
    str += `pattern ${pattern.name} {\n\ts: ${pattern.sourceClass} {\n`
    for (let i = 1; i <= pattern.bound; i++) {
      str += `\t\t-${pattern.associationName}->t${i}\n`
    }
    str += '\t}\n'
    for (let i = 1; i <= pattern.bound; i++) {
      str += `\tt${i}: ${pattern.targetClass}\n`
    }
    str += '}\n'
  } else if (pattern.type == 'ParentBoundPattern') {
    str += `pattern ${pattern.name} {\n\tc: ${pattern.childClass}\n`
    for (let i = 1; i <= pattern.bound; i++) {
      str += `\tp${i}: ${pattern.parentClass} {\n\t\t-${pattern.associationName}->c\n\t}\n`
    }
    str += '}\n'
  } else if (pattern.type == 'ExistPattern') {
    str += `pattern ${pattern.name} {\n\ts: ${pattern.class}\n}\n`
  } else if (pattern.type == 'RootPattern') {
    str += `pattern ${pattern.name} {\n\tr1: ${pattern.class}\n\tr2: ${pattern.class}\n}\n`
  } else if (pattern.type == 'SetPattern') {
    str += `pattern ${pattern.name} {\n\ts: ${pattern.sourceClass} {\n`
    str += `\t\t-${pattern.associationName}->t1\n`
    str += `\t\t-${pattern.associationName}->t1\n`
    str += '\t}\n'
    str += `\tt1: ${pattern.targetClass}\n`
    str += '}\n'
  }
  return new Handlebars.SafeString(str)
})
