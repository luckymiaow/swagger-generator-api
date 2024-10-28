/*
 * @Description:
 * @Author: luckymiaow
 * @Date: 2023-10-18 14:50:15
 * @LastEditors: luckymiaow
 */
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
      },
    },
  ],
})
