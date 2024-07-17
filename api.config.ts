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
      url: 'http://192.168.10.250:8088/swagger/v1/swagger.json',
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
