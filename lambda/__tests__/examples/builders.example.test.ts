/**
 * Example: Test Data Builders Usage
 * Demonstrates how to use the Builder pattern for creating test data
 */

import { UserBuilder } from '../builders/user-builder';
import { RecipeBuilder } from '../builders/recipe-builder';
import { PostBuilder } from '../builders/post-builder';

describe('Test Data Builders Examples', () => {
  afterEach(() => {
    UserBuilder.reset();
    RecipeBuilder.reset();
    PostBuilder.reset();
  });

  describe('User Builder', () => {
    it('should create basic user', () => {
      const user = new UserBuilder()
        .withUsername('john_doe')
        .withEmail('john@example.com')
        .verified()
        .build();
      
      expect(user.username).toBe('john_doe');
      expect(user.email).toBe('john@example.com');
      expect(user.is_verified).toBe(true);
    });

    it('should create preset user types', () => {
      const admin = UserBuilder.admin().build();
      expect(admin.username).toBe('admin');
      
      const premium = UserBuilder.premiumUser().build();
      expect(premium.is_verified).toBe(true);
      expect(premium.privacy_settings?.profile_visibility).toBe('public');
      
      const suspended = UserBuilder.suspendedUser().build();
      expect(suspended.is_suspended).toBe(true);
      expect(suspended.suspension_reason).toBeDefined();
    });

    it('should create multiple users', () => {
      const users = new UserBuilder()
        .verified()
        .buildArray(5);
      
      expect(users).toHaveLength(5);
      expect(users[0].user_id).not.toBe(users[1].user_id);
      users.forEach(user => {
        expect(user.is_verified).toBe(true);
      });
    });

    it('should chain builder methods', () => {
      const user = new UserBuilder()
        .withUsername('chef_master')
        .withEmail('chef@example.com')
        .withCountry('Vietnam')
        .verified()
        .publicProfile()
        .allNotificationsEnabled()
        .createdDaysAgo(30)
        .build();
      
      expect(user.username).toBe('chef_master');
      expect(user.is_verified).toBe(true);
      expect(user.privacy_settings?.profile_visibility).toBe('public');
      expect(user.notification_preferences?.email_notifications).toBe(true);
    });
  });

  describe('Recipe Builder', () => {
    it('should create basic recipe', () => {
      const recipe = new RecipeBuilder()
        .withTitle('Pho Bo')
        .withCuisine('Vietnamese')
        .withDifficulty('medium')
        .withTiming(30, 120)
        .build();
      
      expect(recipe.title).toBe('Pho Bo');
      expect(recipe.cuisine_type).toBe('Vietnamese');
      expect(recipe.difficulty_level).toBe('medium');
      expect(recipe.prep_time_minutes).toBe(30);
      expect(recipe.cook_time_minutes).toBe(120);
    });

    it('should create preset recipe types', () => {
      const quickMeal = RecipeBuilder.quickMeal().build();
      expect(quickMeal.prep_time_minutes).toBeLessThan(10);
      expect(quickMeal.difficulty_level).toBe('easy');
      
      const complex = RecipeBuilder.complexDish().build();
      expect(complex.difficulty_level).toBe('hard');
      
      const healthy = RecipeBuilder.healthyRecipe().build();
      expect(healthy.nutritional_info?.calories).toBeLessThan(300);
      
      const aiRecipe = RecipeBuilder.aiGeneratedRecipe().build();
      expect(aiRecipe.is_ai_generated).toBe(true);
      expect(aiRecipe.is_approved).toBe(false);
    });

    it('should add ingredients and instructions', () => {
      const recipe = new RecipeBuilder()
        .withTitle('Custom Recipe')
        .withIngredients([]) // Clear default ingredients
        .withInstructions([]) // Clear default instructions
        .addIngredient({
          ingredient_name: 'chicken',
          quantity: '500',
          unit: 'g',
          is_optional: false
        })
        .addIngredient({
          ingredient_name: 'salt',
          quantity: '1',
          unit: 'tsp',
          is_optional: true
        })
        .addInstruction({
          description: 'Prepare ingredients',
          duration_minutes: 10
        })
        .addInstruction({
          description: 'Cook chicken',
          duration_minutes: 20
        })
        .build();
      
      expect(recipe.ingredients).toHaveLength(2);
      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.instructions[0].step_number).toBe(1);
      expect(recipe.instructions[1].step_number).toBe(2);
    });
  });

  describe('Post Builder', () => {
    it('should create basic post', () => {
      const post = new PostBuilder()
        .withUserId('user-123')
        .withContent('Check out my new recipe!')
        .public()
        .build();
      
      expect(post.user_id).toBe('user-123');
      expect(post.content).toBe('Check out my new recipe!');
      expect(post.visibility).toBe('public');
    });

    it('should create preset post types', () => {
      const textPost = PostBuilder.textOnly().build();
      expect(textPost.media_urls).toHaveLength(0);
      
      const imagePost = PostBuilder.withImage().build();
      expect(imagePost.media_urls).toHaveLength(1);
      
      const multiImage = PostBuilder.withMultipleImages().build();
      expect(multiImage.media_urls.length).toBeGreaterThan(1);
      
      const viral = PostBuilder.viral().build();
      expect(viral.like_count).toBeGreaterThan(1000);
      
      const pinned = PostBuilder.pinnedPost().build();
      expect(pinned.is_pinned).toBe(true);
    });

    it('should create post with engagement', () => {
      const post = new PostBuilder()
        .withContent('Popular post')
        .withEngagement(100, 50, 25)
        .withTags(['trending', 'popular'])
        .createdHoursAgo(2)
        .build();
      
      expect(post.like_count).toBe(100);
      expect(post.comment_count).toBe(50);
      expect(post.share_count).toBe(25);
      expect(post.tags).toContain('trending');
    });

    it('should create recipe post', () => {
      const post = PostBuilder.recipePost('recipe-456')
        .withUserId('user-123')
        .withMedia(['https://example.com/recipe.jpg'])
        .build();
      
      expect(post.recipe_id).toBe('recipe-456');
      expect(post.media_urls).toHaveLength(1);
    });
  });

  describe('Combined Builders', () => {
    it('should create related test data', () => {
      const user = new UserBuilder()
        .withUsername('chef_john')
        .verified()
        .build();
      
      const recipe = new RecipeBuilder()
        .withUserId(user.user_id)
        .withTitle('Chef Johns Special')
        .approved()
        .build();
      
      const post = new PostBuilder()
        .withUserId(user.user_id)
        .withRecipe(recipe.recipe_id)
        .withContent('Just published my new recipe!')
        .public()
        .build();
      
      expect(recipe.user_id).toBe(user.user_id);
      expect(post.user_id).toBe(user.user_id);
      expect(post.recipe_id).toBe(recipe.recipe_id);
    });
  });
});
