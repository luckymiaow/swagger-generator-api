import type { ISettingsV3, ModelReturnResults, ModelType } from '../../types';
import type { DotNetTypes } from './types';
export declare function generateModelsAsync(types: DotNetTypes, setting: ISettingsV3): Promise<ModelReturnResults>;
export declare function fetchModelsAsync(types: DotNetTypes): ModelType[];
