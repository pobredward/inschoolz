export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        {/* 상단 네비게이션 skeleton */}
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-12"></div>
          <div className="h-4 bg-gray-200 rounded w-1"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-1"></div>
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>

        {/* 지역 정보 skeleton */}
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-6 bg-blue-200 rounded w-16 px-2"></div>
          <div className="h-4 bg-gray-200 rounded w-40"></div>
        </div>

        {/* 게시글 제목 skeleton */}
        <div className="space-y-3 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
        </div>

        {/* 작성자 정보 skeleton */}
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>

        {/* 게시글 내용 skeleton */}
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-4/5"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>

        {/* 이미지 placeholder */}
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 rounded-lg w-full"></div>
        </div>

        {/* 액션 버튼들 skeleton */}
        <div className="flex items-center gap-4 animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded w-20"></div>
        </div>

        {/* 댓글 섹션 skeleton */}
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="space-y-1">
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded w-4/5"></div>
                <div className="h-3 bg-gray-200 rounded w-3/5"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}