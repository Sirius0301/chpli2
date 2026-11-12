import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { storageConfig } from '../env';

export interface StoredObject {
  stream: NodeJS.ReadableStream;
  size: number;
  mimeType: string;
}

/**
 * MinIO (S3-compatible) object storage for memo image bodies (M3 D1).
 * The database never holds file contents — only metadata and storage keys.
 * A missing/unreachable store must not block API startup (E62): bucket
 * creation is best-effort on init and every operation maps connection
 * failures to a domain error the service layer turns into 503.
 */
@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly client: Client;
  private readonly bucket: string;
  private ensured = false;

  constructor() {
    const config = storageConfig();
    const url = new URL(config.endpoint);
    this.client = new Client({
      endPoint: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
      useSSL: url.protocol === 'https:',
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      region: config.region,
    });
    this.bucket = config.bucket;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.warn(
        `object storage unavailable at startup (${(error as Error).message}); uploads/downloads will answer 503 until it recovers`,
      );
    }
  }

  private async ensureBucket(): Promise<void> {
    if (this.ensured) return;
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) await this.client.makeBucket(this.bucket, storageConfig().region);
    this.ensured = true;
  }

  async put(key: string, body: Buffer, mimeType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.putObject(this.bucket, key, body, body.length, {
      'Content-Type': mimeType,
    });
  }

  async get(key: string): Promise<StoredObject> {
    await this.ensureBucket();
    const stat = await this.client.statObject(this.bucket, key);
    const stream = await this.client.getObject(this.bucket, key);
    return { stream, size: stat.size, mimeType: stat.metaData['content-type'] ?? 'application/octet-stream' };
  }

  /** Best-effort removal; throws on connection failure, callers decide. */
  async remove(key: string): Promise<void> {
    await this.ensureBucket();
    await this.client.removeObject(this.bucket, key);
  }
}
