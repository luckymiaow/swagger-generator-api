/*
 * @Description:
 * @Author: luckymiaow
 * @Date: 2023-10-18 14:50:15
 * @LastEditors: luckymiaow
 */
import { exec } from 'node:child_process';
import { defineConfig } from 'swagger-generator-api';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const baseUrl = 'https://localhost:7299';

export default defineConfig({
  version: 'v3',
  apiDocs: [

    {
      url: 'https://172.22.1.172/swagger/v1/swagger.json',
      basePath: '.generatedv2',
      template: {
        models: {

        },
        api: {

        },
        onAfterWriteFile: (models, apis) => {
          const fix = path => exec(`eslint ${path} --fix`, (error, stdout, stderr) => {
            if (error) {
              console.error(`执行错误: ${error.message}`)
              return
            }
            if (stderr) {
              console.error(`标准错误输出: ${stderr}`)
              return
            }

            console.log(`格式化修复成功: ${path}`)
          })

          Object.values(models?.paths || {}).forEach(fix)
          Object.values(apis?.paths || {}).forEach(fix)
        },
      },
    },
  ],
})
