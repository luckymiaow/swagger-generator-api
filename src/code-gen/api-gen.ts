import { parse } from 'node:path';
import camelCase from 'camelcase';
import handlebars from 'handlebars';
import type { OpenAPI3, OpenAPI3Operation, OpenAPI3Parameter, Parameter } from '../schema';
import type { ApiAction, ApiController, ApiOption, ApiProperties, ApiReturnResults, ApiType, ISettingsV3, ModelReturnResults, ModelType, Properties } from '../../types';
import { defaultApisTransform, joinProperties } from '../presets';
import { HttpStatusCodes } from './types';
import type { DotNetTypes, IAipContent, IApiBody, IApiOperation, IApiParameter, IDotnetType, IDotnetTypeRef } from './types';
import { applyTypeTransform, getFileId, makeTypename, prettierCode, writeFileWithDirectoryCreation } from './utils';
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

  // 默认类型修正(object<> -> Record<>) + 按 dayjs 配置做 Date -> Dayjs
  if (typeof res.returnType === 'string')
    res.returnType = applyTypeTransform(res.returnType, setting.dayjs);
  for (const p of [...(Array.isArray(res.parameters) ? res.parameters : []), ...(Array.isArray(res.requestBody) ? res.requestBody : [])])
    if (p.type) p.type = p.type.map(t => applyTypeTransform(t, setting.dayjs));

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

  // 按 URL 根路径分 namespace(namespace 内再按 controller 段分组),不合并等价路由,
  // 方法名取 operationId 后半段;无 operationId 时用 URL 末段兜底
  const nsMap = new Map<string, Map<string, { controller: ApiController; used: Set<string> }>>();
  for (const apiPath in doc.paths) {
    const apiDef = doc.paths[apiPath] as { [key: string]: OpenAPI3Operation };
    for (const [method, operation] of Object.entries(apiDef)) {
      if (!operation.responses) continue;

      const nsName = getNamespaceName(apiPath);
      const controllerName = getControllerName(apiPath);
      const opId = operation.operationId;
      // 类描述取 operationId 前缀对应的 tag 描述
      const tagName = opId?.includes('-') ? opId.slice(0, opId.indexOf('-')) : undefined;

      let controllerMap = nsMap.get(nsName);
      if (!controllerMap) {
        controllerMap = new Map();
        nsMap.set(nsName, controllerMap);
      }
      let entry = controllerMap.get(controllerName);
      if (!entry) {
        entry = {
          controller: { name: controllerName, description: tagName ? tagObj?.[tagName] : undefined, actions: [] },
          used: new Set(),
        };
        controllerMap.set(controllerName, entry);
      }

      // 方法名规则:URL 段与 operationId 后半段一致时保留 URL 段+方法命名(如 Me -> Me_GetAsync),
      // 不一致时用 operationId 命名(如 Topics vs GetTopics -> GetTopicsAsync)
      let actionName = getUrlActionName(apiPath, method);
      if (opId) {
        const dashIdx = opId.indexOf('-');
        const opAction = camelCase(dashIdx >= 0 ? opId.slice(dashIdx + 1) : opId, { pascalCase: true });
        const urlAction = getUrlActionSegment(apiPath);
        if (!urlAction || opAction !== urlAction)
          actionName = opAction + (/async$/i.test(opAction) ? '' : 'Async');
      }

      // 类内方法名去重:冲突时追加 URL 最后一个非参数段区分
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
  res.namespaces = [...nsMap.entries()].map(([nsName, controllerMap]) => ({
    name: nsName,
    controllers: [...controllerMap.values()].map(e => e.controller),
  }));

  // 类名/命名空间名与模型重名:模型 import 使用 as 别名导入,并同步替换 action 中的引用(类名保持不变)
  const clsNames = new Set<string>();
  for (const ns of res.namespaces || []) {
    clsNames.add(ns.name);
    for (const c of ns.controllers) clsNames.add(c.name);
  }
  for (const c of res.controllers || []) clsNames.add(c.name);
  for (const a of res.actions || []) clsNames.add(a.name);

  const aliases: Record<string, string> = {};
  for (const modelName of Object.keys(model.modelDir)) {
    if (clsNames.has(modelName)) {
      let alias = `${modelName}Model`;
      while (model.modelDir[alias]) alias += 'Model';
      aliases[modelName] = alias;
    }
  }
  if (Object.keys(aliases).length) {
    for (const ns of res.namespaces || [])
      for (const controller of ns.controllers)
        for (const action of controller.actions)
          applyModelAliases(action, aliases);
    for (const controller of res.controllers || [])
      for (const action of controller.actions)
        applyModelAliases(action, aliases);
    for (const action of res.actions || [])
      applyModelAliases(action, aliases);
    res.modelAliases = aliases;
  }
  return res;
}

// 取 URL 根路径段作为命名空间名,如 /api/topics/{id} -> Api,/connect/token -> Connect
function getNamespaceName(apiPath: string): string {
  const parts = apiPath.split('/').filter(Boolean);
  const seg = parts[0] || 'default';
  return camelCase(seg, { pascalCase: true });
}

// 取 URL 中 controller 段(跳过固定前缀 api)作为类名,如 /api/topics/{id} -> Topics
function getControllerName(apiPath: string): string {
  const parts = apiPath.split('/').filter(Boolean);
  let idx = 0;
  if (parts[0]?.toLowerCase() === 'api') idx = 1;
  const seg = parts[idx] || parts[0] || 'default';
  return camelCase(seg, { pascalCase: true });
}

// 取 URL 最后一个非参数段作为 action 段(如 /api/topics/{id} -> Topics,/api/CurrentUser/Me -> Me)
function getUrlActionSegment(apiPath: string): string | undefined {
  const parts = apiPath.split('/').filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!/^\{[\w\d_]+\}$/i.test(parts[i]))
      return camelCase(parts[i], { pascalCase: true });
  }
  return undefined;
}

