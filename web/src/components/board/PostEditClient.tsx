"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { PlusCircle, X, BarChart, ChevronLeft, ImagePlus } from "lucide-react";
import { BoardType } from "@/types/board";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/components/ui/use-toast";
import RichTextEditor from "@/components/editor/RichTextEditor";
import { FirebaseTimestamp } from '@/types';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import PollEditor, { PollData } from '@/components/editor/PollEditor';

// 이미지 압축 함수
const compressImage = (file: File, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
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
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        },
        file.type,
        quality
      );
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

interface PostEditClientProps {
  post: {
    id: string;
    title: string;
    content: string;
    authorInfo: {
      isAnonymous: boolean;
    };
    tags: string[];
    poll?: {
      isActive: boolean;
      question: string;
      options: { 
        text: string; 
        imageUrl?: string;
        voteCount: number;
        index: number;
      }[];
      expiresAt?: FirebaseTimestamp;
      multipleChoice: boolean;
    };
    authorId: string;
    boardCode: string;
  };
  board: {
    allowAnonymous: boolean;
    allowPolls: boolean;
    id: string;
    name: string;
    description: string;
  };
  type: BoardType;
  boardCode: string;
}

// 폼 스키마 정의
const formSchema = z.object({
  title: z.string().min(2, "제목은 2자 이상이어야 합니다").max(100, "제목은 100자 이하여야 합니다"),
  content: z.string().min(5, "내용은 5자 이상이어야 합니다"),
  isAnonymous: z.boolean(),
  tags: z.array(z.string()).max(5, "태그는 최대 5개까지 추가할 수 있습니다").default([]), // 기본값 설정
});

type FormValues = z.infer<typeof formSchema>;

