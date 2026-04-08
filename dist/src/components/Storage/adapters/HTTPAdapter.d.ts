export class HTTPAdapter extends StorageAdapter {
    /**
     * @param {object} options
     * @param {string}  options.baseUrl   - Basis-URL des Storage-Servers
     * @param {string}  [options.apiKey]  - Optional: API-Key für Auth
     * @param {number}  [options.timeout] - Request-Timeout in ms (Standard: 30s)
     */
    constructor({ baseUrl, apiKey, timeout }: {
        baseUrl: string;
        apiKey?: string;
        timeout?: number;
    });
    _base: string;
    _apiKey: string;
    _timeout: number;
    _headers(extra?: {}): {};
    _fetch(path: any, options?: {}): Promise<Response>;
    createBucket(bucketName: any, options?: {}): Promise<{
        name: any;
        public: any;
    }>;
    deleteBucket(bucketName: any): Promise<void>;
    listBuckets(): Promise<any>;
    upload(bucket: any, file: any, filePath: any, options?: {}): Promise<any>;
    download(bucket: any, filePath: any): Promise<Blob>;
    delete(bucket: any, filePath: any): Promise<void>;
    listFiles(bucket: any, prefix?: string): Promise<any>;
    /**
     * Für HTTP: direkte öffentliche URL.
     * Bei privaten Buckets sollte der Server hier Signed URLs zurückgeben.
     */
    getDisplayUrl(bucket: any, filePath: any): Promise<string>;
}
import { StorageAdapter } from './StorageAdapter.js';
