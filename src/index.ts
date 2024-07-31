/*
 * @Description: ^_^
 * @Author: sharebravery
 * @Date: 2022-06-23 17:15:09
 */
import path from 'node:path';
import helpers from 'handlebars-helpers';
import handlebars from 'handlebars';
import ora from 'ora';
import swaggerParser from '@apidevtools/swagger-parser';
import type { ApiType, IApiDocV3, ISettingsV3, ModelType, Properties } from '../types';
import { parseV2 } from './swagger2.0';
import type { OpenAPI3, OpenAPI3Schemas } from './schema';
import { cleanAsync } from './code-gen/utils';
import { buildTypes, fetchApisAsync as fetchV3ApisAsync, fetchModelsAsync as fetchV3ModelsAsync, generateApisAsync, generateModelsAsync } from './code-gen';
import { joinProperties } from './presets';

const registeredHelpers = helpers();
Object.keys(registeredHelpers).forEach((helperName) => {
  handlebars.registerHelper(helperName, registeredHelpers[helperName]);
});

handlebars.registerHelper('properties', (data: Properties[] | string, definition: ModelType['definition'] = 'class', isValue = true) => {
  return new handlebars.SafeString(joinProperties(data, definition, isValue));
});

async function loadApiV3Doc(doc: OpenAPI3, setting: ISettingsV3): Promise<{
  apis: ApiType
  models: ModelType[]
}> {
  const types = buildTypes(doc.components?.schemas as OpenAPI3Schemas);
  const models = await fetchV3ModelsAsync(types)
  const modelDir = models.reduce((a, b) => ((a[b.name] = b), a), {} as Record<string, ModelType>)

  const apis = await fetchV3ApisAsync(doc, types, setting, { models, modelDir })
  return {
    apis,
    models,
  }
}

async function loadApiV2Doc(doc: any, setting: ISettingsV3): Promise<{
  apis: ApiType
  models: ModelType[]
}> {
  const res = await parseV2(doc);
  if (setting.template.api && setting.template.api.onBeforeActionWriteFile) {
    const onBeforeActionWriteFile = setting.template.api.onBeforeActionWriteFile

    const modelDir = res.models.reduce((a, b) => ((a[b.name] = b), a), {} as Record<string, ModelType>)

    res.apis.actions = res.apis.actions?.map(e => onBeforeActionWriteFile(e, res.models, modelDir))
    res.apis.controllers?.forEach((item) => {
      item.actions = item.actions?.map(e => onBeforeActionWriteFile(e, res.models, modelDir))
    })
    res.apis.namespaces?.forEach((v) => {
      v.controllers.forEach((item) => {
        item.actions = item.actions?.map(e => onBeforeActionWriteFile(e, res.models, modelDir))
      })
    })
  }
  return res;
}

async function loadApiDesc(setting: ISettingsV3) {
  if (typeof setting.url === 'function')
    setting.url = await setting.url();
  const api = await swaggerParser.parse(setting.url) as any
  if (api.swagger)
    return loadApiV2Doc(api, setting);

  else if (api.openapi)
    return loadApiV3Doc(api, setting)

  else throw new Error('这是未知版本的API文档');
}

export default async function main(settings: ISettingsV3[]) {
  console.log('gen api: vue start ');
  const loading = ora('读取配置中...').start();
  loading.spinner = {
    interval: 70, // 转轮动画每帧之间的时间间隔
    frames: [
      '✹',
    ],
  }
  loading.color = 'yellow';
  const queue = [];

  for (const setting of settings) {
    queue.push(async () => {
      setting.basePath = path.join(process.cwd(), setting.basePath);

      loading.info(`开始生成[${setting.url}]...`);

      const { models, apis } = await loadApiDesc(setting);

      await cleanAsync(setting.basePath);

      const modelsRef = await generateModelsAsync(models, setting);

      const apiRef = await generateApisAsync(apis, modelsRef, setting);

      if (setting.template.onAfterWriteFile)
        setting.template.onAfterWriteFile(modelsRef, apiRef);
      loading.succeed(`[${setting.url}]文档生成完成!`);
    });
  }

  async function executeQueue(queue: (() => Promise<void>)[]) {
    let taskCount = 0;
    for (const task of queue) {
      try {
        await task();
        taskCount++
        if (taskCount === queue.length) loading.succeed('所有文档生成完成!');
      }
      catch (err: any) {
        taskCount++
        loading.warn(err.toString());
        throw err;
      }
    }
  }

  executeQueue(queue);
}

export const defineConfig = (config: IApiDocV3) => config
