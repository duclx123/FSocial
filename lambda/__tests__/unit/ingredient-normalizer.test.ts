/**
 * Ingredient Normalizer Tests
 * Tests for ingredient text normalization and categorization
 */

import { IngredientNormalizer } from '../../shared/business/ingredients/ingredient-normalizer';

describe('IngredientNormalizer', () => {
  describe('normalize', () => {
    it('should convert to lowercase', () => {
      expect(IngredientNormalizer.normalize('THỊT BÒ')).toBe('thịt bò');
    });

    it('should trim whitespace', () => {
      expect(IngredientNormalizer.normalize('  thịt bò  ')).toBe('thịt bò');
    });

    it('should replace multiple spaces with single space', () => {
      expect(IngredientNormalizer.normalize('thịt    bò')).toBe('thịt bò');
    });

    it('should normalize Unicode characters', () => {
      const result = IngredientNormalizer.normalize('thịt bò');
      expect(result).toBe('thịt bò');
    });

    it('should handle empty string', () => {
      expect(IngredientNormalizer.normalize('')).toBe('');
    });

    it('should handle string with only spaces', () => {
      expect(IngredientNormalizer.normalize('   ')).toBe('');
    });
  });

  describe('generateId', () => {
    it('should generate ID from Vietnamese text', () => {
      expect(IngredientNormalizer.generateId('Thịt Bò')).toBe('thit-bo');
    });

    it('should replace Vietnamese accents', () => {
      const testCases = [
        { input: 'cà chua', expected: 'ca-chua' },
        { input: 'đậu hũ', expected: 'dau-hu' },
        { input: 'tôm sú', expected: 'tom-su' },
        { input: 'bánh mì', expected: 'banh-mi' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(IngredientNormalizer.generateId(input)).toBe(expected);
      });
    });

    it('should remove special characters', () => {
      expect(IngredientNormalizer.generateId('thịt bò (500g)')).toBe('thit-bo-500g');
    });

    it('should handle multiple spaces', () => {
      expect(IngredientNormalizer.generateId('thịt   bò')).toBe('thit-bo');
    });

    it('should handle empty string', () => {
      expect(IngredientNormalizer.generateId('')).toBe('');
    });
  });

  describe('categorize', () => {
    it('should categorize protein ingredients', () => {
      const proteinIngredients = ['thịt bò', 'thịt gà', 'thịt heo', 'cá hồi', 'tôm', 'trứng gà'];
      
      proteinIngredients.forEach(ingredient => {
        const result = IngredientNormalizer.categorize(ingredient);
        expect(result).toBe('protein');
      });
    });

    it('should categorize vegetable ingredients', () => {
      const vegetableIngredients = ['rau muống', 'cà chua', 'củ hành', 'khoai tây', 'nấm'];
      
      vegetableIngredients.forEach(ingredient => {
        const result = IngredientNormalizer.categorize(ingredient);
        expect(result).toBe('vegetable');
      });
    });

    it('should handle case insensitive categorization', () => {
      expect(IngredientNormalizer.categorize('THỊT BÒ')).toBe('protein');
      expect(IngredientNormalizer.categorize('RAU MUỐNG')).toBe('vegetable');
    });

    it('should return default category for unknown ingredients', () => {
      const result = IngredientNormalizer.categorize('unknown ingredient');
      expect(typeof result).toBe('string');
    });

    it('should handle empty string', () => {
      const result = IngredientNormalizer.categorize('');
      expect(typeof result).toBe('string');
    });
  });

  describe('Vietnamese accent replacement', () => {
    it('should replace all Vietnamese vowels correctly', () => {
      const testCases = [
        { input: 'àáạảãâầấậẩẫăằắặẳẵ', expected: 'aaaaaaaaaaaaaaaaa' },
        { input: 'èéẹẻẽêềếệểễ', expected: 'eeeeeeeeeee' },
        { input: 'ìíịỉĩ', expected: 'iiiii' },
        { input: 'òóọỏõôồốộổỗơờớợởỡ', expected: 'ooooooooooooooooo' },
        { input: 'ùúụủũưừứựửữ', expected: 'uuuuuuuuuuu' },
        { input: 'ỳýỵỷỹ', expected: 'yyyyy' },
        { input: 'đ', expected: 'd' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect(IngredientNormalizer.generateId(input)).toBe(expected);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle mixed Vietnamese and English text', () => {
      expect(IngredientNormalizer.generateId('beef thịt bò')).toBe('beef-thit-bo');
    });

    it('should handle numbers in ingredient names', () => {
      expect(IngredientNormalizer.generateId('thịt bò 500g')).toBe('thit-bo-500g');
    });

    it('should handle special characters and punctuation', () => {
      expect(IngredientNormalizer.generateId('thịt bò (tươi)')).toBe('thit-bo-tuoi');
    });
  });
});