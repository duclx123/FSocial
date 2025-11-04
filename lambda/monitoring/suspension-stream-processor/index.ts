/**
 * Suspension Stream Processor Lambda
 * 
 * Triggered by DynamoDB Streams when TTL deletes ACTIVE_SUSPENSION records.
 * Automatically unsuspends users when their suspension expires.
 * 
 * Flow:
 * 1. DynamoDB TTL deletes ACTIVE_SUSPENSION record
 * 2. Stream event triggers this Lambda
 * 3. Lambda updates user profile to "active"
 * 4. Send reactivation email to user
 */

import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const dynamodb = new DynamoDBClient({});
const ses = new SESClient({});

const TABLE_NAME = process.env.TABLE_NAME!;
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'admin@awssmartcookingss.com';

interface SuspensionRecord {
  PK: string;
  SK: string;
  suspension_tier?: string;
  suspended_at?: string;
  unsuspend_at?: string;
  suspension_reason?: string;
}

export async function handler(event: DynamoDBStreamEvent) {
  console.log('Suspension Stream Processor started');
  console.log('Event records:', event.Records.length);

  const results = {
    successful: 0,
    failed: 0,
    skipped: 0
  };

  for (const record of event.Records) {
    try {
      await processRecord(record, results);
    } catch (error) {
      console.error('Error processing record:', error);
      results.failed++;
      
      // Don't throw - let other records process
      // DynamoDB Streams will retry failed records
    }
  }

  console.log('Processing complete:', results);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Stream processing completed',
      results
    })
  };
}

async function processRecord(
  record: DynamoDBRecord,
  results: { successful: number; failed: number; skipped: number }
) {
  // Only process REMOVE events (TTL deletions)
  if (record.eventName !== 'REMOVE') {
    console.log('Skipping non-REMOVE event:', record.eventName);
    results.skipped++;
    return;
  }

  // Get the deleted item
  const oldImage = record.dynamodb?.OldImage;
  if (!oldImage) {
    console.log('No OldImage in record');
    results.skipped++;
    return;
  }

  const suspensionRecord = unmarshall(oldImage as any) as SuspensionRecord;

  // Verify this is an ACTIVE_SUSPENSION record
  if (!suspensionRecord.SK || !suspensionRecord.SK.startsWith('ACTIVE_SUSPENSION')) {
    console.log('Not an ACTIVE_SUSPENSION record, skipping');
    results.skipped++;
    return;
  }

  // Extract user ID
  const userId = suspensionRecord.PK?.replace('USER#', '');
  if (!userId) {
    console.error('Could not extract user ID from PK:', suspensionRecord.PK);
    results.failed++;
    return;
  }

  console.log(`Processing auto-unsuspend for user: ${userId}`);
  console.log('Suspension details:', {
    tier: suspensionRecord.suspension_tier,
    suspended_at: suspensionRecord.suspended_at,
    unsuspend_at: suspensionRecord.unsuspend_at
  });

  try {
    // 1. Update user profile to active
    await unsuspendUser(userId);
    
    // 2. Get user details for email
    const user = await getUser(userId);
    
    // 3. Send reactivation email
    if (user?.email) {
      await sendReactivationEmail(user, suspensionRecord);
    }
    
    console.log(`✅ Successfully unsuspended user ${userId}`);
    results.successful++;
    
  } catch (error) {
    console.error(`❌ Failed to unsuspend user ${userId}:`, error);
    results.failed++;
    throw error; // Re-throw to trigger retry
  }
}

async function unsuspendUser(userId: string): Promise<void> {
  const now = new Date().toISOString();

  await dynamodb.send(new UpdateItemCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: { S: `USER#${userId}` },
      SK: { S: 'PROFILE' }
    },
    UpdateExpression: `
      SET account_status = :active,
          unsuspended_at = :now
      REMOVE suspended_at, unsuspend_at, suspension_reason, suspension_tier, GSI3PK, GSI3SK
    `,
    ExpressionAttributeValues: {
      ':active': { S: 'active' },
      ':now': { S: now }
    },
    ConditionExpression: 'attribute_exists(PK)' // Ensure user exists
  }));

  console.log(`Updated user ${userId} profile to active`);
}

async function getUser(userId: string): Promise<any> {
  const result = await dynamodb.send(new GetItemCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: { S: `USER#${userId}` },
      SK: { S: 'PROFILE' }
    }
  }));

  if (!result.Item) {
    throw new Error(`User ${userId} not found`);
  }

  return unmarshall(result.Item);
}

async function sendReactivationEmail(
  user: any,
  suspensionRecord: SuspensionRecord
): Promise<void> {
  const displayName = user.display_name || 'User';
  const tier = suspensionRecord.suspension_tier || 'unknown';
  const suspendedAt = suspensionRecord.suspended_at || 'unknown';
  const unsuspendAt = suspensionRecord.unsuspend_at || 'unknown';

  const tierDescriptions: Record<string, string> = {
    tier1: 'Tier 1 (1 hour cooldown)',
    tier2: 'Tier 2 (1 day ban)',
    tier3: 'Tier 3 (30 day ban)'
  };

  const tierDescription = tierDescriptions[tier] || tier;

  const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Account Reactivated</h1>
    </div>
    
    <div class="content">
      <p>Dear ${displayName},</p>
      
      <p>Good news! Your Smart Cooking account has been automatically reactivated.</p>
      
      <div class="info-box">
        <h3>Previous Suspension Details:</h3>
        <ul>
          <li><strong>Tier:</strong> ${tierDescription}</li>
          <li><strong>Suspended On:</strong> ${new Date(suspendedAt).toLocaleString()}</li>
          <li><strong>Reactivated On:</strong> ${new Date(unsuspendAt).toLocaleString()}</li>
        </ul>
      </div>
      
      <p>You can now access all Smart Cooking features again.</p>
      
      <p><strong>Please remember to follow our community guidelines to avoid future suspensions.</strong></p>
      
      <p>Welcome back!</p>
      
      <p>Best regards,<br>The Smart Cooking Team</p>
    </div>
    
    <div class="footer">
      <p>This is an automated message from Smart Cooking. Please do not reply to this email.</p>
      <p>If you have questions, contact us at ${ALERT_EMAIL}</p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await ses.send(new SendEmailCommand({
      Source: ALERT_EMAIL,
      Destination: {
        ToAddresses: [user.email]
      },
      Message: {
        Subject: {
          Data: '✅ Your Smart Cooking Account Has Been Reactivated',
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: emailBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: `Dear ${displayName},\n\nYour Smart Cooking account has been reactivated.\n\nPrevious Suspension: ${tierDescription}\nSuspended: ${suspendedAt}\nReactivated: ${unsuspendAt}\n\nBest regards,\nSmart Cooking Team`,
            Charset: 'UTF-8'
          }
        }
      }
    }));

    console.log(`Reactivation email sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send reactivation email:', error);
    // Don't throw - email failure shouldn't prevent unsuspension
  }
}
