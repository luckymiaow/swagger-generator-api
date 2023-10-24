import type { ISettingsV3, ModelType } from '../../types';
import type { DotNetTypes } from './types';
export declare function generateModelsAsync(models: ModelType[], setting: ISettingsV3): {
    models: never[];
    paths: {};
    dtsPath?: undefined;
} | {
    models: ModelType[];
    paths: Record<string, string>;
    dtsPath: string;
};
export declare function fetchModelsAsync(types: DotNetTypes): ModelType[];
