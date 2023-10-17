import path, { isAbsolute } from 'node:path';
import * as fs from 'node:fs';
import { StringBuilder } from 'typescript-string-operations';
import { emptyDirSync } from 'fs-extra';
import prettier from 'prettier';
export function comment(value) {
    if (value)
        return `/* ${value} */`;
    return '';
}
export function mergeLines(value) {
    if (value)
        return value.replace(/[\r?\n]/g, ' ');
    return '';
}
export function makeFilename(type) {
    return (`${type.namespace}.${type.name}`).replace(/^\./, '');
}
export function makeTypename(type) {
    if (type) {
        const sb = new StringBuilder();
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
export function detectDependsTypes(type) {
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
export function isModelType(type) {
    return !type.isBuildInType && !type.isGenericParameter && (!type.isGenericType || type.isGenericTypeDefinition);
}
export async function cleanAsync(outputPath) {
    // clean codes
    try {
        await emptyDirSync(outputPath);
    }
    catch {
        // TODO`
    }
}
// export function codeSignature(): string {
//   return `/* auto generated code at ${new Date().toLocaleString()} */`;
// }
const prettierOptions = { parser: 'typescript' };
export function prettierCode(code) {
    let prettiedCode;
    try {
        return prettier.format(code, prettierOptions);
    }
    catch {
        // Empty
    }
    return code;
}
export async function writeFileWithDirectoryCreation(filePath, fileContent) {
    // 获取文件所在的目录路径
    const directory = path.dirname(filePath);
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
export function getFileId(basePath, output, fileName, defaultPath) {
    let fileId = '';
    if (typeof output === 'function') {
        fileId = output(path.join(basePath, defaultPath, `${fileName}`));
    }
    else {
        if (!output)
            fileId = path.join(basePath, defaultPath, `${fileName}`);
        else if (isAbsolute(output))
            fileId = path.join(output, `${fileName}`);
        else
            fileId = path.join(basePath, output, `${fileName}`);
    }
    return fileId.endsWith('.ts') ? fileId : `${fileId}.ts`;
}
export function getModelsFileId(setting, fileName) {
    return getFileId(setting.basePath, setting.template.models.output, fileName, 'models');
}
// export function getApiFileId(setting: ISettingsV3, fileName: string) {
//   if(typeof setting.template.api.transform) getFileId(setting.basePath, setting.template.api.output, fileName, 'api')
// }
