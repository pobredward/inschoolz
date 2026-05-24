'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Shield,
  Bell,
  AlertCircle
} from 'lucide-react';
import { 
  getReports, 
  getReportStats, 
  processReport 
} from '@/lib/api/reports';
import { createNotification } from '@/lib/api/notifications';
import { FirebaseTimestamp } from '@/types';
import { serverTimestamp } from 'firebase/firestore';
import { toDate } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { Report, ReportStatus, ReportType, ReportReason, ReportStats } from '@/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toTimestamp } from '@/lib/utils';

export function AdminReportsClient() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<ReportStatus | 'all'>('all');
  const [selectedType, setSelectedType] = useState<ReportType | 'all'>('all');
  const [processingReport, setProcessingReport] = useState<Report | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [newStatus, setNewStatus] = useState<ReportStatus>('pending');
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationData, setNotificationData] = useState({
    targetUserId: '',
    type: 'general' as 'general' | 'warning',
    title: '',
    message: ''
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [selectedStatus, selectedType]);

  const fetchData = async () => {
    try {
      const [reportsData, statsData] = await Promise.all([
        getReports(
          selectedStatus === 'all' ? undefined : selectedStatus,
          selectedType === 'all' ? undefined : selectedType
        ),
        getReportStats()
      ]);

      setReports(reportsData.reports);
      setStats(statsData);
    } catch (error) {
      console.error('데이터 조회 실패:', error);
      toast.error('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessReport = async () => {
    console.log('handleProcessReport 호출됨');
    console.log('현재 상태:', { 
      user: user ? { uid: user.uid, email: user.email } : null, 
      processingReport: processingReport ? { id: processingReport.id, status: processingReport.status } : null,
      newStatus,
      actionNote,
      actionTaken
    });

    if (!user) {
      console.error('사용자 정보가 없습니다:', user);
      toast.error('사용자 정보가 없습니다. 다시 로그인해주세요.');
      return;
    }

    if (!processingReport) {
      console.error('처리할 신고 정보가 없습니다:', processingReport);
      toast.error('처리할 신고 정보가 없습니다.');
      return;
    }

    if (!newStatus) {
      console.error('새로운 상태가 설정되지 않았습니다:', newStatus);
      toast.error('처리 상태를 선택해주세요.');
      return;
    }

    console.log('신고 처리 시작:', { 
      reportId: processingReport.id, 
      currentStatus: processingReport.status,
      newStatus, 
      adminNote: actionNote || undefined, 
      actionTaken: actionTaken || undefined,
      adminId: user.uid
    });

    try {
      // Firestore 직접 업데이트
      const docRef = doc(db, 'reports', processingReport.id);
      
      const updateData: any = {
        status: newStatus,
        adminId: user.uid,
        updatedAt: serverTimestamp(),
      };

      if (actionNote.trim()) {
        updateData.adminNote = actionNote.trim();
      }
      
      if (actionTaken.trim()) {
        updateData.actionTaken = actionTaken.trim();
      }
      
      if (newStatus === 'resolved') {
        updateData.resolvedAt = serverTimestamp();
      }

      console.log('Firestore 업데이트 시도:', updateData);
      
      await updateDoc(docRef, updateData);
      
      console.log('Firestore 업데이트 성공');
      toast.success('신고가 처리되었습니다.');
      
      // 모든 상태 초기화
      closeProcessingModal();
      
      // 데이터 새로고침
      await fetchData();
    } catch (error) {
      console.error('신고 처리 실패:', error);
      toast.error('신고 처리에 실패했습니다: ' + (error as Error).message);
    }
  };

  const handleSendNotification = async () => {
    try {
      await createNotification({
        userId: notificationData.targetUserId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
      });
      
      toast.success('알림이 발송되었습니다.');
      setShowNotificationDialog(false);
      setNotificationData({
        targetUserId: '',
        type: 'general',
        title: '',
        message: ''
      });
    } catch (error) {
      console.error('알림 발송 실패:', error);
      toast.error('알림 발송에 실패했습니다.');
    }
  };

  const openNotificationDialog = (userId: string, isReporter: boolean) => {
    setNotificationData({
      targetUserId: userId,
      type: 'general',
      title: isReporter ? '신고자 알림' : '사용자 알림',
      message: ''
    });
    setShowNotificationDialog(true);
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />대기중</Badge>;
      case 'reviewing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><AlertTriangle className="w-3 h-3 mr-1" />검토중</Badge>;
      case 'resolved':
        return <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />처리완료</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />반려</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getReasonLabel = (reason: ReportReason) => {
    const reasonMap: Record<ReportReason, string> = {
      spam: '스팸/도배',
      inappropriate: '부적절한 내용',
      harassment: '괴롭힘/욕설',
      fake: '허위정보',
      copyright: '저작권 침해',
      privacy: '개인정보 노출',
      violence: '폭력적 내용',
      sexual: '성적 내용',
      hate: '혐오 발언',
      other: '기타',
    };
    return reasonMap[reason] || reason;
  };

  const getTargetTypeLabel = (type: ReportType) => {
    switch (type) {
      case 'post':
        return '게시글';
      case 'comment':
        return '댓글';
      case 'user':
        return '사용자';
      default:
        return type;
    }
  };

  const formatDate = (timestamp: FirebaseTimestamp) => {
    const date = toDate(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPostUrl = (report: Report) => {
    if (!report.boardCode) return null;
    
    if (report.targetType === 'post') {
      // 게시글 URL 생성
      if (report.schoolId) {
        return `/community/school/${report.schoolId}/${report.boardCode}/${report.targetId}`;
      } else if (report.regions) {
        return `/community/region/${report.regions.sido}/${report.regions.sigungu}/${report.boardCode}/${report.targetId}`;
      } else {
        return `/community/national/${report.boardCode}/${report.targetId}`;
      }
    } else if (report.targetType === 'comment' && report.postId) {
      // 댓글이 있는 게시글 URL 생성
      if (report.schoolId) {
        return `/community/school/${report.schoolId}/${report.boardCode}/${report.postId}`;
      } else if (report.regions) {
        return `/community/region/${report.regions.sido}/${report.regions.sigungu}/${report.boardCode}/${report.postId}`;
      } else {
        return `/community/national/${report.boardCode}/${report.postId}`;
      }
    }
    return null;
  };

  // 신고 내용 파싱 함수 (기존 개선사항 적용)
  const parsePostContent = (targetContent: string) => {
    try {
      const parsed = JSON.parse(targetContent);
      if (parsed.title && parsed.content) {
        return { title: parsed.title, content: parsed.content };
      }
    } catch (e) {
      // JSON 파싱 실패 시 구분자로 시도
      if (targetContent.includes('제목: ') && targetContent.includes(', 내용: ')) {
        const titleMatch = targetContent.match(/제목: (.*?), 내용: /);
        const contentMatch = targetContent.match(/, 내용: (.*)/);
        if (titleMatch && contentMatch) {
          return { title: titleMatch[1], content: contentMatch[1] };
        }
      }
    }
    // 파싱 실패 시 모든 내용을 content로 처리
    return { title: null, content: targetContent };
  };

  const stripHtmlTags = (html: string) => {
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const closeProcessingModal = () => {
    setProcessingReport(null);
    setActionNote('');
    setActionTaken('');
    // newStatus 초기화를 제거하여 상태 유지
  };

  if (loading) {
    return <div className="flex justify-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.totalReports}</div>
              <div className="text-sm text-gray-600">전체 신고</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingReports}</div>
              <div className="text-sm text-gray-600">대기중</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.resolvedReports}</div>
              <div className="text-sm text-gray-600">처리완료</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.rejectedReports}</div>
              <div className="text-sm text-gray-600">반려</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 필터 */}
      <div className="flex gap-4">
        <div className="flex-1">
          <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as ReportStatus | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="상태 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="reviewing">검토중</SelectItem>
              <SelectItem value="resolved">처리완료</SelectItem>
              <SelectItem value="rejected">반려</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={selectedType} onValueChange={(value) => setSelectedType(value as ReportType | 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="타입 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 타입</SelectItem>
              <SelectItem value="post">게시글</SelectItem>
              <SelectItem value="comment">댓글</SelectItem>
              <SelectItem value="user">사용자</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 신고 목록 */}
      <div className="space-y-4">
        {reports.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">조건에 맞는 신고가 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => {
            const postUrl = getPostUrl(report);
            const { title, content } = report.targetContent 
              ? parsePostContent(report.targetContent) 
              : { title: null, content: null };
            
            return (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getTargetTypeLabel(report.targetType)} 신고
                        {getStatusBadge(report.status)}
                      </CardTitle>
                      <div className="text-sm text-gray-500 mt-1 space-y-1">
                        <p>신고자: {report.reporterInfo.displayName}</p>
                        <p>신고일: {formatDate(toTimestamp(report.createdAt))}</p>
                        {report.resolvedAt && (
                          <p>처리일: {formatDate(toTimestamp(report.resolvedAt))}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {/* 원문보기 버튼 */}
                      {postUrl && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(postUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          원문보기
                        </Button>
                      )}

                      {/* 사용자 프로필 보기 */}
                      {report.targetType === 'user' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.open(`/users/${report.targetId}`, '_blank');
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          프로필 보기
                        </Button>
                      )}

                      {/* 신고자에게 알림 발송 */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openNotificationDialog(report.reporterId, true)}
                      >
                        <Bell className="w-4 h-4 mr-1" />
                        신고자
                      </Button>

                      {/* 신고받은 사용자에게 알림 발송 */}
                      {report.targetAuthorId && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openNotificationDialog(report.targetAuthorId!, false)}
                        >
                          <AlertCircle className="w-4 h-4 mr-1" />
                          신고받은 사용자
                        </Button>
                      )}

                      {/* 처리 버튼 */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          console.log('처리 버튼 클릭됨:', report);
                          setNewStatus(report.status);
                          setProcessingReport(report);
                        }}
                      >
                        <Shield className="w-4 h-4 mr-1" />
                        처리
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">신고 사유: </span>
                      <span>{getReasonLabel(report.reason)}</span>
                      {report.customReason && (
                        <span className="text-gray-600"> - {report.customReason}</span>
                      )}
                    </div>
                    
                    {report.description && (
                      <div>
                        <span className="font-medium">상세 설명: </span>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">{report.description}</p>
                      </div>
                    )}

                    {/* 개선된 신고 대상 내용 표시 */}
                    {report.targetContent && (
                      <div>
                        <span className="font-medium">신고 대상: </span>
                        {title ? (
                          <div className="mt-1 space-y-1">
                            <div>
                              <span className="text-xs text-gray-500">제목:</span>
                              <p className="text-sm text-gray-700 line-clamp-1">{stripHtmlTags(title)}</p>
                            </div>
                            <div>
                              <span className="text-xs text-gray-500">내용:</span>
                              <p className="text-sm text-gray-600 line-clamp-2">{stripHtmlTags(content)}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{stripHtmlTags(content)}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 신고 처리 모달 */}
      {processingReport && (
        <Dialog open={true} onOpenChange={closeProcessingModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>신고 처리</DialogTitle>
              <DialogDescription>
                신고된 내용을 검토하고 적절한 조치를 취해주세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="font-medium">신고 내용</Label>
                <p className="text-sm text-gray-600 mt-1">
                  {getReasonLabel(processingReport.reason)}
                  {processingReport.customReason && ` - ${processingReport.customReason}`}
                </p>
              </div>

              {/* 상태 선택 */}
              <div className="space-y-2">
                <Label htmlFor="status">처리 상태</Label>
                <Select value={newStatus} onValueChange={(value: ReportStatus) => setNewStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">대기중</SelectItem>
                    <SelectItem value="reviewing">검토중</SelectItem>
                    <SelectItem value="resolved">처리완료</SelectItem>
                    <SelectItem value="rejected">반려</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actionTaken">처리 결과</Label>
                <Textarea
                  id="actionTaken"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="취한 조치를 입력하세요 (예: 경고, 3일 정지, 게시글 삭제 등)"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNote">관리자 메모 (선택사항)</Label>
                <Textarea
                  id="adminNote"
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="내부 메모를 입력하세요"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeProcessingModal}>
                  취소
                </Button>
                <Button 
                  onClick={handleProcessReport}
                  disabled={!newStatus}
                >
                  처리 완료
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 알림 발송 모달 */}
      {showNotificationDialog && (
        <Dialog open={true} onOpenChange={() => setShowNotificationDialog(false)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>알림 발송</DialogTitle>
              <DialogDescription>
                해당 사용자에게 알림 메시지를 발송합니다.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notificationType">알림 유형</Label>
                <Select 
                  value={notificationData.type} 
                  onValueChange={(value: 'general' | 'warning') => 
                    setNotificationData(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">일반 알림</SelectItem>
                    <SelectItem value="warning">경고 알림</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notificationTitle">제목</Label>
                <input
                  id="notificationTitle"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={notificationData.title}
                  onChange={(e) => setNotificationData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="알림 제목을 입력하세요"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notificationMessage">메시지</Label>
                <Textarea
                  id="notificationMessage"
                  value={notificationData.message}
                  onChange={(e) => setNotificationData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="알림 메시지를 입력하세요"
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>
                  취소
                </Button>
                <Button 
                  onClick={handleSendNotification}
                  disabled={!notificationData.title || !notificationData.message}
                >
                  알림 발송
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 