/**
 * Hybrid Ingredient Parser
 * Uses regex for simple cases, AI for complex cases
 */

import { logger } from '../../monitoring/logger';
import { IngredientParserAI, ParsedIngredient } from './ingredient-parser-ai';

export class IngredientParserHybrid {
  
  /**
   * Parse ingredient string using regex (fast, free)
   * Returns null if pattern doesn't match (needs AI)
   */
  private static parseWithRegex(ingredientString: string): ParsedIngredient | null {
    const original = ingredientString.trim();
    
    // Simple patterns for common cases
    const patterns = [
      // "500g thịt gà", "300 g thịt gà", "500gam thịt gà"
      { 
        regex: /^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|gram|gam|kí|ký|ki)\s+(.+)$/i,
        extract: (m: RegExpMatchArray) => ({
          name: m[3].trim(),
          quantity: m[1].replace(',', '.'),
          unit: this.standardizeUnit(m[2])
        })
      },
      // "thịt gà 500g", "thịt gà 300 g"
      {
        regex: /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|gram|gam|kí|ký|ki)$/i,
        extract: (m: RegExpMatchArray) => ({
          name: m[1].trim(),
          quantity: m[2].replace(',', '.'),
          unit: this.standardizeUnit(m[3])
        })
      },
      // "2 củ hành", "3 quả cà chua"
      {
        regex: /^(\d+)\s+(củ|quả|cây|bó|muỗng|thìa|miếng)\s+(.+)$/i,
        extract: (m: RegExpMatchArray) => ({
          name: m[3].trim(),
          quantity: m[1],
          unit: m[2]
        })
      },
      // "hành 2 củ", "cà chua 3 quả"
      {
        regex: /^(.+?)\s+(\d+)\s+(củ|quả|cây|bó|muỗng|thìa|miếng)$/i,
        extract: (m: RegExpMatchArray) => ({
          name: m[1].trim(),
          quantity: m[2],
          unit: m[3]
        })
      }
    ];
    
    for (const { regex, extract } of patterns) {
      const match = original.match(regex);
      if (match) {
        return extract(match);
      }
    }
    
    return null; // No pattern matched - needs AI
  }
  
  /**
   * Standardize unit names
   */
  private static standardizeUnit(unit: string): string {
    const unitMap: { [key: string]: string } = {
      'gam': 'g',
      'gram': 'g',
      'kí': 'kg',
      'ký': 'kg',
      'ki': 'kg',
      'kilogram': 'kg',
      'lít': 'l',
      'liter': 'l',
      'thìa': 'muỗng'
    };
    
    const lower = unit.toLowerCase();
    return unitMap[lower] || lower;
  }
  
  /**
   * Parse ingredients using hybrid approach
   * 1. Try regex first (fast, free) - handles ~80% cases
   * 2. Use AI for complex cases (accurate) - handles ~20% cases
   */
  static async parseIngredients(
    ingredientStrings: string[]
  ): Promise<ParsedIngredient[]> {
    
    if (ingredientStrings.length === 0) {
      return [];
    }
    
    const regexParsed: ParsedIngredient[] = [];
    const needsAI: { index: number; value: string }[] = [];
    
    // Step 1: Try regex parsing
    for (let i = 0; i < ingredientStrings.length; i++) {
      const ing = ingredientStrings[i];
      const parsed = this.parseWithRegex(ing);
      
      if (parsed) {
        regexParsed.push(parsed);
      } else {
        needsAI.push({ index: i, value: ing });
      }
    }
    
    logger.info('Hybrid parsing - regex phase', {
      total: ingredientStrings.length,
      regexSuccess: regexParsed.length,
      needsAI: needsAI.length
    });
    
    // Step 2: Use AI for complex cases
    let aiParsed: ParsedIngredient[] = [];
    if (needsAI.length > 0) {
      try {
        const aiInputs = needsAI.map(item => item.value);
        aiParsed = await IngredientParserAI.parseIngredients(aiInputs);
        
        logger.info('Hybrid parsing - AI phase', {
          aiProcessed: aiParsed.length,
          costEstimate: `$${(needsAI.length * 0.0001).toFixed(4)}`,
          costSaved: `$${(regexParsed.length * 0.0001).toFixed(4)}`
        });
        
      } catch (error) {
        logger.error('AI parsing failed, using fallback', { error });
        
        // Fallback: extract name only
        aiParsed = needsAI.map(item => ({
          name: item.value.trim().toLowerCase()
        }));
      }
    }
    
    // Step 3: Merge results in original order
    const results: ParsedIngredient[] = [];
    let regexIdx = 0;
    let aiIdx = 0;
    
    for (let i = 0; i < ingredientStrings.length; i++) {
      const needsAIItem = needsAI.find(item => item.index === i);
      
      if (needsAIItem) {
        results.push(aiParsed[aiIdx++]);
      } else {
        results.push(regexParsed[regexIdx++]);
      }
    }
    
    return results;
  }
}
