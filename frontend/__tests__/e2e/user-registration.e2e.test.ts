/**
 * User Registration E2E Test
 * Tests complete user registration workflow against real AWS services
 * 
 * WORKFLOW:
 * 1. Create test user in Cognito (via SDK)
 * 2. Confirm user (via AWS CLI admin command)
 * 3. Login via API Gateway (triggers lazy profile creation in Lambda)
 * 4. Access profile (verifies profile was created in DynamoDB)
 * 5. Update profile (tests write operations)
 * 6. Verify persistence (tests read after write)
 * 
 * LAZY PROFILE CREATION:
 * - Profile is NOT created via Cognito Post-Confirmation trigger
 * - Profile IS created automatically on first login via auth-handler Lambda
 * - This approach avoids circular dependency issues with Cognito triggers
 * - See: lambda/auth-handler/index.ts -> createOrUpdateUserProfile()
 * 
 * TEST COVERAGE:
 * ✓ User registration in Cognito
 * ✓ User login via API Gateway
 * ✓ Automatic profile creation (lazy creation)
 * ✓ Profile retrieval via API Gateway + DynamoDB
 * ✓ Profile updates via API Gateway + DynamoDB
 * ✓ Invalid credentials rejection
 * ✓ Unauthorized access rejection
 * ✓ Invalid token rejection
 * 
 * CLEANUP:
 * To delete test user after running:
 * aws cognito-idp admin-delete-user --user-pool-id us-east-1_IT8I0ahLq --username e2etest<timestamp>@example.com
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

// Real AWS configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://kmt7f23tbj.execute-api.us-east-1.amazonaws.com/dev';
const COGNITO_CONFIG = {
  region: 'us-east-1',
  userPoolId: 'us-east-1_IT8I0ahLq',
  clientId: '9uv8cae0764o703e6s0v612n0',
};

// Initialize Cognito UserPool for E2E testing
const userPool = new CognitoUserPool({
  UserPoolId: COGNITO_CONFIG.userPoolId,
  ClientId: COGNITO_CONFIG.clientId,
});

/**
 * Helper function to sign in with Cognito
 */
