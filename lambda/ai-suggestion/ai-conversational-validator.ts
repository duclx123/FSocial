/**
 * AI Conversational Ingredient Validation
 * 
 * Flow:
 * 1. User nhập ingredients (có thể sai, spam, tào lao)
 * 2. AI kiểm tra & hỏi lại user để confirm
 * 3. AI cảnh báo nếu phát hiện spam/abuse
 * 4. User confirm → Proceed to recipe generation
 * 
 * Benefits:
 * - Simple code (AI làm hết validation logic)
 * - Better UX (conversational, friendly)
 * - Self-documenting (AI explains why asking)
 * - Flexible (AI adapts to context)
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../shared/monitoring/logger';
import { AbuseTrackingService } from '../shared/business/abuse/abuse-tracking-service';

export interface IngredientValidationRequest {
  userId: string;
  userInput: string[]; // Raw user input
  conversationHistory?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ValidationResponse {
  status: 'needs_confirmation' | 'confirmed' | 'rejected' | 'warning';
  message: string; // AI's message to user
  interpretedIngredients?: InterpretedIngredient[];
  warnings?: string[];
  shouldReportToAdmin?: boolean;
  adminReportReason?: string;
  nextAction: 'wait_for_user' | 'proceed_to_recipe' | 'blocked';
}

export interface InterpretedIngredient {
  original: string; // User's input
  normalized: string; // AI's interpretation
  category: string;
  confidence: 'high' | 'medium' | 'low';
  isValid: boolean;
  reason?: string; // Why AI thinks this
}

export class AIConversationalValidator {
  private client: BedrockRuntimeClient;
  // Use cross-region inference profile for better availability
  private modelId: string = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

  constructor(region: string = 'us-east-1') {
    this.client = new BedrockRuntimeClient({ region });
  }

  /**
   * Validate ingredients using conversational AI
   */
  async validateIngredients(request: IngredientValidationRequest): Promise<ValidationResponse> {
    try {
      const prompt = this.buildValidationPrompt(request);
      
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1500,
          temperature: 0.3, // Lower temperature for consistent validation
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return this.parseValidationResponse(responseBody.content[0].text);

    } catch (error) {
      logger.error('AI validation failed', { error });
      throw error;
    }
  }

  /**
   * Build conversational validation prompt
   */
  private buildValidationPrompt(request: IngredientValidationRequest): string {
    const { userInput, conversationHistory } = request;

    return `You are a friendly Vietnamese cooking assistant AI. Your job is to validate user's ingredient input and have a conversation to confirm.

USER INPUT (raw, may have typos, spam, or invalid entries):
${userInput.map((ing, i) => `${i + 1}. "${ing}"`).join('\n')}

YOUR TASKS:
1. **INTERPRET** each ingredient:
   - If missing diacritics: normalize (e.g., "ca ro" → "Cá rô")
   - If typo: suggest correction
   - If spam/nonsense: flag it
   - If dangerous/inappropriate: reject it

2. **DETECT ABUSE PATTERNS**:
   🚨 AUTO-REJECT if user input contains:
   - SQL injection attempts (DROP, DELETE, SELECT, etc.)
   - XSS attempts (<script>, javascript:, etc.)
   - Repeated nonsense (aaaaa, xxxxx, test123)
   - Only numbers or special characters
   - Offensive/inappropriate content
   
   🚩 WARN (but allow with confirmation) if:
   - More than 2 unrecognizable ingredients
   - Unusual combinations (cement + battery + plastic)
   - Very long ingredient names (>50 chars)

3. **RESPOND TO USER** in Vietnamese:
   - If all ingredients valid → Ask for confirmation with normalized list
   - If some unclear → Ask which ones user meant
   - If spam detected → Politely warn and ask to re-enter
   - If abuse detected → Reject and warn about admin report

4. **CONFIDENCE SCORING**:
   - HIGH: Clear, common Vietnamese ingredient
   - MEDIUM: Typo but recognizable
   - LOW: Unclear, need user clarification

RESPONSE FORMAT (JSON only):
{
  "status": "needs_confirmation" | "confirmed" | "rejected" | "warning",
  "message": "Your friendly message to user in Vietnamese",
  "interpretedIngredients": [
    {
      "original": "ca ro",
      "normalized": "Cá rô",
      "category": "seafood",
      "confidence": "high",
      "isValid": true
    }
  ],
  "warnings": ["Optional warning messages"],
  "shouldReportToAdmin": false,
  "adminReportReason": "Only if abuse detected",
  "nextAction": "wait_for_user" | "proceed_to_recipe" | "blocked"
}

EXAMPLES:

Example 1 - Normal input with typos:
User: ["ca ro", "thit ga", "hanh la"]
Response:
{
  "status": "needs_confirmation",
  "message": "Mình hiểu bạn muốn dùng những nguyên liệu này:\n1. Cá rô (con cá)\n2. Thịt gà\n3. Hành lá\n\nĐúng không ạ? Nhấn 'Xác nhận' để tìm món ăn nhé! 😊",
  "interpretedIngredients": [
    {"original": "ca ro", "normalized": "Cá rô", "category": "seafood", "confidence": "high", "isValid": true},
    {"original": "thit ga", "normalized": "Thịt gà", "category": "meat", "confidence": "high", "isValid": true},
    {"original": "hanh la", "normalized": "Hành lá", "category": "vegetable", "confidence": "high", "isValid": true}
  ],
  "nextAction": "wait_for_user"
}

Example 2 - Unclear input:
User: ["ca xyz", "abc123", "toi"]
Response:
{
  "status": "warning",
  "message": "Mình hiểu được một số nguyên liệu:\n✅ Tỏi\n\nNhưng không chắc về:\n❓ 'ca xyz' - Bạn muốn nói cá gì? (cá rô, cá lóc, cá thu?)\n❓ 'abc123' - Đây là nguyên liệu gì?\n\nBạn có thể nhập lại rõ hơn không? 🤔",
  "interpretedIngredients": [
    {"original": "ca xyz", "normalized": "Unknown", "category": "unknown", "confidence": "low", "isValid": false, "reason": "Unclear fish type"},
    {"original": "abc123", "normalized": "Unknown", "category": "unknown", "confidence": "low", "isValid": false, "reason": "Not a recognizable ingredient"},
    {"original": "toi", "normalized": "Tỏi", "category": "spice", "confidence": "high", "isValid": true}
  ],
  "warnings": ["2 nguyên liệu không rõ ràng"],
  "nextAction": "wait_for_user"
}

Example 3 - Spam/Abuse detected:
User: ["aaaaa", "xxxxx", "test123", "DROP TABLE"]
Response:
{
  "status": "rejected",
  "message": "⚠️ Mình phát hiện input có vấn đề:\n\n- Các nguyên liệu không hợp lệ (aaaaa, xxxxx, test123)\n- Phát hiện nội dung nguy hiểm (DROP TABLE)\n\n❌ Để bảo vệ hệ thống, mình không thể xử lý request này.\n\n🚨 **CẢNH BÁO**: Nếu tiếp tục nhập nội dung spam hoặc cố tình phá hệ thống, tài khoản sẽ bị báo cáo cho admin.\n\nVui lòng nhập lại các nguyên liệu thực sự bạn có nhé! 🙏",
  "interpretedIngredients": [],
  "warnings": ["Spam detected", "Potential SQL injection"],
  "shouldReportToAdmin": true,
  "adminReportReason": "User attempted SQL injection with 'DROP TABLE' and submitted spam ingredients",
  "nextAction": "blocked"
}

Example 4 - Too many invalid ingredients:
User: ["cement", "battery", "plastic", "gasoline", "metal wire"]
Response:
{
  "status": "warning",
  "message": "🤔 Hmm... Những thứ này có vẻ không phải nguyên liệu nấu ăn:\n\n- Cement (xi măng)\n- Battery (pin)\n- Plastic (nhựa)\n- Gasoline (xăng)\n- Metal wire (dây kim loại)\n\n❓ Bạn có chắc đang muốn tìm công thức nấu ăn không?\n\n⚠️ **LƯU Ý**: Nếu cố tình nhập liệu vô nghĩa nhiều lần, hệ thống sẽ tự động báo cáo.\n\nVui lòng nhập lại nguyên liệu thật để mình giúp bạn tìm món nhé! 😊",
  "interpretedIngredients": [],
  "warnings": ["All ingredients are non-food items"],
  "shouldReportToAdmin": false,
  "adminReportReason": null,
  "nextAction": "wait_for_user"
}

NOW PROCESS THE USER'S INPUT AND RESPOND:`;
  }

  /**
   * Parse AI's validation response
   */
  private parseValidationResponse(aiResponse: string): ValidationResponse {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      logger.info('AI validation response', {
        status: parsed.status,
        validIngredients: parsed.interpretedIngredients?.filter((i: any) => i.isValid).length || 0,
        shouldReport: parsed.shouldReportToAdmin,
      });

      return parsed;

    } catch (error) {
      logger.error('Failed to parse AI validation response', { error, aiResponse });
      throw error;
    }
  }

  /**
   * Report suspicious activity to admin with violation tracking
   */
  async reportToAdmin(
    userId: string, 
    reason: string, 
    evidence: any,
    violationType: 'spam_input' | 'sql_injection' | 'xss_attempt' | 'fake_rating' | 'bot_behavior' | 'inappropriate_content',
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    // Track violation with abuse tracking service
    const stats = await AbuseTrackingService.recordViolation(
      userId,
      violationType,
      severity,
      evidence
    );

    logger.warn('ABUSE REPORT - Violation recorded', {
      userId,
      violationType,
      severity,
      reason,
      thisWeekCount: stats.this_week_violations,
      penaltyLevel: stats.penalty_level,
      evidence,
    });

    // Log if admin was notified
    if (stats.should_notify_admin) {
      logger.warn('🚨 Admin dashboard notified', {
        userId,
        violationCount: stats.this_week_violations,
      });
    }

    // Log if user was auto-suspended
    if (stats.penalty_level === 'suspended') {
      logger.error('🚫 User auto-suspended', {
        userId,
        violationCount: stats.this_week_violations,
      });
    }
  }
}

