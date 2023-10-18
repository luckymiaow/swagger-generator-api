#!/usr/bin/env node
import path from 'node:path';
import { loadConfig } from 'unconfig';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs, { readFileSync } from 'fs-extra';
import type { IApiDocV3 } from '../types';
import main from './index';

async function start() {
  const { config, sources } = await loadConfig<IApiDocV3>({
    sources: [
      {
        files: 'api.config',
        // default extensions
        extensions: ['ts', 'js', 'json', ''],

      },
    ],
    merge: false,
  })
  if (!config) {
    const res = await inquirer.prompt<{ init: boolean }>([{
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
      fs.writeFile('api.config.ts', readFileSync(path.join(__dirname, '../', 'api.config.ts.tpl')), (err: any) => {
        if (err) {
          console.error(err);
        }
        else {
          console.log(chalk.green('配置文件api.config.ts已生成.'));
          start()
        }
      })
    }
    else {
      console.log(chalk.red('请正确生成api.config.ts配置后使用.'));
    }
  }
  else {
    main(config.apiDocs)
  }
}

start()
