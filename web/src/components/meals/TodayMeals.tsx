'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MealCard from './MealCard';
import { MealInfo } from '@/types';
import { getTodayMeals } from '@/lib/api/meals';
import { RefreshCw, Utensils, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface TodayMealsProps {
  schoolId: string;
  schoolName: string;
  showHeader?: boolean;
}

export default function TodayMeals({ 
  schoolId, 
  schoolName, 
  showHeader = true 
}: TodayMealsProps) {
  const [meals, setMeals] = useState<MealInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 오늘의 급식 정보 로드
  const loadTodayMeals = async () => {
    if (!schoolId) return;

    setIsLoading(true);
    try {
      const response = await getTodayMeals(schoolId);
      
      if (response.success) {
        setMeals(response.data);
        setLastUpdated(new Date());
      } else {
        toast.error(response.message || '급식 정보를 불러올 수 없습니다.');
      }
    } catch (error) {
      console.error('오늘의 급식 정보 로드 실패:', error);
      toast.error('급식 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 새로고침
  const handleRefresh = () => {
    loadTodayMeals();
  };

  // 초기 로드
  useEffect(() => {
    loadTodayMeals();
  }, [schoolId]);

  // 오늘 날짜 포맷팅
  const formatToday = () => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  // 마지막 업데이트 시간 포맷팅
  const formatLastUpdated = () => {
    if (!lastUpdated) return '';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    
    return lastUpdated.toLocaleDateString();
  };

  // 급식 타입별 정렬
  const sortedMeals = meals.sort((a, b) => {
    const order = { breakfast: 0, lunch: 1, dinner: 2 };
    return order[a.mealType] - order[b.mealType];
  });

  return (
    <div className="space-y-4">
      {showHeader && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>오늘의 급식</span>
                <Badge variant="outline">{formatToday()}</Badge>
                <Badge variant="secondary">{schoolName}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-sm text-muted-foreground">
                    {formatLastUpdated()}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {isLoading && meals.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>급식 정보를 불러오는 중...</span>
          </CardContent>
        </Card>
      ) : meals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <Utensils className="w-12 h-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">오늘의 급식 정보가 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">
                급식이 제공되지 않거나 정보가 업데이트되지 않았을 수 있습니다.
              </p>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              다시 시도
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              showDate={false}
              showNutrition={true}
              compact={false}
              variant="desktop"
            />
          ))}
        </div>
      )}
    </div>
  );
}
