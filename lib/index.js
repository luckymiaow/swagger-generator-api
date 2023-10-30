"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineConfig = void 0;
/*
 * @Description: ^_^
 * @Author: sharebravery
 * @Date: 2022-06-23 17:15:09
 */
const node_path_1 = __importDefault(require("node:path"));
const handlebars_helpers_1 = __importDefault(require("handlebars-helpers"));
const handlebars_1 = __importDefault(require("handlebars"));
const ora_1 = __importDefault(require("ora"));
const swagger_parser_1 = __importDefault(require("@apidevtools/swagger-parser"));
const swagger2_0_1 = require("./swagger2.0");
const utils_1 = require("./code-gen/utils");
const code_gen_1 = require("./code-gen");
const presets_1 = require("./presets");
const registeredHelpers = (0, handlebars_helpers_1.default)();
Object.keys(registeredHelpers).forEach((helperName) => {
    handlebars_1.default.registerHelper(helperName, registeredHelpers[helperName]);
});
handlebars_1.default.registerHelper('properties', (data, definition = 'class', isValue = true) => {
    return new handlebars_1.default.SafeString((0, presets_1.joinProperties)(data, definition, isValue));
});
async function loadApiV3Doc(doc, setting) {
    const types = (0, code_gen_1.buildTypes)(doc.components?.schemas);
    const apis = await (0, code_gen_1.fetchApisAsync)(doc, types, setting);
    const models = await (0, code_gen_1.fetchModelsAsync)(types);
    return {
        apis,
        models,
    };
}
async function loadApiV2Doc(doc, setting) {
    const res = await (0, swagger2_0_1.parseV2)(doc);
    if (setting.template.api && setting.template.api.onBeforeActionWriteFile) {
        const onBeforeActionWriteFile = setting.template.api.onBeforeActionWriteFile;
        res.apis.actions = res.apis.actions?.map(e => onBeforeActionWriteFile(e));
        res.apis.controllers?.forEach((item) => {
            item.actions = item.actions?.map(e => onBeforeActionWriteFile(e));
        });
        res.apis.namespaces?.forEach((v) => {
            v.controllers.forEach((item) => {
                item.actions = item.actions?.map(e => onBeforeActionWriteFile(e));
            });
        });
    }
    return res;
}
async function loadApiDesc(setting) {
    if (typeof setting.url === 'function')
        setting.url = await setting.url();
    const api = await swagger_parser_1.default.parse(setting.url);
    if (api.swagger)
        return loadApiV2Doc(api, setting);
    else if (api.openapi)
        return loadApiV3Doc(api, setting);
    else
        throw new Error('这是未知版本的API文档');
}
async function main(settings) {
    console.log('gen api: vue start ');
    const loading = (0, ora_1.default)('读取配置中...').start();
    loading.spinner = {
        interval: 70,
        frames: [
            '✹',
        ],
    };
    loading.color = 'yellow';
    const queue = [];
    for (const setting of settings) {
        queue.push(async () => {
            setting.basePath = node_path_1.default.join(process.cwd(), setting.basePath);
            loading.info(`开始生成[${setting.url}]...`);
            const { models, apis } = await loadApiDesc(setting);
            await (0, utils_1.cleanAsync)(setting.basePath);
            const modelsRef = await (0, code_gen_1.generateModelsAsync)(models, setting);
            const apiRef = await (0, code_gen_1.generateApisAsync)(apis, modelsRef, setting);
            if (setting.template.onAfterWriteFile)
                setting.template.onAfterWriteFile(modelsRef, apiRef);
            loading.succeed(`[${setting.url}]文档生成完成!`);
        });
    }
    async function executeQueue(queue) {
        let taskCount = 0;
        for (const task of queue) {
            try {
                await task();
                taskCount++;
                if (taskCount === queue.length)
                    loading.succeed('所有文档生成完成!');
            }
            catch (err) {
                taskCount++;
                loading.warn(err.toString());
                throw err;
            }
        }
    }
    executeQueue(queue);
}
exports.default = main;
const defineConfig = (config) => config;
exports.defineConfig = defineConfig;
