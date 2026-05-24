'use client';

import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from './button';
import { Progress } from './progress';
import { Badge } from './badge';
import toast from 'react-hot-toast';
import { Check, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FirebaseTimestamp } from '@/types';

interface PollOption {
  text: string;
  imageUrl?: string;
  voteCount: number;
  index: number;
}

interface PollData {
  isActive: boolean;
  question: string;
  options: PollOption[];
  expiresAt?: FirebaseTimestamp;
  multipleChoice: boolean;
  voters?: string[]; // 투표한 사용자 ID 목록
  userVotes?: { [userId: string]: number }; // 사용자별 투표 선택지 기록
}

interface PollVotingProps {
  postId: string;
  poll: PollData;
  onVoteUpdate?: (updatedPoll: PollData) => void;
}

export const PollVoting = ({ postId, poll, onVoteUpdate }: PollVotingProps) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [localPoll, setLocalPoll] = useState<PollData>(poll);

  // 사용자가 이미 투표했는지 확인 및 기존 투표 선택지 설정
  useEffect(() => {
    if (user && localPoll.userVotes) {
      const userPreviousVote = localPoll.userVotes[user.uid];
      if (userPreviousVote !== undefined) {
        setHasVoted(true);
        setSelectedOption(userPreviousVote);
      }
    } else if (user && localPoll.voters) {
      setHasVoted(localPoll.voters.includes(user.uid));
    }
  }, [user, localPoll.voters, localPoll.userVotes]);

  // 총 투표 수 계산
  const totalVotes = localPoll.options.reduce((sum, option) => sum + option.voteCount, 0);

  // 투표 처리
  const handleVote = async (optionIndex: number) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (!localPoll.isActive) {
      toast.error('투표가 종료되었습니다.');
      return;
    }

    setIsVoting(true);

    try {
      // 로컬 상태 기반으로 즉시 UI 업데이트
      const updatedOptions = [...localPoll.options];
      const currentVoters = localPoll.voters || [];
      const currentUserVotes = localPoll.userVotes || {};
      
      // 기존 투표가 있다면 해당 옵션의 카운트 감소
      if (hasVoted && currentUserVotes[user.uid] !== undefined) {
        const previousOptionIndex = currentUserVotes[user.uid];
        if (previousOptionIndex >= 0 && previousOptionIndex < updatedOptions.length) {
          updatedOptions[previousOptionIndex].voteCount = Math.max(0, updatedOptions[previousOptionIndex].voteCount - 1);
        }
      }

      // 새로운 투표 추가
      updatedOptions[optionIndex].voteCount += 1;

      // 사용자 투표 기록 업데이트
      const updatedUserVotes = {
        ...currentUserVotes,
        [user.uid]: optionIndex
      };

      const updatedPoll = {
        ...localPoll,
        options: updatedOptions,
        voters: hasVoted ? currentVoters : [...currentVoters, user.uid],
        userVotes: updatedUserVotes
      };

      // 즉시 로컬 상태 업데이트 (UI 반영)
      setLocalPoll(updatedPoll);
      setSelectedOption(optionIndex);
      setHasVoted(true);

      // Firestore 업데이트 (백그라운드에서)
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        poll: updatedPoll
      });
      
      if (onVoteUpdate) {
        onVoteUpdate(updatedPoll);
      }

      toast.success(hasVoted ? '투표를 변경했습니다.' : '투표가 완료되었습니다.');
    } catch (error) {
      console.error('투표 오류:', error);
      toast.error('투표 처리 중 오류가 발생했습니다.');
      
      // 오류 발생 시 원래 상태로 복원
      setLocalPoll(poll);
      setSelectedOption(hasVoted ? (poll.userVotes?.[user.uid] ?? -1) : -1);
      setHasVoted(!!poll.userVotes?.[user.uid]);
    } finally {
      setIsVoting(false);
    }
  };

  // 투표 취소
  const handleRemoveVote = async () => {
    if (!user || !hasVoted) return;

    setIsVoting(true);

    try {
      const currentUserVotes = localPoll.userVotes || {};
      
      if (currentUserVotes[user.uid] !== undefined) {
        // 로컬 상태 기반으로 즉시 UI 업데이트
        const userVotedOptionIndex = currentUserVotes[user.uid];
        const updatedOptions = [...localPoll.options];
        updatedOptions[userVotedOptionIndex].voteCount = Math.max(0, updatedOptions[userVotedOptionIndex].voteCount - 1);
        
        const updatedVoters = (localPoll.voters || []).filter(voterId => voterId !== user.uid);
        
        // 사용자 투표 기록에서 제거
        const updatedUserVotes = { ...currentUserVotes };
        delete updatedUserVotes[user.uid];
        
        const updatedPoll = {
          ...localPoll,
          options: updatedOptions,
          voters: updatedVoters,
          userVotes: updatedUserVotes
        };
        
        // 즉시 로컬 상태 업데이트 (UI 반영)
        setLocalPoll(updatedPoll);
        setHasVoted(false);
        setSelectedOption(-1);

        // Firestore 업데이트 (백그라운드에서)
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, {
          poll: updatedPoll
        });

        if (onVoteUpdate) {
          onVoteUpdate(updatedPoll);
        }

        toast.success('투표를 취소했습니다.');
      }
    } catch (error) {
      console.error('투표 취소 오류:', error);
      toast.error('투표 취소 중 오류가 발생했습니다.');
      
      // 오류 발생 시 원래 상태로 복원
      setLocalPoll(poll);
      setSelectedOption(hasVoted ? (poll.userVotes?.[user.uid] ?? -1) : -1);
      setHasVoted(!!poll.userVotes?.[user.uid]);
    } finally {
      setIsVoting(false);
    }
  };

  // 투표 결과 보기 여부 (투표한 사람만 결과 볼 수 있음)
  const showResults = hasVoted || !localPoll.isActive;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!localPoll.isActive && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              종료
            </Badge>
          )}
          {showResults && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {totalVotes}표
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {localPoll.options.map((option, index) => {
          const percentage = totalVotes > 0 ? (option.voteCount / totalVotes) * 100 : 0;
          const isSelected = selectedOption === index;
          
          return (
            <div key={index} className="space-y-2">
              <Button
                variant={showResults ? "outline" : "outline"}
                className={cn(
                  "w-full justify-start text-left h-auto p-0 relative overflow-hidden border-2 min-h-[150px]",
                  !showResults && "bg-slate-50 hover:bg-muted hover:border-primary/50 border-slate-200",
                  showResults && "cursor-default bg-muted/30 border-muted-foreground/20",
                  isSelected && showResults && "ring-2 ring-primary border-primary",
                  !user && "cursor-not-allowed opacity-50"
                )}
                onClick={() => {
                  if (!showResults && user && localPoll.isActive) {
                    handleVote(index);
                  }
                }}
                disabled={isVoting || !user || (!localPoll.isActive && !showResults)}
              >
                {/* 투표 결과 배경 */}
                {showResults && (
                  <div 
                    className="absolute inset-0 bg-primary/10 transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                )}
                
                <div className="relative flex items-center w-full h-full">
                  <div className="flex items-center flex-1 px-4 py-4">
                    <div className="flex-1">
                      <span className="font-medium text-base">{option.text}</span>
                      {isSelected && showResults && (
                        <Check className="h-4 w-4 text-primary inline-block ml-2" />
                      )}
                    </div>
                  </div>
                  
                  {showResults && (
                    <div className="flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground px-4">
                      <span className="font-medium">{option.voteCount}표</span>
                      <span className="text-xs">({percentage.toFixed(1)}%)</span>
                    </div>
                  )}
                  
                  {option.imageUrl && (
                    <div className="h-full">
                      <img 
                        src={option.imageUrl} 
                        alt={option.text}
                        className="h-full w-[150px] object-cover rounded-r-lg"
                        style={{ minHeight: '150px' }}
                      />
                    </div>
                  )}
                </div>
              </Button>
              
              {showResults && (
                <Progress value={percentage} className="h-1" />
              )}
            </div>
          );
        })}

        {/* 투표 상태 및 액션 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {!user ? (
              "로그인 후 투표할 수 있습니다"
            ) : !localPoll.isActive ? (
              "투표가 종료되었습니다"
            ) : hasVoted ? (
              "투표에 참여했습니다"
            ) : (
              "선택지를 클릭해서 투표하세요"
            )}
          </div>
          
          {user && hasVoted && localPoll.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveVote}
              disabled={isVoting}
              className="text-destructive hover:text-destructive"
            >
              투표 취소
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}; 