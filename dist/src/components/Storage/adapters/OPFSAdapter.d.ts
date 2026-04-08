export class OPFSAdapter extends StorageAdapter {
    /** @returns {Promise<FileSystemDirectoryHandle>} */
    _root(): Promise<FileSystemDirectoryHandle>;
    _bucketDir(bucketName: any, create?: boolean): Promise<FileSystemDirectoryHandle>;
    _metaFile(bucketName: any): Promise<FileSystemFileHandle>;
    _readMeta(bucketName: any): Promise<any>;
    _writeMeta(bucketName: any, meta: any): Promise<void>;
    createBucket(bucketName: any, options?: {}): Promise<{
        name: any;
        public: any;
    }>;
    deleteBucket(bucketName: any): Promise<void>;
    listBuckets(): Promise<{
        file_count: number;
        total_size: number;
        name: string;
        public: any;
    }[]>;
    _bucketStats(bucketName: any): Promise<{
        file_count: number;
        total_size: number;
    }>;
    upload(bucket: any, file: any, path: any, options?: {}): Promise<{
        path: any;
        bucket: any;
        url: string;
        mime_type: any;
        file_size: any;
    }>;
    download(bucket: any, path: any): Promise<File>;
    delete(bucket: any, path: any): Promise<void>;
    listFiles(bucket: any, prefix?: string): Promise<{
        name: any;
        path: string;
        bucket: any;
        mime_type: any;
        file_size: any;
        created_at: string;
        url: string;
    }[]>;
    /**
     * Für OPFS: Erstellt eine Object-URL aus dem Blob.
     * Diese URL gilt nur für die aktuelle Session.
     */
    getDisplayUrl(bucket: any, path: any): Promise<string>;
    _resolveFile(bucket: any, path: any): Promise<FileSystemFileHandle>;
}
import { StorageAdapter } from './StorageAdapter.js';
