"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApisAsync = void 0;
const node_path_1 = require("node:path");
const typescript_string_operations_1 = require("typescript-string-operations");
const camelcase_1 = __importDefault(require("camelcase"));
const handlebars_1 = __importDefault(require("handlebars"));
const presets_1 = require("../presets");
const types_1 = require("./types");
const utils_1 = require("./utils");
const type_builder_1 = require("./type-builder");
function transformParameters(parameters, definedTypes) {
    return parameters.map((item) => {
        if ('schema' in item) {
            const param = item;
            const type = (0, type_builder_1.buildType)(param.schema, definedTypes);
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
            content[contentType] = (0, type_builder_1.buildTypeRef)(contentDef.schema, definedTypes);
        requestBody = {
            description: operation.requestBody.description,
            content,
        };
    }
    const resonseDef = operation.responses[types_1.HttpStatusCodes.OK];
    if (resonseDef) {
        let contentTypes, responseType;
        let content;
        if (resonseDef.content) {
            content = {};
            for (const [contentType, contentDef] of Object.entries(resonseDef.content))
                content[contentType] = (0, type_builder_1.buildTypeRef)(contentDef.schema, definedTypes);
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
    return 'json';
}
function getParameters(data) {
    return data?.map((e) => {
        return {
            name: e.name,
            description: e.description,
            required: e.required === true,
            type: [(0, utils_1.makeTypename)(e.type)],
            isPath: e.in === 'query',
        };
    });
}
function getRequestBody(requestBody) {
    if (!requestBody?.content)
        return undefined;
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
        return 'unknown';
    return (0, utils_1.makeTypename)(contentTypeDef.typeRef);
}
function getResultType(responseBody) {
    if (!responseBody || !responseBody.content)
        return 'Blob';
    let resultTypeRef;
    const contentTypes = Object.keys(responseBody.content);
    const blobContentType = contentTypes.find(c => /\/octet-stream$/.test(c));
    if (blobContentType)
        return 'Blob';
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
    return (0, utils_1.makeTypename)(resultType);
}
function getAction(actionName, item, setting) {
    const res = {
        url: item.path,
        method: item.method?.toLocaleUpperCase(),
        name: actionName,
        limit: item.auth,
        description: item.summary,
        responseType: getResponseType(item.responseBody),
        parameters: getParameters(item?.parameters),
        requestBody: getRequestBody(item.requestBody),
        returnType: getResultType(item.responseBody),
    };
    if (setting.template.api && setting.template.api.onBeforeActionWriteFile)
        return setting.template.api.onBeforeActionWriteFile(res);
    return res;
}
function fetchControllers(nodes, tagObj, setting) {
    const entroes = Object.entries(nodes);
    const controllers = [];
    for (const [key, value] of entroes) {
        const actions = Object.entries(value);
        controllers.push({
            name: key,
            description: tagObj?.[key],
            actions: actions?.map(([actionName, item]) => getAction(actionName, item, setting)),
        });
    }
    return controllers;
}
function fetchApis(doc, definedTypes, setting) {
    const apiRoot = {};
    for (const apiPath in doc.paths) {
        const urlParts = apiPath
            .split(/[/\\]/)
            .filter(s => !typescript_string_operations_1.String.IsNullOrWhiteSpace(s) && /\{[\w\d_]+\}/gi.test(s) === false) // 忽略类似{id}形式的路由参数
            .map(s => (0, camelcase_1.default)(s
            .replace(/\{([\w\d_]+)\}/i, (var1, var2) => `By${(0, camelcase_1.default)(var2, { pascalCase: true })}`)
            .replace(/\{([\w\d_]+)\}/gi, (var1, var2) => `${(0, camelcase_1.default)(var2, { pascalCase: true })}`), { pascalCase: true }));
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
            let fnName = (0, camelcase_1.default)(action, { pascalCase: true });
            if (!(actionLower.startsWith(methodLower) || actionLower.endsWith(methodLower)))
                fnName += `_${(0, camelcase_1.default)(operation.method, { pascalCase: true })}`;
            if (!actionLower.endsWith('async'))
                fnName += 'Async';
            methods[fnName] = operation;
        }
    }
    const res = { controllers: [], namespaces: [], actions: [] };
    const tagObj = doc.tags.reduce((a, b) => ((a[b.name] = b.description), a), {});
    const groupApi = Object.entries(apiRoot);
    if (groupApi.length === 1) {
        res.controllers = fetchControllers(groupApi[0][1], tagObj, setting);
        return res;
    }
    for (const [key, apis] of groupApi) {
        const isClass = Object.entries(apis);
        if (typeof isClass[0][1] === 'string') {
            res.actions?.push(getAction(key, apis, setting));
        }
        else if (apis && ('path' in isClass[0][1] && 'method' in isClass[0][1])) {
            res.controllers?.push(...fetchControllers({ [key]: apis }, tagObj, setting));
        }
        else {
            res.namespaces?.push({
                name: key,
                controllers: fetchControllers(apis, tagObj, setting),
                description: tagObj?.[key],
            });
        }
    }
    return res;
}
function handlebarsTransform(text, data) {
    const template = handlebars_1.default.compile(text, { noEscape: true });
    const code = template({ data });
    return code;
}
async function generateApisAsync(setting, doc, definedTypes, models) {
    const res = fetchApis(doc, definedTypes, setting);
    res.dependencys = models.models.map((e) => {
        return {
            id: e.key,
            modules: e.key,
            fileId: models.paths[e.key],
        };
    });
    const paths = {};
    if (setting.template.api === false)
        return { apis: res, paths: {} };
    const apiOption = setting.template.api;
    if (!apiOption.transform)
        apiOption.transform = presets_1.defaultApisTransform;
    if (typeof apiOption.transform === 'string') {
        const apiConfig = apiOption;
        const code = handlebarsTransform(apiConfig.transform, res);
        const fileId = (0, utils_1.getFileId)(setting.basePath, apiConfig.output, 'index', 'apis', apiConfig.extension);
        await (0, utils_1.writeFileWithDirectoryCreation)(fileId, apiConfig.prettier !== false ? (0, utils_1.prettierCode)(code) : code);
        paths.index = fileId;
    }
    else {
        const fileId = (0, utils_1.getFileId)(setting.basePath, undefined, 'index', 'apis', apiOption.extension);
        const genRes = apiOption.transform(res, fileId);
        if (!genRes)
            throw new Error('返回正确的结果 Array<TransformReturn>  | TransformReturn');
        const cyclicBody = Array.isArray(genRes) ? genRes : [genRes];
        for (const item of cyclicBody) {
            let fileId = '';
            if (!item.output || typeof item.output === 'string')
                fileId = (0, utils_1.getFileId)(setting.basePath, item.output, 'index', 'apis', apiOption.extension);
            else
                fileId = item.output((0, utils_1.getFileId)(setting.basePath, undefined, 'index', 'apis', apiOption.extension));
            await (0, utils_1.writeFileWithDirectoryCreation)(fileId, apiOption.prettier !== false ? (0, utils_1.prettierCode)(item.code) : item.code);
            paths[(0, node_path_1.parse)(fileId).name] = fileId;
        }
    }
    return { apis: res, paths };
}
exports.generateApisAsync = generateApisAsync;
