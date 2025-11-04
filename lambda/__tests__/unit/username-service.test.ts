import { UsernameService } from '../../shared/auth/username-service';
import { DynamoDBHelper } from '../../shared/database/dynamodb';

// Mock dependencies
jest.mock('../../shared/database/dynamodb');

describe('UsernameService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUsername', () => {
    it('should validate correct username', () => {
      const result = UsernameService.validateUsername('john_doe');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject username too short', () => {
      const result = UsernameService.validateUsername('ab');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username must be at least 3 characters');
    });

    it('should reject username too long', () => {
      const result = UsernameService.validateUsername('a'.repeat(31));
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username must be less than 30 characters');
    });

    it('should reject username with invalid characters', () => {
      const result = UsernameService.validateUsername('john@doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('can only contain');
    });

    it('should reject username starting with special character', () => {
      const result = UsernameService.validateUsername('_johndoe');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username must start with a letter or number');
    });

    it('should reject username with consecutive special characters', () => {
      const result = UsernameService.validateUsername('john__doe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive');
    });

    it('should reject reserved usernames', () => {
      const result = UsernameService.validateUsername('admin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This username is reserved');
    });

    it('should reject username with inappropriate content', () => {
      const result = UsernameService.validateUsername('badword_fuck');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inappropriate');
    });

    it('should accept username with numbers', () => {
      const result = UsernameService.validateUsername('john123');
      expect(result.valid).toBe(true);
    });

    it('should accept username with hyphen', () => {
      const result = UsernameService.validateUsername('john-doe');
      expect(result.valid).toBe(true);
    });

    it('should accept username with underscore', () => {
      const result = UsernameService.validateUsername('john_doe');
      expect(result.valid).toBe(true);
    });
  });

  describe('isUsernameAvailable', () => {
    it('should return true when username is available', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });

      const result = await UsernameService.isUsernameAvailable('newuser');
      expect(result).toBe(true);
    });

    it('should return false when username is taken', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [{ PK: 'USER#123', username: 'existinguser' }],
        Count: 1
      });

      const result = await UsernameService.isUsernameAvailable('existinguser');
      expect(result).toBe(false);
    });

    it('should normalize username before checking', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });

      await UsernameService.isUsernameAvailable('  NewUser  ');

      expect(DynamoDBHelper.query).toHaveBeenCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: {
            ':pk': 'USERNAME#newuser'
          }
        })
      );
    });

    it('should handle query errors', async () => {
      (DynamoDBHelper.query as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(UsernameService.isUsernameAvailable('testuser'))
        .rejects
        .toThrow('DB Error');
    });
  });

  describe('reserveUsername', () => {
    it('should reserve available username', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      await UsernameService.reserveUsername('user-123', 'newuser');

      expect(DynamoDBHelper.put).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: 'USER#user-123',
          SK: 'USERNAME_RESERVATION',
          username: 'newuser',
          GSI2PK: 'USERNAME#newuser'
        })
      );
    });

    it('should throw error when username is taken', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [{ PK: 'USER#other', username: 'takenuser' }],
        Count: 1
      });

      await expect(UsernameService.reserveUsername('user-123', 'takenuser'))
        .rejects
        .toThrow('Username is already taken');
    });

    it('should normalize username before reserving', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });
      (DynamoDBHelper.put as jest.Mock).mockResolvedValue(undefined);

      await UsernameService.reserveUsername('user-123', '  NewUser  ');

      expect(DynamoDBHelper.put).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newuser',
          GSI2PK: 'USERNAME#newuser'
        })
      );
    });
  });

  describe('releaseUsername', () => {
    it('should release username successfully', async () => {
      (DynamoDBHelper.delete as jest.Mock).mockResolvedValue(undefined);

      await UsernameService.releaseUsername('user-123');

      expect(DynamoDBHelper.delete).toHaveBeenCalledWith(
        'USER#user-123',
        'USERNAME_RESERVATION'
      );
    });

    it('should not throw error on delete failure', async () => {
      (DynamoDBHelper.delete as jest.Mock).mockRejectedValue(new Error('Delete failed'));

      // Should not throw
      await expect(UsernameService.releaseUsername('user-123')).resolves.not.toThrow();
    });
  });

  describe('getUserIdByUsername', () => {
    it('should return user ID when username exists', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [{ PK: 'USER#user-123', username: 'johndoe' }],
        Count: 1
      });

      const result = await UsernameService.getUserIdByUsername('johndoe');
      expect(result).toBe('user-123');
    });

    it('should return null when username not found', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });

      const result = await UsernameService.getUserIdByUsername('nonexistent');
      expect(result).toBeNull();
    });

    it('should normalize username before querying', async () => {
      (DynamoDBHelper.query as jest.Mock).mockResolvedValue({
        Items: [],
        Count: 0
      });

      await UsernameService.getUserIdByUsername('  JohnDoe  ');

      expect(DynamoDBHelper.query).toHaveBeenCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: {
            ':pk': 'USERNAME#johndoe'
          }
        })
      );
    });

    it('should return null on query error', async () => {
      (DynamoDBHelper.query as jest.Mock).mockRejectedValue(new Error('Query failed'));

      const result = await UsernameService.getUserIdByUsername('testuser');
      expect(result).toBeNull();
    });
  });

  describe('suggestUsernames', () => {
    it('should suggest available usernames', async () => {
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john available
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john1 available
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john2 available
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john3 available
        .mockResolvedValueOnce({ Items: [], Count: 0 }); // john4 available

      const suggestions = await UsernameService.suggestUsernames('john', 5);

      expect(suggestions).toHaveLength(5);
      expect(suggestions[0]).toBe('john');
      expect(suggestions[1]).toBe('john1');
    });

    it('should skip taken usernames', async () => {
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValueOnce({ Items: [{ PK: 'USER#1' }], Count: 1 }) // john taken
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john1 available
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john2 available
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john3 available
        .mockResolvedValueOnce({ Items: [], Count: 0 }) // john4 available
        .mockResolvedValueOnce({ Items: [], Count: 0 }); // john5 available

      const suggestions = await UsernameService.suggestUsernames('john', 5);

      expect(suggestions).toHaveLength(5);
      expect(suggestions[0]).toBe('john1');
    });

    it('should normalize base name', async () => {
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValue({ Items: [], Count: 0 });

      await UsernameService.suggestUsernames('John Doe!', 3);

      // First call should be for normalized 'johndoe'
      expect(DynamoDBHelper.query).toHaveBeenCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: {
            ':pk': 'USERNAME#johndoe'
          }
        })
      );
    });

    it('should return requested count of suggestions', async () => {
      (DynamoDBHelper.query as jest.Mock)
        .mockResolvedValue({ Items: [], Count: 0 });

      const suggestions = await UsernameService.suggestUsernames('test', 3);

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('normalizeUsername', () => {
    it('should convert to lowercase', () => {
      const result = UsernameService.normalizeUsername('JohnDoe');
      expect(result).toBe('johndoe');
    });

    it('should trim whitespace', () => {
      const result = UsernameService.normalizeUsername('  johndoe  ');
      expect(result).toBe('johndoe');
    });

    it('should handle mixed case and whitespace', () => {
      const result = UsernameService.normalizeUsername('  JohnDoe  ');
      expect(result).toBe('johndoe');
    });
  });
});
