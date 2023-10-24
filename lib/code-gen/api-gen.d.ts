import type { OpenAPI3 } from '../schema';
import type { ApiReturnResults, ApiType, ISettingsV3, ModelReturnResults } from '../../types';
import type { DotNetTypes } from './types';
export declare function fetchApisAsync(doc: OpenAPI3, definedTypes: DotNetTypes, setting: ISettingsV3): ApiType;
export declare function generateApisAsync(apis: ApiType, models: ModelReturnResults, setting: ISettingsV3): Promise<ApiReturnResults>;
