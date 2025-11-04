import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Post, CountsResponse, SectionResponse } from './types';

const baseClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    convertEmptyValues: false,
    removeUndefinedValues: true,
    convertClassInstanceToMap: false,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});
const TABLE_NAME = process.env.TABLE_NAME || 'smart-cooking-data-dev';

export class SearchService {
  
  // Normalize ingredients using AI (placeholder - integrate with AI service)
  async normalizeIngredients(ingredients: string[]): Promise<string[]> {
    // TODO: Call AI service to normalize
    // For now, simple normalization
    return ingredients.map(ing => 
      ing.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
    );
  }
  
  // Query posts by ingredients
  async queryByIngredients(ingredients: string[]): Promise<Post[]> {
    const normalized = await this.normalizeIngredients(ingredients);
    
    // Query GSI2 for each ingredient
    const results = await Promise.all(
      normalized.map(ingredient => this.queryByIngredient(ingredient))
    );
    
    // Intersect results (posts có tất cả ingredients)
    if (results.length === 0) return [];
    if (results.length === 1) return results[0];
    
    return this.intersectPosts(results);
  }
  
  // Query single ingredient
  private async queryByIngredient(ingredient: string): Promise<Post[]> {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `INGREDIENT#${ingredient}`
      },
      ScanIndexForward: false // Newest first
    });
    
    const response = await dynamodb.send(command);
    return (response.Items || []) as Post[];
  }
  
  // Intersect posts (find common posts across all ingredient queries)
  private intersectPosts(results: Post[][]): Post[] {
    const postMap = new Map<string, number>();
    
    results.forEach(posts => {
      posts.forEach(post => {
        const count = postMap.get(post.postId) || 0;
        postMap.set(post.postId, count + 1);
      });
    });
    
    // Only keep posts that appear in ALL results
    const requiredCount = results.length;
    const commonPostIds = Array.from(postMap.entries())
      .filter(([_, count]) => count === requiredCount)
      .map(([postId]) => postId);
    
    // Return posts from first result that match
    return results[0].filter(post => commonPostIds.includes(post.postId));
  }

  
  // Get user's friends
  async getUserFriends(userId: string): Promise<string[]> {
    const command = new QueryCommand({
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
    });
    
    const response = await dynamodb.send(command);
    return (response.Items || []).map(item => item.friend_id);
  }
  
  // Get search counts
  async getSearchCounts(ingredients: string[], userId: string): Promise<CountsResponse> {
    const allPosts = await this.queryByIngredients(ingredients);
    const friendIds = await this.getUserFriends(userId);
    
    const counts = {
      myPosts: 0,
      friendsPosts: 0,
      publicPosts: 0,
      total: allPosts.length
    };
    
    allPosts.forEach(post => {
      if (post.userId === userId) {
        counts.myPosts++;
      } else if (friendIds.includes(post.userId)) {
        if (post.visibility === 'friends' || post.visibility === 'public') {
          counts.friendsPosts++;
        }
      } else {
        if (post.visibility === 'public') {
          counts.publicPosts++;
        }
      }
    });
    
    return counts;
  }
  
  // Get section posts with pagination
  async getSectionPosts(
    ingredients: string[],
    userId: string,
    section: 'my' | 'friends' | 'public',
    page: number = 1,
    limit: number = 10,
    sortBy: 'date' | 'likes' | 'comments' = 'date'
  ): Promise<SectionResponse> {
    const allPosts = await this.queryByIngredients(ingredients);
    const friendIds = await this.getUserFriends(userId);
    
    // Filter by section
    let filteredPosts: Post[] = [];
    
    if (section === 'my') {
      filteredPosts = allPosts.filter(p => p.userId === userId);
    } else if (section === 'friends') {
      filteredPosts = allPosts.filter(p => 
        friendIds.includes(p.userId) && 
        (p.visibility === 'friends' || p.visibility === 'public')
      );
    } else {
      filteredPosts = allPosts.filter(p => 
        p.userId !== userId &&
        !friendIds.includes(p.userId) &&
        p.visibility === 'public'
      );
    }
    
    // Sort
    filteredPosts = this.sortPosts(filteredPosts, sortBy);
    
    // Paginate
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedPosts = filteredPosts.slice(start, end);
    
    // Populate author info
    const populatedPosts = await this.populateAuthors(paginatedPosts);
    
    return {
      posts: populatedPosts,
      total: filteredPosts.length,
      page,
      totalPages: Math.ceil(filteredPosts.length / limit),
      hasMore: end < filteredPosts.length
    };
  }
  
  // Sort posts
  private sortPosts(posts: Post[], sortBy: 'date' | 'likes' | 'comments'): Post[] {
    const sorted = [...posts];
    
    if (sortBy === 'likes') {
      sorted.sort((a, b) => b.likeCount - a.likeCount);
    } else if (sortBy === 'comments') {
      sorted.sort((a, b) => b.commentCount - a.commentCount);
    } else {
      sorted.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
    
    return sorted;
  }
  
  // Populate author info
  private async populateAuthors(posts: Post[]): Promise<Post[]> {
    const userIds = [...new Set(posts.map(p => p.userId))];
    
    const users = await Promise.all(
      userIds.map(userId => this.getUserProfile(userId))
    );
    
    const userMap = new Map(users.map(u => [u.userId, u]));
    
    return posts.map(post => ({
      ...post,
      author: userMap.get(post.userId)
    }));
  }
  
  // Get user profile
  private async getUserProfile(userId: string) {
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'PROFILE'
      }
    });
    
    const response = await dynamodb.send(command);
    if (!response.Items || response.Items.length === 0) {
      return { userId, username: 'Unknown', avatar_url: '' };
    }
    
    const profile = response.Items[0];
    return {
      userId: profile.user_id,
      username: profile.username,
      avatar_url: profile.avatar_url,
      full_name: profile.full_name
    };
  }
}
