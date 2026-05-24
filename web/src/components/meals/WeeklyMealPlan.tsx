'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MealCard from './MealCard';
import { WeeklyMealPlan as WeeklyMealPlanType } from '@/types';
import { getWeeklyMealPlan } from '@/lib/api/meals';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface WeeklyMealPlanProps {
  schoolId: string;
  schoolName: string;
}

export default function WeeklyMealPlan({ schoolId, schoolName }: WeeklyMealPlanProps) {
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyMealPlanType | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // 이번 주 시작일 계산
  const getWeekStart = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day;
    const weekStart = new Date(date.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  };

  // 주간 날짜 배열 생성
  const getWeekDates = (weekStart: string) => {
    const dates = [];
    const start = new Date(weekStart);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    return dates;
  };

  // 날짜 포맷팅
  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return { month, day, dayOfWeek };
  };

  // 급식 정보 로드
  const loadWeeklyMeals = async (weekStart: string) => {
    if (!schoolId) return;

    setIsLoading(true);
    try {
      const plan = await getWeeklyMealPlan(schoolId, weekStart);
      setWeeklyPlan(plan);
      
    } catch (error) {
      console.error('주간 급식 정보 로드 실패:', error);
      toast.error('급식 정보를 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 이전/다음 주로 이동
  const navigateWeek = (direction: 'prev' | 'next') => {
    const current = new Date(currentWeekStart);
    const newDate = new Date(current);
    newDate.setDate(current.getDate() + (direction === 'next' ? 7 : -7));
    const newWeekStart = getWeekStart(newDate);
    setCurrentWeekStart(newWeekStart);
  };

  // 초기화
  useEffect(() => {
    const today = new Date();
    const weekStart = getWeekStart(today);
    setCurrentWeekStart(weekStart);
  }, []);

  // 주차 변경 시 데이터 로드
  useEffect(() => {
    if (currentWeekStart) {
      loadWeeklyMeals(currentWeekStart);
    }
  }, [currentWeekStart, schoolId]);

  const weekDates = currentWeekStart ? getWeekDates(currentWeekStart) : [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      {/* 주간 네비게이션 */}
      <div className="flex items-center justify-center space-x-4 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateWeek('prev')}
          disabled={isLoading}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="text-center">
          <span className="text-lg font-medium px-4 py-2 bg-secondary rounded-md">
            {currentWeekStart && (
              <>
                {formatDateHeader(currentWeekStart).month}월 {formatDateHeader(currentWeekStart).day}일 ~{' '}
                {formatDateHeader(weekDates[6] || currentWeekStart).month}월{' '}
                {formatDateHeader(weekDates[6] || currentWeekStart).day}일
              </>
            )}
          </span>
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">{schoolName}</Badge>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateWeek('next')}
          disabled={isLoading}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>급식 정보를 불러오는 중...</span>
        </div>
      ) : weeklyPlan ? (
        <div className="space-y-6">
          {weekDates.map((date) => {
            const dayMeals = weeklyPlan.meals[date];
            if (!dayMeals || Object.keys(dayMeals).length === 0) return null;

            const { month, day, dayOfWeek } = formatDateHeader(date);
            const isToday = date === new Date().toISOString().split('T')[0];

            return (
              <div key={date} className="space-y-3">
                <div className={`flex items-center gap-2 pb-2 border-b ${
                  isToday ? 'border-primary' : 'border-border'
                }`}>
                  <h3 className={`font-semibold ${
                    isToday ? 'text-primary' : 'text-foreground'
                  }`}>
                    {month}월 {day}일 ({dayOfWeek})
                  </h3>
                  {isToday && (
                    <Badge variant="default" className="text-xs">오늘</Badge>
                  )}
                </div>
                
                <div className="space-y-3">
                  {dayMeals.breakfast && (
                    <MealCard meal={dayMeals.breakfast} variant="desktop" />
                  )}
                  {dayMeals.lunch && (
                    <MealCard meal={dayMeals.lunch} variant="desktop" />
                  )}
                  {dayMeals.dinner && (
                    <MealCard meal={dayMeals.dinner} variant="desktop" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">급식 정보를 불러올 수 없습니다.</p>
        </div>
      )}
    </div>
  );
}
