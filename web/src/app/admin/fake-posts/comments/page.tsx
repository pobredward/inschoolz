"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MessageCircle, Trash2, RefreshCw, Play, Settings, Search, Calendar, Edit3, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

interface Comment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorNickname: string;
  postTitle: string;
  schoolName: string;
  schoolId: string;
  createdAt: string;
  fake: boolean;
}

interface CommentStats {
  total: number;
  todayGenerated: number;
}

export default function CommentsManagementPage() {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [stats, setStats] = useState<CommentStats>({
    total: 0,
    todayGenerated: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // 댓글 목록 조회
  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/comments?limit=100`);
      const result = await response.json();

      if (result.success) {
        setComments(result.data);
        
        // 통계 계산
        const newStats = {
          total: result.data.length,
          todayGenerated: result.data.filter((c: Comment) => {
            const today = new Date().toDateString();
            return new Date(c.createdAt).toDateString() === today;
          }).length
        };
        setStats(newStats);
        
        console.log(`📊 ${result.data.length}개의 AI 댓글을 조회했습니다.`);
      } else {
        throw new Error(result.error || '댓글 조회 실패');
      }
    } catch (error) {
      console.error('댓글 조회 오류:', error);
      toast.error('댓글을 조회하는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // AI 댓글 생성
  const generateComments = async () => {
    try {
      setIsGenerating(true);
      const response = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schoolLimit: 5,
          commentsPerSchool: 3,
          maxCommentsPerPost: 2
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('AI 댓글 생성이 시작되었습니다. 잠시 후 새로고침해주세요.');
        setTimeout(() => {
          fetchComments();
        }, 10000); // 10초 후 자동 새로고침
      } else {
        throw new Error(result.error || '댓글 생성 실패');
      }
    } catch (error) {
      console.error('댓글 생성 오류:', error);
      toast.error('댓글 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setDeletingIds(prev => new Set(prev).add(commentId));
      
      const response = await fetch(`/api/admin/comments?id=${commentId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast.success('댓글이 삭제되었습니다.');
        fetchComments(); // 목록 새로고침
      } else {
        throw new Error(result.error || '댓글 삭제 실패');
      }
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      toast.error('댓글 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  // 댓글 수정 시작
  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  // 댓글 수정 취소
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // 댓글 수정 저장
  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) {
      toast.error('댓글 내용을 입력해주세요.');
      return;
    }

    if (editContent.length > 500) {
      toast.error('댓글은 500자 이하로 작성해주세요.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/comments?id=${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: editContent.trim()
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('댓글이 수정되었습니다.');
        
        // 로컬 상태 업데이트
        setComments(prev => prev.map(comment => 
          comment.id === commentId 
            ? { ...comment, content: editContent.trim() }
            : comment
        ));
        
        // 수정 모드 종료
        setEditingId(null);
        setEditContent('');
      } else {
        throw new Error(result.error || '댓글 수정 실패');
      }
    } catch (error) {
      console.error('댓글 수정 오류:', error);
      toast.error('댓글 수정 중 오류가 발생했습니다.');
    }
  };

  // 게시글로 이동하는 함수
  const getPostUrl = (comment: Comment) => {
    // 게시글 URL 생성 - schoolId가 있으면 정확한 URL, 없으면 fast 모드
    if (comment.schoolId) {
      return `/community/school/${comment.schoolId}/free/${comment.postId}/fast`;
    }
    // schoolId가 없는 경우 fast 모드 사용
    return `/community/school/unknown/free/${comment.postId}/fast`;
  };

  // 필터링된 댓글 목록
  const filteredComments = comments.filter(comment => {
    const matchesSearch = searchTerm === '' || 
      comment.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.authorNickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.postTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comment.schoolName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  useEffect(() => {
    fetchComments();
  }, []);

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            관리자
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href="/admin/fake-posts" className="text-muted-foreground hover:text-foreground">
            AI 게시글 관리
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">댓글 관리</span>
        </div>
        <h1 className="text-3xl font-bold">💬 AI 댓글 관리</h1>
        <p className="text-muted-foreground">AI가 생성한 댓글을 확인하고 삭제할 수 있습니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">전체 댓글</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">오늘 생성</p>
                <p className="text-2xl font-bold text-purple-600">{stats.todayGenerated}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 컨트롤 패널 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            댓글 관리 도구
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            {/* 댓글 생성 */}
            <Button
              onClick={generateComments}
              disabled={isGenerating}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isGenerating ? '댓글 생성 중...' : 'AI 댓글 생성'}
            </Button>

            {/* 새로고침 */}
            <Button
              variant="outline"
              onClick={fetchComments}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>

            {/* 검색 */}
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4" />
              <Input
                placeholder="댓글 내용, 작성자, 게시글 제목으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 댓글 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>댓글 목록 ({filteredComments.length}개)</CardTitle>
          <CardDescription>
            AI가 생성한 댓글들을 확인하고 필요시 삭제할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p>댓글을 불러오는 중...</p>
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">댓글이 없습니다</h3>
              <p className="text-gray-500 mb-4">AI 댓글을 생성해보세요.</p>
              <Button onClick={generateComments} disabled={isGenerating}>
                <Play className="h-4 w-4 mr-2" />
                AI 댓글 생성
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComments.map((comment) => (
                <div key={comment.id} className="border rounded-lg p-4 space-y-3">
                  {/* 댓글 헤더 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-blue-600">
                        {comment.authorNickname}
                      </span>
                      <span className="text-sm text-gray-500">
                        • {comment.schoolName}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.createdAt).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* 게시글로 이동 버튼 */}
                      <Link href={getPostUrl(comment)} target="_blank">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          게시글 보기
                        </Button>
                      </Link>
                      
                      {/* 수정 버튼 */}
                      {editingId !== comment.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(comment)}
                        >
                          <Edit3 className="h-3 w-3 mr-1" />
                          수정
                        </Button>
                      )}
                      
                      {/* 삭제 버튼 */}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deletingIds.has(comment.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        {deletingIds.has(comment.id) ? '삭제 중...' : '삭제'}
                      </Button>
                    </div>
                  </div>

                  {/* 게시글 정보 */}
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500 mb-1">원본 게시글:</p>
                    <p className="text-sm font-medium">{comment.postTitle}</p>
                  </div>

                  {/* 댓글 내용 */}
                  <div className="bg-blue-50 rounded p-3">
                    {editingId === comment.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full p-2 border rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                          maxLength={500}
                          placeholder="댓글 내용을 입력하세요..."
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {editContent.length}/500자
                          </span>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              취소
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={!editContent.trim()}
                            >
                              저장
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm">{comment.content}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
