'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, CheckCircle, XCircle, Edit, Trash2, ExternalLink } from 'lucide-react';
import { getUserReports, cancelReport } from '@/lib/api/reports';
import { useAuth } from '@/providers/AuthProvider';
import { Report, ReportStatus, ReportReason, UserReportRecord, FirebaseTimestamp } from '@/types';
import { toast } from 'sonner';
import { ReportModal } from '@/components/ui/report-modal';
import { stripHtmlTags } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@/lib/utils';

export function ReportsPageClient() {
  const [reportRecord, setReportRecord] = useState<UserReportRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('ReportsPageClient useEffect 실행:', { user, userUid: user?.uid });
    
    const fetchReports = async () => {
      console.log('fetchReports 함수 시작, user:', user);
      
      if (!user?.uid) {
        console.log('사용자 정보가 없음, 로딩 완료');
        setLoading(false);
        return;
      }

      try {
        console.log('getUserReports 호출 시작, userId:', user.uid);
        const record = await getUserReports(user.uid);
        console.log('getUserReports 결과:', record);
        setReportRecord(record);
      } catch (error) {
        console.error('신고 기록 조회 실패:', error);
        toast.error('신고 기록을 불러오는데 실패했습니다.');
      } finally {
        console.log('fetchReports 완료, 로딩 상태 해제');
        setLoading(false);
      }
    };

    fetchReports();
  }, [user]);

  const handleEditReport = (report: Report) => {
    setEditingReport(report);
  };

  const handleCancelReport = async (reportId: string) => {
    if (!confirm('정말로 신고를 취소하시겠습니까?')) return;

    try {
      await cancelReport(reportId);
      toast.success('신고가 취소되었습니다.');
      
      // 목록 새로고침
      if (user) {
        const record = await getUserReports(user.uid);
        setReportRecord(record);
      }
    } catch (error) {
      console.error('신고 취소 실패:', error);
      toast.error('신고 취소에 실패했습니다.');
    }
  };

  const handleUpdateSuccess = async () => {
    setEditingReport(null);
    toast.success('신고가 수정되었습니다.');
    
    // 목록 새로고침
    if (user) {
      const record = await getUserReports(user.uid);
      setReportRecord(record);
    }
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

  const getTargetTypeLabel = (type: string) => {
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
    return formatRelativeTime(timestamp);
  };

  // 게시글 URL 생성 함수
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

  // 신고 대상 내용에서 HTML 태그 제거 및 2줄 제한
  const getCleanContent = (content: string) => {
    if (!content) return '';
    return stripHtmlTags(content);
  };

  // 게시글 신고 시 제목과 내용 분리하는 함수
  const parsePostContent = (targetContent: string | undefined, targetType: string) => {
    if (!targetContent || targetType !== 'post') {
      return { title: null, content: targetContent || '' };
    }

    try {
      // JSON 형태로 저장된 경우 파싱 시도
      const parsed = JSON.parse(targetContent);
      if (parsed.title && parsed.content) {
        return {
          title: parsed.title,
          content: parsed.content
        };
      }
    } catch {
      // JSON이 아닌 경우 구분자로 분리 시도
      if (targetContent.includes('|||')) {
        const [title, content] = targetContent.split('|||');
        return {
          title: title?.trim() || null,
          content: content?.trim() || targetContent
        };
      }
    }

    // 분리할 수 없는 경우 모든 내용을 content로 처리
    return { title: null, content: targetContent };
  };

  if (loading) {
    return <div className="flex justify-center py-8">로딩 중...</div>;
  }

  if (!reportRecord) {
    return <div className="text-center py-8">신고 기록을 불러올 수 없습니다.</div>;
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{reportRecord.stats.totalReportsMade}</div>
            <div className="text-sm text-gray-600">내가 신고한 횟수</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{reportRecord.stats.totalReportsReceived}</div>
            <div className="text-sm text-gray-600">나를 신고한 횟수</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{reportRecord.stats.warningsReceived}</div>
            <div className="text-sm text-gray-600">받은 경고</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{reportRecord.stats.suspensionsReceived}</div>
            <div className="text-sm text-gray-600">받은 정지</div>
          </CardContent>
        </Card>
      </div>

      {/* 신고 내역 탭 */}
      <Tabs defaultValue="made" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="made" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            내가 신고한 내역
            <Badge variant="secondary" className="ml-1">
              {reportRecord.reportsMade.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="received" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            나를 신고한 내역
            <Badge variant="secondary" className="ml-1">
              {reportRecord.reportsReceived.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="made" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">내가 신고한 내역</h3>
            <Badge variant="outline">{reportRecord.reportsMade.length}개</Badge>
          </div>
          {reportRecord.reportsMade.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">신고한 내역이 없습니다</p>
                <p className="text-gray-400 text-sm">부적절한 내용을 발견하시면 신고해주세요.</p>
              </CardContent>
            </Card>
          ) : (
            reportRecord.reportsMade.map((report) => (
              <Card key={report.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                const url = getPostUrl(report);
                if (url) router.push(url);
              }}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getTargetTypeLabel(report.targetType)} 신고
                        {getStatusBadge(report.status)}
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(report.createdAt)}
                      </p>
                    </div>
                    {report.status === 'pending' && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditReport(report)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          수정
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelReport(report.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          취소
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium">신고 사유: </span>
                      <span>{getReasonLabel(report.reason)}</span>
                      {report.customReason && (
                        <span className="text-gray-600"> - {report.customReason}</span>
                      )}
                    </div>
                    
                    {/* 신고한 유저 아이디 표시 */}
                    {report.targetType === 'user' && report.targetId && (
                      <div>
                        <span className="font-medium">신고한 유저: </span>
                        <span className="text-blue-600">@{report.targetId}</span>
                      </div>
                    )}
                    
                    {report.description && (
                      <div>
                        <span className="font-medium">상세 설명: </span>
                        <span className="text-gray-600">{report.description}</span>
                      </div>
                    )}

                    {report.targetContent && (
                      <div>
                        <span className="font-medium">신고 대상 내용: </span>
                        <div className="mt-1 p-2 bg-gray-50 rounded border">
                          {(() => {
                            const { title, content } = parsePostContent(report.targetContent, report.targetType);
                            return (
                              <div className="space-y-2">
                                {title && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500">제목:</span>
                                    <p className="text-sm text-gray-700 font-medium line-clamp-1">{getCleanContent(title)}</p>
                                  </div>
                                )}
                                <div>
                                  {title && <span className="text-xs font-medium text-gray-500">내용:</span>}
                                  <p className="text-sm text-gray-700 line-clamp-2">{getCleanContent(content)}</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {report.status === 'resolved' && report.actionTaken && (
                      <div>
                        <span className="font-medium">처리 결과: </span>
                        <span className="text-green-600">{report.actionTaken}</span>
                      </div>
                    )}

                    {report.status === 'rejected' && report.adminNote && (
                      <div>
                        <span className="font-medium">반려 사유: </span>
                        <span className="text-red-600">{report.adminNote}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">나를 신고한 내역</h3>
            <Badge variant="outline">{reportRecord.reportsReceived.length}개</Badge>
          </div>
          {reportRecord.reportsReceived.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg mb-2">신고받은 내역이 없습니다</p>
                <p className="text-gray-400 text-sm">깨끗한 활동을 유지하고 계시네요!</p>
              </CardContent>
            </Card>
          ) : (
            reportRecord.reportsReceived.map((report) => (
              <Card key={report.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
                const url = getPostUrl(report);
                if (url) router.push(url);
              }}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getTargetTypeLabel(report.targetType)} 신고
                        {getStatusBadge(report.status)}
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(report.createdAt)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium">신고 사유: </span>
                      <span>{getReasonLabel(report.reason)}</span>
                      {report.customReason && (
                        <span className="text-gray-600"> - {report.customReason}</span>
                      )}
                    </div>

                    {report.description && (
                      <div>
                        <span className="font-medium">신고 상세 설명: </span>
                        <span className="text-gray-600">{report.description}</span>
                      </div>
                    )}

                    {report.targetContent && (
                      <div>
                        <span className="font-medium">신고된 내용: </span>
                        <div className="mt-1 p-2 bg-gray-50 rounded border">
                          {(() => {
                            const { title, content } = parsePostContent(report.targetContent, report.targetType);
                            return (
                              <div className="space-y-2">
                                {title && (
                                  <div>
                                    <span className="text-xs font-medium text-gray-500">제목:</span>
                                    <p className="text-sm text-gray-700 font-medium line-clamp-1">{getCleanContent(title)}</p>
                                  </div>
                                )}
                                <div>
                                  {title && <span className="text-xs font-medium text-gray-500">내용:</span>}
                                  <p className="text-sm text-gray-700 line-clamp-2">{getCleanContent(content)}</p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {report.status === 'resolved' && report.actionTaken && (
                      <div>
                        <span className="font-medium">처리 결과: </span>
                        <span className="text-green-600">{report.actionTaken}</span>
                      </div>
                    )}

                    {report.status === 'resolved' && report.resolvedAt && (
                      <div>
                        <span className="font-medium">처리 일시: </span>
                        <span className="text-gray-600">{formatDate(report.resolvedAt)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* 신고 수정 모달 */}
      {editingReport && (
        <ReportModal
          isOpen={true}
          onClose={() => setEditingReport(null)}
          targetId={editingReport.targetId}
          targetType={editingReport.targetType}
          targetContent={editingReport.targetContent}
          onSuccess={handleUpdateSuccess}
          boardCode={editingReport.boardCode}
          schoolId={editingReport.schoolId}
          regions={editingReport.regions}
        />
      )}
    </div>
  );
} 