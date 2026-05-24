"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bot, Trash2, Eye, RefreshCw, Search, Calendar, School, Edit, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';
import Link from 'next/link';

interface FakePost {
  id: string;
  title: string;
  content: string;
  schoolId: string;
  schoolName: string;
  authorId: string;
  authorNickname?: string;
  boardCode: string;
  boardName: string;
  createdAt: string | null;
  stats: {
    viewCount: number;
    likeCount: number;
    commentCount: number;
  };
}

interface GenerationConfig {
  schoolLimit: number;
  postsPerSchool: number;
  delayBetweenPosts: number;
}

export default function AdminPostsPage() {
  const { user } = useAuth();
  const [fakePosts, setFakePosts] = useState<FakePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('all');
  const [editingPost, setEditingPost] = useState<FakePost | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [config, setConfig] = useState<GenerationConfig>({
    schoolLimit: 10,
    postsPerSchool: 1,
    delayBetweenPosts: 3000
  });

  // AI 게시글 목록 가져오기
  const fetchFakePosts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/fake-posts');
      const result = await response.json();
      
      if (result.success) {
        setFakePosts(result.data || []);
        toast.success(`${result.data.length}개의 AI 게시글을 조회했습니다.`);
      } else {
        throw new Error(result.error || '알 수 없는 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('AI 게시글 조회 오류:', error);
      toast.error('AI 게시글을 불러오는데 실패했습니다.');
      setFakePosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // AI 게시글 생성
  const generateFakePosts = async () => {
    try {
      setIsGenerating(true);
      const response = await fetch('/api/admin/fake-posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('AI 게시글 생성이 시작되었습니다. 잠시 후 새로고침해주세요.');
        setTimeout(() => {
          fetchFakePosts();
        }, 5000);
      } else {
        throw new Error(result.error || '게시글 생성 실패');
      }
    } catch (error) {
      console.error('AI 게시글 생성 오류:', error);
      toast.error('AI 게시글 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  // AI 게시글 삭제
  const deleteFakePost = async (postId: string) => {
    if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/admin/fake-posts?id=${postId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('게시글이 삭제되었습니다.');
        fetchFakePosts();
      } else {
        throw new Error(result.error || '삭제 실패');
      }
    } catch (error) {
      console.error('게시글 삭제 오류:', error);
      toast.error('게시글 삭제에 실패했습니다.');
    }
  };

  // AI 게시글 수정
  const updateFakePost = async (postId: string, updates: { title: string; content: string; authorNickname: string }) => {
    try {
      const response = await fetch(`/api/admin/fake-posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('게시글이 수정되었습니다.');
        setEditingPost(null);
        setIsEditing(false);
        fetchFakePosts();
      } else {
        throw new Error(result.error || '수정 실패');
      }
    } catch (error) {
      console.error('게시글 수정 오류:', error);
      toast.error('게시글 수정에 실패했습니다.');
    }
  };

  useEffect(() => {
    fetchFakePosts();
  }, []);

  // 필터링된 게시글
  const filteredPosts = fakePosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.schoolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (post.authorNickname && post.authorNickname.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesBoard = selectedBoard === 'all' || post.boardCode === selectedBoard;
    
    return matchesSearch && matchesBoard;
  });

  if (!user?.profile?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">접근 권한이 없습니다</h1>
          <p className="text-muted-foreground">관리자만 접근할 수 있는 페이지입니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin/dashboard" className="text-muted-foreground hover:text-foreground">
              관리자
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">AI 게시글 관리</span>
          </div>
          <h1 className="text-3xl font-bold">📝 AI 게시글 관리</h1>
          <p className="text-muted-foreground">AI로 생성된 게시글을 관리하고 모니터링하세요.</p>
        </div>
        <Button onClick={fetchFakePosts} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* AI 게시글 생성 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 게시글 생성</CardTitle>
          <CardDescription>
            새로운 AI 게시글을 생성합니다. 설정을 조정한 후 생성 버튼을 클릭하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="schoolLimit">대상 학교 수</Label>
              <Input
                id="schoolLimit"
                type="number"
                value={config.schoolLimit}
                onChange={(e) => setConfig({...config, schoolLimit: parseInt(e.target.value) || 0})}
                min="1"
                max="1000"
              />
            </div>
            <div>
              <Label htmlFor="postsPerSchool">학교당 게시글 수</Label>
              <Input
                id="postsPerSchool"
                type="number"
                value={config.postsPerSchool}
                onChange={(e) => setConfig({...config, postsPerSchool: parseInt(e.target.value) || 0})}
                min="1"
                max="10"
              />
            </div>
            <div>
              <Label htmlFor="delayBetweenPosts">게시글 간 딜레이 (ms)</Label>
              <Input
                id="delayBetweenPosts"
                type="number"
                value={config.delayBetweenPosts}
                onChange={(e) => setConfig({...config, delayBetweenPosts: parseInt(e.target.value) || 0})}
                min="1000"
                max="10000"
                step="1000"
              />
            </div>
          </div>
          <Button onClick={generateFakePosts} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                AI 게시글 생성 중...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                AI 게시글 생성 시작
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 검색 및 필터 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="게시글 제목, 내용, 학교명, 작성자로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 게시판</option>
              <option value="free">자유게시판</option>
              <option value="study">공부게시판</option>
              <option value="love">연애게시판</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* AI 게시글 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 게시글 목록 ({filteredPosts.length})</CardTitle>
          <CardDescription>
            생성된 AI 게시글들을 확인하고 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              AI 게시글을 불러오는 중...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || selectedBoard !== 'all' 
                ? '검색 조건에 맞는 게시글이 없습니다.' 
                : 'AI 게시글이 없습니다. 새로운 게시글을 생성해보세요.'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                            <Bot className="h-3 w-3 mr-1" />
                            AI
                          </Badge>
                          <Badge variant="outline">{post.boardName}</Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <School className="h-3 w-3" />
                            {post.schoolName}
                          </span>
                          {post.authorNickname && (
                            <span className="text-sm text-blue-600 font-medium">
                              👤 {post.authorNickname}
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-lg mb-2">{post.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {post.content}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            조회 {post.stats.viewCount}
                          </span>
                          <span>👍 {post.stats.likeCount}</span>
                          <span>💬 {post.stats.commentCount}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {post.createdAt ? new Date(post.createdAt).toLocaleDateString('ko-KR') : '날짜 없음'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/community/school/${post.schoolId}/free/${post.id}/fast`, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingPost(post);
                            setIsEditing(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteFakePost(post.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 수정 모달 */}
      {isEditing && editingPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>게시글 수정</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <EditPostForm
                post={editingPost}
                onSave={updateFakePost}
                onCancel={() => setIsEditing(false)}
                isLoading={false}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// 게시글 수정 폼 컴포넌트
function EditPostForm({
  post,
  onSave,
  onCancel,
  isLoading
}: {
  post: FakePost;
  onSave: (id: string, updates: { title: string; content: string; authorNickname: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [authorNickname, setAuthorNickname] = useState(post.authorNickname || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 입력해주세요.');
      return;
    }
    onSave(post.id, { title: title.trim(), content: content.trim(), authorNickname: authorNickname.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-author">작성자 닉네임</Label>
        <Input
          id="edit-author"
          value={authorNickname}
          onChange={(e) => setAuthorNickname(e.target.value)}
          placeholder="작성자 닉네임을 입력하세요"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <Label htmlFor="edit-title">제목</Label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="게시글 제목을 입력하세요"
          disabled={isLoading}
        />
      </div>
      
      <div>
        <Label htmlFor="edit-content">내용</Label>
        <textarea
          id="edit-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="게시글 내용을 입력하세요"
          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={isLoading}
        />
      </div>
      
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          취소
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              수정 중...
            </>
          ) : (
            '수정 완료'
          )}
        </Button>
      </div>
    </form>
  );
}
