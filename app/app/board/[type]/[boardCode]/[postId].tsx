import { communityCommand } from '../../../../lib/community-client';
import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  StatusBar,
  Modal,
  Linking
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Hyperlink from 'react-native-hyperlink';

const { width } = Dimensions.get('window');
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { BoardType, Post, Comment, Board } from '@/types';
import { getBoardsByType, getBoardByCode, deleteAnonymousComment, toggleCommentLike, checkMultipleCommentLikeStatus } from '@/lib/boards';
import { useAuthStore } from '@/store/authStore';
import { usePostCacheStore } from '@/store/postCacheStore';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, where, orderBy, Timestamp, updateDoc, deleteDoc, serverTimestamp, increment, limit } from 'firebase/firestore';
import AnonymousCommentForm from '../../../../components/ui/AnonymousCommentForm';
import AnonymousPasswordModal from '../../../../components/ui/AnonymousPasswordModal';
import { PollVoting } from '../../../../components/ui/PollVoting';
import { SafeProfileImage } from '../../../../components/SafeProfileImage';
// 유틸리티 함수 import
import { formatRelativeTime, formatAbsoluteTime, toTimestamp } from '../../../../utils/timeUtils';
import { BlockedUserContent } from '../../../../components/ui/BlockedUserContent';
import { checkSuspensionStatus } from '@/lib/auth/suspension-check';
import { useQuest } from '@/providers/QuestProvider';

const parseContentText = (content: string) => {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'doc' && parsed.content) {
      return extractTextFromTipTap(parsed);
    }
    return content;
  } catch {
    return content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim();
  }
};

const extractTextFromTipTap = (node: any): string => {
  if (!node || typeof node !== 'object') return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromTipTap).join('');
  }
  return '';
};

const extractAllImageUrls = (content: string): string[] => {
  if (!content) return [];
  const imageUrls: string[] = [];
  const imgTagMatches = content.matchAll(/<img[^>]+src="([^"]+)"/gi);
  for (const match of imgTagMatches) {
    imageUrls.push(match[1]);
  }
  return [...new Set(imageUrls)];
};
import HtmlRenderer from '@/components/HtmlRenderer';
import { awardCommentExperience } from '@/lib/experience-service';
import { ReportButton } from '@/components/ui/ReportButton';
import { ReportModal } from '@/components/ui/ReportModal';
import { ExperienceModal } from '@/components/ui/ExperienceModal';
import { 
  createPostCommentNotification, 
  createCommentReplyNotification 
} from '../../../../lib/notifications';

// 게시글 내용 컴포넌트 (메모이제이션으로 불필요한 리렌더링 방지)
const PostContent = React.memo(({ 
  post, 
  width, 
  styles 
}: { 
  post: Post; 
  width: number; 
  styles: any; 
}) => (
  <HtmlRenderer 
    html={post.content} 
    contentWidth={width - 32}
    baseStyle={styles.postContent}
  />
));

// 파스텔 그린 색상 팔레트
const pastelGreenColors = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
};

interface PostDetail extends Post {
  boardName: string;
}

interface CommentWithAuthor extends Comment {
  author?: {
    userName: string;
    profileImageUrl?: string;
  };
  replies?: CommentWithAuthor[];
}

interface CustomHeaderProps {
  title: string;
  onBack: () => void;
  showMenu?: boolean;
  onMenuPress?: () => void;
  insets?: { top: number; bottom: number; left: number; right: number };
}

const CustomHeader: React.FC<CustomHeaderProps> = ({ title, onBack, showMenu = false, onMenuPress, insets }) => (
  <View style={[
    styles.header,
    Platform.OS === 'android' && insets && { paddingTop: insets.top + 8 }
  ]}>
    <TouchableOpacity onPress={onBack} style={styles.headerButton}>
      <Ionicons name="arrow-back" size={20} color="#111827" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
    {showMenu ? (
      <TouchableOpacity style={styles.headerButton} onPress={onMenuPress}>
        <Ionicons name="ellipsis-vertical" size={20} color="#111827" />
      </TouchableOpacity>
    ) : (
      <View style={styles.headerButton} />
    )}
  </View>
);

