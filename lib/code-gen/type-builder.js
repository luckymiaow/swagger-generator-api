"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTypes = exports.findOrBuildType = exports.buildType = exports.buildTypeRef = void 0;
function findLastSplitor(typeName, splitor) {
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
function parseGenericArgumentTypeNames(genericArgsPart) {
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
function parseTypeName(typeRef) {
    const fullName = typeRef;
    const isGenericType = fullName.endsWith('>');
    let genericArguments;
    if (isGenericType) {
        const iGeneracArgsStart = fullName.indexOf('<');
        const genericArgsPart = fullName.substring(iGeneracArgsStart + 1, fullName.length - 1);
        genericArguments = parseGenericArgumentTypeNames(genericArgsPart);
    }
    const iLastDot = findLastSplitor(fullName, '.');
    let name, namespace, rootNamespace;
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
function buildTypeRef(schema, types, schemas) {
    const typeRef = buildType(schema, types, schemas);
    const nullable = schema.nullable;
    return { typeRef, nullable };
}
exports.buildTypeRef = buildTypeRef;
function buildType(obj, types, schemas, visited = new Set()) {
    if (!obj)
        return { name: 'any', fullName: 'any', isBuildInType: true };
    if ('$ref' in obj) {
        const ref = obj.$ref;
        if (visited.has(ref))
            return { name: 'any', fullName: 'any', isBuildInType: true }; // 防止无限递归
        visited.add(ref);
    }
    if ('type' in obj) {
        const schema = obj;
        if (schema.builtType)
            return schema.builtType;
        const res = {};
        schema.builtType = res;
        const isInterface = schema.isInterface;
        let isGenericType = schema.isGenericType;
        const isGenericTypeDefinition = schema.isGenericTypeDefinition;
        const isGenericParameter = schema.isGenericParameter;
        const comments = schema.description;
        const isEnum = schema.enum && schema.enum.length > 0;
        let enumValues = schema.enumValues;
        let properties;
        let isArray;
        let name = schema.type;
        let elementType, baseType, genericTypeDefinition;
        let genericArguments;
        let isBuildInType = false;
        if (schema.type === 'object') {
            if (schema.properties) {
                properties = {};
                const propertySchemas = schema.properties;
                const requiredProperties = schema.required ?? [];
                for (const propertyName in propertySchemas) {
                    const propertyDef = propertySchemas[propertyName];
                    const typeRef = buildType(propertyDef, types, schemas, visited);
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
            if (schema.allOf && schema.allOf.length === 1)
                baseType = buildType(schema.allOf[0], types, schemas, visited);
            if (schema.isGenericType) {
                if (!schema.isGenericTypeDefinition) {
                    if (schema.genericTypeDefinition) {
                        genericTypeDefinition = buildType(schema.genericTypeDefinition, types, schemas, visited);
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
                        genericArguments.push(buildType(arg, types, schemas, visited));
                }
            }
            else if (schema.additionalProperties) {
                isBuildInType = true;
                name = 'Record';
                isGenericType = true;
                if (typeof schema.additionalProperties === 'boolean')
                    genericArguments = [buildingTypes.string, buildingTypes.string];
                else
                    genericArguments = [buildingTypes.string, buildType(schema.additionalProperties, types, schemas, visited)];
            }
        }
        else if (schema.type) {
            switch (schema.type) {
                case 'array':
                    isArray = true;
                    elementType = buildType(schema.items, types, schemas, visited);
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
                    if (schema.format === 'date-time')
                        name = 'Date';
                    break;
            }
            if (schema.enum && !enumValues) {
                enumValues = [];
                if (typeof schema.enum[0] === 'string') {
                    schema.enum.forEach((key, value) => {
                        enumValues.push({ key, value });
                    });
                }
                else if (typeof schema.enum[0] === 'number') {
                    schema.enum.forEach((value, index) => {
                        enumValues.push({ key: `Item${index + 1}`, value });
                    });
                }
            }
            isBuildInType = !isEnum;
        }
        else if (schema.allOf) {
            if (schema.allOf.length === 1)
                return buildType(schema.allOf[0], types, schemas, visited);
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
        const ref = obj.$ref;
        const refId = ref.substring(ref.lastIndexOf('/') + 1);
        if (refId in types)
            return types[refId];
        if (schemas) {
            const refSchema = schemas[refId];
            if (refSchema)
                return findOrBuildType(refId, refSchema, types, schemas, visited);
        }
        throw `type ref not found: ${refId}`;
    }
    if ('$ref' in obj)
        visited.delete(obj.$ref); // 检查并移除标记
    return { name: 'any', fullName: 'any', isBuildInType: true };
}
exports.buildType = buildType;
function findOrBuildType(typeRef, obj, types, schemas, visited = new Set()) {
    if (typeRef in types)
        return types[typeRef];
    const tyepName = parseTypeName(typeRef);
    const builtType = buildType(obj, types, schemas, visited);
    return Object.assign(builtType, {
        name: tyepName.name,
        fullName: tyepName.fullName,
        namespace: tyepName.namespace,
    });
}
exports.findOrBuildType = findOrBuildType;
function buildTypes(schemas) {
    const types = {};
    for (const typeRef in schemas) {
        const obj = schemas[typeRef];
        types[typeRef] = findOrBuildType(typeRef, obj, types, schemas);
    }
    return types;
}
exports.buildTypes = buildTypes;
