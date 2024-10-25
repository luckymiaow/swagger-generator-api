import type { OpenAPI3Reference, OpenAPI3SchemaObject, OpenAPI3Schemas } from '../schema';
import type { DotNetTypes, IDotnetType, IDotnetTypeRef } from './types';
export declare function buildTypeRef(schema: OpenAPI3SchemaObject, types: DotNetTypes, schemas?: OpenAPI3Schemas): IDotnetTypeRef;
export declare function buildType(obj: OpenAPI3SchemaObject | OpenAPI3Reference, types: DotNetTypes, schemas?: OpenAPI3Schemas, visited?: Set<string>): IDotnetType;
export declare function findOrBuildType(typeRef: string, obj: OpenAPI3SchemaObject | OpenAPI3Reference, types: DotNetTypes, schemas?: OpenAPI3Schemas, visited?: Set<string>): IDotnetType;
export declare function buildTypes(schemas: OpenAPI3Schemas): DotNetTypes;
