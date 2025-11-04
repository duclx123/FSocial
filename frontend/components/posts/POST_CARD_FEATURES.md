# PostCard Component - Complete Feature Guide

## Overview
PostCard is a fully-featured component for displaying social posts with all interactions.

## Features

### 1. **Like/Unlike** ❤️
- Click heart icon to like/unlike
- Real-time count update
- Visual feedback (red when liked)
- Optimistic UI updates

### 2. **Comment** 💬
- Click to navigate to post detail page
- Shows comment count
- Opens full comment thread

### 3. **Share** 📤
- Share button with modal
- Optional caption
- Share count display

### 4. **Three-Dot Menu** (⋮)

#### For Post Owner:
- **Edit** - Edit post content (coming soon)
- **Delete** - Delete post with confirmation modal

#### For Other Users:
- **Save Recipe** - Save recipe to savedRecipes (only for recipe posts)
- **Report** - Report post for moderation

## Usage

```tsx
import PostCard from '@/components/posts/PostCard';

<PostCard 
  post={postData}
  onPostDeleted={() => {
    // Refresh feed
    loadPosts();
  }}
  onPostUpdated={() => {
    // Refresh post data
    loadPost(postId);
  }}
/>
```

## Props

```typescript
interface PostCardProps {
  post: Post;                    // Post data
  onPostDeleted?: () => void;    // Callback when post is deleted
  onPostUpdated?: () => void;    // Callback when post is updated (liked, shared, etc.)
}
```

## Post Object Structure

```typescript
interface Post {
  post_id: string;
  user_id: string;
  username?: string;
  user_avatar?: string;
  type?: 'recipe' | 'text' | 'image';
  caption?: string;
  imageUrls?: string[];
  recipeData?: RecipeData;
  visibility: 'public' | 'friends' | 'private';
  likeCount: number;
  commentCount: number;
  shareCount?: number;
  createdAt: string;
  updatedAt: string;
  user_reaction?: 'like' | 'love' | 'wow';
}
```

## Visual Layout

```
┌─────────────────────────────────────────────┐
│ 👤 Username                            ⋮    │ ← Header with menu
│    2h ago                                   │
├─────────────────────────────────────────────┤
│ Caption text here...                        │ ← Caption
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │                                     │   │ ← Images (if any)
│ │         Post Image(s)               │   │
│ │                                     │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 🍲 Recipe Title                     │   │ ← Recipe card (if recipe post)
│ │ 5 ingredients • 3 steps • 30 mins   │   │
│ └─────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│ ❤️ 42  💬 12  📤 Share      5 shares      │ ← Actions
└─────────────────────────────────────────────┘
```

## Menu Options

### Owner Menu (⋮)
```
┌──────────────┐
│ ✏️ Edit      │
│ 🗑️ Delete    │
└──────────────┘
```

### Other User Menu (⋮)
```
┌──────────────────┐
│ 📖 Save Recipe   │ (only for recipe posts)
│ 🚩 Report        │
└──────────────────┘
```

## Interactions

### Like Button
- **Unlked state**: Gray heart outline
- **Liked state**: Red filled heart
- **Hover**: Background highlight
- **Click**: Toggle like/unlike with API call

### Comment Button
- **Click**: Navigate to `/posts/{post_id}`
- Shows comment count
- Opens full post detail with comments

### Share Button
- **Click**: Opens share modal
- Optional caption input
- Confirms share action
- Updates share count

### Delete Confirmation
```
┌─────────────────────────────┐
│ Delete Post?                │
│                             │
│ Are you sure you want to    │
│ delete this post? This      │
│ action cannot be undone.    │
│                             │
│ [Cancel]  [Delete]          │
└─────────────────────────────┘
```

## Responsive Design

- **Mobile**: Single column, stacked images
- **Tablet**: 2-column image grid
- **Desktop**: Full width with hover effects

## Accessibility

- ✅ Keyboard navigation
- ✅ ARIA labels
- ✅ Focus indicators
- ✅ Screen reader support

## State Management

- **Local state**: Like status, menu visibility
- **Optimistic updates**: Immediate UI feedback
- **Error handling**: Graceful fallbacks
- **Loading states**: Disabled buttons during API calls

## API Integration

```typescript
// Like/Unlike
await addReaction(token, postId, 'like');
await removeReaction(token, postId);

// Delete
await deletePost(token, postId);

// Share (via ShareButton)
await sharePost(token, { post_id, share_caption });

// Report (via ReportButton)
await reportPost(token, { post_id, reason, details });
```

## Example: Feed Page

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFeed } from '@/services/posts';
import PostCard from '@/components/posts/PostCard';

export default function FeedPage() {
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);

  const loadPosts = async () => {
    const data = await getFeed(token);
    setPosts(data.posts);
  };

  useEffect(() => {
    loadPosts();
  }, [token]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {posts.map(post => (
        <PostCard
          key={post.post_id}
          post={post}
          onPostDeleted={loadPosts}
          onPostUpdated={loadPosts}
        />
      ))}
    </div>
  );
}
```

## Performance Optimizations

- ✅ Image lazy loading
- ✅ Optimistic UI updates
- ✅ Debounced API calls
- ✅ Memoized components
- ✅ Efficient re-renders

## Future Enhancements

- [ ] Edit post functionality
- [ ] Save recipe to savedRecipes
- [ ] Multiple reaction types (love, wow)
- [ ] Comment preview in card
- [ ] Share to external platforms
- [ ] Post analytics (views, reach)
