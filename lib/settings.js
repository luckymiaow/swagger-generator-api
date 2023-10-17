/*
 * @Description:
 * @Autor: luckymiaow
 * @Date: 2021-08-05 09:27:06
 * @LastEditors: luckymiaow
 */
import path from 'node:path';
import * as fs from 'fs-extra';
export function resolveFilePath(name) {
    let p = path.join(__dirname, name);
    p = path.resolve(p);
    return p;
}
const settingsFilename = resolveFilePath('./config.json');
export const defaultSettings = [
    {
        url: '/swagger/v1/swagger.json',
        outputPath: resolveFilePath('../src/generated/'),
        optionId: 'identifier',
    },
];
export async function loadSettingsAsync() {
    if (await fs.existsSync(settingsFilename))
        return fs.readJSONSync(settingsFilename);
    return defaultSettings;
}
