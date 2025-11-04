import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface StorageStackProps {
  environment: string;
}

export class StorageStack extends Construct {
  public readonly imagesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id);

    const { environment } = props;
    const account = cdk.Stack.of(this).account;

    // S3 Bucket for User-Generated Images
    this.imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `smart-cooking-images-${environment}-${account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' 
        ? cdk.RemovalPolicy.RETAIN 
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: environment === 'prod' 
            ? ['https://smartcooking.com', 'https://d6grpgvslabt3.cloudfront.net'] 
            : ['http://localhost:3000'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    // Create users folder structure
    new s3deploy.BucketDeployment(this, 'CreateUsersFolderStructure', {
      sources: [s3deploy.Source.data('users/.keep', '')],
      destinationBucket: this.imagesBucket,
      prune: false,
    });
  }
}
