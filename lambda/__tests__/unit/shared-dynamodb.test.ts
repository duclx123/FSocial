import { DynamoDBHelper, ddb, TABLE_NAME } from '../../shared/database/dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('DynamoDB Helper', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  describe('get', () => {
    it('should get item by PK and SK', async () => {
      const mockItem = { PK: 'USER#123', SK: 'PROFILE', username: 'testuser' };
      ddbMock.on(GetCommand).resolves({ Item: mockItem });

      const result = await DynamoDBHelper.get('USER#123', 'PROFILE');
      
      expect(result).toEqual(mockItem);
      expect(ddbMock.calls()).toHaveLength(1);
    });

    it('should return undefined when item not found', async () => {
      ddbMock.on(GetCommand).resolves({});

      const result = await DynamoDBHelper.get('USER#999', 'PROFILE');
      
      expect(result).toBeUndefined();
    });

    it('should retry on transient errors', async () => {
      ddbMock.on(GetCommand)
        .rejectsOnce({ name: 'ThrottlingException' })
        .resolves({ Item: { PK: 'USER#123', SK: 'PROFILE' } });

      const result = await DynamoDBHelper.get('USER#123', 'PROFILE');
      
      expect(result).toBeDefined();
      expect(ddbMock.calls()).toHaveLength(2);
    });
  });

  describe('put', () => {
    it('should put item', async () => {
      ddbMock.on(PutCommand).resolves({});

      const item = { PK: 'USER#123', SK: 'PROFILE', username: 'testuser' };
      await DynamoDBHelper.put(item);
      
      expect(ddbMock.calls()).toHaveLength(1);
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.Item).toEqual(item);
    });
  });

  describe('update', () => {
    it('should update item and return new attributes', async () => {
      const updatedItem = { PK: 'USER#123', SK: 'PROFILE', username: 'newname' };
      ddbMock.on(UpdateCommand).resolves({ Attributes: updatedItem });

      const result = await DynamoDBHelper.update(
        'USER#123',
        'PROFILE',
        'SET username = :username',
        { ':username': 'newname' }
      );
      
      expect(result).toEqual(updatedItem);
    });

    it('should support expression attribute names', async () => {
      ddbMock.on(UpdateCommand).resolves({ Attributes: {} });

      await DynamoDBHelper.update(
        'USER#123',
        'PROFILE',
        'SET #status = :status',
        { ':status': 'active' },
        { '#status': 'status' }
      );
      
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.ExpressionAttributeNames).toEqual({ '#status': 'status' });
    });
  });

  describe('delete', () => {
    it('should delete item', async () => {
      ddbMock.on(DeleteCommand).resolves({});

      await DynamoDBHelper.delete('USER#123', 'PROFILE');
      
      expect(ddbMock.calls()).toHaveLength(1);
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.Key).toEqual({ PK: 'USER#123', SK: 'PROFILE' });
    });
  });

  describe('query', () => {
    it('should query items', async () => {
      const mockItems = [
        { PK: 'USER#123', SK: 'INGREDIENT#1' },
        { PK: 'USER#123', SK: 'INGREDIENT#2' }
      ];
      ddbMock.on(QueryCommand).resolves({ Items: mockItems, Count: 2 });

      const result = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'USER#123' }
      });
      
      expect(result.Items).toEqual(mockItems);
      expect(result.Count).toBe(2);
    });

    it('should handle empty results', async () => {
      ddbMock.on(QueryCommand).resolves({});

      const result = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'USER#999' }
      });
      
      expect(result.Items).toEqual([]);
      expect(result.Count).toBe(0);
    });

    it('should support pagination', async () => {
      const lastKey = { PK: 'USER#123', SK: 'INGREDIENT#10' };
      ddbMock.on(QueryCommand).resolves({
        Items: [{ PK: 'USER#123', SK: 'INGREDIENT#11' }],
        LastEvaluatedKey: lastKey
      });

      const result = await DynamoDBHelper.query({
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'USER#123' },
        ExclusiveStartKey: lastKey
      });
      
      expect(result.LastEvaluatedKey).toEqual(lastKey);
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile', async () => {
      const mockProfile = { PK: 'USER#123', SK: 'PROFILE', username: 'testuser' };
      ddbMock.on(GetCommand).resolves({ Item: mockProfile });

      const result = await DynamoDBHelper.getUserProfile('123');
      
      expect(result).toEqual(mockProfile);
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.Key).toEqual({ PK: 'USER#123', SK: 'PROFILE' });
    });
  });

  describe('getUserPreferences', () => {
    it('should get user preferences', async () => {
      const mockPrefs = { PK: 'USER#123', SK: 'PREFERENCES', theme: 'dark' };
      ddbMock.on(GetCommand).resolves({ Item: mockPrefs });

      const result = await DynamoDBHelper.getUserPreferences('123');
      
      expect(result).toEqual(mockPrefs);
    });
  });

  describe('getUserIngredients', () => {
    it('should get user ingredients', async () => {
      const mockIngredients = [
        { PK: 'USER#123', SK: 'INGREDIENT#1', name: 'tomato' },
        { PK: 'USER#123', SK: 'INGREDIENT#2', name: 'onion' }
      ];
      ddbMock.on(QueryCommand).resolves({ Items: mockIngredients });

      const result = await DynamoDBHelper.getUserIngredients('123');
      
      expect(result.Items).toEqual(mockIngredients);
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.KeyConditionExpression).toContain('begins_with');
    });
  });

  describe('getRecipe', () => {
    it('should get recipe metadata', async () => {
      const mockRecipe = { PK: 'RECIPE#456', SK: 'METADATA', name: 'Pasta' };
      ddbMock.on(GetCommand).resolves({ Item: mockRecipe });

      const result = await DynamoDBHelper.getRecipe('456');
      
      expect(result).toEqual(mockRecipe);
    });
  });

  describe('getCookingHistory', () => {
    it('should get cooking history', async () => {
      const mockHistory = [
        { PK: 'USER#123', SK: 'COOKING#1', recipe_id: '456' }
      ];
      ddbMock.on(QueryCommand).resolves({ Items: mockHistory });

      const result = await DynamoDBHelper.getCookingHistory('123');
      
      expect(result.Items).toEqual(mockHistory);
    });

    it('should filter favorites when requested', async () => {
      const mockFavorites = [
        { PK: 'USER#123', SK: 'COOKING#1', recipe_id: '456', is_favorite: true }
      ];
      ddbMock.on(QueryCommand).resolves({ Items: mockFavorites });

      const result = await DynamoDBHelper.getCookingHistory('123', true);
      
      expect(result.Items).toEqual(mockFavorites);
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.IndexName).toBe('GSI1');
    });
  });

  describe('searchIngredients', () => {
    it('should search ingredients by term', async () => {
      const mockResults = [
        { name: 'tomato', category: 'vegetable' }
      ];
      ddbMock.on(QueryCommand).resolves({ Items: mockResults });

      const result = await DynamoDBHelper.searchIngredients('tom');
      
      expect(result.Items).toEqual(mockResults);
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.IndexName).toBe('GSI2');
      expect((call.args[0] as any).input.Limit).toBe(10);
    });

    it('should support custom limit', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] });

      await DynamoDBHelper.searchIngredients('tom', 20);
      
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.Limit).toBe(20);
    });
  });

  describe('searchRecipesByMethod', () => {
    it('should search recipes by cooking method', async () => {
      const mockRecipes = [
        { name: 'Grilled Chicken', method: 'grilling' }
      ];
      ddbMock.on(QueryCommand).resolves({ Items: mockRecipes });

      const result = await DynamoDBHelper.searchRecipesByMethod('grilling');
      
      expect(result.Items).toEqual(mockRecipes);
      const call = ddbMock.call(0);
      expect((call.args[0] as any).input.FilterExpression).toContain('is_approved');
    });
  });

  describe('error handling', () => {
    it('should convert ValidationException to DatabaseError', async () => {
      const error = new Error('Invalid data');
      error.name = 'ValidationException';
      ddbMock.on(GetCommand).rejects(error);

      await expect(DynamoDBHelper.get('USER#123', 'PROFILE')).rejects.toThrow('Invalid data provided');
    });

    it('should convert ResourceNotFoundException to DatabaseError', async () => {
      const error = new Error('Not found');
      error.name = 'ResourceNotFoundException';
      ddbMock.on(GetCommand).rejects(error);

      await expect(DynamoDBHelper.get('USER#123', 'PROFILE')).rejects.toThrow('Requested resource not found');
    });

    it('should convert ConditionalCheckFailedException to DatabaseError', async () => {
      const error = new Error('Condition failed');
      error.name = 'ConditionalCheckFailedException';
      ddbMock.on(PutCommand).rejects(error);

      await expect(DynamoDBHelper.put({ PK: 'TEST', SK: 'TEST' })).rejects.toThrow('data conflict');
    });

    it('should handle ThrottlingException with retry suggestion', async () => {
      const error = new Error('Throttled');
      error.name = 'ThrottlingException';
      ddbMock.on(GetCommand).rejects(error);

      await expect(DynamoDBHelper.get('USER#123', 'PROFILE')).rejects.toThrow('temporarily overloaded');
    });
  });
});
