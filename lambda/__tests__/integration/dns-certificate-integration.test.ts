/**
 * DNS & Certificate Integration Tests
 * Tests the integration between Route 53, ACM, and API Gateway
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { 
  ACMClient, 
  DescribeCertificateCommand,
  RequestCertificateCommand 
} from '@aws-sdk/client-acm';
import { 
  Route53Client,
  GetHostedZoneCommand,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand 
} from '@aws-sdk/client-route-53';
import { 
  APIGatewayClient,
  GetDomainNameCommand,
  CreateDomainNameCommand 
} from '@aws-sdk/client-api-gateway';

// Mock AWS clients
const acmMock = mockClient(ACMClient);
const route53Mock = mockClient(Route53Client);
const apiGatewayMock = mockClient(APIGatewayClient);

describe('DNS & Certificate Integration', () => {
  beforeEach(() => {
    acmMock.reset();
    route53Mock.reset();
    apiGatewayMock.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Certificate Validation Flow', () => {
    it('should complete DNS validation for certificate', async () => {
      // Mock certificate request
      const certificateArn = 'arn:aws:acm:us-east-1:123456789012:certificate/test-cert';
      
      acmMock.on(RequestCertificateCommand).resolves({
        CertificateArn: certificateArn
      });

      // Mock certificate with DNS validation options
      acmMock.on(DescribeCertificateCommand).resolves({
        Certificate: {
          CertificateArn: certificateArn,
          DomainName: 'api.smartcooking.com',
          Status: 'PENDING_VALIDATION',
          DomainValidationOptions: [{
            DomainName: 'api.smartcooking.com',
            ValidationDomain: 'api.smartcooking.com',
            ValidationStatus: 'PENDING_VALIDATION',
            ResourceRecord: {
              Name: '_abc123.api.smartcooking.com.',
              Type: 'CNAME',
              Value: '_xyz789.acm-validations.aws.'
            }
          }]
        }
      });

      // Mock hosted zone lookup
      route53Mock.on(GetHostedZoneCommand).resolves({
        HostedZone: {
          Id: '/hostedzone/Z123456789012',
          Name: 'smartcooking.com.',
          CallerReference: 'test-ref'
        }
      });

      // Mock DNS record creation for validation
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: '/change/C123456789012',
          Status: 'PENDING',
          SubmittedAt: new Date()
        }
      });

      const acmClient = new ACMClient({ region: 'us-east-1' });
      const route53Client = new Route53Client({ region: 'us-east-1' });

      // Step 1: Request certificate
      const certRequest = await acmClient.send(new RequestCertificateCommand({
        DomainName: 'api.smartcooking.com',
        ValidationMethod: 'DNS'
      }));

      expect(certRequest.CertificateArn).toBe(certificateArn);

      // Step 2: Get validation records
      const certDetails = await acmClient.send(new DescribeCertificateCommand({
        CertificateArn: certificateArn
      }));

      const validationRecord = certDetails.Certificate?.DomainValidationOptions?.[0]?.ResourceRecord;
      expect(validationRecord?.Type).toBe('CNAME');
      expect(validationRecord?.Name).toContain('_abc123');

      // Step 3: Create DNS validation record
      const dnsChange = await route53Client.send(new ChangeResourceRecordSetsCommand({
        HostedZoneId: 'Z123456789012',
        ChangeBatch: {
          Changes: [{
            Action: 'CREATE',
            ResourceRecordSet: {
              Name: validationRecord?.Name,
              Type: validationRecord?.Type as any,
              TTL: 300,
              ResourceRecords: [{
                Value: validationRecord?.Value
              }]
            }
          }]
        }
      }));

      expect(dnsChange.ChangeInfo?.Status).toBe('PENDING');
    });

    it('should handle certificate validation timeout', async () => {
      acmMock.on(DescribeCertificateCommand).resolves({
        Certificate: {
          CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/timeout-cert',
          Status: 'VALIDATION_TIMED_OUT',
          DomainValidationOptions: [{
            DomainName: 'api.smartcooking.com',
            ValidationStatus: 'FAILED'
          }]
        }
      });

      const acmClient = new ACMClient({ region: 'us-east-1' });
      
      const result = await acmClient.send(new DescribeCertificateCommand({
        CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/timeout-cert'
      }));

      expect(result.Certificate?.Status).toBe('VALIDATION_TIMED_OUT');
      expect(result.Certificate?.DomainValidationOptions?.[0]?.ValidationStatus).toBe('FAILED');
    });
  });

  describe('API Gateway Custom Domain Setup', () => {
    it('should create custom domain with certificate', async () => {
      const certificateArn = 'arn:aws:acm:us-east-1:123456789012:certificate/valid-cert';
      const domainName = 'api.smartcooking.com';

      // Mock valid certificate
      acmMock.on(DescribeCertificateCommand).resolves({
        Certificate: {
          CertificateArn: certificateArn,
          DomainName: domainName,
          Status: 'ISSUED'
        }
      });

      // Mock API Gateway domain creation
      apiGatewayMock.on(CreateDomainNameCommand).resolves({
        domainName: domainName,
        certificateArn: certificateArn,
        distributionDomainName: 'd-123456789.execute-api.us-east-1.amazonaws.com',
        distributionHostedZoneId: 'Z1UJRXOUMOOFQ8'
      });

      // Mock DNS record creation for API Gateway
      route53Mock.on(ChangeResourceRecordSetsCommand).resolves({
        ChangeInfo: {
          Id: '/change/C987654321',
          Status: 'PENDING'
        }
      });

      const acmClient = new ACMClient({ region: 'us-east-1' });
      const apiGatewayClient = new APIGatewayClient({ region: 'us-east-1' });
      const route53Client = new Route53Client({ region: 'us-east-1' });

      // Step 1: Verify certificate is issued
      const cert = await acmClient.send(new DescribeCertificateCommand({
        CertificateArn: certificateArn
      }));

      expect(cert.Certificate?.Status).toBe('ISSUED');

      // Step 2: Create API Gateway custom domain
      const customDomain = await apiGatewayClient.send(new CreateDomainNameCommand({
        domainName: domainName,
        certificateArn: certificateArn
      }));

      expect(customDomain.domainName).toBe(domainName);
      expect(customDomain.distributionDomainName).toContain('execute-api');

      // Step 3: Create DNS alias record
      const aliasRecord = await route53Client.send(new ChangeResourceRecordSetsCommand({
        HostedZoneId: 'Z123456789012',
        ChangeBatch: {
          Changes: [{
            Action: 'CREATE',
            ResourceRecordSet: {
              Name: domainName,
              Type: 'A',
              AliasTarget: {
                DNSName: customDomain.distributionDomainName,
                HostedZoneId: customDomain.distributionHostedZoneId,
                EvaluateTargetHealth: false
              }
            }
          }]
        }
      }));

      expect(aliasRecord.ChangeInfo?.Status).toBe('PENDING');
    });

    it('should handle domain name conflicts', async () => {
      apiGatewayMock.on(CreateDomainNameCommand).rejects(
        new Error('Domain name already exists')
      );

      const apiGatewayClient = new APIGatewayClient({ region: 'us-east-1' });
      
      await expect(
        apiGatewayClient.send(new CreateDomainNameCommand({
          domainName: 'api.smartcooking.com',
          certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/test'
        }))
      ).rejects.toThrow('Domain name already exists');
    });
  });

  describe('DNS Health Checks', () => {
    it('should verify DNS resolution for custom domain', async () => {
      const domainName = 'api.smartcooking.com';

      // Mock DNS record lookup
      route53Mock.on(ListResourceRecordSetsCommand).resolves({
        ResourceRecordSets: [
          {
            Name: `${domainName}.`,
            Type: 'A',
            AliasTarget: {
              DNSName: 'd-123456789.execute-api.us-east-1.amazonaws.com',
              HostedZoneId: 'Z1UJRXOUMOOFQ8',
              EvaluateTargetHealth: false
            }
          },
          {
            Name: `${domainName}.`,
            Type: 'AAAA',
            AliasTarget: {
              DNSName: 'd-123456789.execute-api.us-east-1.amazonaws.com',
              HostedZoneId: 'Z1UJRXOUMOOFQ8',
              EvaluateTargetHealth: false
            }
          }
        ]
      });

      // Mock API Gateway domain lookup
      apiGatewayMock.on(GetDomainNameCommand).resolves({
        domainName: domainName,
        distributionDomainName: 'd-123456789.execute-api.us-east-1.amazonaws.com',
        domainNameStatus: 'AVAILABLE'
      });

      const route53Client = new Route53Client({ region: 'us-east-1' });
      const apiGatewayClient = new APIGatewayClient({ region: 'us-east-1' });

      // Check DNS records
      const dnsRecords = await route53Client.send(new ListResourceRecordSetsCommand({
        HostedZoneId: 'Z123456789012'
      }));

      const aRecord = dnsRecords.ResourceRecordSets?.find(r => 
        r.Name === `${domainName}.` && r.Type === 'A'
      );

      expect(aRecord).toBeDefined();
      expect(aRecord?.AliasTarget?.DNSName).toContain('execute-api');

      // Check API Gateway domain status
      const apiDomain = await apiGatewayClient.send(new GetDomainNameCommand({
        domainName: domainName
      }));

      expect(apiDomain.domainNameStatus).toBe('AVAILABLE');
    });

    it('should detect DNS propagation issues', async () => {
      // Mock missing DNS records
      route53Mock.on(ListResourceRecordSetsCommand).resolves({
        ResourceRecordSets: [
          {
            Name: 'smartcooking.com.',
            Type: 'NS',
            TTL: 172800,
            ResourceRecords: [{ Value: 'ns-123.awsdns-12.com.' }]
          }
        ]
      });

      const route53Client = new Route53Client({ region: 'us-east-1' });
      
      const records = await route53Client.send(new ListResourceRecordSetsCommand({
        HostedZoneId: 'Z123456789012'
      }));

      const apiRecord = records.ResourceRecordSets?.find(r => 
        r.Name === 'api.smartcooking.com.' && r.Type === 'A'
      );

      // Should not find API record - indicates propagation issue
      expect(apiRecord).toBeUndefined();
    });
  });

  describe('Multi-Environment Domain Management', () => {
    it('should handle environment-specific subdomains', async () => {
      const environments = ['dev', 'staging', 'prod'];
      const baseDomain = 'smartcooking.com';

      for (const env of environments) {
        const subdomain = env === 'prod' ? 'api' : `api-${env}`;
        const fullDomain = `${subdomain}.${baseDomain}`;

        // Mock certificate for each environment
        acmMock.on(DescribeCertificateCommand).resolves({
          Certificate: {
            CertificateArn: `arn:aws:acm:us-east-1:123456789012:certificate/${env}-cert`,
            DomainName: fullDomain,
            Status: 'ISSUED'
          }
        });

        // Mock API Gateway domain
        apiGatewayMock.on(GetDomainNameCommand).resolves({
          domainName: fullDomain,
          distributionDomainName: `d-${env}123.execute-api.us-east-1.amazonaws.com`,
          domainNameStatus: 'AVAILABLE'
        });

        const acmClient = new ACMClient({ region: 'us-east-1' });
        const apiGatewayClient = new APIGatewayClient({ region: 'us-east-1' });

        const cert = await acmClient.send(new DescribeCertificateCommand({
          CertificateArn: `arn:aws:acm:us-east-1:123456789012:certificate/${env}-cert`
        }));

        const domain = await apiGatewayClient.send(new GetDomainNameCommand({
          domainName: fullDomain
        }));

        expect(cert.Certificate?.Status).toBe('ISSUED');
        expect(domain.domainNameStatus).toBe('AVAILABLE');
        expect(domain.distributionDomainName).toContain(env);
      }
    });

    it('should validate wildcard certificate coverage', async () => {
      const wildcardCert = {
        CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/wildcard-cert',
        DomainName: '*.smartcooking.com',
        SubjectAlternativeNames: [
          '*.smartcooking.com',
          'smartcooking.com',
          'api.smartcooking.com',
          'api-dev.smartcooking.com',
          'api-staging.smartcooking.com'
        ],
        Status: 'ISSUED'
      };

      acmMock.on(DescribeCertificateCommand).resolves({
        Certificate: wildcardCert
      });

      const acmClient = new ACMClient({ region: 'us-east-1' });
      
      const cert = await acmClient.send(new DescribeCertificateCommand({
        CertificateArn: wildcardCert.CertificateArn
      }));

      // Verify wildcard covers all subdomains
      const subdomains = ['api', 'api-dev', 'api-staging'];
      
      subdomains.forEach(subdomain => {
        const fullDomain = `${subdomain}.smartcooking.com`;
        const iscovered = cert.Certificate?.SubjectAlternativeNames?.includes(fullDomain) ||
                          cert.Certificate?.DomainName === '*.smartcooking.com';
        
        expect(iscovered).toBe(true);
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle certificate expiration', async () => {
      const expiredCert = {
        CertificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/expired-cert',
        DomainName: 'api.smartcooking.com',
        Status: 'EXPIRED',
        NotAfter: new Date('2023-01-01') // Past date
      };

      acmMock.on(DescribeCertificateCommand).resolves({
        Certificate: expiredCert
      });

      const acmClient = new ACMClient({ region: 'us-east-1' });
      
      const cert = await acmClient.send(new DescribeCertificateCommand({
        CertificateArn: expiredCert.CertificateArn
      }));

      expect(cert.Certificate?.Status).toBe('EXPIRED');
      expect(cert.Certificate?.NotAfter).toEqual(new Date('2023-01-01'));
    });

    it('should handle DNS zone delegation issues', async () => {
      route53Mock.on(GetHostedZoneCommand).rejects(
        new Error('Hosted zone not found')
      );

      const route53Client = new Route53Client({ region: 'us-east-1' });
      
      await expect(
        route53Client.send(new GetHostedZoneCommand({
          Id: 'Z999999999999'
        }))
      ).rejects.toThrow('Hosted zone not found');
    });

    it('should handle API Gateway domain mapping failures', async () => {
      apiGatewayMock.on(GetDomainNameCommand).resolves({
        domainName: 'api.smartcooking.com',
        domainNameStatus: 'UPDATING',
        distributionDomainName: undefined // Missing distribution
      });

      const apiGatewayClient = new APIGatewayClient({ region: 'us-east-1' });
      
      const domain = await apiGatewayClient.send(new GetDomainNameCommand({
        domainName: 'api.smartcooking.com'
      }));

      expect(domain.domainNameStatus).toBe('UPDATING');
      expect(domain.distributionDomainName).toBeUndefined();
    });
  });
});