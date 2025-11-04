import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SearchService } from './search-service';
import { UnifiedSearchService } from './unified-search-service';
import {
    successResponse,
    badRequestResponse,
    unauthorizedResponse,
    notFoundResponse,
    handleError
} from '../shared/errors/responses';

const searchService = new SearchService();
const unifiedSearchService = new UnifiedSearchService();

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Get userId from Cognito authorizer
        const userId = event.requestContext.authorizer?.claims?.sub;
        if (!userId) {
            return unauthorizedResponse();
        }

        const path = event.path;
        const method = event.httpMethod;

        // GET /search/unified - NEW: Combined AI + Community search
        if (path.endsWith('/unified') && method === 'GET') {
            const params = event.queryStringParameters || {};
            const ingredients = params.ingredients?.split(',') || [];
            const sortBy = (params.sortBy as 'date' | 'likes' | 'comments') || 'date';
            const privacy = (params.privacy as 'all' | 'friends' | 'public') || 'all';
            const page = parseInt(params.page || '1');
            const limit = parseInt(params.limit || '20');

            if (ingredients.length === 0) {
                return badRequestResponse('Ingredients required');
            }

            const result = await unifiedSearchService.search(ingredients, userId, {
                sortBy,
                privacy,
                page,
                limit
            });

            return successResponse(result);
        }

        // GET /search/counts
        if (path.endsWith('/counts') && method === 'GET') {
            const ingredients = event.queryStringParameters?.ingredients?.split(',') || [];

            if (ingredients.length === 0) {
                return badRequestResponse('Ingredients required');
            }

            const counts = await searchService.getSearchCounts(ingredients, userId);
            return successResponse(counts);
        }

        // GET /search/section
        if (path.endsWith('/section') && method === 'GET') {
            const params = event.queryStringParameters || {};
            const ingredients = params.ingredients?.split(',') || [];
            const section = params.section as 'my' | 'friends' | 'public';
            const page = parseInt(params.page || '1');
            const limit = parseInt(params.limit || '10');
            const sortBy = (params.sortBy as 'date' | 'likes' | 'comments') || 'date';

            if (ingredients.length === 0) {
                return badRequestResponse('Ingredients required');
            }

            if (!['my', 'friends', 'public'].includes(section)) {
                return badRequestResponse('Invalid section. Must be: my, friends, or public');
            }

            const result = await searchService.getSectionPosts(
                ingredients,
                userId,
                section,
                page,
                limit,
                sortBy
            );

            return successResponse(result);
        }

        return notFoundResponse('Endpoint not found');

    } catch (error) {
        return handleError(error);
    }
};
