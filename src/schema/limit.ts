export enum LimitedOperations {
  None = 0,
  Read = 1,
  Write = 2,
  Delete = 4,
  Invoke = 8,
  All = Read | Write | Delete | Invoke,
}

export interface ILimitedResource {
  id: string
  type: string
  displayName: string
  description: string
  operations: LimitedOperations
  logEnabled: boolean
}
