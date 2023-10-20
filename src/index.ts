/*
 * @Description: ^_^
 * @Author: sharebravery
 * @Date: 2022-06-23 17:15:09
 */
import path, { isAbsolute, join } from 'node:path';
import axios from 'axios';
import helpers from 'handlebars-helpers';
import handlebars from 'handlebars';
import ora from 'ora';
import { readFile } from 'fs-extra';
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

function isUrl(str: string): boolean {
  return /^(http(s)?:\/\/).*$/.test(str);
}

async function loadApiURlDesc(docUrl: string) {
  try {
    const { data: doc } = await axios.get(docUrl);
    return doc as OpenAPI3;
  }
  catch (err) {
    throw new Error('获取swagger Json 错误！请检查网络状态或者api地址是否正确!');
  }
}

async function loadApiFileDesc(docPath: string): Promise<OpenAPI3> {
  if (path.extname(docPath).toLowerCase() !== '.json') throw new Error('不是一个json文件！');

  let filePath = docPath

  if (!isAbsolute(docPath))
    filePath = join(process.cwd(), docPath)
  const json = await readFile(filePath, 'utf8');

  return JSON.parse(json)
}

async function loadApiDesc(docUrl: string): Promise<OpenAPI3> {
  if (isUrl(docUrl)) return loadApiURlDesc(docUrl)
  return loadApiFileDesc(docUrl)
}

export default async function main(settings: ISettingsV3[]) {
  console.log('gen api: vue start ');
  process.env.NODE_NO_WARNINGS = '1';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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

      loading.info(`下载api文档中[${setting.url}]...`);

      const doc = await loadApiDesc(setting.url);

      loading.info('文档生成中...');

      const types = buildTypes(doc.components?.schemas as OpenAPI3Schemas);

      await cleanAsync(setting.basePath);

      const models = await generateModelsAsync(types, setting);

      let apis;

      if (doc.paths)
        apis = await generateApisAsync(setting, doc, types, models);

      if (setting.template.onAfterWriteFile)
        setting.template.onAfterWriteFile(models, apis);
    });
  }

  async function executeQueue(queue: (() => Promise<void>)[]) {
    let taskConut = 0;
    for (const task of queue) {
      await task();
      taskConut++
      if (taskConut === queue.length) loading.succeed('所有文档生成完成!');
    }
  }

  executeQueue(queue);
}

export const defineConfig = (config: IApiDocV3) => config
