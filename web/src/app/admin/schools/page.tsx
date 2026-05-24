"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  School, 
  Users, 
  Heart,
  Globe,
  Power,
  PowerOff
  // MapPin,
  // Calendar,
  // Save,
  // X
} from 'lucide-react';
import { 
  adminGetAllSchools, 
  adminSearchSchools, 
  adminCreateSchool, 
  adminUpdateSchool, 
  adminDeleteSchool,
  adminToggleSchoolStatus
} from '@/lib/api/admin';
import { School as SchoolType, FirebaseTimestamp } from '@/types';
import { toTimestamp } from '@/lib/utils';

// 로컬 School 인터페이스 (실제 API 응답에 맞춤)
interface LocalSchool {
  id: string;
  name: string;
  address: string;
  district: string;
  type: "초등학교" | "중학교" | "고등학교" | "대학교";
  websiteUrl?: string;
  logoUrl?: string;
  memberCount?: number;
  favoriteCount?: number;
  isActive?: boolean;
  createdAt: FirebaseTimestamp;
}

interface SchoolFormData {
  name: string;
  address: string;
  district: string;
  type: '초등학교' | '중학교' | '고등학교' | '대학교';
  websiteUrl: string;
  logoUrl: string;
  memberCount: number;
  favoriteCount: number;
  isActive: boolean;
}

const initialFormData: SchoolFormData = {
  name: '',
  address: '',
  district: '',
  type: '고등학교',
  websiteUrl: '',
  logoUrl: '',
  memberCount: 0,
  favoriteCount: 0,
  isActive: true
};

// API 타입을 로컬 타입으로 변환
const convertSchool = (apiSchool: SchoolType): LocalSchool => ({
  id: apiSchool.id,
  name: apiSchool.name,
  address: apiSchool.address || '',
  district: apiSchool.district || '',
  type: apiSchool.type,
  websiteUrl: apiSchool.websiteUrl,
  logoUrl: apiSchool.logoUrl,
  memberCount: apiSchool.memberCount,
  favoriteCount: apiSchool.favoriteCount,
  isActive: apiSchool.isActive !== undefined ? apiSchool.isActive : true,
  createdAt: toTimestamp(apiSchool.createdAt)
});

