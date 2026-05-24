'use client';

import { useEffect, useState } from 'react';
import { Button } from './button';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Service Worker 등록
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered:', registration.scope);
          
          // Service Worker 업데이트 확인
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // 새로운 버전이 설치됨
                  if (confirm('새로운 버전이 있습니다. 새로고침하시겠습니까?')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
          
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      });
    }

    // PWA 설치 프롬프트 이벤트 리스너
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // PWA 설치 프롬프트를 직접 제어하기 위해 기본 동작 방지
      e.preventDefault();
      setDeferredPrompt(e);
      
      // 이미 설치되어 있거나 최근에 거부했다면 프롬프트 표시 안 함
      const lastDismissed = localStorage.getItem('pwa-prompt-dismissed');
      const wasRecentlyDismissed = lastDismissed && 
        Date.now() - parseInt(lastDismissed) < 7 * 24 * 60 * 60 * 1000; // 7일
      
      if (!isInstalled && !wasRecentlyDismissed) {
        // 페이지 로딩 후 3초 지연하여 프롬프트 표시
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    // 앱 설치 감지
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('PWA was installed');
    };

    // 이미 설치되어 있는지 확인
    const checkIfInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as any).standalone ||
          document.referrer.includes('android-app://')) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    checkIfInstalled();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      } else {
        console.log('User dismissed the PWA install prompt');
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error during PWA installation:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // 이미 설치되어 있거나 프롬프트를 표시하지 않는 경우
  if (isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:max-w-sm z-[10000]">
      <div className="bg-white border border-pastel-green-200 rounded-lg shadow-lg p-4 animate-slide-up">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-pastel-green-600" />
            <h3 className="font-semibold text-gray-900">앱으로 설치하기</h3>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            className="h-6 w-6 -mt-1 -mr-1"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          인스쿨즈를 홈 화면에 추가하면 더 빠르고 편리하게 이용할 수 있어요!
        </p>
        
        <div className="flex gap-2">
          <Button
            onClick={handleInstallClick}
            className="flex-1 gap-2 text-sm"
            size="sm"
          >
            <Download className="h-4 w-4" />
            설치하기
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="text-sm"
            size="sm"
          >
            나중에
          </Button>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>✨ 오프라인에서도 사용 가능</span>
            <span>•</span>
            <span>📱 네이티브 앱 경험</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// PWA 설치 상태를 확인하는 훅
export function usePWAInstall() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const checkInstallationStatus = () => {
      // PWA로 설치되어 있는지 확인
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                          (window.navigator as any).standalone ||
                          document.referrer.includes('android-app://');
      
      setIsInstalled(isStandalone);
    };

    const handleBeforeInstallPrompt = () => {
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    checkInstallationStatus();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return { isInstalled, canInstall };
} 