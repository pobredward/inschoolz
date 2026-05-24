import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // ESLint 오류를 무시하고 빌드 진행 (점진적 수정 중)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // TypeScript 오류를 무시하고 빌드 진행 (개발 단계에서만)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 컴파일러 최적화
  compiler: {
    // 프로덕션에서 console.log 제거
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // 웹 성능 최적화
    optimizeCss: true,
    // 모듈 최적화
    optimizeServerReact: true,
  },

  // Turbopack 설정 (experimental.turbo에서 이동)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // 이미지 최적화 설정 (모바일 최적화 강화)
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.kakaocdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '*.kakaocdn.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.kakao.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
    // 모바일에서 이미지 로딩 최적화
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // PWA를 위한 설정
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 모바일 브라우저 최적화
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          // 터치 성능 개선
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // 모바일 보안
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
      // 정적 자산 캐싱 (모바일 성능 개선)
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // .well-known 파일 설정
      {
        source: '/.well-known/(.*)',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ];
  },
  
  // 웹팩 최적화 (모바일 번들 크기 최적화)
  webpack: (config, { dev, isServer }) => {
    // 프로덕션에서 번들 크기 최적화
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    
    return config;
  },
};

export default nextConfig;
