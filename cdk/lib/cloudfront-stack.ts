/**
 * CloudFront Stack - CDN Distribution
 * 
 * Manages:
 * - CloudFront distribution for S3 static assets
 * - Origin Access Control (OAC) for secure S3 access
 * - Cache behaviors and policies
 * - Custom domain integration with ACM
 */

import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface CloudFrontStackProps {
  environment: string;
  imagesBucket: s3.Bucket;
  certificate?: acm.Certificate;
  hostedZone?: route53.IHostedZone;
  domainName?: string;
}

export class CloudFrontStack extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly originAccessIdentity: cloudfront.OriginAccessIdentity;
  public readonly domainName: string;

  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id);

    const { environment, imagesBucket, certificate, hostedZone, domainName } = props;

    // ================================================================
    // 1. ORIGIN ACCESS IDENTITY (OAI) - Secure S3 Access
    // ================================================================
    this.originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `Smart Cooking ${environment} - S3 Origin Access Identity`
    });

    // ================================================================
    // 2. CACHE POLICIES
    // ================================================================
    
    // Cache policy for images (long cache, optimized for static assets)
    const imagesCachePolicy = new cloudfront.CachePolicy(this, 'ImagesCachePolicy', {
      cachePolicyName: `smart-cooking-images-${environment}`,
      comment: 'Cache policy for user-generated images',
      defaultTtl: cdk.Duration.days(30), // 30 days default
      maxTtl: cdk.Duration.days(365),    // 1 year max
      minTtl: cdk.Duration.seconds(0),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true
    });

    // ================================================================
    // 3. RESPONSE HEADERS POLICY
    // ================================================================
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
      responseHeadersPolicyName: `smart-cooking-headers-${environment}`,
      comment: 'Security and CORS headers for Smart Cooking',
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowOrigins: environment === 'prod' 
          ? ['https://awssmartcookingss.com', 'https://app.awssmartcookingss.com']
          : ['http://localhost:3000', 'https://dev.awssmartcookingss.com'],
        accessControlMaxAge: cdk.Duration.seconds(86400),
        originOverride: true
      },
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { 
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, 
          override: true 
        },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000),
          includeSubdomains: true,
          preload: true,
          override: true
        }
      }
    });

    // ================================================================
    // 4. CLOUDFRONT DISTRIBUTION
    // ================================================================
    
    // Determine custom domain
    const cdnSubdomain = environment === 'prod' ? 'cdn' : `cdn-${environment}`;
    const customDomain = domainName ? `${cdnSubdomain}.${domainName}` : undefined;

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `Smart Cooking ${environment} - CDN for user-generated content`,
      
      // Custom domain configuration
      ...(customDomain && certificate ? {
        domainNames: [customDomain],
        certificate: certificate
      } : {}),

      // Default behavior for all paths
      defaultBehavior: {
        origin: new origins.S3Origin(imagesBucket, {
          originAccessIdentity: this.originAccessIdentity
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: imagesCachePolicy,
        responseHeadersPolicy: responseHeadersPolicy,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true
      },

      // Additional behaviors for specific paths
      additionalBehaviors: {
        // Avatar images - longer cache
        '/avatars/*': {
          origin: new origins.S3Origin(imagesBucket, {
            originAccessIdentity: this.originAccessIdentity
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, 'AvatarsCachePolicy', {
            cachePolicyName: `smart-cooking-avatars-${environment}`,
            defaultTtl: cdk.Duration.days(90), // Avatars change less frequently
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.days(1),
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Origin'),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none()
          }),
          responseHeadersPolicy: responseHeadersPolicy,
          compress: true
        },

        // Post images - medium cache
        '/posts/*': {
          origin: new origins.S3Origin(imagesBucket, {
            originAccessIdentity: this.originAccessIdentity
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: imagesCachePolicy,
          responseHeadersPolicy: responseHeadersPolicy,
          compress: true
        }
      },

      // Error pages
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(5)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: cdk.Duration.minutes(5)
        }
      ],

      // Geo restrictions (if needed)
      geoRestriction: cloudfront.GeoRestriction.allowlist(
        // Allow major markets - can be expanded
        'US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU', 'SG', 'VN'
      ),

      // Price class (optimize for cost in non-prod)
      priceClass: environment === 'prod' 
        ? cloudfront.PriceClass.PRICE_CLASS_ALL 
        : cloudfront.PriceClass.PRICE_CLASS_100,

      // Enable logging
      enableLogging: true,
      logBucket: undefined, // Will use default logging bucket
      logFilePrefix: `cloudfront-logs/${environment}/`,
      logIncludesCookies: false,

      // HTTP version
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,

      // IPv6
      enableIpv6: true,

      // Minimum TLS version
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021
    });

    // ================================================================
    // 5. S3 BUCKET POLICY FOR OAI
    // ================================================================
    
    // Grant CloudFront access to S3 bucket via OAI
    imagesBucket.grantRead(this.originAccessIdentity);

    // ================================================================
    // 6. DNS RECORD (if custom domain)
    // ================================================================
    
    if (customDomain && hostedZone) {
      new route53.ARecord(this, 'CDNAliasRecord', {
        zone: hostedZone,
        recordName: customDomain,
        target: route53.RecordTarget.fromAlias(
          new targets.CloudFrontTarget(this.distribution)
        ),
        comment: `CloudFront distribution for Smart Cooking ${environment}`
      });
    }

    // Set the domain name for output
    this.domainName = customDomain || this.distribution.distributionDomainName;

    // ================================================================
    // 7. OUTPUTS
    // ================================================================
    
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: `SmartCooking-${environment}-DistributionId`
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `SmartCooking-${environment}-DistributionDomainName`
    });

    new cdk.CfnOutput(this, 'CDNDomainName', {
      value: this.domainName,
      description: 'CDN Domain Name (custom or CloudFront)'
      // No export name to avoid duplicate with modular-stack
    });

    // Tags
    cdk.Tags.of(this).add('Component', 'CloudFront');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('CostCenter', 'Engineering');
  }
}