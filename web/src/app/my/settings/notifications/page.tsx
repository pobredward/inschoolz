'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, MessageSquare, Heart, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface NotificationSettings {
  pushNotifications: {
    enabled: boolean;
    posts: boolean;
    comments: boolean;
    likes: boolean;
    follows: boolean;
    reports: boolean;
    system: boolean;
  };
  emailNotifications: {
    enabled: boolean;
    posts: boolean;
    comments: boolean;
    messages: boolean;
    system: boolean;
    weekly: boolean;
  };
  sounds: {
    enabled: boolean;
    chatSounds: boolean;
    notificationSounds: boolean;
  };
}

const defaultSettings: NotificationSettings = {
  pushNotifications: {
    enabled: true,
    posts: true,
    comments: true,
    likes: true,
    follows: true,
    reports: false,
    system: true,
  },
  emailNotifications: {
    enabled: false,
    posts: false,
    comments: false,
    messages: false,
    system: true,
    weekly: false,
  },
  sounds: {
    enabled: true,
    chatSounds: true,
    notificationSounds: true,
  },
};

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      try {
        setIsLoading(true);
        // TODO: 실제 API에서 사용자 알림 설정 로드
        // const userSettings = await getUserNotificationSettings(user.uid);
        // setSettings(userSettings || defaultSettings);
        
        // 임시로 기본 설정 사용
        setSettings(defaultSettings);
      } catch (error) {
        console.error('알림 설정 로딩 오류:', error);
        toast.error('알림 설정을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const handleSaveSettings = async () => {
    if (!user) return;

    try {
      setIsSaving(true);
      // TODO: 실제 API로 설정 저장
      // await updateUserNotificationSettings(user.uid, settings);
      
      // 임시로 성공 메시지만 표시
      toast.success('알림 설정이 저장되었습니다.');
    } catch (error) {
      console.error('알림 설정 저장 오류:', error);
      toast.error('알림 설정 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePushSetting = (key: keyof NotificationSettings['pushNotifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      pushNotifications: {
        ...prev.pushNotifications,
        [key]: value
      }
    }));
  };

  const updateEmailSetting = (key: keyof NotificationSettings['emailNotifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: value
      }
    }));
  };

  const updateSoundSetting = (key: keyof NotificationSettings['sounds'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      sounds: {
        ...prev.sounds,
        [key]: value
      }
    }));
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">로그인이 필요합니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold">알림 설정</h1>
          </div>
          <p className="text-gray-600">알림 수신 방법을 설정하세요.</p>
        </div>

        <div className="space-y-6">
          {/* 푸시 알림 설정 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                푸시 알림
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">푸시 알림 사용</p>
                  <p className="text-sm text-gray-500">모든 푸시 알림을 받습니다</p>
                </div>
                <Switch
                  checked={settings.pushNotifications.enabled}
                  onCheckedChange={(checked) => updatePushSetting('enabled', checked)}
                />
              </div>

              {settings.pushNotifications.enabled && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                        <span>새 댓글</span>
                      </div>
                      <Switch
                        checked={settings.pushNotifications.comments}
                        onCheckedChange={(checked) => updatePushSetting('comments', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-gray-500" />
                        <span>좋아요</span>
                      </div>
                      <Switch
                        checked={settings.pushNotifications.likes}
                        onCheckedChange={(checked) => updatePushSetting('likes', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span>팔로우</span>
                      </div>
                      <Switch
                        checked={settings.pushNotifications.follows}
                        onCheckedChange={(checked) => updatePushSetting('follows', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-gray-500" />
                        <span>신고 및 경고</span>
                      </div>
                      <Switch
                        checked={settings.pushNotifications.reports}
                        onCheckedChange={(checked) => updatePushSetting('reports', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-gray-500" />
                        <span>시스템 알림</span>
                      </div>
                      <Switch
                        checked={settings.pushNotifications.system}
                        onCheckedChange={(checked) => updatePushSetting('system', checked)}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 이메일 알림 설정 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                이메일 알림
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">이메일 알림 사용</p>
                  <p className="text-sm text-gray-500">이메일로 알림을 받습니다</p>
                </div>
                <Switch
                  checked={settings.emailNotifications.enabled}
                  onCheckedChange={(checked) => updateEmailSetting('enabled', checked)}
                />
              </div>

              {settings.emailNotifications.enabled && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>댓글 알림</span>
                      <Switch
                        checked={settings.emailNotifications.comments}
                        onCheckedChange={(checked) => updateEmailSetting('comments', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>시스템 공지</span>
                      <Switch
                        checked={settings.emailNotifications.system}
                        onCheckedChange={(checked) => updateEmailSetting('system', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>주간 요약</span>
                      <Switch
                        checked={settings.emailNotifications.weekly}
                        onCheckedChange={(checked) => updateEmailSetting('weekly', checked)}
                      />
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 사운드 설정 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔊
                사운드 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">알림 소리</p>
                  <p className="text-sm text-gray-500">알림 시 소리를 재생합니다</p>
                </div>
                <Switch
                  checked={settings.sounds.notificationSounds}
                  onCheckedChange={(checked) => updateSoundSetting('notificationSounds', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">채팅 소리</p>
                  <p className="text-sm text-gray-500">채팅 메시지 수신 시 소리를 재생합니다</p>
                </div>
                <Switch
                  checked={settings.sounds.chatSounds}
                  onCheckedChange={(checked) => updateSoundSetting('chatSounds', checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* 저장 버튼 */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? '저장 중...' : '설정 저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 