export class NodeAdapter {
    constructor({ basePath }: {
        basePath: any;
    });
    basePath: any;
    type: string;
    _api: any;
    /**
     * Initialisiert den Adapter und erstellt den Basis-Pfad wenn nötig
     */
    initialize(): Promise<void>;
    createBucket(name: any): Promise<void>;
    deleteBucket(name: any): Promise<void>;
    listBuckets(): Promise<any>;
    upload(bucket: any, file: any, filePath: any): Promise<{
        url: string;
        path: any;
        bucket: any;
        file_size: any;
        mime_type: any;
    }>;
    download(bucket: any, filePath: any): Promise<Blob>;
    delete(bucket: any, filePath: any): Promise<void>;
    listFiles(bucket: any, prefix?: string): Promise<any[]>;
    getDisplayUrl(bucket: any, filePath: any): Promise<string>;
}
