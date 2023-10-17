import type { OpenAPI3 } from '../schema';
import type { ApiReturnResults, ISettingsV3, ModelReturnResults } from '../../types';
import type { DotNetTypes } from './types';
export declare function generateApisAsync(setting: ISettingsV3, doc: OpenAPI3, definedTypes: DotNetTypes, models: ModelReturnResults): Promise<ApiReturnResults>;
