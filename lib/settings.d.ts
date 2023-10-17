export declare function resolveFilePath(name: string): string;
export interface ISettings {
    url: string;
    outputPath: string;
    description?: boolean;
    optionId: 'id' | 'identifier';
}
export declare const defaultSettings: ISettings[];
export declare function loadSettingsAsync(): Promise<ISettings[]>;
