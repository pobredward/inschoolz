'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MealInfo } from '@/types';
import { Clock, Utensils, Zap } from 'lucide-react';

interface MealCardProps {
  meal: MealInfo;
  showDate?: boolean;
  compact?: boolean;
}

export default function MealCard({
  meal,
  showDate = false,
  compact = false
}: MealCardProps) {
  const getMealTypeLabel = (type: string) => {
    switch (type) {
      case 'breakfast':
        return '조식';
      case 'lunch':
        return '중식';
      case 'dinner':
        return '석식';
      default:
        return '급식';
    }
  };

  const getMealTypeIcon = (type: string) => {
    return <Utensils className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}월 ${day}일 (${dayOfWeek})`;
  };

  // 간단한 카드 레이아웃
  if (compact) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getMealTypeIcon(meal.mealType)}
              <span className="font-medium text-sm">
                {getMealTypeLabel(meal.mealType)}
              </span>
              {showDate && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(meal.date)}
                </span>
              )}
            </div>
            {meal.calories && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {meal.calories}
              </Badge>
            )}
          </div>
          
          <div className="space-y-1">
            {meal.menu.slice(0, 3).map((item, index) => (
              <p key={index} className="text-sm text-foreground">
                • {item}
              </p>
            ))}
            {meal.menu.length > 3 && (
              <p className="text-xs text-muted-foreground">
                외 {meal.menu.length - 3}개
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 기본 카드 레이아웃 (모바일 최적화)
  return (
    <Card className="w-full">
      <CardContent className="p-4 sm:p-6">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <div className="flex items-center gap-2">
            {getMealTypeIcon(meal.mealType)}
            <h3 className="text-lg font-semibold">
              {getMealTypeLabel(meal.mealType)}
            </h3>
            {showDate && (
              <Badge variant="outline" className="text-sm ml-2">
                <Clock className="w-3 h-3 mr-1" />
                {formatDate(meal.date)}
              </Badge>
            )}
          </div>
          {meal.calories && (
            <Badge variant="secondary" className="self-start sm:self-center">
              <Zap className="w-4 h-4 mr-1" />
              {meal.calories}
            </Badge>
          )}
        </div>

        {/* 메뉴 목록 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {meal.menu.map((item, index) => (
            <div key={index} className="flex items-start text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
              <span className="leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
