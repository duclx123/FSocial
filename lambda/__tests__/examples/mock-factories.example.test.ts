/**
 * Example: AWS Mock Factories Usage
 * Demonstrates how to use the comprehensive AWS service mock factories
 */

import { createDynamoDBMock } from '../mocks/dynamodb-mock-factory';
import { createS3Mock } from '../mocks/s3-mock-factory';
import { createCognitoMock } from '../mocks/cognito-mock-factory';
import { createSNSMock } from '../mocks/sns-mock-factory';

describe('AWS Mock Factories Examples', () => {
  describe('DynamoDB Mock Factory', () => {
    it('should mock query with pagination', async () => {
      const dynamoMock = createDynamoDBMock();
      
      dynamoMock
        .mockQuery([{ id: '1', name: 'Item 1' }, { id: '2', name: 'Item 2' }], { nextToken: 'token-1' })
        .mockQuery([{ id: '3', name: 'Item 3' }]);
      
      const client = dynamoMock.getClient();
      
      const result1 = await client.send({});
      expect(result1.Items).toHaveLength(2);
      expect(result1.LastEvaluatedKey).toBeDefined();
      
      const result2 = await client.send({});
      expect(result2.Items).toHaveLength(1);
      expect(result2.LastEvaluatedKey).toBeUndefined();
    });

    it('should mock batch operations', async () => {
      const dynamoMock = createDynamoDBMock();
      
      dynamoMock.mockBatchWriteItem();
      
      const client = dynamoMock.getClient();
      const result = await client.send({});
      
      expect(result.UnprocessedItems).toEqual({});
    });

    it('should handle errors', async () => {
      const dynamoMock = createDynamoDBMock();
      
      dynamoMock.mockThrottlingError();
      
      const client = dynamoMock.getClient();
      
      await expect(client.send({})).rejects.toThrow('Rate exceeded');
    });
  });

  describe('S3 Mock Factory', () => {
    it('should mock upload and download', async () => {
      const s3Mock = createS3Mock();
      
      s3Mock
        .mockPutObject({ key: 'test.jpg' })
        .mockGetObject('file content', { contentType: 'image/jpeg' });
      
      const client = s3Mock.getClient();
      
      const uploadResult = await client.send({});
      expect(uploadResult.ETag).toBeDefined();
      
      const downloadResult = await client.send({});
      const content = await downloadResult.Body.transformToString();
      expect(content).toBe('file content');
    });

    it('should mock multipart upload', async () => {
      const s3Mock = createS3Mock();
      
      s3Mock.mockRealisticMultipartUpload(3);
      
      const client = s3Mock.getClient();
      
      const createResult = await client.send({});
      expect(createResult.UploadId).toBeDefined();
      
      await client.send({}); // Part 1
      await client.send({}); // Part 2
      await client.send({}); // Part 3
      
      const completeResult = await client.send({});
      expect(completeResult.Location).toBeDefined();
    });
  });

  describe('Cognito Mock Factory', () => {
    it('should mock complete sign up flow', async () => {
      const cognitoMock = createCognitoMock();
      
      const { username, email, userSub } = cognitoMock.mockCompleteSignUpFlow(
        'testuser',
        'test@example.com'
      );
      
      const client = cognitoMock.getClient();
      
      const signUpResult = await client.send({});
      expect(signUpResult.UserSub).toBeDefined();
      
      const confirmResult = await client.send({});
      expect(confirmResult.$metadata.httpStatusCode).toBe(200);
    });

    it('should mock authentication', async () => {
      const cognitoMock = createCognitoMock();
      
      cognitoMock.mockInitiateAuth();
      
      const client = cognitoMock.getClient();
      const result = await client.send({});
      
      expect(result.AuthenticationResult).toBeDefined();
      expect(result.AuthenticationResult.AccessToken).toBeDefined();
      expect(result.AuthenticationResult.IdToken).toBeDefined();
    });
  });

  describe('SNS Mock Factory', () => {
    it('should mock publish operations', async () => {
      const snsMock = createSNSMock();
      
      snsMock.mockPublish({ messageId: 'msg-123' });
      
      const client = snsMock.getClient();
      const result = await client.send({});
      
      expect(result.MessageId).toBe('msg-123');
    });

    it('should mock subscription flow', async () => {
      const snsMock = createSNSMock();
      
      const { subscriptionArn } = snsMock.mockCompleteSubscriptionFlow(
        'email',
        'test@example.com'
      );
      
      const client = snsMock.getClient();
      
      const subscribeResult = await client.send({});
      expect(subscribeResult.SubscriptionArn).toBeDefined();
      
      const confirmResult = await client.send({});
      expect(confirmResult.$metadata.httpStatusCode).toBe(200);
    });
  });
});
