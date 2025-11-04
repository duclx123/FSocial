/**
 * Ingredient Normalizer
 * Normalizes ingredient names and saves to master table
 */

import { DynamoDBHelper } from '../../database/dynamodb';
import { logger } from '../../monitoring/logger';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'smart-cooking-data-dev';

export class IngredientNormalizer {
  
  /**
   * Normalize Vietnamese text
   * Handles case, whitespace, and Unicode normalization
   */
  static normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Multiple spaces → single space
      .normalize('NFC');      // Unicode normalization
  }
  
  /**
   * Generate consistent ID from ingredient name
   * Removes Vietnamese accents and special characters
   */
  static generateId(name: string): string {
    return this.normalize(name)
      .replace(/\s+/g, '-')
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
      .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
      .replace(/[ìíịỉĩ]/g, 'i')
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
      .replace(/[ùúụủũưừứựửữ]/g, 'u')
      .replace(/[ỳýỵỷỹ]/g, 'y')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9-]/g, '');
  }
  
  /**
   * Categorize ingredient based on keywords
   */
  static categorize(name: string): string {
    const nameLower = name.toLowerCase();
    
    const categories: { [key: string]: string[] } = {
      protein: ['thịt', 'gà', 'heo', 'bò', 'vịt', 'cá', 'tôm', 'mực', 'trứng', 'đậu hũ'],
      vegetable: ['rau', 'cải', 'cà', 'củ', 'khoai', 'bí', 'đậu', 'măng', 'nấm'],
      spice: ['muối', 'đường', 'tiêu', 'ớt', 'tỏi', 'hành', 'gừng', 'sả'],
      condiment: ['nước mắm', 'dầu', 'tương', 'giấm', 'dầu hào'],
      herb: ['húng', 'ngò', 'rau thơm', 'lá', 'kinh giới'],
      carb: ['gạo', 'bún', 'phở', 'miến', 'bánh'],
      dairy: ['sữa', 'bơ', 'phô mai']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      for (const keyword of keywords) {
        if (nameLower.includes(keyword)) {
          return category;
        }
      }
    }
    
    return 'other';
  }
  
  /**
   * Calculate similarity between two strings (Levenshtein distance)
   */
  static similarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private static levenshteinDistance(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }
  
  /**
   * Find similar ingredients in master table
   */
  static async findSimilar(
    name: string, 
    threshold: number = 0.90
  ): Promise<Array<{ id: string; name: string; score: number }>> {
    
    try {
      // Query ingredients from master table
      const result = await DynamoDBHelper.query({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'INGREDIENTS'
        },
        Limit: 100
      });
      
      const similar: Array<{ id: string; name: string; score: number }> = [];
      
      for (const item of result.Items || []) {
        const score = this.similarity(name, item.name);
        if (score >= threshold) {
          similar.push({
            id: item.ingredient_id,
            name: item.name,
            score
          });
        }
      }
      
      return similar.sort((a, b) => b.score - a.score);
      
    } catch (error) {
      logger.error('Error finding similar ingredients', { error, name });
      return [];
    }
  }
  
  /**
   * Save ingredient to master table
   * Returns { id, isNew } where isNew indicates if ingredient was created
   */
  static async saveIngredient(
    name: string,
    sourceId: string
  ): Promise<{ id: string; isNew: boolean }> {
    
    // Step 1: Normalize name
    const normalized = this.normalize(name);
    
    // Step 2: Generate ID
    const id = this.generateId(normalized);
    
    // Step 3: Check if exists
    const existing = await DynamoDBHelper.get(
      `INGREDIENT#${id}`,
      'METADATA'
    );
    
    if (existing) {
      // Increment usage count
      await this.incrementUsage(id, sourceId);
      
      logger.info('Using existing ingredient', { id, name: normalized });
      return { id, isNew: false };
    }
    
    // Step 4: Check for similar (prevent near-duplicates)
    const similar = await this.findSimilar(normalized, 0.90);
    
    if (similar.length > 0) {
      const match = similar[0];
      
      logger.info('Found similar ingredient, using existing', {
        input: name,
        matched: match.name,
        similarity: match.score
      });
      
      await this.incrementUsage(match.id, sourceId);
      return { id: match.id, isNew: false };
    }
    
    // Step 5: Create new ingredient
    const category = this.categorize(normalized);
    const now = new Date().toISOString();
    
    await DynamoDBHelper.put({
      PK: `INGREDIENT#${id}`,
      SK: 'METADATA',
      entity_type: 'master_ingredient',
      ingredient_id: id,
      name: normalized,
      category: category,
      usage_count: 1,
      first_used_in: sourceId,
      last_used_in: sourceId,
      created_at: now,
      updated_at: now,
      
      // GSI for search
      GSI2PK: 'INGREDIENTS',
      GSI2SK: normalized
    });
    
    logger.info('New ingredient created', { 
      id, 
      name: normalized, 
      category,
      sourceId
    });
    
    return { id, isNew: true };
  }
  
  /**
   * Increment usage count for existing ingredient
   */
  private static async incrementUsage(
    ingredientId: string,
    sourceId: string
  ): Promise<void> {
    
    try {
      await DynamoDBHelper.update(
        `INGREDIENT#${ingredientId}`,
        'METADATA',
        'ADD usage_count :inc SET last_used_in = :source, updated_at = :now',
        {
          ':inc': 1,
          ':source': sourceId,
          ':now': new Date().toISOString()
        }
      );
      
      logger.debug('Incremented ingredient usage', { ingredientId, sourceId });
      
    } catch (error) {
      logger.error('Failed to increment usage', { error, ingredientId });
    }
  }
}
