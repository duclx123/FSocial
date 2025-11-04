/**
 * PostCardSkeleton - Loading skeleton for post cards
 */

export default function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar skeleton */}
          <div className="w-10 h-10 rounded-full bg-gray-200"></div>
          {/* User info skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
            <div className="h-3 w-16 bg-gray-200 rounded"></div>
          </div>
        </div>
        {/* Menu skeleton */}
        <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
      </div>

      {/* Caption skeleton */}
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-gray-200 rounded w-full"></div>
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      </div>

      {/* Image skeleton */}
      <div className="mb-3 rounded-lg overflow-hidden bg-gray-200 aspect-video"></div>

      {/* Actions skeleton */}
      <div className="flex items-center gap-2">
        <div className="h-9 w-16 bg-gray-200 rounded-lg"></div>
        <div className="h-9 w-16 bg-gray-200 rounded-lg"></div>
        <div className="h-9 w-16 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  );
}
