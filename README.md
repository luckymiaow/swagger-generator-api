
#使用
`yarn add swagger-generator-api -D`
`yarn gen_api`

###遇到https证书问题可以在配置文件中增加这行配置 `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';` 临时跳过证书校验

##api.config.ts

```typescript
import type { ApiType } from 'swagger-generator-api';
import { defineConfig } from 'swagger-generator-api';
import { DefaultApisTransform, defaultModelTransformFn } from 'swagger-generator-api/lib/presets';

const baseUrl = 'https://localhost:7299';

export default defineConfig({
  version: 'v3',
  apiDocs: [
    {
      url: `${baseUrl}/swagger/v1/swagger.json`,
      basePath: '.generated',
      template: {
        models: {
          transform: defaultModelTransformFn,
          dts: true,
        },
        api: {
          output: (fileId: string) => {
            // 演示使用函数自定义api输出目录
            return fileId.replace('apis', 'requests')
          },
          transform: (apis: ApiType, fileId: string) => {
            const generated = new DefaultApisTransform();
            generated.getApiOptions = () => {
              return `export class apiOptions {
                static async request<TData, TResult>(
                  options: AxiosRequestConfig<TData>
                ): Promise<TResult> {
                  return axios.request<TData, AxiosResponse<TResult>>(options) as TResult;
                }

                static async callPackedApiAsync<TData, TResult>(
                  options: AxiosRequestConfig<TData>
                ): Promise<TResult> {
                  const result = (await apiOptions.request<TData, AxiosResponse<TResult>>(options)) as unknown as PackedApiResult<TResult>;
                  if (!result.success) {
                    throw new Error("请求接口错误");
                  }
                  return result.data!;
                }
              }`
            }
            generated.getReturnType = (action) => {
              if (typeof action.returnType === 'string' && action.returnType?.includes('PackedApiResult'))
                return action.returnType?.replace(/^PackedApiResult<(.*)>$/g, '$1')
              return action.returnType
            }
            generated.getApiRequestName = (action) => {
              if (typeof action.returnType === 'string' && action.returnType.includes('PackedApiResult')) return 'apiOptions.callPackedApiAsync'
              return 'apiOptions.request'
            }
            return {
              code: generated.generated(apis),
              output: fileId,
            }
          },
        },
        onAfterWriteFile: (models, apis) => {
          // 这里可以做一些生成后的操作，
        },
      },
    },
  ],
})

```

##预设配置，可以参考配置信息

