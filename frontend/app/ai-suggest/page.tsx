'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import IngredientInput from '@/components/search/IngredientInput';
import SectionCard from '@/components/search/SectionCard';
import { getSearchCounts, getSectionPosts, CountsResponse, SectionResponse } from '@/services/search';

export default function AISuggestPage() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [counts, setCounts] = useState<CountsResponse | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'likes' | 'comments'>('date');
  const [loading, setLoading] = useState(false);
  const [sectionData, setSectionData] = useState<Record<string, SectionResponse>>({});

  async function handleSearch() {
    if (ingredients.length === 0) {
      alert('Vui lòng nhập ít nhất 1 thành phần');
      return;
    }

    setLoading(true);
    try {
      const countsData = await getSearchCounts(ingredients);
      setCounts(countsData);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Tìm kiếm thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadPosts(section: string, page: number) {
    const data = await getSectionPosts(
      ingredients,
      section as 'my' | 'friends' | 'public',
      page,
      10,
      sortBy
    );

    setSectionData(prev => ({
      ...prev,
      [section]: data
    }));
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🔍 Tìm món ăn</h1>

      {/* Search Input */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Bạn có những thành phần gì?</h2>
        
        <IngredientInput
          value={ingredients}
          onChange={setIngredients}
        />

        <button
          onClick={handleSearch}
          disabled={loading || ingredients.length === 0}
          className="mt-4 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang tìm...' : 'Tìm món ăn'}
        </button>
      </div>

      {/* AI Suggestions Section */}
      {counts && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🤖 Gợi ý từ AI</h2>
          <p className="text-gray-600 mb-4">
            Với {ingredients.join(', ')}, bạn có thể nấu:
          </p>
          
          {/* TODO: Integrate with AI service */}
          <div className="space-y-3">
            <div className="p-4 border rounded-lg hover:bg-gray-50">
              <h3 className="font-medium">🍲 Món gợi ý 1</h3>
              <p className="text-sm text-gray-600">Thêm: nước màu, hành tím</p>
              <div className="mt-2 flex gap-2">
                <button 
                  onClick={() => router.push('/ai-suggest/recipe/1')}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Xem công thức AI →
                </button>
                <button 
                  onClick={() => router.push('/ai-suggest/save/1')}
                  className="text-green-600 hover:text-green-800"
                >
                  Lưu & Chỉnh sửa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Community Posts Section */}
      {counts && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">👥 Từ Cộng Đồng</h2>
            
            {/* Sort Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('date')}
                className={`px-3 py-1 rounded ${
                  sortBy === 'date' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Mới nhất
              </button>
              <button
                onClick={() => setSortBy('likes')}
                className={`px-3 py-1 rounded ${
                  sortBy === 'likes' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Nhiều like
              </button>
              <button
                onClick={() => setSortBy('comments')}
                className={`px-3 py-1 rounded ${
                  sortBy === 'comments' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                Nhiều bình luận
              </button>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <SectionCard
              icon="📝"
              title="Món của tôi"
              count={counts.myPosts}
              section="my"
              ingredients={ingredients}
              sortBy={sortBy}
              onLoadPosts={handleLoadPosts}
            />

            <SectionCard
              icon="👥"
              title="Món của bạn bè"
              count={counts.friendsPosts}
              section="friends"
              ingredients={ingredients}
              sortBy={sortBy}
              onLoadPosts={handleLoadPosts}
            />

            <SectionCard
              icon="🌍"
              title="Món từ cộng đồng"
              count={counts.publicPosts}
              section="public"
              ingredients={ingredients}
              sortBy={sortBy}
              onLoadPosts={handleLoadPosts}
            />
          </div>

          {/* Total */}
          <div className="mt-6 text-center text-gray-600">
            Tổng cộng: {counts.total} món ăn
          </div>
        </div>
      )}
    </div>
  );
}
