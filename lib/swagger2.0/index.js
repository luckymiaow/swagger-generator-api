"use strict";
/*
 * @Description:
 * @Author: luckymiaow
 * @Date: 2023-09-11 15:55:35
 * @LastEditors: luckymiaow
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseV2 = void 0;
const camelcase_1 = __importDefault(require("camelcase"));
async function parseV2(swDoc) {
    const apis = genDoc(swDoc);
    const models = genModel(swDoc.definitions);
    return { apis, models };
}
exports.parseV2 = parseV2;
function genDoc(swaggerDoc) {
    const res = {
        namespaces: [],
        controllers: [],
        actions: [],
    };
    const apiController = {};
    const namespaces = {};
    for (const path in swaggerDoc.paths) {
        const obj = swaggerDoc.paths[path];
        const names = path.split('/').filter((v) => v && !v.startsWith('{'));
        if (names.length === 1) {
            for (const key in obj) {
                const action = obj[key];
                res.actions?.push(getAction(names[0], path, key, action));
            }
        }
        else if (names.length == 2) {
            const controller = names[0];
            if (!(controller in apiController)) {
                apiController[controller] = {
                    name: convertToUpperCamelCase(controller),
                    description: obj?.[Object.keys(obj)?.[0]]?.tags?.[0],
                    actions: [],
                };
            }
            for (const key in obj) {
                const action = obj[key];
                apiController[controller].actions.push(getAction(names[names.length - 1], path, key, action));
            }
        }
        else {
            const namespace = convertToUpperCamelCase(names[0]);
            const controller = convertToUpperCamelCase(names[1]);
            if (!(namespace in namespaces)) {
                namespaces[namespace] = {
                    name: namespace,
                    controllers: {}
                };
            }
            if (!(controller in namespaces[namespace].controllers)) {
                namespaces[namespace].controllers[controller] = {
                    name: controller,
                    description: obj?.[Object.keys(obj)?.[0]]?.tags?.[0],
                    actions: [],
                };
            }
            for (const key in obj) {
                const action = obj[key];
                namespaces[namespace].controllers[controller].actions.push(getAction(names[names.length - 1], path, key, action));
            }
        }
    }
    res.controllers = Object.values(apiController);
    res.namespaces = Object.values(namespaces).map(v => ({ ...v, controllers: Object.values(v.controllers) }));
    return res;
}
function convertToUpperCamelCase(str) {
    // 去除字符串两端的空格
    str = str.trim();
    // 如果是横杠命名
    if (str.includes('-')) {
        // 将横杠去掉并将单词首字母大写
        return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
    }
    // 如果是小驼峰命名
    else if (str[0] === str[0].toLowerCase() && str.includes(str[0].toUpperCase())) {
        // 将首字母大写
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    // 如果是大驼峰命名或其他格式
    else {
        return upperFirst(str);
    }
}
function getAction(name, url, method, pathObj) {
    const actionLower = name.toLowerCase();
    const methodLower = method.toLowerCase();
    let fnName = (0, camelcase_1.default)(name, { pascalCase: true });
    if (!(actionLower.startsWith(methodLower) || actionLower.endsWith(methodLower)))
        fnName += `_${(0, camelcase_1.default)(method, { pascalCase: true })}`;
    if (!actionLower.endsWith('async'))
        fnName += 'Async';
    const res = {
        url,
        method: method.toLocaleUpperCase(),
        name: fnName,
        responseType: getResponseType(pathObj),
        returnType: getResultType(pathObj.responses),
        requestBody: getParameters(pathObj.parameters, ['body']),
        parameters: getParameters(pathObj.parameters, ['query', 'path']),
    };
    return res;
}
function genModel(definitions) {
    const models = [];
    for (const key in definitions) {
        const item = definitions[key];
        const mode = {
            definition: item.type === 'object' ? 'class' : 'type',
            name: key,
            key,
            dependencys: [],
            description: item.description,
            properties: [],
        };
        const leadInto = new Set();
        const requiredFields = item.required instanceof Array ? item.required : [];
        for (const attribute in item.properties) {
            const prop = item.properties[attribute];
            const required = requiredFields.includes(attribute);
            const type = getType(prop, leadInto);
            const types = [type];
            if (!required)
                types.push('null');
            mode.properties?.push({
                description: prop.description || attribute,
                name: attribute,
                type: types,
                required: required,
                value: required ? getValueByType(type) : null,
            });
        }
        mode.dependencys = Array.from(leadInto).map(e => ({
            id: e,
            modules: e,
        }));
        models.push(mode);
    }
    return models;
}
function getValueByType(type) {
    switch (type) {
        case 'string':
            return '""';
        case 'number':
            return 0;
        case 'boolean':
            return false;
        case 'undefined':
            return undefined;
        case 'null':
            return null;
        case 'symbol':
            return Symbol();
        default:
            return "{}";
    }
}
function getType(data, leadInto) {
    if (data?.schema)
        return getType(data?.schema, leadInto);
    if (data?.type === 'integer')
        return 'number';
    if (data?.type === 'array') {
        if (data?.items.$ref) {
            const typeName = extractMethodNames(data.items.$ref);
            leadInto?.add(typeName);
            return `Array<${typeName}>`;
        }
        else if (data?.items.type)
            return `Array<${getType(data.items, leadInto)}>`;
    }
    if (data?.$ref) {
        const typeName = extractMethodNames(data.$ref);
        leadInto?.add(typeName);
        return typeName;
    }
    if (data?.type === 'file')
        return 'FormData';
    return data?.type || 'any';
}
function extractMethodNames(input) {
    const names = input?.split('/').filter(e => !e.includes('{'));
    return `${names?.[names.length - 1]}`;
}
function upperFirst(input) {
    // 将字符串的第一个字符转换为大写，然后与其余部分拼接
    return input.charAt(0).toUpperCase() + input.slice(1);
}
function getParameters(parameters, type) {
    const body = parameters?.filter(e => type.includes(e.in)) || [];
    const res = body.map((e) => {
        return {
            name: e.name,
            description: e.description,
            type: [getType(e)],
            required: e.required,
            isPath: e.in === 'path',
        };
    });
    return res.length ? res : null;
}
function getResultType(responses) {
    let returnValueType = 'void';
    if (responses[200]?.schema) {
        returnValueType = getType(responses[200].schema);
        returnValueType = `${returnValueType}`;
    }
    return returnValueType;
}
function getResponseType(pathObj) {
    let returnValueType = 'json';
    // if (pathObj.responses[200]?.schema) {
    //   returnValueType = ''
    // }
    return returnValueType;
}
// function getResponseType(responseBody?: Paths) {
//   if (responseBody && responseBody.content) {
//     const contentTypes = Object.keys(responseBody.content);
//     if (contentTypes.find(c => /\/octet-stream$/.test(c))) return 'blob';
//     if (contentTypes.find(c => /\/json$/.test(c))) return 'json';
//   }
//   return 'json';
// }
function makeTypename(type) {
    if (type)
        return type.title;
    return 'void';
}
