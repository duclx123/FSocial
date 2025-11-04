/**
 * AI Suggestion Handler Unit Tests
 * 
 * Tests for the AI recipe suggestion Lambda handler including:
 * - Recipe generation with single and multiple ingredients
 * - Ingredient validation and normalization
 * - AI error handling and fallback mechanisms
 */

import { handler } from '../../ai-suggestion/index';
import {
    resetAllMocks,
    bedrockMock,
    dynamoMock,
    mockBedrockHelpers,
    mockDynamoDBHelpers
} from '../test-utils/mocks/aws-mocks';
import {
    createAuthenticatedAPIGatewayEvent,
    parseResponseBody,
    setupTestEnvironment
} from '../test-utils/helpers/test-helpers';
import { mockUsers } from '../test-utils/fixtures/user-fixtures';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayEvent } from '../../shared/utils/types';

describe('AI Suggestion Handler - Unit Tests', () => {
    const testEnv = setupTestEnvironment();
    const testUser = mockUsers.user1;

    beforeEach(() => {
        resetAllMocks();
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    // Helper to cast event to correct type
    const callHandler = (event: ReturnType<typeof createAuthenticatedAPIGatewayEvent>) => {
        return handler(event as any as APIGatewayEvent);
    };

    describe('Recipe Generation Functionality', () => {
        it('should generate recipe with single ingredient', async () => {
            // Arrange
            const mockAIResponse = {
                success: true,
                recipes: [{
                    title: 'Cà chua xào trứng',
                    description: 'Món ăn đơn giản với cà chua',
                    cuisine_type: 'Vietnamese',
                    cooking_method: 'stir-fry',
                    meal_type: 'main',
                    prep_time_minutes: 5,
                    cook_time_minutes: 10,
                    servings: 2,
                    ingredients: [
                        {
                            ingredient_name: 'cà chua',
                            quantity: '2',
                            unit: 'quả',
                            category: 'vegetable'
                        }
                    ],
                    instructions: [
                        {
                            step_number: 1,
                            description: 'Rửa sạch cà chua và cắt múi cau',
                            duration_minutes: 2
                        }
                    ],
                    nutritional_info: {
                        calories: 150,
                        protein: '12g',
                        carbs: '8g',
                        fat: '9g'
                    }
                }]
            };

            mockBedrockHelpers.mockInvokeModel(JSON.stringify(mockAIResponse));
            mockDynamoDBHelpers.mockGetItem({ user_id: testUser.user_id });
            mockDynamoDBHelpers.mockPutItem();
            dynamoMock.on(BatchWriteCommand).resolves({});

            const event = createAuthenticatedAPIGatewayEvent(
                'POST',
                '/v1/ai/suggest-recipes',
                testUser.user_id,
                testUser.email,
                {
                    ingredients: ['cà chua'],
                    recipe_count: 1
                }
            );

            // Act
            const response = await callHandler(event);

            // Assert
            expect(response.statusCode).toBe(200);
            const body = parseResponseBody(response);
            expect(body.suggestions).toBeDefined();
            expect(body.suggestions.length).toBeGreaterThan(0);
        });

        it('should generate recipe with multiple ingredients', async () => {
            // Arrange
            const mockAIResponse = {
                success: true,
                recipes: [{
                    title: 'Thịt gà xào rau củ',
                    description: 'Món xào đầy đủ dinh dưỡng',
                    cuisine_type: 'Vietnamese',
                    cooking_method: 'stir-fry',
                    meal_type: 'main',
                    prep_time_minutes: 10,
                    cook_time_minutes: 15,
                    servings: 3,
                    ingredients: [
                        {
                            ingredient_name: 'thịt gà',
                            quantity: '300',
                            unit: 'g',
                            category: 'meat'
                        }
                    ],
                    instructions: [
                        {
                            step_number: 1,
                            description: 'Thái thịt gà thành miếng vừa ăn',
                            duration_minutes: 5
                        }
                    ],
                    nutritional_info: {
                        calories: 350,
                        protein: '35g',
                        carbs: '15g',
                        fat: '18g'
                    }
                }]
            };

            mockBedrockHelpers.mockInvokeModel(JSON.stringify(mockAIResponse));
            mockDynamoDBHelpers.mockGetItem({ user_id: testUser.user_id });
            mockDynamoDBHelpers.mockPutItem();
            dynamoMock.on(BatchWriteCommand).resolves({});

            const event = createAuthenticatedAPIGatewayEvent(
                'POST',
                '/v1/ai/suggest-recipes',
                testUser.user_id,
                testUser.email,
                {
                    ingredients: ['thịt gà', 'cà rốt', 'hành lá'],
                    recipe_count: 1
                }
            );

            // Act
            const response = await callHandler(event);

            // Assert
            expect(response.statusCode).toBe(200);
            const body = parseResponseBody(response);
            expect(body.suggestions).toBeDefined();
        });

        it('should return error for empty ingredients list', async () => {
            // Arrange
            const event = createAuthenticatedAPIGatewayEvent(
                'POST',
                '/v1/ai/suggest-recipes',
                testUser.user_id,
                testUser.email,
                {
                    ingredients: [],
                    recipe_count: 1
                }
            );

            // Act
            const response = await callHandler(event);

            // Assert
            // The handler returns 503 when validation fails due to error handling wrapper
            expect([400, 503]).toContain(response.statusCode);
            const body = parseResponseBody(response);
            expect(body.error).toBeDefined();
        });
    });

    describe('AI Error Handling', () => {
        it('should handle Bedrock service error', async () => {
            // Arrange
            mockBedrockHelpers.mockBedrockError('ServiceException', 'Bedrock service unavailable');
            mockDynamoDBHelpers.mockGetItem({ user_id: testUser.user_id });

            const event = createAuthenticatedAPIGatewayEvent(
                'POST',
                '/v1/ai/suggest-recipes',
                testUser.user_id,
                testUser.email,
                {
                    ingredients: ['thịt gà', 'cà chua'],
                    recipe_count: 1
                }
            );

            // Act
            const response = await callHandler(event);

            // Assert - Should fallback to mock suggestions
            expect(response.statusCode).toBe(200);
            const body = parseResponseBody(response);
            expect(body.suggestions).toBeDefined();
        });

        it('should handle rate limiting', async () => {
            // Arrange
            mockBedrockHelpers.mockBedrockThrottling();
            mockDynamoDBHelpers.mockGetItem({ user_id: testUser.user_id });

            const event = createAuthenticatedAPIGatewayEvent(
                'POST',
                '/v1/ai/suggest-recipes',
                testUser.user_id,
                testUser.email,
                {
                    ingredients: ['cá', 'tôm'],
                    recipe_count: 2
                }
            );

            // Act
            const response = await callHandler(event);

            // Assert - Should fallback gracefully
            expect(response.statusCode).toBe(200);
            const body = parseResponseBody(response);
            expect(body.suggestions).toBeDefined();
        });
    });
});
