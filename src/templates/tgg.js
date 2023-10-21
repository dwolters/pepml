import Handlebars from 'handlebars';
export default Handlebars.compile(`{{#if includeTripleGrammar}}tripleGrammar {{name}} {
	source {		
		{{sourceMetamodel.name}}
	}
	target {
		{{targetMetamodel.name}}
	}
	correspondence {
		{{#each correspondences}}
		{{sourceClass}} <- {{name}} -> {{targetClass}}
		{{/each}}
	}
	rules {
		{{#each rules}}
		{{name}}
		{{/each}}
	}
	{{#if constraints}}
	constraints {
		{{#each constraints}}
		{{name}}
		{{/each}}
	}
	{{/if}}
}{{/if}}

{{#each constraints}}
{{constraint this}}
{{/each}}
{{#each patterns}}
{{pattern this}}
{{/each}}
{{#each rules}}
tripleRule {{name}} : {{../name}} {
	{{> objects name='source' objects=sourceObjects}}
	{{> objects name='target' objects=targetObjects}}
	correspondence {
		{{#each correspondences}}
		{{#if create}}++ {{/if}}{{sourceObjectName}} <- :{{type}} -> {{targetObjectName}}
		{{/each}}		
	}
} {{nacs nacs}}

{{/each}}
{{#*inline "objects"}}
{{name}} {
	{{#each objects}}
	{{objdef this}} {{#ifOr attributes associatedObjects}}{
		{{#each attributes}}
		{{attr this ../create}}
		{{/each}}
		{{#each associatedObjects}}
		{{objref this}}
		{{/each}}
	}{{/ifOr}}
	{{/each}}
}
{{/inline}}`);