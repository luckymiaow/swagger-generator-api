import type { ILimitedResource } from '../schema/limit';

export * from '../schema/limit';

export interface ITypeName {
  readonly name: string
  readonly fullName: string
  readonly namespace?: string
  readonly isGenericType?: boolean
  readonly genericArguments?: ITypeName[]
}

export interface IDotnetType {
  readonly name: string

  readonly fullName: string
  readonly namespace?: string

  readonly baseType?: IDotnetType

  readonly isBuildInType: boolean
  readonly isEnum?: boolean
  readonly enumValues?: { key: string; value: number }[]
  readonly enum?: string[] | number[]

  readonly isArray?: boolean
  readonly elementType?: IDotnetType

  readonly isGenericType?: boolean
  readonly isInterface?: boolean
  readonly isGenericTypeDefinition?: boolean
  readonly isGenericParameter?: boolean
  readonly genericTypeDefinition?: IDotnetType
  readonly genericArguments?: IDotnetType[]
  readonly properties?: { [key: string]: IPropertyInfo }
  readonly comments?: string

}

export interface IDotnetTypeRef {
  readonly nullable?: boolean
  readonly typeRef: IDotnetType
  readonly comments?: string
}

export interface IPropertyInfo extends IDotnetTypeRef {
  readonly propertyName: string
  readonly mate?: any // 原始数据

}

export interface DotNetTypes { [key: string]: IDotnetType }

export enum HttpStatusCodes {
  Continue = 100,
  SwitchingProtocols = 101,
  Processing = 102,
  OK = 200,
  Created = 201,
  Accepted = 202,
  NonAuthoritative = 203,
  NoContent = 204,
  ResetContent = 205,
  PartialContent = 206,
  MultiStatus = 207,
  AlreadyReported = 208,
  IMUsed = 226,
  MultipleChoices = 300,
  MovedPermanently = 301,
  Found = 302,
  SeeOther = 303,
  NotModified = 304,
  UseProxy = 305,
  SwitchProxy = 306,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Conflict = 409,
  Gone = 410,
  LengthRequired = 411,
  PreconditionFailed = 412,
  RequestEntityTooLarge = 413,
  PayloadTooLarge = 413,
  RequestUriTooLong = 414,
  UriTooLong = 414,
  UnsupportedMediaType = 415,
  RequestedRangeNotSatisfiable = 416,
  RangeNotSatisfiable = 416,
  ExpectationFailed = 417,
  ImATeapot = 418,
  AuthenticationTimeout = 419,
  MisdirectedRequest = 421,
  UnprocessableEntity = 422,
  Locked = 423,
  FailedDependency = 424,
  UpgradeRequired = 426,
  PreconditionRequired = 428,
  TooManyRequests = 429,
  RequestHeaderFieldsTooLarge = 431,
  UnavailableForLegalReasons = 451,
  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
  HttpVersionNotsupported = 505,
  VariantAlsoNegotiates = 506,
  InsufficientStorage = 507,
  LoopDetected = 508,
  NotExtended = 510,
  NetworkAuthenticationRequired = 511,
}

export interface IApiParameter {
  name: string
  description?: string
  required?: boolean
  in: 'query' | 'header' | 'path' | 'cookie'
  type: IDotnetType
}

export interface IAipContent {
  [contentType: string]: IDotnetTypeRef
}

export interface IApiBody {
  description?: string
  content?: IAipContent
}

export interface IApiOperation {
  path: string
  method: string
  summary?: string
  description?: string
  parameters?: IApiParameter[]
  requestBody?: IApiBody
  responseBody?: IApiBody
  auth?: ILimitedResource
}
