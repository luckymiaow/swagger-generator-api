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
import { convertObj } from 'swagger2openapi';
import type { IApiDocV3, ISettingsV3, ModelType, Properties } from '../types';
import type { OpenAPI3, OpenAPI3Schemas } from './schema';
import { cleanAsync } from './code-gen/utils';
import { buildTypes, generateApisAsync, generateModelsAsync } from './code-gen';
import { joinProperties } from './presets';

const registeredHelpers = helpers();
Object.keys(registeredHelpers).forEach((helperName) => {
  handlebars.registerHelper(helperName, registeredHelpers[helperName]);
});

handlebars.registerHelper('properties', (data: Properties[] | string, definition: ModelType['definition'] = 'class', isValue = true) => {
  return new handlebars.SafeString(joinProperties(data, definition, isValue));
});

async function loadApiDesc(docUrl: ISettingsV3['url']): Promise<OpenAPI3> {
  if (typeof docUrl === 'function')
    docUrl = await docUrl();
  const api = await swaggerParser.parse(docUrl) as any
  if (api.swagger) {
    const res = (await convertObj(api, { warnOnly: true, nopatch: true }))
    return res.openapi as OpenAPI3;
  }
  else if (api.openapi) {
    return api
  }
  else { throw new Error('这是未知版本的API文档'); }
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

      const doc = await loadApiDesc(setting.url);

      const types = buildTypes(doc.components?.schemas as OpenAPI3Schemas);

      await cleanAsync(setting.basePath);

      const models = await generateModelsAsync(types, setting);

      let apis;

      if (doc.paths)
        apis = await generateApisAsync(setting, doc, types, models);

      if (setting.template.onAfterWriteFile)
        setting.template.onAfterWriteFile(models, apis);
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
      }
    }
  }

  executeQueue(queue);
}

export const defineConfig = (config: IApiDocV3) => config
