import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/Providers";
import { Header } from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Toaster } from "@/components/ui/toaster";
import FloatingQuestButton from "@/components/quests/FloatingQuestButton";
// import { PWAPrompt } from "@/components/ui/pwa-prompt";

// 한글 폰트 - 잼민이체 스타일에 가까운 귀여운 폰트
const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: {
    default: '인스쿨즈 - 초중고 학생 커뮤니티',
    template: '%s | 인스쿨즈'
  },
  description: '대한민국 초·중·고 학생들을 위한 3계층 커뮤니티. 학교별, 지역별, 전국 단위로 안전하게 소통하고 정보를 공유하세요. 경험치 시스템과 미니게임으로 더욱 재미있게!',
  keywords: [
    '초등학생', '중학생', '고등학생', '학생 커뮤니티', '학교 커뮤니티', 
    '인스쿨즈', '교내 정보', '공부', '친구', '진로', '입시',
    '학원 정보', '지역 정보', '학생 소통', '익명 게시판',
    '경험치', '랭킹', '미니게임', '출석체크', '학생 앱'
  ],
  authors: [{ name: '인스쿨즈' }],
  creator: '인스쿨즈',
  publisher: '인스쿨즈',
  metadataBase: new URL('https://www.inschoolz.com'),
  alternates: {
    canonical: 'https://www.inschoolz.com'
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://www.inschoolz.com',
    title: '인스쿨즈 - 초중고 학생 커뮤니티',
    description: '대한민국 초·중·고 학생들을 위한 3계층 커뮤니티. 학교별, 지역별, 전국 단위로 안전하게 소통하고 정보를 공유하세요.',
    siteName: '인스쿨즈',
    images: [
      {
        url: '/images/twitter-logo.png',
        width: 1080,
        height: 1350,
        alt: '인스쿨즈 - 초중고 학생 커뮤니티',
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: '인스쿨즈 - 초중고 학생 커뮤니티',
    description: '대한민국 초·중·고 학생들을 위한 3계층 커뮤니티',
    images: ['/images/twitter-logo.png'],
    creator: '@inschoolz'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/android-icon-192x192.png', sizes: '192x192', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-icon-57x57.png', sizes: '57x57', type: 'image/png' },
      { url: '/apple-icon-60x60.png', sizes: '60x60', type: 'image/png' },
      { url: '/apple-icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { url: '/apple-icon-76x76.png', sizes: '76x76', type: 'image/png' },
      { url: '/apple-icon-114x114.png', sizes: '114x114', type: 'image/png' },
      { url: '/apple-icon-120x120.png', sizes: '120x120', type: 'image/png' },
      { url: '/apple-icon-144x144.png', sizes: '144x144', type: 'image/png' },
      { url: '/apple-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' }
    ],
    shortcut: '/favicon.ico',
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#7FDD72'
      }
    ]
  },
  manifest: '/manifest.json',
  verification: {
    google: 'JHJ-RXl4MxuuU2-5nQiRFv-V72VbSiR3ppghw9V9b50',
    other: {
      'naver-site-verification': 'your-naver-verification-code'
    }
  },
  category: 'education',
  other: {
    'msapplication-TileColor': '#ffffff',
    'msapplication-TileImage': '/ms-icon-144x144.png',
    'msapplication-config': '/browserconfig.xml'
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#86efac' },
    { media: '(prefers-color-scheme: dark)', color: '#15803d' }
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // 접근성을 위해 확대 허용
  userScalable: true, // 접근성을 위해 사용자 스케일링 허용
  viewportFit: 'cover', // 노치 디스플레이 지원
  // PWA 지원
  minimumScale: 1
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon-180x180.png" />
        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow" />
        {/* 구조화된 데이터 (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "인스쿨즈",
              "alternateName": "InSchoolz",
              "url": "https://www.inschoolz.com",
              "description": "대한민국 초·중·고 학생들을 위한 3계층 커뮤니티. 학교별, 지역별, 전국 단위로 안전하게 소통하고 정보를 공유하세요.",
              "inLanguage": "ko-KR",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.inschoolz.com/search?q={search_term_string}",
                "query-input": "required name=search_term_string"
              },
              "publisher": {
                "@type": "Organization",
                "name": "인스쿨즈",
                "url": "https://www.inschoolz.com",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://www.inschoolz.com/images/og-logo.png",
                  "width": 1024,
                  "height": 1024
                }
              },
              "sameAs": [
                "https://www.inschoolz.com"
              ]
            })
          }}
        />
        {/* 리워드 광고는 모바일 앱에서만 제공 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined' && window.localStorage) {
                  const theme = localStorage.getItem('inschoolz-theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.add('light');
                  }
                } else {
                  document.documentElement.classList.add('light');
                }
              } catch (_) {
                document.documentElement.classList.add('light');
              }
            `,
          }}
        />
      </head>
      <body className={`${notoSansKR.variable} antialiased min-h-screen bg-background font-sans touch-manipulation`}>
        <Providers>
          <div className="flex flex-col overflow-x-clip" style={{ position: 'relative' }}>
            <Header />
            <main className="flex-grow flex flex-col pb-16 md:pb-0">{children}</main>
            <Footer />
          </div>
          <FloatingQuestButton />
          <Toaster />
          {/* <PWAPrompt /> */}
        </Providers>
      </body> 
    </html>
  )
}
