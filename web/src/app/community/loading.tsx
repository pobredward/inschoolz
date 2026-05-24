import { Skeleton } from '@/components/ui/skeleton';

export default function CommunityLoading() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl">
      {/* 탭 스켈레톤 */}
      <div className="flex gap-2 mb-6">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>

      {/* 게시판 필터 + 정렬 스켈레톤 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* 게시글 목록 스켈레톤 */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-white p-4 rounded-lg border border-gray-100"
          >
            {/* 뱃지 */}
            <div className="flex gap-2 mb-3">
              <Skeleton className="h-5 w-12 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            {/* 제목 + 썸네일 */}
            <div className="flex items-start gap-3 mb-2">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5 rounded" />
                <Skeleton className="h-3 w-3/5 rounded" />
              </div>
              <Skeleton className="h-16 w-16 rounded-lg flex-shrink-0" />
            </div>
            {/* 하단 정보 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-16 rounded" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-3 w-8 rounded" />
                <Skeleton className="h-3 w-8 rounded" />
                <Skeleton className="h-3 w-8 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