```typescript
// #region  model
// https://www.npmjs.com/package/handlebars-helpers

import type { ApiAction, ApiController, ApiNamespace, ApiType, Dependency, ModelType, Properties, TransformReturn } from '../types';

export function joinProperties(
  data?: Properties[] | string,
  assignment = true,
) {
  if (!data) return undefined;
  if (typeof data === 'string') return data;
  return `{
    ${data
      .map((item) => {
        return `${item.description ? `/*${item.description}*/\n` : ''}${
          item.name
        }${item.required ? '' : '?'}: ${item.type.join('|')}${
          assignment ? ` = ${item.value}` : ''
        }`;
      })
      .join(';\n')}}`;
}

// 示例使用handlebars模板替换
export const defaultModelTransform = `
{{#each data.dependencys}}
import { {{this.modules}} } from './{{this.id}}';
{{/each}}
{{#if data.description}}/*{{data.description}}*/{{/if}}
export {{data.definition}} {{data.name}} {{#if data.extends}}extends {{data.extends}}{{/if}} {
  {{#each data.properties}}
  {{#if this.description}}/*{{this.description}}*/{{/if}}
  {{this.name}}: {{join this.type ' | '}} = {{this.value}};
  {{/each}}
}`;

// 使用函数拼接示例
export function defaultModelTransformFn(data: ModelType): string {
  const importStatements
    = data.dependencys
      ?.map((item) => {
        return `import { ${item.modules} } from './${item.id}';`;
      })
      .join('\n') || '';
  const descriptionComment = data.description
    ? `/*${data.description}*/\n`
    : '';

  const propertiesDeclaration
    = data.properties
      ?.map((item) => {
        const descriptionComment = item.description
          ? `    /*${item.description}*/\n`
          : '';
        const isClassText = ['interface', 'type'].includes(data.definition)
          ? ''
          : ` = ${item.value}`;
        return `    ${descriptionComment}${item.name}: ${item.type.join(
          ' | ',
        )}${isClassText}`;
      })
      .join('\n\n') || '';

  const code = `${importStatements}
  ${descriptionComment}export ${data.definition} ${data.name} ${
    data.extends ? `extends ${data.extends}` : ''
  } {
  ${propertiesDeclaration}
  }`;
  return code;
}

// #endregion

// #region api
// 示例使用handlebars模板替换

export function getActionString() {
  return `{{this.name}}({{#if this.parameters}}params: {{properties this.parameters false}}{{/if}}{{#if (and this.parameters this.requestBody)}}, {{/if}}{{#if this.requestBody}}data: {{ properties this.requestBody false}} {{/if}}{{#if (or this.parameters this.requestBody)}}, {{/if}}options?: AxiosRequestConfig): Promise<{{this.returnType}}> {
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

export function getClassString() {
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

export function getNamespacesString() {
  return `export namespace {{this.name}} {
  {{#each this.controllers}}
  ${getClassString()}
  {{/each}}
}
{{#each data.controllers}}
${getClassString()}{{/each}}`;
}

export const defaultApisTransform = `
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { {{#each data.dependencys}} {{this.modules}},
 {{/each}} } from '../models';

 //可以根据需要自行替换
export class apiOptions{
  static async request<TData, TResult>(options: AxiosRequestConfig<TData>): Promise<TResult> {
    return  axios.request<TData, AxiosResponse<TResult>>(options) as TResult;
  }
} 

{{#each data.namespaces}}
${getNamespacesString()}
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
export class DefaultApisTransform {
  getImport() {
    return 'import axios, { AxiosRequestConfig, AxiosResponse } from \'axios\';\n'
  }

  getDependencys(dependencys?: Dependency[]) {
    const strs: string[] = [];
    if (dependencys) {
      strs.push('import {\n');
      strs.push(dependencys.map(item => item.modules).join(', \n'));
      strs.push('} from \'../models\'\n');
    }
    return strs.join('')
  }

  getApiOptions() {
    return (`export class apiOptions{
      static async request<TData, TResult>(options: AxiosRequestConfig<TData>): Promise<TResult> {
        return  axios.request<TData, AxiosResponse<TResult>>(options) as TResult;
      }
    }\n`);
  }

  getApiRequestName(action: ApiAction) {
    return 'apiOptions.request'
  }

  getReturnType(action: ApiAction) {
    return action.returnType
  }

  getAction(action: ApiAction) {
    const strs: string[] = []
    strs.push(`${action.name} (`);
    if (action.parameters)
      strs.push(`params: ${joinProperties(action.parameters, false)},`);
    if (action.requestBody)
      strs.push(`data: ${joinProperties(action.requestBody, false)},`);
    strs.push(
      `options?: AxiosRequestConfig ): Promise<${this.getReturnType(action)}> {\n`,
    );
    strs.push(`return ${this.getApiRequestName(action)}({\n`);
    strs.push(`method: "${action.method}",\n`);
    strs.push(`url: "${action.url.replace('{', '${params.')}",\n`);
    if (action.requestBody) strs.push('data,\n');
    if (action.parameters) strs.push('params,\n');
    strs.push('...(options || {}),\n');
    strs.push('});\n');
    strs.push('}\n');
    return strs.join('');
  }

  getController(controller: ApiController) {
    const strs: string[] = []
    strs.push(`export class ${controller.name} {\n`);
    for (const action of controller.actions) {
      strs.push(` /**
              * ${action.name} ${action.url}
              * ${action.description || ''}
              */\n`);
      strs.push('static async ');
      strs.push(this.getAction(action))
    }
    strs.push('}\n');
    return strs.join('')
  }

  getNamespaces(namespace: ApiNamespace) {
    const strs: string[] = []
    strs.push(`export namespace ${namespace.name} {\n`);
    for (const controller of namespace.controllers)
      strs.push(this.getController(controller))
    strs.push('}\n');
    return strs.join('')
  }

  /**
   * 拼接
   */
  generated(data: ApiType) {
    const strs: string[] = [];
    strs.push(this.getImport())
    strs.push(this.getDependencys(data.dependencys))
    strs.push(this.getApiOptions())
    for (const namespace of data?.namespaces || [])
      strs.push(this.getNamespaces(namespace))

    for (const controller of data?.controllers || [])
      strs.push(this.getController(controller))

    for (const action of data?.actions || []) {
      strs.push(` /**
    * ${action.name} ${action.url}
    * ${action.description || ''}
    */`);
      strs.push('export async function ');
      strs.push(this.getAction(action))
    }
    return strs.join('')
  }
}

export function defaultApisTransformFn(
  data: ApiType,
): Array<TransformReturn> | TransformReturn {
  const generated = new DefaultApisTransform();
  return {
    output: fileId => fileId,
    code: generated.generated(data),
  };
}

// #endregion

```

