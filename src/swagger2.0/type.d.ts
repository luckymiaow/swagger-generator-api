/*
 * @Description:
 * @Author: luckymiaow
 * @Date: 2023-09-11 17:10:13
 * @LastEditors: luckymiaow
 */

import { HttpMethod } from "../../types"

export interface Swagger2 {
  swagger: string
  info: any
  host: string
  basePath: string
  tags: Tag[]
  paths: Record<string,Record<HttpMethod,Paths>>
  definitions: Definitions
}

export type Paths = {
  tags: string[]
  summary: string
  operationId: string
  consumes: string[]
  produces: string[]
  parameters: Parameters[]
  responses: Responses
  deprecated: boolean
}



export interface Tag {
  tags: string[]
  summary: string
  operationId: string
  produces: string[]
  responses: Responses
  type: string
  path: string
  parameters: Parameters[]
}

interface Responses {
  '200': Parameters
}

export interface Parameters extends Propertie {
  name: string
  'x-nullable': boolean
  description: string
  schema: Propertie
  required: boolean
  in: 'body' | 'query' | 'path'
}

export type Definitions = Record<string, Definition>

interface Definition {
  title: string;
  type: string
  required:boolean
  description: string
  properties: Properties
}

export type Properties = Record<string, Propertie>

export interface Propertie {
  type: 'integer' | 'string' | 'array' | 'boolean' | 'object' | 'file'
  description: string
  minLength: number
  '$ref': string
  items: Propertie
  schema?: Propertie

}
