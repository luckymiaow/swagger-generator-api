import { parse } from 'node:path';
import { String } from 'typescript-string-operations';
import camelCase from 'camelcase';
import handlebars from 'handlebars';
import type { OpenAPI3, OpenAPI3Operation, OpenAPI3Parameter, Parameter } from '../schema';
import type { ApiAction, ApiController, ApiOption, ApiProperties, ApiReturnResults, ApiType, ISettingsV3, ModelReturnResults, Properties } from '../../types';
import { defaultApisTransform } from '../presets';
import { HttpStatusCodes } from './types';
import type { DotNetTypes, IAipContent, IApiBody, IApiOperation, IApiParameter, IDotnetType, IDotnetTypeRef } from './types';
import { getFileId, makeTypename, prettierCode, writeFileWithDirectoryCreation } from './utils';
import { buildType, buildTypeRef } from './type-builder';
import { getModelByIDotnetType } from './model-gen';

interface ApiNode {
  [key: string]: ApiNode | IApiOperation
}

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

function getAction(actionName: string, item: IApiOperation, setting: ISettingsV3): ApiAction {
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
    return setting.template.api.onBeforeActionWriteFile(res)
  return res
}

function fetchControllers(nodes: Record<string, ApiNode>, tagObj: Record<string, string>, setting: ISettingsV3): ApiController[] {
  const entroes = Object.entries(nodes);
  const controllers: ApiController[] = [];

  for (const [key, value] of entroes) {
    const actions = Object.entries(value);

    controllers.push({
      name: key,
      description: tagObj?.[key],
      actions: actions?.map(([actionName, item]) => getAction(actionName, item as IApiOperation, setting)),
    });
  }
  return controllers;
}

export function fetchApisAsync(doc: OpenAPI3, definedTypes: DotNetTypes, setting: ISettingsV3) {
  const apiRoot: ApiNode = {};

  for (const apiPath in doc.paths) {
    const urlParts = apiPath
      .split(/[/\\]/)
      .filter(s => !String.IsNullOrWhiteSpace(s) && /\{[\w\d_]+\}/gi.test(s) === false) // 忽略类似{id}形式的路由参数
      .map(s =>
        camelCase(
          s
            .replace(/\{([\w\d_]+)\}/i, (var1, var2) => `By${camelCase(var2, { pascalCase: true })}`)
            .replace(/\{([\w\d_]+)\}/gi, (var1, var2) => `${camelCase(var2, { pascalCase: true })}`),
          { pascalCase: true },
        ),
      );

    let node = apiRoot;
    const action = urlParts[urlParts.length - 1];
    urlParts.splice(urlParts.length - 1);
    for (const part of urlParts) {
      if (!(part in node)) node[part] = {};
      node = node[part] as ApiNode;
    }
    const apiDef = doc.paths[apiPath];
    const operations = Object.entries(apiDef as { [key: string]: OpenAPI3Operation })
      .filter(p => p[1].responses)
      .map((p) => {
        const method = p[0];
        const operationDef = p[1];
        return transformOperation(method, apiPath, operationDef, definedTypes);
      });
    const methods: any = node;
    for (const operation of operations) {
      const actionLower = action?.toLowerCase() || operation.method;
      const methodLower = operation.method.toLowerCase();
      let fnName = camelCase(action || actionLower, { pascalCase: true });
      if (!(actionLower.startsWith(methodLower) || actionLower.endsWith(methodLower)))
        fnName += `_${camelCase(operation.method, { pascalCase: true })}`;
      if (!actionLower.endsWith('async')) fnName += 'Async';
      methods[fnName] = operation;
    }
  }
  const res: ApiType = { controllers: [], namespaces: [], actions: [] };
  const tagObj = doc.tags.reduce((a, b) => ((a[b.name] = b.description), a), {} as any);
  const groupApi = Object.entries(apiRoot);
  if (groupApi.length === 1) {
    res.controllers = fetchControllers(groupApi[0][1] as any, tagObj, setting);
    return res;
  }
  for (const [key, apis] of groupApi) {
    const isClass = Object.entries(apis)
    if (typeof isClass[0][1] === 'string') {
      res.actions?.push(getAction(key, apis as IApiOperation, setting));
    }
    else if (apis && ('path' in isClass[0][1] && 'method' in isClass[0][1])) {
      res.controllers?.push(...fetchControllers({ [key]: apis } as any, tagObj, setting));
    }
    else {
      res.namespaces?.push({
        name: key,
        controllers: fetchControllers(apis as any, tagObj, setting),
        description: tagObj?.[key],
      });
    }
  }
  return res;
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

  if (apis.dependencys?.length) apis.dependencys = undefined

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
