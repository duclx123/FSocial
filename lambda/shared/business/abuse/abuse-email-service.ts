/**
 * Abuse Email Service
 * Handles email notifications for abuse tracking and suspensions
 */

import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../../monitoring/logger';
import { DynamoDBHelper } from '../../database/dynamodb';
import { AbuseRecord } from './abuse-tracking-service';

const sns = new SNSClient({});
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://awssmartcookingss.com';

export class AbuseEmailService {
  /**
   * Send suspension notification email to user
   */
  static async sendSuspensionEmail(
    userId: string,
    tier: number,
    suspendedUntil: string,
    violationCount: number,
    violations: AbuseRecord[]
  ): Promise<void> {
    try {
      // Get user email
      const user = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');
      if (!user?.email) {
        logger.warn('Cannot send suspension email - no email found', { userId });
        return;
      }

      const tierDescriptions = {
        1: '1 hour suspension',
        2: '24 hour suspension',
        3: '30 day suspension'
      };

      const canAppeal = tier < 3;
      const suspendedUntilDate = new Date(suspendedUntil);
      
      // Build violation details with post links
      const violationDetails = violations.slice(0, 5).map(v => {
        let detail = `- ${v.violation_type} (${v.severity})`;
        
        // Add post link if available
        if (v.evidence?.post_id) {
          detail += ` - Post: ${FRONTEND_URL}/posts/${v.evidence.post_id}`;
        } else if (v.evidence?.comment_id) {
          detail += ` - Comment: ${v.evidence.comment_id}`;
        }
        
        return detail;
      }).join('\n');

      const emailSubject = `⚠️ Your Smart Cooking Account Has Been Suspended`;
      
      const emailBody = `
Dear ${user.display_name || user.username},

Your Smart Cooking account has been temporarily suspended due to multiple violations of our community guidelines.

SUSPENSION DETAILS:
- Duration: ${tierDescriptions[tier as keyof typeof tierDescriptions] || 'Unknown'}
- Suspended Until: ${suspendedUntilDate.toLocaleString('vi-VN')}
- Violation Count: ${violationCount} violations this week
- Tier: ${tier}

RECENT VIOLATIONS:
${violationDetails}
${violations.length > 5 ? `\n... and ${violations.length - 5} more violations` : ''}

WHAT THIS MEANS:
- You cannot log in until ${suspendedUntilDate.toLocaleString('vi-VN')}
- Your account will be automatically reactivated after this period
- Your data and recipes are safe and will not be deleted

${canAppeal ? `
APPEAL PROCESS:
If you believe this suspension was made in error, you can appeal by:
1. Visiting: ${FRONTEND_URL}/appeal
2. Providing details about why you believe the suspension is incorrect
3. Our team will review your appeal within 24-48 hours
` : `
IMPORTANT:
Due to the severity of violations (Tier 3), this suspension cannot be appealed.
Please review our community guidelines carefully.
`}

COMMUNITY GUIDELINES:
${FRONTEND_URL}/guidelines

If you have questions, please contact support@awssmartcookingss.com

Best regards,
Smart Cooking Team
      `.trim();

      // Send via SNS
      await sns.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: emailSubject,
        Message: JSON.stringify({
          type: 'account_suspension',
          to: user.email,
          subject: emailSubject,
          body: emailBody,
          userId,
          tier,
          suspendedUntil,
          violationCount
        })
      }));

      logger.info('Suspension email sent', { userId, email: user.email, tier });
    } catch (error) {
      logger.error('Failed to send suspension email', { error, userId });
      // Don't throw - suspension should still proceed even if email fails
    }
  }

  /**
   * Send warning email to user (5 violations threshold)
   */
  static async sendWarningEmail(
    userId: string,
    violationCount: number,
    violations: AbuseRecord[]
  ): Promise<void> {
    try {
      // Get user email
      const user = await DynamoDBHelper.get(`USER#${userId}`, 'PROFILE');
      if (!user?.email) {
        logger.warn('Cannot send warning email - no email found', { userId });
        return;
      }

      // Build violation details with post links
      const violationDetails = violations.slice(0, 5).map(v => {
        let detail = `- ${v.violation_type} (${v.severity}) at ${new Date(v.timestamp).toLocaleString('vi-VN')}`;
        
        // Add post link if available
        if (v.evidence?.post_id) {
          detail += `\n  Post: ${FRONTEND_URL}/posts/${v.evidence.post_id}`;
        } else if (v.evidence?.comment_id) {
          detail += `\n  Comment ID: ${v.evidence.comment_id}`;
        } else if (v.evidence?.recipe_id) {
          detail += `\n  Recipe: ${FRONTEND_URL}/recipes/${v.evidence.recipe_id}`;
        }
        
        return detail;
      }).join('\n\n');

      const emailSubject = `⚠️ Warning: Multiple Violations Detected on Your Account`;
      
      const emailBody = `
Dear ${user.display_name || user.username},

We've detected ${violationCount} violations of our community guidelines on your account this week.

RECENT VIOLATIONS:
${violationDetails}
${violations.length > 5 ? `\n... and ${violations.length - 5} more violations` : ''}

⚠️ WARNING:
- You currently have ${violationCount} violations this week
- At 10 violations, your account will be AUTOMATICALLY SUSPENDED
- Suspensions range from 1 hour to 30 days depending on severity

WHAT YOU SHOULD DO:
1. Review our community guidelines: ${FRONTEND_URL}/guidelines
2. Ensure your posts and comments follow our rules
3. Avoid spam, inappropriate content, and malicious behavior
4. If you have questions, contact support@awssmartcookingss.com

VIOLATION TYPES TO AVOID:
- Spam or repetitive content
- SQL injection or XSS attempts
- Fake ratings or reviews
- Bot-like behavior
- Inappropriate or offensive content

Your cooperation helps keep Smart Cooking a safe and enjoyable community for everyone.

Best regards,
Smart Cooking Team
      `.trim();

      // Send via SNS
      await sns.send(new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Subject: emailSubject,
        Message: JSON.stringify({
          type: 'abuse_warning',
          to: user.email,
          subject: emailSubject,
          body: emailBody,
          userId,
          violationCount,
          violations: violations.slice(0, 5)
        })
      }));

      logger.info('Warning email sent', { userId, email: user.email, violationCount });
    } catch (error) {
      logger.error('Failed to send warning email', { error, userId });
      // Don't throw - warning should still be recorded even if email fails
    }
  }
}
