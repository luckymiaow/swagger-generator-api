import type { ApiType, ModelType } from '../../types';
import type { Swagger2 } from './type';
export declare function parseV2(swDoc: Swagger2): Promise<{
    apis: ApiType;
    models: ModelType[];
}>;
