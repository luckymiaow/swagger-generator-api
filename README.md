
#使用
`yarn add swagger-generator-api -D`
`yarn gen_api`


##api.config.ts

```typescript
import { defineConfig } from 'swagger-generator-api';
import { defaultApisTransform, defaultModelTransformFn } from 'swagger-generator-api/lib/presets';

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
          transform: defaultApisTransform,
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

import type { ApiType, ModelType, TransformReturn } from '../types';
import { prettierCode } from './code-gen';

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
}`

// 使用函数拼接示例
export function defaultModelTransformFn(data: ModelType): string {
  const importStatements = data.dependencys?.map((item) => {
    return `import { ${item.modules} } from './${item.id}';`;
  }).join('\n') || '';

  const descriptionComment = data.description ? `/*${data.description}*/\n` : '';

  const propertiesDeclaration = data.properties?.map((item) => {
    const descriptionComment = item.description ? `    /*${item.description}*/\n` : '';
    return `    ${descriptionComment}${item.name}: ${item.type.join(' | ')} = ${item.value};`;
  }).join('\n\n') || '';

  const code = `${importStatements}
  ${descriptionComment}export ${data.definition} ${data.name} ${data.extends ? `extends ${data.extends}` : ''} {
  ${propertiesDeclaration}
  }`

  return prettierCode(code);
}

// #endregion

// #region api
// 示例使用handlebars模板替换
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
export namespace {{this.name}} {
  {{#each this.controllers}}
  export class {{this.name}} {
    {{#each this.actions}}  
    /**
     * {{this.method}} {{this.url}}
     * {{this.description}}
     */
    static async {{this.name}}(params: {{properties this.parameters false}}{{#if this.requestBody}}, data: {{ properties this.requestBody false}} {{/if}}, options?: AxiosRequestConfig): Promise<{{this.returnType}}> {
      return apiOptions.request({
        method: "GET",
        url: \`{{replace  this.url '{' '$\{params.'  }}\`,
        params,{{#if this.requestBody}}data,{{/if}}responseType:'{{this.responseType}}',
        ...(options || {})
      });
    }
    {{/each}}
  }
  {{/each}}
}
{{/each}}
{{#each data.controllers}}
export class {{this.name}} {
  {{#each this.actions}}  
  /**
   * {{this.method}} {{this.url}}
   * {{this.description}}
   */
  static async {{this.name}}(params: {{properties this.parameters false}}{{#if this.requestBody}}, data: {{properties this.requestBody false}} {{/if}}, options?: AxiosRequestConfig): Promise<{{this.returnType}}> {
    return apiOptions.request({
      method: "GET",
      url: \`{{replace  this.url '{' '$\{params.'  }}\`,
      params,{{#if this.requestBody}}data,{{/if}}responseType:'{{this.responseType}}',
      ...(options || {})
    });
  }
  {{/each}}
}
{{/each}}

{{#each data.actions}}
/**
 * {{this.method}} {{this.url}}
 * {{this.description}}
 */
export function {{this.name}}(params: {{properties this.parameters false}} {{#if this.requestBody}}, data: {{ properties this.requestBody false}} {{/if}}, options?: AxiosRequestConfig): Promise<{{this.returnType}}> {
  return apiOptions.request({
    method: "GET",
    url: \`{{replace  this.url '{' '$\{params.'  }}\`,
    params,{{#if this.requestBody}}data,{{/if}}responseType:'{{this.responseType}}',
    ...(options || {})
  });
}
{{/each}}
`

export function defaultApisTransformFn(data: ApiType): Array<TransformReturn> | TransformReturn {
  console.log('%c [  ]-100', 'font-size:13px; background:pink; color:#bf2c9f;', 1)
  throw ''
}

// #endregion


```

