"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Activity, 
  Search, 
  RefreshCw,
  BarChart3,
  Users,
  Settings,
  AlertTriangle,
  Edit,
  Trash2,
  UserCheck
} from 'lucide-react';
import { 
  getAdminActionLogs, 
  getActionStatistics, 
  getAdminList, 
  getActionTypeList, 
  getActionDisplayName,
  AdminLogListParams 
} from '@/lib/api/admin-logs';
import { AdminActionLog } from '@/types/admin';
import { toast } from 'sonner';
import { toDate } from '@/lib/utils';

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AdminActionLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // 필터 상태
  const [adminIdFilter, setAdminIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetUserIdFilter, setTargetUserIdFilter] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 통계 데이터
  const [statistics, setStatistics] = useState<{
    actionStats: Record<string, number>;
    adminStats: Record<string, number>;
    totalLogs: number;
  } | null>(null);
  
  // 선택 옵션 데이터
  const [adminList, setAdminList] = useState<{ adminId: string; adminName: string; actionCount: number }[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  
  const [showStatistics, setShowStatistics] = useState(true);

  const loadLogs = async (params: AdminLogListParams = {}) => {
    setIsLoading(true);
    try {
      const response = await getAdminActionLogs({
        page: currentPage,
        pageSize: 20,
        adminId: adminIdFilter || undefined,
        action: actionFilter || undefined,
        targetUserId: targetUserIdFilter || undefined,
        dateRange: dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined,
        sortOrder,
        ...params
      });
      
      setLogs(response.logs);
      setTotalCount(response.totalCount);
      setHasMore(response.hasMore);
    } catch (error) {
      console.error('로그 목록 로드 오류:', error);
      toast.error('로그 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await getActionStatistics(
        dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined
      );
      setStatistics(stats);
    } catch (error) {
      console.error('통계 로드 오류:', error);
      toast.error('통계를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const loadSelectOptions = async () => {
    try {
      const [admins, actions] = await Promise.all([
        getAdminList(),
        getActionTypeList()
      ]);
      
      setAdminList(admins);
      setActionTypes(actions);
    } catch (error) {
      console.error('선택 옵션 로드 오류:', error);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentPage, adminIdFilter, actionFilter, targetUserIdFilter, dateRange, sortOrder]);

  useEffect(() => {
    if (showStatistics) {
      loadStatistics();
    }
  }, [dateRange, showStatistics]);

  useEffect(() => {
    loadSelectOptions();
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    loadLogs({ page: 1 });
  };

  const clearFilters = () => {
    setAdminIdFilter('');
    setActionFilter('');
    setTargetUserIdFilter('');
    setDateRange({});
    setCurrentPage(1);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'role_change': return <UserCheck className="h-4 w-4" />;
      case 'status_change': return <Settings className="h-4 w-4" />;
      case 'delete_user': return <Trash2 className="h-4 w-4" />;
      case 'add_warning': return <AlertTriangle className="h-4 w-4" />;
      case 'update_experience': return <Edit className="h-4 w-4" />;
      case 'bulk_update': return <Users className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'role_change': return 'bg-blue-100 text-blue-800';
      case 'status_change': return 'bg-yellow-100 text-yellow-800';
      case 'delete_user': return 'bg-red-100 text-red-800';
      case 'add_warning': return 'bg-orange-100 text-orange-800';
      case 'update_experience': return 'bg-green-100 text-green-800';
      case 'bulk_update': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: Date | unknown) => {
    try {
      const date = timestamp instanceof Date ? timestamp : toDate(timestamp);
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('ko-KR') + ' ' + date.toLocaleTimeString('ko-KR');
    } catch {
      return '-';
    }
  };

  const formatValue = (value: string | number | boolean | object | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">관리자 작업 로그</h1>
          <p className="text-gray-600">총 {totalCount}개의 로그</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowStatistics(!showStatistics)}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showStatistics ? '통계 숨기기' : '통계 보기'}
          </Button>
          <Button onClick={() => loadLogs()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 통계 */}
      {showStatistics && statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">전체 작업 수</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{statistics.totalLogs}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">작업 유형별 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(statistics.actionStats)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 3)
                  .map(([action, count]) => (
                    <div key={action} className="flex justify-between text-sm">
                      <span>{getActionDisplayName(action)}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-700">활발한 관리자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(statistics.adminStats)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 3)
                  .map(([adminId, count]) => {
                    const admin = adminList.find(a => a.adminId === adminId);
                    return (
                      <div key={adminId} className="flex justify-between text-sm">
                        <span className="truncate">{admin?.adminName || adminId}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 검색 및 필터 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>검색 및 필터</CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              필터 초기화
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label htmlFor="admin">관리자</Label>
              <Select value={adminIdFilter} onValueChange={setAdminIdFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  {adminList.map((admin) => (
                    <SelectItem key={admin.adminId} value={admin.adminId}>
                      {admin.adminName} ({admin.actionCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="action">작업 유형</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">전체</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {getActionDisplayName(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="targetUser">대상 사용자 ID</Label>
              <Input
                id="targetUser"
                placeholder="사용자 ID 입력..."
                value={targetUserIdFilter}
                onChange={(e) => setTargetUserIdFilter(e.target.value)}
              />
            </div>
            
            <div>
              <Label>시작일</Label>
              <Input
                type="date"
                value={dateRange.from ? dateRange.from.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  from: e.target.value ? new Date(e.target.value) : undefined 
                }))}
              />
            </div>
            
            <div>
              <Label>종료일</Label>
              <Input
                type="date"
                value={dateRange.to ? dateRange.to.toISOString().split('T')[0] : ''}
                onChange={(e) => setDateRange(prev => ({ 
                  ...prev, 
                  to: e.target.value ? new Date(e.target.value) : undefined 
                }))}
              />
            </div>
            
            <div>
              <Label htmlFor="sort">정렬</Label>
              <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">최신순</SelectItem>
                  <SelectItem value="asc">오래된순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-4">
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              검색
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 로그 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>로그 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>관리자</TableHead>
                    <TableHead>작업</TableHead>
                    <TableHead>대상 사용자</TableHead>
                    <TableHead>이전 값</TableHead>
                    <TableHead>새 값</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.adminName}</div>
                        <div className="text-xs text-gray-500">{log.adminId}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getActionColor(log.action)}>
                          <div className="flex items-center gap-1">
                            {getActionIcon(log.action)}
                            {getActionDisplayName(log.action)}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{log.targetUserName || '-'}</div>
                        <div className="text-xs text-gray-500">{log.targetUserId || '-'}</div>
                      </TableCell>
                      <TableCell className="text-sm max-w-32 truncate">
                        {formatValue(log.oldValue)}
                      </TableCell>
                      <TableCell className="text-sm max-w-32 truncate">
                        {formatValue(log.newValue)}
                      </TableCell>
                      <TableCell className="text-sm max-w-40 truncate">
                        {log.reason || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {log.ipAddress || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
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
    </div>
  );
} 