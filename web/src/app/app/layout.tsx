import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '인스쿨즈 앱 다운로드 | 학생 커뮤니티',
  description: '인스쿨즈는 대한민국 초중고 학생들을 위한 전용 소셜 커뮤니티 앱입니다. 학교별 커뮤니티, 지역별 게시판, 전국 게시판, 랭킹 시스템, 미니게임을 즐겨보세요.',
  keywords: ['인스쿨즈', '학생 커뮤니티', '초등학생', '중학생', '고등학생', '학교 앱', '학생 SNS'],
  openGraph: {
    title: '인스쿨즈 - 학생 전용 커뮤니티',
    description: '대한민국 초중고 학생들을 위한 전용 소셜 커뮤니티',
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '인스쿨즈 앱 다운로드',
    description: '대한민국 초중고 학생 커뮤니티',
  },
  alternates: {
    canonical: '/app',
  },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}















