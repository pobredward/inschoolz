'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, X, Search, Users, User, School } from 'lucide-react';
import { sendBroadcastNotification, searchUsers, searchSchools } from '@/lib/api/notifications';
import { NotificationType } from '@/types';
import { PushNotificationTester } from '@/components/admin/PushNotificationTester';

type TargetType = 'all' | 'specific_users' | 'specific_school';

interface SelectedUser {
  id: string;
  realName: string;
  userName: string;
  schoolName?: string;
}

interface SelectedSchool {
  id: string;
  name: string;
  address?: string;
  type?: string;
}

const notificationTypes: { value: NotificationType; label: string; description: string }[] = [
  { value: 'system', label: '시스템 알림', description: '시스템 공지사항 및 중요 알림' },
  { value: 'warning', label: '경고 알림', description: '사용자에게 경고 메시지 발송' },
  { value: 'general', label: '일반 알림', description: '일반적인 안내사항' },
  { value: 'event', label: '이벤트 알림', description: '특별 이벤트나 프로모션 알림' },
];

export default function AdminNotificationsPage() {
  const [notificationType, setNotificationType] = useState<NotificationType>('system');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    sentCount: number;
    errors: string[];
  } | null>(null);

  // 사용자 검색 관련 상태
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SelectedUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // 학교 검색 관련 상태
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [schoolSearchResults, setSchoolSearchResults] = useState<SelectedSchool[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SelectedSchool | null>(null);
  const [isSearchingSchools, setIsSearchingSchools] = useState(false);



  // 사용자 검색
  const handleUserSearch = async () => {
    if (!userSearchQuery.trim()) return;
    
    setIsSearchingUsers(true);
    try {
      const results = await searchUsers(userSearchQuery);
      setUserSearchResults(results);
    } catch (error) {
      toast.error('사용자 검색 중 오류가 발생했습니다.');
      console.error('사용자 검색 오류:', error);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // 사용자 선택
  const handleUserSelect = (user: SelectedUser) => {
    if (!selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(prev => [...prev, user]);
    }
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  // 사용자 선택 해제
  const handleUserRemove = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  // 학교 검색 (수동 검색)
  const handleSchoolSearch = async () => {
    const query = schoolSearchQuery.trim();
    if (query.length < 2) {
      toast.error('학교명을 2글자 이상 입력해주세요.');
      return;
    }
    
    setIsSearchingSchools(true);
    try {
      const results = await searchSchools(query);
      setSchoolSearchResults(results);
      if (results.length === 0) {
        toast.info('검색 결과가 없습니다.');
      }
    } catch (error) {
      toast.error('학교 검색 중 오류가 발생했습니다.');
      console.error('학교 검색 오류:', error);
    } finally {
      setIsSearchingSchools(false);
    }
  };

  // 학교 선택
  const handleSchoolSelect = (school: SelectedSchool) => {
    setSelectedSchool(school);
    setSchoolSearchQuery('');
    setSchoolSearchResults([]);
  };

  // 대상 타입 변경
  const handleTargetTypeChange = (type: TargetType) => {
    setTargetType(type);
    setSelectedUsers([]);
    setSelectedSchool(null);
    setUserSearchQuery('');
    setSchoolSearchQuery('');
    setUserSearchResults([]);
    setSchoolSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !message.trim()) {
      toast.error('제목과 내용을 모두 입력해주세요.');
      return;
    }

    if (targetType === 'specific_users' && selectedUsers.length === 0) {
      toast.error('알림을 받을 사용자를 선택해주세요.');
      return;
    }

    if (targetType === 'specific_school' && !selectedSchool) {
      toast.error('알림을 받을 학교를 선택해주세요.');
      return;
    }

    setIsLoading(true);
    setResult(null);
    
    try {
      const data = {
        type: notificationType,
        title: title.trim(),
        message: message.trim(),
        targetType,
        ...(targetType === 'specific_users' && {
          targetUserIds: selectedUsers.map(u => u.id)
        }),
        ...(targetType === 'specific_school' && {
          targetSchoolId: selectedSchool?.id
        })
      };

      const response = await sendBroadcastNotification(data);
      setResult(response);
      
      if (response.success) {
        toast.success(`알림이 성공적으로 발송되었습니다! (${response.sentCount}명)`);
        setTitle('');
        setMessage('');
        setSelectedUsers([]);
        setSelectedSchool(null);
      } else {
        toast.error('알림 발송에 실패했습니다.');
      }
    } catch (error) {
      toast.error('알림 발송 중 오류가 발생했습니다.');
      console.error('알림 발송 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTargetTypeLabel = (type: TargetType) => {
    switch (type) {
      case 'all': return '모든 사용자';
      case 'specific_users': return '특정 사용자';
      case 'specific_school': return '특정 학교';
      default: return '모든 사용자';
    }
  };

  const getTargetDescription = () => {
    switch (targetType) {
      case 'all': 
        return '모든 사용자에게 알림을 발송합니다.';
      case 'specific_users': 
        return `선택된 ${selectedUsers.length}명의 사용자에게 알림을 발송합니다.`;
      case 'specific_school': 
        return selectedSchool 
          ? `${selectedSchool.name}을(를) 즐겨찾기한 사용자들에게 알림을 발송합니다.`
          : '선택된 학교를 즐겨찾기한 사용자들에게 알림을 발송합니다.';
      default: 
        return '';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-800 mb-2">알림 설정</h1>
        <p className="text-gray-600">모든 사용자 또는 특정 대상에게 알림을 발송할 수 있습니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 알림 타입 선택 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">알림 타입</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={notificationType} onValueChange={(value) => setNotificationType(value as NotificationType)}>
              <SelectTrigger>
                <SelectValue placeholder="알림 타입을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {notificationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 발송 대상 선택 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">발송 대상</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                type="button"
                variant={targetType === 'all' ? 'default' : 'outline'}
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => handleTargetTypeChange('all')}
              >
                <Users className="h-6 w-6" />
                <span>모든 사용자</span>
              </Button>
              
              <Button
                type="button"
                variant={targetType === 'specific_users' ? 'default' : 'outline'}
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => handleTargetTypeChange('specific_users')}
              >
                <User className="h-6 w-6" />
                <span>특정 사용자</span>
              </Button>
              
              <Button
                type="button"
                variant={targetType === 'specific_school' ? 'default' : 'outline'}
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => handleTargetTypeChange('specific_school')}
              >
                <School className="h-6 w-6" />
                <span>특정 학교</span>
              </Button>
            </div>
            
            <p className="text-sm text-gray-600 mt-2">
              {getTargetDescription()}
            </p>
          </CardContent>
        </Card>

        {/* 특정 사용자 검색 */}
        {targetType === 'specific_users' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">사용자 검색 및 선택</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="사용자 이름 또는 아이디로 검색..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUserSearch()}
                />
                <Button
                  type="button"
                  onClick={handleUserSearch}
                  disabled={isSearchingUsers || !userSearchQuery.trim()}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>

              {/* 검색 결과 */}
              {userSearchResults.length > 0 && (
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-medium mb-2">검색 결과</h4>
                  <div className="space-y-2">
                    {userSearchResults.map((user) => (
                      <div 
                        key={user.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => handleUserSelect(user)}
                      >
                        <div>
                          <p className="font-medium">{user.realName}</p>
                          <p className="text-sm text-gray-600">@{user.userName}</p>
                          {user.schoolName && (
                            <p className="text-xs text-gray-500">{user.schoolName}</p>
                          )}
                        </div>
                        <Button type="button" size="sm">선택</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 선택된 사용자 */}
              {selectedUsers.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">선택된 사용자 ({selectedUsers.length}명)</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                        {user.realName} (@{user.userName})
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => handleUserRemove(user.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 특정 학교 검색 */}
        {targetType === 'specific_school' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">학교 검색 및 선택</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                             <div className="space-y-2">
                 <div className="flex gap-2">
                   <Input
                     placeholder="학교명으로 검색 (2글자 이상 입력 후 검색)"
                     value={schoolSearchQuery}
                     onChange={(e) => setSchoolSearchQuery(e.target.value)}
                     onKeyPress={(e) => e.key === 'Enter' && handleSchoolSearch()}
                   />
                   <Button
                     type="button"
                     onClick={handleSchoolSearch}
                     disabled={isSearchingSchools || schoolSearchQuery.trim().length < 2}
                   >
                     <Search className="h-4 w-4" />
                   </Button>
                 </div>
                 <p className="text-xs text-gray-500">
                   💡 앞글자가 일치하는 학교가 우선 표시됩니다. 주소로 같은 이름의 학교를 구별할 수 있습니다.
                 </p>
               </div>

              {/* 검색 결과 */}
              {schoolSearchResults.length > 0 && (
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-medium mb-2">검색 결과</h4>
                  <div className="space-y-2">
                    {schoolSearchResults.map((school) => (
                      <div 
                        key={school.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                        onClick={() => handleSchoolSelect(school)}
                      >
                                                 <div className="flex-1 min-w-0">
                           <p className="font-medium text-gray-900 truncate">{school.name}</p>
                           {school.address && (
                             <p className="text-sm text-gray-600 truncate">{school.address}</p>
                           )}
                           {school.type && (
                             <p className="text-xs text-gray-500">{school.type}</p>
                           )}
                         </div>
                        <Button type="button" size="sm">선택</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 선택된 학교 */}
              {selectedSchool && (
                <div>
                  <h4 className="font-medium mb-2">선택된 학교</h4>
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    {selectedSchool.name}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => setSelectedSchool(null)}
                    />
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 알림 제목 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">알림 제목</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="테스트 발송"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-sm text-gray-500 mt-1">{title.length}/100</p>
          </CardContent>
        </Card>

        {/* 알림 내용 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">알림 내용</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="테스트 발송입니다"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-sm text-gray-500 mt-1">{message.length}/500</p>
          </CardContent>
        </Card>

        {/* 발송 버튼 */}
        <Card>
          <CardContent className="pt-6">
            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700" 
              disabled={isLoading || !title.trim() || !message.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              {isLoading ? '발송 중...' : '알림 발송'}
            </Button>
          </CardContent>
        </Card>

        {/* 발송 결과 */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className={`text-lg flex items-center gap-2 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                📊 발송 결과
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{result.sentCount}</div>
                  <div className="text-sm text-green-600">성공</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
                  <div className="text-sm text-red-600">실패</div>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-red-600 mb-2">⚠️ 일부 사용자에게 알림 발송이 실패했습니다</h4>
                  <div className="bg-red-50 p-3 rounded text-sm text-red-700 max-h-40 overflow-y-auto">
                    {result.errors.map((error, index) => (
                      <div key={index}>• {error}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </form>

      {/* 푸시 알림 테스터 추가 */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-2xl font-bold text-green-800 mb-6">🧪 푸시 알림 테스터</h2>
        <p className="text-gray-600 mb-6">개별 사용자에게 직접 푸시 알림을 발송하여 테스트할 수 있습니다.</p>
        <PushNotificationTester />
      </div>
    </div>
  );
} 