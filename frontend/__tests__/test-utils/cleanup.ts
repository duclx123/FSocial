/**
 * AWS Test Cleanup Utilities
 * Provides functions to clean up test data from AWS services after E2E tests
 * 
 * USAGE:
 * - Call cleanup functions in afterAll() or afterEach() hooks
 * - Requires valid authentication token for API calls
 * - Handles errors gracefully to prevent test failures during cleanup
 * 
 * REQUIREMENTS: 10.3
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://kmt7f23tbj.execute-api.us-east-1.amazonaws.com/dev';

/**
 * Delete a test post from DynamoDB
 * @param postId - The ID of the post to delete
 * @param authToken - JWT token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function deleteTestPost(postId: string, authToken: string): Promise<boolean> {
  try {
    console.log(`  🧹 Cleaning up test post: ${postId}`);
    
    const response = await fetch(`${API_URL}/v1/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`  ✓ Post ${postId} deleted successfully`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn(`  ⚠ Failed to delete post ${postId}:`, errorData.error || response.statusText);
      return false;
    }
  } catch (error: any) {
    console.warn(`  ⚠ Error deleting post ${postId}:`, error.message);
    return false;
  }
}

/**
 * Delete multiple test posts from DynamoDB
 * @param postIds - Array of post IDs to delete
 * @param authToken - JWT token for authentication
 * @returns Promise<number> - Number of successfully deleted posts
 */
export async function deleteTestPosts(postIds: string[], authToken: string): Promise<number> {
  console.log(`\n🧹 Cleaning up ${postIds.length} test posts...`);
  
  const results = await Promise.all(
    postIds.map(postId => deleteTestPost(postId, authToken))
  );
  
  const successCount = results.filter(result => result).length;
  console.log(`  ✓ Deleted ${successCount}/${postIds.length} posts`);
  
  return successCount;
}

/**
 * Delete a test user from Cognito
 * Note: This requires admin privileges and is typically not used in E2E tests
 * Instead, test users are pre-created and reused
 * @param userId - The ID of the user to delete
 * @param authToken - JWT token with admin privileges
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function deleteTestUser(userId: string, authToken: string): Promise<boolean> {
  try {
    console.log(`  🧹 Cleaning up test user: ${userId}`);
    
    // Note: This endpoint requires admin privileges
    const response = await fetch(`${API_URL}/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`  ✓ User ${userId} deleted successfully`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn(`  ⚠ Failed to delete user ${userId}:`, errorData.error || response.statusText);
      return false;
    }
  } catch (error: any) {
    console.warn(`  ⚠ Error deleting user ${userId}:`, error.message);
    return false;
  }
}

/**
 * Remove a friendship between two users
 * @param friendId - The ID of the friend to remove
 * @param authToken - JWT token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function removeFriendship(friendId: string, authToken: string): Promise<boolean> {
  try {
    console.log(`  🧹 Removing friendship with user: ${friendId}`);
    
    const response = await fetch(`${API_URL}/v1/friends/${friendId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`  ✓ Friendship with ${friendId} removed successfully`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn(`  ⚠ Failed to remove friendship with ${friendId}:`, errorData.error || response.statusText);
      return false;
    }
  } catch (error: any) {
    console.warn(`  ⚠ Error removing friendship with ${friendId}:`, error.message);
    return false;
  }
}

/**
 * Remove multiple friendships
 * @param friendIds - Array of friend IDs to remove
 * @param authToken - JWT token for authentication
 * @returns Promise<number> - Number of successfully removed friendships
 */
export async function removeFriendships(friendIds: string[], authToken: string): Promise<number> {
  console.log(`\n🧹 Removing ${friendIds.length} friendships...`);
  
  const results = await Promise.all(
    friendIds.map(friendId => removeFriendship(friendId, authToken))
  );
  
  const successCount = results.filter(result => result).length;
  console.log(`  ✓ Removed ${successCount}/${friendIds.length} friendships`);
  
  return successCount;
}

