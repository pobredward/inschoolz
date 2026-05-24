"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  School, 
  Globe, 
  Map, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  X,
  Upload,
  MessageSquare,
  Search
} from 'lucide-react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Board } from '@/types';
import { doc, collection, query, where, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Link from 'next/link';
import Image from 'next/image';

// 게시판 생성/수정 폼 검증 스키마
const boardFormSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(2, "코드는 최소 2자 이상이어야 합니다").max(20, "코드는 최대 20자까지 입력 가능합니다"),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다").max(30, "이름은 최대 30자까지 입력 가능합니다"),
  description: z.string().max(200, "설명은 최대 200자까지 입력 가능합니다"),
  type: z.enum(["national", "school", "regional"]),
  order: z.number().min(0, "순서는 0 이상이어야 합니다"),
  isActive: z.boolean(),
  isPublic: z.boolean(),
  allowAnonymous: z.boolean(),
  allowPolls: z.boolean(),
  customIcon: z.string().optional(),
  schoolId: z.string().optional(),
});

// 게시판 타입 확장
type BoardWithSchoolId = Board & {
  schoolId?: string;
  category?: string;
};

type BoardFormValues = z.infer<typeof boardFormSchema>;

// 게시판을 카테고리별로 그룹화하는 함수
const groupBoardsByCategory = (boards: BoardWithSchoolId[]) => {
  return boards.reduce((acc, board) => {
    const category = board.category || '기타';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(board);
    return acc;
  }, {} as Record<string, BoardWithSchoolId[]>);
};

