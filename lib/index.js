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
const axios_1 = __importDefault(require("axios"));
const handlebars_helpers_1 = __importDefault(require("handlebars-helpers"));
const handlebars_1 = __importDefault(require("handlebars"));
const ora_1 = __importDefault(require("ora"));
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
async function loadApiDesc(docUrl) {
    try {
        const { data: doc } = await axios_1.default.get(docUrl);
        return doc;
    }
    catch (err) {
        throw new Error('获取swagger Json 错误！请检查网络状态或者api地址是否正确!');
    }
}
async function main(settings) {
    console.log('gen api: vue start ');
    process.env.NODE_NO_WARNINGS = '1';
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const loading = (0, ora_1.default)('读取配置中...').start();
    loading.spinner = {
        interval: 70,
        frames: [
            '✹',
        ],
    };
    loading.color = 'yellow';
    for (const setting of settings) {
        setting.basePath = node_path_1.default.join(process.cwd(), setting.basePath);
        loading.info(`下载api文档中[${setting.url}]...`);
        const doc = await loadApiDesc(setting.url);
        loading.info('文档生成中...');
        const types = (0, code_gen_1.buildTypes)(doc.components?.schemas);
        await (0, utils_1.cleanAsync)(setting.basePath);
        const models = await (0, code_gen_1.generateModelsAsync)(types, setting);
        let apis;
        if (doc.paths)
            apis = await (0, code_gen_1.generateApisAsync)(setting, doc, types, models);
        if (setting.template.onAfterWriteFile)
            setting.template.onAfterWriteFile(models, apis);
    }
    loading.succeed('所有文档生成完成!');
}
exports.default = main;
const defineConfig = (config) => config;
exports.defineConfig = defineConfig;
