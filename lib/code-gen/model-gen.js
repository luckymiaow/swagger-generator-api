"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchModelsAsync = exports.generateModelsAsync = void 0;
const handlebars_1 = __importDefault(require("handlebars"));
const presets_1 = require("../presets");
const utils_1 = require("./utils");
async function generateModelsAsync(types, setting) {
    const models = fetchModelsAsync(types);
    const modelsPath = {};
    let dtsPath = '';
    if (setting.template.models === false)
        return { models: [], paths: {} };
    const modelsOption = setting.template.models;
    if (!modelsOption.transform)
        modelsOption.transform = presets_1.defaultModelTransform;
    if (typeof modelsOption.transform === 'string') {
        models.forEach((model) => {
            const code = handlebarsTransform(modelsOption.transform, model);
            const fileId = (0, utils_1.getModelsFileId)(setting, model.key);
            (0, utils_1.writeFileWithDirectoryCreation)(fileId, modelsOption.prettier !== false ? (0, utils_1.prettierCode)(code) : code);
            modelsPath[model.key] = fileId;
        });
    }
    else {
        for (const model of models) {
            const code = modelsOption.transform(model);
            const fileId = (0, utils_1.getModelsFileId)(setting, model.key);
            (0, utils_1.writeFileWithDirectoryCreation)(fileId, modelsOption.prettier !== false ? (0, utils_1.prettierCode)(code) : code);
            modelsPath[model.key] = fileId;
        }
    }
    if (modelsOption.dts !== false) {
        const fileName = typeof modelsOption.dts === 'string' ? modelsOption.dts : 'index';
        const fileId = (0, utils_1.getModelsFileId)(setting, fileName);
        genIndex(fileId, models);
        dtsPath = fileId;
    }
    return { models, paths: modelsPath, dtsPath };
}
exports.generateModelsAsync = generateModelsAsync;
function fetchModelsAsync(types) {
    const models = [];
    const separatedTypes = {};
    for (const type of Object.values(types)) {
        if (!(0, utils_1.isModelType)(type))
            continue;
        const key = (0, utils_1.makeFilename)(type);
        let items;
        if (key in separatedTypes) {
            items = separatedTypes[key];
        }
        else {
            items = [];
            separatedTypes[key] = items;
        }
        items.push(type);
    }
    for (const key in separatedTypes) {
        const types = separatedTypes[key];
        for (const type of types) {
            const isClass = type.isInterface === false;
            const item = {
                definition: isClass ? 'class' : 'interface',
                name: (0, utils_1.makeTypename)(type),
                key,
                dependencys: [],
                properties: [],
            };
            if (!type.isEnum) {
                const dependsTypes = (0, utils_1.detectDependsTypes)(type);
                for (const dependType of Object.values(dependsTypes)) {
                    const dependModule = (0, utils_1.makeFilename)(dependType);
                    item.dependencys?.push({
                        id: dependModule,
                        modules: dependType.name,
                    });
                }
                if (type.properties) {
                    const properties = type.properties;
                    for (const propertyName in properties) {
                        const property = properties[propertyName];
                        const propertyType = property.typeRef;
                        const propertie = {
                            name: propertyName,
                            type: [(0, utils_1.makeTypename)(propertyType)],
                            description: property.comments,
                            value: 'null',
                            required: !property.nullable,
                        };
                        if (property.nullable)
                            propertie.type?.push('null', 'undefined');
                        if (isClass) {
                            if (propertyType.isArray)
                                propertie.value = '[]';
                            else if (property.nullable)
                                propertie.value = 'null';
                            else if (propertyType.isBuildInType)
                                propertie.value = getBuildInTypeValue(propertyType.name);
                            else if (propertyType.isEnum)
                                propertie.value = '0';
                        }
                        item.properties?.push(propertie);
                    }
                }
                if (type.baseType)
                    item.extends = (0, utils_1.makeTypename)(type.baseType);
            }
            if (type.isEnum) {
                item.definition = 'enum';
                item.properties = type.enumValues?.map(e => ({ name: e.key, value: e.value }));
            }
            if (type.comments)
                item.description = type.comments;
            models.push(item);
        }
    }
    return models;
}
exports.fetchModelsAsync = fetchModelsAsync;
function getBuildInTypeValue(name) {
    switch (name) {
        case 'string':
            return '\'\'';
        case 'number':
            return '0';
        case 'boolean':
            return 'false';
        case 'Date':
            return 'new Date()';
        case 'Record':
            return '{}';
        default:
            return undefined;
    }
}
function handlebarsTransform(text, data) {
    const template = handlebars_1.default.compile(text, { noEscape: true });
    const code = template({ data });
    return code;
}
async function genIndex(fileId, data) {
    const str = data.map(v => `export * from "./${v.key}";`).join('\n');
    await (0, utils_1.writeFileWithDirectoryCreation)(fileId, str);
}
