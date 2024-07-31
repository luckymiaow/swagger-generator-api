import type { OpenAPI3 } from '../schema';
import type { ApiReturnResults, ApiType, ISettingsV3, ModelReturnResults, ModelType } from '../../types';
import type { DotNetTypes } from './types';
export declare function fetchApisAsync(doc: OpenAPI3, definedTypes: DotNetTypes, setting: ISettingsV3, model: {
    models: ModelType[];
    modelDir: Record<string, ModelType>;
}): ApiType;
export declare function generateApisAsync(apis: ApiType, models: ModelReturnResults, setting: ISettingsV3): Promise<ApiReturnResults>;
