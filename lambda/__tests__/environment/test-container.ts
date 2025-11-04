/**
 * Test Environment Container
 * Provides isolated test environment with containerized dependencies
 */

export interface ContainerConfig {
  dynamodb?: {
    enabled: boolean;
    port?: number;
    region?: string;
  };
  s3?: {
    enabled: boolean;
    port?: number;
    region?: string;
  };
  redis?: {
    enabled: boolean;
    port?: number;
  };
  postgres?: {
    enabled: boolean;
    port?: number;
    database?: string;
  };
}

export class TestContainer {
  private config: ContainerConfig;
  private originalEnv: Record<string, string | undefined> = {};
  private services: Map<string, any> = new Map();
  private isSetup = false;

  constructor(config: ContainerConfig = {}) {
    this.config = {
      dynamodb: { enabled: false, port: 8000, region: 'us-east-1', ...config.dynamodb },
      s3: { enabled: false, port: 4566, region: 'us-east-1', ...config.s3 },
      redis: { enabled: false, port: 6379, ...config.redis },
      postgres: { enabled: false, port: 5432, database: 'test_db', ...config.postgres }
    };
  }

  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    // Store original environment
    this.originalEnv = { ...process.env };

    // Setup enabled services
    if (this.config.dynamodb?.enabled) {
      await this.setupDynamoDB();
    }

    if (this.config.s3?.enabled) {
      await this.setupS3();
    }

    if (this.config.redis?.enabled) {
      await this.setupRedis();
    }

    if (this.config.postgres?.enabled) {
      await this.setupPostgres();
    }

    this.isSetup = true;
  }

  async teardown(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    // Cleanup services
    for (const [name, service] of this.services.entries()) {
      try {
        if (service.stop) {
          await service.stop();
        }
      } catch (error) {
        console.error(`Error stopping service ${name}:`, error);
      }
    }

    // Restore environment
    Object.keys(process.env).forEach(key => {
      delete process.env[key];
    });
    Object.assign(process.env, this.originalEnv);

    this.services.clear();
    this.isSetup = false;
  }

  private async setupDynamoDB(): Promise<void> {
    const { port, region } = this.config.dynamodb!;

    // Set environment variables for DynamoDB Local
    process.env.AWS_REGION = region;
    process.env.DYNAMODB_ENDPOINT = `http://localhost:${port}`;
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';

    // Note: In real implementation, you would start DynamoDB Local container
    // For now, we just configure the environment
    this.services.set('dynamodb', {
      endpoint: `http://localhost:${port}`,
      region
    });
  }

  private async setupS3(): Promise<void> {
    const { port, region } = this.config.s3!;

    // Set environment variables for LocalStack S3
    process.env.AWS_REGION = region;
    process.env.S3_ENDPOINT = `http://localhost:${port}`;
    process.env.AWS_ACCESS_KEY_ID = 'test';
    process.env.AWS_SECRET_ACCESS_KEY = 'test';

    this.services.set('s3', {
      endpoint: `http://localhost:${port}`,
      region
    });
  }

  private async setupRedis(): Promise<void> {
    const { port } = this.config.redis!;

    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = port!.toString();

    this.services.set('redis', {
      host: 'localhost',
      port
    });
  }

  private async setupPostgres(): Promise<void> {
    const { port, database } = this.config.postgres!;

    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = port!.toString();
    process.env.POSTGRES_DB = database;
    process.env.POSTGRES_USER = 'test';
    process.env.POSTGRES_PASSWORD = 'test';

    this.services.set('postgres', {
      host: 'localhost',
      port,
      database
    });
  }

  getService(name: string): any {
    return this.services.get(name);
  }

  isServiceEnabled(name: string): boolean {
    return this.services.has(name);
  }

  async resetData(): Promise<void> {
    // Reset data in all services
    for (const [name, service] of this.services.entries()) {
      try {
        if (name === 'dynamodb') {
          await this.resetDynamoDB();
        } else if (name === 's3') {
          await this.resetS3();
        } else if (name === 'redis') {
          await this.resetRedis();
        } else if (name === 'postgres') {
          await this.resetPostgres();
        }
      } catch (error) {
        console.error(`Error resetting ${name}:`, error);
      }
    }
  }

  private async resetDynamoDB(): Promise<void> {
    // In real implementation, delete all tables or clear data
    // For now, this is a placeholder
  }

  private async resetS3(): Promise<void> {
    // In real implementation, delete all buckets and objects
    // For now, this is a placeholder
  }

  private async resetRedis(): Promise<void> {
    // In real implementation, flush all Redis data
    // For now, this is a placeholder
  }

  private async resetPostgres(): Promise<void> {
    // In real implementation, truncate all tables
    // For now, this is a placeholder
  }
}

// Global container instance for test suites
let globalContainer: TestContainer | null = null;

export const setupGlobalContainer = async (config?: ContainerConfig): Promise<TestContainer> => {
  if (!globalContainer) {
    globalContainer = new TestContainer(config);
    await globalContainer.setup();
  }
  return globalContainer;
};

export const teardownGlobalContainer = async (): Promise<void> => {
  if (globalContainer) {
    await globalContainer.teardown();
    globalContainer = null;
  }
};

export const getGlobalContainer = (): TestContainer | null => {
  return globalContainer;
};

// Jest setup helpers
export const setupContainerForJest = (config?: ContainerConfig) => {
  beforeAll(async () => {
    await setupGlobalContainer(config);
  });

  afterAll(async () => {
    await teardownGlobalContainer();
  });

  beforeEach(async () => {
    const container = getGlobalContainer();
    if (container) {
      await container.resetData();
    }
  });
};
