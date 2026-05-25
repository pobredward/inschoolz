"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BoardType } from "@/types/board";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, BarChart, Tag } from "lucide-react";
import RichTextEditor from "@/components/editor/RichTextEditor";
import PollEditor, { PollData } from "@/components/editor/PollEditor";
import { Switch } from "@/components/ui/switch";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { getBoard } from "@/lib/api/boards";
import { Board } from "@/types";
import CategorySelector, { CategoryButton } from "./CategorySelector";
import { awardPostExperience } from "@/lib/experience-service";
import { ExperienceModal } from "@/components/ui/experience-modal";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { SuspensionBanner } from "@/components/ui/suspension-notice";
import { useQuestTracker } from "@/hooks/useQuestTracker";

// 이미지 압축 함수
const compressImage = (file: File, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    // 파일 크기 제한 (20MB)
    const MAX_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      reject(new Error('이미지 크기는 20MB 이하여야 합니다.'));
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas를 생성할 수 없습니다.'));
      return;
    }

    const img = new Image();
    
    // 이미지 로드 실패 처리
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('이미지를 로드할 수 없습니다. 파일이 손상되었을 수 있습니다.'));
    };
    
    img.onload = () => {
      try {
        // 파일 크기에 따른 압축 비율 계산
        const fileSize = file.size;
        let compressionRatio = 1;
        
        if (fileSize > 4 * 1024 * 1024) { // 4MB 이상
          compressionRatio = 0.25; // 4배 압축
        } else if (fileSize > 1 * 1024 * 1024) { // 1MB 이상
          compressionRatio = 0.5; // 2배 압축
        }
        
        canvas.width = img.width * compressionRatio;
        canvas.height = img.height * compressionRatio;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            // URL 메모리 해제
            URL.revokeObjectURL(img.src);
            
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('이미지 압축에 실패했습니다.'));
            }
          },
          file.type,
          quality
        );
      } catch (error) {
        URL.revokeObjectURL(img.src);
        reject(error);
      }
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// Firebase Storage에 이미지 업로드
const uploadImageToStorage = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Firebase Storage 업로드 오류:', error);
    throw error;
  }
};

interface WritePageClientProps {
  type: BoardType;
  code: string;
  schoolId?: string;
  regions?: {
    sido: string;
    sigungu: string;
  };
}

