/**
 * S3 Mock Factory
 * Comprehensive mocking for S3 operations with realistic response patterns
 */

export interface S3MockConfig {
  bucketName?: string;
  region?: string;
  enableVersioning?: boolean;
  latencyMs?: number;
}

export class S3MockFactory {
  private mockClient: any;
  private config: S3MockConfig;
  private storage: Map<string, Buffer> = new Map();

  constructor(config: S3MockConfig = {}) {
    this.config = {
      bucketName: 'test-bucket',
      region: 'us-east-1',
      enableVersioning: false,
      latencyMs: 0,
      ...config
    };
    this.mockClient = { send: jest.fn() };
  }

  // Upload Operations
  mockPutObject(options: {
    key?: string;
    etag?: string;
    versionId?: string;
    serverSideEncryption?: string;
  } = {}) {
    const response = {
      ETag: options.etag || `"${this.generateETag()}"`,
      VersionId: this.config.enableVersioning ? (options.versionId || this.generateVersionId()) : undefined,
      ServerSideEncryption: options.serverSideEncryption || 'AES256',
      Location: `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${options.key || 'test-key'}`,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockPutObjectError(errorCode: string, message: string) {
    this.mockClient.send.mockRejectedValueOnce(
      this.createS3Error(errorCode, message)
    );
    return this;
  }

  // Download Operations
  mockGetObject(content: string | Buffer, options: {
    contentType?: string;
    metadata?: Record<string, string>;
    versionId?: string;
  } = {}) {
    const buffer = content instanceof Buffer ? content : Buffer.from(content);
    
    const response = {
      Body: {
        transformToString: async () => buffer.toString('utf-8'),
        transformToByteArray: async () => new Uint8Array(buffer),
        transformToWebStream: () => new ReadableStream()
      },
      ContentType: options.contentType || 'application/octet-stream',
      ContentLength: buffer.length,
      ETag: `"${this.generateETag()}"`,
      LastModified: new Date(),
      Metadata: options.metadata || {},
      VersionId: options.versionId,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockGetObjectNotFound() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createS3Error('NoSuchKey', 'The specified key does not exist', 404)
    );
    return this;
  }

  mockGetObjectAccessDenied() {
    this.mockClient.send.mockRejectedValueOnce(
      this.createS3Error('AccessDenied', 'Access Denied', 403)
    );
    return this;
  }

  // Delete Operations
  mockDeleteObject(options: {
    versionId?: string;
    deleteMarker?: boolean;
  } = {}) {
    const response: any = {
      DeleteMarker: options.deleteMarker || false,
      VersionId: options.versionId,
      $metadata: {
        httpStatusCode: 204,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockDeleteObjects(deleted: string[], errors: Array<{ key: string; code: string }> = []) {
    const response = {
      Deleted: deleted.map(key => ({
        Key: key,
        VersionId: this.config.enableVersioning ? this.generateVersionId() : undefined
      })),
      Errors: errors.map(err => ({
        Key: err.key,
        Code: err.code,
        Message: `Error deleting ${err.key}`
      })),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // List Operations
  mockListObjectsV2(objects: Array<{ key: string; size: number; lastModified?: Date }>, options: {
    continuationToken?: string;
    isTruncated?: boolean;
    prefix?: string;
  } = {}) {
    const response = {
      Contents: objects.map(obj => ({
        Key: obj.key,
        Size: obj.size,
        LastModified: obj.lastModified || new Date(),
        ETag: `"${this.generateETag()}"`,
        StorageClass: 'STANDARD'
      })),
      IsTruncated: options.isTruncated || false,
      ContinuationToken: options.continuationToken,
      NextContinuationToken: options.isTruncated ? this.generateToken() : undefined,
      KeyCount: objects.length,
      MaxKeys: 1000,
      Prefix: options.prefix || '',
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockListObjectsEmpty() {
    return this.mockListObjectsV2([]);
  }

  // Head Operations
  mockHeadObject(options: {
    size?: number;
    contentType?: string;
    metadata?: Record<string, string>;
    exists?: boolean;
  } = {}) {
    if (options.exists === false) {
      this.mockClient.send.mockRejectedValueOnce(
        this.createS3Error('NotFound', 'Not Found', 404)
      );
      return this;
    }

    const response = {
      ContentLength: options.size || 1024,
      ContentType: options.contentType || 'application/octet-stream',
      ETag: `"${this.generateETag()}"`,
      LastModified: new Date(),
      Metadata: options.metadata || {},
      VersionId: this.config.enableVersioning ? this.generateVersionId() : undefined,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Copy Operations
  mockCopyObject(options: {
    sourceKey: string;
    destinationKey: string;
    versionId?: string;
  }) {
    const response = {
      CopyObjectResult: {
        ETag: `"${this.generateETag()}"`,
        LastModified: new Date()
      },
      VersionId: this.config.enableVersioning ? this.generateVersionId() : undefined,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Presigned URL Operations
  mockGetSignedUrl(url: string, expiresIn = 3600) {
    // Note: This mocks the getSignedUrl function, not a client.send call
    return {
      url,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000)
    };
  }

  mockPresignedPost(fields: Record<string, string> = {}) {
    return {
      url: `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/`,
      fields: {
        key: 'test-key',
        bucket: this.config.bucketName,
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': 'AKIAIOSFODNN7EXAMPLE/20231201/us-east-1/s3/aws4_request',
        'X-Amz-Date': '20231201T000000Z',
        Policy: 'base64-encoded-policy',
        'X-Amz-Signature': 'signature',
        ...fields
      }
    };
  }

  // Multipart Upload Operations
  mockCreateMultipartUpload(uploadId?: string) {
    const response = {
      UploadId: uploadId || this.generateUploadId(),
      Bucket: this.config.bucketName,
      Key: 'test-key',
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockUploadPart(partNumber: number, etag?: string) {
    const response = {
      ETag: etag || `"${this.generateETag()}"`,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockCompleteMultipartUpload(options: {
    location?: string;
    etag?: string;
    versionId?: string;
  } = {}) {
    const response = {
      Location: options.location || `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/test-key`,
      Bucket: this.config.bucketName,
      Key: 'test-key',
      ETag: options.etag || `"${this.generateETag()}"`,
      VersionId: options.versionId || (this.config.enableVersioning ? this.generateVersionId() : undefined),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockAbortMultipartUpload() {
    const response = {
      $metadata: {
        httpStatusCode: 204,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockListParts(parts: Array<{ partNumber: number; size: number; etag?: string }>) {
    const response = {
      Parts: parts.map(part => ({
        PartNumber: part.partNumber,
        Size: part.size,
        ETag: part.etag || `"${this.generateETag()}"`,
        LastModified: new Date()
      })),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.addLatency();
    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Bucket Operations
  mockHeadBucket(exists = true) {
    if (exists) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createS3Error('NoSuchBucket', 'The specified bucket does not exist', 404)
      );
    }
    return this;
  }

  // Utility Methods
  getClient() {
    return this.mockClient;
  }

  reset() {
    this.mockClient.send.mockReset();
    this.storage.clear();
    return this;
  }

  getCallCount() {
    return this.mockClient.send.mock.calls.length;
  }

  // Helper Methods
  private createS3Error(code: string, message: string, statusCode = 400) {
    const error = new Error(message);
    (error as any).name = code;
    (error as any).code = code;
    (error as any).$metadata = {
      httpStatusCode: statusCode,
      requestId: this.generateRequestId()
    };
    return error;
  }

  private generateRequestId() {
    return `mock-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateETag() {
    return Math.random().toString(36).substr(2, 32);
  }

  private generateVersionId() {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUploadId() {
    return `upload-${Date.now()}-${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateToken() {
    return Buffer.from(`token-${Date.now()}`).toString('base64');
  }

  private addLatency() {
    if (this.config.latencyMs && this.config.latencyMs > 0) {
      // Marker for latency simulation
    }
  }

  // Realistic Scenario Builders
  mockRealisticUpload(key: string, size: number) {
    this.config.latencyMs = Math.min(100 + size / 10000, 5000); // Scale with size
    return this.mockPutObject({ key });
  }

  mockRealisticDownload(content: string | Buffer) {
    const size = content instanceof Buffer ? content.length : Buffer.from(content).length;
    this.config.latencyMs = Math.min(50 + size / 20000, 3000);
    return this.mockGetObject(content);
  }

  mockRealisticMultipartUpload(partCount: number) {
    const uploadId = this.generateUploadId();
    
    // Create multipart upload
    this.mockCreateMultipartUpload(uploadId);
    
    // Upload parts
    for (let i = 1; i <= partCount; i++) {
      this.mockUploadPart(i);
    }
    
    // Complete upload
    this.mockCompleteMultipartUpload();
    
    return this;
  }
}

// Export convenience function
export const createS3Mock = (config?: S3MockConfig) => {
  return new S3MockFactory(config);
};
