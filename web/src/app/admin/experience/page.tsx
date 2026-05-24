'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Plus, Minus, Star, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getExperienceSettings, updateExperienceSettings } from '@/lib/api/admin';

interface ExperienceSettings {
  community: {
    postXP: number;
    commentXP: number;
    likeXP: number;
    dailyPostLimit: number;
    dailyCommentLimit: number;
    dailyLikeLimit: number;
  };
  games: {
    reactionGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
    tileGame: {
      enabled: boolean;
      dailyLimit: number;
      thresholds: Array<{
        minScore: number;
        xpReward: number;
      }>;
    };
  };

  attendance: {
    dailyXP: number;
    streakBonus: number;
    weeklyBonusXP: number;
  };
  
  referral: {
    referrerXP: number;    // 추천인(A)이 받는 경험치
    refereeXP: number;     // 추천받은 사람(B)이 받는 경험치
    enabled: boolean;      // 추천인 시스템 활성화 여부
  };
  
  ads: {
    rewardedVideo: {
      experienceReward: number;
      dailyLimit: number;
      cooldownMinutes: number;
    };
  };
}

export default function ExperienceManagementPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<ExperienceSettings>({
    community: {
      postXP: 10,
      commentXP: 5,
      likeXP: 1,
      dailyPostLimit: 3,
      dailyCommentLimit: 5,
      dailyLikeLimit: 50,
    },
    games: {
      reactionGame: {
        enabled: true,
        dailyLimit: 5,
        thresholds: [
          { minScore: 100, xpReward: 15 },
          { minScore: 200, xpReward: 10 },
          { minScore: 300, xpReward: 5 },
        ],
      },
      tileGame: {
        enabled: true,
        dailyLimit: 3,
        thresholds: [
          { minScore: 7, xpReward: 15 },
          { minScore: 10, xpReward: 10 },
          { minScore: 13, xpReward: 5 },
        ],
      },
    },

    attendance: {
      dailyXP: 10,
      streakBonus: 5,
      weeklyBonusXP: 50,
    },
    
    referral: {
      referrerXP: 30,     // 추천인이 받는 경험치 (기본값)
      refereeXP: 30,      // 추천받은 사람이 받는 경험치 (기본값)
      enabled: true,      // 추천인 시스템 활성화
    },
    
    ads: {
      rewardedVideo: {
        experienceReward: 30,
        dailyLimit: 5,
        cooldownMinutes: 30,
      },
    },
  });

  const [isLoading, setIsLoading] = useState(false);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await getExperienceSettings();
      
      // 기본값과 API 응답을 안전하게 병합
      const defaultSettings: ExperienceSettings = {
        community: {
          postXP: 10,
          commentXP: 5,
          likeXP: 1,
          dailyPostLimit: 3,
          dailyCommentLimit: 5,
          dailyLikeLimit: 50,
        },
        games: {
          reactionGame: {
            enabled: true,
            dailyLimit: 5,
            thresholds: [
              { minScore: 100, xpReward: 15 },
              { minScore: 200, xpReward: 10 },
              { minScore: 300, xpReward: 5 },
            ],
          },
          tileGame: {
            enabled: true,
            dailyLimit: 3,
            thresholds: [
              { minScore: 7, xpReward: 15 },
              { minScore: 10, xpReward: 10 },
              { minScore: 13, xpReward: 5 },
            ],
          },
        },
        attendance: {
          dailyXP: 10,
          streakBonus: 5,
          weeklyBonusXP: 50,
        },
        referral: {
          referrerXP: 30,
          refereeXP: 30,
          enabled: true,
        },
        ads: {
          rewardedVideo: {
            experienceReward: 30,
            dailyLimit: 5,
            cooldownMinutes: 30,
          },
        },
      };

      const safeSettings: ExperienceSettings = {
        ...defaultSettings,
        ...response,
        community: {
          ...defaultSettings.community,
          ...response?.community,
        },
        games: {
          reactionGame: {
            ...defaultSettings.games.reactionGame,
            ...response?.games?.reactionGame,
          },
          tileGame: {
            ...defaultSettings.games.tileGame,
            ...response?.games?.tileGame,
          },
        },
        attendance: {
          ...defaultSettings.attendance,
          ...response?.attendance,
        },
        referral: {
          ...defaultSettings.referral,
          ...response?.referral,
        },
      };
      
      setSettings(safeSettings);
    } catch (error) {
      console.error('설정 로드 실패:', error);
      toast.error('설정을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setIsLoading(true);
      await updateExperienceSettings(settings);
      toast.success('설정이 저장되었습니다.');
    } catch (error) {
      console.error('설정 저장 실패:', error);
      toast.error('설정 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateCommunitySettings = (key: keyof ExperienceSettings['community'], value: number) => {
    setSettings(prev => ({
      ...prev,
      community: {
        ...prev.community,
        [key]: value,
      },
    }));
  };

  const updateGameSettings = (
    game: keyof ExperienceSettings['games'],
    key: string,
    value: boolean | number
  ) => {
    setSettings(prev => ({
      ...prev,
      games: {
        ...prev.games,
        [game]: {
          ...prev.games[game],
          [key]: value,
        },
      },
    }));
  };

  const updateThreshold = (
    game: keyof ExperienceSettings['games'],
    index: number,
    field: 'minScore' | 'xpReward',
    value: number
  ) => {
    setSettings(prev => {
      const newThresholds = [...prev.games[game].thresholds];
      newThresholds[index] = {
        ...newThresholds[index],
        [field]: value,
      };
      return {
        ...prev,
        games: {
          ...prev.games,
          [game]: {
            ...prev.games[game],
            thresholds: newThresholds,
          },
        },
      };
    });
  };

  const addThreshold = (game: keyof ExperienceSettings['games']) => {
    setSettings(prev => ({
      ...prev,
      games: {
        ...prev.games,
        [game]: {
          ...prev.games[game],
          thresholds: [
            ...prev.games[game].thresholds,
            { minScore: 0, xpReward: 0 },
          ],
        },
      },
    }));
  };

  const removeThreshold = (game: keyof ExperienceSettings['games'], index: number) => {
    setSettings(prev => ({
      ...prev,
      games: {
        ...prev.games,
        [game]: {
          ...prev.games[game],
          thresholds: prev.games[game].thresholds.filter((_, i) => i !== index),
        },
      },
    }));
  };

  const updateAttendanceSettings = (key: keyof ExperienceSettings['attendance'], value: number) => {
    setSettings(prev => ({
      ...prev,
      attendance: {
        ...prev.attendance,
        [key]: value,
      },
    }));
  };

  const updateReferralSettings = (key: keyof ExperienceSettings['referral'], value: number | boolean) => {
    setSettings(prev => {
      const currentReferral = prev.referral || {
        referrerXP: 30,
        refereeXP: 30,
        enabled: true,
      };
      
      return {
        ...prev,
        referral: {
          ...currentReferral,
          [key]: value,
        },
      };
    });
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Star className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold text-green-800">경험치 관리</h1>
          </div>
        </div>
        <Button
          onClick={saveSettings}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-600"
        >
          <Save className="h-4 w-4 mr-2" />
          저장
        </Button>
      </div>

      <div className="grid gap-6">
        {/* 커뮤니티 활동 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              커뮤니티 활동
            </CardTitle>
            <CardDescription>
              게시글, 댓글, 좋아요 등 커뮤니티 활동에 대한 경험치 설정
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postXP">게시글 작성 경험치</Label>
                <Input
                  id="postXP"
                  type="number"
                  value={settings.community.postXP}
                  onChange={(e) => updateCommunitySettings('postXP', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commentXP">댓글 작성 경험치</Label>
                <Input
                  id="commentXP"
                  type="number"
                  value={settings.community.commentXP}
                  onChange={(e) => updateCommunitySettings('commentXP', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="likeXP">좋아요 경험치</Label>
                <Input
                  id="likeXP"
                  type="number"
                  value={settings.community.likeXP}
                  onChange={(e) => updateCommunitySettings('likeXP', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-4">일일 제한</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dailyPostLimit">게시글 작성 제한 (회)</Label>
                  <Input
                    id="dailyPostLimit"
                    type="number"
                    value={settings.community.dailyPostLimit}
                    onChange={(e) => updateCommunitySettings('dailyPostLimit', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyCommentLimit">댓글 작성 제한 (회)</Label>
                  <Input
                    id="dailyCommentLimit"
                    type="number"
                    value={settings.community.dailyCommentLimit}
                    onChange={(e) => updateCommunitySettings('dailyCommentLimit', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyLikeLimit">좋아요 제한 (회)</Label>
                  <Input
                    id="dailyLikeLimit"
                    type="number"
                    value={settings.community.dailyLikeLimit}
                    onChange={(e) => updateCommunitySettings('dailyLikeLimit', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 게임 설정 */}
        {Object.entries(settings.games).map(([gameKey, gameSettings]) => (
          <Card key={gameKey}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{gameKey === 'reactionGame' ? '반응속도 게임' : '타일 맞추기 게임'}</span>
                <Switch
                  checked={gameSettings.enabled}
                                     onCheckedChange={(checked) => updateGameSettings(gameKey as keyof ExperienceSettings['games'], 'enabled', checked)}
                />
              </CardTitle>
              <CardDescription>
                게임 활성화 상태 및 경험치 설정
              </CardDescription>
            </CardHeader>
            {gameSettings.enabled && (
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor={`${gameKey}-dailyLimit`}>일일 플레이 제한 (회)</Label>
                  <Input
                    id={`${gameKey}-dailyLimit`}
                    type="number"
                    value={gameSettings.dailyLimit}
                                         onChange={(e) => updateGameSettings(gameKey as keyof ExperienceSettings['games'], 'dailyLimit', parseInt(e.target.value) || 0)}
                     className="w-32"
                   />
                 </div>
 
                 <div>
                   <div className="flex items-center justify-between mb-4">
                     <h4 className="text-sm font-medium text-gray-700">점수별 경험치</h4>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => addThreshold(gameKey as keyof ExperienceSettings['games'])}
                     >
                       <Plus className="h-4 w-4 mr-2" />
                       임계값 추가
                     </Button>
                   </div>
                   <div className="space-y-3">
                     {gameSettings.thresholds.map((threshold, index) => (
                       <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                         <div className="flex-1 grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                             <Label className="text-xs">최소 점수</Label>
                             <Input
                               type="number"
                               value={threshold.minScore}
                               onChange={(e) =>
                                 updateThreshold(gameKey as keyof ExperienceSettings['games'], index, 'minScore', parseInt(e.target.value) || 0)
                               }
                             />
                           </div>
                           <div className="space-y-1">
                             <Label className="text-xs">경험치</Label>
                             <Input
                               type="number"
                               value={threshold.xpReward}
                               onChange={(e) =>
                                 updateThreshold(gameKey as keyof ExperienceSettings['games'], index, 'xpReward', parseInt(e.target.value) || 0)
                               }
                             />
                           </div>
                         </div>
                         <Button
                           variant="ghost"
                           size="icon"
                           onClick={() => removeThreshold(gameKey as keyof ExperienceSettings['games'], index)}
                           className="text-red-500 hover:text-red-700"
                         >
                           <Minus className="h-4 w-4" />
                         </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}

        {/* 레벨 시스템 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>레벨 시스템 정보</CardTitle>
            <CardDescription>
              레벨 시스템은 고정된 규칙을 따릅니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>레벨 시스템은 고정된 규칙을 따릅니다:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>1→2레벨: 10 경험치</li>
                <li>2→3레벨: 20 경험치</li>
                <li>3→4레벨: 30 경험치</li>
                <li>이런 식으로 오름차순으로 증가</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 출석 체크 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>출석 체크</CardTitle>
            <CardDescription>
              일일 출석 및 연속 출석에 대한 경험치 설정
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyXP">일일 출석 경험치</Label>
                <Input
                  id="dailyXP"
                  type="number"
                  value={settings.attendance.dailyXP}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    attendance: { ...prev.attendance, dailyXP: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="streakBonus">연속 출석 보너스</Label>
                <Input
                  id="streakBonus"
                  type="number"
                  value={settings.attendance.streakBonus}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    attendance: { ...prev.attendance, streakBonus: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weeklyBonusXP">주간 완주 보너스</Label>
                <Input
                  id="weeklyBonusXP"
                  type="number"
                  value={settings.attendance.weeklyBonusXP}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    attendance: { ...prev.attendance, weeklyBonusXP: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 추천인 시스템 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                추천인 시스템
              </div>
              <Switch
                checked={settings.referral?.enabled ?? false}
                onCheckedChange={(checked) => updateReferralSettings('enabled', checked)}
              />
            </CardTitle>
            <CardDescription>
              회원가입 시 추천인 아이디 입력 시 지급되는 경험치 설정
            </CardDescription>
          </CardHeader>
          {settings.referral?.enabled && (
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="referrerXP">추천인이 받는 경험치</Label>
                  <Input
                    id="referrerXP"
                    type="number"
                    value={settings.referral?.referrerXP ?? 30}
                    onChange={(e) => updateReferralSettings('referrerXP', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500">
                    A가 추천인으로 설정되었을 때 A가 받는 경험치
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="refereeXP">추천받은 사람이 받는 경험치</Label>
                  <Input
                    id="refereeXP"
                    type="number"
                    value={settings.referral?.refereeXP ?? 30}
                    onChange={(e) => updateReferralSettings('refereeXP', parseInt(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500">
                    B가 A를 추천인으로 설정했을 때 B가 받는 경험치
                  </p>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
} 