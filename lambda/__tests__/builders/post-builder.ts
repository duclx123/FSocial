/**
 * Post Builder - Builder Pattern for Post Test Data
 * Provides fluent API for creating post test data with various configurations
 */

export interface PostData {
  post_id: string;
  user_id: string;
  content: string;
  visibility: 'public' | 'friends' | 'private';
  media_urls: string[];
  recipe_id?: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_pinned: boolean;
  is_edited: boolean;
  edited_at?: string;
  tags?: string[];
  mentions?: string[];
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  created_at: string;
  updated_at: string;
}

export class PostBuilder {
  private post: PostData;
  private static idCounter = 1;

  constructor() {
    const id = PostBuilder.idCounter++;
    this.post = {
      post_id: `post-${id}`,
      user_id: `user-1`,
      content: `Test post content ${id}`,
      visibility: 'public',
      media_urls: [],
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      is_pinned: false,
      is_edited: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  withId(id: string): this {
    this.post.post_id = id;
    return this;
  }

  withUserId(userId: string): this {
    this.post.user_id = userId;
    return this;
  }

  withContent(content: string): this {
    this.post.content = content;
    return this;
  }

  withVisibility(visibility: 'public' | 'friends' | 'private'): this {
    this.post.visibility = visibility;
    return this;
  }

  public(): this {
    this.post.visibility = 'public';
    return this;
  }

  friendsOnly(): this {
    this.post.visibility = 'friends';
    return this;
  }

  private(): this {
    this.post.visibility = 'private';
    return this;
  }

  withMedia(urls: string[]): this {
    this.post.media_urls = urls;
    return this;
  }

  addMedia(url: string): this {
    this.post.media_urls.push(url);
    return this;
  }

  withRecipe(recipeId: string): this {
    this.post.recipe_id = recipeId;
    return this;
  }

  withEngagement(likes: number, comments: number, shares: number): this {
    this.post.like_count = likes;
    this.post.comment_count = comments;
    this.post.share_count = shares;
    return this;
  }

  withLikes(count: number): this {
    this.post.like_count = count;
    return this;
  }

  withComments(count: number): this {
    this.post.comment_count = count;
    return this;
  }

  withShares(count: number): this {
    this.post.share_count = count;
    return this;
  }

  pinned(): this {
    this.post.is_pinned = true;
    return this;
  }

  unpinned(): this {
    this.post.is_pinned = false;
    return this;
  }

  edited(editedAt?: string): this {
    this.post.is_edited = true;
    this.post.edited_at = editedAt || new Date().toISOString();
    return this;
  }

  withTags(tags: string[]): this {
    this.post.tags = tags;
    return this;
  }

  addTag(tag: string): this {
    if (!this.post.tags) {
      this.post.tags = [];
    }
    this.post.tags.push(tag);
    return this;
  }

  withMentions(mentions: string[]): this {
    this.post.mentions = mentions;
    return this;
  }

  addMention(username: string): this {
    if (!this.post.mentions) {
      this.post.mentions = [];
    }
    this.post.mentions.push(username);
    return this;
  }

  withLocation(name: string, latitude: number, longitude: number): this {
    this.post.location = { name, latitude, longitude };
    return this;
  }

  withCreatedAt(date: string | Date): this {
    this.post.created_at = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  withUpdatedAt(date: string | Date): this {
    this.post.updated_at = typeof date === 'string' ? date : date.toISOString();
    return this;
  }

  createdDaysAgo(days: number): this {
    const date = new Date();
    date.setDate(date.getDate() - days);
    this.post.created_at = date.toISOString();
    this.post.updated_at = date.toISOString();
    return this;
  }

  createdHoursAgo(hours: number): this {
    const date = new Date();
    date.setHours(date.getHours() - hours);
    this.post.created_at = date.toISOString();
    this.post.updated_at = date.toISOString();
    return this;
  }

  build(): PostData {
    return { ...this.post };
  }

  buildArray(count: number): PostData[] {
    return Array.from({ length: count }, (_, i) => {
      const builder = new PostBuilder();
      builder.post = {
        ...this.post,
        post_id: `${this.post.post_id}-${i}`,
        content: `${this.post.content} ${i + 1}`
      };
      return builder.build();
    });
  }

  // Preset configurations
  static textOnly(): PostBuilder {
    return new PostBuilder()
      .withContent('Just a simple text post')
      .public();
  }

  static withImage(): PostBuilder {
    return new PostBuilder()
      .withContent('Check out this amazing photo!')
      .withMedia(['https://test.cloudfront.net/posts/image1.jpg'])
      .public();
  }

  static withMultipleImages(): PostBuilder {
    return new PostBuilder()
      .withContent('Photo album from today')
      .withMedia([
        'https://test.cloudfront.net/posts/image1.jpg',
        'https://test.cloudfront.net/posts/image2.jpg',
        'https://test.cloudfront.net/posts/image3.jpg'
      ])
      .public();
  }

  static withVideo(): PostBuilder {
    return new PostBuilder()
      .withContent('Cooking tutorial video')
      .withMedia(['https://test.cloudfront.net/posts/video1.mp4'])
      .public();
  }

  static recipePost(recipeId: string): PostBuilder {
    return new PostBuilder()
      .withContent('Just made this delicious recipe!')
      .withRecipe(recipeId)
      .withTags(['recipe', 'cooking', 'homemade'])
      .public();
  }

  static viral(): PostBuilder {
    return new PostBuilder()
      .withContent('This went viral!')
      .withEngagement(10000, 500, 2000)
      .public();
  }

  static trending(): PostBuilder {
    return new PostBuilder()
      .withContent('Trending post')
      .withEngagement(1000, 100, 200)
      .createdHoursAgo(2)
      .public();
  }

  static pinnedPost(): PostBuilder {
    return new PostBuilder()
      .withContent('Important announcement - pinned to profile')
      .pinned()
      .public();
  }

  static reset(): void {
    PostBuilder.idCounter = 1;
  }
}
