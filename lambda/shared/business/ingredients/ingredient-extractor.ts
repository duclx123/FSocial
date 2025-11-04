/**
 * Ingredient Extractor Service
 * Extracts ingredient names from recipe ingredients and saves to master DB
 */

import { DynamoDBHelper } from '../../database/dynamodb';
import { normalizeVietnamese } from '../../utils/vietnamese-normalizer';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../monitoring/logger';

export interface ExtractedIngredient {
  original: string;
  name: string;
  quantity?: string;
  unit?: string;
}

export interface IngredientExtractionResult {
  extracted: ExtractedIngredient[];
  savedToMaster: number;
  alreadyExists: number;
  failed: number;
}

export class IngredientExtractor {
  /**
   * Extract ingredient name from a recipe ingredient string
   * Examples:
   *   "300g thịt gà" → { name: "thịt gà", quantity: "300", unit: "g" }
   *   "2 củ cà rốt" → { name: "cà rốt", quantity: "2", unit: "củ" }
   *   "1 chút muối" → { name: "muối", quantity: "1", unit: "chút" }
   */
  static extractIngredientName(ingredientString: string): ExtractedIngredient {
    const original = ingredientString.trim();
    
    // Common Vietnamese units
    const units = [
      'g', 'kg', 'ml', 'l', 'lít', 'gram', 'kilogram',
      'củ', 'quả', 'trái', 'cây', 'nhánh', 'lá', 'bó',
      'muống', 'thìa', 'muỗng', 'chén', 'bát', 'ly',
      'chút', 'ít', 'tí', 'tẹo', 'miếng', 'lát', 'khoanh',
      'tbsp', 'tsp', 'cup', 'oz', 'lb'
    ];

    // Regex to match: [number] [unit] [ingredient name]
    // Examples: "300g thịt gà", "2 củ cà rốt", "1 chút muối"
    const quantityUnitPattern = new RegExp(
      `^([\\d.]+)\\s*(${units.join('|')})?\\s*(.+)$`,
      'i'
    );

    const match = original.match(quantityUnitPattern);
    
    if (match) {
      return {
        original,
        quantity: match[1],
        unit: match[2] || undefined,
        name: match[3].trim()
      };
    }

    // If no quantity/unit pattern found, try to remove leading numbers
    const simpleNumberPattern = /^[\d.]+\s+(.+)$/;
    const simpleMatch = original.match(simpleNumberPattern);
    
    if (simpleMatch) {
      return {
        original,
        name: simpleMatch[1].trim()
      };
    }

    // Return as-is if no pattern matches
    return {
      original,
      name: original
    };
  }

  /**
   * Extract all ingredient names from a recipe's ingredient list
   * Uses hybrid approach: regex for simple cases, AI for complex cases
   */
  static async extractIngredientsFromRecipe(ingredients: string[]): Promise<ExtractedIngredient[]> {
    if (!ingredients || ingredients.length === 0) {
      return [];
    }

    // Step 1: Try regex parsing
    const regexParsed: ExtractedIngredient[] = [];
    const needsAI: string[] = [];
    
    for (const ing of ingredients) {
      const parsed = this.extractIngredientName(ing);
      
      // If regex found quantity/unit, use it
      if (parsed.quantity || parsed.unit) {
        regexParsed.push(parsed);
      } else {
        // Complex case - needs AI
        needsAI.push(ing);
      }
    }
    
    // Step 2: Use AI for complex cases
    let aiParsed: ExtractedIngredient[] = [];
    if (needsAI.length > 0) {
      try {
        const { IngredientParserAI } = await import('./ingredient-parser-ai');
        const aiResults = await IngredientParserAI.parseIngredients(needsAI);
        
        aiParsed = aiResults.map((result, idx) => ({
          original: needsAI[idx],
          name: result.name,
          quantity: result.quantity,
          unit: result.unit
        }));
        
        logger.info('Hybrid parsing stats', {
          total: ingredients.length,
          regex: regexParsed.length,
          ai: aiParsed.length,
          costSaved: `$${(regexParsed.length * 0.0001).toFixed(4)}`
        });
        
      } catch (error) {
        logger.error('AI parsing failed, using fallback', { error });
        
        // Fallback: use original strings
        aiParsed = needsAI.map(ing => ({
          original: ing,
          name: ing.trim()
        }));
      }
    }
    
    return [...regexParsed, ...aiParsed];
  }

