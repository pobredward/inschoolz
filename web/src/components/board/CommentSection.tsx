'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { 
  MessageSquare, 
  Heart, 
  MessageSquare as MessageIcon, 
  MoreVertical, 
  Edit2, 
  Trash2,
  Send,
  Flag,
  UserX,
  ShieldOff
} from 'lucide-react';
// Portal 없는 커스텀 드롭다운을 위해 Popover 제거
import { useAuth } from '@/providers/AuthProvider';
import { useQuestTracker } from '@/hooks/useQuestTracker';
import { useRouter } from 'next/navigation';
import { Comment } from '@/types';
import { ReportModal } from '@/components/ui/report-modal';
import { toggleBlock, getBlockedUserIds } from '@/lib/api/users';
import { BlockedUserContent } from '@/components/ui/blocked-user-content';
import AnonymousCommentForm from '@/components/ui/anonymous-comment-form';
import AnonymousPasswordModal from '@/components/ui/anonymous-password-modal';
import { formatRelativeTime } from '@/lib/utils';
import { 
  getCommentsByPost, 
  createComment as createCommentAPI, 
  updateComment, 
  deleteComment,
  toggleCommentLike,
  checkMultipleCommentLikeStatus
} from '@/lib/api/board';
import {
  createAnonymousComment,
  updateAnonymousComment,
  deleteAnonymousComment,
  getClientIP,
  verifyAnonymousCommentPassword
} from '@/lib/api/comments';
import { toast } from 'react-hot-toast';
import { awardCommentExperience } from '@/lib/experience-service';
import { ExperienceModal } from '@/components/ui/experience-modal';
import { isAdmin, canEditAIComment } from '@/lib/admin-utils';

interface CommentSectionProps {
  postId: string;
  initialComments?: Comment[];
  hasMoreComments?: boolean;
  onCommentCountChange?: (count: number) => void;
}

interface CommentWithReplies extends Comment {
  replies?: Comment[];
  author?: {
    displayName: string;
    profileImageUrl?: string;
    isAnonymous: boolean;
  };
}

