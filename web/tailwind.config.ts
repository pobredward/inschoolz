import type { Config } from "tailwindcss";
import { shadcnPlugin } from "./src/lib/shadcn-plugin";
import lineClamp from '@tailwindcss/line-clamp';

const config = {
  darkMode: "class",
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    // 모바일 퍼스트 브레이크포인트 최적화
    screens: {
      'xs': '375px',    // 작은 모바일
      'sm': '640px',    // 기본 모바일
      'md': '768px',    // 태블릿
      'lg': '1024px',   // 데스크톱
      'xl': '1280px',   // 큰 데스크톱
      '2xl': '1536px',  // 초대형 화면
    },
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        'xs': '0.75rem',
        'sm': '1rem', 
        'md': '1.5rem',
        'lg': '2rem',
        'xl': '2.5rem',
        '2xl': '3rem',
      },
      screens: {
        'xs': '100%',
        'sm': '100%',
        'md': '100%',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        'sans': ['var(--font-noto-sans-kr)', 'system-ui', 'sans-serif'],
        'jammin': ['Gochi Hand', 'Comic Sans MS', 'cursive'], // 잼민이체 스타일
      },
      // 모바일 최적화 spacing
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      // 모바일 친화적 크기
      minHeight: {
        'touch': '44px', // 터치 친화적 최소 높이
        'screen-safe': 'calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      minWidth: {
        'touch': '44px', // 터치 친화적 최소 너비
      },
      colors: {
        // 파스텔 그린 색상 팔레트
        'pastel-green': {
          50: '#f0fdf4',    // 매우 연한 그린
          100: '#dcfce7',   // 연한 그린
          200: '#bbf7d0',   // 파스텔 그린
          300: '#86efac',   // 메인 파스텔 그린
          400: '#4ade80',   // 살짝 진한 그린
          500: '#22c55e',   // 기본 그린
          600: '#16a34a',   // 진한 그린
          700: '#15803d',   // 더 진한 그린
          800: '#166534',   // 매우 진한 그린
          900: '#14532d',   // 가장 진한 그린
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#86efac", // 파스텔 그린으로 변경
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "#bbf7d0", // 파스텔 그린 accent
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // 모바일 최적화 애니메이션
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "slide-down": {
          from: { transform: "translateY(-100%)" },
          to: { transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "50%": { transform: "scale(1.05)", opacity: "0.8" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "bounce-in": "bounce-in 0.3s ease-out",
      },
      // 모바일 그리드 최적화
      gridTemplateColumns: {
        'auto-fit-min': 'repeat(auto-fit, minmax(280px, 1fr))',
        'auto-fill-min': 'repeat(auto-fill, minmax(280px, 1fr))',
      },
    },
  },
  plugins: [
    shadcnPlugin, 
    lineClamp,
    // 모바일 유틸리티 플러그인
    function({ addUtilities }: { addUtilities: any }) {
      addUtilities({
        '.touch-manipulation': {
          'touch-action': 'manipulation',
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.safe-area-inset': {
          'padding-top': 'env(safe-area-inset-top)',
          'padding-bottom': 'env(safe-area-inset-bottom)',
          'padding-left': 'env(safe-area-inset-left)',
          'padding-right': 'env(safe-area-inset-right)',
        },
      });
    },
  ],
} satisfies Config;

export default config; 