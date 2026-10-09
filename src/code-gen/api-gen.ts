import { parse } from 'node:path';
import camelCase from 'camelcase';
import handlebars from 'handlebars';
import type { OpenAPI3, OpenAPI3Operation, OpenAPI3Parameter, Parameter } from '../schema';
import type { ApiAction, ApiController, ApiOption, ApiProperties, ApiReturnResults, ApiType, ISettingsV3, ModelReturnResults, ModelType, Properties } from '../../types';
import { defaultApisTransform } from '../presets';
import { HttpStatusCodes } from './types';
import type { DotNetTypes, IAipContent, IApiBody, IApiOperation, IApiParameter, IDotnetType, IDotnetTypeRef } from './types';
import { getFileId, makeTypename, prettierCode, writeFileWithDirectoryCreation } from './utils';
import { buildType, buildTypeRef } from './type-builder';
import { getModelByIDotnetType } from './model-gen';

function transformParameters(parameters: Parameter[], definedTypes: DotNetTypes): IApiParameter[] {
  return parameters.map((item) => {
    if ('schema' in item) {
      const param = item as OpenAPI3Parameter;
      const type = buildType(param.schema, definedTypes);
      return {
        name: param.name,
        description: param.description,
        in: param.in,
        required: param.required,
        type,
        schema: param.schema,
      };
    }
    else {
      throw `not supported parameter definatin:${JSON.stringify(item, null, 2)}`;
    }
  });
}

function transformOperation(
  method: string,
  path: string,
  operation: OpenAPI3Operation,
  definedTypes: DotNetTypes,
): IApiOperation {
  const { summary, description } = operation;

  let requestBody, responseBody, parameters;

  if (operation.parameters) parameters = transformParameters(operation.parameters, definedTypes);

  if (operation.requestBody && operation.requestBody.content) {
    const content: IAipContent = {};
    for (const [contentType, contentDef] of Object.entries(operation.requestBody.content))
      content[contentType] = buildTypeRef(contentDef.schema, definedTypes);

    requestBody = {
      description: operation.requestBody.description,
      content,
    };
  }

  const resonseDef = operation.responses[HttpStatusCodes.OK];
  if (resonseDef) {
    let contentTypes, responseType;
    let content: IAipContent | undefined;
    if (resonseDef.content) {
      content = {};
      for (const [contentType, contentDef] of Object.entries(resonseDef.content))
        content[contentType] = buildTypeRef(contentDef.schema, definedTypes);
    }
    responseBody = {
      description: resonseDef.description,
      content,
    };
  }

  return {
    method,
    path,
    operationId: operation.operationId,
    summary,
    description,
    parameters,
    requestBody,
    responseBody,
    auth: operation['x-limit'],
  };
}

function getResponseType(responseBody?: IApiBody) {
  if (responseBody && responseBody.content) {
    const contentTypes = Object.keys(responseBody.content);
    if (contentTypes.find(c => /\/octet-stream$/.test(c))) return 'blob';
    if (contentTypes.find(c => /\/json$/.test(c))) return 'json';
  }

  return 'json';
}

function getParameters(data: IApiParameter[] | undefined | null, type: Array<'query' | 'header' | 'path' | 'cookie'>): string | ApiProperties[] | undefined {
  const res = data?.flatMap((e) => {
    if (!type.includes(e.in)) return []
    return {
      name: e.name,
      description: e.description,
      required: e.required === true,
      type: [makeTypename(e.type)],
      isPath: e.in === 'query',
      meta: e.schema,
    } as ApiProperties;
  });
  if (res?.length) return res;
  return undefined
}
function getRequestBody(requestBody?: IApiBody): string | undefined {
  if (!requestBody?.content) return undefined;
  const contentTypes = Object.keys(requestBody.content);
  const jsonContentType = contentTypes.find(c => /\/json$/.test(c));
  let contentType: string | undefined;
  let contentTypeDef: IDotnetTypeRef | undefined;
  if (jsonContentType) {
    contentType = jsonContentType;
    contentTypeDef = requestBody.content[jsonContentType];
  }
  else if (contentTypes.includes('multipart/form-data')) {
    contentType = 'multipart/form-data';
    const typeRef = {
      isBuildInType: true,
      name: 'FormData',
      fullName: 'FormData',
    };
    contentTypeDef = { typeRef, nullable: true };
  }

  if (!contentTypeDef) return 'unknown';

  return makeTypename(contentTypeDef.typeRef);
}

