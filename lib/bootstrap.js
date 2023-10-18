#!/usr/bin/env node
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
const node_path_1 = __importDefault(require("node:path"));
const unconfig_1 = require("unconfig");
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const fs_extra_1 = __importStar(require("fs-extra"));
const index_1 = __importDefault(require("./index"));
async function start() {
    const { config, sources } = await (0, unconfig_1.loadConfig)({
        sources: [
            {
                files: 'api.config',
                // default extensions
                extensions: ['ts', 'js', 'json', ''],
            },
        ],
        merge: false,
    });
    if (!config) {
        const res = await inquirer_1.default.prompt([{
                type: 'list',
                message: '当前目录下没有api.config文件，是否生成api.config:',
                name: 'init',
                choices: [
                    {
                        name: 'Yes',
                        value: true,
                    },
                    {
                        name: 'No',
                        value: false,
                    },
                ],
            }]);
        if (res.init) {
            fs_extra_1.default.writeFile('api.config.ts', (0, fs_extra_1.readFileSync)(node_path_1.default.join(__dirname, '../', 'api.config.ts.tpl')), (err) => {
                if (err) {
                    console.error(err);
                }
                else {
                    console.log(chalk_1.default.green('配置文件api.config.ts已生成.'));
                    start();
                }
            });
        }
        else {
            console.log(chalk_1.default.red('请正确生成api.config.ts配置后使用.'));
        }
    }
    else {
        (0, index_1.default)(config.apiDocs);
    }
}
start();