async function signInWithCognito(email: string, password: string): Promise<CognitoUserSession> {
  const authenticationDetails = new AuthenticationDetails({
    Username: email,
    Password: password,
  });

  const cognitoUser = new CognitoUser({
    Username: email,
    Pool: userPool,
  });

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        resolve(session);
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * Helper function to sign up a new user in Cognito
 */
async function signUpInCognito(email: string, password: string, name: string): Promise<void> {
  const attributeList = [
    new CognitoUserAttribute({ Name: 'email', Value: email }),
    new CognitoUserAttribute({ Name: 'name', Value: name }),
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributeList, [], (err, _result) => {
      if (err) {
        // If user already exists, that's okay
        if (err.name === 'UsernameExistsException') {
          console.log('  User already exists in Cognito');
          resolve();
          return;
        }
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Helper function to confirm user registration (admin action)
 * Note: This requires AWS CLI to be configured with admin credentials
 */
async function confirmUserInCognito(email: string): Promise<void> {
  try {
    // Use AWS SDK or CLI to confirm user
    // For E2E testing, we'll use admin-confirm-sign-up via CLI
    const { execSync } = require('child_process');
    
    const command = `aws cognito-idp admin-confirm-sign-up --user-pool-id ${COGNITO_CONFIG.userPoolId} --username ${email}`;
    
    execSync(command, { stdio: 'pipe' });
    console.log('  User confirmed in Cognito');
  } catch (error: any) {
    // If already confirmed, that's okay
    if (error.message.includes('User is already confirmed') || 
        error.message.includes('NotAuthorizedException')) {
      console.log('  User already confirmed or no admin access');
      return;
    }
    throw error;
  }
}

/**
 * Helper function to sign out
 */
function signOutFromCognito(): void {
  const cognitoUser = userPool.getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
}

describe('User Registration E2E Flow', () => {
  // Generate unique test user to avoid conflicts
  const timestamp = Date.now();
  const TEST_USER = {
    email: `e2etest${timestamp}@example.com`,
    password: 'Test123456!',
    name: 'E2E Test User',
  };
  
  let idToken: string;
  let userCreated = false;

  beforeAll(async () => {
    // Setup: Create test user in Cognito if needed
    console.log('\n🔧 Setting up E2E test user...');
    console.log(`  Email: ${TEST_USER.email}`);
    
    try {
      // Try to sign up the user
      await signUpInCognito(TEST_USER.email, TEST_USER.password, TEST_USER.name);
      userCreated = true;
      
      // Try to confirm the user (requires AWS CLI with admin credentials)
      await confirmUserInCognito(TEST_USER.email);
      
      console.log('✓ Test user created and confirmed in Cognito');
    } catch (error: any) {
      console.log(`  Note: ${error.message}`);
      console.log('  Will attempt to use existing user or skip confirmation');
    }
  }, 60000);

  afterAll(() => {
    // Cleanup: Sign out after tests
    signOutFromCognito();
    
    if (userCreated) {
      console.log('\n🧹 Cleanup: To delete test user, run:');
      console.log(`  aws cognito-idp admin-delete-user --user-pool-id ${COGNITO_CONFIG.userPoolId} --username ${TEST_USER.email}`);
    }
  });

  it('should successfully login via API Gateway and trigger profile creation', async () => {
    // Step 1: Login via API Gateway (not direct Cognito SDK)
    // This will trigger lazy profile creation in auth-handler Lambda
    console.log('\nStep 1: Logging in via API Gateway...');
    console.log(`  Email: ${TEST_USER.email}`);
    console.log(`  URL: ${API_URL}/v1/auth`);
    
    const loginResponse = await fetch(`${API_URL}/v1/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'login',
        username: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });

    console.log(`  Response status: ${loginResponse.status}`);
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error(`  Error response: ${errorText}`);
      
      if (loginResponse.status === 400 && errorText.includes('UserNotConfirmedException')) {
        console.error('\n⚠️  User not confirmed in Cognito.');
        console.error('  Run this command to confirm the user:');
        console.error(`  aws cognito-idp admin-confirm-sign-up --user-pool-id ${COGNITO_CONFIG.userPoolId} --username ${TEST_USER.email}`);
      }
    }

    expect(loginResponse.ok).toBe(true);
    expect(loginResponse.status).toBe(200);
    
    const loginData = await loginResponse.json();
    console.log('  Login response:', JSON.stringify(loginData, null, 2));
    
    // Check if tokens are in the response or nested
    const tokens = loginData.tokens || loginData.data?.tokens || loginData;
    
    expect(tokens).toBeDefined();
    expect(tokens.idToken).toBeDefined();
    
    idToken = tokens.idToken;
    
    console.log('✓ Login successful via API Gateway');
    console.log(`  Token length: ${idToken.length} characters`);
    console.log('  Note: Profile should be created automatically via lazy creation in Lambda');
  }, 60000);

  it('should access and update profile via API Gateway', async () => {
    // Ensure we have a token from previous test
    if (!idToken) {
      const session = await signInWithCognito(TEST_USER.email, TEST_USER.password);
      idToken = session.getIdToken().getJwtToken();
    }

    // Step 2: Access protected profile endpoint (calls real API Gateway + DynamoDB)
    // Profile should exist now due to lazy creation on login
    console.log('\nStep 2: Accessing profile endpoint...');
    console.log(`  URL: ${API_URL}/v1/users`);
    
    const profileResponse = await fetch(`${API_URL}/v1/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`  Response status: ${profileResponse.status}`);
    
    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error(`  Error response: ${errorText}`);
      
      if (profileResponse.status === 404 || profileResponse.status === 500) {
        console.error('\n⚠️  ISSUE:');
        console.error('  Profile was not created automatically on login.');
        console.error('  This indicates the lazy profile creation in Lambda may have failed.');
        console.error('  Check Lambda logs for auth-handler function.');
      }
    }

    expect(profileResponse.ok).toBe(true);
    expect(profileResponse.status).toBe(200);
    
    const profileData = await profileResponse.json();
    console.log('  Profile response:', JSON.stringify(profileData, null, 2));
    
    // Extract profile from response (may be nested in data or profile key)
    const profile = profileData.profile || profileData.data?.profile || profileData;
    
    expect(profile).toBeDefined();
    expect(profile.email).toBe(TEST_USER.email);
    expect(profile.user_id).toBeDefined();
    
    console.log('✓ Profile retrieved successfully:', {
      userId: profile.user_id,
      email: profile.email,
    });

    // Step 3: Update profile (calls real DynamoDB via Lambda)
    console.log('Step 3: Updating profile...');
    
    const updateData = {
      full_name: 'Updated E2E Test User',
      bio: 'This is an E2E test user profile',
      gender: 'other',
      country: 'US',
    };

    const updateResponse = await fetch(`${API_URL}/v1/users`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`  Update error (${updateResponse.status}): ${errorText}`);
    }

    expect(updateResponse.ok).toBe(true);
    expect(updateResponse.status).toBe(200);
    
    const updatedProfileData = await updateResponse.json();
    const updatedProfile = updatedProfileData.profile || updatedProfileData.data?.profile || updatedProfileData;
    
    expect(updatedProfile.full_name).toBe('Updated E2E Test User');
    expect(updatedProfile.bio).toBe('This is an E2E test user profile');
    expect(updatedProfile.gender).toBe('other');
    expect(updatedProfile.country).toBe('US');
    
    console.log('✓ Profile updated successfully');

    // Step 4: Verify updated profile persists (read again from DynamoDB)
    console.log('Step 4: Verifying profile updates persisted...');
    
    const verifyResponse = await fetch(`${API_URL}/v1/users`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(verifyResponse.ok).toBe(true);
    
    const verifiedProfileData = await verifyResponse.json();
    const verifiedProfile = verifiedProfileData.profile || verifiedProfileData.data?.profile || verifiedProfileData;
    
    expect(verifiedProfile.full_name).toBe('Updated E2E Test User');
    expect(verifiedProfile.bio).toBe('This is an E2E test user profile');
    expect(verifiedProfile.gender).toBe('other');
    
    console.log('✓ Profile updates verified and persisted');
    console.log('\n✅ Complete E2E registration workflow successful!');
  }, 60000); // 60 second timeout for real AWS calls

  it('should reject login with invalid credentials', async () => {
    console.log('Testing invalid login...');
    
    await expect(
      signInWithCognito(TEST_USER.email, 'WrongPassword123!')
    ).rejects.toThrow();
    
    console.log('✓ Invalid login correctly rejected');
  }, 30000);

  it('should reject unauthorized access to profile endpoint', async () => {
    console.log('Testing unauthorized profile access...');
    
    const response = await fetch(`${API_URL}/v1/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // No Authorization header
      },
    });

    expect(response.ok).toBe(false);
    // API Gateway can return 401, 403, or 500 for missing auth
    expect(response.status).toBeGreaterThanOrEqual(400);
    console.log(`  Received status: ${response.status}`);
    
    console.log('✓ Unauthorized access correctly rejected');
  }, 30000);

  it('should reject profile access with invalid token', async () => {
    console.log('Testing profile access with invalid token...');
    
    const response = await fetch(`${API_URL}/v1/users`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer invalid-token-12345',
        'Content-Type': 'application/json',
      },
    });

    expect(response.ok).toBe(false);
    // API Gateway can return 401, 403, or 500 for invalid auth
    expect(response.status).toBeGreaterThanOrEqual(400);
    console.log(`  Received status: ${response.status}`);
    
    console.log('✓ Invalid token correctly rejected');
  }, 30000);
});