  /**
   * Save an ingredient to master database if it doesn't exist
   * Returns true if saved, false if already exists
   */
  static async saveToMasterDB(ingredientName: string, sourceRecipeId?: string): Promise<boolean> {
    try {
      const normalizedName = normalizeVietnamese(ingredientName);

      // Check if ingredient already exists in master DB
      const existingIngredient = await DynamoDBHelper.query({
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'INGREDIENT#SEARCH',
          ':sk': `NAME#${normalizedName}`,
        },
        Limit: 1,
      });

      // If exact match exists, don't save
      if (existingIngredient.Items && existingIngredient.Items.length > 0) {
        logger.info('Ingredient already exists in master DB', {
          name: ingredientName,
          existingId: existingIngredient.Items[0].ingredient_id
        });
        return false;
      }

      // Create new master ingredient
      const ingredientId = uuidv4();
      const now = new Date().toISOString();

      // Determine category based on keywords (simple heuristic)
      const category = this.categorizeIngredient(ingredientName);

      const masterIngredient = {
        PK: `INGREDIENT#${ingredientId}`,
        SK: 'METADATA',
        entity_type: 'MASTER_INGREDIENT',
        ingredient_id: ingredientId,
        name: ingredientName,
        normalized_name: normalizedName,
        category,
        aliases: [],
        
        // Metadata
        source: sourceRecipeId ? 'recipe_extraction' : 'user_input',
        source_recipe_id: sourceRecipeId,
        usage_count: 1,
        created_at: now,
        updated_at: now,

        // GSI indexes for search
        GSI1PK: `CATEGORY#${category}`,
        GSI1SK: ingredientName,
        GSI2PK: 'INGREDIENT#SEARCH',
        GSI2SK: `NAME#${normalizedName}`
      };

      await DynamoDBHelper.put(masterIngredient);

      logger.info('Saved new ingredient to master DB', {
        ingredientId,
        name: ingredientName,
        category,
        sourceRecipeId
      });

      return true;
    } catch (error) {
      logger.error('Error saving ingredient to master DB', {
        error,
        ingredientName,
        sourceRecipeId
      });
      return false;
    }
  }

  /**
   * Simple ingredient categorization based on keywords
   */
  private static categorizeIngredient(name: string): string {
    const nameLower = name.toLowerCase();

    const categories: { [key: string]: string[] } = {
      'meat': ['thịt', 'gà', 'heo', 'bò', 'vịt', 'cá', 'tôm', 'mực', 'sườn', 'ba chỉ'],
      'vegetable': ['rau', 'cải', 'cà', 'bắp', 'khoai', 'củ', 'đậu', 'măng', 'nấm', 'bí'],
      'spice': ['muối', 'đường', 'tiêu', 'ớt', 'tỏi', 'hành', 'gừng', 'sả', 'tương', 'nước mắm'],
      'herb': ['húng', 'rau thơm', 'ngò', 'kinh giới', 'húng quế', 'lá'],
      'grain': ['gạo', 'bột', 'bánh', 'mì', 'phở', 'bún', 'miến'],
      'dairy': ['sữa', 'trứng', 'phô mai', 'bơ', 'cream'],
      'oil': ['dầu', 'mỡ'],
      'other': []
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
   * Process all ingredients from a recipe and save to master DB
   */
  static async processRecipeIngredients(
    recipeIngredients: string[],
    recipeId: string
  ): Promise<IngredientExtractionResult> {
    const extracted = await this.extractIngredientsFromRecipe(recipeIngredients);
    
    let savedToMaster = 0;
    let alreadyExists = 0;
    let failed = 0;

    logger.info('Processing recipe ingredients for master DB', {
      recipeId,
      totalIngredients: extracted.length,
      ingredients: extracted.map(i => i.name)
    });

    // Process each ingredient
    for (const ingredient of extracted) {
      try {
        const saved = await this.saveToMasterDB(ingredient.name, recipeId);
        if (saved) {
          savedToMaster++;
        } else {
          alreadyExists++;
        }
      } catch (error) {
        logger.error('Failed to process ingredient', {
          error,
          ingredient: ingredient.name,
          recipeId
        });
        failed++;
      }
    }

    const result: IngredientExtractionResult = {
      extracted,
      savedToMaster,
      alreadyExists,
      failed
    };

    logger.info('Completed recipe ingredient processing', {
      recipeId,
      ...result
    });

    return result;
  }

  /**
   * Batch process multiple recipes
   */
  static async batchProcessRecipes(
    recipes: Array<{ recipe_id: string; ingredients: string[] }>
  ): Promise<{
    totalProcessed: number;
    totalExtracted: number;
    totalSavedToMaster: number;
    totalAlreadyExists: number;
    totalFailed: number;
  }> {
    let totalExtracted = 0;
    let totalSavedToMaster = 0;
    let totalAlreadyExists = 0;
    let totalFailed = 0;

    logger.info('Starting batch ingredient processing', {
      recipeCount: recipes.length
    });

    for (const recipe of recipes) {
      if (!recipe.ingredients || recipe.ingredients.length === 0) {
        continue;
      }

      const result = await this.processRecipeIngredients(
        recipe.ingredients,
        recipe.recipe_id
      );

      totalExtracted += result.extracted.length;
      totalSavedToMaster += result.savedToMaster;
      totalAlreadyExists += result.alreadyExists;
      totalFailed += result.failed;
    }

    const summary = {
      totalProcessed: recipes.length,
      totalExtracted,
      totalSavedToMaster,
      totalAlreadyExists,
      totalFailed
    };

    logger.info('Completed batch ingredient processing', summary);

    return summary;
  }
}
