'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { UserAttendance } from '@/types';
import { checkAttendance } from '@/lib/api/attendance';
import { useExperience } from '@/providers/experience-provider';
import { useQuestTracker } from '@/hooks/useQuestTracker';

interface AttendanceCalendarProps {
  userId: string;
  isProfileOwner?: boolean;
  onAttendanceComplete?: () => void;
}

export default function AttendanceCalendar({ userId, isProfileOwner = false, onAttendanceComplete }: AttendanceCalendarProps) {
  const [attendance, setAttendance] = useState<UserAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAttendance, setCheckingAttendance] = useState(false);
  // 한국 시간 기준으로 초기 날짜 설정
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  });
  const [monthDates, setMonthDates] = useState<{date: Date, currentMonth: boolean}[]>([]);
  const { showExpGain, showLevelUp } = useExperience();
  const { trackDailyAttendance } = useQuestTracker();
  
  // 현재 사용자가 프로필 소유자인지 확인
  const canCheckAttendance = isProfileOwner;
  
  // 출석 정보 가져오기
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!userId) {
        console.error('userId가 없습니다.');
        return;
      }
      
      try {
        setLoading(true);
        const data = await checkAttendance(userId);
        setAttendance(data);
      } catch (error) {
        console.error('출석체크 정보를 가져오는 중 오류 발생:', error);
        toast.error('출석 정보를 가져오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAttendance();
  }, [userId]);
 
  
  // 이번 달 날짜 계산
  useEffect(() => {
    const today = new Date(currentDate);
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // 이번 달 1일
    const firstDay = new Date(year, month, 1);
    // 다음 달 0일 = 이번 달 마지막 날
    const lastDay = new Date(year, month + 1, 0);
    
    // 첫 번째 날의 요일 (일요일: 0, 토요일: 6)
    const firstDayOfWeek = firstDay.getDay();
    
    // 월간 달력에 표시할 날짜 배열
    const dates: {date: Date, currentMonth: boolean}[] = [];
    
    // 이전 달의 날짜들 추가
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = 0; i < firstDayOfWeek; i++) {
      const date = new Date(year, month - 1, prevMonthLastDay - firstDayOfWeek + i + 1);
      dates.push({ date, currentMonth: false });
    }
    
    // 이번 달 날짜들 추가
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      dates.push({ date, currentMonth: true });
    }
    
    // 다음 달 날짜들로 나머지 채우기 (최대 42개 - 6주)
    const remaining = 42 - dates.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      dates.push({ date, currentMonth: false });
    }
    
    setMonthDates(dates);
  }, [currentDate]);

  // 한국 시간대 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
  const formatDate = (date: Date): string => {
    // 한국 시간대 기준으로 변환
    const koreaDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    const year = koreaDate.getUTCFullYear();
    const month = String(koreaDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(koreaDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // 출석 여부 확인
  const isAttended = (date: Date): boolean => {
    if (!attendance) return false;
    const dateString = formatDate(date);
    // attendances(전체 출석 기록)를 우선 확인하고, 없으면 monthlyLog 확인
    if (attendance.attendances && attendance.attendances[dateString]) {
      return true;
    }
    if (attendance.monthlyLog && attendance.monthlyLog[dateString]) {
      return true;
    }
    return false;
  };
  
  // 오늘 날짜인지 확인 (한국 시간 기준)
  const isToday = (date: Date): boolean => {
    const now = new Date();
    const koreaToday = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    const koreaDate = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    
    return (
      koreaDate.getUTCDate() === koreaToday.getUTCDate() &&
      koreaDate.getUTCMonth() === koreaToday.getUTCMonth() &&
      koreaDate.getUTCFullYear() === koreaToday.getUTCFullYear()
    );
  };
  
  // 연속 출석 일수에 따른 추가 보상 안내
  const renderStreakBonus = () => {
    const streak = attendance?.streak || 0;
    let message = '';
    
    if (streak < 7) {
      message = `7일 연속 출석 시 +50 경험치 (앞으로 ${7 - streak}일)`;
    } else if (streak < 30) {
      message = `30일 연속 출석 시 +200 경험치 (앞으로 ${30 - streak}일)`;
    } else {
      message = '30일 연속 출석 달성! (+200 경험치)';
    }
    
    return (
      <div className="flex items-center justify-center mt-3 text-xs text-green-600">
        <Calendar className="h-3 w-3 mr-1" />
        <span>{message}</span>
      </div>
    );
  };
  
  // 출석체크 수행
  const handleAttendanceCheck = async () => {
    if (!userId) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    
    if (!canCheckAttendance || checkingAttendance || attendance?.checkedToday) return;
    
    try {
      setCheckingAttendance(true);
      
      // 출석체크 수행 - 이미 레벨업 정보와 경험치 정보가 포함되어 있음
      const updatedAttendance = await checkAttendance(userId, true);
      setAttendance(updatedAttendance);
      
      // 경험치 및 레벨업 알림 표시
      if (updatedAttendance.leveledUp) {
        // 레벨업 알림
        showLevelUp(
          updatedAttendance.expGained || 0,
          updatedAttendance.oldLevel || 1, 
          updatedAttendance.newLevel || 2
        );
      } else if (updatedAttendance.expGained) {
        // 일반 경험치 획득 알림
        showExpGain(
          updatedAttendance.expGained,
          `출석체크 완료! ${updatedAttendance.streak}일 연속 출석 중입니다.`
        );
      }
      
      // 퀘스트 트래킹: 출석체크 (8단계, 10단계)
      // 연속 출석 일수를 함께 전달하여 10단계 조건도 체크
      await trackDailyAttendance(updatedAttendance.streak);
      
      toast.success(`출석체크 완료! ${updatedAttendance.streak}일 연속 출석 중입니다.`);
      
      // 부모 컴포넌트에 출석체크 완료 알림
      if (onAttendanceComplete) {
        onAttendanceComplete();
      }
    } catch (error) {
      console.error('출석체크 오류:', error);
      toast.error('출석체크 처리 중 오류가 발생했습니다.');
    } finally {
      setCheckingAttendance(false);
    }
  };
  
  // 이전/다음 달로 이동
  const prevMonth = () => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() - 1);
    setCurrentDate(date);
  };
  
  const nextMonth = () => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 1);
    setCurrentDate(date);
  };
  
  // 이번 달로 리셋
  const resetToCurrentMonth = () => {
    const now = new Date();
    const koreaDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
    setCurrentDate(koreaDate);
  };
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>출석체크</CardTitle>
          <CardDescription>사용자의 출석 기록을 불러오는 중...</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent"></div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>출석체크</CardTitle>
        <CardDescription>
          매일 출석 시 경험치가 쌓입니다. 연속 출석 시 추가 보상!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600 mb-2">
            <div className="font-bold text-xl">{attendance?.streak || 0}</div>
          </div>
          {attendance?.checkedToday ? (
            <div>
              <p className="text-green-600 font-medium">오늘 출석 완료!</p>
              <p className="text-sm mt-1">
                연속 <span className="font-bold">{attendance.streak}일째</span> 출석중
              </p>
            </div>
          ) : canCheckAttendance ? (
            <div>
              <p className="text-green-600 font-medium mb-2">
                오늘 출석체크를 하고 경험치를 받으세요!
              </p>
              <Button 
                onClick={handleAttendanceCheck}
                disabled={checkingAttendance}
                className="w-full md:w-auto"
              >
                {checkingAttendance ? (
                  <div className="flex items-center">
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    처리중...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Check className="h-4 w-4 mr-2" />
                    출석체크하기
                  </div>
                )}
              </Button>
            </div>
          ) : (
            <p className="text-green-600 font-medium">
              오늘 아직 출석하지 않았습니다
            </p>
          )}
          {renderStreakBonus()}
        </div>
        
        
        {/* 월간 캘린더 */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월 출석 현황
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth} className="h-6 w-6">
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetToCurrentMonth} className="h-6 text-xs">
                오늘
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="h-6 w-6">
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="text-xs font-medium py-1">
                {day}
              </div>
            ))}
            
            {monthDates.map(({ date, currentMonth }, index) => {
              const attended = isAttended(date);
              const today = isToday(date);
              
              return (
                <TooltipProvider key={index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`
                          aspect-square flex items-center justify-center rounded-full text-xs
                          ${!currentMonth ? 'opacity-30' : ''}
                          ${today ? 'ring-2 ring-green-400' : ''}
                          ${attended && currentMonth ? 'bg-green-500 text-white' : 'bg-gray-100'}
                        `}
                      >
                        {date.getDate()}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{formatDate(date)}</p>
                      <p>{attended ? '출석완료' : '미출석'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground">이번 달</p>
            <p className="font-medium">{attendance?.monthCount || 0}일</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">총 출석</p>
            <p className="font-medium">{attendance?.totalCount || 0}일</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">연속 출석</p>
            <p className="font-medium">{attendance?.streak || 0}일</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
            <span>출석</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-gray-100 mr-1"></div>
            <span>미출석</span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
} 