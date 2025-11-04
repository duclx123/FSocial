/**
 * AWS Services Integration Tests
 * Tests for AWS Certificate Manager, Route 53, and X-Ray
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { 
  ACMClient, 
  DescribeCertificateCommand,
  ListCertificatesCommand 
} from '@aws-sdk/client-acm';
import { 
  Route53Client,
  GetHostedZoneCommand,
  ListResourceRecordSetsCommand 
} from '@aws-sdk/client-route-53';
import * as AWSXRay from 'aws-xray-sdk-core';
import { tracer, captureAWS } from '../../shared/monitoring/tracer';

// Mock AWS clients
const acmMock = mockClient(ACMClient);
const route53Mock = mockClient(Route53Client);

// Mock X-Ray
vi.mock('aws-xray-sdk-core', () => ({
  captureAWSv3Client: vi.fn((client) => client),
  captureAsyncFunc: vi.fn((name, fn) => fn()),
  getSegment: vi.fn(() => ({
    addAnnotation: vi.fn(),
    addMetadata: vi.fn(),
    setUser: vi.fn(),
    trace_id: 'mock-trace-id'
  }))
}));

describe('AWS Certificate Manager (ACM)', () => {
  beforeEach(() => {
    acmMock.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Certificate Operations', () => {
    it('should describe certificate successfully', async () => {
      const mockCertificate = {
        CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
        DomainName: 'api.smartcooking.com',
        Status: 'ISSUED',
        SubjectAlternativeNames: ['*.smartcooking.com', 'smartcooking.com'],
        DomainValidationOptions: [{
          DomainName: 'api.smartcooking.com',
          ValidationStatus: 'SUCCESS'
        }]
      };

      acmMock.on(DescribeCertificateCommand).resolves({
        Certificate: mockCertificate
      });

      const acmClient = new ACMClient({ region: 'us-east-1' });
      const result = await acmClient.send(new DescribeCertificateCommand({
        CertificateArn: mockCertificate.CertificateArn
      }));

      expect(result.Certificate).toEqual(mockCertificate);
      expect(result.Certificate?.Status).toBe('ISSUED');
    });

    it('should list certificates with filtering', async () => {
      const mockCertificates = [
        {
          CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
          DomainName: 'api.smartcooking.com',
          Status: 'ISSUED'
        },
        {
          CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/87654321-4321-4321-4321-210987654321',
          DomainName: 'dev-api.smartcooking.com',
          Status: 'ISSUED'
        }
      ];

      acmMock.on(ListCertificatesCommand).resolves({
        CertificateSummaryList: mockCertificates
      });

      const acmClient = new ACMClient({ region: 'us-east-1' });
      const result = await acmClient.send(new ListCertificatesCommand({
        CertificateStatuses: ['ISSUED']
      }));

      expect(result.CertificateSummaryList).toHaveLength(2);
      expect(result.CertificateSummaryList?.[0].Status).toBe('ISSUED');
    });

    it('should handle certificate validation errors', async () => {
      acmMock.on(DescribeCertificateCommand).rejects(
        new Error('Certificate not found')
      );

      const acmClient = new ACMClient({ region: 'us-east-1' });
      
      await expect(
        acmClient.send(new DescribeCertificateCommand({
          CertificateArn: 'invalid-arn'
        }))
      ).rejects.toThrow('Certificate not found');
    });
  });

  describe('Certificate Integration with X-Ray', () => {
    it('should trace ACM operations', async () => {
      const mockCertificate = {
        CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/12345678-1234-1234-1234-123456789012',
        Status: 'ISSUED'
      };

      acmMock.on(DescribeCertificateCommand).resolves({
        Certificate: mockCertificate
      });

      const acmClient = captureAWS(new ACMClient({ region: 'us-east-1' }));
      
      await tracer.captureAwsCall(
        'ACM',
        'DescribeCertificate',
        async () => {
          return acmClient.send(new DescribeCertificateCommand({
            CertificateArn: mockCertificate.CertificateArn
          }));
        },
        { certificateArn: mockCertificate.CertificateArn }
      );

      expect(AWSXRay.captureAWSv3Client).toHaveBeenCalledWith(expect.any(ACMClient));
    });
  });
});

describe('Route 53 DNS', () => {
  beforeEach(() => {
    route53Mock.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hosted Zone Operations', () => {
    it('should get hosted zone details', async () => {
      const mockHostedZone = {
        HostedZone: {
          Id: '/hostedzone/Z123456789012',
          Name: 'smartcooking.com.',
          CallerReference: 'test-ref',
          ResourceRecordSetCount: 10
        }
      };

      route53Mock.on(GetHostedZoneCommand).resolves(mockHostedZone);

      const route53Client = new Route53Client({ region: 'us-east-1' });
      const result = await route53Client.send(new GetHostedZoneCommand({
        Id: 'Z123456789012'
      }));

      expect(result.HostedZone?.Name).toBe('smartcooking.com.');
      expect(result.HostedZone?.ResourceRecordSetCount).toBe(10);
    });

    it('should list DNS records', async () => {
      const mockRecords = {
        ResourceRecordSets: [
          {
            Name: 'api.smartcooking.com.',
            Type: 'A',
            AliasTarget: {
              DNSName: 'd-123456789.execute-api.us-east-1.amazonaws.com',
              EvaluateTargetHealth: false,
              HostedZoneId: 'Z1UJRXOUMOOFQ8'
            }
          },
          {
            Name: 'smartcooking.com.',
            Type: 'NS',
            TTL: 172800,
            ResourceRecords: [
              { Value: 'ns-123.awsdns-12.com.' }
            ]
          }
        ]
      };

      route53Mock.on(ListResourceRecordSetsCommand).resolves(mockRecords);

      const route53Client = new Route53Client({ region: 'us-east-1' });
      const result = await route53Client.send(new ListResourceRecordSetsCommand({
        HostedZoneId: 'Z123456789012'
      }));

      expect(result.ResourceRecordSets).toHaveLength(2);
      expect(result.ResourceRecordSets?.[0].Type).toBe('A');
      expect(result.ResourceRecordSets?.[1].Type).toBe('NS');
    });

    it('should handle DNS resolution errors', async () => {
      route53Mock.on(GetHostedZoneCommand).rejects(
        new Error('Hosted zone not found')
      );

      const route53Client = new Route53Client({ region: 'us-east-1' });
      
      await expect(
        route53Client.send(new GetHostedZoneCommand({
          Id: 'invalid-zone-id'
        }))
      ).rejects.toThrow('Hosted zone not found');
    });
  });

  describe('Route 53 Integration with X-Ray', () => {
    it('should trace DNS operations', async () => {
      const mockHostedZone = {
        HostedZone: {
          Id: '/hostedzone/Z123456789012',
          Name: 'smartcooking.com.'
        }
      };

      route53Mock.on(GetHostedZoneCommand).resolves(mockHostedZone);

      const route53Client = captureAWS(new Route53Client({ region: 'us-east-1' }));
      
      await tracer.captureAwsCall(
        'Route53',
        'GetHostedZone',
        async () => {
          return route53Client.send(new GetHostedZoneCommand({
            Id: 'Z123456789012'
          }));
        },
        { hostedZoneId: 'Z123456789012' }
      );

      expect(AWSXRay.captureAWSv3Client).toHaveBeenCalledWith(expect.any(Route53Client));
    });
  });
});

describe('AWS X-Ray Tracing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variable for X-Ray
    process.env._X_AMZN_TRACE_ID = 'Root=1-5e1b4151-5ac6c58f5b5daa6532e4f85e';
  });

  afterEach(() => {
    delete process.env._X_AMZN_TRACE_ID;
  });

  describe('Tracer Functionality', () => {
    it('should check if tracing is enabled', () => {
      expect(tracer.isTracingEnabled()).toBe(true);
    });

    it('should capture async functions', async () => {
      const mockFunction = vi.fn().mockResolvedValue('test-result');
      
      const result = await tracer.captureAsyncFunc(
        'TestOperation',
        mockFunction,
        { operation: 'test' },
        { test: { data: 'value' } }
      );

      expect(result).toBe('test-result');
      expect(mockFunction).toHaveBeenCalled();
      expect(AWSXRay.captureAsyncFunc).toHaveBeenCalledWith(
        'TestOperation',
        expect.any(Function)
      );
    });

    it('should capture database operations', async () => {
      const mockDbOperation = vi.fn().mockResolvedValue({ Items: [] });
      
      const result = await tracer.captureDatabaseOperation(
        'Query',
        'smart-cooking-table',
        mockDbOperation
      );

      expect(result).toEqual({ Items: [] });
      expect(mockDbOperation).toHaveBeenCalled();
    });

    it('should capture API calls', async () => {
      const mockApiCall = vi.fn().mockResolvedValue({ status: 200 });
      
      const result = await tracer.captureApiCall(
        'ExternalAPI',
        'GetData',
        mockApiCall,
        'https://api.example.com/data'
      );

      expect(result).toEqual({ status: 200 });
      expect(mockApiCall).toHaveBeenCalled();
    });

    it('should capture AWS service calls', async () => {
      const mockAwsCall = vi.fn().mockResolvedValue({ ResponseMetadata: {} });
      
      const result = await tracer.captureAwsCall(
        'DynamoDB',
        'Query',
        mockAwsCall,
        { tableName: 'test-table' }
      );

      expect(result).toEqual({ ResponseMetadata: {} });
      expect(mockAwsCall).toHaveBeenCalled();
    });

    it('should add annotations to current segment', () => {
      const mockSegment = {
        addAnnotation: vi.fn()
      };
      
      (AWSXRay.getSegment as any).mockReturnValue(mockSegment);
      
      tracer.addAnnotation('user_id', 'test-user-123');
      
      expect(mockSegment.addAnnotation).toHaveBeenCalledWith('user_id', 'test-user-123');
    });

    it('should add metadata to current segment', () => {
      const mockSegment = {
        addMetadata: vi.fn()
      };
      
      (AWSXRay.getSegment as any).mockReturnValue(mockSegment);
      
      tracer.addMetadata('business', { operation: 'recipe-search' });
      
      expect(mockSegment.addMetadata).toHaveBeenCalledWith('business', { operation: 'recipe-search' });
    });

    it('should set user context', () => {
      const mockSegment = {
        setUser: vi.fn(),
        addAnnotation: vi.fn()
      };
      
      (AWSXRay.getSegment as any).mockReturnValue(mockSegment);
      
      tracer.setUser('test-user-123');
      
      expect(mockSegment.setUser).toHaveBeenCalledWith('test-user-123');
      expect(mockSegment.addAnnotation).toHaveBeenCalledWith('user_id', 'test-user-123');
    });

    it('should get trace ID', () => {
      const mockSegment = {
        trace_id: 'mock-trace-id'
      };
      
      (AWSXRay.getSegment as any).mockReturnValue(mockSegment);
      
      const traceId = tracer.getTraceId();
      
      expect(traceId).toBe('mock-trace-id');
    });

    it('should handle errors gracefully when X-Ray is disabled', () => {
      delete process.env._X_AMZN_TRACE_ID;
      
      // Should not throw errors
      expect(() => {
        tracer.addAnnotation('test', 'value');
        tracer.addMetadata('test', { data: 'value' });
        tracer.setUser('test-user');
      }).not.toThrow();
      
      expect(tracer.isTracingEnabled()).toBe(false);
    });
  });

  describe('AWS SDK Capture', () => {
    it('should capture AWS SDK clients', () => {
      const mockClient = { config: {} };
      
      const capturedClient = captureAWS(mockClient);
      
      expect(AWSXRay.captureAWSv3Client).toHaveBeenCalledWith(mockClient);
      expect(capturedClient).toBe(mockClient);
    });

    it('should handle capture errors gracefully', () => {
      const mockClient = { config: {} };
      
      (AWSXRay.captureAWSv3Client as any).mockImplementation(() => {
        throw new Error('Capture failed');
      });
      
      const capturedClient = captureAWS(mockClient);
      
      // Should return original client on error
      expect(capturedClient).toBe(mockClient);
    });
  });
});

describe('Integration Tests', () => {
  it('should integrate ACM, Route 53, and X-Ray together', async () => {
    // Mock certificate validation
    acmMock.on(DescribeCertificateCommand).resolves({
      Certificate: {
        CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test',
        Status: 'ISSUED',
        DomainName: 'api.smartcooking.com'
      }
    });

    // Mock DNS record lookup
    route53Mock.on(ListResourceRecordSetsCommand).resolves({
      ResourceRecordSets: [{
        Name: 'api.smartcooking.com.',
        Type: 'A',
        AliasTarget: {
          DNSName: 'd-123456789.execute-api.us-east-1.amazonaws.com'
        }
      }]
    });

    // Test complete flow with tracing
    const acmClient = captureAWS(new ACMClient({ region: 'us-east-1' }));
    const route53Client = captureAWS(new Route53Client({ region: 'us-east-1' }));

    await tracer.captureBusinessOperation(
      'ValidateDomainSetup',
      async () => {
        // Check certificate
        const cert = await acmClient.send(new DescribeCertificateCommand({
          CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test'
        }));

        // Check DNS records
        const records = await route53Client.send(new ListResourceRecordSetsCommand({
          HostedZoneId: 'Z123456789012'
        }));

        return {
          certificateStatus: cert.Certificate?.Status,
          dnsRecordsCount: records.ResourceRecordSets?.length
        };
      },
      {
        domain: 'api.smartcooking.com',
        environment: 'test'
      }
    );

    expect(AWSXRay.captureAWSv3Client).toHaveBeenCalledTimes(2);
  });
});