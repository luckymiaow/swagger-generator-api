"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApisAsync = exports.fetchApisAsync = void 0;
const node_path_1 = require("node:path");
const camelcase_1 = __importDefault(require("camelcase"));
const handlebars_1 = __importDefault(require("handlebars"));
const presets_1 = require("../presets");
const types_1 = require("./types");
const utils_1 = require("./utils");
const type_builder_1 = require("./type-builder");
const model_gen_1 = require("./model-gen");
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
                schema: param.schema,
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
        operationId: operation.operationId,
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
function getParameters(data, type) {
    const res = data?.flatMap((e) => {
        if (!type.includes(e.in))
            return [];
        return {
            name: e.name,
            description: e.description,
            required: e.required === true,
            type: [(0, utils_1.makeTypename)(e.type)],
            isPath: e.in === 'query',
            meta: e.schema,
        };
    });
    if (res?.length)
        return res;
    return undefined;
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
function getRequestBodyByFormData(type) {
    if (!type)
        return undefined;
    const item = (0, model_gen_1.getModelByIDotnetType)(type, 'FormData');
    return item?.properties;
}
function getAction(actionName, item, setting, model) {
    const requestBody = getRequestBody(item.requestBody);
    let requestBodyFormData;
    if (requestBody === 'FormData' && item.requestBody?.content) {
        const key = Object.keys(item.requestBody.content).find(key => key.includes('multipart/form-data'));
        if (key)
            requestBodyFormData = getRequestBodyByFormData(item.requestBody.content[key]?.typeRef);
    }
    const res = {
        url: item.path,
        method: item.method?.toLocaleUpperCase(),
        name: actionName,
        limit: item.auth,
        description: item.summary,
        responseType: getResponseType(item.responseBody),
        parameters: getParameters(item?.parameters, ['path', 'query']),
        header: getParameters(item?.parameters, ['header']),
        requestBody,
        requestBodyFormData,
        returnType: getResultType(item.responseBody),
    };
    if (setting.template.api && setting.template.api.onBeforeActionWriteFile)
        return setting.template.api.onBeforeActionWriteFile(res, model.models, model.modelDir);
    return res;
}
function fetchApisAsync(doc, definedTypes, setting, model) {
    return fetchApisByController(doc, definedTypes, setting, model);
}
exports.fetchApisAsync = fetchApisAsync;
function fetchApisByController(doc, definedTypes, setting, model) {
    const res = { controllers: [], namespaces: [], actions: [] };
    const tagObj = doc.tags?.reduce((a, b) => ((a[b.name] = b.description), a), {}) ?? {};
    // 按 URL 的 controller 段分组(不合并等价路由,每个路由的接口都保留),
    // 方法名取 operationId 后半段;无 operationId 时用 URL 末段兜底
    const controllerMap = new Map();
    for (const apiPath in doc.paths) {
        const apiDef = doc.paths[apiPath];
        for (const [method, operation] of Object.entries(apiDef)) {
            if (!operation.responses)
                continue;
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
            let actionName;
            if (opId) {
                const dashIdx = opId.indexOf('-');
                actionName = (0, camelcase_1.default)(dashIdx >= 0 ? opId.slice(dashIdx + 1) : opId, { pascalCase: true });
            }
            else {
                const segs = apiPath.split('/').filter(Boolean);
                actionName = (0, camelcase_1.default)(`${segs[segs.length - 1] ?? 'index'}_${method}`, { pascalCase: true });
            }
            if (!/async$/i.test(actionName))
                actionName += 'Async';
            // 类内方法名去重:冲突时追加 URL 最后一个非参数段区分(如 /api/workbench/tasks -> GetTodosTasksAsync)
            if (entry.used.has(actionName)) {
                const segs = apiPath.split('/').filter(Boolean).filter(s => !/^\{[\w\d_]+\}$/.test(s));
                const base = actionName.replace(/Async$/, '');
                const suffix = segs.length ? (0, camelcase_1.default)(segs[segs.length - 1], { pascalCase: true }) : (0, camelcase_1.default)(method, { pascalCase: true });
                actionName = (0, camelcase_1.default)(base + suffix, { pascalCase: true }) + 'Async';
                let i = 2;
                while (entry.used.has(actionName))
                    actionName = `${base}${suffix}${i++}Async`;
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
function getControllerName(apiPath) {
    const parts = apiPath.split('/').filter(Boolean);
    let idx = 0;
    if (parts[0]?.toLowerCase() === 'api')
        idx = 1;
    const seg = parts[idx] || parts[0] || 'default';
    return (0, camelcase_1.default)(seg, { pascalCase: true });
}
function handlebarsTransform(text, data) {
    const template = handlebars_1.default.compile(text, { noEscape: true });
    const code = template({ data });
    return code;
}
async function generateApisAsync(apis, models, setting) {
    apis.dependencys = models.models.map((e) => {
        return {
            id: e.key,
            modules: e.key,
            fileId: models.paths[e.key],
        };
    });
    if (!apis.dependencys?.length)
        apis.dependencys = undefined;
    const paths = {};
    if (setting.template.api === false)
        return { apis, paths: {} };
    const apiOption = setting.template.api;
    if (!apiOption.transform)
        apiOption.transform = presets_1.defaultApisTransform;
    if (typeof apiOption.transform === 'string') {
        const apiConfig = apiOption;
        const code = handlebarsTransform(apiConfig.transform, apis);
        const fileId = (0, utils_1.getFileId)(setting.basePath, apiConfig.output, 'index', 'apis', apiConfig.extension);
        await (0, utils_1.writeFileWithDirectoryCreation)(fileId, apiConfig.prettier !== false ? (0, utils_1.prettierCode)(code) : code);
        paths.index = fileId;
    }
    else {
        const fileId = (0, utils_1.getFileId)(setting.basePath, undefined, 'index', 'apis', apiOption.extension);
        const genRes = apiOption.transform(apis, fileId);
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
    return { apis, paths };
}
exports.generateApisAsync = generateApisAsync;
