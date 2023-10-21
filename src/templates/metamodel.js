import Handlebars from 'handlebars';
export default Handlebars.compile(`metamodel {{name}} {
    {{#each classes}}
        {{#if abstract}}abstract {{/if}}{{name}}{{#if extends}} : {{extends}}{{/if}} {
    {{#each attributes}}
            .{{name}} : {{type}}
    {{/each}}
    {{#each associations}}
            {{assocprefix type}}-{{name}}({{lower}}..{{#if upper}}{{upper}}{{else}}*{{/if}})->{{target}}{{#if attributes}} {
    {{#each attributes}}
                .{{name}} : {{type}}
    {{/each}}
            }{{/if}}
    {{/each}}
        }
    {{/each}}
    {{#each enums}}
        enum {{name}} {
    {{#each values}}
            {{this}}
    {{/each}}
        }
    {{/each}}
}`);