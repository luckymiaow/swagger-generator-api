"use strict";
// #region  model
// https://www.npmjs.com/package/handlebars-helpers
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultApisTransformFn = exports.DefaultApisTransform = exports.defaultApisTransform = exports.getNamespacesString = exports.getClassString = exports.getActionString = exports.defaultModelTransformFn = exports.defaultModelTransform = exports.joinProperties = void 0;
function joinProperties(data, definition = 'class', isValue = true) {
    if (!data)
        return 'any';
    if (typeof data === 'string')
        return data;
    const res = data.map((item) => {
        let s = `${item.description ? `/*${item.description}*/\n` : ''}`;
        s += item.name;
        if (item.type)
            s += `${item.required ? '' : '?'}: ${item.type?.join('|')}`;
        if (['class', 'enum'].includes(definition) && isValue)
            s += ` = ${item.value}`;
        return s;
    });
    const str = `{${res.join(definition === 'enum' ? ',\n' : ';\n')}}`;
    return str;
}
exports.joinProperties = joinProperties;
// 示例使用handlebars模板替换
exports.defaultModelTransform = `
{{#each data.dependencys}}
import { {{this.modules}} } from './{{this.id}}';
{{/each}}
{{#if data.description}}/*{{data.description}}*/{{/if}}
export {{data.definition}} {{data.name}} {{#if data.extends}} extends {{data.extends}}{{/if}} {{#if (eq data.definition  'type')}} = {{/if}} {{properties data.properties data.definition}}`;
// 使用函数拼接示例
function defaultModelTransformFn(data) {
    const importStatements = data.dependencys
        ?.map((item) => {
        return `import { ${item.modules} } from './${item.id}';`;
    })
        .join('\n') || '';
    const descriptionComment = data.description
        ? `/*${data.description}*/\n`
        : '';
    const code = `${importStatements}
  ${descriptionComment}export ${data.definition} ${data.name} ${data.extends ? `extends ${data.extends}` : ''} 
    ${data.definition === 'type' ? '=' : ''}
  ${joinProperties(data.properties, data.definition)}
  `;
    return code;
}
exports.defaultModelTransformFn = defaultModelTransformFn;
// #endregion
// #region api
// 示例使用handlebars模板替换
function getActionString() {
    return `{{this.name}}({{#if this.parameters}}params: {{properties this.parameters false}}{{/if}}
  {{#if (and this.parameters this.requestBody)}}, {{/if}}{{#if this.requestBody}}data: {{ properties this.requestBody false}} {{/if}}
  {{#if (or this.parameters this.requestBody)}}, {{/if}}options?: AxiosRequestConfig): Promise<{{this.returnType}}> {
    return apiOptions.request({
      method: "{{this.method}}",
      url: \`{{replace  this.url '{' '$\{params.'  }}\`,
      {{#if this.parameters}}params,
      {{/if}}{{#if this.requestBody}}data,
      {{/if}}responseType:'{{this.responseType}}',
      ...(options || {})
    });
  }`;
}
exports.getActionString = getActionString;
function getClassString() {
    return `export class {{this.name}} {
    {{#each this.actions}}  
    /**
     * {{this.method}} {{this.url}}
     * {{this.description}}
     */
    static async ${getActionString()}
    {{/each}}
  }`;
}
exports.getClassString = getClassString;
function getNamespacesString() {
    return `export namespace {{this.name}} {
  {{#each this.controllers}}
  ${getClassString()}
  {{/each}}
}
{{#each data.controllers}}
${getClassString()}{{/each}}`;
}
exports.getNamespacesString = getNamespacesString;
exports.defaultApisTransform = `
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
{{#if data.dependencys}}
import { {{#each data.dependencys}} {{this.modules}},
 {{/each}} } from '../models';
{{/if}}
 //可以根据需要自行替换
export class apiOptions{
  static async request<TData, TResult>(options: AxiosRequestConfig<TData>): Promise<TResult> {
    return  axios.request<TData, AxiosResponse<TResult>>(options) as TResult;
  }
} 

{{#each data.namespaces}}
${getNamespacesString()}
{{/each}}

{{#each data.controllers}}
${getClassString()}
{{/each}}

{{#each data.actions}}
/**
 * {{this.method}} {{this.url}}
 * {{this.description}}
 */
export function ${getActionString()}
{{/each}}
`;
/**
 * 使用预设类进行灵活拼接
 */
class DefaultApisTransform {
    getImport() {
        return 'import axios, { AxiosRequestConfig, AxiosResponse } from \'axios\';\n';
    }
    getDependencys(dependencys) {
        const strs = [];
        if (dependencys) {
            strs.push('import {\n');
            strs.push(dependencys.map(item => item.modules).join(', \n'));
            strs.push('} from \'../models\'\n');
        }
        return strs.join('');
    }
    getApiOptions() {
        return (`export class apiOptions{
      static async request<TData, TResult>(options: AxiosRequestConfig<TData>): Promise<TResult> {
        return  axios.request<TData, AxiosResponse<TResult>>(options) as TResult;
      }
    }\n`);
    }
    getApiRequestName(action) {
        return 'apiOptions.request';
    }
    getReturnType(action) {
        return action.returnType;
    }
    getAction(action) {
        const strs = [];
        strs.push(`${action.name} (`);
        if (action.parameters?.length)
            strs.push(`params: ${joinProperties(action.parameters, 'interface', false)},`);
        if (action.requestBody?.length)
            strs.push(`data: ${joinProperties(action.requestBody, 'interface', false)},`);
        strs.push(`options?: AxiosRequestConfig ): Promise<${this.getReturnType(action)}> {\n`);
        strs.push(`return ${this.getApiRequestName(action)}({\n`);
        strs.push(`method: "${action.method}",\n`);
        strs.push(`url: "\`${action.url.replace('{', '${params.')}\`",\n`);
        if (action.requestBody)
            strs.push('data,\n');
        if (action.parameters)
            strs.push('params,\n');
        strs.push('...(options || {}),\n');
        strs.push('});\n');
        strs.push('}\n');
        return strs.join('');
    }
    getController(controller) {
        const strs = [];
        strs.push(`export class ${controller.name} {\n`);
        for (const action of controller.actions) {
            strs.push(` /**
              * ${action.name} ${action.url}
              * ${action.description || ''}
              */\n`);
            strs.push('static async ');
            strs.push(this.getAction(action));
        }
        strs.push('}\n');
        return strs.join('');
    }
    getNamespaces(namespace) {
        const strs = [];
        strs.push(`export namespace ${namespace.name} {\n`);
        for (const controller of namespace.controllers)
            strs.push(this.getController(controller));
        strs.push('}\n');
        return strs.join('');
    }
    /**
     * 拼接
     */
    generated(data) {
        const strs = [];
        strs.push(this.getImport());
        strs.push(this.getDependencys(data.dependencys));
        strs.push(this.getApiOptions());
        for (const namespace of data?.namespaces || [])
            strs.push(this.getNamespaces(namespace));
        for (const controller of data?.controllers || [])
            strs.push(this.getController(controller));
        for (const action of data?.actions || []) {
            strs.push(` /**
    * ${action.name} ${action.url}
    * ${action.description || ''}
    */`);
            strs.push('export async function ');
            strs.push(this.getAction(action));
        }
        return strs.join('');
    }
}
exports.DefaultApisTransform = DefaultApisTransform;
function defaultApisTransformFn(data) {
    const generated = new DefaultApisTransform();
    return {
        output: fileId => fileId,
        code: generated.generated(data),
    };
}
exports.defaultApisTransformFn = defaultApisTransformFn;
// #endregion
