/**
 * SNS Mock Factory
 * Comprehensive mocking for SNS notification publishing and subscription management
 */

export interface SNSMockConfig {
  topicArn?: string;
  region?: string;
}

export class SNSMockFactory {
  private mockClient: any;
  private config: SNSMockConfig;
  private subscriptions: Map<string, any> = new Map();
  private messages: any[] = [];

  constructor(config: SNSMockConfig = {}) {
    this.config = {
      topicArn: 'arn:aws:sns:us-east-1:123456789012:test-topic',
      region: 'us-east-1',
      ...config
    };
    this.mockClient = { send: jest.fn() };
  }

  // Publish Operations
  mockPublish(options: {
    messageId?: string;
    sequenceNumber?: string;
  } = {}) {
    const response = {
      MessageId: options.messageId || this.generateMessageId(),
      SequenceNumber: options.sequenceNumber,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockPublishBatch(options: {
    successful?: number;
    failed?: Array<{ id: string; code: string; message: string }>;
  } = {}) {
    const successCount = options.successful || 10;
    const response = {
      Successful: Array.from({ length: successCount }, (_, i) => ({
        Id: `msg-${i}`,
        MessageId: this.generateMessageId(),
        SequenceNumber: `${i}`
      })),
      Failed: options.failed || [],
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockPublishError(errorCode: string, message: string) {
    this.mockClient.send.mockRejectedValueOnce(
      this.createSNSError(errorCode, message)
    );
    return this;
  }

  // Topic Operations
  mockCreateTopic(topicArn?: string) {
    const response = {
      TopicArn: topicArn || this.config.topicArn,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockDeleteTopic(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createSNSError('NotFoundException', 'Topic does not exist')
      );
    }
    return this;
  }

  mockListTopics(topics: string[]) {
    const response = {
      Topics: topics.map(arn => ({ TopicArn: arn })),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockGetTopicAttributes(attributes: Record<string, string> = {}) {
    const response = {
      Attributes: {
        TopicArn: this.config.topicArn,
        DisplayName: 'Test Topic',
        SubscriptionsConfirmed: '5',
        SubscriptionsPending: '0',
        SubscriptionsDeleted: '0',
        ...attributes
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockSetTopicAttributes(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createSNSError('InvalidParameterException', 'Invalid attribute')
      );
    }
    return this;
  }

  // Subscription Operations
  mockSubscribe(options: {
    subscriptionArn?: string;
    protocol?: string;
    endpoint?: string;
  } = {}) {
    const subscriptionArn = options.subscriptionArn || this.generateSubscriptionArn();
    const response = {
      SubscriptionArn: subscriptionArn,
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.subscriptions.set(subscriptionArn, {
      protocol: options.protocol || 'email',
      endpoint: options.endpoint || 'test@example.com',
      confirmed: false
    });

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockUnsubscribe(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createSNSError('NotFoundException', 'Subscription does not exist')
      );
    }
    return this;
  }

  mockListSubscriptions(subscriptions: Array<{
    subscriptionArn: string;
    protocol: string;
    endpoint: string;
  }>) {
    const response = {
      Subscriptions: subscriptions.map(sub => ({
        SubscriptionArn: sub.subscriptionArn,
        TopicArn: this.config.topicArn,
        Protocol: sub.protocol,
        Endpoint: sub.endpoint,
        Owner: '123456789012'
      })),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockListSubscriptionsByTopic(subscriptions: Array<{
    subscriptionArn: string;
    protocol: string;
    endpoint: string;
  }>) {
    return this.mockListSubscriptions(subscriptions);
  }

  mockGetSubscriptionAttributes(attributes: Record<string, string> = {}) {
    const response = {
      Attributes: {
        SubscriptionArn: this.generateSubscriptionArn(),
        TopicArn: this.config.topicArn,
        Protocol: 'email',
        Endpoint: 'test@example.com',
        ConfirmationWasAuthenticated: 'true',
        ...attributes
      },
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockSetSubscriptionAttributes(success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createSNSError('InvalidParameterException', 'Invalid attribute')
      );
    }
    return this;
  }

  mockConfirmSubscription(options: {
    subscriptionArn?: string;
  } = {}) {
    const response = {
      SubscriptionArn: options.subscriptionArn || this.generateSubscriptionArn(),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Message Filtering
  mockSetSubscriptionFilterPolicy(policy: Record<string, any>, success = true) {
    if (success) {
      const response = {
        $metadata: {
          httpStatusCode: 200,
          requestId: this.generateRequestId()
        }
      };
      this.mockClient.send.mockResolvedValueOnce(response);
    } else {
      this.mockClient.send.mockRejectedValueOnce(
        this.createSNSError('InvalidParameterException', 'Invalid filter policy')
      );
    }
    return this;
  }

  // Platform Application Operations (for mobile push)
  mockCreatePlatformApplication(applicationArn?: string) {
    const response = {
      PlatformApplicationArn: applicationArn || this.generatePlatformApplicationArn(),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  mockCreatePlatformEndpoint(endpointArn?: string) {
    const response = {
      EndpointArn: endpointArn || this.generateEndpointArn(),
      $metadata: {
        httpStatusCode: 200,
        requestId: this.generateRequestId()
      }
    };

    this.mockClient.send.mockResolvedValueOnce(response);
    return this;
  }

  // Utility Methods
  getClient() {
    return this.mockClient;
  }

  reset() {
    this.mockClient.send.mockReset();
    this.subscriptions.clear();
    this.messages = [];
    return this;
  }

  getCallCount() {
    return this.mockClient.send.mock.calls.length;
  }

  getPublishedMessages() {
    return [...this.messages];
  }

  // Helper Methods
  private createSNSError(code: string, message: string, statusCode = 400) {
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

  private generateMessageId() {
    return `${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 4)}-${Math.random().toString(36).substr(2, 12)}`;
  }

  private generateSubscriptionArn() {
    return `arn:aws:sns:${this.config.region}:123456789012:test-topic:${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePlatformApplicationArn() {
    return `arn:aws:sns:${this.config.region}:123456789012:app/GCM/test-app`;
  }

  private generateEndpointArn() {
    return `arn:aws:sns:${this.config.region}:123456789012:endpoint/GCM/test-app/${Math.random().toString(36).substr(2, 9)}`;
  }

  // Realistic Scenario Builders
  mockCompleteSubscriptionFlow(protocol: string, endpoint: string) {
    const subscriptionArn = this.generateSubscriptionArn();
    
    // Subscribe
    this.mockSubscribe({ subscriptionArn, protocol, endpoint });
    
    // Confirm subscription
    this.mockConfirmSubscription({ subscriptionArn });
    
    return { subscriptionArn, protocol, endpoint };
  }

  mockPublishWithRetry(retries = 2) {
    // Fail first attempts
    for (let i = 0; i < retries; i++) {
      this.mockPublishError('ServiceUnavailable', 'Service temporarily unavailable');
    }
    
    // Succeed on final attempt
    this.mockPublish();
    
    return this;
  }
}

// Export convenience function
export const createSNSMock = (config?: SNSMockConfig) => {
  return new SNSMockFactory(config);
};
