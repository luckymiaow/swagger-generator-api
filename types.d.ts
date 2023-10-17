interface ISettingsV3 {
  url: string;
  basePath: string;
  template: Template;
}

export type Template = {
  /**
   * 生成模型配置
   */
  models: ModelOption;
  /**
   * 生成接口配置
   */
  api: ApiOption;
  /** 
   * 写入文件之后
   */
  onAfterWriteFile?: (models?: ModelReturnResults, apis?: ApiReturnResults) => void;
};

export type ModelOption = {
  /**
   *  输出文件目录 , 为函数时默认地址basePath/models应返回目标地址
   * @default models
   */
  output?: string | ((fileId: string) => string);

  /**
   * 转换文件为指定格式，
   * 为字符串时遵循Handlebars.js语法 https://www.npmjs.com/package/handlebars-helpers
   *  @param {ModelType} data
   * 为函数时应返回转换后的代码
   */
  transform: string | TransformModel;

  /**
   * 是否在目录生成汇总导出文件，true将生成index.ts的文件 string 将在output目录生成该string的文件
   * @default true
   */
  dts?: boolean | string;

  /**
   * 格式化代码
   * @default true
   */
  prettier?: boolean;
};

export type ApiOption =
  | {
      transform: TransformApi;
      /**
       * 格式化代码
       * @default true
       */
      prettier?: boolean;
    }
  | {
      /**
       *输出文件地址
       *@default apis/index.ts
       *, 为函数时应返回目标地址
       */
      output?: string | ((fileId: string) => string);
      /**
       * 转换文件为指定格式
       * 为字符串时遵循Handlebars.js语法 ，系统内置了properties函数，可以方便输出属性 https://www.npmjs.com/package/handlebars-helpers
       * @param {ApiType} data
       * 为函数时应返回转换后的文件
       */
      transform: string;
      /**
       * 格式化代码
       * @default true
       */
      prettier?: boolean;
    };

export type TransformModel = (model: ModelType) => string;

// 得到标准的模型文件数据
export type ModelType = {
  description?: string; // model描述
  definition: 'class' | 'type' | 'interface' | 'enum'; // model标记类型
  name: string; // model 类型名称
  key: string; // model 名称, 拼接路径时使用
  properties?: Properties[]; // model 属性
  dependencys?: Dependency[]; // 导入模块
  extends?: string; // 继承
};

export type Properties = {
  name: string; // 属性名称
  type: string[]; // 属性类型
  value?: string; // 属性值
  description?: string; // 属性描述
  required?: boolean;
};

export type Dependency = {
  id: string; //模块id，使用时需要自行拼接路径，
  modules: string; //导入的模块
};

export type TransformApi = (apis: ApiType, fileId: string) => Array<TransformReturn> 
                                                              | TransformReturn;

export type TransformReturn = {
  output: string | ((fileId: string) => string);
  code: string;
};

export type ApiType = {
  dependencys?: (Dependency & { fileId: string })[];
  namespaces?: ApiNamespace[];
  controllers?: ApiController[];
};

export type ApiNamespace = {
  name: string;
  description?: string;
  controllers: ApiController[];
};

export type ApiController = {
  name: string;
  description?: string;
  actions: ApiAction[];
};

export type ApiAction = {
  url: string;
  method: HttpMethod;
  name: string;
  description?: string;
  responseType: ResponseType;
  headers?: Record<string, any>;
  limit: Record<string, any>;
  requestBody?: string | ApiProperties[];
  parameters?: string | ApiProperties[];
  returnType: string | ApiProperties[] | 'void' | 'Blob';
};

export type ApiProperties = {
  isPath: boolean;
} & Properties;

export type BaseType = 'string' | 'array' | 'object' | 'number' | 'boolean';

export type ResponseType = 'text' | 'blob' | 'json';

export type HttpMethod = 'GET' | 'PUT' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'PATCH'; // | "TRACE";

export type ModelReturnResults = {
  models: ModelType[];
  paths: Record<string, string>;
  dtsPath?: string;
};

export type ApiReturnResults = {
  apis: ApiType,
  paths: Record<string, string>;
}

export type IApiDocV3 = {
  version: 'v3'
  apiDocs: Array<ISettingsV3> 
};

export declare function defineConfig(config: IApiDocV3 ): IApiDocV3;
