/*
 * @Description:
 * @Autor: luckymiaow
 * @Date: 2021-08-05 09:27:06
 * @LastEditors: luckymiaow
 */
import path from 'node:path';
import * as fs from 'fs-extra';

export function resolveFilePath(name: string): string {
  let p = path.join(__dirname, name);
  p = path.resolve(p);
  return p;
}

const settingsFilename = resolveFilePath('./config.json');

export interface ISettings {
  url: string
  outputPath: string
  description?: boolean // 是否生成注解
  optionId: 'id' | 'identifier'
}

export const defaultSettings: ISettings[] = [
  {
    url: '/swagger/v1/swagger.json',
    outputPath: resolveFilePath('../src/generated/'),
    optionId: 'identifier',
  },
];

export async function loadSettingsAsync(): Promise<ISettings[]> {
  if (await fs.existsSync(settingsFilename))
    return fs.readJSONSync(settingsFilename) as ISettings[];

  return defaultSettings;
}