interface CommentFormProps {
  parentId?: string;
  parentAuthor?: string;
  placeholder?: string;
  buttonText?: string;
  onSubmit: (content: string, isAnonymous: boolean) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

interface CommentMenuDropdownProps {
  isAuthor: boolean;
  isAnonymous: boolean;
  hasAnonymousAuthor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAnonymousEdit: () => void;
  onAnonymousDelete: () => void;
  onReport: () => void;
  onBlock: () => void;
  isBlocking: boolean;
}

// Portal 없는 커스텀 드롭다운 컴포넌트
function CommentMenuDropdown({
  isAuthor,
  isAnonymous,
  hasAnonymousAuthor,
  onEdit,
  onDelete,
  onAnonymousEdit,
  onAnonymousDelete,
  onReport,
  onBlock,
  isBlocking
}: CommentMenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-comment-menu]')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMenuAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="relative" data-comment-menu>
      <Button 
        variant="ghost" 
        size="sm" 
        className="w-6 h-6 p-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MoreVertical className="w-3 h-3" />
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[140px] z-50">
          {isAuthor ? (
            <>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                onClick={() => handleMenuAction(onEdit)}
              >
                <Edit2 className="mr-2 h-3 w-3" />
                수정
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                onClick={() => handleMenuAction(onDelete)}
              >
                <Trash2 className="mr-2 h-3 w-3" />
                삭제
              </button>
            </>
          ) : isAnonymous && hasAnonymousAuthor ? (
            <>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center"
                onClick={() => handleMenuAction(onAnonymousEdit)}
              >
                <Edit2 className="mr-2 h-3 w-3" />
                수정 (비밀번호 필요)
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                onClick={() => handleMenuAction(onAnonymousDelete)}
              >
                <Trash2 className="mr-2 h-3 w-3" />
                삭제 (비밀번호 필요)
              </button>
            </>
          ) : (
            <>
              <button
                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                onClick={() => handleMenuAction(onReport)}
              >
                <Flag className="mr-2 h-3 w-3" />
                신고
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center"
                onClick={() => handleMenuAction(onBlock)}
                disabled={isBlocking}
              >
                <ShieldOff className="mr-2 h-3 w-3" />
                {isBlocking ? '처리 중...' : '차단하기'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 댓글 작성 폼 컴포넌트
function CommentForm({ 
  parentId, 
  parentAuthor,
  placeholder = "댓글을 입력하세요...", 
  buttonText = "댓글 작성",
  onSubmit, 
  onCancel,
  isSubmitting = false 
}: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }

    onSubmit(content.trim(), isAnonymous);
    setContent('');
    setIsAnonymous(false);
  };

  return (
    <div className={`space-y-3 ${parentId ? 'bg-slate-50 rounded-lg p-4' : ''}`}>
      {parentAuthor && (
        <div className="text-sm text-slate-600">
          <span className="font-medium text-blue-600">@{parentAuthor}</span>님에게 답글 작성
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded"
            />
            익명
          </label>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="min-h-[80px] resize-none"
        />
        <div className="flex items-center justify-end">
          <div className="flex gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                취소
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !content.trim()}
            >
              <Send className="w-4 h-4 mr-1" />
              {buttonText}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// 링크가 포함된 텍스트를 렌더링하는 함수
function renderCommentWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

// 댓글 아이템 컴포넌트
function CommentItem({ 
  comment, 
  postId,
  onReply, 
  onEdit, 
  onDelete, 
  onLike,
  onAnonymousEdit,
  onAnonymousDelete,
  editingComment,
  onEditingCommentChange,
  onEditingCommentSave,
  onEditingCommentCancel,
  editingAIComment,
  onStartEditAIComment,
  onSaveAIComment,
  onCancelAIComment,
  onAICommentContentChange,
  isLiked = false,
  level = 0,
  replyingTo,
  onCommentSubmit,
  isSubmitting
}: {
  comment: CommentWithReplies;
  postId: string;
  onReply: (parentId: string, parentAuthor: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onLike: (commentId: string) => void;
  onAnonymousEdit: (commentId: string) => void;
  onAnonymousDelete: (commentId: string) => void;
  editingComment: { id: string; content: string; password?: string } | null;
  onEditingCommentChange: (content: string) => void;
  onEditingCommentSave: () => void;
  onEditingCommentCancel: () => void;
  editingAIComment: { id: string; content: string } | null;
  onStartEditAIComment: (comment: Comment) => void;
  onSaveAIComment: () => void;
  onCancelAIComment: () => void;
  onAICommentContentChange: (content: string) => void;
  isLiked?: boolean;
  level?: number;
  replyingTo?: { id: string; author: string } | null;
  onCommentSubmit?: (content: string, isAnonymous: boolean, parentId?: string) => void;
  isSubmitting?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  
  const maxLevel = 1; // 최대 1단계 대댓글까지만 허용
  const isAuthor = user?.uid === comment.authorId;
  const isAnonymous = comment.isAnonymous && !comment.authorId;
  const isDeleted = comment.status.isDeleted;
  const isReply = level > 0;
  const isAIComment = comment.fake === true;
  const canEditAI = isAdmin(user?.email) && isAIComment;
  const canDeleteAI = isAdmin(user?.email) && isAIComment;
  const isEditingAI = editingAIComment?.id === comment.id;
  
  // 작성자 표시 로직
  const getAuthorName = () => {
    if (isAnonymous && comment.anonymousAuthor) {
      return comment.anonymousAuthor.nickname;
    }
    if (comment.isAnonymous && comment.authorId) {
      return '익명';
    }
    return comment.author?.displayName || '사용자';
  };

  const authorName = getAuthorName();

  const formatTime = (timestamp: unknown) => {
    return formatRelativeTime(timestamp);
  };

  const handleEdit = () => {
    if (!editContent.trim()) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }
    
    onEdit(comment.id, editContent.trim());
    setIsEditing(false);
  };

  const handleLike = () => {
    onLike(comment.id);
  };

  const handleBlock = async () => {
    if (!user || !comment.authorId) {
      toast('로그인이 필요합니다.');
      return;
    }

    if (comment.authorId === user.uid) {
      toast('자기 자신을 차단할 수 없습니다.');
      return;
    }

    const authorName = getAuthorName();
    const confirmed = confirm(`${authorName}님을 차단하시겠습니까?\n\n차단된 사용자의 게시글과 댓글은 "차단한 사용자입니다"로 표시됩니다.`);
    
    if (!confirmed) return;

    setIsBlocking(true);
    try {
      const result = await toggleBlock(user.uid, comment.authorId);
      toast(result.isBlocked ? '사용자를 차단했습니다.' : '차단을 해제했습니다.');
    } catch (error) {
      console.error('차단 처리 실패:', error);
      toast('차단 처리에 실패했습니다.');
    } finally {
      setIsBlocking(false);
    }
  };

  // AI 댓글 삭제 핸들러 (관리자 전용)
  const handleDeleteAIComment = async () => {
    if (!confirm('정말로 이 AI 댓글을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/comments?id=${comment.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('AI 댓글이 삭제되었습니다.');
        // 댓글 목록 새로고침을 위해 부모 컴포넌트의 onDelete 호출
        onDelete(comment.id);
      } else {
        throw new Error(result.error || 'AI 댓글 삭제 실패');
      }
    } catch (error) {
      console.error('AI 댓글 삭제 오류:', error);
      toast.error('AI 댓글 삭제에 실패했습니다.');
    }
  };

  return (
    <div className={`${isReply ? 'ml-8 mt-3 p-3 bg-slate-50 rounded-lg' : ''}`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {/* 프로필 이미지를 작성자 이름 바로 왼쪽에 배치 */}
          {isAnonymous ? (
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarFallback className="text-xs bg-slate-100">
                <UserX className="w-3 h-3" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <button 
              onClick={() => comment.authorId && router.push(`/users/${comment.authorId}`)}
              className="hover:opacity-80 transition-opacity"
            >
              <Avatar className="w-6 h-6 flex-shrink-0">
                <AvatarImage src={comment.author?.profileImageUrl} />
                <AvatarFallback className="text-xs bg-slate-100">
                  {authorName.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </button>
          )}
          
          {/* 작성자 이름과 시간 */}
          {isAnonymous ? (
            <span className="font-medium text-sm text-slate-900">
              {authorName}
              <span className="text-xs text-slate-500 ml-1">(비회원)</span>
            </span>
          ) : (
            <button 
              onClick={() => comment.authorId && router.push(`/users/${comment.authorId}`)}
              className="font-medium text-sm text-slate-900 hover:text-blue-600 transition-colors"
            >
              {authorName}
            </button>
          )}
          <span className="text-xs text-slate-500">
            {formatTime(comment.createdAt)}
          </span>
        </div>
          
        
                
        {/* 메뉴 버튼 - 커스텀 드롭다운 */}
        {!isDeleted && (
          // 비회원일 때는 익명 댓글에만 메뉴 표시, 회원일 때는 모든 댓글에 메뉴 표시
          (user || isAnonymous) && (
            <CommentMenuDropdown
              isAuthor={isAuthor}
              isAnonymous={isAnonymous}
              hasAnonymousAuthor={!!comment.anonymousAuthor}
              onEdit={() => setIsEditing(true)}
              onDelete={() => onDelete(comment.id)}
              onAnonymousEdit={() => onAnonymousEdit(comment.id)}
              onAnonymousDelete={() => onAnonymousDelete(comment.id)}
              onReport={() => setShowReportModal(true)}
              onBlock={handleBlock}
              isBlocking={isBlocking}
            />
          )
        )}
      </div>
      
      {/* 댓글 내용 */}
      <div className="ml-8 min-w-0 overflow-hidden">
        {isEditing && !isDeleted ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEdit}>
                수정 완료
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content);
                }}
              >
                취소
              </Button>
            </div>
          </div>
        ) : editingComment && editingComment.id === comment.id ? (
          <div className="space-y-2">
            <Textarea
              value={editingComment.content}
              onChange={(e) => onEditingCommentChange(e.target.value)}
              className="min-h-[60px] text-sm"
              placeholder="댓글 내용을 입력하세요..."
            />
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={onEditingCommentSave}
              >
                수정 완료
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onEditingCommentCancel}
              >
                취소
              </Button>
            </div>
          </div>
        ) : isEditingAI ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">AI 댓글 수정</span>
            </div>
            <Textarea
              value={editingAIComment?.content || ''}
              onChange={(e) => onAICommentContentChange(e.target.value)}
              className="min-h-[60px] text-sm"
              placeholder="AI 댓글 내용을 수정하세요..."
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {editingAIComment?.content?.length || 0}/500자
              </span>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={onSaveAIComment}
                  disabled={!editingAIComment?.content?.trim()}
                >
                  수정 완료
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={onCancelAIComment}
                >
                  취소
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className={`text-sm leading-relaxed whitespace-pre-wrap break-all ${isDeleted ? 'text-slate-500 italic' : 'text-slate-700'}`}>
              {isDeleted ? '삭제된 댓글입니다.' : renderCommentWithLinks(comment.content)}
            </div>
            
            {/* 액션 버튼들 */}
            {!isDeleted && (
              <div className="flex items-center gap-3 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2 text-xs ${isLiked ? 'text-red-500' : 'text-slate-500 hover:text-slate-700'}`}
                  onClick={handleLike}
                >
                  <Heart className={`w-3 h-3 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                  {comment.stats?.likeCount || 0}
                </Button>
                
                {level < maxLevel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
                    onClick={() => onReply(comment.id, authorName)}
                  >
                    <MessageIcon className="w-3 h-3 mr-1" />
                    답글
                  </Button>
                )}

                {/* AI 댓글 수정 버튼 (관리자 전용) */}
                {canEditAI && !isEditingAI && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => onStartEditAIComment(comment as Comment)}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    AI 수정
                  </Button>
                )}

                {/* AI 댓글 삭제 버튼 (관리자 전용) */}
                {canDeleteAI && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-600 hover:text-red-800"
                    onClick={handleDeleteAIComment}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    AI 삭제
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 답글 작성 폼 */}
      {replyingTo?.id === comment.id && onCommentSubmit && (
        <div className="mt-4">
          <CommentForm
            parentId={comment.id}
            parentAuthor={getAuthorName()}
            placeholder="답글을 입력하세요..."
            buttonText="답글 작성"
            onSubmit={(content, isAnonymous) => 
              onCommentSubmit(content, isAnonymous, comment.id)
            }
            onCancel={() => onReply(comment.id, getAuthorName())}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* 신고 모달 */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetId={comment.id}
        targetType="comment"
        targetContent={comment.content}
        postId={postId}
        onSuccess={() => {
          setShowReportModal(false);
          toast.success('신고가 접수되었습니다.');
        }}
      />
    </div>
  );
}

// 메인 댓글 섹션 컴포넌트
export default function CommentSection({ 
  postId, 
  initialComments,
  hasMoreComments = false,
  onCommentCountChange 
}: CommentSectionProps) {
  const { user, suspensionStatus } = useAuth();
  const { trackCreateComment, trackGiveLike } = useQuestTracker();
  const [comments, setComments] = useState<CommentWithReplies[]>(
    initialComments ? (initialComments as CommentWithReplies[]).slice(0, 10) : []
  );
  const [allComments, setAllComments] = useState<CommentWithReplies[]>(
    initialComments ? (initialComments as CommentWithReplies[]) : []
  );
  const [displayedCount, setDisplayedCount] = useState(10); // 초기 표시 개수
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAnonymousForm, setShowAnonymousForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; author: string } | null>(null);
  const [editingComment, setEditingComment] = useState<{ id: string; content: string; password?: string } | null>(null);
  const [editingAIComment, setEditingAIComment] = useState<{ id: string; content: string } | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState<{ commentId: string; action: 'edit' | 'delete' } | null>(null);
  const [likeStatuses, setLikeStatuses] = useState<Record<string, boolean>>({});
  const [showExperienceModal, setShowExperienceModal] = useState(false);
  const [experienceData, setExperienceData] = useState<{
    expGained: number;
    activityType: 'post' | 'comment' | 'like';
    leveledUp: boolean;
    oldLevel?: number;
    newLevel?: number;
    currentExp: number;
    expToNextLevel: number;
    remainingCount: number;
    totalDailyLimit: number;
    reason?: string;
  } | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // 차단된 사용자 목록 로드
  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const blockedIds = await getBlockedUserIds(user.uid);
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단된 사용자 목록 로드 실패:', error);
    }
  }, [user?.uid]);

  // 댓글 목록 로드
  const fetchComments = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedComments = await getCommentsByPost(postId);
      
      // 전체 댓글 저장
      setAllComments(fetchedComments);
      
      // 초기에는 10개만 표시 (페이지네이션)
      setComments(fetchedComments.slice(0, displayedCount));
      
      // 좋아요 상태 확인
      if (user && fetchedComments.length > 0) {
        const allCommentIds = fetchedComments.flatMap(comment => [
          comment.id,
          ...(comment.replies || []).map((reply: Comment) => reply.id)
        ]);
        
        const statuses = await checkMultipleCommentLikeStatus(postId, allCommentIds, user.uid);
        setLikeStatuses(statuses);
      }
      
      // 실제 댓글 수 계산 (부모 댓글 + 모든 대댓글)
      const totalCommentCount = fetchedComments.reduce((count, comment) => {
        return count + 1 + (comment.replies?.length || 0);
      }, 0);
      
      onCommentCountChange?.(totalCommentCount);
    } catch (error) {
      console.error('댓글 조회 실패:', error);
      toast('댓글을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [postId, user, onCommentCountChange, displayedCount]);

  // 컴포넌트 마운트 시 댓글 및 차단 사용자 목록 로드
  // initialComments가 서버에서 전달된 경우 초기 fetch 스킵
  // 단, SSR에서 댓글을 일부만 내려보낸 경우(hasMoreComments) 백그라운드에서 전체 로드
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!initialComments || initialComments.length === 0) {
      fetchComments();
    } else if (hasMoreComments) {
      // SSR에서 일부만 내려온 경우 백그라운드에서 나머지 로드
      fetchComments();
    }
    loadBlockedUsers();
  }, []); // 마운트 시 1회만 실행

  // user가 로드된 후 initialComments 기반으로 좋아요 상태만 확인
  useEffect(() => {
    if (!user || !initialComments || initialComments.length === 0) return;
    const allCommentIds = initialComments.flatMap((comment: Comment) => [
      comment.id,
      ...((comment as any).replies || []).map((reply: Comment) => reply.id)
    ]);
    if (allCommentIds.length === 0) return;
    checkMultipleCommentLikeStatus(postId, allCommentIds, user.uid)
      .then(setLikeStatuses)
      .catch(() => {});
  }, [user?.uid]);

  // 차단 해제 시 상태 업데이트
  const handleUnblock = (userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  };

  // 경험치 모달 닫기 핸들러
  const handleExperienceModalClose = () => {
    setShowExperienceModal(false);
    setExperienceData(null);
  };

  // 중복 제출 방지를 위한 ref
  const isSubmittingRef = useRef(false);

  // 일반 댓글 작성 (로그인 사용자)
  const handleCreateComment = async (content: string, isAnonymous: boolean, parentId?: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    // 정지된 사용자 차단
    if (suspensionStatus?.isSuspended) {
      const message = suspensionStatus.isPermanent
        ? "계정이 영구 정지되어 댓글을 작성할 수 없습니다."
        : `계정이 정지되어 댓글을 작성할 수 없습니다. (남은 기간: ${suspensionStatus.remainingDays}일)`;
      toast.error(message);
      return;
    }

    // 중복 제출 방지
    if (isSubmittingRef.current || isSubmitting) {
      console.log('중복 제출 차단됨');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await createCommentAPI(postId, content, user.uid, isAnonymous, parentId);

      // 경험치 지급
      let showedExpModal = false;
      if (user) {
        try {
          const expResult = await awardCommentExperience(user.uid);
          if (expResult.success) {
            setExperienceData({
              expGained: expResult.expGained,
              activityType: 'comment',
              leveledUp: expResult.leveledUp,
              oldLevel: expResult.oldLevel,
              newLevel: expResult.newLevel,
              currentExp: expResult.currentExp,
              expToNextLevel: expResult.expToNextLevel,
              remainingCount: expResult.remainingCount,
              totalDailyLimit: expResult.totalDailyLimit,
              reason: expResult.reason
            });
            setShowExperienceModal(true);
            showedExpModal = true;
          }
        } catch (expError) {
          console.error('경험치 지급 오류:', expError);
        }
      }

      // 퀘스트 트래킹: 댓글 작성 (5단계)
      await trackCreateComment();
      
      // 경험치 모달이 표시되지 않은 경우에만 toast 표시
      if (!showedExpModal) {
        toast.success('댓글이 작성되었습니다.');
      }
      setReplyingTo(null);
      
      // 즉시 카운트 업데이트 (정확한 댓글 수 계산)
      onCommentCountChange?.(comments.reduce((count, comment) => {
        return count + 1 + (comment.replies?.length || 0);
      }, 0) + 1);
      
      fetchComments();
    } catch (error) {
      console.error('댓글 작성 오류:', error);
      toast.error('댓글 작성에 실패했습니다.');
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // 익명 댓글 작성용 ref (별도 관리)
  const isAnonymousSubmittingRef = useRef(false);

  // 익명 댓글 작성 (비로그인 사용자)
  const handleCreateAnonymousComment = async (data: {
    nickname: string;
    password: string;
    content: string;
  }) => {
    // 중복 제출 방지
    if (isAnonymousSubmittingRef.current || isSubmitting) {
      console.log('중복 제출 차단됨');
      return;
    }

    isAnonymousSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const ipAddress = await getClientIP();
      
      await createAnonymousComment({
        postId,
        content: data.content,
        nickname: data.nickname,
        password: data.password,
        parentId: replyingTo?.id || null,
        ipAddress: ipAddress || undefined,
      });

      toast.success('익명 댓글이 작성되었습니다.');
      setShowAnonymousForm(false);
      setReplyingTo(null);
      
      // 즉시 카운트 업데이트 (UI 반응성 향상)
      onCommentCountChange?.(comments.reduce((count, comment) => {
        return count + 1 + (comment.replies?.length || 0);
      }, 0) + 1);
      
      fetchComments();
    } catch (error) {
      console.error('익명 댓글 작성 오류:', error);
      toast.error('댓글 작성에 실패했습니다.');
    } finally {
      isAnonymousSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // 댓글 수정
  const handleEditComment = async (commentId: string, content: string) => {
    try {
      await updateComment(postId, commentId, content, user?.uid || '');
      toast.success('댓글이 수정되었습니다.');
      fetchComments();
    } catch (error) {
      console.error('댓글 수정 오류:', error);
      toast.error('댓글 수정에 실패했습니다.');
    }
  };

  // AI 댓글 수정 시작 (관리자 전용)
  const handleStartEditAIComment = (comment: Comment) => {
    if (!canEditAIComment(user?.email, comment)) {
      toast.error('AI 댓글 수정 권한이 없습니다.');
      return;
    }
    setEditingAIComment({ id: comment.id, content: comment.content });
  };

  // AI 댓글 내용 변경
  const handleAICommentContentChange = (content: string) => {
    if (editingAIComment) {
      setEditingAIComment({ ...editingAIComment, content });
    }
  };

  // AI 댓글 수정 저장 (관리자 전용)
  const handleSaveAIComment = async () => {
    if (!editingAIComment) return;
    
    if (!editingAIComment.content.trim()) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }

    if (editingAIComment.content.length > 500) {
      toast.error('댓글은 500자 이하로 작성해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/comments?id=${editingAIComment.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editingAIComment.content.trim()
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('AI 댓글이 수정되었습니다.');
        setEditingAIComment(null);
        fetchComments(); // 댓글 목록 새로고침
      } else {
        throw new Error(result.error || 'AI 댓글 수정 실패');
      }
    } catch (error) {
      console.error('AI 댓글 수정 오류:', error);
      toast.error('AI 댓글 수정 중 오류가 발생했습니다.');
    }
  };

  // AI 댓글 수정 취소
  const handleCancelAIComment = () => {
    setEditingAIComment(null);
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('정말로 이 댓글을 삭제하시겠습니까?')) return;

    try {
      const result = await deleteComment(postId, commentId, user?.uid || '');
      
      // 즉시 카운트 업데이트 (대댓글이 없는 경우에만)
      if (!result.hasReplies) {
        onCommentCountChange?.(Math.max(0, comments.length - 1));
      }
      
      toast.success('댓글이 삭제되었습니다.');
      fetchComments();
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      toast.error('댓글 삭제에 실패했습니다.');
    }
  };

  // 익명 댓글 수정
  const handleAnonymousEdit = (commentId: string) => {
    // 비밀번호 확인 모달만 열고, 편집 상태는 비밀번호 확인 후에 설정
    setShowPasswordModal({ commentId, action: 'edit' });
  };

  // 익명 댓글 삭제
  const handleAnonymousDelete = (commentId: string) => {
    setShowPasswordModal({ commentId, action: 'delete' });
  };

  // 비밀번호 확인 후 익명 댓글 수정/삭제
  const handlePasswordConfirm = async (password: string): Promise<boolean> => {
    try {
      const { commentId, action } = showPasswordModal || {};
      
      if (!commentId) return false; // 모달가 열려있지 않으면 처리하지 않음

      if (action === 'edit') {
        // 비밀번호 검증만 하고 실제 수정은 나중에
        const isValidPassword = await verifyAnonymousCommentPassword(postId, commentId, password);
        if (!isValidPassword) {
          return false;
        }
        
        // 수정 모드 활성화 (비밀번호도 함께 저장)
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
          setEditingComment({ id: commentId, content: comment.content, password });
        }
        return true;
      } else if (action === 'delete') {
        await deleteAnonymousComment(postId, commentId, password);
        toast.success('댓글이 삭제되었습니다.');
        
        // 즉시 카운트 업데이트 (추정치로 먼저 감소)
        onCommentCountChange?.(Math.max(0, comments.reduce((count, comment) => {
          return count + 1 + (comment.replies?.length || 0);
        }, 0) - 1));
        
        fetchComments();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('익명 댓글 작업 오류:', error);
      if (error instanceof Error && error.message.includes('비밀번호')) {
        return false; // 비밀번호 오류는 모달에서 처리
      }
      toast.error('작업에 실패했습니다.');
      return false;
    }
  };

  // 댓글 좋아요
  const handleLikeComment = async (commentId: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    
    try {
      const result = await toggleCommentLike(postId, commentId, user.uid);
      
      // 좋아요 상태 즉시 업데이트
      setLikeStatuses(prev => ({
        ...prev,
        [commentId]: result.liked
      }));
      
      // 댓글 좋아요 수 업데이트
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            stats: {
              ...(comment.stats || { likeCount: 0, replyCount: 0 }),
              likeCount: result.likeCount
            }
          };
        }
        // 대댓글 확인
        if (comment.replies) {
          const updatedReplies = comment.replies.map(reply => {
            if (reply.id === commentId) {
              return {
                ...reply,
                stats: {
                  ...(reply.stats || { likeCount: 0, replyCount: 0 }),
                  likeCount: result.likeCount
                }
              };
            }
            return reply;
          });
          return {
            ...comment,
            replies: updatedReplies
          };
        }
        return comment;
      }));
      
      // 퀘스트 트래킹: 좋아요 (6단계) - 좋아요 추가 시에만
      if (result.liked) {
        await trackGiveLike();
      }
      
      toast.success(result.liked ? '댓글에 좋아요를 눌렀습니다.' : '댓글 좋아요를 취소했습니다.');
    } catch (error) {
      console.error('댓글 좋아요 오류:', error);
      toast.error('댓글 좋아요 처리 중 오류가 발생했습니다.');
    }
  };

  // 답글 작성 모드 토글
  const handleReply = (parentId: string, parentAuthor: string) => {
    setReplyingTo(replyingTo?.id === parentId ? null : { id: parentId, author: parentAuthor });
  };

  // 익명 댓글 수정 내용 변경
  const handleEditingCommentChange = (content: string) => {
    setEditingComment(prev => prev ? { ...prev, content } : null);
  };

  // 익명 댓글 수정 저장
  const handleEditingCommentSave = async () => {
    if (!editingComment?.password) return;
    
    try {
      await updateAnonymousComment(postId, editingComment.id, editingComment.content, editingComment.password);
      toast.success('댓글이 수정되었습니다.');
      setEditingComment(null);
      fetchComments();
    } catch (error) {
      console.error('익명 댓글 수정 오류:', error);
      toast.error('댓글 수정에 실패했습니다.');
    }
  };

  // 익명 댓글 수정 취소
  const handleEditingCommentCancel = () => {
    setEditingComment(null);
  };

  return (
    <div className="px-2 md:px-4 py-4 space-y-6">
      <div className="space-y-6">
        {/* 댓글 작성 폼 */}
        {user ? (
          suspensionStatus?.isSuspended ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">
                {suspensionStatus.isPermanent
                  ? "계정이 영구 정지되어 댓글을 작성할 수 없습니다."
                  : `계정이 정지되어 댓글을 작성할 수 없습니다. (남은 기간: ${suspensionStatus.remainingDays}일)`
                }
              </p>
              <p className="text-red-600 text-xs mt-1">
                사유: {suspensionStatus.reason || '정책 위반'}
              </p>
            </div>
          ) : (
            <CommentForm
              onSubmit={(content, isAnonymous) => 
                handleCreateComment(content, isAnonymous)
              }
              isSubmitting={isSubmitting}
            />
          )
        ) : !showAnonymousForm ? (
          <div className="space-y-3">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-3">
                로그인하지 않아도 익명으로 댓글을 작성할 수 있습니다.
              </p>
              <Button
                onClick={() => setShowAnonymousForm(true)}
                className="bg-green-500 hover:bg-green-600"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                익명 댓글 작성
              </Button>
            </div>
          </div>
        ) : (
          <AnonymousCommentForm
            onSubmit={handleCreateAnonymousComment}
            onCancel={() => setShowAnonymousForm(false)}
            isSubmitting={isSubmitting}
          />
        )}

        {/* 댓글 목록 */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-500">아직 댓글이 없습니다.</p>
            <p className="text-sm text-slate-400">첫 번째 댓글을 작성해보세요!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment: CommentWithReplies) => {
              const isBlocked = comment.authorId && blockedUserIds.has(comment.authorId);
              
              if (isBlocked && comment.authorId) {
                return (
                  <BlockedUserContent
                    key={comment.id}
                    blockedUserId={comment.authorId}
                    blockedUserName={comment.author?.displayName || '사용자'}
                    contentType="comment"
                    onUnblock={() => handleUnblock(comment.authorId!)}
                  >
                    <div className="group">
                      <CommentItem
                        comment={comment}
                        postId={postId}
                        onReply={handleReply}
                        onEdit={handleEditComment}
                        onDelete={handleDeleteComment}
                        onLike={handleLikeComment}
                        onAnonymousEdit={handleAnonymousEdit}
                        onAnonymousDelete={handleAnonymousDelete}
                        editingComment={editingComment}
                        onEditingCommentChange={handleEditingCommentChange}
                        onEditingCommentSave={handleEditingCommentSave}
                        onEditingCommentCancel={handleEditingCommentCancel}
                        editingAIComment={editingAIComment}
                        onStartEditAIComment={handleStartEditAIComment}
                        onSaveAIComment={handleSaveAIComment}
                        onCancelAIComment={handleCancelAIComment}
                        onAICommentContentChange={handleAICommentContentChange}
                        isLiked={likeStatuses[comment.id] || false}
                        replyingTo={replyingTo}
                        onCommentSubmit={handleCreateComment}
                        isSubmitting={isSubmitting}
                      />
                      
                      {/* 대댓글 렌더링 */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="ml-8 mt-4 space-y-4">
                          {comment.replies.map((reply: CommentWithReplies) => {
                            const isReplyBlocked = reply.authorId && blockedUserIds.has(reply.authorId);
                            
                            if (isReplyBlocked && reply.authorId) {
                              return (
                                <BlockedUserContent
                                  key={reply.id}
                                  blockedUserId={reply.authorId}
                                  blockedUserName={reply.author?.displayName || '사용자'}
                                  contentType="comment"
                                  onUnblock={() => handleUnblock(reply.authorId!)}
                                >
                                  <CommentItem
                                    comment={reply}
                                    postId={postId}
                                    onReply={handleReply}
                                    onEdit={handleEditComment}
                                    onDelete={handleDeleteComment}
                                    onLike={handleLikeComment}
                                    onAnonymousEdit={handleAnonymousEdit}
                                    onAnonymousDelete={handleAnonymousDelete}
                                    editingComment={editingComment}
                                    onEditingCommentChange={handleEditingCommentChange}
                                    onEditingCommentSave={handleEditingCommentSave}
                                    onEditingCommentCancel={handleEditingCommentCancel}
                                    editingAIComment={editingAIComment}
                                    onStartEditAIComment={handleStartEditAIComment}
                                    onSaveAIComment={handleSaveAIComment}
                                    onCancelAIComment={handleCancelAIComment}
                                    onAICommentContentChange={handleAICommentContentChange}
                                    isLiked={likeStatuses[reply.id] || false}
                                    level={1}
                                    replyingTo={replyingTo}
                                    onCommentSubmit={handleCreateComment}
                                    isSubmitting={isSubmitting}
                                  />
                                </BlockedUserContent>
                              );
                            }
                            
                            return (
                              <CommentItem
                                key={reply.id}
                                comment={reply}
                                postId={postId}
                                onReply={handleReply}
                                onEdit={handleEditComment}
                                onDelete={handleDeleteComment}
                                onLike={handleLikeComment}
                                onAnonymousEdit={handleAnonymousEdit}
                                onAnonymousDelete={handleAnonymousDelete}
                                editingComment={editingComment}
                                onEditingCommentChange={handleEditingCommentChange}
                                onEditingCommentSave={handleEditingCommentSave}
                                onEditingCommentCancel={handleEditingCommentCancel}
                                editingAIComment={editingAIComment}
                                onStartEditAIComment={handleStartEditAIComment}
                                onSaveAIComment={handleSaveAIComment}
                                onCancelAIComment={handleCancelAIComment}
                                onAICommentContentChange={handleAICommentContentChange}
                                isLiked={likeStatuses[reply.id] || false}
                                level={1}
                                replyingTo={replyingTo}
                                onCommentSubmit={handleCreateComment}
                                isSubmitting={isSubmitting}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </BlockedUserContent>
                );
              }
              
              return (
                <div key={comment.id} className="group">
                  <CommentItem
                    comment={comment}
                    postId={postId}
                    onReply={handleReply}
                    onEdit={handleEditComment}
                    onDelete={handleDeleteComment}
                    onLike={handleLikeComment}
                    onAnonymousEdit={handleAnonymousEdit}
                    onAnonymousDelete={handleAnonymousDelete}
                    editingComment={editingComment}
                    onEditingCommentChange={handleEditingCommentChange}
                    onEditingCommentSave={handleEditingCommentSave}
                    onEditingCommentCancel={handleEditingCommentCancel}
                    editingAIComment={editingAIComment}
                    onStartEditAIComment={handleStartEditAIComment}
                    onSaveAIComment={handleSaveAIComment}
                    onCancelAIComment={handleCancelAIComment}
                    onAICommentContentChange={handleAICommentContentChange}
                    isLiked={likeStatuses[comment.id] || false}
                    replyingTo={replyingTo}
                    onCommentSubmit={handleCreateComment}
                    isSubmitting={isSubmitting}
                  />
                  
                  {/* 대댓글 렌더링 */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-8 mt-4 space-y-4">
                      {comment.replies.map((reply: CommentWithReplies) => {
                        const isReplyBlocked = reply.authorId && blockedUserIds.has(reply.authorId);
                        
                        if (isReplyBlocked && reply.authorId) {
                          return (
                            <BlockedUserContent
                              key={reply.id}
                              blockedUserId={reply.authorId}
                              blockedUserName={reply.author?.displayName || '사용자'}
                              contentType="comment"
                              onUnblock={() => handleUnblock(reply.authorId!)}
                            >
                              <CommentItem
                                comment={reply}
                                postId={postId}
                                onReply={handleReply}
                                onEdit={handleEditComment}
                                onDelete={handleDeleteComment}
                                onLike={handleLikeComment}
                                onAnonymousEdit={handleAnonymousEdit}
                                onAnonymousDelete={handleAnonymousDelete}
                                editingComment={editingComment}
                                onEditingCommentChange={handleEditingCommentChange}
                                onEditingCommentSave={handleEditingCommentSave}
                                onEditingCommentCancel={handleEditingCommentCancel}
                                editingAIComment={editingAIComment}
                                onStartEditAIComment={handleStartEditAIComment}
                                onSaveAIComment={handleSaveAIComment}
                                onCancelAIComment={handleCancelAIComment}
                                onAICommentContentChange={handleAICommentContentChange}
                                isLiked={likeStatuses[reply.id] || false}
                                level={1}
                                replyingTo={replyingTo}
                                onCommentSubmit={handleCreateComment}
                                isSubmitting={isSubmitting}
                              />
                            </BlockedUserContent>
                          );
                        }
                        
                        return (
                          <CommentItem
                            key={reply.id}
                            comment={reply}
                            postId={postId}
                            onReply={handleReply}
                            onEdit={handleEditComment}
                            onDelete={handleDeleteComment}
                            onLike={handleLikeComment}
                            onAnonymousEdit={handleAnonymousEdit}
                            onAnonymousDelete={handleAnonymousDelete}
                            editingComment={editingComment}
                            onEditingCommentChange={handleEditingCommentChange}
                            onEditingCommentSave={handleEditingCommentSave}
                            onEditingCommentCancel={handleEditingCommentCancel}
                            editingAIComment={editingAIComment}
                            onStartEditAIComment={handleStartEditAIComment}
                            onSaveAIComment={handleSaveAIComment}
                            onCancelAIComment={handleCancelAIComment}
                            onAICommentContentChange={handleAICommentContentChange}
                            isLiked={likeStatuses[reply.id] || false}
                            level={1}
                            replyingTo={replyingTo}
                            onCommentSubmit={handleCreateComment}
                            isSubmitting={isSubmitting}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 댓글 더보기 버튼 */}
            {allComments.length > displayedCount && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newCount = displayedCount + 10;
                    setDisplayedCount(newCount);
                    setComments(allComments.slice(0, newCount));
                  }}
                  className="border-green-200 text-green-700 hover:bg-green-50"
                >
                  댓글 더보기 ({allComments.length - displayedCount}개 남음)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 익명 댓글 비밀번호 확인 모달 */}
      <AnonymousPasswordModal
        isOpen={!!showPasswordModal}
        onClose={() => {
          setShowPasswordModal(null);
          // 삭제 작업일 때만 편집 상태 초기화, 수정 작업일 때는 유지
          if (showPasswordModal?.action === 'delete') {
            setEditingComment(null);
          }
        }}
        onConfirm={handlePasswordConfirm}
        title={showPasswordModal?.action === 'edit' ? '댓글 수정' : '댓글 삭제'}
        description={
          showPasswordModal?.action === 'edit' 
            ? '댓글을 수정하려면 작성 시 입력한 비밀번호를 입력해주세요.'
            : '댓글을 삭제하려면 작성 시 입력한 비밀번호를 입력해주세요.'
        }
        isLoading={isSubmitting}
      />

      {/* 경험치 획득 모달 */}
      {showExperienceModal && experienceData && (
        <ExperienceModal
          isOpen={showExperienceModal}
          onClose={handleExperienceModalClose}
          data={experienceData}
        />
      )}
    </div>
  );
} 