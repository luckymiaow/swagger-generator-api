"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelsFileId = exports.getFileId = exports.writeFileWithDirectoryCreation = exports.prettierCode = exports.cleanAsync = exports.isModelType = exports.detectDependsTypes = exports.makeTypename = exports.makeFilename = exports.mergeLines = exports.comment = void 0;
const node_path_1 = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const typescript_string_operations_1 = require("typescript-string-operations");
const fs_extra_1 = require("fs-extra");
const prettier_1 = __importDefault(require("prettier"));
function comment(value) {
    if (value)
        return `/* ${value} */`;
    return '';
}
exports.comment = comment;
function mergeLines(value) {
    if (value)
        return value.replace(/[\r?\n]/g, ' ');
    return '';
}
exports.mergeLines = mergeLines;
function makeFilename(type) {
    return (`${type.namespace}.${type.name}`).replace(/^\./, '');
}
exports.makeFilename = makeFilename;
function makeTypename(type) {
    if (type) {
        const sb = new typescript_string_operations_1.StringBuilder();
        if (type.isArray) {
            sb.Append(makeTypename(type.elementType));
            sb.Append('[]');
        }
        else {
            sb.Append(type.name);
            if (type.isGenericType && type.genericArguments) {
                const genArgs = type.genericArguments.map(arg => makeTypename(arg)).join(',');
                sb.Append(`<${genArgs}>`);
            }
        }
        return sb.ToString();
    }
    return 'void';
}
exports.makeTypename = makeTypename;
function detectDependsTypes(type) {
    const depends = {};
    function append(target) {
        if (target.genericArguments) {
            for (const arg of target.genericArguments)
                append(arg);
        }
        if (target.isArray && target.elementType)
            append(target.elementType);
        if (target != type && target.fullName !== type.fullName && !target.isBuildInType && !target.isGenericParameter)
            depends[target.fullName] = target;
    }
    if (type.baseType)
        append(type.baseType);
    if (type.genericTypeDefinition)
        append(type.genericTypeDefinition);
    if (type.isArray && type.elementType && !type.elementType.isBuildInType)
        append(type.elementType);
    if (type.properties) {
        for (const propertyType of Object.values(type.properties))
            append(propertyType.typeRef);
    }
    if (type.isGenericType && !type.isGenericTypeDefinition && type.genericArguments) {
        for (const argType of type.genericArguments)
            append(argType);
    }
    // console.log(type.name, 'depends', Object.values(depends).map(item => item.name).join(','));
    return depends;
}
exports.detectDependsTypes = detectDependsTypes;
function isModelType(type) {
    return !type.isBuildInType && !type.isGenericParameter && (!type.isGenericType || type.isGenericTypeDefinition);
}
exports.isModelType = isModelType;
async function cleanAsync(outputPath) {
    // clean codes
    try {
        await (0, fs_extra_1.emptyDirSync)(outputPath);
    }
    catch {
        // TODO`
    }
}
exports.cleanAsync = cleanAsync;
// export function codeSignature(): string {
//   return `/* auto generated code at ${new Date().toLocaleString()} */`;
// }
const prettierOptions = { parser: 'typescript' };
function prettierCode(code) {
    let prettiedCode;
    try {
        return prettier_1.default.format(code, prettierOptions);
    }
    catch {
        // Empty
    }
    return code;
}
exports.prettierCode = prettierCode;
async function writeFileWithDirectoryCreation(filePath, fileContent) {
    // 获取文件所在的目录路径
    const directory = node_path_1.default.dirname(filePath);
    // 使用 fs.mkdir 递归创建目录
    await fs.promises.mkdir(directory, { recursive: true });
    // 使用 fs.writeFile 写入文件
    fs.writeFile(filePath, fileContent, (err) => {
        if (err)
            Promise.reject(err);
        else
            Promise.resolve();
    });
}
exports.writeFileWithDirectoryCreation = writeFileWithDirectoryCreation;
function getFileId(basePath, output, fileName, defaultPath, extname = '.ts') {
    let fileId = '';
    if (typeof output === 'function') {
        fileId = output(node_path_1.default.join(basePath, defaultPath, `${fileName}`));
    }
    else {
        if (!output) {
            fileId = node_path_1.default.join(basePath, defaultPath, `${fileName}`);
        }
        else {
            output = hasExtension(output) ? output : node_path_1.default.join(output, `${fileName}`);
            if ((0, node_path_1.isAbsolute)(output))
                fileId = output;
            else
                fileId = node_path_1.default.join(basePath, output);
        }
    }
    return hasExtension(fileId) ? fileId : `${fileId}${extname}`;
}
exports.getFileId = getFileId;
function getModelsFileId(setting, fileName) {
    const models = setting.template.models;
    return getFileId(setting.basePath, models.output, fileName, 'models', models.extension || '.ts');
}
exports.getModelsFileId = getModelsFileId;
function hasExtension(filePath) {
    const fileExtension = node_path_1.default.extname(filePath);
    return !!fileExtension;
}
// export function getApiFileId(setting: ISettingsV3, fileName: string) {
//   if(typeof setting.template.api.transform) getFileId(setting.basePath, setting.template.api.output, fileName, 'api')
// }
