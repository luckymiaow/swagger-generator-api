import path, { isAbsolute } from 'node:path';
import * as fs from 'node:fs';
import { StringBuilder } from 'typescript-string-operations';
import { emptyDirSync } from 'fs-extra';
import prettier from 'prettier';
import type { ISettingsV3, ModelOption } from '../../types';
import type { DotNetTypes, IDotnetType } from './types';

export function comment(value?: string): string {
  if (value)
    return `/* ${value} */`;

  return '';
}

export function mergeLines(value?: string): string {
  if (value)
    return value.replace(/[\r?\n]/g, ' ');

  return '';
}

export function makeFilename(type: IDotnetType) {
  return (`${type.namespace}.${type.name}`).replace(/^\./, '');
}

export function makeTypename(type?: IDotnetType) {
  if (type) {
    const sb = new StringBuilder();
    if (type.isArray) {
      sb.Append(makeTypename(type.elementType));
      sb.Append('[]');
    }
    else {
      sb.Append(type.name);
      if (type.isGenericType && type.genericArguments) {
        const genArgs = type.genericArguments!.map(arg => makeTypename(arg)).join(',');
        sb.Append(`<${genArgs}>`);
      }
    }
    return sb.ToString();
  }
  return 'void';
}

export function makeModelName(type: IDotnetType) {
  const sb = new StringBuilder();
  if (type.isArray) {
    sb.Append(makeTypename(type.elementType));
    sb.Append('[]');
  }
  else {
    sb.Append(type.name);
    if (type.isGenericType) {
      const genArgs = type.genericArguments!.map(arg => makeTypename(arg)).join(',');
      sb.Append(`<${genArgs}>`);
    }
  }
  return sb.ToString();
}

// 总是应用的类型修正:object<> -> Record<>(object<> 不是合法 TS 类型)
export function normalizeTypeName(type: string): string {
  return type.includes('object<') ? type.replace(/object</g, 'Record<') : type;
}

// 由 dayjs 配置控制的类型转换(Date -> Dayjs)
export function transformTypeName(type: string): string {
  return type === 'Date' ? 'Dayjs' : type;
}

// 统一应用类型转换:始终做 object<> -> Record<>,dayjs 为 true 时再做 Date -> Dayjs
export function applyTypeTransform(type: string, dayjs?: boolean): string {
  const t = normalizeTypeName(type);
  return dayjs ? transformTypeName(t) : t;
}

export function detectDependsTypes(type: IDotnetType): DotNetTypes {
  const depends: DotNetTypes = {};
  function append(target: IDotnetType) {
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

export function isModelType(type: IDotnetType) {
  return !type.isBuildInType && !type.isGenericParameter && (!type.isGenericType || type.isGenericTypeDefinition);
}

export async function cleanAsync(outputPath: string) {
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

const prettierOptions: prettier.Options = { parser: 'typescript' };
export function prettierCode(code: string): string {
  let prettiedCode: string;
  try {
    return prettier.format(code, prettierOptions);
  }
  catch {
    // Empty
  }
  return code;
}

export async function writeFileWithDirectoryCreation(filePath: string, fileContent: string) {
  // 获取文件所在的目录路径
  const directory = path.dirname(filePath);

  // 使用 fs.mkdir 递归创建目录
  await fs.promises.mkdir(directory, { recursive: true });

  // 使用 fs.writeFile 写入文件
  fs.writeFile(filePath, fileContent, (err) => {
    if (err) Promise.reject(err);
    else Promise.resolve()
  });
}

export function getFileId(basePath: string, output: string | ((fileId: string) => string) | undefined, fileName: string, defaultPath: 'models' | 'apis', extname = '.ts'): string {
  let fileId = ''
  if (typeof output === 'function') {
    fileId = output(path.join(basePath, defaultPath, `${fileName}`))
  }
  else {
    if (!output) {
      fileId = path.join(basePath, defaultPath, `${fileName}`)
    }
    else {
      output = hasExtension(output) ? output : path.join(output, `${fileName}`)
      if (isAbsolute(output))
        fileId = output;
      else
        fileId = path.join(basePath, output)
    }
  }

  return hasExtension(fileId) ? fileId : `${fileId}${extname}`
}

export function getModelsFileId(setting: ISettingsV3, fileName: string) {
  const models = setting.template.models as ModelOption
  return getFileId(setting.basePath, models.output, fileName, 'models', models.extension || '.ts')
}

function hasExtension(filePath: string) {
  const fileExtension = path.extname(filePath);
  return !!fileExtension;
}

// export function getApiFileId(setting: ISettingsV3, fileName: string) {
//   if(typeof setting.template.api.transform) getFileId(setting.basePath, setting.template.api.output, fileName, 'api')
// }
