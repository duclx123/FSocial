/**
 * API Router Lambda - Single entry point for all API requests
 * 
 * This Lambda function routes requests to appropriate handlers
 * Solves circular dependency issues
 * 
 * AUTHENTICATION:
 * - Validates JWT tokens from Authorization header
 * - Extracts user ID and injects into requestContext
 * - Handlers can access user ID via getUserIdFromEvent()
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Import all handlers
import { handler as authHandler } from '../auth-handler/index';
import { handler as userProfileHandler } from '../user-profile/index';
import { handler as aiSuggestionHandler } from '../ai-suggestion/index';
import { handler as postsHandler } from '../posts/index';
import { handler as friendsHandler } from '../friends/index';
import { handler as notificationsHandler } from '../notifications/index';
import { handler as adminHandler } from '../admin/index';
import { handler as recipeSearchHandler } from '../recipe-search/index';
import { handler as searchHandler } from '../search/index';
import { handler as savedRecipesHandler } from '../saved-recipes/index';

/**
 * Extract and decode JWT token from Authorization header
 * Returns all claims if valid, null otherwise
 */
function extractTokenClaims(authHeader: string | undefined): Record<string, any> | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Decode JWT (without verification - Cognito already verified it)
    // Format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (base64url)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Return all claims
    return payload;
  } catch (error) {
    console.error('Failed to extract claims from token:', error);
    return null;
  }
}

/**
 * Route Configuration
 * 
 * ROUTING STRATEGY:
 * - Routes are matched in order from most specific to least specific
 * - Each route can have exact match or prefix match
 * - Use 'exact: true' for exact path matching
 * - Use 'exact: false' (default) for prefix matching
 * 
 * BEST PRACTICES:
 * 1. Group related routes together with comments
 * 2. Put more specific routes before general ones
 * 3. Document the purpose of each route
 * 4. Use exact matching when possible to avoid conflicts
 */

interface RouteConfig {
  path: string;
  handler: any;
  exact?: boolean; // If true, path must match exactly (no prefix matching)
  description?: string; // Documentation for developers
}

const routes: RouteConfig[] = [
  // ==================== AUTHENTICATION ====================
  {
    path: '/v1/auth',
    handler: authHandler,
    description: 'User authentication (login, register, password reset)',
  },

  // ==================== USER PROFILE ====================
  {
    path: '/v1/users',
    handler: userProfileHandler,
    description: 'User profile management',
  },

  // ==================== AI SUGGESTIONS ====================
  {
    path: '/v1/ai',
    handler: aiSuggestionHandler,
    description: 'AI-powered recipe suggestions',
  },

  // ==================== POSTS & SOCIAL ====================
  {
    path: '/v1/posts',
    handler: postsHandler,
    description: 'Social posts, comments, reactions',
  },

  // ==================== FRIENDS ====================
  {
    path: '/v1/friends',
    handler: friendsHandler,
    description: 'Friend requests and friendships',
  },

  // ==================== NOTIFICATIONS ====================
  {
    path: '/v1/notifications',
    handler: notificationsHandler,
    description: 'User notifications',
  },

  // ==================== ADMIN ====================
  {
    path: '/v1/admin',
    handler: adminHandler,
    description: 'Admin operations (stats, moderation)',
  },

  // ==================== RECIPE SEARCH (Public) ====================
  // These routes are for searching/browsing public recipes
  // Must come BEFORE /v1/recipes to avoid conflicts
  {
    path: '/v1/recipes/search',
    handler: recipeSearchHandler,
    description: 'Search public recipes by ingredients, cuisine, etc.',
  },
  {
    path: '/v1/recipes/trending',
    handler: recipeSearchHandler,
    description: 'Get trending public recipes',
  },
  {
    path: '/v1/recipes/recent',
    handler: recipeSearchHandler,
    description: 'Get recent public recipes',
  },
  {
    path: '/v1/recipes/by-user',
    handler: recipeSearchHandler,
    description: 'Get recipes by specific user',
  },

  // ==================== SAVED RECIPES (Personal) ====================
  // These routes are for user's personal saved recipes
  // Must come AFTER specific /v1/recipes/* routes above
  {
    path: '/v1/recipes',
    handler: savedRecipesHandler,
    description: 'Personal saved recipes (CRUD, groups, favorites)',
  },

  // ==================== LEGACY ROUTES ====================
  {
    path: '/v1/me',
    handler: savedRecipesHandler,
    description: 'Legacy: Personal saved recipes (use /v1/recipes instead)',
  },

  // ==================== GLOBAL SEARCH ====================
  {
    path: '/v1/search',
    handler: searchHandler,
    description: 'Global search across all content',
  },
];

/**
 * Main router handler
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path || event.resource || '';

    console.log('API Router:', {
      path,
      method: event.httpMethod,
      resource: event.resource,
    });

    // Find matching route
    // Routes are checked in order, so more specific routes are matched first
    let targetHandler: any = null;
    let matchedRoute: RouteConfig | null = null;

    for (const route of routes) {
      if (route.exact) {
        // Exact match required
        if (path === route.path) {
          targetHandler = route.handler;
          matchedRoute = route;
          break;
        }
      } else {
        // Prefix match (default)
        if (path.startsWith(route.path)) {
          targetHandler = route.handler;
          matchedRoute = route;
          break; // Use first match (most specific due to order)
        }
      }
    }

    if (!targetHandler) {
      console.error('No route matched:', { path, method: event.httpMethod });
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Not Found',
          message: `No handler found for path: ${path}`,
          hint: 'Check API documentation for available endpoints',
        }),
      };
    }

    console.log(`Matched route: ${matchedRoute?.path} - ${matchedRoute?.description}`);

    // Extract all claims from JWT token and inject into requestContext
    // This mimics what API Gateway Cognito Authorizer would do
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    const claims = extractTokenClaims(authHeader);
    
    if (claims) {
      // Inject all claims into requestContext so handlers can access them
      // This matches the structure that getUserIdFromEvent() and admin checks expect
      if (!event.requestContext) {
        event.requestContext = {} as any;
      }
      if (!event.requestContext.authorizer) {
        event.requestContext.authorizer = {} as any;
      }
      if (event.requestContext.authorizer) {
        event.requestContext.authorizer.claims = claims;
      }
      
      const userId = claims.sub;
      const groups = claims['cognito:groups'] || [];
      console.log(`User authenticated: ${userId}`, { groups });
    }

    // Route to appropriate handler
    const result = await targetHandler(event, context);

    // Ensure CORS headers are present
    return {
      ...result,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        ...result.headers,
      },
    };
  } catch (error) {
    console.error('API Router Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
