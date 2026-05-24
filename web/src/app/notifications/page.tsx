'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { 
  getUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  deleteNotification,
  deleteMultipleNotifications
} from '@/lib/api/notifications';
import { Notification, NotificationType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  MessageSquare, 
  Reply, 
  Heart, 
  UserPlus,
  AlertTriangle,
  Shield,
  Users,
  Calendar,
  Info,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { toDate } from '@/lib/utils';

// 알림 타입별 아이콘 및 색상
const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'post_comment':
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'comment_reply':
      return <Reply className="h-4 w-4 text-green-500" />;
    case 'like':
      return <Heart className="h-4 w-4 text-red-500" />;
    case 'follow':
      return <UserPlus className="h-4 w-4 text-purple-500" />;
    case 'referral':
      return <Users className="h-4 w-4 text-indigo-500" />;
    case 'system':
      return <Bell className="h-4 w-4 text-blue-600" />;
    case 'general':
      return <Info className="h-4 w-4 text-gray-600" />;
    case 'event':
      return <Calendar className="h-4 w-4 text-green-600" />;
    case 'report_received':
    case 'report_resolved':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'warning':
    case 'suspension':
      return <Shield className="h-4 w-4 text-red-600" />;
    default:
      return <Bell className="h-4 w-4 text-gray-500" />;
  }
};

// 알림 타입별 배경색
const getNotificationBadgeColor = (type: NotificationType) => {
  switch (type) {
    case 'post_comment':
      return 'bg-blue-100 text-blue-800';
    case 'comment_reply':
      return 'bg-green-100 text-green-800';
    case 'like':
      return 'bg-red-100 text-red-800';
    case 'follow':
      return 'bg-purple-100 text-purple-800';
    case 'referral':
      return 'bg-indigo-100 text-indigo-800';
    case 'system':
      return 'bg-blue-100 text-blue-800';
    case 'general':
      return 'bg-gray-100 text-gray-800';
    case 'event':
      return 'bg-green-100 text-green-800';
    case 'report_received':
    case 'report_resolved':
      return 'bg-orange-100 text-orange-800';
    case 'warning':
    case 'suspension':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // 알림 목록 조회
  const loadNotifications = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const data = await getUserNotifications(user.uid, 50);
      setNotifications(data);
    } catch (error) {
      console.error('알림 조회 실패:', error);
      toast.error('알림을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  // 알림 클릭 시 읽음 처리 및 관련 페이지로 이동
  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
      }

      // 타입별로 적절한 페이지로 이동
      const { data } = notification;
      
      if (data?.postId && (notification.type === 'post_comment' || notification.type === 'comment_reply')) {
        // 댓글 관련 알림은 해당 게시글로 이동 (익명 여부와 관계없이 게시글로만 이동)
        let route = '';
        
        if (data.postType === 'national') {
          route = `/community/national/${data.boardCode}/${data.postId}`;
        } else if (data.postType === 'regional' && data.regions) {
          const regions = data.regions as { sido: string; sigungu: string };
          route = `/community/region/${regions.sido}/${regions.sigungu}/${data.boardCode}/${data.postId}`;
        } else if (data.postType === 'school' && data.schoolId) {
          route = `/community/school/${data.schoolId}/${data.boardCode}/${data.postId}`;
        }
        
        if (route) {
          router.push(route);
        }
      } else if (data?.targetUserId && notification.type === 'referral' && !data.isAnonymous) {
        // 추천인 알림은 해당 사용자 프로필로 이동 (익명이 아닌 경우에만)
        // 익명 사용자인 경우 프로필로 이동하지 않음
        router.push(`/users/${data.targetUserId}`);
      } else if (notification.type === 'system') {
        // 시스템 알림은 특별한 이동 없음
        toast('시스템 알림입니다.');
      } else if (data?.isAnonymous) {
        // 익명 사용자 관련 알림인 경우 별도 처리 없이 읽음 처리만
        toast('익명 사용자 관련 알림입니다.');
      }
    } catch (error) {
      console.error('알림 처리 실패:', error);
      toast.error('알림 처리에 실패했습니다.');
    }
  };

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      setIsProcessing(true);
      await markAllNotificationsAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      console.error('모든 알림 읽음 처리 실패:', error);
      toast.error('모든 알림 읽음 처리에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 선택된 알림 삭제
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;

    try {
      setIsProcessing(true);
      await deleteMultipleNotifications(selectedIds);
      setNotifications(prev => prev.filter(n => !selectedIds.includes(n.id)));
      setSelectedIds([]);
      toast.success(`${selectedIds.length}개의 알림을 삭제했습니다.`);
    } catch (error) {
      console.error('알림 삭제 실패:', error);
      toast.error('알림 삭제에 실패했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 개별 알림 삭제
  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setSelectedIds(prev => prev.filter(id => id !== notificationId));
      toast.success('알림을 삭제했습니다.');
    } catch (error) {
      console.error('알림 삭제 실패:', error);
      toast.error('알림 삭제에 실패했습니다.');
    }
  };

  // 전체 선택/해제
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(notifications.map(n => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 개별 선택/해제
  const handleSelectNotification = (notificationId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, notificationId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== notificationId));
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-green-600" />
            <h1 className="text-2xl font-bold">알림</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive">{unreadCount}</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isProcessing}
                className="flex items-center gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                모두 읽음
              </Button>
            )}
            
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isProcessing}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                선택 삭제 ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>

        {/* 일괄 선택 */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
            <Checkbox
              checked={selectedIds.length === notifications.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600">
              전체 선택 ({selectedIds.length}/{notifications.length})
            </span>
          </div>
        )}

        {/* 알림 목록 */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">알림을 불러오는 중...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">아직 받은 알림이 없습니다.</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="divide-y">
                  {notifications.map((notification, index) => (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors ${
                        !notification.isRead ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      {/* 선택 체크박스 */}
                      <Checkbox
                        checked={selectedIds.includes(notification.id)}
                        onCheckedChange={(checked) => 
                          handleSelectNotification(notification.id, checked as boolean)
                        }
                      />

                      {/* 알림 아이콘 */}
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* 알림 내용 */}
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className={`text-sm font-medium ${
                                !notification.isRead ? 'text-gray-900' : 'text-gray-600'
                              }`}>
                                {notification.title}
                              </h3>
                              <Badge 
                                variant="secondary"
                                className={`text-xs ${getNotificationBadgeColor(notification.type)}`}
                              >
                                {notification.type}
                              </Badge>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                              )}
                            </div>
                            <p className={`text-sm ${
                              !notification.isRead ? 'text-gray-700' : 'text-gray-500'
                            }`}>
                              {notification.message}
                              {notification.data?.isAnonymous === true && (
                                <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  익명
                                </span>
                              )}
                            </p>
                            
                            {/* 추가 정보 */}
                            {notification.data && (
                              <div className="mt-2 text-xs text-gray-400">
                                {notification.data.postTitle && (
                                  <p>게시글: {notification.data.postTitle}</p>
                                )}
                                {notification.data.commentContent && (
                                  <p className="truncate">내용: {notification.data.commentContent}</p>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(toDate(notification.createdAt)), {
                                addSuffix: true,
                                locale: ko
                              })}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotification(notification.id);
                              }}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 