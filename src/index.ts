/*
 * @Description: ^_^
 * @Author: sharebravery
 * @Date: 2022-06-23 17:15:09
 */
import path from 'node:path';
import axios from 'axios';
import helpers from 'handlebars-helpers';
import handlebars from 'handlebars';
import ora from 'ora';
import type { IApiDocV3, ISettingsV3, Properties } from '../types';
import type { OpenAPI3, OpenAPI3Schemas } from './schema';
import { cleanAsync, prettierCode } from './code-gen/utils';
import { buildTypes, generateApisAsync, generateModelsAsync } from './code-gen';

const registeredHelpers = helpers();
Object.keys(registeredHelpers).forEach((helperName) => {
  handlebars.registerHelper(helperName, registeredHelpers[helperName]);
});

handlebars.registerHelper('properties', (data: Properties[] | string, isValue = true) => {
  if (!data) return 'any';
  if (typeof data === 'string') return data;
  const str = prettierCode(`{
    ${data.map((item) => {
      return `${item.description ? `/*${item.description}*/\n` : ''}${item.name}${item.required ? '' : '?'}: ${item.type.join('|')}${isValue ? ` = ${item.value}` : ''}`
    }).join(';\n')}}`)
  return new handlebars.SafeString(str);
});

async function loadApiDesc(docUrl: string): Promise<OpenAPI3> {
  try {
    const { data: doc } = await axios.get(docUrl);
    return doc as OpenAPI3;
  }
  catch (err) {
    throw new Error('获取swagger Json 错误！请检查网络状态或者api地址是否正确!');
  }
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

  for (const setting of settings) {
    setting.basePath = path.join(process.cwd(), setting.basePath)

    await cleanAsync(setting.basePath);

    loading.info(`下载api文档中[${setting.url}]...`);

    const doc = await loadApiDesc(setting.url);

    loading.info('文档生成中...');

    const types = buildTypes(doc.components?.schemas as OpenAPI3Schemas);

    const models = await generateModelsAsync(types, setting);

    let apis;

    if (doc.paths)
      apis = await generateApisAsync(setting, doc, types, models);

    if (setting.template.onAfterWriteFile)
      setting.template.onAfterWriteFile(models, apis)
  }
  loading.succeed('所有文档生成完成!');
}

export const defineConfig = (config: IApiDocV3) => config
