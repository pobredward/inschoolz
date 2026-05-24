'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from './AuthProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExperienceProvider } from './experience-provider';
import { QuestProvider } from './QuestProvider';

// React Query 클라이언트 생성
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="light" 
        enableSystem={false}
        storageKey="inschoolz-theme"
        disableTransitionOnChange
      >
        <AuthProvider>
          <ExperienceProvider>
            <QuestProvider>
              {children}
            </QuestProvider>
          </ExperienceProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
} 