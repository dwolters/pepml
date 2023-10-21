{{
  function implodeToObject(arr) {
    let obj = {};
    arr.forEach(i => {
      for(let key in i) {
        obj[key] = i[key];
      }
    })
    return obj;
  }
}}
MAPPING = options:OPTION* classMapping:CLASS_MAPPING+ {return {options,classMapping}}
OPTION = _ ':' name:STRICT_ID  values:(_ '=' _ @OPTION_VALUE ';')? {return {name, values}}
OPTION_VALUE = value:COMPOSITE_ID tail:(_ ',' _ @COMPOSITE_ID)* {return (Array.isArray(tail) && tail.length > 0 ? [value, ...tail] : [value])}
CLASS_MAPPING = source:ID sourceModifier:MODIFIER? sourcePattern:PATTERN? names:MAPPING_NAME target:ID targetModifier:MODIFIER? targetPattern:PATTERN? properties:PROPERTY_MAPPING* nacs:NACS? {return {...names,source, sourceModifier, sourcePattern, target, targetModifier, targetPattern, nacs, properties}}
MAPPING_NAME = '<=' name:ID? correspondenceName:(':' @ID)? '='? '>' {return {name, correspondenceName};}

NACS = _ 'forbid' _ head:NAC tail:(_ '&&' _ @NAC)* _ { return [head, ...tail]; }
NAC = origin:("src"/"trg") "(" name:ID ")" {return {isSource: origin == 'src', name} }

PROPERTY_MAPPING = _ source:(PROPERTY / REFERENCE) _ '<=>' _ target:(PROPERTY / REFERENCE) _ referenceAttributeMapping:REFERENCE_ATTRIBUTE_MAPPING* _ valueMapping:VALUE_MAPPING? _ 
{return {source, target, valueMapping,referenceAttributeMapping}}
REFERENCE_ATTRIBUTE_MAPPING = _ '(' _ source:(PROPERTY) _ '<=>' _ target:(PROPERTY) _ valueMapping:VALUE_MAPPING? _ ')' _ { return {source, target, valueMapping} }
PROPERTY = '.' name:STRICT_ID _ defaultValue:('=' @VALUE)?{ return {type: 'attribute', name,default:defaultValue};}
REFERENCE = associationPattern:REFERENCE_PATTERN _ attribute:PROPERTY? {return (attribute?{...associationPattern,targetAttribute:attribute,type:"associated_attribute"}:associationPattern);}
VALUE_MAPPING = '[' _ first:VALUE_PAIR tail:(_ "," _ @VALUE_PAIR _)* ']' { return (Array.isArray(tail) && tail.length > 0 ? [first, ...tail] : [first]);} 
VALUE_PAIR = leftValue:VALUE _ "=" _ rightValue:VALUE { return {source: leftValue, target: rightValue}; }
OUTGOING_CAP = startCap:('<' /'<>' / '<+>')? {return !startCap || Array.isArray(startCap) || startCap != '<';}

PATTERN = BEGIN pattern:(REFERENCE / ATTRIBUTE_VALUE_PATTERN)+ END {return pattern;}
ATTRIBUTE_PATTERN = BEGIN pattern:ATTRIBUTE_VALUE_PATTERN+ END {return pattern;}
ATTRIBUTE_VALUE_PATTERN = "." name:ID "=" value:VALUE {return ({type:'attribute_value', name, value});}

REFERENCE_PATTERN = outgoingCap:OUTGOING_CAP? "-" associationName:STRICT_ID associationPattern:ATTRIBUTE_PATTERN? target:TARGET_PATTERN? {return ({type:'association', associationName, associationPattern, isOutgoing:outgoingCap, ...target, explicit:true});}
TARGET_PATTERN = '-' ('>' / '<>' / '<+>')? targetClass:ID? targetModifier:MODIFIER? targetPattern:ATTRIBUTE_PATTERN? {return {targetClass,targetModifier,targetPattern}}

STRICT_ID = id:([A-Za-z0-9_])+ {return id.join('');}
COMPOSITE_ID = id1:STRICT_ID id2:('.' @STRICT_ID)? {return (id2 ? id1 + '.' + id2 : id1);}
ID = _ id:STRICT_ID _ {return id;}

VALUE = _ value:(PURE_VALUE / VALUE_ALTERNATIVES) _  { return value; }
PURE_VALUE = value:(STRING_VALUE / BOOLEAN_VALUE / NUMBER_VALUE / ENUM_VALUE)  { return value; }
VALUE_ALTERNATIVES = '[' _ first:PURE_VALUE tail:(_ "," _ @PURE_VALUE _)* ']' { return {value:(Array.isArray(tail) && tail.length > 0 ? [first, ...tail.map(t =>t)] : [first]), valueType: "alternatives"} } 
BOOLEAN_VALUE = value:('true' / 'false' / 'TRUE' / 'FALSE') { return {value:(value.toLowerCase() == 'true') ? true : false, valueType:"boolean"}; }
NUMBER_VALUE = value:([0-9]+('.'[0-9]+)?)  { return {value: value.flat().includes('.') ? parseFloat(value.flat().join('')) : parseInt(value.join('')), valueType:"number"}; }
STRING_VALUE = '"' value:([^"]*) '"' { return {value:value.join(''), valueType:"string"}; }
NULL_VALUE = value:ID { return {value, valueType:"null"}; }
ENUM_VALUE = value:ID { return {value, valueType:"enum"}; }

MODIFIER = modifier:('!' / '+' / '?') {return {'!':'exist','+':'create','?':'any'}[modifier]}

BEGIN = _ "{" _
END = _ "}" _
_  = [ \t\n\r]*
