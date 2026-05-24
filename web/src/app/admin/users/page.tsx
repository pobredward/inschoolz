"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  Users, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  RefreshCw,
  Filter,
  Download,
  ChevronDown,
  Eye,
  Mail,
  School,
  MapPin,
  Calendar,
  Award,
  Shield
} from 'lucide-react';
import { 
  getEnhancedUsersList, 
  updateUserRole, 
  updateUserStatusEnhanced, 
  updateUserExperienceAdmin, 
  addUserWarning, 
  deleteUser, 
  bulkUpdateUsers,
} from '@/lib/api/users';
import { EnhancedAdminUserListParams, SuspensionSettings, ExportOptions } from '@/types/admin';
import { User, FirebaseTimestamp } from '@/types';
import { toast } from 'sonner';
import { toDate } from '@/lib/utils';
import { CSVExportDialog } from '@/components/ui/csv-export-dialog';
import { convertUsersToCSV, downloadCSV, generateExportFilename } from '@/lib/utils/csv-export';
import { useAuth } from '@/providers/AuthProvider';

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // 개선된 필터 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'userName' | 'realName' | 'email' | 'school'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [fakeFilter, setFakeFilter] = useState<'all' | 'real' | 'fake'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastActiveAt' | 'totalExperience' | 'userName'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 고급 필터 상태
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [levelRange, setLevelRange] = useState<{ min?: number; max?: number }>({});
  const [experienceRange, setExperienceRange] = useState<{ min?: number; max?: number }>({});
  const [regionFilter, setRegionFilter] = useState<{ sido?: string; sigungu?: string }>({});
  const [hasWarnings, setHasWarnings] = useState<boolean | undefined>(undefined);
  
  // 다이얼로그 상태
  const [warningDialog, setWarningDialog] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [experienceDialog, setExperienceDialog] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [suspensionDialog, setSuspensionDialog] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  const [csvExportDialog, setCsvExportDialog] = useState(false);
  const [userDetailDialog, setUserDetailDialog] = useState<{ isOpen: boolean; user: User | null }>({ isOpen: false, user: null });
  
  // 폼 상태
  const [warningForm, setWarningForm] = useState({ reason: '' });
  const [experienceForm, setExperienceForm] = useState({ totalExperience: 0, reason: '' });
  const [suspensionForm, setSuspensionForm] = useState<SuspensionSettings>({
    type: 'temporary',
    duration: 7,
    reason: '',
    autoRestore: true,
    notifyUser: true
  });
  const [bulkAction, setBulkAction] = useState<{ type: string; value: string }>({ type: '', value: '' });

  const loadUsers = async (params: EnhancedAdminUserListParams = {}) => {
    setIsLoading(true);
    try {
      const response = await getEnhancedUsersList({
        page: currentPage,
        pageSize: 20,
        search: searchTerm,
        searchType,
        role: roleFilter,
        status: statusFilter,
        fake: fakeFilter,
        sortBy,
        sortOrder,
        dateRange: (dateRange.from && dateRange.to) ? { from: dateRange.from, to: dateRange.to } : undefined,
        levelRange: (levelRange.min !== undefined && levelRange.max !== undefined) ? { min: levelRange.min, max: levelRange.max } : undefined,
        experienceRange: (experienceRange.min !== undefined && experienceRange.max !== undefined) ? { min: experienceRange.min, max: experienceRange.max } : undefined,
        regions: regionFilter.sido || regionFilter.sigungu ? regionFilter : undefined,
        hasWarnings,
        ...params
      });
      
      setUsers(response.users);
      setTotalCount(response.totalCount);
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('사용자 목록 로드 오류:', err);
      toast.error('사용자 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [currentPage, searchTerm, searchType, roleFilter, statusFilter, fakeFilter, sortBy, sortOrder, dateRange, levelRange, experienceRange, regionFilter, hasWarnings]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setCurrentPage(1);
    loadUsers({ page: 1 });
  };

  const handleUserSelect = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(user => user.uid));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await updateUserRole(userId, newRole);
      toast.success('사용자 역할이 변경되었습니다.');
      loadUsers();
    } catch (err) {
      console.error('역할 변경 오류:', err);
      toast.error('역할 변경 중 오류가 발생했습니다.');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    if (newStatus === 'suspended') {
      // 정지의 경우 상세 설정 다이얼로그 열기
      const user = users.find(u => u.uid === userId);
      if (user) {
        setSuspensionDialog({ isOpen: true, user });
      }
    } else {
      try {
        await updateUserStatusEnhanced(userId, newStatus, undefined, currentAdmin?.uid);
        toast.success('사용자 상태가 변경되었습니다.');
        loadUsers();
      } catch (err) {
        console.error('상태 변경 오류:', err);
        toast.error('상태 변경 중 오류가 발생했습니다.');
      }
    }
  };

  const handleSuspension = async () => {
    if (!suspensionDialog.user) return;
    
    try {
      await updateUserStatusEnhanced(suspensionDialog.user.uid, 'suspended', suspensionForm, currentAdmin?.uid);
      toast.success('사용자가 정지되었습니다.');
      setSuspensionDialog({ isOpen: false, user: null });
      setSuspensionForm({
        type: 'temporary',
        duration: 7,
        reason: '',
        autoRestore: true,
        notifyUser: true
      });
      loadUsers();
    } catch (err) {
      console.error('사용자 정지 오류:', err);
      toast.error('사용자 정지 중 오류가 발생했습니다.');
    }
  };

  const handleAddWarning = async () => {
    if (!warningDialog.user) return;
    
    try {
      await addUserWarning(warningDialog.user.uid, warningForm.reason);
      toast.success('경고가 추가되었습니다.');
      setWarningDialog({ isOpen: false, user: null });
      setWarningForm({ reason: '' });
      loadUsers();
    } catch (err) {
      console.error('경고 추가 오류:', err);
      toast.error('경고 추가 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateExperience = async () => {
    if (!experienceDialog.user) return;
    
    try {
      await updateUserExperienceAdmin(experienceDialog.user.uid, experienceForm.totalExperience, experienceForm.reason);
      toast.success('경험치가 수정되었습니다.');
      setExperienceDialog({ isOpen: false, user: null });
      setExperienceForm({ totalExperience: 0, reason: '' });
      loadUsers();
    } catch (err) {
      console.error('경험치 수정 오류:', err);
      toast.error('경험치 수정 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      toast.success('사용자가 삭제되었습니다.');
      loadUsers();
    } catch (err) {
      console.error('사용자 삭제 오류:', err);
      toast.error('사용자 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleBulkAction = async () => {
    if (selectedUsers.length === 0 || !bulkAction.type) return;
    
    try {
      const updates: { role?: 'admin' | 'user'; status?: 'active' | 'inactive' | 'suspended' } = {};
      
      if (bulkAction.type === 'role') {
        updates.role = bulkAction.value as 'admin' | 'user';
      } else if (bulkAction.type === 'status') {
        updates.status = bulkAction.value as 'active' | 'inactive' | 'suspended';
      }
      
      await bulkUpdateUsers(selectedUsers, updates);
      toast.success(`${selectedUsers.length}명의 사용자가 업데이트되었습니다.`);
      setSelectedUsers([]);
      setBulkAction({ type: '', value: '' });
      loadUsers();
    } catch (err) {
      console.error('대량 업데이트 오류:', err);
      toast.error('대량 업데이트 중 오류가 발생했습니다.');
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSearchType('all');
    setRoleFilter('all');
    setStatusFilter('all');
    setFakeFilter('all');
    setDateRange({});
    setLevelRange({});
    setExperienceRange({});
    setRegionFilter({});
    setHasWarnings(undefined);
    setCurrentPage(1);
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800';
      case 'teacher': return 'bg-green-100 text-green-800';
      case 'student': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp?: FirebaseTimestamp | { seconds?: number; nanoseconds?: number } | unknown) => {
    if (!timestamp) return '-';
    try {
      const date = toDate(timestamp);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('ko-KR');
    } catch (err) {
      console.error('Date formatting error:', err);
      return '-';
    }
  };

  const exportToCSV = () => {
    setCsvExportDialog(true);
  };

  const handleCSVExport = async (options: ExportOptions) => {
    try {
      // 내보낼 사용자 데이터 가져오기
      let exportUsers: User[] = [];
      
      // exportScope는 options 내부에서 직접 확인
      if (selectedUsers.length > 0) {
        // 선택된 사용자가 있을 때만 선택 옵션 활용
        exportUsers = users.filter(user => selectedUsers.includes(user.uid));
      } else {
        // 현재 필터 결과 또는 모든 사용자
        const allUsersResponse = await getEnhancedUsersList({
          page: 1,
          pageSize: 10000, // 대량 데이터 가져오기
          search: '',
          searchType: 'all',
          role: 'all',
          status: 'all'
        });
        exportUsers = allUsersResponse.users;
      }
      
      if (exportUsers.length === 0) {
        toast.warning('내보낼 데이터가 없습니다.');
        return;
      }
      
      // CSV 변환
      const csvContent = convertUsersToCSV(exportUsers, options);
      
      // 파일 다운로드
      const filename = generateExportFilename('inschoolz_users');
      downloadCSV(csvContent, filename);
      
      toast.success(`${exportUsers.length}명의 사용자 데이터가 내보내졌습니다.`);
    } catch (err) {
      console.error('CSV 내보내기 오류:', err);
      toast.error('CSV 내보내기 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">사용자 관리</h1>
          <p className="text-sm sm:text-base text-gray-600">총 {totalCount}명의 사용자</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={exportToCSV} variant="outline" size="sm" className="text-xs sm:text-sm">
            <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">CSV 내보내기</span>
            <span className="sm:hidden">내보내기</span>
          </Button>
          <Button onClick={() => loadUsers()} disabled={isLoading} size="sm" className="text-xs sm:text-sm">
            <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>검색 및 필터</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                고급 필터
                <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                필터 초기화
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-4">
            <div className="sm:col-span-2 lg:col-span-2">
              <Label htmlFor="search" className="text-sm">검색</Label>
              <div className="flex gap-2">
                <Select value={searchType} onValueChange={(value: typeof searchType) => setSearchType(value)}>
                  <SelectTrigger className="w-20 sm:w-32 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="userName">사용자명</SelectItem>
                    <SelectItem value="realName">실명</SelectItem>
                    <SelectItem value="email">이메일</SelectItem>
                    <SelectItem value="school">학교명</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="search"
                  placeholder="검색어 입력..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 text-sm"
                />
                <Button onClick={handleSearch} size="sm">
                  <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="role" className="text-sm">역할</Label>
              <Select value={roleFilter} onValueChange={(value: typeof roleFilter) => setRoleFilter(value)}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="user">일반 사용자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status" className="text-sm">상태</Label>
              <Select value={statusFilter} onValueChange={(value: typeof statusFilter) => setStatusFilter(value)}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                  <SelectItem value="suspended">정지</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="fake" className="text-sm">사용자 유형</Label>
              <Select value={fakeFilter} onValueChange={(value: typeof fakeFilter) => setFakeFilter(value)}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="real">실제 사용자</SelectItem>
                  <SelectItem value="fake">봇 사용자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="sort" className="text-sm">정렬</Label>
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                const [field, order] = value.split('-');
                setSortBy(field as typeof sortBy);
                setSortOrder(order as typeof sortOrder);
              }}>
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">가입일 (최신순)</SelectItem>
                  <SelectItem value="createdAt-asc">가입일 (오래된순)</SelectItem>
                  <SelectItem value="lastActiveAt-desc">최근 활동 (최신순)</SelectItem>
                  <SelectItem value="totalExperience-desc">경험치 (높은순)</SelectItem>
                  <SelectItem value="userName-asc">사용자명 (가나다순)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 고급 필터 */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label>가입일 범위</Label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateRange.from ? dateRange.from.toISOString().split('T')[0] : ''}
                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value) : undefined }))}
                    placeholder="시작일"
                  />
                  <Input
                    type="date"
                    value={dateRange.to ? dateRange.to.toISOString().split('T')[0] : ''}
                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value) : undefined }))}
                    placeholder="종료일"
                  />
                </div>
              </div>
              
              <div>
                <Label>레벨 범위</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="최소"
                    value={levelRange.min || ''}
                    onChange={(e) => setLevelRange(prev => ({ ...prev, min: Number(e.target.value) || undefined }))}
                  />
                  <Input
                    type="number"
                    placeholder="최대"
                    value={levelRange.max || ''}
                    onChange={(e) => setLevelRange(prev => ({ ...prev, max: Number(e.target.value) || undefined }))}
                  />
                </div>
              </div>
              
              <div>
                <Label>경험치 범위</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="최소"
                    value={experienceRange.min || ''}
                    onChange={(e) => setExperienceRange(prev => ({ ...prev, min: Number(e.target.value) || undefined }))}
                  />
                  <Input
                    type="number"
                    placeholder="최대"
                    value={experienceRange.max || ''}
                    onChange={(e) => setExperienceRange(prev => ({ ...prev, max: Number(e.target.value) || undefined }))}
                  />
                </div>
              </div>
              
              <div>
                <Label>경고 여부</Label>
                <Select value={hasWarnings?.toString() || 'all'} onValueChange={(value) => {
                  if (value === 'all') setHasWarnings(undefined);
                  else setHasWarnings(value === 'true');
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="true">경고 있음</SelectItem>
                    <SelectItem value="false">경고 없음</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 대량 작업 */}
      {selectedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>대량 작업 ({selectedUsers.length}명 선택됨)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Select value={bulkAction.type} onValueChange={(value) => setBulkAction({ ...bulkAction, type: value })}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="작업 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">역할 변경</SelectItem>
                  <SelectItem value="status">상태 변경</SelectItem>
                </SelectContent>
              </Select>
              
              {bulkAction.type === 'role' && (
                <Select value={bulkAction.value} onValueChange={(value) => setBulkAction({ ...bulkAction, value })}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="역할 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="user">일반 사용자</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {bulkAction.type === 'status' && (
                <Select value={bulkAction.value} onValueChange={(value) => setBulkAction({ ...bulkAction, value })}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="상태 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">활성</SelectItem>
                    <SelectItem value="inactive">비활성</SelectItem>
                    <SelectItem value="suspended">정지</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              <Button onClick={handleBulkAction} disabled={!bulkAction.type || !bulkAction.value}>
                적용
              </Button>
              
              <Button variant="outline" onClick={() => setSelectedUsers([])}>
                선택 해제
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 사용자 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>사용자 목록</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedUsers.length === users.length && users.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">전체 선택</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : (
            <div className="space-y-4">
              {/* 사용자 리스트 */}
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.uid}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors gap-3 sm:gap-0"
                    onClick={() => setUserDetailDialog({ isOpen: true, user })}
                  >
                    <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1">
                      <Checkbox
                        checked={selectedUsers.includes(user.uid)}
                        onCheckedChange={(checked) => handleUserSelect(user.uid, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 sm:mt-0"
                      />
                      
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2 sm:mb-1">
                          <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">
                            {user.profile?.userName || user.email}
                          </h3>
                          <div className="flex flex-wrap gap-1">
                            <Badge className={`text-xs ${getRoleColor(user.role)}`}>
                              {user.role === 'admin' ? '관리자' : user.role === 'student' ? '학생' : user.role === 'teacher' ? '교사' : '일반 사용자'}
                            </Badge>
                            <Badge className={`text-xs ${getStatusColor(user.status)}`}>
                              {user.status === 'active' ? '활성' : user.status === 'inactive' ? '비활성' : user.status === 'suspended' ? '정지' : '알 수 없음'}
                            </Badge>
                            <Badge className={`text-xs ${user.fake ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                              {user.fake ? '봇' : '실제'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-32 sm:max-w-48">{user.email}</span>
                          </div>
                          
                          {user.profile?.realName && (
                            <div className="flex items-center gap-1">
                              <span className="truncate">실명: {user.profile.realName}</span>
                            </div>
                          )}
                          
                          {user.school?.name && (
                            <div className="flex items-center gap-1">
                              <School className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate max-w-24 sm:max-w-32">{user.school.name}</span>
                            </div>
                          )}
                          
                          {user.regions && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{`${user.regions.sido || ''} ${user.regions.sigungu || ''}`.trim() || '-'}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Award className="h-3 w-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">Lv.{user.stats?.level || 1} ({user.stats?.totalExperience || 0} XP)</span>
                          </div>
                          
                          {(user.warnings?.count || 0) > 0 && (
                            <div className="flex items-center gap-1 text-red-600">
                              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                              <span className="whitespace-nowrap">{user.warnings?.count}건 경고</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">{formatDate(user.profile?.createdAt || user.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-end sm:justify-start gap-2 ml-11 sm:ml-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserDetailDialog({ isOpen: true, user });
                        }}
                        className="text-xs sm:text-sm"
                      >
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="ml-1 sm:hidden">보기</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* 페이지네이션 */}
              <div className="flex justify-center">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    이전
                  </Button>
                  <span className="text-sm text-gray-600">
                    {currentPage} / {Math.ceil(totalCount / 20)}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!hasMore}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 정지 설정 다이얼로그 */}
      <Dialog open={suspensionDialog.isOpen} onOpenChange={(open) => setSuspensionDialog({ isOpen: open, user: suspensionDialog.user })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 정지</DialogTitle>
            <DialogDescription>
              사용자 &quot;{suspensionDialog.user?.profile?.userName}&quot;을 정지합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>정지 유형</Label>
              <Select value={suspensionForm.type} onValueChange={(value: 'temporary' | 'permanent') => 
                setSuspensionForm({ ...suspensionForm, type: value })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">임시 정지</SelectItem>
                  <SelectItem value="permanent">영구 정지</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {suspensionForm.type === 'temporary' && (
              <div>
                <Label>정지 기간 (일)</Label>
                <Input
                  type="number"
                  value={suspensionForm.duration || ''}
                  onChange={(e) => setSuspensionForm({ ...suspensionForm, duration: Number(e.target.value) })}
                  min="1"
                  max="365"
                />
              </div>
            )}
            
            <div>
              <Label>정지 사유</Label>
              <Textarea
                placeholder="정지 사유를 입력하세요..."
                value={suspensionForm.reason}
                onChange={(e) => setSuspensionForm({ ...suspensionForm, reason: e.target.value })}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoRestore"
                checked={suspensionForm.autoRestore}
                onCheckedChange={(checked) => setSuspensionForm({ ...suspensionForm, autoRestore: checked as boolean })}
              />
              <Label htmlFor="autoRestore">자동 해제</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notifyUser"
                checked={suspensionForm.notifyUser}
                onCheckedChange={(checked) => setSuspensionForm({ ...suspensionForm, notifyUser: checked as boolean })}
              />
              <Label htmlFor="notifyUser">사용자에게 알림</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspensionDialog({ isOpen: false, user: null })}>
              취소
            </Button>
            <Button onClick={handleSuspension}>
              정지
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 경고 추가 다이얼로그 */}
      <Dialog open={warningDialog.isOpen} onOpenChange={(open) => setWarningDialog({ isOpen: open, user: warningDialog.user })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>경고 추가</DialogTitle>
            <DialogDescription>
              사용자 &quot;{warningDialog.user?.profile?.userName}&quot;에게 경고를 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="warning-reason">경고 사유</Label>
              <Textarea
                id="warning-reason"
                placeholder="경고 사유를 입력하세요..."
                value={warningForm.reason}
                onChange={(e) => setWarningForm({ ...warningForm, reason: e.target.value })}
              />
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningDialog({ isOpen: false, user: null })}>
              취소
            </Button>
            <Button onClick={handleAddWarning}>
              경고 추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 경험치 수정 다이얼로그 */}
      <Dialog open={experienceDialog.isOpen} onOpenChange={(open) => setExperienceDialog({ isOpen: open, user: experienceDialog.user })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>경험치 수정</DialogTitle>
            <DialogDescription>
              사용자 &quot;{experienceDialog.user?.profile?.userName}&quot;의 경험치를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="experience-amount">경험치</Label>
              <Input
                id="experience-amount"
                type="number"
                value={experienceForm.totalExperience}
                onChange={(e) => setExperienceForm({ ...experienceForm, totalExperience: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="experience-reason">수정 사유</Label>
              <Textarea
                id="experience-reason"
                placeholder="경험치 수정 사유를 입력하세요..."
                value={experienceForm.reason}
                onChange={(e) => setExperienceForm({ ...experienceForm, reason: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExperienceDialog({ isOpen: false, user: null })}>
              취소
            </Button>
            <Button onClick={handleUpdateExperience}>
              경험치 수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 사용자 세부 정보 모달 */}
      <Dialog open={userDetailDialog.isOpen} onOpenChange={(open) => setUserDetailDialog({ isOpen: open, user: userDetailDialog.user })}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Users className="h-4 w-4 sm:h-5 sm:w-5" />
              사용자 세부 정보
            </DialogTitle>
            <DialogDescription className="text-sm">
              사용자의 모든 정보를 확인하고 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          
          {userDetailDialog.user && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      기본 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-sm">사용자 ID</Label>
                      <Input value={userDetailDialog.user.uid} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">이메일</Label>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                        <Input value={userDetailDialog.user.email} readOnly className="bg-gray-50 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">사용자명</Label>
                      <Input 
                        value={userDetailDialog.user.profile?.userName || ''} 
                        onChange={(e) => {
                          if (userDetailDialog.user) {
                            const updatedUser = {
                              ...userDetailDialog.user,
                              profile: {
                                ...userDetailDialog.user.profile,
                                userName: e.target.value
                              }
                            };
                            setUserDetailDialog({ ...userDetailDialog, user: updatedUser });
                          }
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">실명</Label>
                      <Input 
                        value={userDetailDialog.user.profile?.realName || ''} 
                        onChange={(e) => {
                          if (userDetailDialog.user) {
                            const updatedUser = {
                              ...userDetailDialog.user,
                              profile: {
                                ...userDetailDialog.user.profile,
                                realName: e.target.value
                              }
                            };
                            setUserDetailDialog({ ...userDetailDialog, user: updatedUser });
                          }
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">역할</Label>
                      <Select 
                        value={userDetailDialog.user.role || 'student'} 
                        onValueChange={(value: 'admin' | 'teacher' | 'student') => {
                          if (userDetailDialog.user) {
                            const updatedUser = {
                              ...userDetailDialog.user,
                              role: value
                            };
                            setUserDetailDialog({ ...userDetailDialog, user: updatedUser });
                          }
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">관리자</SelectItem>
                          <SelectItem value="teacher">교사</SelectItem>
                          <SelectItem value="student">학생</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">상태</Label>
                      <Select 
                        value={userDetailDialog.user.status || 'active'} 
                        onValueChange={(value: 'active' | 'inactive' | 'suspended') => {
                          if (userDetailDialog.user) {
                            const updatedUser = {
                              ...userDetailDialog.user,
                              status: value
                            };
                            setUserDetailDialog({ ...userDetailDialog, user: updatedUser });
                          }
                        }}
                      >
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">활성</SelectItem>
                          <SelectItem value="inactive">비활성</SelectItem>
                          <SelectItem value="suspended">정지</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <School className="h-4 w-4" />
                      학교 및 지역 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-sm">학교명</Label>
                      <div className="flex items-center gap-2">
                        <School className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                        <Input value={userDetailDialog.user.school?.name || ''} readOnly className="bg-gray-50 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">학교 코드</Label>
                      <Input value={userDetailDialog.user.school?.id || ''} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">시도</Label>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                        <Input value={userDetailDialog.user.regions?.sido || ''} readOnly className="bg-gray-50 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">시군구</Label>
                      <Input value={userDetailDialog.user.regions?.sigungu || ''} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">학년</Label>
                      <Input value={userDetailDialog.user.school?.grade || ''} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">반</Label>
                      <Input value={userDetailDialog.user.school?.classNumber || ''} readOnly className="bg-gray-50 text-sm" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 통계 및 레벨 정보 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      레벨 및 경험치
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-sm">현재 레벨</Label>
                      <Input value={userDetailDialog.user.stats?.level || 1} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">총 경험치</Label>
                      <Input 
                        type="number"
                        value={userDetailDialog.user.stats?.totalExperience || 0} 
                        onChange={(e) => {
                          if (userDetailDialog.user) {
                            const updatedUser = {
                              ...userDetailDialog.user,
                              stats: {
                                ...userDetailDialog.user.stats,
                                totalExperience: Number(e.target.value)
                              }
                            };
                            setUserDetailDialog({ ...userDetailDialog, user: updatedUser });
                          }
                        }}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">게시글 수</Label>
                      <Input value={userDetailDialog.user.stats?.postCount || 0} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">댓글 수</Label>
                      <Input value={userDetailDialog.user.stats?.commentCount || 0} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">좋아요 한 수</Label>
                      <Input value={userDetailDialog.user.stats?.likeCount || 0} readOnly className="bg-gray-50 text-sm" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3 sm:pb-6">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      관리 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 sm:space-y-4">
                    <div>
                      <Label className="text-sm">사용자 유형</Label>
                      <Badge className={`text-xs ${userDetailDialog.user.fake ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                        {userDetailDialog.user.fake ? '봇 사용자' : '실제 사용자'}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-sm">경고 횟수</Label>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                        <span className={`text-sm font-medium ${(userDetailDialog.user.warnings?.count || 0) > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                          {userDetailDialog.user.warnings?.count || 0}건
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">가입일</Label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                        <Input value={formatDate(userDetailDialog.user.profile?.createdAt || userDetailDialog.user.createdAt)} readOnly className="bg-gray-50 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">최근 활동</Label>
                      <Input value={formatDate(userDetailDialog.user.profile?.createdAt)} readOnly className="bg-gray-50 text-sm" />
                    </div>
                    <div>
                      <Label className="text-sm">마지막 로그인</Label>
                      <Input value={formatDate(userDetailDialog.user.profile?.createdAt)} readOnly className="bg-gray-50 text-sm" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 관리 작업 */}
              <Card>
                <CardHeader className="pb-3 sm:pb-6">
                  <CardTitle className="text-base sm:text-lg">관리 작업</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setWarningDialog({ isOpen: true, user: userDetailDialog.user });
                        setUserDetailDialog({ isOpen: false, user: null });
                      }}
                      className="text-xs sm:text-sm"
                    >
                      <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">경고 추가</span>
                      <span className="sm:hidden">경고</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setExperienceDialog({ isOpen: true, user: userDetailDialog.user });
                        setExperienceForm({ totalExperience: userDetailDialog.user?.stats?.totalExperience || 0, reason: '' });
                        setUserDetailDialog({ isOpen: false, user: null });
                      }}
                      className="text-xs sm:text-sm"
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">경험치 수정</span>
                      <span className="sm:hidden">경험치</span>
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSuspensionDialog({ isOpen: true, user: userDetailDialog.user });
                        setUserDetailDialog({ isOpen: false, user: null });
                      }}
                      className="text-xs sm:text-sm"
                    >
                      <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">정지 설정</span>
                      <span className="sm:hidden">정지</span>
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="text-xs sm:text-sm">
                          <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">사용자 삭제</span>
                          <span className="sm:hidden">삭제</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[90vw] sm:w-full">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-base sm:text-lg">사용자 삭제</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm">
                            정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                          <AlertDialogCancel className="text-sm">취소</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => {
                              if (userDetailDialog.user) {
                                handleDeleteUser(userDetailDialog.user.uid);
                                setUserDetailDialog({ isOpen: false, user: null });
                              }
                            }}
                            className="text-sm"
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => setUserDetailDialog({ isOpen: false, user: null })}
              className="text-sm"
            >
              닫기
            </Button>
            <Button 
              onClick={async () => {
                if (userDetailDialog.user) {
                  // 기본 정보 업데이트
                  if (userDetailDialog.user.role !== users.find(u => u.uid === userDetailDialog.user?.uid)?.role) {
                    await handleRoleChange(userDetailDialog.user.uid, userDetailDialog.user.role as 'admin' | 'user');
                  }
                  if (userDetailDialog.user.status !== users.find(u => u.uid === userDetailDialog.user?.uid)?.status) {
                    await handleStatusChange(userDetailDialog.user.uid, userDetailDialog.user.status as 'active' | 'inactive' | 'suspended');
                  }
                  // 경험치 업데이트
                  const originalUser = users.find(u => u.uid === userDetailDialog.user?.uid);
                  if (userDetailDialog.user.stats?.totalExperience !== originalUser?.stats?.totalExperience) {
                    await updateUserExperienceAdmin(userDetailDialog.user.uid, userDetailDialog.user.stats?.totalExperience || 0, '관리자 직접 수정');
                  }
                  
                  setUserDetailDialog({ isOpen: false, user: null });
                  loadUsers();
                  toast.success('사용자 정보가 업데이트되었습니다.');
                }
              }}
              className="text-sm"
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV 내보내기 다이얼로그 */}
      <CSVExportDialog
        isOpen={csvExportDialog}
        onClose={() => setCsvExportDialog(false)}
        onExport={handleCSVExport}
        totalCount={totalCount}
        selectedCount={selectedUsers.length}
      />
    </div>
  );
} 