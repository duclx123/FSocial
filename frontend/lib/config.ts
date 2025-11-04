export interface CognitoConfig {
  region: string;
  userPoolId: string;
  clientId: string;
}

export const cognitoConfig: CognitoConfig = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'placeholder',
  clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || 'placeholder',
};

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
