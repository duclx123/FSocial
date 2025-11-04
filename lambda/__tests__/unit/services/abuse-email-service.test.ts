/**
 * Abuse Email Service Tests
 * Tests email notifications for abuse warnings and suspensions
 */

import { AbuseEmailService } from '../../../shared/business/abuse/abuse-email-service';
import { DynamoDBHelper } from '../../../shared/database/dynamodb';
import { logger } from '../../../shared/monitoring/logger';

// Get the mocked send function
const { __mockSend } = require('@aws-sdk/client-sns') as any;
const mockSendInstance = __mockSend;

// Mock dependencies
jest.mock('../../../shared/database/dynamodb');
jest.mock('../../../shared/monitoring/logger');

// Mock SNS before importing service
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-sns', () => {
    const mockSendFn = jest.fn();
    return {
        SNSClient: jest.fn(() => ({
            send: mockSendFn
        })),
        PublishCommand: jest.fn((input) => ({ input })),
        __mockSend: mockSendFn
    };
});

describe('AbuseEmailService', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSendInstance.mockClear();

        // Setup environment
        process.env = {
            ...originalEnv,
            SNS_TOPIC_ARN: 'arn:aws:sns:us-east-1:123456789012:test-topic',
            FRONTEND_URL: 'https://test.example.com'
        };

        // Mock SNS send to return success
        mockSendInstance.mockResolvedValue({
            MessageId: 'test-message-id',
            $metadata: { httpStatusCode: 200 }
        });
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('sendSuspensionEmail', () => {
        const mockUser = {
            email: 'user@example.com',
            display_name: 'Test User',
            username: 'testuser'
        };

        const mockViolations = [
            {
                user_id: 'user123',
                violation_type: 'spam_input' as const,
                severity: 'high' as const,
                evidence: { post_id: 'post123' },
                timestamp: '2025-10-22T10:00:00Z',
                week_key: '2025-43'
            },
            {
                user_id: 'user123',
                violation_type: 'sql_injection' as const,
                severity: 'critical' as const,
                evidence: { comment_id: 'comment456' },
                timestamp: '2025-10-22T11:00:00Z',
                week_key: '2025-43'
            }
        ];

        beforeEach(() => {
            (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockUser);
        });

        it('should send suspension email with tier 1 details', async () => {
            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                1,
                '2025-10-22T11:00:00Z',
                10,
                mockViolations
            );

            expect(DynamoDBHelper.get).toHaveBeenCalledWith('USER#user123', 'PROFILE');
            expect(mockSendInstance).toHaveBeenCalledTimes(1);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            expect(publishCommand.input).toBeDefined();

            const input = publishCommand.input;
            expect(input.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-topic');
            expect(input.Subject).toContain('Suspended');

            const message = JSON.parse(input.Message);
            expect(message.type).toBe('account_suspension');
            expect(message.to).toBe('user@example.com');
            expect(message.userId).toBe('user123');
            expect(message.tier).toBe(1);
            expect(message.violationCount).toBe(10);
            expect(message.body).toContain('1 hour suspension');
            expect(message.body).toContain('spam_input');
            expect(message.body).toContain('post123');
        });

        it('should send suspension email with tier 2 details', async () => {
            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                2,
                '2025-10-23T10:00:00Z',
                15,
                mockViolations
            );

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.tier).toBe(2);
            expect(message.body).toContain('24 hour suspension');
            expect(message.body).toContain('APPEAL PROCESS');
        });

        it('should send suspension email with tier 3 (no appeal)', async () => {
            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                3,
                '2025-11-21T10:00:00Z',
                30,
                mockViolations
            );

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.tier).toBe(3);
            expect(message.body).toContain('30 day suspension');
            expect(message.body).toContain('cannot be appealed');
            expect(message.body).not.toContain('APPEAL PROCESS');
        });

        it('should include violation details with post links', async () => {
            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                1,
                '2025-10-22T11:00:00Z',
                10,
                mockViolations
            );

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('spam_input (high)');
            expect(message.body).toContain('https://test.example.com/posts/post123');
            expect(message.body).toContain('sql_injection (critical)');
            expect(message.body).toContain('comment456');
        });

        it('should handle more than 5 violations', async () => {
            const manyViolations: any[] = Array.from({ length: 10 }, (_, i) => ({
                user_id: 'user123',
                violation_type: 'spam_input' as const,
                severity: 'medium' as const,
                evidence: { post_id: `post${i}` },
                timestamp: `2025-10-22T${10 + i}:00:00Z`,
                week_key: '2025-43'
            }));

            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                2,
                '2025-10-23T10:00:00Z',
                10,
                manyViolations
            );

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('and 5 more violations');
        });

        it('should handle user without email gracefully', async () => {
            (DynamoDBHelper.get as jest.Mock).mockResolvedValue({ username: 'testuser' });

            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                1,
                '2025-10-22T11:00:00Z',
                10,
                mockViolations
            );

            expect(logger.warn).toHaveBeenCalledWith(
                'Cannot send suspension email - no email found',
                { userId: 'user123' }
            );
            expect(mockSendInstance).not.toHaveBeenCalled();
        });

        it('should handle SNS errors gracefully', async () => {
            const snsError = new Error('SNS service unavailable');
            mockSendInstance.mockRejectedValueOnce(snsError);

            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                1,
                '2025-10-22T11:00:00Z',
                10,
                mockViolations
            );

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to send suspension email',
                { error: snsError, userId: 'user123' }
            );
        });

        it('should use display_name if available, fallback to username', async () => {
            (DynamoDBHelper.get as jest.Mock).mockResolvedValue({
                email: 'user@example.com',
                username: 'testuser'
            });

            await AbuseEmailService.sendSuspensionEmail(
                'user123',
                1,
                '2025-10-22T11:00:00Z',
                10,
                mockViolations
            );

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('Dear testuser');
        });
    });

    describe('sendWarningEmail', () => {
        const mockUser = {
            email: 'user@example.com',
            display_name: 'Test User',
            username: 'testuser'
        };

        const mockViolations = [
            {
                user_id: 'user123',
                violation_type: 'spam_input' as const,
                severity: 'medium' as const,
                evidence: { post_id: 'post123' },
                timestamp: '2025-10-22T10:00:00Z',
                week_key: '2025-43'
            },
            {
                user_id: 'user123',
                violation_type: 'fake_rating' as const,
                severity: 'high' as const,
                evidence: { recipe_id: 'recipe456' },
                timestamp: '2025-10-22T11:00:00Z',
                week_key: '2025-43'
            },
            {
                user_id: 'user123',
                violation_type: 'bot_behavior' as const,
                severity: 'low' as const,
                evidence: {},
                timestamp: '2025-10-22T12:00:00Z',
                week_key: '2025-43'
            }
        ];

        beforeEach(() => {
            (DynamoDBHelper.get as jest.Mock).mockResolvedValue(mockUser);
        });

        it('should send warning email with violation details', async () => {
            await AbuseEmailService.sendWarningEmail('user123', 5, mockViolations);

            expect(DynamoDBHelper.get).toHaveBeenCalledWith('USER#user123', 'PROFILE');
            expect(mockSendInstance).toHaveBeenCalledTimes(1);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            expect(publishCommand.input).toBeDefined();

            const input = publishCommand.input;
            expect(input.TopicArn).toBe('arn:aws:sns:us-east-1:123456789012:test-topic');
            expect(input.Subject).toContain('Warning');

            const message = JSON.parse(input.Message);
            expect(message.type).toBe('abuse_warning');
            expect(message.to).toBe('user@example.com');
            expect(message.userId).toBe('user123');
            expect(message.violationCount).toBe(5);
            expect(message.violations).toHaveLength(3);
        });

        it('should include all violation types with links', async () => {
            await AbuseEmailService.sendWarningEmail('user123', 5, mockViolations);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('spam_input (medium)');
            expect(message.body).toContain('https://test.example.com/posts/post123');
            expect(message.body).toContain('fake_rating (high)');
            expect(message.body).toContain('https://test.example.com/recipes/recipe456');
            expect(message.body).toContain('bot_behavior (low)');
        });

        it('should warn about suspension threshold', async () => {
            await AbuseEmailService.sendWarningEmail('user123', 5, mockViolations);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('5 violations this week');
            expect(message.body).toContain('At 10 violations, your account will be AUTOMATICALLY SUSPENDED');
        });

        it('should handle more than 5 violations', async () => {
            const manyViolations: any[] = Array.from({ length: 8 }, (_, i) => ({
                user_id: 'user123',
                violation_type: 'spam_input' as const,
                severity: 'low' as const,
                evidence: { post_id: `post${i}` },
                timestamp: `2025-10-22T${10 + i}:00:00Z`,
                week_key: '2025-43'
            }));

            await AbuseEmailService.sendWarningEmail('user123', 8, manyViolations);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('and 3 more violations');
            expect(message.violations).toHaveLength(5); // Only first 5 in metadata
        });

        it('should handle user without email gracefully', async () => {
            (DynamoDBHelper.get as jest.Mock).mockResolvedValue({ username: 'testuser' });

            await AbuseEmailService.sendWarningEmail('user123', 5, mockViolations);

            expect(logger.warn).toHaveBeenCalledWith(
                'Cannot send warning email - no email found',
                { userId: 'user123' }
            );
            expect(mockSendInstance).not.toHaveBeenCalled();
        });

        it('should handle SNS errors gracefully', async () => {
            const snsError = new Error('SNS throttling');
            mockSendInstance.mockRejectedValueOnce(snsError);

            await AbuseEmailService.sendWarningEmail('user123', 5, mockViolations);

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to send warning email',
                { error: snsError, userId: 'user123' }
            );
        });

        it('should include community guidelines link', async () => {
            await AbuseEmailService.sendWarningEmail('user123', 5, mockViolations);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('https://test.example.com/guidelines');
        });

        it('should list violation types to avoid', async () => {
            await AbuseEmailService.sendWarningEmail('user123', 5, mockViolations);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('Spam or repetitive content');
            expect(message.body).toContain('SQL injection or XSS attempts');
            expect(message.body).toContain('Fake ratings or reviews');
            expect(message.body).toContain('Bot-like behavior');
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing SNS_TOPIC_ARN', async () => {
            delete process.env.SNS_TOPIC_ARN;

            // Re-import to get new env
            jest.resetModules();
            const { AbuseEmailService: NewService } = require('../../../shared/business/abuse/abuse-email-service');

            (DynamoDBHelper.get as jest.Mock).mockResolvedValue({
                email: 'user@example.com',
                username: 'testuser'
            });

            await NewService.sendWarningEmail('user123', 5, []);

            // Should still attempt to send with empty string
            expect(mockSendInstance).toHaveBeenCalled();
        });

        it('should handle violations without evidence', async () => {
            (DynamoDBHelper.get as jest.Mock).mockResolvedValue({
                email: 'user@example.com',
                username: 'testuser'
            });

            const violationsNoEvidence: any[] = [
                {
                    user_id: 'user123',
                    violation_type: 'spam_input' as const,
                    severity: 'low' as const,
                    evidence: {},
                    timestamp: '2025-10-22T10:00:00Z',
                    week_key: '2025-43'
                }
            ];

            await AbuseEmailService.sendWarningEmail('user123', 5, violationsNoEvidence);

            const publishCommand = mockSendInstance.mock.calls[0][0];
            const message = JSON.parse(publishCommand.input.Message);

            expect(message.body).toContain('spam_input (low)');
            expect(message.body).not.toContain('Post:');
            expect(message.body).not.toContain('Comment:');
        });
    });
});
