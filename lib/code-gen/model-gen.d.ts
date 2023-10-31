import type { ISettingsV3, ModelType } from '../../types';
import type { DotNetTypes, IDotnetType } from './types';
export declare function generateModelsAsync(models: ModelType[], setting: ISettingsV3): {
    models: never[];
    paths: {};
    dtsPath?: undefined;
} | {
    models: ModelType[];
    paths: Record<string, string>;
    dtsPath: string;
};
export declare function getModelByIDotnetType(type: IDotnetType, key: string): ModelType;
export declare function fetchModelsAsync(types: DotNetTypes): ModelType[];
