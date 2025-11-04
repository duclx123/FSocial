/**
 * Admin Handler Unit Tests
 * 
 * Tests for admin dashboard operations, user management, and violation tracking
 */

import { handler } from '../../admin/index';
import { dynamoMock, resetAllMocks } from '../test-utils/mocks/aws-mocks';
import { mockDynamoDBHelpers } from '../test-utils/mocks/aws-mocks';
import { 
  createAuthenticatedAPIGatewayEvent,
  parseResponseBody,
  assertSuccessResponse,
  assertErrorResponse,
  createFutureDate,
  createPastDate
} from '../test-utils/helpers/test-helpers';
import { mockUsers } from '../test-utils/fixtures/user-fixtures';
import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from '../../shared/utils/types';

// Helper to cast event to the correct type
const castEvent = (event: any): APIGatewayEvent => event as unknown as APIGatewayEvent;

describe('Admin Handler - Unit Tests', () => {
  beforeEach(() => {
    resetAllMocks();
    // Set environment variables
    process.env.TABLE_NAME = 'test-table';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should return 403 when user is not admin', async () => {
      // Arrange - Create event without admin group
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/admin/stats',
        mockUsers.user1.user_id,
        mockUsers.user1.email
      );
      // Remove admin group
      event.requestContext.authorizer!.claims = {
        sub: mockUsers.user1.user_id,
        email: mockUsers.user1.email,
        'cognito:username': mockUsers.user1.username,
        'cognito:groups': '' // No admin group
      };

      // Act
      const response = await handler(castEvent(event));

      // Assert
      assertErrorResponse(response, 403);
      const body = parseResponseBody(response);
      expect(body.message).toContain('Admin access required');
    });

    it('should allow access when user has admin group', async () => {
      // Arrange
      const event = createAuthenticatedAPIGatewayEvent(
        'GET',
        '/admin/stats',
        mockUsers.adminUser.user_id,
        mockUsers.adminUser.email
      );
      event.requestContext.authorizer!.claims = {
        sub: mockUsers.adminUser.user_id,
        email: mockUsers.adminUser.email,
        'cognito:username': mockUsers.adminUser.username,
        'cognito:groups': 'admin'
      };

      // Mock DynamoDB responses for stats
      dynamoMock.on(QueryCommand).resolves({
        Items: [],
        Count: 0
      });

      // Act
      const response = await handler(castEvent(event));

      // Assert
      expect(response.statusCode).toBe(200);
    });
  });

  describe('User Management', () => {
    const createAdminEvent = (method: string, path: string, body?: any, pathParams?: any) => {
      const event = createAuthenticatedAPIGatewayEvent(
        method,
        path,
        mockUsers.adminUser.user_id,
        mockUsers.adminUser.email,
        body,
        pathParams
      );
      event.requestContext.authorizer!.claims = {
        sub: mockUsers.adminUser.user_id,
        email: mockUsers.adminUser.email,
        'cognito:username': mockUsers.adminUser.username,
        'cognito:groups': 'admin'
      };
      return event;
    };

    describe('GET /admin/users/suspended - List suspended users', () => {
      it('should list all suspended users', async () => {
        // Arrange
        const suspendedUsers = [
          {
            PK: `USER#${mockUsers.suspendedUser.user_id}`,
            SK: 'PROFILE',
            GSI1_PK: 'USER_ALL',
            username: mockUsers.suspendedUser.username,
            email: mockUsers.suspendedUser.email,
            is_suspended: true,
            suspended_at: createPastDate(5),
            suspended_until: createFutureDate(25),
            suspension_reason: 'Multiple policy violations',
            suspended_by: 'admin',
            admin_id: mockUsers.adminUser.user_id,
            violation_count: 3
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: suspendedUsers,
          Count: 1
        });

        const event = createAdminEvent('GET', '/admin/users/suspended');

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.users).toBeDefined();
        expect(body.data.users.length).toBe(1);
        expect(body.data.users[0].user_id).toBe(mockUsers.suspendedUser.user_id);
        expect(body.data.users[0].suspension_reason).toBe('Multiple policy violations');
      });

      it('should return empty array when no suspended users', async () => {
        // Arrange
        dynamoMock.on(QueryCommand).resolves({
          Items: [],
          Count: 0
        });

        const event = createAdminEvent('GET', '/admin/users/suspended');

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.users).toEqual([]);
      });
    });

    describe('POST /admin/users/{userId}/ban - Ban user', () => {
      it('should successfully ban a user', async () => {
        // Arrange
        mockDynamoDBHelpers.mockUpdateItem({});
        mockDynamoDBHelpers.mockPutItem(); // For logging admin action

        const event = createAdminEvent(
          'POST',
          '/admin/users/user-1/ban',
          {
            reason: 'Spam posting',
            duration_days: 30
          },
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.success).toBe(true);
        expect(body.data.user_id).toBe('user-1');
        expect(body.data.suspended_until).toBeDefined();
        expect(body.data.message).toContain('banned');
      });

      it('should return 400 when reason is missing', async () => {
        // Arrange
        const event = createAdminEvent(
          'POST',
          '/admin/users/user-1/ban',
          {
            duration_days: 30
          },
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 400);
        const body = parseResponseBody(response);
        expect(body.message).toContain('reason');
      });

      it('should return 400 when body is missing', async () => {
        // Arrange
        const event = createAdminEvent(
          'POST',
          '/admin/users/user-1/ban',
          undefined,
          { userId: 'user-1' }
        );
        event.body = null;

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 400);
        const body = parseResponseBody(response);
        expect(body.message).toContain('body required');
      });
    });

    describe('POST /admin/users/{userId}/unban - Unban user', () => {
      it('should successfully unban a user', async () => {
        // Arrange
        mockDynamoDBHelpers.mockUpdateItem({});
        mockDynamoDBHelpers.mockPutItem(); // For logging admin action

        const event = createAdminEvent(
          'POST',
          '/admin/users/user-suspended/unban',
          {
            reason: 'Appeal approved'
          },
          { userId: 'user-suspended' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.success).toBe(true);
        expect(body.data.user_id).toBe('user-suspended');
        expect(body.data.message).toContain('unbanned');
      });

      it('should unban user with default reason when body is empty', async () => {
        // Arrange
        mockDynamoDBHelpers.mockUpdateItem({});
        mockDynamoDBHelpers.mockPutItem();

        const event = createAdminEvent(
          'POST',
          '/admin/users/user-suspended/unban',
          undefined,
          { userId: 'user-suspended' }
        );
        event.body = null;

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.success).toBe(true);
      });
    });

    describe('Non-admin access attempts', () => {
      it('should reject non-admin user attempting to ban', async () => {
        // Arrange
        const event = createAuthenticatedAPIGatewayEvent(
          'POST',
          '/admin/users/user-2/ban',
          mockUsers.user1.user_id,
          mockUsers.user1.email,
          { reason: 'Test', duration_days: 30 },
          { userId: 'user-2' }
        );
        event.requestContext.authorizer!.claims = {
          sub: mockUsers.user1.user_id,
          email: mockUsers.user1.email,
          'cognito:username': mockUsers.user1.username,
          'cognito:groups': '' // Not admin
        };

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 403);
        const body = parseResponseBody(response);
        expect(body.message).toContain('Admin access required');
      });

      it('should reject non-admin user attempting to unban', async () => {
        // Arrange
        const event = createAuthenticatedAPIGatewayEvent(
          'POST',
          '/admin/users/user-suspended/unban',
          mockUsers.user1.user_id,
          mockUsers.user1.email,
          { reason: 'Test' },
          { userId: 'user-suspended' }
        );
        event.requestContext.authorizer!.claims = {
          sub: mockUsers.user1.user_id,
          email: mockUsers.user1.email,
          'cognito:username': mockUsers.user1.username,
          'cognito:groups': ''
        };

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 403);
      });

      it('should reject non-admin user attempting to view suspended users', async () => {
        // Arrange
        const event = createAuthenticatedAPIGatewayEvent(
          'GET',
          '/admin/users/suspended',
          mockUsers.user1.user_id,
          mockUsers.user1.email
        );
        event.requestContext.authorizer!.claims = {
          sub: mockUsers.user1.user_id,
          email: mockUsers.user1.email,
          'cognito:username': mockUsers.user1.username,
          'cognito:groups': ''
        };

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 403);
      });
    });
  });

  describe('Content Moderation', () => {
    const createAdminEvent = (method: string, path: string, body?: any, pathParams?: any, queryParams?: any) => {
      const event = createAuthenticatedAPIGatewayEvent(
        method,
        path,
        mockUsers.adminUser.user_id,
        mockUsers.adminUser.email,
        body,
        pathParams,
        queryParams
      );
      event.requestContext.authorizer!.claims = {
        sub: mockUsers.adminUser.user_id,
        email: mockUsers.adminUser.email,
        'cognito:username': mockUsers.adminUser.username,
        'cognito:groups': 'admin'
      };
      return event;
    };

    describe('GET /admin/stats - Get system statistics', () => {
      it('should return database statistics', async () => {
        // Arrange - Mock multiple queries for different stats
        dynamoMock.on(QueryCommand).resolves({
          Items: [],
          Count: 0
        });

        const event = createAdminEvent('GET', '/admin/stats');

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.timestamp).toBeDefined();
        expect(body.data.counts).toBeDefined();
        expect(body.data.growth).toBeDefined();
      });
    });

    describe('GET /admin/recipes/pending - View pending recipes', () => {
      it('should list pending recipes for review', async () => {
        // Arrange
        const pendingRecipes = [
          {
            PK: 'RECIPE#recipe-1',
            SK: 'METADATA',
            GSI1_PK: 'RECIPE_ALL',
            recipe_name: 'Pho Bo',
            user_id: 'user-1',
            username: 'testuser1',
            status: 'pending',
            category: 'vietnamese',
            ingredients: ['beef', 'rice noodles', 'star anise'],
            created_at: '2025-01-15T10:00:00.000Z',
            needs_review: true
          },
          {
            PK: 'RECIPE#recipe-2',
            SK: 'METADATA',
            GSI1_PK: 'RECIPE_ALL',
            recipe_name: 'Banh Mi',
            user_id: 'system',
            username: 'AI Generated',
            status: 'pending',
            category: 'vietnamese',
            ingredients: ['baguette', 'pork', 'pickled vegetables'],
            created_at: '2025-01-15T11:00:00.000Z',
            needs_review: true
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: pendingRecipes,
          Count: 2
        });

        const event = createAdminEvent('GET', '/admin/recipes/pending');

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.recipes).toBeDefined();
        expect(body.data.recipes.length).toBe(2);
        expect(body.data.recipes[0].recipe_name).toBe('Pho Bo');
        expect(body.data.recipes[0].status).toBe('pending');
        expect(body.data.recipes[1].username).toBe('AI Generated');
      });

      it('should return empty array when no pending recipes', async () => {
        // Arrange
        dynamoMock.on(QueryCommand).resolves({
          Items: [],
          Count: 0
        });

        const event = createAdminEvent('GET', '/admin/recipes/pending');

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.recipes).toEqual([]);
      });
    });

    describe('PUT /admin/recipes/{recipeId}/approve - Approve recipe', () => {
      it('should successfully approve a recipe', async () => {
        // Arrange
        mockDynamoDBHelpers.mockUpdateItem({});
        mockDynamoDBHelpers.mockPutItem(); // For logging admin action

        const event = createAdminEvent(
          'PUT',
          '/admin/recipes/recipe-1/approve',
          undefined,
          { recipeId: 'recipe-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.success).toBe(true);
        expect(body.data.recipe_id).toBe('recipe-1');
        expect(body.data.message).toContain('approved');
      });
    });

    describe('PUT /admin/recipes/{recipeId}/reject - Reject recipe', () => {
      it('should successfully reject a recipe with reason', async () => {
        // Arrange
        mockDynamoDBHelpers.mockUpdateItem({});
        mockDynamoDBHelpers.mockPutItem(); // For logging admin action

        const event = createAdminEvent(
          'PUT',
          '/admin/recipes/recipe-1/reject',
          {
            reason: 'Incomplete ingredient list'
          },
          { recipeId: 'recipe-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.success).toBe(true);
        expect(body.data.recipe_id).toBe('recipe-1');
        expect(body.data.message).toContain('rejected');
      });

      it('should return 400 when rejection reason is missing', async () => {
        // Arrange
        const event = createAdminEvent(
          'PUT',
          '/admin/recipes/recipe-1/reject',
          {},
          { recipeId: 'recipe-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 400);
        const body = parseResponseBody(response);
        expect(body.message).toContain('reason');
      });

      it('should return 400 when body is missing', async () => {
        // Arrange
        const event = createAdminEvent(
          'PUT',
          '/admin/recipes/recipe-1/reject',
          undefined,
          { recipeId: 'recipe-1' }
        );
        event.body = null;

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 400);
        const body = parseResponseBody(response);
        expect(body.message).toContain('body required');
      });
    });
  });

  describe('Abuse Tracking and Violations', () => {
    const createAdminEvent = (method: string, path: string, body?: any, pathParams?: any, queryParams?: any) => {
      const event = createAuthenticatedAPIGatewayEvent(
        method,
        path,
        mockUsers.adminUser.user_id,
        mockUsers.adminUser.email,
        body,
        pathParams,
        queryParams
      );
      event.requestContext.authorizer!.claims = {
        sub: mockUsers.adminUser.user_id,
        email: mockUsers.adminUser.email,
        'cognito:username': mockUsers.adminUser.username,
        'cognito:groups': 'admin'
      };
      return event;
    };

    describe('GET /admin/violations - View all violations', () => {
      it('should list all violations', async () => {
        // Arrange
        const violations = [
          {
            PK: 'USER#user-1',
            SK: 'VIOLATION#v1',
            GSI1_PK: 'VIOLATION_ALL',
            GSI1_SK: '2025-01-15T10:00:00.000Z',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'low',
            description: 'Posted spam content',
            created_at: '2025-01-15T10:00:00.000Z',
            status: 'pending',
            action_taken: null
          },
          {
            PK: 'USER#user-2',
            SK: 'VIOLATION#v2',
            GSI1_PK: 'VIOLATION_ALL',
            GSI1_SK: '2025-01-15T11:00:00.000Z',
            user_id: 'user-2',
            username: 'testuser2',
            type: 'harassment',
            severity: 'high',
            description: 'Harassing other users',
            created_at: '2025-01-15T11:00:00.000Z',
            status: 'reviewed',
            action_taken: 'warning_issued',
            reviewed_by: mockUsers.adminUser.user_id,
            reviewed_at: '2025-01-15T12:00:00.000Z'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: violations,
          Count: 2
        });

        const event = createAdminEvent('GET', '/admin/violations');

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations).toBeDefined();
        expect(body.data.violations.length).toBe(2);
        expect(body.data.violations[0].type).toBe('spam');
        expect(body.data.violations[1].severity).toBe('high');
      });

      it('should filter violations by severity', async () => {
        // Arrange
        const highSeverityViolations = [
          {
            PK: 'USER#user-2',
            SK: 'VIOLATION#v2',
            GSI1_PK: 'VIOLATION_ALL',
            user_id: 'user-2',
            username: 'testuser2',
            type: 'harassment',
            severity: 'high',
            description: 'Harassing other users',
            created_at: '2025-01-15T11:00:00.000Z',
            status: 'pending'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: highSeverityViolations,
          Count: 1
        });

        const event = createAdminEvent('GET', '/admin/violations', undefined, undefined, {
          severity: 'high'
        });

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations.length).toBe(1);
        expect(body.data.violations[0].severity).toBe('high');
      });

      it('should filter violations by type', async () => {
        // Arrange
        const spamViolations = [
          {
            PK: 'USER#user-1',
            SK: 'VIOLATION#v1',
            GSI1_PK: 'VIOLATION_ALL',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'low',
            description: 'Posted spam content',
            created_at: '2025-01-15T10:00:00.000Z',
            status: 'pending'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: spamViolations,
          Count: 1
        });

        const event = createAdminEvent('GET', '/admin/violations', undefined, undefined, {
          type: 'spam'
        });

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations.length).toBe(1);
        expect(body.data.violations[0].type).toBe('spam');
      });
    });

    describe('GET /admin/violations/summary - Get violation summary', () => {
      it('should return violation summary statistics', async () => {
        // Arrange
        const violations = [
          {
            SK: 'VIOLATION#v1',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'low',
            status: 'pending',
            created_at: '2025-01-15T10:00:00.000Z'
          },
          {
            SK: 'VIOLATION#v2',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'medium',
            status: 'reviewed',
            created_at: '2025-01-15T11:00:00.000Z'
          },
          {
            SK: 'VIOLATION#v3',
            user_id: 'user-2',
            username: 'testuser2',
            type: 'harassment',
            severity: 'high',
            status: 'pending',
            created_at: '2025-01-15T12:00:00.000Z'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: violations,
          Count: 3
        });

        const event = createAdminEvent('GET', '/admin/violations/summary');

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.total_violations).toBe(3);
        expect(body.data.pending_review).toBe(2);
        expect(body.data.by_severity).toBeDefined();
        expect(body.data.by_severity.low).toBe(1);
        expect(body.data.by_severity.medium).toBe(1);
        expect(body.data.by_severity.high).toBe(1);
        expect(body.data.by_type).toBeDefined();
        expect(body.data.top_violators).toBeDefined();
        expect(body.data.recent_violations).toBeDefined();
      });
    });

    describe('GET /admin/violations/user/{userId} - View user violation history', () => {
      it('should return all violations for a specific user', async () => {
        // Arrange
        const userViolations = [
          {
            PK: 'USER#user-1',
            SK: 'VIOLATION#v1',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'low',
            description: 'First violation',
            created_at: '2025-01-10T10:00:00.000Z',
            status: 'reviewed'
          },
          {
            PK: 'USER#user-1',
            SK: 'VIOLATION#v2',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'medium',
            description: 'Second violation',
            created_at: '2025-01-12T10:00:00.000Z',
            status: 'reviewed'
          },
          {
            PK: 'USER#user-1',
            SK: 'VIOLATION#v3',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'inappropriate_content',
            severity: 'high',
            description: 'Third violation - triggers suspension',
            created_at: '2025-01-15T10:00:00.000Z',
            status: 'pending'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: userViolations,
          Count: 3
        });

        const event = createAdminEvent(
          'GET',
          '/admin/violations/user/user-1',
          undefined,
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations).toBeDefined();
        expect(body.data.violations.length).toBe(3);
        expect(body.data.violations[0].user_id).toBe('user-1');
        expect(body.data.violations[2].severity).toBe('high');
      });

      it('should return empty array for user with no violations', async () => {
        // Arrange
        dynamoMock.on(QueryCommand).resolves({
          Items: [],
          Count: 0
        });

        const event = createAdminEvent(
          'GET',
          '/admin/violations/user/user-clean',
          undefined,
          { userId: 'user-clean' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations).toEqual([]);
      });
    });

    describe('PUT /admin/users/{userId}/approve-ban - Approve auto-ban', () => {
      it('should approve automatic ban request', async () => {
        // Arrange
        mockDynamoDBHelpers.mockUpdateItem({});
        mockDynamoDBHelpers.mockPutItem(); // For logging admin action

        const event = createAdminEvent(
          'PUT',
          '/admin/users/user-1/approve-ban',
          {
            notes: 'Tier 3 violation confirmed'
          },
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.success).toBe(true);
        expect(body.data.user_id).toBe('user-1');
        expect(body.data.message).toContain('approved');
      });
    });

    describe('PUT /admin/users/{userId}/reject-ban - Reject auto-ban', () => {
      it('should reject automatic ban and unban user', async () => {
        // Arrange
        mockDynamoDBHelpers.mockUpdateItem({});
        mockDynamoDBHelpers.mockPutItem(); // For logging admin action

        const event = createAdminEvent(
          'PUT',
          '/admin/users/user-1/reject-ban',
          {
            reason: 'False positive - violations not severe enough'
          },
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.success).toBe(true);
        expect(body.data.user_id).toBe('user-1');
        expect(body.data.message).toContain('rejected');
        expect(body.data.message).toContain('unbanned');
      });

      it('should return 400 when rejection reason is missing', async () => {
        // Arrange
        const event = createAdminEvent(
          'PUT',
          '/admin/users/user-1/reject-ban',
          {},
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertErrorResponse(response, 400);
        const body = parseResponseBody(response);
        expect(body.message).toContain('reason');
      });
    });

    describe('Three-tier violation system', () => {
      it('should track tier 1 violation (first offense)', async () => {
        // Arrange
        const tier1Violations = [
          {
            SK: 'VIOLATION#v1',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'low',
            description: 'First violation',
            created_at: '2025-01-15T10:00:00.000Z',
            status: 'pending'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: tier1Violations,
          Count: 1
        });

        const event = createAdminEvent(
          'GET',
          '/admin/violations/user/user-1',
          undefined,
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations.length).toBe(1);
        expect(body.data.violations[0].severity).toBe('low');
      });

      it('should track tier 2 violations (multiple offenses)', async () => {
        // Arrange
        const tier2Violations = [
          {
            SK: 'VIOLATION#v1',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'low',
            created_at: '2025-01-10T10:00:00.000Z',
            status: 'reviewed'
          },
          {
            SK: 'VIOLATION#v2',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'medium',
            created_at: '2025-01-15T10:00:00.000Z',
            status: 'pending'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: tier2Violations,
          Count: 2
        });

        const event = createAdminEvent(
          'GET',
          '/admin/violations/user/user-1',
          undefined,
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations.length).toBe(2);
      });

      it('should track tier 3 violations (triggers auto-suspension)', async () => {
        // Arrange
        const tier3Violations = [
          {
            SK: 'VIOLATION#v1',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'low',
            created_at: '2025-01-10T10:00:00.000Z',
            status: 'reviewed'
          },
          {
            SK: 'VIOLATION#v2',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'spam',
            severity: 'medium',
            created_at: '2025-01-12T10:00:00.000Z',
            status: 'reviewed'
          },
          {
            SK: 'VIOLATION#v3',
            user_id: 'user-1',
            username: 'testuser1',
            type: 'harassment',
            severity: 'high',
            description: 'Third violation - auto-suspension triggered',
            created_at: '2025-01-15T10:00:00.000Z',
            status: 'pending',
            action_taken: 'auto_suspension'
          }
        ];

        dynamoMock.on(QueryCommand).resolves({
          Items: tier3Violations,
          Count: 3
        });

        const event = createAdminEvent(
          'GET',
          '/admin/violations/user/user-1',
          undefined,
          { userId: 'user-1' }
        );

        // Act
        const response = await handler(castEvent(event));

        // Assert
        assertSuccessResponse(response);
        const body = parseResponseBody(response);
        expect(body.data.violations.length).toBe(3);
        expect(body.data.violations[2].action_taken).toBe('auto_suspension');
      });
    });
  });
});