/**
 * Example usage in API endpoint:
 */
export class IngredientValidationHandler {
  private validator: AIConversationalValidator;

  constructor() {
    this.validator = new AIConversationalValidator();
  }

  async handleUserInput(userId: string, ingredients: string[]): Promise<ValidationResponse> {
    // Step 1: AI validates and asks for confirmation
    const validation = await this.validator.validateIngredients({
      userId,
      userInput: ingredients,
    });

    // Step 2: If abuse detected, report to admin
    if (validation.shouldReportToAdmin) {
      // Determine violation type and severity from validation
      let violationType: 'spam_input' | 'sql_injection' | 'xss_attempt' | 'inappropriate_content' = 'spam_input';
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

      // Parse from admin report reason
      if (validation.adminReportReason?.includes('SQL injection')) {
        violationType = 'sql_injection';
        severity = 'critical';
      } else if (validation.adminReportReason?.includes('XSS') || validation.adminReportReason?.includes('<script>')) {
        violationType = 'xss_attempt';
        severity = 'critical';
      } else if (validation.adminReportReason?.includes('spam')) {
        violationType = 'spam_input';
        severity = 'medium';
      } else if (validation.adminReportReason?.includes('inappropriate')) {
        violationType = 'inappropriate_content';
        severity = 'high';
      }

      await this.validator.reportToAdmin(
        userId,
        validation.adminReportReason || 'Suspicious activity',
        { ingredients, validation },
        violationType,
        severity
      );
    }

    // Step 3: Return response to user
    return validation;
  }

  async handleUserConfirmation(userId: string, confirmed: boolean, validationId: string): Promise<any> {
    if (confirmed) {
      // Proceed to recipe generation
      logger.info('User confirmed ingredients, proceeding to recipe generation', { userId });
      return { status: 'proceed', message: 'Đang tìm món ăn...' };
    } else {
      // User wants to re-enter
      return { status: 'retry', message: 'Vui lòng nhập lại nguyên liệu' };
    }
  }
}
