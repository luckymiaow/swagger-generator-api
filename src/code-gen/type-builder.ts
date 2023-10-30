import type { OpenAPI3Reference, OpenAPI3SchemaObject, OpenAPI3Schemas } from '../schema';
import type { DotNetTypes, IDotnetType, IDotnetTypeRef, IPropertyInfo, ITypeName } from './types';

function findLastSplitor(typeName: string, splitor: string): number {
  let pos = -1;
  let depth = 0;
  for (let i = typeName.length - 1; i >= 0 && pos == -1; i--) {
    const ch = typeName[i];
    switch (ch) {
      case '>':
      case ']':
        depth++;
        break;
      case '<':
      case '[':
        depth--;
        break;
      case splitor:
        if (depth == 0) {
          pos = i;
          break;
        }
    }
  }
  return pos;
}

function parseGenericArgumentTypeNames(genericArgsPart: string): ITypeName[] {
  const results = [];
  let depth = 0;
  let start = 0;
  let end = 0;
  for (const ch of genericArgsPart) {
    switch (ch) {
      case '<':
      case '[':
        depth++;
        break;
      case '>':
      case ']':
        depth--;
        break;
      case ',':
        if (depth == 0) {
          results.push(parseTypeName(genericArgsPart.substring(start, end)));
          start = end + 1;
        }
    }
    end++;
  }
  if (depth != 0)
    throw `invalid generic arguments parg: ${genericArgsPart}`;

  if (start < end - 1)
    results.push(parseTypeName(genericArgsPart.substring(start, end)));

  return results;
}

function parseTypeName(typeRef: string): ITypeName {
  const fullName = typeRef;
  const isGenericType = fullName.endsWith('>');
  let genericArguments: ITypeName[] | undefined;

  if (isGenericType) {
    const iGeneracArgsStart = fullName.indexOf('<');
    const genericArgsPart = fullName.substring(iGeneracArgsStart + 1, fullName.length - 1);
    genericArguments = parseGenericArgumentTypeNames(genericArgsPart);
  }

  const iLastDot = findLastSplitor(fullName, '.');

  let name: string, namespace: string, rootNamespace: string;
  if (iLastDot > -1) {
    namespace = fullName.substring(0, iLastDot);
    const iDot = namespace.indexOf('.');
    if (iDot == -1)
      rootNamespace = namespace;
    else
      rootNamespace = namespace.substring(0, iDot);

    name = fullName.substring(iLastDot + 1);
  }
  else {
    namespace = '';
    rootNamespace = '';
    name = fullName;
  }

  const iLE = name.indexOf('<');
  if (iLE > 0)
    name = name.substring(0, iLE);

  return {
    name,
    namespace,
    fullName,
    isGenericType,
    genericArguments,
  };
}

const buildingTypes = {
  string: {
    name: 'string',
    fullName: 'string',
    isBuildInType: true,
  },
};

export function buildTypeRef(
  schema: OpenAPI3SchemaObject,
  types: DotNetTypes,
  schemas?: OpenAPI3Schemas,
): IDotnetTypeRef {
  const typeRef = buildType(schema, types, schemas);
  const nullable = schema.nullable;
  return { typeRef, nullable };
}

