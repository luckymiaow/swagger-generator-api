import type { ApiType, ModelType } from './'
import { defineConfig } from './src/index'
import { DefaultApisTransform, defaultModelTransformFn, joinProperties } from './src/presets'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

export default defineConfig({
  version: 'v3',
  apiDocs: [
    {
      url: `https://localhost:7227/swagger/v1/swagger.json`,
      basePath: '.generated',
      template: {
        models: {
          transform: defaultModelTransformFn,
          dts: true,
          onBeforeWriteFile: (model: ModelType, _, modelDir) => {
            if (model.name === ('PackedApiResult'))
              model.name = 'PackedApiResult<TData>'

            if (model.properties) {
              model.properties.forEach((v) => {
                v.type = v.type?.map(a => a === 'Date' ? 'Dayjs' : a)
                if (v.required) {
                  const type = v.type?.find(v => modelDir[v])
                  if (type && ['null', 'undefined'].includes(v.value)) {
                    if ((modelDir[type].definition === 'class'))
                      v.value = `new ${type}()`
                    else if (modelDir[type].definition === 'enum')
                      v.value = `${type}.${modelDir[type].properties?.[0].name}`
                  }
                  else if (v.type?.includes('boolean')) { v.value = 'false' }
                  else if (v.type?.includes('Dayjs')) { v.value = 'dayjs()' }
                }

                if (v.required && v.type?.includes('string'))
                  v.value = v.meta.example ?? '""'

                if (v.meta?.type === 'array' && v.meta.items?.format === 'uuid') {
                  v.type = ['Array<GUID>'];
                }

                if (v.meta?.format === 'uuid') {
                  v.type = ['GUID'];
                  if (v.required) v.value = '"00000000-0000-0000-0000-000000000000"'
                }
              })
            }
            return model
          },
        },
        api: {
          transform: (data, fileId: string) => {
            const generated = new DefaultApisTransform()


            generated.getApiOptions = () => {
              return `
              export class apiOptions{
                static async request<TData, TResult>(options: AxiosRequestConfig<TData>): Promise<TResult> {
                  return  axios.request<TData, AxiosResponse<TResult>>(options) as TResult;
                }
              }\n
              export async function requestPackedApi<TData, TResult>(options: AxiosRequestConfig<TData>){
                const data = await apiOptions.request<TData, PackedApiResult<TResult>>(options) ;
                if(!data.success) throw new Error(data.data as string)
                return data.data as TResult;
              }\n

              `
            }

            const _getApiRequestName = generated.getApiRequestName
            generated.getApiRequestName = (action) => {
              if (typeof action.returnType === 'string') {
                if (action.returnType === 'Blob') {
                  return 'request'
                }
                const match = action.returnType.match(/^PackedApiResult<(.*)>$/)
                if (match)
                  return 'requestPackedApi'
              }
              return _getApiRequestName(action)
            }

            generated.getReturnType = (action) => {
              if (action.returnType === 'PackedApiResult<IActionResult>') {
                action.responseType = 'blob'
                action.returnType = 'Blob'
              }
              if (typeof action.returnType === 'string') {
                const match = action.returnType.match(/^PackedApiResult<(.*)>$/)
                if (match)
                  return match[1]
              }
              return action.returnType
            }

            const _getAction = generated.getAction

            generated.getAction = (action) => {

              if (Array.isArray(action.parameters)) {
                action.parameters = action.parameters?.filter((obj, index, self) =>
                  index === self.findIndex((t) => (
                    t.name === obj.name
                  )));
                action.parameters.forEach((v) => {
                  if (v.meta?.format === 'uuid') {
                    v.type = ['GUID'];
                    if (v.required) v.value = '"00000000-0000-0000-0000-000000000000"'
                  }
                })
              }



              let isNewFormData = false;
              if (action.requestBody === 'FormData' && action.requestBodyFormData && typeof action.requestBodyFormData === 'object') {
                action.requestBody = action.requestBodyFormData
                isNewFormData = true
              }

              if (Array.isArray(action.requestBody)) {
                action.requestBody.forEach((v) => {
                  if (v.meta?.format === 'uuid') {
                    v.type = ['GUID'];
                    if (v.required) v.value = '"00000000-0000-0000-0000-000000000000"'
                  }
                })
              }

              const strs: string[] = [];
              strs.push(`${action.name} (`);
              if (action.parameters?.length)
                strs.push(`params: ${joinProperties(action.parameters, 'interface', false)},`);
              if (action.requestBody?.length)
                strs.push(`data: ${joinProperties(action.requestBody, 'interface', false)},`);
              strs.push(`options?: AxiosRequestConfig ): Promise<${generated.getReturnType(action)}> {\n`);

              if (isNewFormData) {
                strs.push(`const formData = new FormData();\n`);
                (action.requestBodyFormData as any)!.forEach((v) => {
                  strs.push(`formData.append('${v.name}', data.${v.name} as any);\n`);
                })
              }

              strs.push(`return ${generated.getApiRequestName(action)}({\n`);
              strs.push(`method: "${action.method}",\n`);
              strs.push(`url: \`${action.url.replace('{', '${params.')}\`,\n`);

              if (action.requestBody) {
                if (isNewFormData) {
                  strs.push('data:formData ,\n');
                } else {
                  strs.push('data,\n');
                }
              }

              if (action.parameters)
                strs.push('params,\n');
              if (action.responseType)
                strs.push(`responseType:'${action.responseType}',\n`);
              strs.push('...(options || {}),\n');
              strs.push('});\n');
              strs.push('}\n');

              return strs.join('');;
            }
            // const t = {
            //   ...data,
            //   controllers: data.namespaces?.flatMap(v => v.controllers),
            //   namespaces: undefined
            // } as ApiType

            const code = generated.generated(data) || '';

            return {
              output: fileId,
              code,
            }
          },

        },
        onAfterWriteFile: (models, apis) => {
          // const fix = path => exec(`eslint ${path} --fix`, (error, stdout, stderr) => {
          //   if (error) {
          //     console.error(`执行错误: ${error.message}`)
          //     return
          //   }
          //   if (stderr) {
          //     console.error(`标准错误输出: ${stderr}`)
          //     return
          //   }

          //   console.log(`格式化修复成功: ${path}`)
          // })

          // Object.values(models?.paths || {}).forEach(fix)
          // Object.values(apis?.paths || {}).forEach(fix)
        },
      },
    },
  ],
})