function getResultType(responseBody?: IApiBody) {
  if (!responseBody || !responseBody.content) return 'Blob';

  let resultTypeRef: IDotnetTypeRef | undefined;
  const contentTypes = Object.keys(responseBody.content);

  const blobContentType = contentTypes.find(c => /\/octet-stream$/.test(c));

  if (blobContentType) return 'Blob';

  const jsonContentType = contentTypes.find(c => /\/json|\*\/\*$/.test(c));

  if (jsonContentType) {
    resultTypeRef = responseBody.content[jsonContentType];
  }
  else {
    const typeRef = {
      isBuildInType: true,
      name: 'any',
      fullName: 'any',
    };
    resultTypeRef = { typeRef, nullable: true };
  }

  const resultType = resultTypeRef && resultTypeRef.typeRef;

  return makeTypename(resultType);
}

function getRequestBodyByFormData(type?: IDotnetType) {
  if (!type) return undefined;
  const item = getModelByIDotnetType(type, 'FormData')
  return item?.properties;
}

function getAction(actionName: string, item: IApiOperation, setting: ISettingsV3, model: { models: ModelType[]; modelDir: Record<string, ModelType> }): ApiAction {
  const requestBody = getRequestBody(item.requestBody as IApiBody)
  let requestBodyFormData: string | Properties[] | undefined;
  if (requestBody === 'FormData' && item.requestBody?.content) {
    const key = Object.keys(item.requestBody.content).find(key => key.includes('multipart/form-data'))
    if (key)
      requestBodyFormData = getRequestBodyByFormData((item.requestBody.content as any)[key]?.typeRef)
  }

  const res = {
    url: item.path,
    method: item.method?.toLocaleUpperCase() as any,
    name: actionName,
    limit: item.auth as any,
    description: item.summary,
    responseType: getResponseType(item.responseBody),
    parameters: getParameters(item?.parameters as IApiParameter[], ['path', 'query']),
    header: getParameters(item?.parameters as IApiParameter[], ['header']),
    requestBody,
    requestBodyFormData,
    returnType: getResultType(item.responseBody),
  } as ApiAction

  if (setting.template.api && setting.template.api.onBeforeActionWriteFile)
    return setting.template.api.onBeforeActionWriteFile(res, model.models, model.modelDir)
  return res
}

export function fetchApisAsync(doc: OpenAPI3, definedTypes: DotNetTypes, setting: ISettingsV3, model: { models: ModelType[]; modelDir: Record<string, ModelType> }) {
  return fetchApisByController(doc, definedTypes, setting, model);
}

