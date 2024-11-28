import type { ApiAction, ApiController, ApiNamespace, ApiType, Dependency, ModelType, Properties, TransformReturn } from '../types';
export declare function joinProperties(data?: Properties[] | string, definition?: ModelType['definition'], isValue?: boolean): string;
export declare const defaultModelTransform = "\n{{#each data.dependencys}}\nimport { {{this.modules}} } from './{{this.id}}';\n{{/each}}\n{{#if data.description}}/**{{data.description}}*/{{/if}}\nexport {{data.definition}} {{data.name}} {{#if data.extends}} extends {{data.extends}}{{/if}} {{#if (eq data.definition  'type')}} = {{/if}} {{properties data.properties data.definition}}";
export declare function defaultModelTransformFn(data: ModelType): string;
export declare function getActionString(): string;
export declare function getClassString(): string;
export declare function getNamespacesString(): string;
export declare const defaultApisTransform: string;
/**
 * 使用预设类进行灵活拼接
 */
export declare class DefaultApisTransform {
    getImport(): string;
    getDependencys(dependencys?: Dependency[]): string;
    getApiOptions(): string;
    getApiRequestName(action: ApiAction): string;
    getReturnType(action: ApiAction): string | import("../types").ApiProperties[];
    getAction(action: ApiAction): string;
    getController(controller: ApiController): string;
    getNamespaces(namespace: ApiNamespace): string;
    /**
     * 拼接
     */
    generated(data: ApiType): string;
}
export declare function defaultApisTransformFn(data: ApiType): Array<TransformReturn> | TransformReturn;
