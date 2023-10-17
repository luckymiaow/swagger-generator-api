export declare enum LimitedOperations {
    None = 0,
    Read = 1,
    Write = 2,
    Delete = 4,
    Invoke = 8,
    All = 15
}
export interface ILimitedResource {
    id: string;
    type: string;
    displayName: string;
    description: string;
    operations: LimitedOperations;
    logEnabled: boolean;
}
