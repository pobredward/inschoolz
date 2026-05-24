'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePostCacheStore } from '@/store/postCacheStore';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Bookmark, 
  ArrowLeft,
  Eye,
  Clock,
  Edit,
  Trash2,
  MoreVertical,
  Flag,
  BarChart3,
  ShieldOff
} from 'lucide-react';
import { Post, Comment, Board } from '@/types';
import { ReportModal } from '@/components/ui/report-modal';
import { useAuth } from '@/providers/AuthProvider';
import { useQuestTracker } from '@/hooks/useQuestTracker';
import { 
  togglePostScrap,
  checkLikeStatus,
  checkScrapStatus,
  incrementPostViewCount
} from '@/lib/api/board';
import {
  deletePost,
  toggleLikePost
} from '@/lib/api/boards';
import { toggleBlock, checkBlockStatus } from '@/lib/api/users';
import { toast } from 'react-hot-toast';
import CommentSection from './CommentSection';
import { formatAbsoluteTime } from '@/lib/utils';
import { HtmlContent } from '@/components/ui/html-content';
import { PollVoting } from '@/components/ui/poll-voting';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PostUserState {
  isLiked: boolean;
  isScrapped: boolean;
  isBlocked: boolean;
}

interface PostViewClientProps {
  post: Post;
  initialComments: Comment[];
  hasMoreComments?: boolean;
  sanitizedContent?: string;
  initialUserState?: PostUserState;
}