export function buildType(
  obj: OpenAPI3SchemaObject | OpenAPI3Reference,
  types: DotNetTypes,
  schemas?: OpenAPI3Schemas,
): IDotnetType {
  if (obj) {
    if ('type' in obj) {
      const schema = obj as OpenAPI3SchemaObject;
      if (schema.builtType)
        return schema.builtType as IDotnetType;

      const res = {};
      schema.builtType = res;
      const isInterface = schema.isInterface;

      let isGenericType = schema.isGenericType;
      // eslint-disable-next-line prefer-const
      let isGenericTypeDefinition = schema.isGenericTypeDefinition;
      // eslint-disable-next-line prefer-const
      let isGenericParameter = schema.isGenericParameter;
      // eslint-disable-next-line prefer-const
      let comments = schema.description;
      // eslint-disable-next-line prefer-const
      let isEnum = schema.enum && schema.enum.length > 0;

      let enumValues = schema.enumValues;
      let properties: { [key: string]: IPropertyInfo } | undefined;
      let isArray;
      let name: string = schema.type!;
      let elementType, baseType, genericTypeDefinition;
      let genericArguments: IDotnetType[] | undefined;
      let isBuildInType = false;

      if (schema.type == 'object') {
        if (schema.properties) {
          properties = {};
          const propertySchemas = schema.properties;
          const requiredProperties = schema.required ?? [];
          for (const propertyName in propertySchemas) {
            const propertyDef = propertySchemas[propertyName] as OpenAPI3SchemaObject;
            const typeRef = buildType(propertyDef, types, schemas);
            let propertyNullable = propertyDef.nullable;
            if (requiredProperties.includes(propertyName))
              propertyNullable = false;

            properties[propertyName] = {
              propertyName,
              typeRef,
              nullable: propertyNullable,
              comments: propertyDef.description,
            };
          }
        }
        if (schema.allOf && schema.allOf.length == 1)
          baseType = buildType(schema.allOf[0], types, schemas);

        if (schema.isGenericType) {
          if (!schema.isGenericTypeDefinition) {
            if (schema.genericTypeDefinition) {
              genericTypeDefinition = buildType(schema.genericTypeDefinition, types, schemas);
              isBuildInType = genericTypeDefinition.isBuildInType;
              name = genericTypeDefinition.name;
            }
            else {
              if (schema.additionalProperties) {
                isBuildInType = true;
                name = 'Record';
              }
              else {
                throw `genericTypeDefinition lost: ${schema.type}`;
              }
            }
          }

          if (schema.genericArguments) {
            genericArguments = [];
            for (const arg of schema.genericArguments)
              genericArguments.push(buildType(arg, types, schemas));
          }
        }
        else if (schema.additionalProperties) {
          isBuildInType = true;
          name = 'Record';
          isGenericType = true;
          if (typeof schema.additionalProperties == 'boolean')
            genericArguments = [buildingTypes.string, buildingTypes.string];
          else
            genericArguments = [buildingTypes.string, buildType(schema.additionalProperties, types, schemas)];
        }
      }
      else if (schema.type) {
        switch (schema.type) {
          case 'array':
            isArray = true;
            elementType = buildType(schema.items!, types, schemas);
            name = `${elementType.name}[]`;
            break;
          case 'integer':
            name = 'number';
            break;
          case 'number':
            break;
          case 'boolean':
            break;
          case 'string':
            if (schema.format == 'date-time')
              name = 'Date';

            break;
        }

        if (schema.enum && !enumValues) {
          enumValues = [];
          if (typeof schema.enum![0] === 'string') {
            (schema.enum! as string[]).forEach((key, value) => {
              enumValues!.push({ key, value });
            });
          }
          else if (typeof schema.enum![0] === 'number') {
            (schema.enum as number[]).forEach((value, index) => {
              enumValues!.push({ key: `Item${index + 1}`, value });
            });
          }
        }

        isBuildInType = !isEnum;
      }
      else if (schema.allOf) {
        if (schema.allOf.length == 1)
          return buildType(schema.allOf[0], types, schemas);

        throw 'not supported.';
      }

      return Object.assign(res, {
        baseType,
        isBuildInType,
        name,
        fullName: name,
        namespace: '',
        properties,
        isEnum,
        enumValues,
        isArray,
        elementType,
        isInterface,
        isGenericType,
        isGenericTypeDefinition,
        isGenericParameter,
        genericTypeDefinition,
        genericArguments,
        comments,
      });
    }
    else if ('$ref' in obj) {
      const ref = obj.$ref as string;
      const refId = ref.substring(ref.lastIndexOf('/') + 1);
      if (refId in types)
        return types[refId];

      if (schemas) {
        const refSchema = schemas[refId];
        if (refSchema)
          return findOrBuildType(refId, refSchema, types, schemas);
      }
      throw `type ref not found: ${refId}`;
    }
    else if ('allOf' in obj) {
      const allOf = obj.allOf;
      if (allOf && allOf.length == 1)
        return buildType(allOf[0], types, schemas);

      throw 'not support';
    }
    else if ('anyOf' in obj) {
      throw `not impletemented: \n${+JSON.stringify(obj, null, 2)}`;
    }
    else if ('oneOf' in obj) {
      throw `not impletemented: \n${JSON.stringify(obj, null, 2)}`;
    }
  }

  return {
    name: 'any',
    fullName: 'any',
    isBuildInType: true,
  };
  // throw 'not supported: \n' + JSON.stringify(obj, null, 2);
}

export function findOrBuildType(
  typeRef: string,
  obj: OpenAPI3SchemaObject | OpenAPI3Reference,
  types: DotNetTypes,
  schemas?: OpenAPI3Schemas,
): IDotnetType {
  if (typeRef in types)
    return types[typeRef];

  const tyepName = parseTypeName(typeRef);
  const builtType = buildType(obj, types, schemas);

  // if (tyepName.fullName != builtType.fullName) {
  //   console.log('not eq', tyepName.fullName, builtType.fullName);
  // }

  return Object.assign(builtType, {
    name: tyepName.name,
    fullName: tyepName.fullName,
    namespace: tyepName.namespace,
  });
  // return { ...tyepName };
}

export function buildTypes(schemas: OpenAPI3Schemas): DotNetTypes {
  const types: { [key: string]: IDotnetType } = {};
  for (const typeRef in schemas) {
    const obj = schemas[typeRef];
    types[typeRef] = findOrBuildType(typeRef, obj, types, schemas);
  }
  return types;
}
