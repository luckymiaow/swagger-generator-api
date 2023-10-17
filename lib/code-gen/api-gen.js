import { parse } from 'node:path';
import { String } from 'typescript-string-operations';
import camelCase from 'camelcase';
import handlebars from 'handlebars';
import { defaultApisTransform } from '../presets';
import { HttpStatusCodes } from './types';
import { getFileId, makeTypename, prettierCode, writeFileWithDirectoryCreation } from './utils';
import { buildType, buildTypeRef } from './type-builder';
function transformParameters(parameters, definedTypes) {
    return parameters.map((item) => {
        if ('schema' in item) {
            const param = item;
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
function transformOperation(method, path, operation, definedTypes) {
    const { summary, description } = operation;
    let requestBody, responseBody, parameters;
    if (operation.parameters)
        parameters = transformParameters(operation.parameters, definedTypes);
    if (operation.requestBody && operation.requestBody.content) {
        const content = {};
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
        let content;
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
function getResponseType(responseBody) {
    if (responseBody && responseBody.content) {
        const contentTypes = Object.keys(responseBody.content);
        if (contentTypes.find(c => /\/octet-stream$/.test(c)))
            return 'blob';
        if (contentTypes.find(c => /\/json$/.test(c)))
            return 'json';
    }
    return 'text';
}
function getParameters(data) {
    return data?.map((e) => {
        return {
            name: e.name,
            description: e.description,
            required: e.required === true,
            type: [makeTypename(e.type)],
            isPath: e.in === 'query',
        };
    });
}
function getRequestBody(requestBody) {
    if (!requestBody?.content)
        return 'any';
    const contentTypes = Object.keys(requestBody.content);
    const jsonContentType = contentTypes.find(c => /\/json$/.test(c));
    let contentType;
    let contentTypeDef;
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
    if (!contentTypeDef)
        throw `request content type not supported: ${contentTypes}`;
    return makeTypename(contentTypeDef.typeRef);
}
function getResultType(responseBody) {
    if (!responseBody || !responseBody.content)
        return 'Blob';
    let resultTypeRef;
    const contentTypes = Object.keys(responseBody.content);
    const blobContentType = contentTypes.find(c => /\/octet-stream$/.test(c));
    const jsonContentType = contentTypes.find(c => /\/json$/.test(c));
    if (blobContentType)
        return 'Blob';
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
function fetchControllers(nodes, tagObj) {
    const entroes = Object.entries(nodes);
    const controllers = [];
    for (const [key, value] of entroes) {
        const actions = Object.entries(value);
        controllers.push({
            name: key,
            description: tagObj?.[key],
            actions: actions?.map(([actionName, item]) => {
                return {
                    url: item.path,
                    method: item.method,
                    name: actionName,
                    limit: item.auth,
                    description: item.summary,
                    responseType: getResponseType(item.responseBody),
                    parameters: getParameters(item?.parameters),
                    requestBody: getRequestBody(item.requestBody),
                    returnType: getResultType(item.responseBody),
                };
            }),
        });
    }
    return controllers;
}
function fetchApis(doc, definedTypes) {
    const apiRoot = {};
    for (const apiPath in doc.paths) {
        const urlParts = apiPath
            .split(/[/\\]/)
            .filter(s => !String.IsNullOrWhiteSpace(s) && /\{[\w\d_]+\}/gi.test(s) === false) // 忽略类似{id}形式的路由参数
            .map(s => camelCase(s
            .replace(/\{([\w\d_]+)\}/i, (var1, var2) => `By${camelCase(var2, { pascalCase: true })}`)
            .replace(/\{([\w\d_]+)\}/gi, (var1, var2) => `${camelCase(var2, { pascalCase: true })}`), { pascalCase: true }));
        let node = apiRoot;
        const action = urlParts[urlParts.length - 1];
        urlParts.splice(urlParts.length - 1);
        for (const part of urlParts) {
            if (!(part in node))
                node[part] = {};
            node = node[part];
        }
        const apiDef = doc.paths[apiPath];
        const operations = Object.entries(apiDef)
            .filter(p => p[1].responses)
            .map((p) => {
            const method = p[0];
            const operationDef = p[1];
            return transformOperation(method, apiPath, operationDef, definedTypes);
        });
        const methods = node;
        for (const operation of operations) {
            const actionLower = action.toLowerCase();
            const methodLower = operation.method.toLowerCase();
            let fnName = camelCase(action, { pascalCase: true });
            if (!(actionLower.startsWith(methodLower) || actionLower.endsWith(methodLower)))
                fnName += `_${camelCase(operation.method, { pascalCase: true })}`;
            if (!actionLower.endsWith('async'))
                fnName += 'Async';
            methods[fnName] = operation;
        }
    }
    const res = { controllers: [], namespaces: [] };
    const tagObj = doc.tags.reduce((a, b) => ((a[b.name] = b.description), a), {});
    const groupApi = Object.entries(apiRoot);
    if (groupApi.length === 1) {
        res.controllers = fetchControllers(groupApi[0][1], tagObj);
        return res;
    }
    for (const [key, apis] of groupApi) {
        const isClass = Object.entries(apis);
        if (isClass?.[0][1]?.path && isClass[0][1]?.method) {
            res.controllers?.push(...fetchControllers({ [key]: apis }, tagObj));
        }
        else {
            res.namespaces?.push({
                name: key,
                controllers: fetchControllers(apis, tagObj),
                description: tagObj?.[key],
            });
        }
    }
    return res;
}
function handlebarsTransform(text, data) {
    const template = handlebars.compile(text, { noEscape: true });
    const code = template({ data });
    return code;
}
export async function generateApisAsync(setting, doc, definedTypes, models) {
    const res = fetchApis(doc, definedTypes);
    res.dependencys = models.models.map((e) => {
        return {
            id: e.key,
            modules: e.key,
            fileId: models.paths[e.key],
        };
    });
    const paths = {};
    if (!setting.template.api.transform)
        setting.template.api.transform = defaultApisTransform;
    if (typeof setting.template.api.transform === 'string') {
        const apiConfig = setting.template.api;
        const code = handlebarsTransform(apiConfig.transform, res);
        const fileId = getFileId(setting.basePath, apiConfig.output, 'index', 'apis');
        await writeFileWithDirectoryCreation(fileId, apiConfig.prettier !== false ? prettierCode(code) : code);
        paths.index = fileId;
    }
    else {
        const fileId = getFileId(setting.basePath, undefined, 'index', 'apis');
        const genRes = setting.template.api.transform(res, fileId);
        if (!genRes)
            throw new Error('返回正确的结果 Array<TransformReturn>  | TransformReturn');
        const cyclicBody = Array.isArray(genRes) ? genRes : [genRes];
        for (const item of cyclicBody) {
            let fileId = '';
            if (!item.output || typeof item.output === 'string')
                fileId = getFileId(setting.basePath, item.output, 'index', 'apis');
            else
                fileId = item.output(getFileId(setting.basePath, undefined, 'index', 'apis'));
            await writeFileWithDirectoryCreation(fileId, setting.template.api.prettier !== false ? prettierCode(item.code) : item.code);
            paths[parse(fileId).name] = fileId;
        }
    }
    return { apis: res, paths };
}
