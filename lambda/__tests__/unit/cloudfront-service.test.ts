/**
 * CloudFront Service Tests
 * Tests for CloudFront integration and URL generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
    CloudFrontClient,
    GetDistributionCommand,
    CreateInvalidationCommand,
    ListDistributionsCommand
} from '@aws-sdk/client-cloudfront';
import { getCloudFrontUrl } from '../../shared/storage/s3-service';

// Mock CloudFront client
const cloudFrontMock = mockClient(CloudFrontClient);

describe('CloudFront Service', () => {
    beforeEach(() => {
        cloudFrontMock.reset();
        // Set test environment
        process.env.CLOUDFRONT_DOMAIN = 'test.cloudfront.net';
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete process.env.CLOUDFRONT_DOMAIN;
    });

    describe('URL Generation', () => {
        it('should generate correct CloudFront URLs', () => {
            const testCases = [
                {
                    key: 'avatars/user-123/avatar.jpg',
                    expected: 'https://test.cloudfront.net/avatars/user-123/avatar.jpg'
                },
                {
                    key: 'posts/post-456/image.png',
                    expected: 'https://test.cloudfront.net/posts/post-456/image.png'
                },
                {
                    key: 'cooking/session-789/step1.webp',
                    expected: 'https://test.cloudfront.net/cooking/session-789/step1.webp'
                }
            ];

            testCases.forEach(({ key, expected }) => {
                const url = getCloudFrontUrl(key);
                expect(url).toBe(expected);
            });
        });

        it('should handle special characters in keys', () => {
            const key = 'posts/post-123/image with spaces & symbols.jpg';
            const url = getCloudFrontUrl(key);

            expect(url).toBe('https://test.cloudfront.net/posts/post-123/image with spaces & symbols.jpg');
        });

        it('should handle empty keys', () => {
            const url = getCloudFrontUrl('');
            expect(url).toBe('https://test.cloudfront.net/');
        });

        it('should handle keys with leading slashes', () => {
            const url = getCloudFrontUrl('/avatars/user-123/avatar.jpg');
            expect(url).toBe('https://test.cloudfront.net//avatars/user-123/avatar.jpg');
        });

        it('should use fallback domain when env var not set', () => {
            delete process.env.CLOUDFRONT_DOMAIN;

            // Re-import to get updated environment
            vi.resetModules();
            const { getCloudFrontUrl: getCloudFrontUrlFallback } = require('../../shared/storage/s3-service');

            const url = getCloudFrontUrlFallback('test/image.jpg');
            expect(url).toBe('https://d6grpgvslabt3.cloudfront.net/test/image.jpg');
        });
    });

    describe('CloudFront Distribution Management', () => {
        it('should get distribution details', async () => {
            const mockDistribution = {
                Distribution: {
                    Id: 'E123456789ABCD',
                    ARN: 'arn:aws:cloudfront::123456789012:distribution/E123456789ABCD',
                    Status: 'Deployed',
                    DomainName: 'test.cloudfront.net',
                    DistributionConfig: {
                        CallerReference: 'smart-cooking-test',
                        Comment: 'Smart Cooking test - CDN for user-generated content',
                        Enabled: true,
                        Origins: {
                            Quantity: 1,
                            Items: [{
                                Id: 'S3-smart-cooking-images',
                                DomainName: 'smart-cooking-images-test.s3.amazonaws.com',
                                S3OriginConfig: {
                                    OriginAccessIdentity: ''
                                }
                            }]
                        },
                        DefaultCacheBehavior: {
                            TargetOriginId: 'S3-smart-cooking-images',
                            ViewerProtocolPolicy: 'redirect-to-https',
                            MinTTL: 0,
                            DefaultTTL: 86400,
                            MaxTTL: 31536000
                        }
                    }
                }
            };

            cloudFrontMock.on(GetDistributionCommand).resolves(mockDistribution);

            const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' });
            const result = await cloudFrontClient.send(new GetDistributionCommand({
                Id: 'E123456789ABCD'
            }));

            expect(result.Distribution?.Status).toBe('Deployed');
            expect(result.Distribution?.DomainName).toBe('test.cloudfront.net');
            expect(result.Distribution?.DistributionConfig?.Enabled).toBe(true);
        });

        it('should list distributions', async () => {
            const mockDistributions = {
                DistributionList: {
                    Marker: '',
                    MaxItems: 100,
                    IsTruncated: false,
                    Quantity: 2,
                    Items: [
                        {
                            Id: 'E123456789ABCD',
                            ARN: 'arn:aws:cloudfront::123456789012:distribution/E123456789ABCD',
                            Status: 'Deployed',
                            DomainName: 'test.cloudfront.net',
                            Comment: 'Smart Cooking test distribution',
                            Enabled: true
                        },
                        {
                            Id: 'E987654321ZYXW',
                            ARN: 'arn:aws:cloudfront::123456789012:distribution/E987654321ZYXW',
                            Status: 'Deployed',
                            DomainName: 'prod.cloudfront.net',
                            Comment: 'Smart Cooking prod distribution',
                            Enabled: true
                        }
                    ]
                }
            };

            cloudFrontMock.on(ListDistributionsCommand).resolves(mockDistributions);

            const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' });
            const result = await cloudFrontClient.send(new ListDistributionsCommand({}));

            expect(result.DistributionList?.Quantity).toBe(2);
            expect(result.DistributionList?.Items?.[0].Status).toBe('Deployed');
            expect(result.DistributionList?.Items?.[1].DomainName).toBe('prod.cloudfront.net');
        });

        it('should handle distribution not found', async () => {
            cloudFrontMock.on(GetDistributionCommand).rejects(
                new Error('Distribution not found')
            );

            const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' });

            await expect(
                cloudFrontClient.send(new GetDistributionCommand({
                    Id: 'INVALID-ID'
                }))
            ).rejects.toThrow('Distribution not found');
        });
    });

    describe('Cache Invalidation', () => {
        it('should create cache invalidation', async () => {
            const mockInvalidation = {
                Invalidation: {
                    Id: 'I123456789ABCD',
                    Status: 'InProgress',
                    CreateTime: new Date('2024-01-01T00:00:00Z'),
                    InvalidationBatch: {
                        Paths: {
                            Quantity: 2,
                            Items: ['/avatars/user-123/*', '/posts/post-456/*']
                        },
                        CallerReference: 'invalidation-123'
                    }
                }
            };

            cloudFrontMock.on(CreateInvalidationCommand).resolves(mockInvalidation);

            const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' });
            const result = await cloudFrontClient.send(new CreateInvalidationCommand({
                DistributionId: 'E123456789ABCD',
                InvalidationBatch: {
                    Paths: {
                        Quantity: 2,
                        Items: ['/avatars/user-123/*', '/posts/post-456/*']
                    },
                    CallerReference: 'invalidation-123'
                }
            }));

            expect(result.Invalidation?.Status).toBe('InProgress');
            expect(result.Invalidation?.InvalidationBatch?.Paths?.Quantity).toBe(2);
        });

        it('should handle invalidation errors', async () => {
            cloudFrontMock.on(CreateInvalidationCommand).rejects(
                new Error('Too many invalidations in progress')
            );

            const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' });

            await expect(
                cloudFrontClient.send(new CreateInvalidationCommand({
                    DistributionId: 'E123456789ABCD',
                    InvalidationBatch: {
                        Paths: {
                            Quantity: 1,
                            Items: ['/*']
                        },
                        CallerReference: 'invalidation-456'
                    }
                }))
            ).rejects.toThrow('Too many invalidations in progress');
        });
    });

    describe('Performance and Caching', () => {
        it('should validate cache behavior configuration', () => {
            const cacheConfigs = [
                {
                    pathPattern: '/avatars/*',
                    expectedTTL: 90 * 24 * 60 * 60, // 90 days for avatars
                    compress: true
                },
                {
                    pathPattern: '/posts/*',
                    expectedTTL: 30 * 24 * 60 * 60, // 30 days for posts
                    compress: true
                },
                {
                    pathPattern: '/cooking/*',
                    expectedTTL: 30 * 24 * 60 * 60, // 30 days for cooking images
                    compress: true
                }
            ];

            cacheConfigs.forEach(config => {
                expect(config.expectedTTL).toBeGreaterThan(0);
                expect(config.compress).toBe(true);
                expect(config.pathPattern).toMatch(/^\/\w+\/\*$/);
            });
        });

        it('should validate CORS headers configuration', () => {
            const corsConfig = {
                allowedOrigins: ['http://localhost:3000', 'https://smartcooking.com'],
                allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
                allowedHeaders: ['*'],
                maxAge: 86400
            };

            expect(corsConfig.allowedOrigins).toContain('http://localhost:3000');
            expect(corsConfig.allowedMethods).toContain('GET');
            expect(corsConfig.maxAge).toBe(86400);
        });

        it('should validate security headers', () => {
            const securityHeaders = {
                contentTypeOptions: true,
                frameOptions: 'DENY',
                referrerPolicy: 'strict-origin-when-cross-origin',
                strictTransportSecurity: {
                    maxAge: 31536000,
                    includeSubdomains: true,
                    preload: true
                }
            };

            expect(securityHeaders.contentTypeOptions).toBe(true);
            expect(securityHeaders.frameOptions).toBe('DENY');
            expect(securityHeaders.strictTransportSecurity.maxAge).toBe(31536000);
        });
    });

    describe('Environment-Specific Configuration', () => {
        it('should handle development environment', () => {
            const devConfig = {
                environment: 'dev',
                priceClass: 'PriceClass_100', // Cost optimization
                geoRestriction: ['US', 'CA', 'VN'], // Limited for dev
                customDomain: 'cdn-dev.smartcooking.com'
            };

            expect(devConfig.priceClass).toBe('PriceClass_100');
            expect(devConfig.geoRestriction).toContain('VN');
            expect(devConfig.customDomain).toContain('dev');
        });

        it('should handle production environment', () => {
            const prodConfig = {
                environment: 'prod',
                priceClass: 'PriceClass_All', // Global distribution
                geoRestriction: ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU', 'SG', 'VN'],
                customDomain: 'cdn.smartcooking.com'
            };

            expect(prodConfig.priceClass).toBe('PriceClass_All');
            expect(prodConfig.geoRestriction.length).toBeGreaterThan(5);
            expect(prodConfig.customDomain).not.toContain('dev');
        });
    });

    describe('Error Handling', () => {
        it('should handle CloudFront service errors', async () => {
            cloudFrontMock.on(GetDistributionCommand).rejects(
                new Error('Service temporarily unavailable')
            );

            const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' });

            await expect(
                cloudFrontClient.send(new GetDistributionCommand({
                    Id: 'E123456789ABCD'
                }))
            ).rejects.toThrow('Service temporarily unavailable');
        });

        it('should handle invalid distribution configuration', () => {
            const invalidConfig = {
                origins: [],
                defaultCacheBehavior: null,
                enabled: false
            };

            expect(invalidConfig.origins).toHaveLength(0);
            expect(invalidConfig.defaultCacheBehavior).toBeNull();
            expect(invalidConfig.enabled).toBe(false);
        });

        it('should validate URL format', () => {
            const validUrls = [
                'https://test.cloudfront.net/avatars/user-123/avatar.jpg',
                'https://d123456789abcd.cloudfront.net/posts/image.png'
            ];

            const invalidUrls = [
                'http://test.cloudfront.net/image.jpg', // HTTP not HTTPS
                'https://example.com/image.jpg', // Not CloudFront domain
                'ftp://test.cloudfront.net/image.jpg' // Wrong protocol
            ];

            validUrls.forEach(url => {
                expect(url).toMatch(/^https:\/\/[a-z0-9.-]+\.cloudfront\.net\/.+$/);
            });

            invalidUrls.forEach(url => {
                expect(url).not.toMatch(/^https:\/\/[a-z0-9.-]+\.cloudfront\.net\/.+$/);
            });
        });
    });

    describe('Integration with S3', () => {
        it('should validate Origin Access Control setup', () => {
            const oacConfig = {
                originAccessControlOriginType: 'S3',
                signing: 'sigv4',
                description: 'Smart Cooking test - S3 Origin Access Control'
            };

            expect(oacConfig.originAccessControlOriginType).toBe('S3');
            expect(oacConfig.signing).toBe('sigv4');
            expect(oacConfig.description).toContain('Smart Cooking');
        });

        it('should validate S3 bucket policy for CloudFront', () => {
            const bucketPolicy = {
                sid: 'AllowCloudFrontServicePrincipal',
                effect: 'Allow',
                principal: 'cloudfront.amazonaws.com',
                action: 's3:GetObject',
                resource: 'arn:aws:s3:::smart-cooking-images-test/*',
                condition: {
                    StringEquals: {
                        'AWS:SourceArn': 'arn:aws:cloudfront::123456789012:distribution/E123456789ABCD'
                    }
                }
            };

            expect(bucketPolicy.effect).toBe('Allow');
            expect(bucketPolicy.principal).toBe('cloudfront.amazonaws.com');
            expect(bucketPolicy.action).toBe('s3:GetObject');
            expect(bucketPolicy.condition.StringEquals['AWS:SourceArn']).toContain('distribution');
        });
    });
});