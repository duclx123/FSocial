/**
 * AI-powered Ingredient Parser
 * Uses Bedrock Claude to parse complex ingredient strings
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../../monitoring/logger';

export interface ParsedIngredient {
  name: string;
  quantity?: string;
  unit?: string;
}

export class IngredientParserAI {
  
  private static bedrockClient = new BedrockRuntimeClient({ 
    region: process.env.AWS_REGION || 'us-east-1' 
  });
  
  /**
   * Parse ingredients using AI (Bedrock Claude)
   * Handles all variants: "500g thịt gà", "thịt gà 500g", "0.5kg thịt gà", etc.
   */
  static async parseIngredients(
    ingredientStrings: string[]
  ): Promise<ParsedIngredient[]> {
    
    if (ingredientStrings.length === 0) {
      return [];
    }
    
    const prompt = `You are a Vietnamese cooking ingredient parser.

Parse these ingredient strings into structured format:
${ingredientStrings.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Rules:
1. Extract ingredient name (normalized, lowercase Vietnamese)
2. Extract quantity (convert to standard format)
3. Extract unit (standardize: g, kg, ml, l, củ, quả, muỗng, etc.)
4. Handle variants: "500gam", "500 gram", "0,5 kí", "0.5 kg", "nửa ký" → all become "500" + "g"
5. Handle order: "500g thịt gà" or "thịt gà 500g" → same result
6. Normalize: "Thịt Gà" → "thịt gà", "ca chua" → "cà chua"
7. Standardize units: "gam", "gram" → "g", "kí", "ký", "ki" → "kg"
8. Convert fractions: "1/2 kg" → "500" + "g", "nửa ký" → "500" + "g"
9. If no quantity/unit found, just return name

Return ONLY a JSON array (no explanation):
[
  { "name": "thịt gà", "quantity": "500", "unit": "g" },
  { "name": "gừng", "quantity": "50", "unit": "g" },
  { "name": "muối" }
]`;

    try {
      logger.info('Calling Bedrock AI for ingredient parsing', {
        count: ingredientStrings.length,
        samples: ingredientStrings.slice(0, 3)
      });
      
      const response = await this.bedrockClient.send(new InvokeModelCommand({
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          temperature: 0.1,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      }));
      
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const aiResponse = responseBody.content[0].text;
      
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        logger.info('AI parsed ingredients successfully', {
          input: ingredientStrings.length,
          output: parsed.length
        });
        
        return parsed;
      }
      
      throw new Error('Failed to extract JSON from AI response');
      
    } catch (error) {
      logger.error('AI parsing failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        ingredientCount: ingredientStrings.length
      });
      
      // Fallback: return ingredients as-is
      return ingredientStrings.map(str => ({
        name: str.trim().toLowerCase()
      }));
    }
  }
  
  /**
   * Batch parse multiple recipes
   * Processes in batches to avoid token limits
   */
  static async batchParse(
    recipes: Array<{ recipe_id: string; ingredients: string[] }>
  ): Promise<Map<string, ParsedIngredient>> {
    
    const results = new Map<string, ParsedIngredient>();
    
    // Collect all unique ingredient strings
    const allIngredients = new Set<string>();
    recipes.forEach(r => r.ingredients.forEach(i => allIngredients.add(i)));
    
    // Parse in batches of 20 (to avoid token limits)
    const ingredientArray = Array.from(allIngredients);
    const BATCH_SIZE = 20;
    
    logger.info('Starting batch ingredient parsing', {
      totalIngredients: ingredientArray.length,
      batches: Math.ceil(ingredientArray.length / BATCH_SIZE)
    });
    
    for (let i = 0; i < ingredientArray.length; i += BATCH_SIZE) {
      const batch = ingredientArray.slice(i, i + BATCH_SIZE);
      const parsed = await this.parseIngredients(batch);
      
      // Cache results
      batch.forEach((original, idx) => {
        if (parsed[idx]) {
          results.set(original, parsed[idx]);
        }
      });
      
      // Small delay to avoid rate limiting
      if (i + BATCH_SIZE < ingredientArray.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    logger.info('Batch parsing completed', {
      totalParsed: results.size
    });
    
    return results;
  }
}
