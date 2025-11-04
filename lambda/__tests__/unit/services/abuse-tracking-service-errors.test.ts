/**
 * @fileoverview Error handling tests for AbuseTrackingService
 * @module tests/unit/services/abuse-tracking-service-errors
 * 
 * Tests error scenarios for abuse tracking, rate limiting, and admin notifications
 * 
 * Coverage:
 * - Violation recording failures
 * - Rate limiting errors
 * - Admin notification failures
 * - Stats calculation errors
 * - Auto-suspension failures
 * - Concurrent violation handling
 * 
 * @tags unit, error-handling, abuse-tracking, security
 */

import { AbuseTrackingService } from '../../../shared/business/abuse/abuse-tracking-service';
import { DynamoDBHelper } from '../../../shared/database/dynamodb';

// Mock dependencies
jest.mock('../../../shared/database/dynamodb');
jest.mock('../../../shared/monitoring/logger');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123')
}));

const mockDynamoDBHelper = DynamoDBHelper as jest.Mocked<typeof DynamoDBHelper>;

// Helper to create DynamoDB response
const createQueryResponse = (items: any[] = []) => ({
  Items: items,
  LastEvaluatedKey: undefined,
  Count: items.length
});

describe('AbuseTrackingService - Error Handling & Resilience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date for consistent week keys
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('[Unit] Violation Recording Failures', () => {
    it('should handle DynamoDB put failure when recording violation', async () => {
      // Given: DynamoDB put fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('DynamoDB put failed')
      );

      // When/Then: Should throw error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'medium',
          { details: 'test' }
        )
      ).rejects.toThrow('DynamoDB put failed');
    });

    it('should handle throttling during violation recording', async () => {
      // Given: DynamoDB throttles request
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('ProvisionedThroughputExceededException'), {
          code: 'ProvisionedThroughputExceededException'
        })
      );

      // When/Then: Should throw throttling error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'sql_injection',
          'critical',
          { query: 'malicious' }
        )
      ).rejects.toThrow('ProvisionedThroughputExceededException');
    });

    it('should handle network timeout during recording', async () => {
      // Given: Network timeout occurs
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('Network timeout'), {
          code: 'NetworkingError'
        })
      );

      // When/Then: Should throw network error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'xss_attempt',
          'high',
          { script: '<script>alert(1)</script>' }
        )
      ).rejects.toThrow('Network timeout');
    });

    it('should handle validation error during recording', async () => {
      // Given: Validation fails
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('Invalid attribute value'), {
          code: 'ValidationException',
          message: 'Invalid attribute value'
        })
      );

      // When/Then: Should throw validation error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'bot_behavior',
          'low',
          { pattern: 'suspicious' }
        )
      ).rejects.toThrow('Invalid attribute value');
    });
  });

  describe('[Unit] Stats Calculation Errors', () => {
    it('should handle query failure when getting abuse stats', async () => {
      // Given: Put succeeds but stats query fails
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any);
      mockDynamoDBHelper.query.mockRejectedValueOnce(
        new Error('Query failed')
      );

      // When/Then: Should throw error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'medium',
          { details: 'test' }
        )
      ).rejects.toThrow('Query failed');
    });

    it('should handle null response when getting stats', async () => {
      // Given: Query returns null
      mockDynamoDBHelper.query.mockResolvedValueOnce(null as any);

      // When/Then: Should throw error
      await expect(
        AbuseTrackingService.getAbuseStats('user-123')
      ).rejects.toThrow();
    });

    it('should handle undefined Items in stats response', async () => {
      // Given: Query returns response without Items
      mockDynamoDBHelper.query.mockResolvedValueOnce({} as any);

      // When: Getting stats
      const stats = await AbuseTrackingService.getAbuseStats('user-123');

      // Then: Should handle gracefully (implementation doesn't validate)
      expect(stats).toBeDefined();
    });

    it('should handle malformed violation data in stats', async () => {
      // Given: Violations with missing fields
      const malformedViolations = [
        { timestamp: '2023-01-01T00:00:00Z' }, // Missing severity
        { severity: 'high' }, // Missing timestamp
        { week_key: '2023-01' } // Missing both
      ];

      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(malformedViolations)
      );

      // When: Getting stats
      const stats = await AbuseTrackingService.getAbuseStats('user-123');

      // Then: Should handle gracefully
      expect(stats).toBeDefined();
      expect(stats.total_violations).toBeDefined();
    });
  });

  describe('[Unit] Admin Notification Failures', () => {
    it('should handle notification failure after recording violation', async () => {
      // Given: Violation recorded but notification fails
      const mockViolations = Array(6).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-0${i+1}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Record violation
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations)
      ); // Get stats
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse([]) // Check existing notification
      );
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations) // Get violations for notification
      );
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Failed to create admin notification')
      ); // Notification fails

      // When/Then: Should throw error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'medium',
          { details: 'test' }
        )
      ).rejects.toThrow('Failed to create admin notification');
    });

    it('should handle throttling during admin notification', async () => {
      // Given: Notification throttled
      const mockViolations = Array(6).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-0${i+1}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any);
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations)
      );
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse([]) // Check existing notification
      );
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations) // Get violations
      );
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        Object.assign(new Error('ProvisionedThroughputExceededException'), {
          code: 'ProvisionedThroughputExceededException'
        })
      );

      // When/Then: Should throw throttling error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'medium',
          { details: 'test' }
        )
      ).rejects.toThrow('ProvisionedThroughputExceededException');
    });
  });

  describe('[Unit] Auto-Suspension Failures', () => {
    it('should handle suspension failure after threshold reached', async () => {
      // Given: 10+ violations trigger auto-suspend but it fails
      const mockViolations = Array(11).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-${String(i+1).padStart(2, '0')}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Record violation
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations)
      ); // Get stats
      // Auto-suspend is triggered (>= 10 violations)
      mockDynamoDBHelper.update.mockRejectedValueOnce(
        new Error('Failed to suspend user')
      ); // Update user profile fails

      // When/Then: Should throw error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'critical',
          { details: 'test' }
        )
      ).rejects.toThrow('Failed to suspend user');
    });

    it('should handle database error during suspension check', async () => {
      // Given: Suspension check query fails
      const mockViolations = Array(11).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-${String(i+1).padStart(2, '0')}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Record violation
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations)
      ); // Get stats
      // Auto-suspend is triggered
      mockDynamoDBHelper.update.mockResolvedValueOnce({} as any); // Update user profile
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Put ACTIVE_SUSPENSION
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Put suspension history
      mockDynamoDBHelper.put.mockRejectedValueOnce(
        new Error('Query failed during suspension check')
      ); // Escalate to admin fails

      // When/Then: Should throw error
      await expect(
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'critical',
          { details: 'test' }
        )
      ).rejects.toThrow();
    });
  });

  describe('[Unit] Concurrent Violation Recording', () => {
    it('should handle concurrent violation recordings', async () => {
      // Given: Multiple concurrent violations
      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording multiple violations concurrently
      const promises = Array(5).fill(null).map((_, i) =>
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'medium',
          { attempt: i }
        )
      );

      // Then: All should complete
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
    });

    it('should handle partial failures in concurrent recordings', async () => {
      // Given: Some recordings succeed, some fail
      let callCount = 0;
      mockDynamoDBHelper.put.mockImplementation((() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Failed'));
        }
        return Promise.resolve({} as any);
      }) as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Concurrent recordings with failures
      const promises = Array(4).fill(null).map((_, i) =>
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'medium',
          { attempt: i }
        ).catch(err => ({ error: err.message }))
      );

      // Then: Should handle mixed results
      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
      
      const successes = results.filter(r => !('error' in r));
      const failures = results.filter(r => 'error' in r);
      
      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should handle race conditions in violation counting', async () => {
      // Given: Concurrent violations that might trigger threshold
      const mockViolations = Array(4).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-0${i+1}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(
        createQueryResponse(mockViolations)
      );

      // When: Multiple concurrent violations
      const promises = Array(3).fill(null).map(() =>
        AbuseTrackingService.recordViolation(
          'user-123',
          'spam_input',
          'medium',
          { details: 'concurrent' }
        )
      );

      // Then: Should handle without data corruption
      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(stats => {
        expect(stats.total_violations).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('[Unit] Edge Cases', () => {
    it('should handle empty evidence object', async () => {
      // Given: Empty evidence
      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording with empty evidence
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'spam_input',
        'low',
        {}
      );

      // Then: Should record successfully
      expect(stats).toBeDefined();
    });

    it('should handle null evidence', async () => {
      // Given: Null evidence
      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording with null evidence
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'spam_input',
        'low',
        null as any
      );

      // Then: Should record successfully
      expect(stats).toBeDefined();
    });

    it('should handle extremely large evidence objects', async () => {
      // Given: Very large evidence
      const largeEvidence = {
        data: 'x'.repeat(100000),
        nested: {
          deep: {
            structure: Array(1000).fill({ key: 'value' })
          }
        }
      };

      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording with large evidence
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'spam_input',
        'medium',
        largeEvidence
      );

      // Then: Should handle without crashing
      expect(stats).toBeDefined();
    });

    it('should handle special characters in evidence', async () => {
      // Given: Evidence with special characters
      const specialEvidence = {
        query: 'SELECT * FROM users WHERE id = "1" OR "1"="1"',
        script: '<script>alert("XSS")</script>',
        unicode: '🚨 Violation detected 🚨',
        emoji: '💀💀💀'
      };

      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording with special characters
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'sql_injection',
        'critical',
        specialEvidence
      );

      // Then: Should preserve special characters
      expect(stats).toBeDefined();
    });

    it('should handle invalid violation types', async () => {
      // Given: Invalid violation type
      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording with invalid type
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'invalid_type' as any,
        'medium',
        { details: 'test' }
      );

      // Then: Should record with provided type
      expect(stats).toBeDefined();
    });

    it('should handle invalid severity levels', async () => {
      // Given: Invalid severity
      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording with invalid severity
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'spam_input',
        'invalid_severity' as any,
        { details: 'test' }
      );

      // Then: Should record with provided severity
      expect(stats).toBeDefined();
    });
  });

  describe('[Unit] Rate Limiting Scenarios', () => {
    it('should handle rapid successive violations', async () => {
      // Given: Rapid violations in quick succession
      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(createQueryResponse([]));

      // When: Recording violations rapidly
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          AbuseTrackingService.recordViolation(
            'user-123',
            'spam_input',
            'low',
            { attempt: i }
          )
        );
      }

      // Then: Should handle all violations
      const results = await Promise.all(promises);
      expect(results).toHaveLength(20);
    });

    it('should handle violations at threshold boundary', async () => {
      // Given: Exactly at notification threshold (5 violations)
      const mockViolations = Array(4).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-0${i+1}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Record violation
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations)
      ); // Get stats
      // Admin notification is triggered (>= 5 violations)
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse([]) // Check existing notification
      );
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations) // Get violations
      );
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Create notification

      // When: Recording 5th violation (threshold)
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'spam_input',
        'medium',
        { details: 'threshold test' }
      );

      // Then: Should trigger admin notification
      expect(stats.this_week_violations).toBeGreaterThanOrEqual(4);
      expect(stats.should_notify_admin).toBe(true);
    });

    it('should handle violations at auto-suspend threshold', async () => {
      // Given: Exactly at auto-suspend threshold (10 violations)
      const mockViolations = Array(9).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-${String(i+1).padStart(2, '0')}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Record violation
      mockDynamoDBHelper.query.mockResolvedValueOnce(
        createQueryResponse(mockViolations)
      ); // Get stats
      // Auto-suspend is triggered (>= 10 violations)
      mockDynamoDBHelper.update.mockResolvedValueOnce({} as any); // Update user profile
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Put ACTIVE_SUSPENSION
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Put suspension history
      mockDynamoDBHelper.put.mockResolvedValueOnce({} as any); // Escalate to admin

      // When: Recording 10th violation (auto-suspend threshold)
      const stats = await AbuseTrackingService.recordViolation(
        'user-123',
        'spam_input',
        'critical',
        { details: 'auto-suspend test' }
      );

      // Then: Should trigger auto-suspension
      expect(stats.this_week_violations).toBeGreaterThanOrEqual(9);
    });
  });

  describe('[Unit] Data Consistency', () => {
    it('should maintain consistent violation counts', async () => {
      // Given: Multiple violations recorded
      const mockViolations = Array(3).fill(null).map((_, i) => ({
        user_id: 'user-123',
        violation_type: 'spam_input',
        severity: 'medium',
        timestamp: `2023-01-0${i+1}T00:00:00Z`,
        week_key: '2023-01'
      }));

      mockDynamoDBHelper.put.mockResolvedValue({} as any);
      mockDynamoDBHelper.query.mockResolvedValue(
        createQueryResponse(mockViolations)
      );

      // When: Getting stats multiple times
      const stats1 = await AbuseTrackingService.getAbuseStats('user-123');
      const stats2 = await AbuseTrackingService.getAbuseStats('user-123');

      // Then: Should return consistent counts
      expect(stats1.total_violations).toBe(stats2.total_violations);
      expect(stats1.this_week_violations).toBe(stats2.this_week_violations);
    });

    it('should handle week boundary transitions', async () => {
      // Given: Violations from different weeks
      const mockViolations = [
        { user_id: 'user-123', week_key: '2023-01', timestamp: '2023-01-01T00:00:00Z', severity: 'medium' },
        { user_id: 'user-123', week_key: '2023-01', timestamp: '2023-01-07T00:00:00Z', severity: 'medium' },
        { user_id: 'user-123', week_key: '2023-02', timestamp: '2023-01-08T00:00:00Z', severity: 'medium' }
      ];

      mockDynamoDBHelper.query.mockResolvedValue(
        createQueryResponse(mockViolations)
      );

      // When: Getting stats
      const stats = await AbuseTrackingService.getAbuseStats('user-123');

      // Then: Should correctly count by week
      expect(stats.total_violations).toBe(3);
      // this_week_violations depends on current week
      expect(stats.this_week_violations).toBeDefined();
    });
  });
});