export default function BoardsAdminPage() {
  const [boards, setBoards] = useState<{
    national: BoardWithSchoolId[];
    school: BoardWithSchoolId[];
    regional: BoardWithSchoolId[];
  }>({
    national: [],
    school: [],
    regional: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTab, setCurrentTab] = useState('national');

  const form = useForm<BoardFormValues>({
    resolver: zodResolver(boardFormSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      type: "national",
      order: 0,
      isActive: true,
      isPublic: true,
      allowAnonymous: false,
      allowPolls: true,
      customIcon: "",
      schoolId: "",
    }
  });

  const loadBoards = useCallback(async () => {
    setIsLoading(true);
    try {
      // 전국 게시판을 Firestore에서 직접 가져옴
      const nationalBoardsQuery = query(
        collection(db, 'boards'),
        where('type', '==', 'national')
      );
      
      // 학교 게시판은 API가 특정 학교 ID를 요구하므로 Firestore에서 직접 가져옴
      const schoolBoardsQuery = query(
        collection(db, 'boards'),
        where('type', '==', 'school')
      );
      
      // 지역 게시판도 Firestore에서 직접 가져옴
      const regionalBoardsQuery = query(
        collection(db, 'boards'),
        where('type', '==', 'regional')
      );

      const [nationalBoardsSnapshot, schoolBoardsSnapshot, regionalBoardsSnapshot] = await Promise.all([
        getDocs(nationalBoardsQuery),
        getDocs(schoolBoardsQuery),
        getDocs(regionalBoardsQuery)
      ]);

      const nationalBoards: BoardWithSchoolId[] = [];
      nationalBoardsSnapshot.forEach(doc => {
        nationalBoards.push({ id: doc.id, ...doc.data() } as BoardWithSchoolId);
      });

      const schoolBoards: BoardWithSchoolId[] = [];
      schoolBoardsSnapshot.forEach(doc => {
        schoolBoards.push({ id: doc.id, ...doc.data() } as BoardWithSchoolId);
      });

      const regionalBoards: BoardWithSchoolId[] = [];
      regionalBoardsSnapshot.forEach(doc => {
        regionalBoards.push({ id: doc.id, ...doc.data() } as BoardWithSchoolId);
      });

      setBoards({
        national: nationalBoards, // 전국 게시판
        school: schoolBoards,
        regional: regionalBoards
      });
    } catch (error) {
      console.error('게시판 로드 오류:', error);
      toast.error('게시판 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  const handleCreateBoard = () => {
    setIsEditMode(false);
    form.reset({
      code: "",
      name: "",
      description: "",
      type: currentTab as "national" | "school" | "regional",
      order: boards[currentTab as keyof typeof boards].length + 1,
      isActive: true,
      isPublic: true,
      allowAnonymous: false,
      allowPolls: true,
      customIcon: "",
      schoolId: "",
    });
    setIsDialogOpen(true);
  };

  const handleEditBoard = (board: BoardWithSchoolId) => {
    setIsEditMode(true);
    form.reset({
      id: board.id,
      code: board.code,
      name: board.name,
      description: board.description,
      type: board.type,
      order: board.order,
      isActive: board.isActive,
      isPublic: board.isPublic,
      allowAnonymous: board.allowAnonymous,
      allowPolls: board.allowPolls,
      customIcon: board.customIcon || "",
      schoolId: board.schoolId || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteBoard = async (board: Board) => {
    if (!confirm(`정말로 '${board.name}' 게시판을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'boards', board.id));
      
      setBoards(prevBoards => ({
        national: prevBoards.national.filter(b => b.id !== board.id),
        school: prevBoards.school.filter(b => b.id !== board.id),
        regional: prevBoards.regional.filter(b => b.id !== board.id),
      }));
      
      toast.success('게시판이 삭제되었습니다.');
    } catch (error) {
      console.error('게시판 삭제 오류:', error);
      toast.error('게시판 삭제 중 오류가 발생했습니다.');
    }
  };

  const onSubmit = async (values: BoardFormValues) => {
    setIsLoading(true);
    
    try {
      const boardData = {
        ...values,
        updatedAt: serverTimestamp()
      };
      
      if (isEditMode && values.id) {
        // 기존 데이터 업데이트
        const boardRef = doc(db, 'boards', values.id);
        await updateDoc(boardRef, boardData);
        toast.success('게시판 정보가 업데이트되었습니다.');
      } else {
        // 새 데이터 추가
        const newBoardRef = doc(collection(db, 'boards'));
        await setDoc(newBoardRef, {
          ...boardData,
          id: newBoardRef.id,
          createdAt: serverTimestamp(),
          stats: {
            postCount: 0,
            viewCount: 0,
            activeUserCount: 0
          }
        });
        toast.success('새로운 게시판이 추가되었습니다.');
      }
      
      setIsDialogOpen(false);
      await loadBoards(); // 목록 새로고침
    } catch (error) {
      console.error('Error saving board:', error);
      toast.error('오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 검색 필터링
  const filteredBoards = (boardType: keyof typeof boards) => {
    if (!searchQuery) return boards[boardType];
    return boards[boardType].filter(
      board => 
        board.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        board.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // 그룹화된 게시판 렌더링
  const renderBoardGroups = (boardType: keyof typeof boards) => {
    const filteredBoardsList = filteredBoards(boardType);
    
    // 카테고리가 있으면 카테고리별로 그룹화, 없으면 한 그룹으로
    const hasCategory = filteredBoardsList.some(board => board.category);
    
    if (hasCategory) {
      const groupedBoards = groupBoardsByCategory(filteredBoardsList);
      
      return (
        <Accordion type="multiple" className="w-full" defaultValue={Object.keys(groupedBoards)}>
          {Object.entries(groupedBoards).map(([category, boards]) => (
            <AccordionItem key={category} value={category}>
              <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                <div className="flex items-center">
                  <span className="font-medium">{category}</span>
                  <Badge className="ml-2">{boards.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {boards.map(board => renderBoardCard(board))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );
    } else {
      // 카테고리가 없으면 그냥 카드 목록으로 표시
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBoardsList.map(board => renderBoardCard(board))}
        </div>
      );
    }
  };

  // 게시판 카드 렌더링
  const renderBoardCard = (board: BoardWithSchoolId) => (
    <Card key={board.id} className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {board.customIcon ? (
              <div className="relative w-8 h-8 overflow-hidden rounded-md">
                <Image
                  src={board.customIcon}
                  alt={board.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <MessageSquare className="h-6 w-6" />
            )}
            <CardTitle className="text-lg">{board.name}</CardTitle>
          </div>
          <Badge 
            className={board.isActive 
              ? "bg-green-100 text-green-800" 
              : "bg-red-100 text-red-800"
            }
          >
            {board.isActive ? "활성화" : "비활성화"}
          </Badge>
        </div>
        <CardDescription className="line-clamp-2 h-10">
          {board.description || "설명이 없습니다."}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center">
            <MessageSquare className="h-4 w-4 mr-1" />
            <span>{board.stats?.postCount || 0}개의 게시글</span>
          </div>
          <div className="flex items-center">
            {board.isPublic ? (
              <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 mr-1 text-red-600" />
            )}
            <span>{board.isPublic ? "공개" : "비공개"}</span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-2 flex justify-between">
        <Link 
          href={`/community?tab=${board.type}`} 
          target="_blank"
          className="text-sm"
        >
          <Button variant="outline" size="sm">
            바로가기
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleEditBoard(board)}>
            <Pencil size={14} className="mr-1" />
            수정
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDeleteBoard(board)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">게시판 관리</h1>
          <p className="text-muted-foreground mt-1">전체 게시판을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="게시판 검색..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={handleCreateBoard}>
            <Plus size={16} className="mr-1" />
            게시판 추가
          </Button>
        </div>
      </div>

      <div className="rounded-lg border shadow-sm">
        <Tabs defaultValue="national" onValueChange={(value) => setCurrentTab(value)} className="w-full">
          <div className="flex items-center px-4 py-2 border-b">
            <TabsList className="w-full grid grid-cols-3 h-10">
              <TabsTrigger value="national" className="flex items-center gap-1">
                <Globe size={16} />
                <span>전국 게시판</span>
                <Badge variant="outline" className="ml-1">{boards.national.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="regional" className="flex items-center gap-1">
                <Map size={16} />
                <span>지역 게시판</span>
                <Badge variant="outline" className="ml-1">{boards.regional.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="school" className="flex items-center gap-1">
                <School size={16} />
                <span>학교 게시판</span>
                <Badge variant="outline" className="ml-1">{boards.school.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <TabsContent value="national" className="p-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">전국 게시판</h2>
                  <p className="text-sm text-muted-foreground">모든 사용자가 볼 수 있는 전국 단위 게시판입니다.</p>
                </div>
                {filteredBoards('national').length === 0 ? (
                  <div className="text-center py-12 border rounded-lg bg-muted/20">
                    {searchQuery ? (
                      <p className="text-muted-foreground">검색 결과가 없습니다</p>
                    ) : (
                      <p className="text-muted-foreground">등록된 게시판이 없습니다</p>
                    )}
                  </div>
                ) : (
                  renderBoardGroups('national')
                )}
              </TabsContent>
              
              <TabsContent value="school" className="p-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">학교 게시판</h2>
                  <p className="text-sm text-muted-foreground">각 학교별로 생성되는 게시판입니다.</p>
                </div>
                {filteredBoards('school').length === 0 ? (
                  <div className="text-center py-12 border rounded-lg bg-muted/20">
                    {searchQuery ? (
                      <p className="text-muted-foreground">검색 결과가 없습니다</p>
                    ) : (
                      <p className="text-muted-foreground">등록된 게시판이 없습니다</p>
                    )}
                  </div>
                ) : (
                  renderBoardGroups('school')
                )}
              </TabsContent>
              
              <TabsContent value="regional" className="p-4">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold">지역 게시판</h2>
                  <p className="text-sm text-muted-foreground">지역별로 생성되는 게시판입니다.</p>
                </div>
                {filteredBoards('regional').length === 0 ? (
                  <div className="text-center py-12 border rounded-lg bg-muted/20">
                    {searchQuery ? (
                      <p className="text-muted-foreground">검색 결과가 없습니다</p>
                    ) : (
                      <p className="text-muted-foreground">등록된 게시판이 없습니다</p>
                    )}
                  </div>
                ) : (
                  renderBoardGroups('regional')
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[625px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "게시판 수정" : "새 게시판 추가"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>게시판 유형</FormLabel>
                      <Select 
                        disabled={isEditMode}
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="게시판 유형 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="national">전국 게시판</SelectItem>
                          <SelectItem value="school">학교 게시판</SelectItem>
                          <SelectItem value="regional">지역 게시판</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>표시 순서</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0"
                          placeholder="표시 순서" 
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>게시판 코드</FormLabel>
                      <FormControl>
                        <Input 
                          disabled={isEditMode}
                          placeholder="영문 코드 (예: free_board)" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        영문, 숫자, 언더스코어(_)만 사용
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>게시판 이름</FormLabel>
                      <FormControl>
                        <Input placeholder="게시판 이름 (예: 자유게시판)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>게시판 설명</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="게시판에 대한 간단한 설명을 입력하세요." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="customIcon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>게시판 아이콘</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <div 
                          className="border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
                          onClick={() => document.getElementById('icon-upload')?.click()}
                        >
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">PNG, JPG 파일 업로드 (최대 1MB)</p>
                          <input 
                            id="icon-upload"
                            type="file" 
                            accept="image/png,image/jpeg" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  if (event.target?.result) {
                                    field.onChange(event.target.result as string);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </div>
                        
                        {field.value && (
                          <div className="mt-4 flex flex-col items-center">
                            <p className="text-sm font-medium mb-2">현재 이미지</p>
                            <div className="relative">
                              <Image
                                src={field.value}
                                alt="Uploaded icon"
                                width={80}
                                height={80}
                                className="h-20 w-20 object-contain border rounded"
                              />
                              <Button 
                                variant="destructive" 
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6"
                                onClick={() => field.onChange('')}
                                type="button"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      PNG 또는 JPG 이미지를 업로드하세요. 아이콘이 없으면 기본 아이콘이 표시됩니다.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>활성화 상태</FormLabel>
                        <FormDescription>
                          게시판을 활성화할지 여부
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
                
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>공개 여부</FormLabel>
                        <FormDescription>
                          모든 사용자에게 공개할지 여부
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
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="allowAnonymous"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>익명 게시 허용</FormLabel>
                        <FormDescription>
                          익명 게시글 작성 허용 여부
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
                
                <FormField
                  control={form.control}
                  name="allowPolls"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>투표 허용</FormLabel>
                        <FormDescription>
                          게시글 내 투표 생성 허용 여부
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
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "처리 중..." : isEditMode ? "저장하기" : "게시판 추가"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 