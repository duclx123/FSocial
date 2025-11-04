import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE!;

interface RecipePost {
  postId: string;
  userId: string;
  username?: string;
  recipeName: string;
  recipeData: {
    name: string;
    ingredients: any[];
    instructions: any[];
    cuisine?: string;
    cookingTime?: number;
    difficulty?: string;
  };
  privacy: 'public' | 'friends' | 'private';
  images?: string[];
  likesCount: number;
  commentsCount: number;
  cookedCount?: number;
  createdAt: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const method = event.httpMethod;
    const path = event.path;
    const queryParams = event.queryStringParameters || {};

    // GET /v1/recipes/search - Search recipes from posts
    if (method === 'GET' && path === '/v1/recipes/search') {
      const searchQuery = queryParams.q || '';
      const cuisine = queryParams.cuisine;
      const difficulty = queryParams.difficulty;
      const privacy = queryParams.privacy as 'public' | 'friends' | 'all';
      const limit = parseInt(queryParams.limit || '20');

      const results = await searchRecipes(userId, {
        query: searchQuery,
        cuisine,
        difficulty,
        privacy: privacy || 'all',
        limit
      });

      return { statusCode: 200, headers, body: JSON.stringify(results) };
    }

    // GET /v1/recipes/trending - Get trending recipes
    if (method === 'GET' && path === '/v1/recipes/trending') {
      const limit = parseInt(queryParams.limit || '10');
      const results = await getTrendingRecipes(userId, limit);
      return { statusCode: 200, headers, body: JSON.stringify(results) };
    }

    // GET /v1/recipes/recent - Get recent recipes
    if (method === 'GET' && path === '/v1/recipes/recent') {
      const limit = parseInt(queryParams.limit || '20');
      const results = await getRecentRecipes(userId, limit);
      return { statusCode: 200, headers, body: JSON.stringify(results) };
    }

    // GET /v1/recipes/by-user/{userId} - Get recipes by specific user
    if (method === 'GET' && path.match(/\/v1\/recipes\/by-user\/[^/]+$/)) {
      const targetUserId = path.split('/').pop()!;
      const limit = parseInt(queryParams.limit || '20');
      const results = await getRecipesByUser(userId, targetUserId, limit);
      return { statusCode: 200, headers, body: JSON.stringify(results) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };

  } catch (error: any) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};

/**
 * Search recipes from posts with privacy filtering
 */
async function searchRecipes(
  userId: string,
  filters: {
    query: string;
    cuisine?: string;
    difficulty?: string;
    privacy: 'public' | 'friends' | 'all';
    limit: number;
  }
): Promise<{ recipes: RecipePost[]; total: number }> {
  const recipes: RecipePost[] = [];

  // Get user's friends list for privacy filtering
  const friendIds = await getUserFriends(userId);

  // Search in public posts
  if (filters.privacy === 'public' || filters.privacy === 'all') {
    const publicRecipes = await searchPublicRecipes(filters.query, filters.cuisine, filters.difficulty);
    recipes.push(...publicRecipes);
  }

  // Search in friends' posts
  if (filters.privacy === 'friends' || filters.privacy === 'all') {
    const friendsRecipes = await searchFriendsRecipes(userId, friendIds, filters.query, filters.cuisine, filters.difficulty);
    recipes.push(...friendsRecipes);
  }

  // Always include user's own recipes
  const ownRecipes = await searchUserRecipes(userId, filters.query, filters.cuisine, filters.difficulty);
  recipes.push(...ownRecipes);

  // Remove duplicates
  const uniqueRecipes = Array.from(
    new Map(recipes.map(r => [r.postId, r])).values()
  );

  // Sort by relevance (name match) and date
  const sortedRecipes = uniqueRecipes.sort((a, b) => {
    const aNameMatch = a.recipeName.toLowerCase().includes(filters.query.toLowerCase());
    const bNameMatch = b.recipeName.toLowerCase().includes(filters.query.toLowerCase());
    
    if (aNameMatch && !bNameMatch) return -1;
    if (!aNameMatch && bNameMatch) return 1;
    
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return {
    recipes: sortedRecipes.slice(0, filters.limit),
    total: sortedRecipes.length
  };
}

/**
 * Search public recipe posts
 */
async function searchPublicRecipes(query: string, cuisine?: string, difficulty?: string): Promise<RecipePost[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3PK = :pk',
    FilterExpression: 'entity_type = :type AND attribute_exists(recipeData)',
    ExpressionAttributeValues: {
      ':pk': 'FEED#PUBLIC',
      ':type': 'POST'
    },
    ScanIndexForward: false,
    Limit: 100
  }));

  return filterAndMapRecipes(result.Items || [], query, cuisine, difficulty);
}

/**
 * Search friends' recipe posts
 */
async function searchFriendsRecipes(
  userId: string,
  friendIds: string[],
  query: string,
  cuisine?: string,
  difficulty?: string
): Promise<RecipePost[]> {
  const recipes: RecipePost[] = [];

  // Query each friend's posts (limit to avoid too many queries)
  for (const friendId of friendIds.slice(0, 20)) {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      FilterExpression: 'entity_type = :type AND attribute_exists(recipeData)',
      ExpressionAttributeValues: {
        ':pk': `USER#${friendId}`,
        ':sk': 'POST#',
        ':type': 'POST'
      },
      ScanIndexForward: false,
      Limit: 10
    }));

    const friendRecipes = filterAndMapRecipes(result.Items || [], query, cuisine, difficulty);
    recipes.push(...friendRecipes);
  }

  return recipes;
}

