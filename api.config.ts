/*
 * @Description:
 * @Author: luckymiaow
 * @Date: 2023-10-18 14:50:15
 * @LastEditors: luckymiaow
 */
import { defineConfig } from 'swagger-generator-api';

const baseUrl = 'https://localhost:7299';

export default defineConfig({
  version: 'v3',
  apiDocs: [

    {
      url: 'http://127.0.0.1:4523/export/openapi?projectId=3365353&version=3.0',
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
