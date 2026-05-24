import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gradient-to-b from-emerald-50 to-white border-t-2 border-emerald-200 mt-auto">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-8">
        
        {/* 상단: 브랜드 정보 - 게임 스타일 */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">📚</span>
            <div className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent font-jammin">
              InSchoolz
            </div>
          </div>
          <div className="text-sm text-gray-600 font-medium">
            초·중·고 학생 게임형 커뮤니티
          </div>
        </div>

        {/* 중단: 링크들 - 게임 스타일 */}
        <div className="flex flex-wrap justify-center items-center gap-2 text-xs mb-6">
          <Link 
            href="/about" 
            className="text-gray-600 hover:text-emerald-700 transition-all touch-manipulation min-h-touch px-4 py-2 rounded-lg hover:bg-emerald-50 hover:scale-105 border border-transparent hover:border-emerald-200 font-medium"
          >
            회사소개
          </Link>
          <span className="text-emerald-300 mx-1">•</span>
          <Link 
            href="/terms" 
            className="text-gray-600 hover:text-emerald-700 transition-all touch-manipulation min-h-touch px-4 py-2 rounded-lg hover:bg-emerald-50 hover:scale-105 border border-transparent hover:border-emerald-200 font-medium"
          >
            이용약관
          </Link>
          <span className="text-emerald-300 mx-1">•</span>
          <Link 
            href="/privacy" 
            className="text-gray-700 hover:text-emerald-800 transition-all font-semibold touch-manipulation min-h-touch px-4 py-2 rounded-lg hover:bg-emerald-100 hover:scale-105 border border-emerald-200 hover:border-emerald-300"
          >
            개인정보처리방침
          </Link>
          <span className="text-emerald-300 mx-1">•</span>
          <Link 
            href="/youth-protection" 
            className="text-gray-700 hover:text-emerald-800 transition-all font-semibold touch-manipulation min-h-touch px-4 py-2 rounded-lg hover:bg-emerald-100 hover:scale-105 border border-emerald-200 hover:border-emerald-300"
          >
            청소년보호정책
          </Link>
          <span className="text-emerald-300 mx-1">•</span>
          <Link 
            href="/help" 
            className="text-gray-600 hover:text-emerald-700 transition-all touch-manipulation min-h-touch px-4 py-2 rounded-lg hover:bg-emerald-50 hover:scale-105 border border-transparent hover:border-emerald-200 font-medium"
          >
            고객지원
          </Link>
        </div>

        {/* 하단: 저작권 + 연락처 - 게임 스타일 */}
        <div className="text-center">
          <div className="text-xs text-gray-600 mb-2 font-medium">
            © 2025 inschoolz. All rights reserved.
          </div>
          <Link 
            href="mailto:inschoolz.official@gmail.com" 
            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 transition-all hover:scale-105 px-3 py-1.5 rounded-lg hover:bg-emerald-50 border border-transparent hover:border-emerald-200"
          >
            <span>📧</span>
            inschoolz.official@gmail.com
          </Link>
        </div>
      </div>
    </footer>
  );
} 