function fetchApisByController(doc: OpenAPI3, definedTypes: DotNetTypes, setting: ISettingsV3, model: { models: ModelType[]; modelDir: Record<string, ModelType> }): ApiType {
  const res: ApiType = { controllers: [], namespaces: [], actions: [] };
  const tagObj: Record<string, string> = doc.tags?.reduce((a, b) => ((a[b.name] = b.description), a), {} as any) ?? {};

  // 按 URL 的 controller 段分组(不合并等价路由,每个路由的接口都保留),
  // 方法名取 operationId 后半段;无 operationId 时用 URL 末段兜底
  const controllerMap = new Map<string, { controller: ApiController; used: Set<string> }>();
  for (const apiPath in doc.paths) {
    const apiDef = doc.paths[apiPath] as { [key: string]: OpenAPI3Operation };
    for (const [method, operation] of Object.entries(apiDef)) {
      if (!operation.responses) continue;

      const controllerName = getControllerName(apiPath);
      const opId = operation.operationId;
      // 类描述取 operationId 前缀对应的 tag 描述
      const tagName = opId?.includes('-') ? opId.slice(0, opId.indexOf('-')) : undefined;
      let entry = controllerMap.get(controllerName);
      if (!entry) {
        entry = {
          controller: { name: controllerName, description: tagName ? tagObj?.[tagName] : undefined, actions: [] },
          used: new Set(),
        };
        controllerMap.set(controllerName, entry);
      }

      let actionName: string;
      if (opId) {
        const dashIdx = opId.indexOf('-');
        actionName = camelCase(dashIdx >= 0 ? opId.slice(dashIdx + 1) : opId, { pascalCase: true });
      }
      else {
        const segs = apiPath.split('/').filter(Boolean);
        actionName = camelCase(`${segs[segs.length - 1] ?? 'index'}_${method}`, { pascalCase: true });
      }
      if (!/async$/i.test(actionName)) actionName += 'Async';

      // 类内方法名去重:冲突时追加 URL 最后一个非参数段区分(如 /api/workbench/tasks -> GetTodosTasksAsync)
      if (entry.used.has(actionName)) {
        const segs = apiPath.split('/').filter(Boolean).filter(s => !/^\{[\w\d_]+\}$/.test(s));
        const base = actionName.replace(/Async$/, '');
        const suffix = segs.length ? camelCase(segs[segs.length - 1], { pascalCase: true }) : camelCase(method, { pascalCase: true });
        actionName = camelCase(base + suffix, { pascalCase: true }) + 'Async';
        let i = 2;
        while (entry.used.has(actionName)) actionName = `${base}${suffix}${i++}Async`;
      }
      entry.used.add(actionName);

      const item = transformOperation(method, apiPath, operation, definedTypes);
      entry.controller.actions.push(getAction(actionName, item, setting, model));
    }
  }
  res.controllers = [...controllerMap.values()].map(e => e.controller);
  return res;
}

// 取 URL 中 controller 段(跳过固定前缀 api)作为类名,如 /api/topics/{id} -> Topics
function getControllerName(apiPath: string): string {
  const parts = apiPath.split('/').filter(Boolean);
  let idx = 0;
  if (parts[0]?.toLowerCase() === 'api') idx = 1;
  const seg = parts[idx] || parts[0] || 'default';
  return camelCase(seg, { pascalCase: true });
}

function handlebarsTransform(text: string, data: ApiType): string {
  const template = handlebars.compile(text, { noEscape: true });
  const code = template({ data });
  return code;
}

export async function generateApisAsync(
  apis: ApiType,
  models: ModelReturnResults,
  setting: ISettingsV3,
): Promise<ApiReturnResults> {
  apis.dependencys = models.models.map((e) => {
    return {
      id: e.key,
      modules: e.key,
      fileId: models.paths[e.key],
    };
  });

  if (!apis.dependencys?.length) apis.dependencys = undefined

  const paths: Record<string, string> = {}

  if (setting.template.api === false) return { apis, paths: {} }

  const apiOption = setting.template.api as ApiOption

  if (!apiOption.transform)
    apiOption.transform = defaultApisTransform

  if (typeof apiOption.transform === 'string') {
    const apiConfig = apiOption as {
      transform: string
      output: string | ((fileId: string) => string)
      prettier: boolean
      extension: string
    };
    const code = handlebarsTransform(apiConfig.transform, apis);
    const fileId = getFileId(setting.basePath, apiConfig.output, 'index', 'apis', apiConfig.extension);
    await writeFileWithDirectoryCreation(fileId, apiConfig.prettier !== false ? prettierCode(code) : code);
    paths.index = fileId
  }
  else {
    const fileId = getFileId(setting.basePath, undefined, 'index', 'apis', apiOption.extension);
    const genRes = apiOption.transform(apis, fileId);
    if (!genRes)
      throw new Error('返回正确的结果 Array<TransformReturn>  | TransformReturn')

    const cyclicBody = Array.isArray(genRes) ? genRes : [genRes];

    for (const item of cyclicBody) {
      let fileId = '';
      if (!item.output || typeof item.output === 'string')
        fileId = getFileId(setting.basePath, item.output, 'index', 'apis', apiOption.extension);
      else
        fileId = item.output(getFileId(setting.basePath, undefined, 'index', 'apis', apiOption.extension))
      await writeFileWithDirectoryCreation(fileId, apiOption.prettier !== false ? prettierCode(item.code) : item.code);
      paths[parse(fileId).name] = fileId
    }
  }

  return { apis, paths }
}
