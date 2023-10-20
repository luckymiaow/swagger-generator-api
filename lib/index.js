"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const node_path_1 = __importStar(require("node:path"));
const axios_1 = __importDefault(require("axios"));
const handlebars_helpers_1 = __importDefault(require("handlebars-helpers"));
const handlebars_1 = __importDefault(require("handlebars"));
const ora_1 = __importDefault(require("ora"));
const fs_extra_1 = require("fs-extra");
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
function isUrl(str) {
    return /^(https?:\/\/)?(www\.)?[^\s]+$/.test(str);
}
async function loadApiURlDesc(docUrl) {
    try {
        const { data: doc } = await axios_1.default.get(docUrl);
        return doc;
    }
    catch (err) {
        throw new Error('获取swagger Json 错误！请检查网络状态或者api地址是否正确!');
    }
}
async function loadApiFileDesc(docPath) {
    console.log('%c [ docPath ]-44', 'font-size:13px; background:pink; color:#bf2c9f;', docPath);
    if (node_path_1.default.extname(docPath).toLowerCase() === '.json')
        throw new Error('不是一个json文件！');
    let filePath = docPath;
    if (!(0, node_path_1.isAbsolute)(docPath))
        filePath = (0, node_path_1.join)(process.cwd(), docPath);
    return JSON.parse(await (0, fs_extra_1.readFile)(filePath, 'utf8'));
}
async function loadApiDesc(docUrl) {
    if (isUrl(docUrl))
        return loadApiURlDesc(docUrl);
    return loadApiFileDesc(docUrl);
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
