import { defineConfig } from 'swagger-generator-api';
import { defaultApisTransform, defaultModelTransformFn } from 'swagger-generator-api/lib/presets';

const baseUrl = 'https://localhost:7299';

export default defineConfig({
  version: 'v3',
  apiDocs: [
    {
      url: `${baseUrl}/swagger/v1/swagger.json`,
      basePath: '.generated',
      template: {
        models: {
          transform: defaultModelTransformFn,
          dts: true,
        },
        api: {
          output: (fileId: string) => {
            // 演示使用函数自定义api输出目录
            return fileId.replace('apis', 'requests')
          },
          transform: defaultApisTransform,
        },
        onAfterWriteFile: (models, apis) => {
          // 这里可以做一些生成后的操作，
        },
      },
    },
  ],
})
