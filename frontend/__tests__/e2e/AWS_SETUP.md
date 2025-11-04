# AWS Setup for E2E Tests

## Overview

End-to-end (E2E) tests require AWS credentials to interact with the deployed backend API. These tests make real API calls to AWS services including Cognito, DynamoDB, and Lambda functions.

## Required Environment Variables

Create a `.env.test` file in the `frontend` directory with the following variables:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev

# AWS Cognito Configuration
NEXT_PUBLIC_USER_POOL_ID=us-east-1_YourPoolId
NEXT_PUBLIC_USER_POOL_CLIENT_ID=your-client-id

# Test Environment Flag
TEST_ENV=integration
```

## AWS Credentials

E2E tests use AWS Cognito for authentication. You need:

1. **Valid AWS Cognito User Pool**: The user pool should be deployed and accessible
2. **Test User Accounts**: Create test users in your Cognito user pool for testing
3. **API Gateway Endpoint**: The backend API must be deployed and accessible

## Running E2E Tests

### With Real AWS Backend (Integration Mode)

```bash
# Set environment to integration
export TEST_ENV=integration

# Run E2E tests
npm test -- __tests__/e2e/
```

### With Mock Backend (Default)

```bash
# Set environment to mock (or leave unset)
export TEST_ENV=mock

# Run E2E tests
npm test -- __tests__/e2e/
```

## Test User Setup

E2E tests expect certain test users to exist in your Cognito user pool:

- **testuser1@example.com**: Primary test user
- **testuser2@example.com**: Secondary test user for friend/social features
- **admin@example.com**: Admin user for admin workflow tests

### Creating Test Users

You can create test users using AWS CLI:

```bash
# Create a test user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_YourPoolId \
  --username testuser1@example.com \
  --user-attributes Name=email,Value=testuser1@example.com Name=email_verified,Value=true \
  --temporary-password TempPassword123! \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_YourPoolId \
  --username testuser1@example.com \
  --password TestPassword123! \
  --permanent
```

## Troubleshooting

### Authentication Errors

If you see authentication errors:
- Verify your Cognito user pool ID and client ID are correct
- Ensure test users exist and have confirmed passwords
- Check that the user pool allows username/password authentication

### API Connection Errors

If you see connection errors:
- Verify the API Gateway URL is correct and accessible
- Check that CORS is properly configured on the API
- Ensure your IP is not blocked by any security groups

### Rate Limiting

AWS Cognito has rate limits. If tests fail due to rate limiting:
- Add delays between test runs
- Use fewer concurrent test workers
- Consider using mock mode for rapid development

## Mock vs Integration Mode

### Mock Mode (Default)
- Uses mocked API responses
- No AWS credentials required
- Fast execution
- Good for development and CI/CD

### Integration Mode
- Makes real API calls to AWS
- Requires valid AWS credentials
- Slower execution
- Good for pre-deployment validation

## CI/CD Configuration

For CI/CD pipelines, store AWS credentials as secrets:

```yaml
# GitHub Actions example
env:
  NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
  NEXT_PUBLIC_USER_POOL_ID: ${{ secrets.USER_POOL_ID }}
  NEXT_PUBLIC_USER_POOL_CLIENT_ID: ${{ secrets.USER_POOL_CLIENT_ID }}
  TEST_ENV: integration
```

## Security Notes

- Never commit `.env.test` files with real credentials
- Use separate test AWS accounts/resources when possible
- Rotate test user passwords regularly
- Clean up test data after E2E test runs
