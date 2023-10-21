  {{
    function splitObjects(objsWithAssocs,isSource) {
      if(!objsWithAssocs) return {associations: [], objects: []}
      let associations = [];
      let objects = [];
      objsWithAssocs.forEach(objWithAssocs => {
        objects.push(objWithAssocs);
        let attributes = [];
        objWithAssocs.properties?.forEach(p => {
          if(p.type.indexOf('_attribute')> -1)
            attributes.push(p);
          else
            associations.push({sourceObject: objWithAssocs.name, isSource,...p});
        })
        objWithAssocs.isSource = isSource
        delete objWithAssocs.properties;
        objWithAssocs.attributes = attributes;
      })
      return {associations, objects};
    }
  }}
  RULES
    = (TRIPLERULE / PATTERN / CONSTRAINT)*
  
  TRIPLERULE
    = "tripleRule" name:ID ":" tggName:ID BEGIN sourceObjects:SOURCEBLOCK? targetObjects:TARGETBLOCK? correspondences:CORRESPONDENCEBLOCK? END nacs:NACS? _ 
      { return { type:"rule", name, tggName, source: splitObjects(sourceObjects,true), target: splitObjects(targetObjects,false), correspondences, nacs }; }
  NACS = 'forbid' _ head:NAC tail:(_ '&&' _ @NAC)* { return [head, ...tail]; }
  NAC = origin:("src"/"trg") "(" name:ID ")" {return {isSource: origin == 'src', name} }
  
  CONSTRAINT = "constraint" name:ID "=" _ subtype:(FORBID / ENFORCE / IFTHEN) { return {...subtype, name}}
  FORBID = "forbid" pattern:ID { return {type:"constraint_forbid", pattern};}
  ENFORCE = "enforce" pattern:ID { return {type:"constraint_enforce", pattern};}
  IFTHEN = "if" premise:ID "then" conclusion:ID { return {type:"constraint_ifthen", premise, conclusion};}
  
  PATTERN
    = "pattern" name:ID BEGIN objects:OBJECT* END { return {type: "pattern", name, ...splitObjects(objects)}}
  
  SOURCEBLOCK
    = "source" BEGIN objects:OBJECT* END
      { return objects; }
      
  TARGETBLOCK
    = "target" BEGIN objects:OBJECT* END
      { return objects; }
  
  OBJECT
    = created:CREATION name:ID _ className:(":" @ID) properties:(BEGIN @(ASSOCIATION / ATTRIBUTE)* END)?
      { return {created, type:'rule_object', name, class: className, properties }; }
      
  ASSOCIATION_TYPE = type:('-' /'<>-' / '<+>-') {return {'-':'assocation','<>-':'aggregation','<+>-':'composition'}[type];}
  
  ASSOCIATION
    = created:CREATION _ type:ASSOCIATION_TYPE assocationName:ID '->' targetObject:ID attributes:(BEGIN @ATTRIBUTE* END)?
      { return {created, type, assocationName, targetObject, attributes }; }
      
  ATTRIBUTE
    = "." name:ID ":" "="? value:VALUE
      { return { name, ...value }; }
  
  VALUE = _ value:(STRING_VALUE / BOOLEAN_VALUE / NUMBER_VALUE / ENUM_VALUE / VARIABLE) _  { return value; }
  VARIABLE = "<" value:ID ">" {return {type:'variable_attribute', value};}
  BOOLEAN_VALUE = value:('true' / 'false' / 'TRUE' / 'FALSE') { return {type: 'boolean_attribute', value: value.toLowerCase() == 'true'}; }
  NUMBER_VALUE = value:([0-9]+('.'[0-9]+)?)  { return {type: 'number_attribute', value: value.flat().includes('.') ? parseFloat(value.flat().join('')) : parseInt(value.join(''))}; }
  STRING_VALUE = '"' value:([^"]*) '"' { return {type: 'string_attribute', value: value.join('')}; }
  ENUM_VALUE = value:ID { return {type: 'enum_attribute', value}; }
  
  CORRESPONDENCEBLOCK
    = "correspondence" BEGIN CORRESPONDENCEMAPPINGS:CORRESPONDENCEMAPPINGS END
      { return CORRESPONDENCEMAPPINGS; }
  
  CORRESPONDENCEMAPPINGS
    = FIRST:CORRESPONDENCEMAPPING REST:(_ CORRESPONDENCEMAPPING)*
      { return [FIRST].concat(REST.map(item => item[1])); }
  
  CORRESPONDENCEMAPPING
    = created:CREATION sourceObject:ID "<-" _ ":" name:ID "->" targetObject:ID
      { return {type:'correspondence_object', created, sourceObject, name, targetObject }; }
      
  CREATION = op:('++')? {return op == '++';}
  
  STRICT_ID = id:([A-Za-z0-9_])+ {return id.join('');}
  COMPOSITE_ID = id1:STRICT_ID id2:('.' @STRICT_ID)? {return (id2 ? id1 + '.' + id2 : id1);}
  ID = _ id:STRICT_ID _ {return id;}
  
  BEGIN = _ "{" _
  END = _ "}" _
  _  = [ \t\n\r]*