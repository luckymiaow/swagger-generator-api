import handlebars from 'handlebars';
import type { ISettingsV3, ModelOption, ModelType, Properties } from '../../types';
import { defaultModelTransform } from '../presets';
import type { DotNetTypes, IDotnetType } from './types';
import { detectDependsTypes, getModelsFileId, isModelType, makeFilename, makeTypename, prettierCode, writeFileWithDirectoryCreation } from './utils';

export function generateModelsAsync(models: ModelType[], setting: ISettingsV3) {
  const modelsPath: Record<string, string> = {};

  let dtsPath = ''

  if (setting.template.models === false) return { models: [], paths: {} };

  const modelsOption = setting.template.models as ModelOption

  if (!modelsOption.transform) modelsOption.transform = defaultModelTransform

  for (let model of models) {
    if (modelsOption.onBeforeWriteFile) model = modelsOption.onBeforeWriteFile(model)

    let code = defaultModelTransform

    if (!modelsOption.transform || typeof modelsOption.transform === 'string')
      code = handlebarsTransform(modelsOption.transform as string, model)
    else code = modelsOption.transform(model)

    const fileId = getModelsFileId(setting, model.key)
    writeFileWithDirectoryCreation(fileId, modelsOption.prettier !== false ? prettierCode(code) : code)
    modelsPath[model.key] = fileId
  }

  if (modelsOption.dts !== false) {
    const fileName = typeof modelsOption.dts === 'string' ? modelsOption.dts : 'index';
    const fileId = getModelsFileId(setting, fileName);
    genIndex(fileId, models)
    dtsPath = fileId
  }

  return { models, paths: modelsPath, dtsPath }
}

export function fetchModelsAsync(types: DotNetTypes): ModelType[] {
  const models: ModelType[] = [];

  const separatedTypes: { [key: string]: IDotnetType[] } = {};

  for (const type of Object.values(types)) {
    if (!isModelType(type)) continue;
    const key = makeFilename(type);
    let items: IDotnetType[];
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
      const item: ModelType = {
        definition: isClass ? 'class' : 'interface',
        name: makeTypename(type),
        key,
        dependencys: [],
        properties: [],
      }
      if (!type.isEnum) {
        const dependsTypes = detectDependsTypes(type);
        for (const dependType of Object.values(dependsTypes)) {
          const dependModule = makeFilename(dependType);
          item.dependencys?.push({
            id: dependModule,
            modules: dependType.name,
          })
        }
        if (type.properties) {
          const properties = type.properties!;
          for (const propertyName in properties) {
            const property = properties[propertyName];
            const propertyType = property.typeRef;
            const propertie: Properties = {
              name: propertyName,
              type: [makeTypename(propertyType)],
              description: property.comments,
              value: 'null',
              required: !property.nullable,
            }
            if (property.nullable)
              propertie.type?.push('null', 'undefined')

            if (isClass) {
              if (propertyType.isArray) propertie.value = '[]'
              else if (property.nullable) propertie.value = 'null'
              else if (propertyType.isBuildInType) propertie.value = getBuildInTypeValue(propertyType.name)
              else if (propertyType.isEnum)
                propertie.value = '0'
            }
            item.properties?.push(propertie)
          }
        }
        if (type.baseType)
          item.extends = makeTypename(type.baseType)
      }

      if (type.isEnum) {
        item.definition = 'enum';
        item.properties = type.enumValues?.map(e => ({ name: e.key, value: e.value }))
      }

      if (type.comments)
        item.description = type.comments

      models.push(item)
    }
  }

  return models
}

function getBuildInTypeValue(name: string) {
  switch (name) {
    case 'string':
      return '\'\''
    case 'number':
      return '0'
    case 'boolean':
      return 'false'
    case 'Date':
      return 'new Date()'
    case 'Record':
      return '{}'
    default:
      return undefined
  }
}

function handlebarsTransform(text: string, data: ModelType): string {
  const template = handlebars.compile(text, { noEscape: true });
  const code = template({ data });
  return code
}

async function genIndex(fileId: string, data: ModelType[]) {
  const str = data.map(v => `export * from "./${v.key}";`).join('\n')
  await writeFileWithDirectoryCreation(fileId, str)
}
