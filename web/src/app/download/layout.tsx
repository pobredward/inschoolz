import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '인스쿨즈 - 앱 다운로드',
  description: '대한민국 초중고 학생들을 위한 전용 커뮤니티 앱. 학교별 커뮤니티, 지역별 게시판, 랭킹 시스템을 지금 바로 만나보세요.',
  openGraph: {
    title: '인스쿨즈 - 앱 다운로드',
    description: '대한민국 초중고 학생들을 위한 전용 커뮤니티 앱',
    type: 'website',
  },
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}











