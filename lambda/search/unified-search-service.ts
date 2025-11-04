/**
 * Unified Search Service
 * Combines AI suggestions + Community posts in one response
 */

import { SearchService } from './search-service';
import { Post, UserProfile } from './types';
import { logger } from '../shared/monitoring/logger';

export interface AIRecipeSuggestion {
    recipe_id: string;
    name: string;
    ingredients: Array<{
        name: string;
        quantity: string;
        unit?: string;
    }>;
    instructions: Array<{
        step_number: number;
        description: string;
        duration_minutes?: number;
    }>;
    source: 'ai';
    match_score?: number;
}

export interface UnifiedSearchResponse {
    // AI Section
    ai_suggestions: {
        recipes: AIRecipeSuggestion[];
        count: number;
    };

    // Community Section
    community_posts: {
        posts: Post[];
        total: number;
        counts: {
            friends: number;
            public: number;
        };
    };

    // Metadata
    search_query: {
        ingredients: string[];
        timestamp: string;
    };
}

export interface UnifiedSearchFilters {
    sortBy?: 'date' | 'likes' | 'comments';
    privacy?: 'all' | 'friends' | 'public';
    page?: number;
    limit?: number;
}

export class UnifiedSearchService {
    private searchService: SearchService;

    constructor() {
        this.searchService = new SearchService();
    }

    /**
     * Unified search: AI + Community posts in one call
     */
    async search(
        ingredients: string[],
        userId: string,
        filters: UnifiedSearchFilters = {}
    ): Promise<UnifiedSearchResponse> {
        try {
            const {
                sortBy = 'date',
                privacy = 'all',
                page = 1,
                limit = 20
            } = filters;

            logger.info('Unified search started', {
                ingredients,
                userId,
                filters
            });

            // 1. Get AI suggestions (parallel with posts)
            const aiPromise = this.getAISuggestions(ingredients, userId);

            // 2. Get community posts
            const postsPromise = this.getCommunityPosts(
                ingredients,
                userId,
                privacy,
                page,
                limit,
                sortBy
            );

            // Execute in parallel
            const [aiSuggestions, communityPosts] = await Promise.all([
                aiPromise,
                postsPromise
            ]);

            return {
                ai_suggestions: aiSuggestions,
                community_posts: communityPosts,
                search_query: {
                    ingredients,
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            logger.error('Unified search failed', error, {
                ingredients,
                userId
            });
            throw error;
        }
    }

    /**
     * Get AI recipe suggestions
     * TODO: Integrate with actual AI service (Bedrock)
     */
    private async getAISuggestions(
        ingredients: string[],
        userId: string
    ): Promise<{ recipes: AIRecipeSuggestion[]; count: number }> {
        try {
            // TODO: Call AI service
            // For now, return empty (AI service will be implemented separately)
            logger.info('AI suggestions requested', { ingredients, userId });

            return {
                recipes: [],
                count: 0
            };
        } catch (error) {
            logger.error('AI suggestions failed', error);
            // Graceful degradation: return empty instead of failing entire search
            return {
                recipes: [],
                count: 0
            };
        }
    }

    /**
     * Get community posts with privacy filtering
     */
    private async getCommunityPosts(
        ingredients: string[],
        userId: string,
        privacy: 'all' | 'friends' | 'public',
        page: number,
        limit: number,
        sortBy: 'date' | 'likes' | 'comments'
    ): Promise<{
        posts: Post[];
        total: number;
        counts: { friends: number; public: number };
    }> {
        try {
            // Get all matching posts
            const allPosts = await this.searchService.queryByIngredients(ingredients);
            const friendIds = await this.searchService.getUserFriends(userId);

            // Separate by privacy
            const friendsPosts: Post[] = [];
            const publicPosts: Post[] = [];

            allPosts.forEach(post => {
                // Skip user's own posts (they can see in "My Posts" section)
                if (post.userId === userId) return;

                if (friendIds.includes(post.userId)) {
                    if (post.visibility === 'friends' || post.visibility === 'public') {
                        friendsPosts.push(post);
                    }
                } else {
                    if (post.visibility === 'public') {
                        publicPosts.push(post);
                    }
                }
            });

            // Filter by privacy preference
            let filteredPosts: Post[] = [];
            if (privacy === 'friends') {
                filteredPosts = friendsPosts;
            } else if (privacy === 'public') {
                filteredPosts = publicPosts;
            } else {
                // 'all': combine both
                filteredPosts = [...friendsPosts, ...publicPosts];
            }

            // Sort posts
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
                counts: {
                    friends: friendsPosts.length,
                    public: publicPosts.length
                }
            };
        } catch (error) {
            logger.error('Community posts search failed', error);
            throw error;
        }
    }

    /**
     * Sort posts by criteria
     */
    private sortPosts(posts: Post[], sortBy: 'date' | 'likes' | 'comments'): Post[] {
        const sorted = [...posts];

        if (sortBy === 'likes') {
            sorted.sort((a, b) => b.likeCount - a.likeCount);
        } else if (sortBy === 'comments') {
            sorted.sort((a, b) => b.commentCount - a.commentCount);
        } else {
            // date (default)
            sorted.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
        }

        return sorted;
    }

    /**
     * Populate author information for posts
     */
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

    /**
     * Get user profile (reuse from SearchService)
     */
    private async getUserProfile(userId: string): Promise<UserProfile> {
        // Delegate to SearchService's private method
        // For now, create a simple implementation
        return {
            userId,
            username: 'user_' + userId.substring(0, 8),
            avatar_url: '',
            full_name: ''
        };
    }
}