// 按 URL 段 + HTTP 方法生成方法名(旧命名规则,如 /api/CurrentUser/Me GET -> Me_GetAsync),
// 末尾参数段转 ByXxx 后缀(如 /api/topics/{id} GET -> TopicsById_GetAsync)
function getUrlActionName(apiPath: string, method: string): string {
  const parts = apiPath.split('/').filter(Boolean).map((s) => {
    const m = s.match(/^\{([\w\d_]+)\}$/i);
    if (m)
      return { isParam: true, name: `By${camelCase(m[1], { pascalCase: true })}` };
    return { isParam: false, name: camelCase(s, { pascalCase: true }) };
  });
  let actionIdx = parts.length - 1;
  while (actionIdx >= 0 && parts[actionIdx].isParam) actionIdx--;
  const action = parts[actionIdx]?.name;
  const tailParams = parts.slice(actionIdx + 1).filter(p => p.isParam).map(p => p.name);

  const actionLower = action?.toLowerCase() || method.toLowerCase();
  const methodLower = method.toLowerCase();
  let fnName = camelCase(action || actionLower, { pascalCase: true });
  if (tailParams.length) fnName += tailParams.join('');
  if (!(actionLower.startsWith(methodLower) || actionLower.endsWith(methodLower)))
    fnName += `_${camelCase(method, { pascalCase: true })}`;
  if (!actionLower.endsWith('async')) fnName += 'Async';
  return fnName;
}

// 替换 action 中与类名冲突的模型引用为别名(如 User -> UserModel),用 \b 边界避免误伤 UserStatus/AdminUser 等
function applyModelAliases(action: ApiAction, aliases: Record<string, string>) {
  const replace = (s: string) => Object.entries(aliases)
    .reduce((acc, [k, v]) => acc.replace(new RegExp(`\\b${k}\\b`, 'g'), v), s);

  if (typeof action.returnType === 'string') action.returnType = replace(action.returnType);
  if (typeof action.requestBody === 'string') action.requestBody = replace(action.requestBody);
  if (typeof action.parameters === 'string') action.parameters = replace(action.parameters);

  const props = [
    ...(Array.isArray(action.parameters) ? action.parameters : []),
    ...(Array.isArray(action.requestBody) ? action.requestBody : []),
  ];
  for (const p of props)
    if (p.type) p.type = p.type.map(t => replace(t));
}

function handlebarsTransform(text: string, data: ApiType): string {
  const template = handlebars.compile(text, { noEscape: true });
  const code = template({ data });
  return code;
}

// 生成 API_PATH 全局类型声明:把全部接口汇总成 { 'url': { method, params, data, response } }
function buildApiPathTypes(apis: ApiType): string {
  const apiInfos: Array<{ url: string; method: string; params: string; data: string; response: string; info: string }> = [];
  const collect = (action: ApiAction) => {
    const paramsType = action.parameters ? (Array.isArray(action.parameters) ? joinProperties(action.parameters, 'interface', false) : action.parameters) : 'void';
    const dataType = action.requestBody ? (Array.isArray(action.requestBody) ? joinProperties(action.requestBody, 'interface', false) : action.requestBody) : 'void';
    const responseType = typeof action.returnType === 'string' ? action.returnType : 'any';
    apiInfos.push({
      url: action.url,
      method: action.method?.toUpperCase(),
      params: paramsType,
      data: dataType,
      response: responseType,
      info: action.description || '',
    });
  };
  for (const ns of apis.namespaces || [])
    for (const c of ns.controllers)
      c.actions?.forEach(collect);
  for (const c of apis.controllers || [])
    c.actions?.forEach(collect);
  for (const a of apis.actions || [])
    collect(a);

  return `export {}\n\ndeclare global {\n  interface API_PATH {\n${apiInfos.map(v => `    /**${v.info}*/\n    '${v.url}': {\n      method: '${v.method}';\n      params: ${v.params};\n      data: ${v.data};\n      response: ${v.response};\n    }`).join('\n')}\n  }\n}\n`;
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

  // 生成 API_PATH 全局类型声明(api-paths.d.ts)
  const apiPathTypes = (apiOption as any).apiPathTypes;
  if (apiPathTypes) {
    const code = buildApiPathTypes(apis);
    const output = typeof apiPathTypes === 'object' ? apiPathTypes.output : undefined;
    const fileId = getFileId(setting.basePath, output, 'api-paths', 'apis', '.d.ts');
    await writeFileWithDirectoryCreation(fileId, prettierCode(code));
    paths['api-paths'] = fileId;
  }

  return { apis, paths }
}