/**
 * Delete notifications for the authenticated user
 * @param notificationIds - Array of notification IDs to delete (optional)
 * @param authToken - JWT token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function deleteNotifications(notificationIds: string[] | null, authToken: string): Promise<boolean> {
  try {
    if (notificationIds && notificationIds.length > 0) {
      console.log(`  🧹 Deleting ${notificationIds.length} test notifications...`);
      
      // Delete specific notifications
      const results = await Promise.all(
        notificationIds.map(async (notificationId) => {
          const response = await fetch(`${API_URL}/v1/notifications/${notificationId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          });
          return response.ok;
        })
      );
      
      const successCount = results.filter(result => result).length;
      console.log(`  ✓ Deleted ${successCount}/${notificationIds.length} notifications`);
      return successCount === notificationIds.length;
    } else {
      // Mark all notifications as read (alternative cleanup approach)
      console.log(`  🧹 Marking all notifications as read...`);
      
      const response = await fetch(`${API_URL}/v1/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log(`  ✓ All notifications marked as read`);
        return true;
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.warn(`  ⚠ Failed to mark notifications as read:`, errorData.error || response.statusText);
        return false;
      }
    }
  } catch (error: any) {
    console.warn(`  ⚠ Error deleting notifications:`, error.message);
    return false;
  }
}

/**
 * Delete a saved recipe
 * @param savedRecipeId - The ID of the saved recipe to delete
 * @param authToken - JWT token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function deleteSavedRecipe(savedRecipeId: string, authToken: string): Promise<boolean> {
  try {
    console.log(`  🧹 Deleting saved recipe: ${savedRecipeId}`);
    
    const response = await fetch(`${API_URL}/v1/saved-recipes/${savedRecipeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`  ✓ Saved recipe ${savedRecipeId} deleted successfully`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn(`  ⚠ Failed to delete saved recipe ${savedRecipeId}:`, errorData.error || response.statusText);
      return false;
    }
  } catch (error: any) {
    console.warn(`  ⚠ Error deleting saved recipe ${savedRecipeId}:`, error.message);
    return false;
  }
}

/**
 * Delete a recipe group
 * @param groupId - The ID of the recipe group to delete
 * @param authToken - JWT token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function deleteRecipeGroup(groupId: string, authToken: string): Promise<boolean> {
  try {
    console.log(`  🧹 Deleting recipe group: ${groupId}`);
    
    const response = await fetch(`${API_URL}/v1/saved-recipes/groups/${groupId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`  ✓ Recipe group ${groupId} deleted successfully`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn(`  ⚠ Failed to delete recipe group ${groupId}:`, errorData.error || response.statusText);
      return false;
    }
  } catch (error: any) {
    console.warn(`  ⚠ Error deleting recipe group ${groupId}:`, error.message);
    return false;
  }
}

/**
 * Delete a comment from a post
 * @param postId - The ID of the post containing the comment
 * @param commentId - The ID of the comment to delete
 * @param authToken - JWT token for authentication
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function deleteComment(postId: string, commentId: string, authToken: string): Promise<boolean> {
  try {
    console.log(`  🧹 Deleting comment ${commentId} from post ${postId}`);
    
    const response = await fetch(`${API_URL}/v1/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`  ✓ Comment ${commentId} deleted successfully`);
      return true;
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn(`  ⚠ Failed to delete comment ${commentId}:`, errorData.error || response.statusText);
      return false;
    }
  } catch (error: any) {
    console.warn(`  ⚠ Error deleting comment ${commentId}:`, error.message);
    return false;
  }
}

/**
 * Comprehensive cleanup function for E2E tests
 * Cleans up all test data created during a test run
 * @param cleanup - Object containing arrays of IDs to clean up
 * @param authToken - JWT token for authentication
 */
export async function cleanupTestData(
  cleanup: {
    postIds?: string[];
    friendIds?: string[];
    notificationIds?: string[];
    savedRecipeIds?: string[];
    groupIds?: string[];
    comments?: Array<{ postId: string; commentId: string }>;
  },
  authToken: string
): Promise<void> {
  console.log('\n🧹 Starting comprehensive test data cleanup...');
  
  // Delete comments first (they depend on posts)
  if (cleanup.comments && cleanup.comments.length > 0) {
    for (const { postId, commentId } of cleanup.comments) {
      await deleteComment(postId, commentId, authToken);
    }
  }
  
  // Delete posts
  if (cleanup.postIds && cleanup.postIds.length > 0) {
    await deleteTestPosts(cleanup.postIds, authToken);
  }
  
  // Remove friendships
  if (cleanup.friendIds && cleanup.friendIds.length > 0) {
    await removeFriendships(cleanup.friendIds, authToken);
  }
  
  // Delete saved recipes
  if (cleanup.savedRecipeIds && cleanup.savedRecipeIds.length > 0) {
    for (const savedRecipeId of cleanup.savedRecipeIds) {
      await deleteSavedRecipe(savedRecipeId, authToken);
    }
  }
  
  // Delete recipe groups
  if (cleanup.groupIds && cleanup.groupIds.length > 0) {
    for (const groupId of cleanup.groupIds) {
      await deleteRecipeGroup(groupId, authToken);
    }
  }
  
  // Delete notifications
  if (cleanup.notificationIds && cleanup.notificationIds.length > 0) {
    await deleteNotifications(cleanup.notificationIds, authToken);
  }
  
  console.log('✅ Test data cleanup completed\n');
}