export function PostEditClient({ post, board, type, boardCode }: PostEditClientProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [tagInput, setTagInput] = useState("");
  const [isPollActive, setIsPollActive] = useState(!!post.poll);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollData, setPollData] = useState<PollData>({
    question: post.poll?.question || "",
    options: post.poll?.options.map((option, index) => ({
      id: `option-${index}`,
      text: option.text,
      imageUrl: option.imageUrl
    })) || [
      { id: "option-1", text: "" },
      { id: "option-2", text: "" }
    ]
  });
  const [attachments, setAttachments] = useState<{ type: 'image'; url: string; name: string; size: number }[]>([]);

  // 투표 수정 모드 - 기존 투표가 있으면 true, 없으면 false로 고정
  const hasExistingPoll = !!post.poll;
  const isPollEditMode = hasExistingPoll;

  // 폼 초기화
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: post.title,
      content: post.content,
      isAnonymous: post.authorInfo.isAnonymous,
      tags: post.tags || [], // undefined인 경우 빈 배열로 설정
    },
  });
  
  // 컴포넌트 마운트 확인 및 첨부파일 초기화
  useEffect(() => {
    // 컴포넌트가 마운트되었음을 확인 (attachments 사용)
    if (attachments) {
      // attachments 상태 초기화 완료
    }
  }, [user, isLoading, attachments]);
  
  // 권한 확인 및 초기 첨부파일 설정
  useEffect(() => {
    // 사용자 정보가 아직 로딩 중인 경우 대기
    if (isLoading) {
      return;
    }
    
    // 로딩이 완료되었는데 사용자가 없거나 (작성자가 아니고 관리자도 아닌) 경우
    const isAdmin = user?.role === 'admin';
    const isAuthor = user && user.uid === post.authorId;
    
    if (!user || (!isAuthor && !isAdmin)) {
      toast({
        title: "접근 권한이 없습니다",
        description: "본인이 작성한 게시글이거나 관리자만 수정할 수 있습니다.",
        variant: "destructive",
      });
      router.back();
      return;
    }
    
    // 게시글의 기존 첨부파일 설정 (이미지만)
    if ((post as any).attachments && Array.isArray((post as any).attachments)) {
      const imageAttachments = (post as any).attachments.filter((att: any) => att.type === 'image');
      setAttachments(imageAttachments);
    }
  }, [user, isLoading, post.authorId, router, toast]);
  
  // 폼 제출 핸들러
  const onSubmit = async (values: FormValues) => {
    console.log('🔥🔥🔥 PostEditClient: onSubmit 함수 호출됨!');
    console.log('🔥 PostEditClient: onSubmit 시작', { values });
    
    try {
      if (!user) {
        console.error('🔥 PostEditClient: 사용자가 로그인되지 않음');
        toast({
          title: "로그인이 필요합니다",
          description: "게시글을 수정하려면 로그인이 필요합니다.",
          variant: "destructive",
        });
        return;
      }
      
      // 관리자 권한 및 작성자 권한 확인
      const isAdmin = user?.role === 'admin';
      const isAuthor = user.uid === post.authorId;
      
      console.log('🔥 PostEditClient: 권한 확인', {
        userId: user.uid,
        userRole: user.role,
        isAdmin,
        isAuthor,
        postAuthorId: post.authorId,
        postFake: (post as any).fake,
        canEdit: isAdmin || isAuthor
      });
      
      if (!isAdmin && !isAuthor) {
        console.error('🔥 PostEditClient: 수정 권한 없음');
        toast({
          title: "수정 권한이 없습니다",
          description: "관리자이거나 본인이 작성한 게시글만 수정할 수 있습니다.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('🔥 PostEditClient: 권한 검증 통과, 수정 진행');
      setIsSubmitting(true);
      
      // 투표 정보는 수정하지 않음 - 기존 상태 그대로 유지
      // FormValues에 poll 필드가 없으므로 안전함
      
      const postData = {
        title: values.title,
        content: values.content,
        isAnonymous: values.isAnonymous,
        tags: values.tags,
      };
      
      // 실제 수정 함수 호출
      console.log('🔥 PostEditClient: 게시글 수정 시작', {
        postId: post.id,
        userId: user.uid,
        isAdmin,
        isAuthor,
        postFake: (post as any).fake,
        updateData: postData
      });
      
      // 관리자가 AI 게시글을 수정하는 경우와 일반 사용자가 본인 게시글을 수정하는 경우 구분
      const isAIPost = (post as any).fake === true;
      
      if (isAdmin && isAIPost) {
        // 관리자가 AI 게시글을 수정하는 경우 - 관리자 전용 API 사용
        console.log('🔥 PostEditClient: 관리자 API 사용하여 AI 게시글 수정');
        
        const response = await fetch(`/api/admin/fake-posts/${post.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({
            title: postData.title,
            content: postData.content,
            tags: postData.tags,
            isAnonymous: postData.isAnonymous
          })
        });
        
        console.log('🔥 PostEditClient: 관리자 API 응답 상태:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🔥 PostEditClient: 관리자 API 오류 응답:', errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('🔥 PostEditClient: 관리자 API 응답 데이터:', result);
        
        if (!result.success) {
          throw new Error(result.error || 'AI 게시글 수정 실패');
        }
        
        console.log('🔥 PostEditClient: 관리자 API로 AI 게시글 수정 완료');
      } else {
        // 일반 사용자가 본인 게시글을 수정하거나 관리자가 일반 게시글을 수정하는 경우
        console.log('🔥 PostEditClient: 일반 API 사용하여 게시글 수정');
        
        const { updatePost } = await import("@/lib/api/boards");
        const result = await updatePost(post.id, user.uid, {
          title: postData.title,
          content: postData.content,
          tags: postData.tags,
          isAnonymous: postData.isAnonymous
        });
        
        console.log('🔥 PostEditClient: 일반 API로 게시글 수정 완료:', result);
      }
      
      toast({
        title: "게시글 수정 완료",
        description: "게시글이 성공적으로 수정되었습니다.",
      });
      
      // 수정된 게시글로 이동
      let postUrl = '';
      
      switch (type) {
        case 'national':
          postUrl = `/community/national/${boardCode}/${post.id}`;
          break;
        case 'regional':
          // 사용자의 지역 정보 사용
          if (user?.regions?.sido && user?.regions?.sigungu) {
            postUrl = `/community/region/${encodeURIComponent(user.regions.sido)}/${encodeURIComponent(user.regions.sigungu)}/${boardCode}/${post.id}`;
          }
          break;
        case 'school':
          // 게시글에 저장된 schoolId 사용, 없으면 사용자의 학교 ID 사용
          const schoolPostId = (post as any)?.schoolId || user?.school?.id;
          if (schoolPostId) {
            postUrl = `/community/school/${schoolPostId}/${boardCode}/${post.id}`;
          }
          break;
      }
      
      if (postUrl) {
        router.push(postUrl);
      }
      } catch (error) {
        console.error('🔥 PostEditClient: 게시글 수정 오류:', error);
        
        let errorMessage = "게시글 수정 중 오류가 발생했습니다. 다시 시도해주세요.";
        
        if (error instanceof Error) {
          console.error('🔥 PostEditClient: 오류 메시지:', error.message);
          if (error.message.includes('권한')) {
            errorMessage = error.message;
          } else if (error.message.includes('찾을 수 없습니다')) {
            errorMessage = "게시글을 찾을 수 없습니다.";
          } else {
            errorMessage = error.message;
          }
        }
        
        toast({
          title: "게시글 수정 실패",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
      setIsSubmitting(false);
    }
  };
  
  // 태그 추가
  const addTag = () => {
    const tag = tagInput.trim();
    
    if (tag && !form.getValues().tags.includes(tag) && form.getValues().tags.length < 5) {
      form.setValue("tags", [...form.getValues().tags, tag]);
      setTagInput("");
    }
  };
  
  // 태그 삭제
  const removeTag = (tag: string) => {
    form.setValue("tags", form.getValues().tags.filter(t => t !== tag));
  };
  
  // Enter 키로 태그 추가
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };
  
  // 투표 옵션 이미지 업로드 함수
  const handlePollImageUpload = async (file: File): Promise<string> => {
    try {
      // 이미지 압축
      const compressedFile = await compressImage(file);
      // Firebase Storage에 업로드
      const path = `posts/${post.id}/poll/${Date.now()}-${compressedFile.name}`;
      const imageUrl = await uploadImageToStorage(compressedFile, path);
      return imageUrl;
    } catch (error) {
      console.error('투표 옵션 이미지 업로드 실패:', error);
      throw error;
    }
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = (attachment: { type: 'image'; url: string; name: string; size: number }) => {
    setAttachments(prev => [...prev, attachment]);
  };



  // 이미지 삭제 핸들러
  const handleImageRemove = (imageUrl: string) => {
    setAttachments(prev => prev.filter(attachment => attachment.url !== imageUrl));
  };

  // 로딩 중인 경우
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">로딩 중...</h2>
        <p className="text-muted-foreground">사용자 정보를 확인하고 있습니다.</p>
      </div>
    );
  }

  // 사용자가 로그인하지 않은 경우
  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold mb-4">로그인이 필요합니다</h2>
        <p className="text-muted-foreground mb-6">게시글을 수정하려면 먼저 로그인해주세요.</p>
        <Button onClick={() => router.push('/login')}>로그인하기</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <div>
            <h1 className="text-2xl font-bold">게시글 수정</h1>
            <p className="text-muted-foreground">{board.name}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={(e) => {
            console.log('🔥 PostEditClient: 폼 제출 이벤트 발생');
            console.log('🔥 PostEditClient: 폼 유효성 검사 상태:', form.formState.isValid);
            console.log('🔥 PostEditClient: 폼 오류:', form.formState.errors);
            e.preventDefault();
            console.log('🔥 PostEditClient: preventDefault 완료, handleSubmit 호출');
            form.handleSubmit(onSubmit)(e);
          }} className="space-y-8">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제목</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="제목을 입력하세요" 
                      {...field} 
                      className="text-lg py-6"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>내용</FormLabel>
                  <FormControl>
                    <RichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="내용을 입력하세요"
                      onImageUpload={handleImageUpload}
                      onImageRemove={handleImageRemove}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-6">
              {/* 태그 섹션 비활성화 */}
              {false && (
                <div>
                  <FormLabel>태그</FormLabel>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="태그를 입력하세요"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleTagKeyPress}
                      className="flex-1"
                    />
                    <Button type="button" onClick={addTag} variant="outline">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      추가
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.getValues().tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {board.allowAnonymous && (
                <FormField
                  control={form.control}
                  name="isAnonymous"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>익명 게시</FormLabel>
                        <FormDescription>
                          익명으로 게시하면 작성자 정보가 표시되지 않습니다.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              
            {/* 투표 섹션 */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="poll">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <BarChart className="h-4 w-4" />
                    <span>투표</span>
                    {hasExistingPoll && (
                      <Badge variant="secondary" className="ml-2">
                        수정 불가
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {!hasExistingPoll ? (
                    <div className="text-center p-6 text-muted-foreground bg-muted/50 rounded-lg">
                      <BarChart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        게시글 수정 시에는 새로운 투표를 추가할 수 없습니다.
                      </p>
                      <p className="text-xs mt-1">
                        투표는 게시글 작성 시에만 추가 가능합니다.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <div className="text-yellow-600 mt-0.5">⚠️</div>
                          <div>
                            <h4 className="font-medium text-yellow-800">투표 수정 제한</h4>
                            <p className="text-sm text-yellow-700 mt-1">
                              게시글 수정 시에는 기존 투표를 변경할 수 없습니다.
                              투표는 읽기 전용으로만 표시됩니다.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 읽기 전용 투표 표시 */}
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            투표 옵션
                          </label>
                          <div className="space-y-2">
                            {pollData.options.map((option, index) => (
                              <div key={option.id} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-medium text-gray-500">
                                    {index + 1}.
                                  </span>
                                  <span className="text-sm text-gray-700">
                                    {option.text || `옵션 ${index + 1}`}
                                  </span>
                                  {option.imageUrl && (
                                    <div className="ml-auto">
                                      <img 
                                        src={option.imageUrl} 
                                        alt={`옵션 ${index + 1} 이미지`}
                                        className="w-8 h-8 object-cover rounded"
                                      />
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </div>
            
            <Separator />
            
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                onClick={async (e) => {
                  console.log('🔥 PostEditClient: 수정하기 버튼 클릭됨');
                  console.log('🔥 PostEditClient: isSubmitting 상태:', isSubmitting);
                  
                  // 폼 값 가져오기 및 tags 기본값 처리
                  const formValues = form.getValues();
                  const safeFormValues = {
                    ...formValues,
                    tags: formValues.tags || [] // undefined인 경우 빈 배열로 설정
                  };
                  
                  console.log('🔥 PostEditClient: 폼 값:', safeFormValues);
                  
                  // 폼 유효성 검사
                  const isValid = await form.trigger();
                  console.log('🔥 PostEditClient: 폼 유효성 검사 결과:', isValid);
                  console.log('🔥 PostEditClient: 폼 오류:', form.formState.errors);
                  
                  if (!isValid) {
                    console.error('🔥 PostEditClient: 폼 유효성 검사 실패');
                    e.preventDefault();
                    return;
                  }
                  
                  // 폼이 유효하다면 수동으로 onSubmit 호출
                  console.log('🔥 PostEditClient: 수동으로 onSubmit 호출');
                  e.preventDefault();
                  await onSubmit(safeFormValues);
                }}
              >
                {isSubmitting ? "수정 중..." : "수정하기"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
} 