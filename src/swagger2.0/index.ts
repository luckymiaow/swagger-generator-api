/*
 * @Description:
 * @Author: luckymiaow
 * @Date: 2023-09-11 15:55:35
 * @LastEditors: luckymiaow
 */

import camelCase from 'camelcase';
import type { ApiAction, ApiController, ApiProperties, ApiType, HttpMethod, ModelType } from '../../types'
import type { Definition, Definitions, Parameters, Paths, Propertie, Responses, Swagger2 } from './type'

export async function parseV2(swDoc: Swagger2) {
  const apis = genDoc(swDoc)
  const models = genModel(swDoc.definitions)

  return { apis, models }
}

function genDoc(swaggerDoc: Swagger2): ApiType {
  const res: ApiType = {
    namespaces: [],
    controllers: [],
    actions: [],
  }

  const apiController: Record<string, ApiController> = {}

  for (const path in swaggerDoc.paths) {
    const obj = swaggerDoc.paths[path];

    const names = path.split('/').filter(Boolean)
    if (names.length === 1) {
      for (const key in obj) {
        const action = obj[key as HttpMethod];
        res.actions?.push(getAction(names[0], path, key, action))
      }
    }
    else {
      const controllerName = names[0]
      if (!(controllerName in apiController)) {
        apiController[controllerName] = {
          name: upperFirst(controllerName),
          description: (obj as any)?.[Object.keys(obj)?.[0]]?.tags?.[0],
          actions: [],
        }
      }
      for (const key in obj) {
        const action = obj[key as HttpMethod];
        apiController[controllerName].actions.push(getAction(names[names.length - 1], path, key, action))
      }
    }
  }

  res.controllers = Object.values(apiController)

  return res;
}

function getAction(name: string, url: string, method: string, pathObj: Paths): ApiAction {
  const actionLower = name.toLowerCase();
  const methodLower = method.toLowerCase();
  let fnName = camelCase(name, { pascalCase: true });
  if (!(actionLower.startsWith(methodLower) || actionLower.endsWith(methodLower)))
    fnName += `_${camelCase(method, { pascalCase: true })}`;
  if (!actionLower.endsWith('async')) fnName += 'Async';

  const res = {
    url,
    method: method.toLocaleUpperCase() as any,
    name: fnName,
    responseType: getResponseType(pathObj),
    returnType: getResultType(pathObj.responses),
    requestBody: getParameters(pathObj.parameters, ['body']),
    parameters: getParameters(pathObj.parameters, ['query', 'path']),
  } as ApiAction
  return res;
}

function genModel(definitions: Definitions) {
  const models: ModelType[] = []

  for (const key in definitions) {
    const item = definitions[key]
    const mode: ModelType = {
      definition: 'type',
      name: key,
      key,
      dependencys: [],
      description: item.description,
    }

    const leadInto = new Set()

    for (const attribute in item.properties) {
      mode.properties?.push({
        description: item.properties[attribute].description || attribute,
        name: attribute,
        type: [getType(item.properties[attribute])],
        required: item.required,

      })
    }

    mode.dependencys = Array.from(leadInto).map(e => ({
      id: e as string,
      modules: e as string,
    }))
  }

  return models;
}

function getType(data: Propertie): string {
  if (data?.schema)
    return getType(data?.schema)

  if (data?.type === 'integer')
    return 'number'
  if (data?.type === 'array') {
    if (data?.items.$ref)
      return `Array<${extractMethodNames(data.items.$ref)}>`
    else if (data?.items.type)
      return `Array<${getType(data.items)}>`
  }
  if (data?.$ref)
    return extractMethodNames(data.$ref)
  if (data?.type === 'file')
    return 'FormData'
  return data?.type || 'any'
}

function extractMethodNames(input: string) {
  const names = input?.split('/').filter(e => !e.includes('{'))
  return `${names?.[names.length - 1]}`
}
function upperFirst(input: string): string {
  // 将字符串的第一个字符转换为大写，然后与其余部分拼接
  return input.charAt(0).toUpperCase() + input.slice(1)
}

function getParameters(parameters: Parameters[] | undefined, type: Array<'body' | 'query' | 'path'>) {
  const body = parameters?.filter(e => type.includes(e.in)) || [];

  return body.map<ApiProperties>((e) => {
    return {
      name: e.name,
      description: e.description,
      type: [getType(e)],
      required: e.required,
      isPath: e.in === 'path',
    }
  })
}

function getResultType(responses: Responses) {
  let returnValueType = 'void'
  if (responses[200]?.schema) {
    returnValueType = getType(responses[200].schema)
    returnValueType = `${returnValueType}`
  }

  return returnValueType
}

function getResponseType(pathObj: Paths) {
  let returnValueType = 'json'
  if (pathObj.responses[200]?.schema) {
    returnValueType = getType(pathObj.responses[200].schema)
    returnValueType = returnValueType === 'any' ? 'json' : returnValueType
  }
  return returnValueType
}

function makeTypename(type?: Definition) {
  if (type)

    return type.title

  return 'void';
}