export const PostViewClient = ({ post: serverPost, initialComments, hasMoreComments = false, sanitizedContent, initialUserState }: PostViewClientProps) => {
  const router = useRouter();
  const { user } = useAuth();
  const { trackGiveLike } = useQuestTracker();
  const { getPost } = usePostCacheStore();
  
  // 캐시된 데이터 확인 (즉시 표시용)
  const cachedData = getPost(serverPost.id);
  const initialPost = cachedData?.post || serverPost;
  
  const [post, setPost] = useState<Post>(initialPost);
  const [isLiked, setIsLiked] = useState(initialUserState?.isLiked ?? false);
  const [isScrapped, setIsScrapped] = useState(initialUserState?.isScrapped ?? false);
  const [likeCount, setLikeCount] = useState(initialPost.stats.likeCount);
  const [scrapCount, setScrapCount] = useState(initialPost.stats.scrapCount || 0);
  const [commentCount, setCommentCount] = useState(initialPost.stats.commentCount);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [boardInfo, setBoardInfo] = useState<Board | null>(cachedData?.board || null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [isUserBlocked, setIsUserBlocked] = useState(initialUserState?.isBlocked ?? false);
  
  // 서버 데이터가 도착하면 최신 데이터로 업데이트
  useEffect(() => {
    if (serverPost && serverPost.id === post.id) {
      setPost(serverPost);
      setLikeCount(serverPost.stats.likeCount);
      setScrapCount(serverPost.stats.scrapCount || 0);
      setCommentCount(serverPost.stats.commentCount);
    }
  }, [serverPost]);

    useEffect(() => {
    // 조회수 증가 (백그라운드에서 처리, 실패해도 무시)
    incrementPostViewCount(post.id).catch(() => {
      // 조회수 증가 실패는 무시 (사용자 경험에 영향 없음)
    });
    
    // 게시글 상세 페이지에 진입했음을 표시
    sessionStorage.setItem('from-post-detail', 'true');
  }, [post.id]);

  // 사용자 관련 상태 — 서버에서 initialUserState를 받은 경우 클라이언트 읽기 스킵
  useEffect(() => {
    if (!user) return;
    if (initialUserState) return; // 서버 SSR 상태가 있으면 재조회 불필요
    
    const checkStatuses = async () => {
      try {
        const [likeStatus, scrapStatus, blockStatus] = await Promise.all([
          checkLikeStatus(post.id, user.uid),
          checkScrapStatus(post.id, user.uid),
          post.authorId ? checkBlockStatus(user.uid, post.authorId) : Promise.resolve(false)
        ]);
        setIsLiked(likeStatus);
        setIsScrapped(scrapStatus);
        setIsUserBlocked(blockStatus);
      } catch (error) {
        console.error('상태 확인 실패:', error);
      }
    };
    
    checkStatuses();
  }, [user, post.id, post.authorId, initialUserState]);

  // board 정보는 서버에서 이미 제공되므로 클라이언트에서 별도 로딩 불필요
  // useEffect(() => {
  //   const fetchBoardInfo = async () => {
  //     try {
  //       const boards = await getBoardsByType(post.type);
  //       const board = (boards as Board[]).find((b: Board) => b.code === post.boardCode);
  //       setBoardInfo(board || null);
  //     } catch (error) {
  //       console.error('Board 정보 가져오기 실패:', error);
  //     }
  //   };
  //   
  //   // 약간의 지연을 두고 로딩 (다른 중요한 렌더링 완료 후)
  //   const timer = setTimeout(fetchBoardInfo, 100);
  //   return () => clearTimeout(timer);
  // }, [post.type, post.boardCode]);

  const handleLike = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      const result = await toggleLikePost(post.id, user.uid);
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
      
      // 퀘스트 트래킹: 좋아요 (6단계) - 좋아요 추가 시에만
      if (result.liked) {
        await trackGiveLike();
      }
      
      toast.success(result.liked ? '좋아요를 눌렀습니다.' : '좋아요를 취소했습니다.');
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
      toast.error('좋아요 처리에 실패했습니다.');
    }
  };

  const handleScrap = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      const result = await togglePostScrap(post.id, user.uid);
      setIsScrapped(result.scrapped);
      setScrapCount(result.scrapCount);
      toast.success(result.scrapped ? '스크랩에 추가했습니다.' : '스크랩을 해제했습니다.');
    } catch (error) {
      console.error('스크랩 처리 실패:', error);
      toast.error('스크랩 처리에 실패했습니다.');
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.content.substring(0, 100) + '...',
          url: window.location.href,
        });
      } else {
        // Web Share API를 지원하지 않는 경우 클립보드에 복사
        await navigator.clipboard.writeText(window.location.href);
        toast.success('링크가 클립보드에 복사되었습니다.');
      }
    } catch (error) {
      console.error('공유 실패:', error);
      toast.error('공유에 실패했습니다.');
    }
  };

  const handleCommentCountChange = (count: number) => {
    setCommentCount(count);
  };

  const handleEdit = () => {
    // 관리자이거나 작성자인 경우에만 수정 가능
    const isAdmin = user?.role === 'admin';
    const isAuthorUser = user && user.uid === post.authorId;
    
    if (!user || (!isAdmin && !isAuthorUser)) {
      toast.error('수정 권한이 없습니다.');
      return;
    }

    // 게시판 타입에 따라 적절한 community 수정 경로로 라우팅
    let editPath = '';
    switch (post.type) {
      case 'national':
        editPath = `/community/national/${post.boardCode}/edit/${post.id}`;
        break;
      case 'regional':
        // 지역 게시판의 경우 사용자의 지역 정보 필요
        if (user.regions) {
          editPath = `/community/region/${encodeURIComponent(user.regions.sido)}/${encodeURIComponent(user.regions.sigungu)}/${post.boardCode}/edit/${post.id}`;
        } else {
          toast.error('지역 정보가 없습니다.');
          return;
        }
        break;
      case 'school':
        // 학교 게시판의 경우 게시글에 저장된 schoolId 사용 (타입 단언 필요)
        const schoolPostId = (post as any)?.schoolId || user.school?.id;
        if (schoolPostId) {
          editPath = `/community/school/${schoolPostId}/${post.boardCode}/edit/${post.id}`;
        } else {
          toast.error('학교 정보가 없습니다.');
          return;
        }
        break;
      default:
        toast.error('잘못된 게시판 타입입니다.');
        return;
    }

    router.push(editPath);
  };

  // 게시글 삭제
  const handleDelete = async () => {
    // 관리자이거나 작성자인 경우에만 삭제 가능
    const isAdmin = user?.role === 'admin';
    const isAuthorUser = user && user.uid === post.authorId;
    
    if (!user || (!isAdmin && !isAuthorUser)) {
      toast.error('삭제 권한이 없습니다.');
      return;
    }

    setIsDeleting(true);
    try {
      await deletePost(post.id, user.uid);
      toast.success('게시글이 삭제되었습니다.');
      
      // 게시판 타입에 따라 적절한 community 경로로 라우팅
      let redirectPath = '';
      switch (post.type) {
        case 'national':
          redirectPath = `/community?tab=national`;
          break;
        case 'regional':
          redirectPath = `/community?tab=regional`;
          break;
        case 'school':
          redirectPath = `/community?tab=school`;
          break;
        default:
          redirectPath = `/community`;
      }
      
      router.push(redirectPath);
    } catch (error) {
      console.error('게시글 삭제 실패:', error);
      toast.error('게시글 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleBlockClick = () => {
    if (!user || !post.authorId) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (post.authorId === user.uid) {
      toast.error('자기 자신을 차단할 수 없습니다.');
      return;
    }

    setShowBlockDialog(true);
  };

  const handleBlockConfirm = async () => {
    if (!user || !post.authorId) return;

    setIsBlocking(true);
    try {
      const result = await toggleBlock(user.uid, post.authorId);
      toast.success(result.isBlocked ? '사용자를 차단했습니다.' : '차단을 해제했습니다.');
      setIsUserBlocked(result.isBlocked);
      setShowBlockDialog(false);
    } catch (error) {
      console.error('차단 처리 실패:', error);
      toast.error('차단 처리에 실패했습니다.');
    } finally {
      setIsBlocking(false);
    }
  };

  // 작성자 또는 관리자 확인
  const isAdmin = user?.role === 'admin';
  const isAuthor = user && (user.uid === post.authorId || isAdmin);

  // 게시판 타입에 따른 표시명 가져오기
  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'national':
        return '전국';
      case 'regional':
        return '지역';
      case 'school':
        return '학교';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-none md:max-w-5xl mx-auto md:py-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4 px-3 py-2 md:px-0 md:py-4 bg-white md:bg-transparent border-b md:border-b-0 md:mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="flex items-center gap-2 -ml-1 md:ml-0 min-h-touch"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">뒤로가기</span>
          </Button>
        </div>

        {/* 게시글 컨텐츠 */}
        <div className="bg-white md:rounded-lg md:border md:shadow-sm space-y-3 px-3 py-3 md:px-8 md:py-8 overflow-hidden break-words">
                  {/* 게시판 정보 배지 - 맨 위 왼쪽 */}
          <div className="flex items-center gap-1 mb-3 sm:mb-4">
          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
            {getBoardTypeLabel(post.type)}
          </Badge>
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            {post.boardName || post.boardCode}
          </Badge>
          {post.attachments && post.attachments.length > 0 && (
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-0.5 h-5 text-xs bg-orange-50 text-orange-700 border-orange-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              사진 {post.attachments.filter(att => att.type === 'image').length}
            </Badge>
          )}
          {post.poll && (
            <Badge variant="outline" className="flex items-center gap-1 px-2 py-0.5 h-5 text-xs bg-purple-50 text-purple-700 border-purple-200">
              <BarChart3 className="h-3 w-3" />
              투표
            </Badge>
          )}
        </div>

        {/* 게시글 헤더 */}
        <div className="flex items-start justify-between mb-3 md:mb-6">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            {post.authorInfo?.isAnonymous ? (
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                  <AvatarFallback className="text-xs sm:text-sm">익명</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1">
                    <span className="font-medium text-sm sm:text-base">익명</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-slate-500 truncate">{formatAbsoluteTime(post.createdAt, 'datetime')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => router.push(`/users/${post.authorId}`)}
                className="flex items-center gap-2 sm:gap-3 hover:bg-gray-50 rounded-lg p-1 sm:p-2 -m-1 sm:-m-2 transition-colors min-w-0 min-h-touch"
              >
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                  {post.authorInfo?.profileImageUrl ? (
                    <AvatarImage
                      src={post.authorInfo.profileImageUrl}
                      alt={post.authorInfo.displayName || '프로필'}
                    />
                  ) : null}
                  <AvatarFallback className="text-xs sm:text-sm">
                    {post.authorInfo?.displayName?.substring(0, 2) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-1 sm:gap-2 mb-1">
                    <span className="font-medium hover:text-blue-600 transition-colors text-sm sm:text-base truncate">
                      {post.authorInfo?.displayName || '사용자'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-slate-500 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-slate-500 truncate">{formatAbsoluteTime(post.createdAt, 'datetime')}</span>
                  </div>
                </div>
              </button>
            )}
          </div>
          
          {/* 게시글 메뉴 - 오른쪽 위 모서리 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              side="bottom" 
              sideOffset={5}
              alignOffset={0}
              className="z-50 min-w-[120px]"
              avoidCollisions={true}
              collisionPadding={8}
              sticky="always"
            >
              {isAuthor ? (
                <>
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    수정
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem 
                    onClick={() => setShowReportModal(true)}
                    className="text-red-600"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    신고
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleBlockClick}
                    disabled={isBlocking}
                    className="text-orange-600"
                  >
                    <ShieldOff className="h-4 w-4 mr-2" />
                    {isBlocking ? '처리 중...' : (isUserBlocked ? '차단 해제하기' : '차단하기')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 게시글 제목 */}
        <h1 className="text-lg md:text-2xl font-bold mb-3 md:mb-4 leading-tight break-words overflow-wrap-anywhere" 
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {post.title}
        </h1>

        {/* 게시글 내용 */}
        <div className="mb-4 md:mb-6 text-sm md:text-base leading-relaxed">
          {sanitizedContent !== undefined ? (
            <div
              className="prose prose-sm max-w-none whitespace-pre-wrap break-words overflow-wrap-anywhere"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'IMG') {
                  window.open((target as HTMLImageElement).src, '_blank');
                }
              }}
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            />
          ) : (
            <HtmlContent content={post.content} />
          )}
        </div>

        {/* 투표 */}
        {post.poll && (
          <div className="mb-4 sm:mb-6">
            <PollVoting 
              poll={post.poll} 
              postId={post.id}
              onVoteUpdate={(updatedPoll) => {
                // 투표 업데이트 시 필요한 로직 (필요시 구현)
              }}
            />
          </div>
        )}

        {/* 태그 */}
        {post.tags && post.tags.length > 0 && (
          <div className="mb-4 sm:mb-6">
            <div className="flex flex-wrap gap-1 sm:gap-2">
              {post.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 조회수, 좋아요, 댓글 수와 액션 버튼들 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-0 text-sm text-slate-500 mb-4 md:mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span className="text-sm">{post.stats.viewCount || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">{commentCount}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLike}
              className={`flex items-center gap-1 h-9 px-3 md:h-10 md:px-4 min-h-touch ${isLiked ? 'text-red-500' : 'text-slate-500'}`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-sm">좋아요</span>
              <span className="text-sm ml-1">{likeCount}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleScrap}
              className={`flex items-center gap-1 h-9 px-3 md:h-10 md:px-4 min-h-touch ${isScrapped ? 'text-blue-500' : 'text-slate-500'}`}
            >
              <Bookmark className={`h-4 w-4 ${isScrapped ? 'fill-current' : ''}`} />
              <span className="text-sm">스크랩</span>
              <span className="text-sm ml-1">{scrapCount}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleShare}
              className="flex items-center gap-1 h-9 px-3 md:h-10 md:px-4 min-h-touch text-slate-500"
              title="게시글 공유하기"
            >
              <Share2 className="h-4 w-4" />
              <span className="text-sm">공유</span>
            </Button>
          </div>
        </div>

        <Separator className="my-4 md:my-6" />
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-white md:rounded-lg md:border md:shadow-sm md:mt-4">
          <CommentSection 
            postId={post.id} 
            initialComments={initialComments}
            hasMoreComments={hasMoreComments}
            onCommentCountChange={handleCommentCountChange}
          />
        </div>

      {/* 신고 모달 */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetId={post.id}
        targetType="post"
        targetContent={JSON.stringify({ title: post.title, content: post.content })}
        onSuccess={() => {
          setShowReportModal(false);
          toast.success('신고가 접수되었습니다.');
        }}
        boardCode={post.boardCode}
        schoolId={post.schoolId}
        regions={post.regions}
      />

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>게시글 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 차단 확인 다이얼로그 */}
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isUserBlocked ? '사용자 차단 해제' : '사용자 차단'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isUserBlocked 
                ? `${post.authorInfo?.displayName || '이 사용자'}님을 차단 해제하시겠습니까?`
                : `${post.authorInfo?.displayName || '이 사용자'}님을 차단하시겠습니까?`
              }
              <br />
              {isUserBlocked 
                ? '차단 해제하면 이 사용자의 게시글과 댓글을 다시 볼 수 있습니다.'
                : '차단된 사용자의 게시글과 댓글은 "차단한 사용자입니다"로 표시됩니다.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBlockConfirm}
              disabled={isBlocking}
              className={isUserBlocked ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}
            >
              {isBlocking ? '처리 중...' : (isUserBlocked ? '차단 해제하기' : '차단하기')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}; 