/**
 * Search user's own recipe posts
 */
async function searchUserRecipes(
  userId: string,
  query: string,
  cuisine?: string,
  difficulty?: string
): Promise<RecipePost[]> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
    FilterExpression: 'entity_type = :type AND attribute_exists(recipeData)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'POST#',
      ':type': 'POST'
    },
    ScanIndexForward: false,
    Limit: 50
  }));

  return filterAndMapRecipes(result.Items || [], query, cuisine, difficulty);
}

/**
 * Filter and map DynamoDB items to RecipePost
 */
function filterAndMapRecipes(
  items: any[],
  query: string,
  cuisine?: string,
  difficulty?: string
): RecipePost[] {
  return items
    .filter(item => {
      if (!item.recipeData) return false;

      const recipeName = item.recipeData.name || '';
      const recipeCuisine = item.recipeData.cuisine || '';
      const recipeDifficulty = item.recipeData.difficulty || '';

      // Filter by search query
      if (query && !recipeName.toLowerCase().includes(query.toLowerCase())) {
        // Also check ingredients
        const ingredients = item.recipeData.ingredients || [];
        const hasIngredientMatch = ingredients.some((ing: any) => 
          (ing.name || '').toLowerCase().includes(query.toLowerCase())
        );
        if (!hasIngredientMatch) return false;
      }

      // Filter by cuisine
      if (cuisine && recipeCuisine.toLowerCase() !== cuisine.toLowerCase()) {
        return false;
      }

      // Filter by difficulty
      if (difficulty && recipeDifficulty.toLowerCase() !== difficulty.toLowerCase()) {
        return false;
      }

      return true;
    })
    .map(item => ({
      postId: item.post_id,
      userId: item.user_id,
      username: item.username,
      recipeName: item.recipeData.name,
      recipeData: item.recipeData,
      privacy: item.privacy || (item.is_public ? 'public' : 'private'),
      images: item.images || [],
      likesCount: item.likes_count || 0,
      commentsCount: item.comments_count || 0,
      cookedCount: item.cooked_count || 0,
      createdAt: item.created_at
    }));
}

/**
 * Get trending recipes (most liked/cooked)
 */
async function getTrendingRecipes(userId: string, limit: number): Promise<{ recipes: RecipePost[] }> {
  const friendIds = await getUserFriends(userId);

  // Get public recipes
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3PK = :pk',
    FilterExpression: 'entity_type = :type AND attribute_exists(recipeData)',
    ExpressionAttributeValues: {
      ':pk': 'FEED#PUBLIC',
      ':type': 'POST'
    },
    ScanIndexForward: false,
    Limit: 100
  }));

  const recipes = filterAndMapRecipes(result.Items || [], '', undefined, undefined);

  // Sort by engagement (likes + comments + cooked count)
  const sortedRecipes = recipes.sort((a, b) => {
    const aScore = a.likesCount + a.commentsCount + (a.cookedCount || 0) * 2;
    const bScore = b.likesCount + b.commentsCount + (b.cookedCount || 0) * 2;
    return bScore - aScore;
  });

  return { recipes: sortedRecipes.slice(0, limit) };
}

/**
 * Get recent recipes
 */
async function getRecentRecipes(userId: string, limit: number): Promise<{ recipes: RecipePost[] }> {
  const friendIds = await getUserFriends(userId);

  // Get public recipes
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI3',
    KeyConditionExpression: 'GSI3PK = :pk',
    FilterExpression: 'entity_type = :type AND attribute_exists(recipeData)',
    ExpressionAttributeValues: {
      ':pk': 'FEED#PUBLIC',
      ':type': 'POST'
    },
    ScanIndexForward: false,
    Limit: limit
  }));

  const recipes = filterAndMapRecipes(result.Items || [], '', undefined, undefined);

  return { recipes };
}

/**
 * Get recipes by specific user
 */
async function getRecipesByUser(
  viewerId: string,
  targetUserId: string,
  limit: number
): Promise<{ recipes: RecipePost[] }> {
  // Check if viewer can see target's recipes
  const isSelf = viewerId === targetUserId;
  const isFriend = !isSelf && await checkFriendship(viewerId, targetUserId);

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
    FilterExpression: 'entity_type = :type AND attribute_exists(recipeData)',
    ExpressionAttributeValues: {
      ':pk': `USER#${targetUserId}`,
      ':sk': 'POST#',
      ':type': 'POST'
    },
    ScanIndexForward: false,
    Limit: limit * 2
  }));

  let recipes = filterAndMapRecipes(result.Items || [], '', undefined, undefined);

  // Apply privacy filtering
  if (!isSelf) {
    recipes = recipes.filter(recipe => {
      if (recipe.privacy === 'public') return true;
      if (recipe.privacy === 'friends' && isFriend) return true;
      return false;
    });
  }

  return { recipes: recipes.slice(0, limit) };
}

/**
 * Get user's friends list
 */
async function getUserFriends(userId: string): Promise<string[]> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'FRIEND#',
        ':status': 'accepted'
      }
    }));

    return (result.Items || []).map(item => item.addressee_id);
  } catch (error) {
    console.error('Failed to get friends:', error);
    return [];
  }
}

/**
 * Check if two users are friends
 */
async function checkFriendship(userId1: string, userId2: string): Promise<boolean> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'addressee_id = :friendId AND #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':pk': `USER#${userId1}`,
        ':sk': 'FRIEND#',
        ':friendId': userId2,
        ':status': 'accepted'
      }
    }));

    return (result.Items || []).length > 0;
  } catch (error) {
    return false;
  }
}