export default function PostDetailScreen() {
  const router = useRouter();
  const { type, boardCode, postId } = useLocalSearchParams<{
    type: string;
    boardCode: string;
    postId: string;
  }>();
  
  const { user } = useAuthStore();
  const { trackAction } = useQuest();
  const { getPost, getBoard } = usePostCacheStore();
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [allComments, setAllComments] = useState<CommentWithAuthor[]>([]); // 전체 댓글
  const [displayedCommentsCount, setDisplayedCommentsCount] = useState(10); // 표시할 댓글 수
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [likeCount, setLikeCount] = useState(0);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // 댓글 제출 중 상태
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState<string>('');
  const [reportTargetType, setReportTargetType] = useState<'post' | 'comment'>('post');
  const [reportTargetContent, setReportTargetContent] = useState<string>('');
  const [reportPostId, setReportPostId] = useState<string>('');
  
  // 차단된 사용자 목록
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // 차단된 사용자 목록 로드
  const loadBlockedUsers = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const { getBlockedUserIds } = await import('../../../../lib/users');
      const blockedIds = await getBlockedUserIds(user.uid);
      setBlockedUserIds(new Set(blockedIds));
    } catch (error) {
      console.error('차단된 사용자 목록 로드 실패:', error);
    }
  }, [user?.uid]);

  // 차단 해제 시 상태 업데이트
  const handleUnblock = useCallback((userId: string) => {
    setBlockedUserIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(userId);
      return newSet;
    });
  }, []);

  // 익명 댓글 관련 상태
  const [showAnonymousForm, setShowAnonymousForm] = useState(false);
  
  // 비회원 댓글 작성 상태
  const [showGuestCommentForm, setShowGuestCommentForm] = useState(false);
  const [guestComment, setGuestComment] = useState('');
  const [guestNickname, setGuestNickname] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestReplyingTo, setGuestReplyingTo] = useState<{
    id: string;
    author: string;
  } | null>(null);
  const [guestReplyContent, setGuestReplyContent] = useState('');
  
  // 댓글 좋아요 상태 관리
  const [commentLikeStatuses, setCommentLikeStatuses] = useState<Record<string, boolean>>({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalData, setPasswordModalData] = useState<{
    commentId: string;
    action: 'edit' | 'delete';
  } | null>(null);
  const [editingAnonymousComment, setEditingAnonymousComment] = useState<{
    commentId: string;
    content: string;
    password: string;
  } | null>(null);

  // 회원 댓글 수정 상태
  const [editingComment, setEditingComment] = useState<{
    commentId: string;
    content: string;
  } | null>(null);

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
  
  // 좋아요/스크랩 상태
  const [isLiked, setIsLiked] = useState(false);
  const [isScrapped, setIsScrapped] = useState(false);
  const [scrapCount, setScrapCount] = useState(0);

  // 게시판 타입을 한글로 변환하는 함수
  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'national':
        return '전국';
      case 'regional':
        return '지역';
      case 'school':
        return '학교';
      default:
        return type;
    }
  };

  // 사용자 액션 상태 확인 (좋아요/북마크)
  const checkUserActions = async (postId: string, userId: string) => {
    try {
      // 좋아요 상태 확인
      const likesRef = collection(db, 'posts', postId, 'likes');
      const likeQuery = query(likesRef, where('userId', '==', userId));
      const likeSnapshot = await getDocs(likeQuery);
      setIsLiked(!likeSnapshot.empty);

      // 스크랩 상태 확인 (users 컬렉션 기반)
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const scraps = userData.scraps?.postIds || [];
        setIsScrapped(scraps.includes(postId));
      }
    } catch (error) {
      console.error('사용자 액션 상태 확인 실패:', error);
    }
  };

  // 좋아요 토글
  const handleLike = async () => {
    if (!user || !post) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const result = await communityCommand('post.like', { postId: post.id }, user.uid);
      setIsLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (error) {
      console.error('좋아요 처리 실패:', error);
      Alert.alert('오류', '좋아요 처리에 실패했습니다.');
    }
  };

  // 스크랩 토글 (새로운 API 함수 사용)
  const handleScrap = async () => {
    if (!user || !post) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const { togglePostScrap } = await import('../../../../lib/boards');
      const result = await togglePostScrap(post.id, user.uid);
      
      setIsScrapped(result.scrapped);
      setScrapCount(result.scrapCount);
      Alert.alert('알림', result.scrapped ? '스크랩에 추가했습니다.' : '스크랩을 해제했습니다.');
    } catch (error) {
      console.error('스크랩 처리 실패:', error);
      Alert.alert('오류', '스크랩 처리에 실패했습니다.');
    }
  };

  // 공유 기능 (링크 복사)
  const handleShare = async () => {
    if (!post) return;

    try {
      let shareUrl = '';
      
      // 웹 버전과 일치하는 URL 구조로 생성
      if (type === 'national') {
        shareUrl = `https://inschoolz.com/community/national/${boardCode}/${post.id}`;
      } else if (type === 'regional' && post.regions) {
        shareUrl = `https://inschoolz.com/community/region/${encodeURIComponent(post.regions.sido)}/${encodeURIComponent(post.regions.sigungu)}/${boardCode}/${post.id}`;
      } else if (type === 'school' && post.schoolId) {
        shareUrl = `https://inschoolz.com/community/school/${post.schoolId}/${boardCode}/${post.id}`;
      } else {
        // fallback for unknown types
        shareUrl = `https://inschoolz.com/community/national/${boardCode}/${post.id}`;
      }
      
      // 플랫폼별 클립보드 복사 처리
      if (Platform.OS === 'web') {
        // 웹 환경에서 클립보드 API 사용
        try {
          if (navigator.clipboard) {
            await navigator.clipboard.writeText(shareUrl);
            Alert.alert('📋 공유 완료', '게시글 링크가 복사되었습니다!\n다른 곳에 붙여넣기해서 공유해보세요.');
          } else {
            // fallback 방법
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            Alert.alert('📋 공유 완료', '게시글 링크가 복사되었습니다!');
          }
        } catch (clipboardError) {
          Alert.alert(
            '게시글 링크', 
            `다음 링크를 복사해서 공유하세요:\n\n${shareUrl}`,
            [
              { text: '확인', style: 'default' }
            ]
          );
        }
      } else {
        // 모바일 환경에서는 실제 클립보드 복사
        try {
          await Clipboard.setStringAsync(shareUrl);
          Alert.alert('📋 공유 완료', '게시글 링크가 복사되었습니다!\n다른 앱에서 붙여넣기하여 공유해보세요.');
        } catch (clipboardError) {
          console.error('클립보드 복사 실패:', clipboardError);
          // 복사 실패 시 URL을 직접 표시
          Alert.alert(
            '📋 게시글 공유',
            `링크를 수동으로 복사해주세요:\n\n${shareUrl}`,
            [
              { text: '확인', style: 'default' }
            ]
          );
        }
      }
    } catch (error) {
      console.error('공유 실패:', error);
      Alert.alert('❌ 오류', '공유에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const loadPostDetail = async () => {
    try {
      // 0단계: 캐시된 데이터 먼저 확인하고 즉시 UI 표시 (낙관적 업데이트)
      const cachedData = getPost(postId);
      const cachedBoard = getBoard(boardCode);
      
      if (cachedData?.post) {
        // 캐시된 데이터로 즉시 UI 표시
        setPost(cachedData.post);
        setLikeCount(cachedData.post.stats.likeCount);
        setScrapCount(cachedData.post.stats.scrapCount || 0);
        
        if (cachedData.board || cachedBoard) {
          setBoard(cachedData.board || cachedBoard);
        }
        
        // 로딩 상태를 false로 설정하여 즉시 콘텐츠 표시
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      
      // 1단계: 백그라운드에서 최신 데이터 가져오기
      const postRef = doc(db, 'posts', postId);
      const [postDoc, boardData] = await Promise.all([
        getDoc(postRef),
        cachedBoard ? Promise.resolve(cachedBoard) : getBoardByCode(boardCode, type as BoardType)
      ]);
      
      if (!postDoc.exists()) {
        Alert.alert('오류', '게시글을 찾을 수 없습니다.');
        router.back();
        return;
      }

      if (!boardData) {
        Alert.alert('오류', '게시판을 찾을 수 없습니다.');
        router.back();
        return;
      }

      const postData = { id: postDoc.id, ...postDoc.data() } as Post;

      // 게시글이 해당 게시판에 속하는지 확인
      if (postData.boardCode !== boardCode) {
        Alert.alert('오류', '게시글을 찾을 수 없습니다.');
        router.back();
        return;
      }
      
      if (user) communityCommand('post.view', { postId }, user.uid).catch(error => console.error('조회수 증가 실패:', error));

      // 2단계: 작성자 정보 업데이트와 댓글/사용자 액션을 병렬로 처리
      const authorInfoPromise = (async () => {
        if (!postData.authorInfo?.profileImageUrl && !postData.authorInfo?.isAnonymous && postData.authorId) {
          try {
            const { getUserById } = await import('../../../../lib/users');
            const userDoc = await getUserById(postData.authorId);
            if (userDoc && userDoc.profile) {
              return {
                ...postData.authorInfo,
                displayName: postData.authorInfo?.displayName || userDoc.profile.userName || '사용자',
                profileImageUrl: userDoc.profile.profileImageUrl || '',
                isAnonymous: postData.authorInfo?.isAnonymous || false
              };
            }
          } catch (userError) {
            console.warn('사용자 정보 업데이트 실패:', userError);
          }
        }
        return postData.authorInfo;
      })();

      const [updatedAuthorInfo, commentsData] = await Promise.all([
        authorInfoPromise,
        loadComments(postId)
      ]);

      if (updatedAuthorInfo) {
        postData.authorInfo = updatedAuthorInfo;
      }

      // 상태 업데이트
      setPost(postData);
      setBoard(boardData);
      setLikeCount(postData.stats.likeCount);
      setScrapCount(postData.stats.scrapCount || 0);
      
      // 좋아요/스크랩 상태 확인 (독립적으로 실행)
      if (user) {
        checkUserActions(postId, user.uid).catch(error => 
          console.error('사용자 액션 상태 확인 실패:', error)
        );
      }
    } catch (error) {
      console.error('게시글 로드 실패:', error);
      Alert.alert('오류', '게시글을 불러오는데 실패했습니다.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadComments = async (postId: string) => {
    try {
      // 1단계: 부모 댓글과 모든 답글을 병렬로 가져오기
      const [commentsSnapshot, allRepliesSnapshot] = await Promise.all([
        getDocs(query(
          collection(db, 'posts', postId, 'comments'),
          where('parentId', '==', null),
          orderBy('createdAt', 'asc')
        )),
        getDocs(query(
          collection(db, 'posts', postId, 'comments'),
          where('parentId', '!=', null),
          orderBy('createdAt', 'asc')
        ))
      ]);
      
      // 2단계: 답글을 부모 ID별로 그룹화하고 답글 데이터 저장
      const repliesByParentId = new Map<string, Comment[]>();
      const replyUserIds = new Set<string>();
      
      allRepliesSnapshot.docs.forEach(doc => {
        const replyData = { id: doc.id, ...doc.data() } as Comment;
        
        // status 객체가 없는 경우 기본값으로 초기화
        if (!replyData.status) {
          replyData.status = {
            isDeleted: false,
            isBlocked: false
          };
        }
        
        // 삭제되지 않은 답글만 포함
        const isValid = !replyData.status.isDeleted || replyData.content === '삭제된 댓글입니다.';
        
        if (isValid && replyData.parentId) {
          if (!repliesByParentId.has(replyData.parentId)) {
            repliesByParentId.set(replyData.parentId, []);
          }
          repliesByParentId.get(replyData.parentId)!.push(replyData);
          
          // 답글 작성자 ID 수집
          if (!replyData.isAnonymous && replyData.authorId && !replyData.status.isDeleted) {
            replyUserIds.add(replyData.authorId);
          }
        }
      });
      
      // 3단계: 필요한 사용자 ID 수집 (부모 댓글 + 답글)
      const userIds = new Set<string>();
      const validComments: Comment[] = [];
      
      for (const commentDoc of commentsSnapshot.docs) {
        const commentData = { id: commentDoc.id, ...commentDoc.data() } as Comment;
        
        // status 객체가 없는 경우 기본값으로 초기화
        if (!commentData.status) {
          commentData.status = {
            isDeleted: false,
            isBlocked: false
          };
        }
        
        // 삭제된 댓글이지만 대댓글이 없는 경우 건너뛰기
        if (commentData.status.isDeleted && commentData.content !== '삭제된 댓글입니다.') {
          continue;
        }
        
        validComments.push(commentData);
        
        // 익명이 아니고 삭제되지 않은 댓글의 작성자 ID 수집
        if (!commentData.isAnonymous && commentData.authorId && !commentData.status.isDeleted) {
          userIds.add(commentData.authorId);
        }
      }
      
      // 답글 작성자 ID도 추가
      replyUserIds.forEach(id => userIds.add(id));
      
      // 4단계: 사용자 정보 병렬로 조회
      const userInfoMap = new Map<string, { userName: string; profileImageUrl: string }>();
      
      if (userIds.size > 0) {
        const userPromises = Array.from(userIds).map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, 'publicProfiles', userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData?.profile) {
                return {
                  userId,
                  info: {
                    userName: userData.profile.userName || '사용자',
                    profileImageUrl: userData.profile.profileImageUrl || ''
                  }
                };
              }
            }
          } catch (error) {
            console.error('사용자 정보 조회 오류:', error);
          }
          return null;
        });
        
        const userResults = await Promise.all(userPromises);
        userResults.forEach(result => {
          if (result) {
            userInfoMap.set(result.userId, result.info);
          }
        });
      }
      
      // 5단계: 댓글 데이터 조립 (답글 포함)
      const commentsData: CommentWithAuthor[] = validComments.map(commentData => {
        let authorInfo = {
          userName: '사용자',
          profileImageUrl: ''
        };
        
        // 익명 댓글 처리
        if (commentData.isAnonymous || !commentData.authorId) {
          if (commentData.anonymousAuthor?.nickname) {
            authorInfo.userName = commentData.anonymousAuthor.nickname;
          } else {
            authorInfo.userName = '익명';
          }
        } else if (!commentData.status.isDeleted) {
          // 미리 조회한 사용자 정보 사용
          const cachedInfo = userInfoMap.get(commentData.authorId);
          if (cachedInfo) {
            authorInfo = cachedInfo;
          }
        }
        
        // 답글 데이터 조립
        const replies: CommentWithAuthor[] = (repliesByParentId.get(commentData.id) || []).map(replyData => {
          let replyAuthorInfo = {
            userName: '사용자',
            profileImageUrl: ''
          };
          
          // 익명 답글 처리
          if (replyData.isAnonymous || !replyData.authorId) {
            if (replyData.anonymousAuthor?.nickname) {
              replyAuthorInfo.userName = replyData.anonymousAuthor.nickname;
            } else {
              replyAuthorInfo.userName = '익명';
            }
          } else if (!replyData.status.isDeleted) {
            const cachedInfo = userInfoMap.get(replyData.authorId);
            if (cachedInfo) {
              replyAuthorInfo = cachedInfo;
            }
          }
          
          return {
            ...replyData,
            author: replyAuthorInfo,
            replies: []
          };
        });
        
        return {
          ...commentData,
          author: authorInfo,
          replies: replies
        };
      });

      // 모든 댓글을 시간순으로 확실히 정렬 (익명 댓글 포함)
      commentsData.sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));

      // 전체 댓글 저장
      setAllComments(commentsData);
      
      // 처음에는 10개만 표시 (페이지네이션)
      setComments(commentsData.slice(0, displayedCommentsCount));
      
      // 실제 로드된 댓글 수로 게시글 카운트 동기화 (댓글 + 대댓글)
      const actualCommentCount = commentsData.reduce((count, comment) => {
        let total = 1; // 부모 댓글
        total += comment.replies?.length || 0; // 대댓글들
        return count + total;
      }, 0);
      
      // 게시글의 댓글 카운트와 실제 로드된 댓글 수가 다르면 조정
      if (post && post.stats.commentCount !== actualCommentCount) {
        setPost(prev => prev ? {
          ...prev,
          stats: {
            ...prev.stats,
            commentCount: actualCommentCount
          }
        } : null);
      }
      
      // 로그인한 사용자인 경우 댓글 좋아요 상태 확인
      if (user?.uid && commentsData.length > 0) {
        const allCommentIds: string[] = [];
        
        // 모든 댓글과 대댓글의 ID 수집
        commentsData.forEach(comment => {
          allCommentIds.push(comment.id);
          if (comment.replies) {
            comment.replies.forEach(reply => {
              allCommentIds.push(reply.id);
            });
          }
        });
        
        // 댓글 좋아요 상태 확인 (백그라운드에서 실행)
        checkMultipleCommentLikeStatus(postId, allCommentIds, user.uid)
          .then(likeStatuses => setCommentLikeStatuses(likeStatuses))
          .catch(error => console.error('댓글 좋아요 상태 확인 실패:', error));
      }
      
      return commentsData;
    } catch (error) {
      console.error('댓글 로드 실패:', error);
      return [];
    }
  };

  const formatDate = (timestamp: unknown) => {
    return formatAbsoluteTime(timestamp, 'datetime');
  };

  // 작성자 확인
  const isAuthor = user && post && user.uid === post.authorId;

  // 게시글 수정
  const handleEdit = () => {
    if (!isAuthor) {
      Alert.alert('오류', '수정 권한이 없습니다.');
      return;
    }
    router.push(`/board/${type}/${boardCode}/edit/${postId}`);
  };

  // 게시글 삭제
  const handleDelete = () => {
    if (!isAuthor) {
      Alert.alert('오류', '삭제 권한이 없습니다.');
      return;
    }

    Alert.alert(
      '게시글 삭제',
      '정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              await communityCommand('post.delete', { postId }, user.uid);

              Alert.alert('성공', '게시글이 삭제되었습니다.', [
                { text: '확인', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('게시글 삭제 실패:', error);
              Alert.alert('오류', '게시글 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  // 메뉴 버튼 클릭
  const handleMenuPress = () => {
    if (!post) return;
    
    Alert.alert(
      '게시글 관리',
      '원하는 작업을 선택하세요.',
      [
        ...(isAuthor ? [
          { text: '수정', onPress: handleEdit },
          { text: '삭제', onPress: handleDelete, style: 'destructive' as const }
        ] : [
          { text: '신고', onPress: () => {
            setReportTargetId(post.id);
            setReportTargetType('post');
            setReportTargetContent(JSON.stringify({ title: post.title, content: post.content }));
            setReportPostId('');
            setShowReportModal(true);
          }, style: 'destructive' as const },
          { text: '차단하기', onPress: async () => {
            if (!user || !post.authorId) {
              Alert.alert('알림', '로그인이 필요합니다.');
              return;
            }

            if (post.authorId === user.uid) {
              Alert.alert('알림', '자기 자신을 차단할 수 없습니다.');
              return;
            }

            Alert.alert(
              '사용자 차단',
              `${post.authorInfo?.displayName}님을 차단하시겠습니까?`,
              [
                { text: '취소', style: 'cancel' },
                {
                  text: '차단',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { toggleBlock } = await import('../../../../lib/users');
                      const result = await toggleBlock(user.uid, post.authorId);
                      Alert.alert('완료', result.isBlocked ? '사용자를 차단했습니다.' : '차단을 해제했습니다.');
                    } catch (error) {
                      console.error('차단 처리 실패:', error);
                      Alert.alert('오류', '차단 처리에 실패했습니다.');
                    }
                  }
                }
              ]
            );
          }}
        ]),
        { text: '취소', style: 'cancel' as const }
      ]
    );
  };

  // 비회원 댓글 작성 함수
  const handleGuestCommentSubmit = async () => {
    if (!guestComment.trim()) {
      Alert.alert('알림', '댓글을 입력해주세요.');
      return;
    }

    if (!guestNickname.trim()) {
      Alert.alert('알림', '닉네임을 입력해주세요.');
      return;
    }

    if (!guestPassword || guestPassword.length !== 4) {
      Alert.alert('알림', '비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    if (!post) return;

    try {
      const { createAnonymousComment } = await import('../../../../lib/boards');
      await createAnonymousComment({
        postId: post.id,
        content: guestComment,
        nickname: guestNickname,
        password: guestPassword,
        parentId: null,
      });

      // 로컬 게시글 댓글 수 업데이트
      setPost(prev => prev ? {
        ...prev,
        stats: {
          ...prev.stats,
          commentCount: prev.stats.commentCount + 1
        }
      } : null);

      // 댓글 목록 새로고침
      await loadComments(post.id);
      
      // 입력 필드 초기화
      setGuestComment('');
      setGuestNickname('');
      setGuestPassword('');
      setShowGuestCommentForm(false);

      Alert.alert('완료', '댓글이 작성되었습니다.');
    } catch (error) {
      console.error('비회원 댓글 작성 실패:', error);
      Alert.alert('오류', '댓글 작성에 실패했습니다.');
    }
  };

  // 비회원 답글 작성 함수
  const handleGuestReplySubmit = async () => {
    if (!guestReplyContent.trim()) {
      Alert.alert('알림', '답글을 입력해주세요.');
      return;
    }

    if (!guestNickname.trim()) {
      Alert.alert('알림', '닉네임을 입력해주세요.');
      return;
    }

    if (!guestPassword || guestPassword.length !== 4) {
      Alert.alert('알림', '비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    if (!post || !guestReplyingTo) return;

    try {
      const { createAnonymousComment } = await import('../../../../lib/boards');
      await createAnonymousComment({
        postId: post.id,
        content: guestReplyContent,
        nickname: guestNickname,
        password: guestPassword,
        parentId: guestReplyingTo.id,
      });

      // 로컬 게시글 댓글 수 업데이트
      setPost(prev => prev ? {
        ...prev,
        stats: {
          ...prev.stats,
          commentCount: prev.stats.commentCount + 1
        }
      } : null);

      // 댓글 목록 새로고침
      await loadComments(post.id);
      
      // 답글 작성 후 스크롤을 하단으로 이동
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
      
      // 입력 필드 초기화
      setGuestReplyContent('');
      setGuestNickname('');
      setGuestPassword('');
      setGuestReplyingTo(null);
      setShowGuestCommentForm(false);

      Alert.alert('완료', '답글이 작성되었습니다.');
    } catch (error) {
      console.error('비회원 답글 작성 실패:', error);
      Alert.alert('오류', '답글 작성에 실패했습니다.');
    }
  };

  // 경험치 모달 닫기 핸들러
  const handleExperienceModalClose = () => {
    setShowExperienceModal(false);
    setExperienceData(null);
  };

  // 중복 제출 방지를 위한 ref - state보다 빠르게 동기적으로 체크
  const isSubmittingRef = React.useRef(false);

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) {
      // 빈 댓글 제출 시 조용히 리턴 - 사용자가 입력하지 않은 상태에서 실수로 눌렀을 가능성 고려
      return;
    }

    if (!user || !post) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    // 중복 제출 방지 - ref를 사용하여 동기적으로 체크 (state보다 빠름)
    if (isSubmittingRef.current || isSubmitting) {
      console.log('중복 제출 차단됨');
      return;
    }

    // 정지된 사용자 차단
    const suspensionStatus = checkSuspensionStatus(user);
    if (suspensionStatus.isSuspended) {
      const message = suspensionStatus.isPermanent
        ? "계정이 영구 정지되어 댓글을 작성할 수 없습니다."
        : `계정이 정지되어 댓글을 작성할 수 없습니다. (남은 기간: ${suspensionStatus.remainingDays}일)`;
      
      Alert.alert("댓글 작성 불가", message);
      return;
    }

    // ref와 state 모두 설정하여 이중 방어
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // 댓글 작성 (로그인 사용자는 익명이어도 비밀번호 불필요)
      const { createComment } = await import('../../../../lib/boards');
      const newCommentId = await createComment(post.id, newComment, user.uid, isAnonymous);
      
      // 퀘스트 트래킹: 댓글 작성 (5단계)
      try {
        await trackAction('create_comment');
        console.log('✅ 퀘스트 트래킹: 댓글 작성');
      } catch (questError) {
        console.error('❌ 퀘스트 트래킹 오류:', questError);
      }
      
      // 입력 필드 먼저 초기화 (사용자 경험 개선)
      const commentContentForExp = newComment;
      setNewComment('');
      setIsAnonymous(false);
      
      // 댓글 목록 새로고침 (대댓글 카운트 포함)
      await loadComments(post.id);
      
      // 댓글 작성 후 스크롤을 하단으로 이동 (키보드 영역 고려)
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
      
      // 경험치 부여
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
        }
      } catch (expError) {
        console.error('경험치 부여 실패:', expError);
        // 경험치 부여 실패는 댓글 작성 성공에 영향을 주지 않음
      }
      
      // 댓글 작성 완료 alert 제거 - 경험치 창이 이미 표시되므로 불필요
    } catch (error) {
      console.error('댓글 작성 실패:', error);
      Alert.alert('오류', '댓글 작성에 실패했습니다.');
    } finally {
      // ref와 state 모두 해제
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };



  // 익명 댓글 성공 핸들러
  const handleAnonymousCommentSuccess = async () => {
    setShowAnonymousForm(false);
    
    // 로컬 게시글 댓글 수 업데이트
    setPost(prev => prev ? {
      ...prev,
      stats: {
        ...prev.stats,
        commentCount: prev.stats.commentCount + 1
      }
    } : null);
    
    // 최신 댓글만 가져와서 추가 (전체 새로고침 대신)
    if (post) {
      try {
        const commentsRef = collection(db, 'posts', post.id, 'comments');
        const latestCommentsQuery = query(
          commentsRef,
          where('parentId', '==', null),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const latestSnapshot = await getDocs(latestCommentsQuery);
        
        if (!latestSnapshot.empty) {
          const latestCommentDoc = latestSnapshot.docs[0];
          const latestCommentData = { id: latestCommentDoc.id, ...latestCommentDoc.data() } as Comment;
          
          // status 객체가 없는 경우 기본값으로 초기화
          if (!latestCommentData.status) {
            latestCommentData.status = {
              isDeleted: false,
              isBlocked: false
            };
          }
          
          const newCommentWithAuthor: CommentWithAuthor = {
            ...latestCommentData,
            author: {
              userName: latestCommentData.anonymousAuthor?.nickname || '익명',
              profileImageUrl: ''
            },
            replies: []
          };
          
          setComments(prev => [...prev, newCommentWithAuthor]);
          
          // 댓글 추가 후 스크롤을 하단으로 이동
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }
      } catch (error) {
        console.error('최신 댓글 로드 실패:', error);
        // 실패 시 전체 댓글 목록 새로고침
        await loadComments(post.id);
        
        // 전체 새로고침 후에도 스크롤
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 300);
      }
    }
  };


  // 댓글 더보기 메뉴 핸들러
  const handleCommentMorePress = (comment: CommentWithAuthor) => {
    const isOwnComment = user && comment.authorId === user.uid;
    const isAnonymousComment = comment.isAnonymous;
    const isGuestAnonymousComment = isAnonymousComment && !comment.authorId; // 비회원 익명 댓글
    const isMemberAnonymousComment = isAnonymousComment && comment.authorId; // 회원 익명 댓글
    
    // 비회원일 때는 비회원 익명 댓글에만 메뉴 표시
    if (!user && !isGuestAnonymousComment) return;
    
    let options: string[] = [];
    
    if (isOwnComment || isGuestAnonymousComment) {
      // 본인 댓글이거나 비회원 익명 댓글인 경우
      options = ['수정', '삭제', '취소'];
    } else if (user) {
      // 로그인한 사용자이고 다른 사용자의 댓글인 경우
      const isBlocked = blockedUserIds.has(comment.authorId || '');
      options = ['신고', isBlocked ? '차단 해제' : '차단', '취소'];
    } else {
      // 비회원이고 일반 댓글인 경우 (이미 위에서 return되므로 도달하지 않음)
      return;
    }

    Alert.alert(
      '댓글 옵션',
      '원하는 작업을 선택하세요.',
      options.map((option, index) => ({
        text: option,
        style: option === '취소' ? 'cancel' : option === '삭제' || option === '신고' ? 'destructive' : 'default',
        onPress: () => {
          switch (option) {
            case '수정':
              if (isGuestAnonymousComment) {
                // 비회원 익명 댓글은 비밀번호 필요
                setPasswordModalData({ commentId: comment.id, action: 'edit' });
                setShowPasswordModal(true);
              } else {
                // 회원 댓글 (일반 댓글 또는 회원 익명 댓글) 수정
                setEditingComment({
                  commentId: comment.id,
                  content: comment.content
                });
              }
              break;
                         case '삭제':
               if (isGuestAnonymousComment) {
                 // 비회원 익명 댓글은 비밀번호 필요
                 setPasswordModalData({ commentId: comment.id, action: 'delete' });
                 setShowPasswordModal(true);
               } else {
                 Alert.alert(
                   '댓글 삭제',
                   '댓글을 삭제하시겠습니까?',
                   [
                     { text: '취소', style: 'cancel' },
                     { 
                       text: '삭제', 
                       style: 'destructive',
                       onPress: async () => {
                         try {
                           if (!user) return;
                           const { deleteComment } = await import('../../../../lib/boards');
                           const result = await deleteComment(post!.id, comment.id, user.uid);
                           
                           // 로컬 게시글 댓글 수 업데이트 (대댓글이 없는 경우에만)
                           if (!result.hasReplies) {
                             setPost(prev => prev ? {
                               ...prev,
                               stats: {
                                 ...prev.stats,
                                 commentCount: Math.max(0, prev.stats.commentCount - 1)
                               }
                             } : null);
                           }
                           
                           // 댓글 목록 새로고침
                           if (post) {
                             await loadComments(post.id);
                           }
                           
                           Alert.alert('완료', '댓글이 삭제되었습니다.');
                         } catch (error) {
                           console.error('댓글 삭제 실패:', error);
                           Alert.alert('오류', '댓글 삭제에 실패했습니다.');
                         }
                       }
                     }
                   ]
                 );
               }
               break;
             case '신고':
               setReportTargetId(comment.id);
               setReportTargetType('comment');
               setReportTargetContent(comment.content);
               setReportPostId(post?.id || '');
               setShowReportModal(true);
               break;
             case '차단':
               Alert.alert(
                 '사용자 차단',
                 `${comment.author?.userName || '이 사용자'}님을 차단하시겠습니까?\n차단된 사용자의 게시글과 댓글은 "차단한 사용자입니다"로 표시됩니다.`,
                 [
                   { text: '취소', style: 'cancel' },
                   {
                     text: '차단',
                     style: 'destructive',
                     onPress: async () => {
                       try {
                         if (!user) return;
                         const { toggleBlock } = await import('../../../../lib/users');
                         await toggleBlock(user.uid, comment.authorId!);
                         // 차단 목록에 추가
                         setBlockedUserIds(prev => new Set([...prev, comment.authorId!]));
                         Alert.alert('완료', '사용자를 차단했습니다.');
                       } catch (error) {
                         console.error('차단 실패:', error);
                         Alert.alert('오류', '차단에 실패했습니다.');
                       }
                     }
                   }
                 ]
               );
               break;
             case '차단 해제':
               Alert.alert(
                 '차단 해제',
                 `${comment.author?.userName || '이 사용자'}님을 차단 해제하시겠습니까?`,
                 [
                   { text: '취소', style: 'cancel' },
                   {
                     text: '차단 해제',
                     onPress: async () => {
                       try {
                         if (!user) return;
                         const { toggleBlock } = await import('../../../../lib/users');
                         await toggleBlock(user.uid, comment.authorId!);
                         // 차단 목록에서 제거
                         handleUnblock(comment.authorId!);
                         Alert.alert('완료', '차단을 해제했습니다.');
                       } catch (error) {
                         console.error('차단 해제 실패:', error);
                         Alert.alert('오류', '차단 해제에 실패했습니다.');
                       }
                     }
                   }
                 ]
               );
               break;
          }
        }
      }))
    );
  };

  // 익명 댓글 비밀번호 확인 성공 핸들러
  const handlePasswordVerifySuccess = (verifiedPassword: string) => {
    if (!passwordModalData) return;

    const { commentId, action } = passwordModalData;
    
    if (action === 'edit') {
      // 수정 모드로 전환
      const comment = findCommentById(commentId);
      if (comment) {
        setEditingAnonymousComment({
          commentId,
          content: comment.content,
          password: verifiedPassword, // 검증된 비밀번호 저장
        });
      }
    } else if (action === 'delete') {
      // 삭제 실행
      handleAnonymousCommentDelete(commentId, verifiedPassword);
    }

    setShowPasswordModal(false);
    setPasswordModalData(null);
  };

  // 댓글 찾기 함수
  const findCommentById = (commentId: string): CommentWithAuthor | null => {
    for (const comment of comments) {
      if (comment.id === commentId) return comment;
      if (comment.replies) {
        for (const reply of comment.replies) {
          if (reply.id === commentId) return reply;
        }
      }
    }
    return null;
  };

  // 익명 댓글 삭제
  const handleAnonymousCommentDelete = async (commentId: string, password: string) => {
    if (!post) return;

    try {
      const result = await deleteAnonymousComment(post.id, commentId, password);
      
      // 로컬 게시글 댓글 수 업데이트 (대댓글이 없는 경우에만)
      if (!result.hasReplies) {
        setPost(prev => prev ? {
          ...prev,
          stats: {
            ...prev.stats,
            commentCount: Math.max(0, prev.stats.commentCount - 1)
          }
        } : null);
      }
      
      Alert.alert('성공', '댓글이 삭제되었습니다.');
      await loadComments(post.id);
    } catch (error) {
      console.error('익명 댓글 삭제 실패:', error);
      Alert.alert('오류', '댓글 삭제에 실패했습니다.');
    }
  };

  // 익명 댓글 수정 완료
  const handleAnonymousCommentEditComplete = async () => {
    if (!editingAnonymousComment || !post) return;

    try {
      const { updateAnonymousComment } = await import('../../../../lib/boards');
      await updateAnonymousComment(
        post.id, 
        editingAnonymousComment.commentId, 
        editingAnonymousComment.content, 
        editingAnonymousComment.password
      );
      
      setEditingAnonymousComment(null);
      await loadComments(post.id);
      Alert.alert('성공', '댓글이 수정되었습니다.');
    } catch (error) {
      console.error('익명 댓글 수정 실패:', error);
      Alert.alert('오류', '댓글 수정에 실패했습니다.');
    }
  };

  // 회원 댓글 수정 완료
  const handleCommentEditComplete = async (content: string) => {
    if (!editingComment || !user || !post) return;

    try {
      const { updateComment } = await import('../../../../lib/boards');
      await updateComment(post.id, editingComment.commentId, content, user.uid);
      
      setEditingComment(null);
      await loadComments(post.id);
      Alert.alert('성공', '댓글이 수정되었습니다.');
    } catch (error) {
      console.error('댓글 수정 실패:', error);
      Alert.alert('오류', '댓글 수정에 실패했습니다.');
    }
  };

  // 댓글 좋아요 토글
  const handleCommentLike = async (commentId: string) => {
    if (!user?.uid) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    try {
      const result = await toggleCommentLike(postId, commentId, user.uid);
      
      // 퀘스트 트래킹: 좋아요 누르기 (6단계) - 좋아요 추가 시에만
      if (result.liked) {
        try {
          await trackAction('give_like');
          console.log('✅ 퀘스트 트래킹: 좋아요 (댓글)');
        } catch (questError) {
          console.error('❌ 퀘스트 트래킹 오류:', questError);
        }
      }
      
      // 좋아요 상태 즉시 업데이트
      setCommentLikeStatuses(prev => ({
        ...prev,
        [commentId]: result.liked
      }));
      
      // 댓글 좋아요 수 업데이트
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return {
            ...comment,
            stats: {
              ...comment.stats,
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
                  ...reply.stats,
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
      
    } catch (error) {
      console.error('댓글 좋아요 처리 실패:', error);
      Alert.alert('오류', '좋아요 처리에 실패했습니다.');
    }
  };

  const renderProfileImage = useCallback((profileImageUrl?: string, userName?: string, isAnonymous?: boolean, authorId?: string) => {
    if (isAnonymous) {
      return (
        <View style={styles.commentAvatar}>
          <Text style={styles.avatarText}>익명</Text>
        </View>
      );
    }

    const imageContent = (
      <SafeProfileImage
        uri={profileImageUrl}
        size={32}
        style={styles.safeProfileImageStyle}
        fallbackIcon="person"
        fallbackColor="#6b7280"
      />
    );

    // 익명이 아니고 authorId가 있으면 터치 가능하게 만들기
    if (!isAnonymous && authorId) {
      return (
        <TouchableOpacity
          onPress={() => router.push(`/users/${authorId}`)}
          style={styles.profileImageTouchable}
        >
          {imageContent}
        </TouchableOpacity>
      );
    }

    return imageContent;
  }, [router]);

  const renderComment = (comment: CommentWithAuthor, level: number = 0, parentAuthor?: string) => {
    // status 객체가 없는 경우 기본값으로 처리
    const commentStatus = comment.status || { isDeleted: false, isBlocked: false };
    const isDeleted = commentStatus.isDeleted && comment.content === '삭제된 댓글입니다.';
    const isReply = level > 0;
    const authorName = isDeleted ? '삭제된 사용자' : 
      (comment.isAnonymous ? 
        (comment.authorId === null ? 
          `${comment.anonymousAuthor?.nickname || '익명'} (비회원)` : 
          '익명') : 
        comment.author?.userName || '사용자');
    const maxLevel = 1;
    
    // 차단된 사용자인지 확인
    const isBlocked = comment.authorId && user && blockedUserIds.has(comment.authorId);
    
    if (isBlocked && comment.authorId) {
      return (
        <View key={comment.id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
          <BlockedUserContent
            blockedUserId={comment.authorId}
            blockedUserName={comment.author?.userName || '사용자'}
            contentType="comment"
            onUnblock={() => handleUnblock(comment.authorId!)}
          >
            <View style={styles.blockedCommentContent}>
              <Text style={styles.blockedCommentText}>차단한 사용자의 댓글입니다</Text>
              <Text style={styles.blockedUserName}>@{comment.author?.userName || '사용자'}</Text>
            </View>
          </BlockedUserContent>
        </View>
      );
    }

    return (
      <View key={comment.id} style={[styles.commentContainer, isReply && styles.replyContainer]}>
        {/* 댓글 헤더: 프로필 이미지 + 작성자 + 시간 + 메뉴 */}
        <View style={styles.commentHeader}>
          <View style={styles.commentHeaderLeft}>
            {renderProfileImage(
              comment.author?.profileImageUrl,
              comment.author?.userName,
              comment.isAnonymous,
              comment.authorId || undefined
            )}
            {/* 작성자 이름도 클릭 가능하게 만들기 */}
            {!comment.isAnonymous && comment.authorId ? (
              <TouchableOpacity
                onPress={() => router.push(`/users/${comment.authorId!}`)}
                style={styles.authorNameTouchable}
              >
                <Text style={[styles.commentAuthor, styles.clickableAuthor]}>{authorName}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.commentAuthor}>{authorName}</Text>
            )}
            <Text style={styles.commentDate}>
              {formatRelativeTime(comment.createdAt)}
            </Text>
          </View>
          
          {/* 더보기 메뉴 */}
          {(user || (comment.isAnonymous && !comment.authorId)) && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => handleCommentMorePress(comment)}
            >
              <Ionicons name="ellipsis-horizontal" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        
        {/* 댓글 내용 - 프로필 이미지 여백에 맞춰 들여쓰기 */}
        <View style={styles.commentContent}>
          {/* 수정 중인 댓글인지 확인 */}
          {(editingComment?.commentId === comment.id || editingAnonymousComment?.commentId === comment.id) ? (
            <View style={styles.editingContainer}>
              <TextInput
                style={styles.editingInput}
                value={editingComment?.commentId === comment.id ? editingComment.content : editingAnonymousComment?.content || ''}
                onChangeText={(text) => {
                  if (editingComment?.commentId === comment.id) {
                    setEditingComment(prev => prev ? { ...prev, content: text } : null);
                  } else if (editingAnonymousComment?.commentId === comment.id) {
                    setEditingAnonymousComment(prev => prev ? { ...prev, content: text } : null);
                  }
                }}
                multiline
                autoFocus
                placeholder="댓글을 입력하세요..."
              />
              <View style={styles.editingActions}>
                <TouchableOpacity
                  style={styles.editingSaveButton}
                  onPress={() => {
                    if (editingComment?.commentId === comment.id) {
                      handleCommentEditComplete(editingComment.content);
                    } else if (editingAnonymousComment?.commentId === comment.id) {
                      handleAnonymousCommentEditComplete();
                    }
                  }}
                >
                  <Text style={styles.editingSaveButtonText}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editingCancelButton}
                  onPress={() => {
                    setEditingComment(null);
                    setEditingAnonymousComment(null);
                  }}
                >
                  <Text style={styles.editingCancelButtonText}>취소</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Hyperlink
              linkDefault={true}
              linkStyle={styles.linkText}
              onPress={(url, text) => {
                Linking.openURL(url).catch((err) => {
                  console.error('링크 열기 실패:', err);
                  Alert.alert('오류', '링크를 열 수 없습니다.');
                });
              }}
            >
              <Text style={[styles.commentText, isDeleted && styles.deletedCommentText]}>
                {isDeleted ? '삭제된 댓글입니다.' : parseContentText(comment.content)}
              </Text>
            </Hyperlink>
          )}
          
          {/* 액션 버튼들 - 좋아요, 답글 (수정 중이 아닐 때만 표시) */}
          {!isDeleted && !(editingComment?.commentId === comment.id || editingAnonymousComment?.commentId === comment.id) && (
            <View style={styles.commentActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCommentLike(comment.id)}
              >
                <Ionicons 
                  name={commentLikeStatuses[comment.id] ? "heart" : "heart-outline"} 
                  size={14} 
                  color={commentLikeStatuses[comment.id] ? "#ef4444" : "#6b7280"} 
                />
                <Text style={[styles.actionButtonText, commentLikeStatuses[comment.id] && styles.likedText]}>
                  {comment.stats.likeCount}
                </Text>
              </TouchableOpacity>

              {level < maxLevel && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => {
                    // 대댓글 작성은 세부 화면으로 이동
                    router.push(`/board/${type}/${boardCode}/${postId}/comments/${comment.id}`);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={14} color="#6b7280" />
                  <Text style={styles.actionButtonText}>답글</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* 대댓글 표시 */}
        {!isDeleted && comment.replies && comment.replies.length > 0 && level === 0 && (
          <View style={styles.repliesContainer}>
            {comment.replies.map((reply) => renderComment(reply, 1, authorName))}
          </View>
        )}
      </View>
    );
  };

  useEffect(() => {
    loadPostDetail();
  }, [postId]);

  // 사용자 정보 변경 시 차단된 사용자 목록 로드
  useEffect(() => {
    if (user?.uid) {
      loadBlockedUsers();
    }
  }, [user?.uid, loadBlockedUsers]);

  // 화면 포커스 시 댓글 목록 새로고침 (세부 화면에서 돌아왔을 때)
  // 초기 로드는 제외하고 포커스가 다시 돌아올 때만 실행
  const isInitialMount = React.useRef(true);
  
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      
      if (post?.id) {
        loadComments(post.id);
      }
    }, [post?.id])
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>게시글을 불러오는 중...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!post || !board) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
        <SafeAreaView style={styles.errorContainer}>
          <Text style={styles.errorText}>게시글을 찾을 수 없습니다.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>돌아가기</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f9fafb" translucent={false} />
      <SafeAreaView style={styles.safeArea}>
        <CustomHeader 
          title={board.name} 
          onBack={() => router.back()} 
          showMenu={true}
          onMenuPress={handleMenuPress}
          insets={insets}
        />

        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollViewContent,
              { paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom + 20, 40) : 40 }
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* 게시글 내용 */}
            <View style={styles.postContainer}>
              {/* 게시판 배지 */}
              <View style={styles.boardTypeContainer}>
                <View style={styles.boardTypeBadge}>
                  <Text style={styles.boardTypeText}>{getBoardTypeLabel(type)}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{board.name}</Text>
                </View>
                {post.attachments && post.attachments.length > 0 && (
                  <View style={styles.imageBadgeContainer}>
                    <Text style={styles.imageBadgeText}>📷 사진 {post.attachments.filter(att => att.type === 'image').length}</Text>
                  </View>
                )}
                {post.poll && (
                  <View style={styles.pollBadgeContainer}>
                    <Text style={styles.pollBadgeText}>📊 투표</Text>
                  </View>
                )}
              </View>

              {/* 제목 */}
              <Text style={styles.postTitle}>{post.title}</Text>

              {/* 작성자 정보 */}
              {post.authorInfo?.isAnonymous ? (
                <View style={styles.authorInfo}>
                  <View style={styles.authorAvatarContainer}>
                    <View style={styles.authorAvatarPlaceholder}>
                      <Text style={styles.authorAvatarText}>익명</Text>
                    </View>
                  </View>
                  <View style={styles.authorTextInfo}>
                    <Text style={styles.authorName}>익명</Text>
                    <View style={styles.authorMetaInfo}>
                      <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity 
                  style={styles.authorInfo}
                  onPress={() => router.push(`/users/${post.authorId}`)}
                >
                  <View style={styles.authorAvatarContainer}>
                    {post.authorInfo?.profileImageUrl ? (
                      <Image 
                        source={{ uri: post.authorInfo.profileImageUrl }} 
                        style={styles.authorAvatar}
                      />
                    ) : (
                      <View style={styles.authorAvatarPlaceholder}>
                        <Text style={styles.authorAvatarText}>
                          {post.authorInfo?.displayName?.substring(0, 1) || 'U'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.authorTextInfo}>
                    <Text style={styles.authorName}>
                      {post.authorInfo?.displayName || '사용자'}
                    </Text>
                    <View style={styles.authorMetaInfo}>
                      <Text style={styles.postDate}>{formatDate(post.createdAt)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* 내용 (HTML 렌더링으로 인라인 이미지 포함) */}
              <PostContent 
                post={post}
                width={width}
                styles={styles}
              />

              {/* 투표 */}
              {post.poll && (
                <PollVoting 
                  postId={post.id} 
                  poll={post.poll}
                  onVoteUpdate={(updatedPoll) => {
                    // 투표 업데이트 시 post 상태도 업데이트
                    setPost(prev => prev ? { ...prev, poll: updatedPoll } : null);
                  }}
                />
              )}

              {/* 액션 버튼 */}
              <View style={styles.actionButtons}>
                {/* 왼쪽: 조회수, 댓글 */}
                <View style={styles.actionButtonsLeft}>
                  <View style={styles.actionButton}>
                    <Ionicons name="eye-outline" size={16} color="#6b7280" />
                    <Text style={styles.actionButtonText}>{post.stats.viewCount}</Text>
                  </View>
                  <View style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={16} color="#6b7280" />
                    <Text style={styles.actionButtonText}>
                      {comments.reduce((total, comment) => {
                        const replyCount = (comment.replies as any)?.__replyCount || 0;
                        return total + 1 + replyCount;
                      }, 0)}
                    </Text>
                  </View>
                </View>
                
                {/* 오른쪽: 좋아요, 스크랩, 공유 */}
                <View style={styles.actionButtonsRight}>
                  <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                    <Ionicons 
                      name={isLiked ? "heart" : "heart-outline"} 
                      size={16} 
                      color={isLiked ? "#ef4444" : "#6b7280"} 
                    />
                    <Text style={[styles.actionButtonText, isLiked && { color: "#ef4444" }]}>
                      {likeCount}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton} onPress={handleScrap}>
                    <Ionicons 
                      name={isScrapped ? "bookmark" : "bookmark-outline"} 
                      size={16} 
                      color={isScrapped ? "#3b82f6" : "#6b7280"} 
                    />
                    <Text style={[styles.actionButtonText, isScrapped && { color: "#3b82f6" }]}>
                      {scrapCount}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.actionButton} 
                    onPress={handleShare}
                    accessibilityLabel="게시글 공유하기"
                    accessibilityHint="이 게시글의 링크를 복사하여 다른 사람과 공유할 수 있습니다"
                  >
                    <Ionicons name="share-outline" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 댓글 섹션 */}
            <View style={styles.commentSection}>
              <View style={styles.commentSectionHeader}>
                <Text style={styles.commentTitle}>댓글</Text>
                <View style={styles.commentBadge}>
                  <Text style={styles.commentBadgeText}>
                    {allComments.reduce((total, comment) => {
                      const replyCount = (comment.replies as any)?.__replyCount || 0;
                      return total + 1 + replyCount;
                    }, 0)}
                  </Text>
                </View>
              </View>

              {/* 댓글 목록 */}
              {comments.map((comment) => (
                renderComment(comment, 0)
              ))}
              
              {/* 더보기 버튼 */}
              {allComments.length > displayedCommentsCount && (
                <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={() => {
                    const newCount = displayedCommentsCount + 10;
                    setDisplayedCommentsCount(newCount);
                    setComments(allComments.slice(0, newCount));
                  }}
                >
                  <Text style={styles.loadMoreButtonText}>
                    댓글 더보기 ({allComments.length - displayedCommentsCount}개 남음)
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#10b981" />
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* 댓글 작성 - 하단 고정 */}
          {user ? (
            (() => {
              return (
                <View style={[
                  styles.commentInputContainer,
                  { paddingBottom: insets.bottom || 12 }
                ]}>
                  {/* 익명 모드 토글 */}
                  <View style={styles.commentOptions}>
                    <TouchableOpacity
                      style={styles.anonymousToggle}
                      onPress={() => setIsAnonymous(!isAnonymous)}
                    >
                      <Ionicons 
                        name={isAnonymous ? "checkbox" : "square-outline"} 
                        size={20} 
                        color={isAnonymous ? "#10b981" : "#6b7280"} 
                      />
                      <Text style={[
                        styles.anonymousToggleText,
                        isAnonymous && styles.anonymousToggleTextActive
                      ]}>
                        익명
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.commentInputWrapper}>
                    {!isAnonymous && renderProfileImage(
                      user?.profile?.profileImageUrl,
                      user?.profile?.userName,
                      false
                    )}
                    {isAnonymous && (
                      <View style={styles.anonymousAvatar}>
                        <Ionicons name="person-outline" size={20} color="#6b7280" />
                      </View>
                    )}
                    <TextInput
                      style={styles.commentInput}
                      placeholder="댓글을 입력해 주세요..."
                      value={newComment}
                      onChangeText={setNewComment}
                      multiline
                      maxLength={1000}
                    />
                    <TouchableOpacity 
                      style={styles.commentSubmitButton}
                      onPress={handleCommentSubmit}
                      disabled={isSubmitting || !newComment.trim()}
                    >
                      <Ionicons 
                        name="send" 
                        size={20} 
                        color={isSubmitting || !newComment.trim() ? "#9ca3af" : "#10b981"} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()
          ) : (
            // 비로그인 사용자용 익명 댓글 작성
            <View style={[
              styles.anonymousCommentContainer,
              { paddingBottom: insets.bottom || 12 }
            ]}>
              <View style={styles.anonymousCommentButton}>
                <TouchableOpacity 
                  style={styles.anonymousButton}
                  onPress={() => {
                    setGuestReplyingTo(null);
                    setShowGuestCommentForm(true);
                  }}
                >
                  <Ionicons name="person-outline" size={20} color="#22c55e" />
                  <Text style={styles.anonymousButtonText}>비회원 댓글 작성</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.anonymousNotice}>
                로그인하지 않고도 댓글을 작성할 수 있습니다. 4자리 비밀번호로 수정/삭제가 가능합니다.
              </Text>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* 경험치 획득 모달 */}
        {experienceData && (
          <ExperienceModal
            visible={showExperienceModal}
            onClose={handleExperienceModalClose}
            data={experienceData}
          />
        )}

        {/* 신고 모달 */}
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetId={reportTargetId}
          targetType={reportTargetType}
          targetContent={reportTargetContent}
          postId={reportTargetType === 'comment' ? reportPostId : undefined}
          onSuccess={() => {
            setShowReportModal(false);
            Alert.alert('완료', '신고가 접수되었습니다.');
          }}
          boardCode={post.boardCode}
          schoolId={post.schoolId}
          regions={post.regions}
        />

        {/* 익명 댓글 작성 폼 */}
        {post && (
          <AnonymousCommentForm
            visible={showAnonymousForm}
            postId={post.id}
            onSuccess={handleAnonymousCommentSuccess}
            onCancel={() => setShowAnonymousForm(false)}
          />
        )}

        {/* 익명 댓글 비밀번호 확인 모달 */}
        {passwordModalData && post && (
          <AnonymousPasswordModal
            visible={showPasswordModal}
            onClose={() => {
              setShowPasswordModal(false);
              setPasswordModalData(null);
            }}
            onSuccess={handlePasswordVerifySuccess}
            postId={post.id}
            commentId={passwordModalData.commentId}
            action={passwordModalData.action}
          />
        )}

        {/* 비회원 댓글/답글 작성 모달 */}
        <Modal
          visible={showGuestCommentForm}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowGuestCommentForm(false)}>
                <Text style={styles.modalCancelButton}>취소</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {guestReplyingTo ? `${guestReplyingTo.author}님에게 답글` : '비회원 댓글 작성'}
              </Text>
              <TouchableOpacity 
                onPress={guestReplyingTo ? handleGuestReplySubmit : handleGuestCommentSubmit}
                disabled={!guestNickname.trim() || !(guestReplyingTo ? guestReplyContent.trim() : guestComment.trim()) || guestPassword.length !== 4}
              >
                <Text style={[
                  styles.modalSubmitButton,
                  (!guestNickname.trim() || !(guestReplyingTo ? guestReplyContent.trim() : guestComment.trim()) || guestPassword.length !== 4) && styles.modalSubmitButtonDisabled
                ]}>작성</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.guestInputContainer}>
                <Text style={styles.inputLabel}>닉네임 *</Text>
                <TextInput
                  style={styles.guestInput}
                  placeholder="닉네임을 입력하세요"
                  value={guestNickname}
                  onChangeText={setGuestNickname}
                  maxLength={20}
                />
              </View>

              <View style={styles.guestInputContainer}>
                <Text style={styles.inputLabel}>비밀번호 (4자리) *</Text>
                <TextInput
                  style={styles.guestInput}
                  placeholder="수정/삭제를 위한 4자리 숫자"
                  value={guestPassword}
                  onChangeText={setGuestPassword}
                  secureTextEntry
                  maxLength={4}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.guestInputContainer}>
                <Text style={styles.inputLabel}>
                  {guestReplyingTo ? '답글 내용' : '댓글 내용'} *
                </Text>
                <TextInput
                  style={[styles.guestInput, styles.guestTextArea]}
                  placeholder={guestReplyingTo ? `${guestReplyingTo.author}님에게 답글을 작성하세요...` : '댓글을 작성하세요...'}
                  value={guestReplyingTo ? guestReplyContent : guestComment}
                  onChangeText={guestReplyingTo ? setGuestReplyContent : setGuestComment}
                  multiline
                  maxLength={1000}
                  textAlignVertical="top"
                />
              </View>

              <Text style={styles.guestNotice}>
                * 비회원 댓글은 4자리 비밀번호로 수정/삭제할 수 있습니다.
              </Text>
            </View>
          </SafeAreaView>
        </Modal>


      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 0,
    shadowOpacity: 0,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    marginHorizontal: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    // paddingBottom은 동적으로 적용됨
  },
  postContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  badgeText: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 28,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorAvatarContainer: {
    marginRight: 12,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  authorTextInfo: {
    flex: 1,
  },
  authorMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  boardTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  boardTypeBadge: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  boardTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  postDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  viewCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  postContent: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'left',
  },
  attachmentSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  attachmentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  imageScrollView: {
    paddingVertical: 4,
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#e5e7eb',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButtonsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  commentSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  commentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  commentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  commentBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  commentBadgeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 8,
  },
  loadMoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  commentContainer: {
    marginBottom: 12,
  },
  replyContainer: {
    marginLeft: 24,
    marginTop: 8,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
  },
  commentWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeProfileImageStyle: {
    // SafeProfileImage 컴포넌트용 스타일
  },
  anonymousAvatar: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginLeft: 8,
  },
  commentDate: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
  deletedCommentText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  commentContent: {
    marginLeft: 32, // 프로필 이미지 크기(24) + 여백(8) = 32
    marginTop: 4,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#64748b',
  },
  replyInputContainer: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  replyInput: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    padding: 0,
    marginBottom: 8,
  },
  replyButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  replyButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  replyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  replyCancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  replyCancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },

  replyToIndicator: {
    backgroundColor: '#e0f2fe', // 답글 힌트 배경색
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyToIndicatorText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  replyToAuthorHighlight: {
    color: '#2563eb',
  },

  commentInputContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  commentInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 120,
    backgroundColor: '#f9fafb',
  },
  commentSubmitButton: {
    padding: 10,
  },
  
  // 익명 댓글 관련 스타일
  anonymousCommentContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  anonymousCommentButton: {
    marginBottom: 8,
  },
  anonymousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  anonymousButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  anonymousNotice: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  imageBadgeContainer: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  imageBadgeText: {
    fontSize: 12,
    color: '#c2410c',
    fontWeight: '600',
  },
  pollBadgeContainer: {
    backgroundColor: '#faf5ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#d8b4fe',
  },
  pollBadgeText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '600',
  },
  clickableAuthor: {
    color: '#3b82f6',
  },
  blockedCommentContent: {
    backgroundColor: '#f0fdf4', // 차단된 댓글 배경색
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
  },
  blockedCommentText: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  blockedUserName: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '600',
  },
  commentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  commentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImageTouchable: {
    borderRadius: 16,
  },
  authorNameTouchable: {
    borderRadius: 4,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  likeCount: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  likedCount: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 4,
  },
  moreButton: {
    padding: 8,
    marginLeft: 8,
  },
  repliesContainer: {
    marginLeft: 20,
    marginTop: 8,
  },
  likedText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 4,
  },
  
  // 답글 및 익명 모드 스타일
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyText: {
    fontSize: 14,
    color: '#374151',
  },
  commentOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  anonymousToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    gap: 4,
  },
  anonymousToggleActive: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  anonymousToggleText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  anonymousToggleTextActive: {
    color: '#10b981',
  },
  anonymousInputs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  anonymousInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  // 비회원 댓글 모달 스타일
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalSubmitButton: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  modalSubmitButtonDisabled: {
    color: '#9ca3af',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  guestInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  guestInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  guestTextArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  guestNotice: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  
  // 인라인 댓글 편집 스타일
  editingContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  editingInput: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  editingSaveButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editingSaveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  editingCancelButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editingCancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // 링크 텍스트 스타일
  linkText: {
    color: '#2563eb',
    textDecorationLine: 'underline',
  },
  suspensionNotice: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  suspensionText: {
    fontSize: 16,
    color: '#b91c1c',
    fontWeight: '600',
    marginBottom: 8,
  },
  suspensionReasonText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
  },
}); 