export default function WritePageClient({ type, code, schoolId, regions }: WritePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, suspensionStatus } = useAuth();
  const { trackCreatePost } = useQuestTracker();
  
  // 컴포넌트 마운트 시 상태 로깅
  useEffect(() => {
    console.log('=== WritePageClient 마운트 ===');
    console.log('type:', type);
    console.log('code:', code);
    console.log('schoolId:', schoolId);
    console.log('regions:', regions);
    console.log('user:', user);
    console.log('suspensionStatus:', suspensionStatus);
    console.log('searchParams:', searchParams.toString());
  }, [type, code, schoolId, regions, user, suspensionStatus, searchParams]);
  
  // 로그인 상태 확인
  useEffect(() => {
    if (user === null) {
      // 사용자 로딩 중
      console.log('사용자 정보 로딩 중...');
      return;
    }
    
    if (!user) {
      // 로그인되지 않음
      console.log('로그인되지 않음, 로그인 페이지로 리디렉션');
      router.push('/login');
      return;
    }
  }, [user, router]);
  
  // 정지 상태 확인
  useEffect(() => {
    if (user && suspensionStatus?.isSuspended) {
      const message = suspensionStatus.isPermanent 
        ? "계정이 영구 정지되어 게시글을 작성할 수 없습니다."
        : `계정이 정지되어 게시글을 작성할 수 없습니다. (남은 기간: ${suspensionStatus.remainingDays}일)`;
      
      toast.error(message);
      router.push("/");
      return;
    }
  }, [user, suspensionStatus, router]);

  const [board, setBoard] = useState<Board | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | undefined>();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [pollData, setPollData] = useState<PollData>({
    question: "",
    options: [
      { id: "option-1", text: "" },
      { id: "option-2", text: "" }
    ]
  });
  const [attachments, setAttachments] = useState<{ type: 'image' | 'file'; url: string; name: string; size: number }[]>([]);
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
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  // URL에서 카테고리 정보 가져오기
  const categoryId = searchParams.get("category");
  const categoryName = searchParams.get("categoryName");

  // 게시판 정보 로드
  useEffect(() => {
    const loadBoard = async () => {
      if (!code) {
        console.error('WritePageClient - code is undefined or empty');
        return;
      }
      
      try {
        const boardData = await getBoard(code);
        setBoard(boardData);
        
        // URL에서 카테고리 정보가 있으면 설정
        if (categoryId && categoryName) {
          setSelectedCategory({ id: categoryId, name: categoryName });
        } else if (boardData?.categories && boardData.categories.length > 0) {
          // 카테고리가 있는 게시판인데 URL에 카테고리 정보가 없으면 모달 표시
          setShowCategorySelector(true);
        }
      } catch (error) {
        console.error("게시판 정보 로드 실패:", error);
        toast.error("게시판 정보를 불러오는데 실패했습니다.");
      }
    };

    loadBoard();
  }, [code, categoryId, categoryName]);
  
  const handleBack = () => {
    router.back();
  };

  const handleCategorySelect = (category: { id: string; name: string }) => {
    setSelectedCategory(category);
    setShowCategorySelector(false);
    
    // URL에 카테고리 정보 추가
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", category.id);
    params.set("categoryName", category.name);
    router.replace(`/board/${type}/${code}/write?${params.toString()}`);
  };

  const handleCategoryChange = () => {
    setShowCategorySelector(true);
  };
  
  // 투표 옵션이 유효한지 확인
  const isPollValid = () => {
    if (!isPollEnabled) return true;
    
    const hasValidOptions = pollData.options.length >= 2 && 
      pollData.options.every(option => option.text.trim().length > 0);
    
    return hasValidOptions;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    console.log('=== handleSubmit 호출됨 ===');
    console.log('이벤트:', e);
    console.log('사용자:', user);
    console.log('게시판:', board);
    console.log('제목:', title);
    console.log('내용:', content);
    
    e.preventDefault();
    
    if (!user) {
      console.log('로그인되지 않음');
      toast.error("로그인이 필요합니다.");
      return;
    }

    if (!board) {
      console.log('게시판 정보 없음');
      toast.error("게시판 정보를 불러오는 중입니다.");
      return;
    }

    // 카테고리가 있는 게시판인데 카테고리를 선택하지 않은 경우
    if (board.categories && board.categories.length > 0 && !selectedCategory) {
      toast.error("카테고리를 선택해주세요.");
      setShowCategorySelector(true);
      return;
    }
    
    if (!title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }
    
    if (!content.trim()) {
      toast.error("내용을 입력해주세요.");
      return;
    }
    
    if (isPollEnabled && !isPollValid()) {
      toast.error("투표는 최소 2개의 선택지를 입력해주세요.");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 안전한 사용자 이름 처리
      const getUserDisplayName = () => {
        if (isAnonymous) return "익명";
        return user.profile?.userName || user.email?.split('@')[0] || "사용자";
      };

      // Firestore에 게시글 저장
      const postData = {
        type: type,
        boardCode: code,
        boardName: board.name, // boardName 추가
        title: title.trim(),
        content: content.trim(),
        // category가 있을 때만 포함시키기
        ...(selectedCategory && { category: selectedCategory }),
        authorId: user.uid,
        authorInfo: {
          displayName: getUserDisplayName(),
          isAnonymous: isAnonymous,
        },
        // 학교와 지역 정보 추가 (URL 파라미터로 전달받은 정보 우선 사용)
        ...(type === 'school' && (schoolId || user.school?.id) && { schoolId: schoolId || user.school?.id }),
        ...(type === 'regional' && (regions || user.regions) && {
          regions: {
            sido: regions?.sido || user.regions.sido,
            sigungu: regions?.sigungu || user.regions.sigungu
          }
        }),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: {
          isPinned: false,
          isDeleted: false,
          isHidden: false,
        },
        stats: {
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
        },
        attachments: attachments, // 첨부파일 포함
        tags: [],
        ...(isPollEnabled && pollData.options.filter(option => option.text.trim()).length >= 2 && {
          poll: {
            isActive: true,
            question: '', // 질문 없이 빈 문자열
            options: pollData.options
              .filter(option => option.text.trim())
              .map((option, index) => {
                const pollOption: {
                  text: string;
                  voteCount: number;
                  index: number;
                  imageUrl?: string;
                } = {
                  text: option.text.trim(),
                  voteCount: 0,
                  index
                }
                // imageUrl이 있을 때만 추가
                if (option.imageUrl) {
                  pollOption.imageUrl = option.imageUrl
                }
                return pollOption
              }),
            voters: [],
          }
        })
      };
      
      console.log('게시글 데이터:', postData); // 디버깅용
      
      // 실제 Firestore에 저장
      const docRef = await addDoc(collection(db, "posts"), postData);
      const postId = docRef.id;
      
      console.log('✅ 게시글 작성 완료:', postId);
      
      // 퀘스트 트래킹: 게시글 작성 (4단계)
      try {
        console.log('🎯 퀘스트 트래킹 시작: 게시글 작성');
        await trackCreatePost();
        console.log('✅ 퀘스트 트래킹 완료');
      } catch (questError) {
        console.error('❌ 퀘스트 트래킹 오류 (게시글은 정상 작성됨):', questError);
      }
      
      // 경험치 부여
      try {
        const expResult = await awardPostExperience(user.uid);
        if (expResult.success) {
          setExperienceData({
            expGained: expResult.expGained,
            activityType: 'post',
            leveledUp: expResult.leveledUp,
            oldLevel: expResult.oldLevel,
            newLevel: expResult.newLevel,
            currentExp: expResult.currentExp,
            expToNextLevel: expResult.expToNextLevel,
            remainingCount: expResult.remainingCount,
            totalDailyLimit: expResult.totalDailyLimit,
            reason: expResult.reason
          });
          setPendingPostId(postId);
          setShowExperienceModal(true);
        } else {
          // 경험치 부여 실패 시 즉시 커뮤니티 탭으로 이동
          let communityUrl = '';
          
          switch (type) {
            case 'national':
              communityUrl = `/community?tab=national`;
              break;
            case 'regional':
              // props로 받은 지역 정보 우선 사용, 없으면 사용자의 지역 정보 사용
              const targetSido = regions?.sido || user?.regions?.sido;
              const targetSigungu = regions?.sigungu || user?.regions?.sigungu;
              if (targetSido && targetSigungu) {
                communityUrl = `/community?tab=regional/${encodeURIComponent(targetSido)}/${encodeURIComponent(targetSigungu)}`;
              }
              break;
            case 'school':
              // URL에서 받은 schoolId 우선 사용, 없으면 사용자의 학교 ID 사용
              const targetSchoolId = schoolId || user?.school?.id;
              if (targetSchoolId) {
                communityUrl = `/community?tab=school/${targetSchoolId}`;
              }
              break;
          }
          
          if (communityUrl) {
            sessionStorage.setItem('from-write', 'true');
            router.replace(communityUrl);
          }
        }
      } catch (expError) {
        console.error('경험치 부여 실패:', expError);
        // 경험치 부여 실패는 게시글 작성 성공에 영향을 주지 않음
        let communityUrl = '';
        
        switch (type) {
          case 'national':
            communityUrl = `/community?tab=national`;
            break;
          case 'regional':
            // props로 받은 지역 정보 우선 사용, 없으면 사용자의 지역 정보 사용
            const targetSido2 = regions?.sido || user?.regions?.sido;
            const targetSigungu2 = regions?.sigungu || user?.regions?.sigungu;
            if (targetSido2 && targetSigungu2) {
              communityUrl = `/community?tab=regional/${encodeURIComponent(targetSido2)}/${encodeURIComponent(targetSigungu2)}`;
            }
            break;
          case 'school':
            // URL에서 받은 schoolId 우선 사용, 없으면 사용자의 학교 ID 사용
            const targetSchoolId = schoolId || user?.school?.id;
            if (targetSchoolId) {
              communityUrl = `/community?tab=school/${targetSchoolId}`;
            }
            break;
        }
        
        if (communityUrl) {
          sessionStorage.setItem('from-write', 'true');
          router.push(communityUrl);
        }
      }
      
      toast.success("게시글이 작성되었습니다.");
    } catch (error: unknown) {
      console.error("게시글 작성 실패:", error);
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다";
      toast.error(`게시글 작성에 실패했습니다: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = (attachment: { type: 'image'; url: string; name: string; size: number }) => {
    setAttachments(prev => [...prev, attachment]);
  };

  // 이미지 삭제 핸들러 (웹용 - 현재는 직접 삭제만 지원)
  const handleImageRemove = (imageUrl: string) => {
    console.log('이미지 삭제:', imageUrl);
    setAttachments(prev => prev.filter(attachment => attachment.url !== imageUrl));
  };

  // 투표 옵션 이미지 업로드 (실제 업로드 구현 필요)
  const handlePollImageUpload = async (file: File): Promise<string> => {
    try {
      // 파일 크기 검증 (10MB)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast.error('이미지 크기는 10MB 이하여야 합니다.');
        throw new Error('파일 크기 초과');
      }

      // 파일 형식 검증
      const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error('JPG, PNG, GIF, WebP 형식의 이미지만 업로드 가능합니다.');
        throw new Error('지원하지 않는 파일 형식');
      }

      // 이미지 압축
      const compressedFile = await compressImage(file);
      // Firebase Storage에 업로드
      const path = `posts/${user?.uid}/${Date.now()}-${compressedFile.name}`;
      const imageUrl = await uploadImageToStorage(compressedFile, path);
      return imageUrl;
    } catch (error) {
      console.error('투표 이미지 업로드 실패:', error);
      if (error instanceof Error && !error.message.includes('파일')) {
        toast.error('이미지 업로드에 실패했습니다.');
      }
      throw error;
    }
  };

  // 경험치 모달 닫기 핸들러
  const handleExperienceModalClose = () => {
    setShowExperienceModal(false);
    // 모달 닫기 후 커뮤니티 탭으로 이동
    if (pendingPostId) {
      let communityUrl = '';
      
      switch (type) {
        case 'national':
          communityUrl = `/community?tab=national`;
          break;
        case 'regional':
          // props로 받은 지역 정보 우선 사용, 없으면 사용자의 지역 정보 사용
          const targetSido3 = regions?.sido || user?.regions?.sido;
          const targetSigungu3 = regions?.sigungu || user?.regions?.sigungu;
          if (targetSido3 && targetSigungu3) {
            communityUrl = `/community?tab=regional/${encodeURIComponent(targetSido3)}/${encodeURIComponent(targetSigungu3)}`;
          }
          break;
        case 'school':
          // URL에서 받은 schoolId 우선 사용, 없으면 사용자의 학교 ID 사용
          const targetSchoolId = schoolId || user?.school?.id;
          if (targetSchoolId) {
            communityUrl = `/community?tab=school/${targetSchoolId}`;
          }
          break;
      }
      
      if (communityUrl) {
        sessionStorage.setItem('from-write', 'true');
        router.replace(communityUrl);
      }
      setPendingPostId(null);
    }
    setExperienceData(null);
  };

  // 로딩 중
  if (!board) {
    return (
      <div className="min-h-screen bg-gray-50 md:bg-white">
        <div className="container mx-auto py-8 px-2 sm:px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p className="text-gray-600">게시판 정보를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 로그인되지 않은 경우 로그인 안내 표시
  if (user === null) {
    return (
      <div className="min-h-screen bg-gray-50 md:bg-white">
        <div className="container mx-auto py-8 px-2 sm:px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-4"></div>
                <p className="text-gray-600">사용자 정보를 불러오는 중...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 md:bg-white">
        <div className="container mx-auto py-8 px-2 sm:px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <div className="text-center px-4">
                <div className="text-4xl mb-4">🔒</div>
                <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-2">로그인이 필요합니다</h2>
                <p className="text-sm md:text-base text-gray-600 mb-6">게시글을 작성하려면 로그인해주세요.</p>
                <Button 
                  onClick={() => router.push('/login')}
                  className="bg-green-500 hover:bg-green-600 text-white h-12 md:h-10 px-6"
                >
                  로그인하기
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 정지된 사용자에게 정지 배너 표시
  if (user && suspensionStatus?.isSuspended) {
    return (
      <div className="container mx-auto px-4 py-8">
        <SuspensionBanner 
          suspensionStatus={suspensionStatus}
          onDismiss={() => router.push('/')}
        />
      </div>
    );
  }

  // 게시글 작성 화면
  return (
    <div className="min-h-screen bg-gray-50 md:bg-white">
      <div className="sticky top-0 z-10 bg-white border-b md:static md:border-0">
        <div className="container mx-auto px-2 sm:px-4 md:px-6">
          <div className="flex items-center justify-between h-14 md:h-16">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="flex items-center gap-2 p-2 md:p-3"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">뒤로가기</span>
            </Button>
            
            {selectedCategory && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Tag className="w-3 h-3 md:w-4 md:h-4" />
                <span className="truncate max-w-20 sm:max-w-none">{selectedCategory.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="container mx-auto py-2 px-2 sm:px-4 md:py-8 md:px-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="px-3 py-4 md:px-6 md:py-6">
              <CardTitle className="text-lg md:text-xl">게시글 작성</CardTitle>
              <CardDescription className="text-sm">
                {board.name} 게시판에 새로운 글을 작성해보세요.
              </CardDescription>
            </CardHeader>
          
          <form onSubmit={handleSubmit}>
            <CardContent className="px-3 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
              {/* 카테고리 선택 */}
              {board.categories && board.categories.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2">
                    <Tag className="h-4 w-4" />
                    <span>카테고리</span>
                  </Label>
                  <CategoryButton
                    selectedCategory={selectedCategory}
                    onClick={handleCategoryChange}
                  />
                </div>
              )}

              {/* 제목 */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">제목</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  required
                  className="text-base md:text-sm"
                />
              </div>

              {/* 내용 */}
              <div className="space-y-2">
                <Label htmlFor="content" className="text-sm font-medium">내용</Label>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="내용을 입력하세요"
                  onImageUpload={handleImageUpload}
                  onImageRemove={handleImageRemove}
                />
              </div>

              {/* 투표 기능 */}
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="poll-enabled"
                    checked={isPollEnabled}
                    onCheckedChange={setIsPollEnabled}
                  />
                  <Label htmlFor="poll-enabled" className="flex items-center gap-2 text-sm">
                    <BarChart className="w-4 h-4" />
                    투표 추가
                  </Label>
                </div>
                
                {isPollEnabled && (
                  <PollEditor
                    pollData={pollData}
                    onChange={setPollData}
                    onImageUpload={handlePollImageUpload}
                  />
                )}
              </div>

              {/* 익명 옵션 */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="anonymous"
                  checked={isAnonymous}
                  onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
                />
                <Label htmlFor="anonymous" className="text-sm">익명으로 작성</Label>
              </div>
            </CardContent>

            <CardFooter className="px-3 py-4 md:px-6 md:py-6 bg-gray-50 md:bg-transparent border-t md:border-0">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 md:h-10 text-base md:text-sm font-medium"
                onClick={(e) => {
                  console.log('=== 버튼 클릭됨 ===');
                  console.log('클릭 이벤트:', e);
                  console.log('버튼 disabled 상태:', isSubmitting);
                  console.log('form 요소:', e.currentTarget.form);
                }}
              >
                {isSubmitting ? (
                  <>
                    <Save className="w-4 h-4 mr-2 animate-spin" />
                    작성 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    게시글 작성
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* 카테고리 선택 모달 */}
        {board && (
          <CategorySelector
            board={board}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            isOpen={showCategorySelector}
            onClose={() => setShowCategorySelector(false)}
          />
        )}

          {/* 카테고리 선택 모달 */}
          {board && (
            <CategorySelector
              board={board}
              selectedCategory={selectedCategory}
              onCategorySelect={handleCategorySelect}
              isOpen={showCategorySelector}
              onClose={() => setShowCategorySelector(false)}
            />
          )}

          {/* 경험치 획득 모달 */}
          {experienceData && (
            <ExperienceModal
              isOpen={showExperienceModal}
              onClose={handleExperienceModalClose}
              data={experienceData}
            />
          )}
        </div>
      </div>
    </div>
  );
} 