export default function AdminSchoolsPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState<LocalSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<LocalSchool | null>(null);
  const [formData, setFormData] = useState<SchoolFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 학교 목록 로드
  const loadSchools = async () => {
    try {
      setLoading(true);
      const schoolList = await adminGetAllSchools();
      setSchools(schoolList.map(convertSchool));
    } catch (error) {
      console.error('학교 목록 로드 오류:', error);
      toast({
        title: "오류",
        description: "학교 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 검색 실행
  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadSchools();
      return;
    }

    try {
      setLoading(true);
      const searchResults = await adminSearchSchools(searchTerm);
      setSchools(searchResults.map(convertSchool));
    } catch (error) {
      console.error('학교 검색 오류:', error);
      toast({
        title: "오류",
        description: "학교 검색 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 학교 생성
  const handleCreateSchool = async () => {
    try {
      setIsSubmitting(true);
      
      const newSchoolData = {
        ...formData,
        regions: {
          sido: formData.district,
          sigungu: ''
        }
      };
      
      await adminCreateSchool(newSchoolData);
      
      toast({
        title: "성공",
        description: "새 학교가 성공적으로 생성되었습니다.",
      });
      
      setIsCreateDialogOpen(false);
      setFormData(initialFormData);
      loadSchools();
    } catch (error) {
      console.error('학교 생성 오류:', error);
      toast({
        title: "오류",
        description: "학교 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 학교 수정
  const handleUpdateSchool = async () => {
    if (!editingSchool) return;

    try {
      setIsSubmitting(true);
      
      // 학교 이름이 변경되었는지 확인
      const isNameChanged = formData.name !== editingSchool.name;
      
      if (isNameChanged) {
        // 이름 변경 시 사용자에게 알림
        toast({
          title: "업데이트 중",
          description: "학교 정보와 관련된 모든 사용자 데이터를 업데이트하고 있습니다. 잠시만 기다려주세요...",
        });
      }
      
      await adminUpdateSchool(editingSchool.id, formData);
      
      toast({
        title: "성공",
        description: isNameChanged 
          ? "학교 정보와 모든 사용자의 학교 이름이 성공적으로 업데이트되었습니다." 
          : "학교 정보가 성공적으로 수정되었습니다.",
      });
      
      setIsEditDialogOpen(false);
      setEditingSchool(null);
      setFormData(initialFormData);
      loadSchools();
    } catch (error) {
      console.error('학교 수정 오류:', error);
      toast({
        title: "오류",
        description: "학교 정보 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 학교 삭제
  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`정말로 "${schoolName}" 학교를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      await adminDeleteSchool(schoolId);
      
      toast({
        title: "성공",
        description: "학교가 성공적으로 삭제되었습니다.",
      });
      
      loadSchools();
    } catch (error) {
      console.error('학교 삭제 오류:', error);
      toast({
        title: "오류",
        description: "학교 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 학교 활성화/비활성화 토글
  const handleToggleSchoolStatus = async (schoolId: string, schoolName: string, currentStatus: boolean) => {
    const action = currentStatus ? "비활성화" : "활성화";
    
    if (!confirm(`정말로 "${schoolName}" 학교를 ${action}하시겠습니까?${!currentStatus ? '' : '\n\n비활성화 시 해당 학교를 즐겨찾기하지 않은 사용자는 커뮤니티 페이지에서 이 학교를 볼 수 없습니다.'}`)) {
      return;
    }

    try {
      await adminToggleSchoolStatus(schoolId, !currentStatus);
      
      toast({
        title: "성공",
        description: `학교가 성공적으로 ${action}되었습니다.`,
      });
      
      loadSchools();
    } catch (error) {
      console.error('학교 상태 변경 오류:', error);
      toast({
        title: "오류",
        description: "학교 상태 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 수정 대화상자 열기
  const openEditDialog = (school: LocalSchool) => {
    setEditingSchool(school);
    setFormData({
      name: school.name,
      address: school.address || '',
      district: school.district || '',
      type: school.type,
      websiteUrl: school.websiteUrl || '',
      logoUrl: school.logoUrl || '',
      memberCount: school.memberCount || 0,
      favoriteCount: school.favoriteCount || 0,
      isActive: school.isActive !== undefined ? school.isActive : true
    });
    setIsEditDialogOpen(true);
  };

  // 폼 데이터 업데이트
  const updateFormData = (field: keyof SchoolFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadSchools();
    }
  }, [user]);

  // 관리자 권한 확인
  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              관리자 권한이 필요합니다.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">학교 관리</h1>
          <p className="text-muted-foreground">
            학교 정보를 관리하고 새로운 학교를 추가할 수 있습니다.
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              새 학교 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>새 학교 추가</DialogTitle>
              <DialogDescription>
                새로운 학교 정보를 입력해주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">학교명</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateFormData('name', e.target.value)}
                    placeholder="예: 서울고등학교"
                  />
                </div>
                <div>
                  <Label htmlFor="type">학교 유형</Label>
                  <Select value={formData.type} onValueChange={(value) => updateFormData('type', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="초등학교">초등학교</SelectItem>
                      <SelectItem value="중학교">중학교</SelectItem>
                      <SelectItem value="고등학교">고등학교</SelectItem>
                      <SelectItem value="대학교">대학교</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="address">주소</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateFormData('address', e.target.value)}
                  placeholder="예: 서울특별시 강남구 테헤란로 123"
                />
              </div>
              
              <div>
                <Label htmlFor="district">지역</Label>
                <Input
                  id="district"
                  value={formData.district}
                  onChange={(e) => updateFormData('district', e.target.value)}
                  placeholder="예: 서울특별시"
                />
              </div>
              
              <div>
                <Label htmlFor="websiteUrl">웹사이트 URL</Label>
                <Input
                  id="websiteUrl"
                  value={formData.websiteUrl}
                  onChange={(e) => updateFormData('websiteUrl', e.target.value)}
                  placeholder="예: https://school.go.kr"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="memberCount">멤버 수</Label>
                  <Input
                    id="memberCount"
                    type="number"
                    value={formData.memberCount}
                    onChange={(e) => updateFormData('memberCount', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="favoriteCount">즐겨찾기 수</Label>
                  <Input
                    id="favoriteCount"
                    type="number"
                    value={formData.favoriteCount}
                    onChange={(e) => updateFormData('favoriteCount', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                취소
              </Button>
              <Button onClick={handleCreateSchool} disabled={isSubmitting}>
                {isSubmitting ? "생성 중..." : "생성"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 검색 영역 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            학교 검색
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="학교명 또는 주소로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>검색</Button>
            <Button variant="outline" onClick={loadSchools}>전체</Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">전체 학교</p>
                <p className="text-2xl font-bold">{schools.length.toLocaleString()}</p>
              </div>
              <School className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 멤버 수</p>
                <p className="text-2xl font-bold">
                  {schools.reduce((sum, school) => sum + (school.memberCount || 0), 0).toLocaleString()}
                </p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">총 즐겨찾기</p>
                <p className="text-2xl font-bold">
                  {schools.reduce((sum, school) => sum + (school.favoriteCount || 0), 0).toLocaleString()}
                </p>
              </div>
              <Heart className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 학교 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>학교 목록</CardTitle>
          <CardDescription>
            즐겨찾기 수 기준으로 정렬되어 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p>로딩 중...</p>
            </div>
          ) : schools.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">학교가 없습니다.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학교명</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>주소</TableHead>
                  <TableHead className="text-center">멤버</TableHead>
                  <TableHead className="text-center">즐겨찾기</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead>웹사이트</TableHead>
                  <TableHead className="text-center">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{school.type}</Badge>
                    </TableCell>
                    <TableCell>{school.district}</TableCell>
                    <TableCell className="max-w-xs truncate">{school.address}</TableCell>
                    <TableCell className="text-center">{school.memberCount || 0}</TableCell>
                    <TableCell className="text-center">{school.favoriteCount || 0}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleSchoolStatus(school.id, school.name, school.isActive !== false)}
                        className={school.isActive !== false ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}
                      >
                        {school.isActive !== false ? (
                          <Power className="h-4 w-4" />
                        ) : (
                          <PowerOff className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {school.websiteUrl ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={school.websiteUrl} target="_blank" rel="noopener noreferrer">
                            <Globe className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(school)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchool(school.id, school.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 수정 대화상자 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>학교 정보 수정</DialogTitle>
            <DialogDescription>
              학교 정보를 수정해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">학교명</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-type">학교 유형</Label>
                <Select value={formData.type} onValueChange={(value) => updateFormData('type', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="초등학교">초등학교</SelectItem>
                    <SelectItem value="중학교">중학교</SelectItem>
                    <SelectItem value="고등학교">고등학교</SelectItem>
                    <SelectItem value="대학교">대학교</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-address">주소</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => updateFormData('address', e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-district">지역</Label>
              <Input
                id="edit-district"
                value={formData.district}
                onChange={(e) => updateFormData('district', e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="edit-websiteUrl">웹사이트 URL</Label>
              <Input
                id="edit-websiteUrl"
                value={formData.websiteUrl}
                onChange={(e) => updateFormData('websiteUrl', e.target.value)}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-memberCount">멤버 수</Label>
                <Input
                  id="edit-memberCount"
                  type="number"
                  value={formData.memberCount}
                  onChange={(e) => updateFormData('memberCount', parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="edit-favoriteCount">즐겨찾기 수</Label>
                <Input
                  id="edit-favoriteCount"
                  type="number"
                  value={formData.favoriteCount}
                  onChange={(e) => updateFormData('favoriteCount', parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
              <div className="space-y-0.5">
                <Label htmlFor="edit-isActive" className="text-base">학교 활성화 상태</Label>
                <p className="text-sm text-muted-foreground">
                  비활성화 시 즐겨찾기하지 않은 사용자는 커뮤니티에서 이 학교를 볼 수 없습니다.
                </p>
              </div>
              <Switch
                id="edit-isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => updateFormData('isActive', checked)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleUpdateSchool} disabled={isSubmitting}>
              {isSubmitting ? "수정 중..." : "수정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 