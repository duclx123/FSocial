/**
 * DNS Stack - Route 53 and Certificate Manager
 * 
 * Manages:
 * - Route 53 hosted zone
 * - SSL/TLS certificates via ACM
 * - DNS records for API and frontend
 */

import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface DnsStackProps {
  environment: string;
  domainName: string;
  api?: apigateway.RestApi;
  createHostedZone?: boolean;
}

export class DnsStack extends Construct {
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.Certificate;
  public readonly apiDomainName?: apigateway.DomainName;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id);

    const { environment, domainName, api, createHostedZone = false } = props;

    // ================================================================
    // 1. HOSTED ZONE
    // ================================================================
    if (createHostedZone) {
      // Create new hosted zone
      this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
        zoneName: domainName,
        comment: `Smart Cooking ${environment} hosted zone`
      });
    } else {
      // Use existing hosted zone
      this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: domainName
      });
    }

    // ================================================================
    // 2. SSL CERTIFICATE
    // ================================================================
    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: domainName,
      subjectAlternativeNames: [
        `*.${domainName}`,
        `api.${domainName}`,
        `app.${domainName}`,
        environment === 'dev' ? `dev.${domainName}` : `www.${domainName}`
      ],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // ================================================================
    // 3. API GATEWAY CUSTOM DOMAIN
    // ================================================================
    if (api) {
      const apiSubdomain = environment === 'prod' ? 'api' : `api-${environment}`;
      
      this.apiDomainName = new apigateway.DomainName(this, 'ApiDomainName', {
        domainName: `${apiSubdomain}.${domainName}`,
        certificate: this.certificate,
        endpointType: apigateway.EndpointType.REGIONAL,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2
      });

      // Map API to custom domain
      this.apiDomainName.addBasePathMapping(api, {
        basePath: '',
        stage: api.deploymentStage
      });

      // Create DNS record for API
      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: this.hostedZone,
        recordName: `${apiSubdomain}.${domainName}`,
        target: route53.RecordTarget.fromAlias(
          new targets.ApiGatewayDomain(this.apiDomainName)
        )
      });
    }

    // ================================================================
    // 4. OUTPUTS
    // ================================================================
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
      exportName: `SmartCooking-${environment}-HostedZoneId`
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM Certificate ARN',
      exportName: `SmartCooking-${environment}-CertificateArn`
    });

    if (this.apiDomainName) {
      new cdk.CfnOutput(this, 'ApiDomainName', {
        value: this.apiDomainName.domainName,
        description: 'API Gateway Custom Domain Name',
        exportName: `SmartCooking-${environment}-ApiDomainName`
      });
    }

    // Tags
    cdk.Tags.of(this).add('Component', 'DNS');
    cdk.Tags.of(this).add('Environment', environment);
  }
}