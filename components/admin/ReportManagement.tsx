import React, { useState, useEffect } from "react";
import styled from "@emotion/styled";
import { useRouter } from "next/router";
import {
  getReportedContents,
  warnUser,
  deleteContent,
  completeReportHandling,
  getCompletedReports,
  reactivateReport,
} from "../../services/adminService";
import { ReportedContent, Report, CompletedReport } from "../../types";
import DefaultModal from "../modal/DefaultModal";
import WarnModal from "../modal/WarnModal";

const ReportManagement: React.FC = () => {
  const [reportedContents, setReportedContents] = useState<ReportedContent[]>(
    [],
  );
  const [completedReports, setCompletedReports] = useState<CompletedReport[]>(
    [],
  );
  const [showReportModal, setShowReportModal] = useState(false);
  const [showWarnModal, setShowWarnModal] = useState(false);
  const [selectedReports, setSelectedReports] = useState<Report[]>([]);
  const [selectedContent, setSelectedContent] =
    useState<ReportedContent | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">(
    "pending",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState("");
  const router = useRouter();

  const reportReasons = [
    "부적절한 내용",
    "혐오 발언",
    "폭력적인 내용",
    "개인정보 노출",
    "저작권 침해",
    "도배성 문구",
  ];

  useEffect(() => {
    if (activeTab === "pending") {
      fetchReportedContents();
    } else {
      fetchCompletedReports();
    }
  }, [activeTab, currentPage, reportedContents.length]);

  const fetchReportedContents = async () => {
    try {
      const contents = await getReportedContents();
      setReportedContents(contents);
    } catch (error) {
      console.error("Error fetching reported contents:", error);
    }
  };

  const fetchCompletedReports = async () => {
    try {
      const completed = await getCompletedReports();
      setCompletedReports((prevReports) =>
        currentPage === 1 ? completed : [...prevReports, ...completed],
      );
    } catch (error) {
      console.error("Error fetching completed reports:", error);
    }
  };

  const handleWarn = (content: ReportedContent) => {
    setSelectedContent(content);
    setShowWarnModal(true);
  };

  const handleWarnSubmit = async () => {
    if (!selectedContent) return;

    try {
      await warnUser(
        selectedContent.authorId,
        selectedContent.id,
        selectedContent.type,
        selectedReasons,
        customReason,
      );
      setShowWarnModal(false);
      setReportedContents((prevContents) =>
        prevContents.map((c) =>
          c.id === selectedContent.id ? { ...c, isWarned: true } : c,
        ),
      );
      setSelectedReasons([]);
      setCustomReason("");
    } catch (err) {
      console.error("Error warning user:", err);
      alert("경고 부여 중 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (content: ReportedContent) => {
    if (window.confirm("이 컨텐츠를 삭제하시겠습니까?")) {
      await deleteContent(content.id, content.type);
      setReportedContents((prevContents) =>
        prevContents.map((c) =>
          c.id === content.id ? { ...c, isFired: true } : c,
        ),
      );
    }
  };

  const handleComplete = async (content: ReportedContent) => {
    if (window.confirm("이 신고를 처리 완료로 표시하시겠습니까?")) {
      try {
        await completeReportHandling(content);

        // 로컬 상태 즉시 업데이트
        setReportedContents((prevContents) =>
          prevContents.filter((c) => c.id !== content.id),
        );

        // 완료된 보고서 목록 새로고침 (선택적)
        if (activeTab === "completed") {
          fetchCompletedReports();
        }
      } catch (error) {
        console.error("Error completing report:", error);
        alert("신고 처리 완료 중 오류가 발생했습니다.");
      }
    }
  };

  const handleShowReports = (reports: Report[]) => {
    setSelectedReports(reports);
    setShowReportModal(true);
  };

  const formatReportContent = (reports: Report[]) => {
    return reports
      .map(
        (report, index) => `
        신고 ${index + 1}:
        신고자: ${report.userId}
        날짜: ${formatDate(report.createdAt)}
        사유: ${report.reason.join(", ")}
        ${report.customReason ? `추가 설명: ${report.customReason}` : ""}
      `,
      )
      .join("\n\n");
  };

  const formatDate = (date: any) => {
    if (date && date.toDate) {
      return date.toDate().toLocaleString();
    }
    return new Date(date).toLocaleString();
  };

  const handleContentTypeClick = (content: ReportedContent) => {
    let path;
    if (content.type === "post") {
      path = `/community/post/${content.id}`;
    } else {
      path = `/community/post/${content.postId}#comment-${content.id}`;
    }
    router.push(path);
  };

  const handleReasonChange = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason],
    );
  };

  const handleReactivate = async (content: CompletedReport) => {
    if (window.confirm("이 신고를 다시 검토 대상으로 설정하시겠습니까?")) {
      try {
        await reactivateReport(content.id, content.type);

        // 완료된 보고서 목록에서 제거
        setCompletedReports((prev) =>
          prev.filter((report) => report.id !== content.id),
        );

        // 필요한 경우 보류 중인 보고서 목록 새로고침
        if (activeTab === "pending") {
          fetchReportedContents();
        }

        alert("신고가 다시 검토 대상으로 설정되었습니다.");
      } catch (error) {
        console.error("Error reactivating report:", error);
        alert("신고 재활성화 중 오류가 발생했습니다.");
      }
    }
  };

  const stripHtmlTags = (html: string) => {
    if (!html) return '';
    return html.replace(/<\/?[^>]+(>|$)/g, "");
  };

  return (
    <div>
      <TabContainer>
        <Tab
          active={activeTab === "pending"}
          onClick={() => {
            setActiveTab("pending");
            setCurrentPage(1);
          }}
        >
          신고된 컨텐츠
        </Tab>
        <Tab
          active={activeTab === "completed"}
          onClick={() => {
            setActiveTab("completed");
            setCurrentPage(1);
          }}
        >
          처리 완료
        </Tab>
      </TabContainer>

      {activeTab === "pending" && (
        <>
          <h2>신고된 컨텐츠</h2>
          {reportedContents.length === 0 ? (
            <p>신고된 컨텐츠가 없습니다.</p>
          ) : (
            reportedContents.map((content) => (
              <ContentItem key={content.id}>
                <ContentType onClick={() => handleContentTypeClick(content)}>
                  {content.type === "post" ? "게시글" : "댓글"}:{" "}
                  {content.title || "제목 없음"}
                </ContentType>
                <ContentText>{stripHtmlTags(content.content)}</ContentText>
                <ContentAuthor>작성자: {content.author}</ContentAuthor>
                <ReportCount>신고 수: {content.reportCount}</ReportCount>
                <ButtonContainer>
                  <ReportReasonButton
                    onClick={() => handleShowReports(content.reports)}
                  >
                    사유
                  </ReportReasonButton>
                  <WarnButton
                    onClick={() => handleWarn(content)}
                    disabled={content.isWarned || content.isFired}
                  >
                    경고
                  </WarnButton>
                  <DeleteButton
                    onClick={() => handleDelete(content)}
                    disabled={content.isFired}
                  >
                    삭제
                  </DeleteButton>
                  <CompleteButton onClick={() => handleComplete(content)}>
                    보관
                  </CompleteButton>
                </ButtonContainer>
              </ContentItem>
            ))
          )}
        </>
      )}

      {activeTab === "completed" && (
        <>
          <h2>처리 완료된 신고</h2>
          {completedReports.length === 0 ? (
            <p>처리 완료된 신고가 없습니다.</p>
          ) : (
            completedReports.map((report) => (
              <CompletedItem key={report.id}>
                <ContentType onClick={() => handleContentTypeClick(report)}>
                  {report.type === "post" ? "게시글" : "댓글"}
                </ContentType>
                <ContentText>{stripHtmlTags(report.content)}</ContentText>
                <ContentAuthor>작성자: {report.author}</ContentAuthor>
                <CompletedDate>
                  처리 일시: {formatDate(report.completedAt)}
                </CompletedDate>
                <ReactivateButton onClick={() => handleReactivate(report)}>
                  재검토
                </ReactivateButton>
              </CompletedItem>
            ))
          )}
          {completedReports.length >= 20 * currentPage && (
            <LoadMoreButton onClick={() => setCurrentPage((prev) => prev + 1)}>
              더 보기
            </LoadMoreButton>
          )}
        </>
      )}

      <DefaultModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="신고 내역"
        message={formatReportContent(selectedReports)}
      />

      <WarnModal
        isOpen={showWarnModal}
        onClose={() => setShowWarnModal(false)}
        onSubmitSuccess={handleWarnSubmit}
        title="경고 부여"
        warnReasons={reportReasons}
        selectedReasons={selectedReasons}
        onReasonChange={handleReasonChange}
        customReason={customReason}
        onCustomReasonChange={(value) => setCustomReason(value)}
        contentType={selectedContent?.type || "post"}
        contentId={selectedContent?.id || ""}
        authorId={selectedContent?.authorId || ""}
      />
    </div>
  );
};

const ContentItem = styled.div`
  border: 1px solid #ddd;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 4px;
`;

const ReactivateButton = styled.button`
  background-color: #ffa500;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 0.5rem;

  &:hover {
    background-color: #ff8c00;
  }
`;

const ContentType = styled.div`
  font-weight: bold;
  margin-bottom: 0.5rem;
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
`;

const ContentText = styled.div`
  margin-bottom: 0.5rem;
`;

const ContentAuthor = styled.div`
  font-style: italic;
  margin-bottom: 0.5rem;
`;

const ReportCount = styled.div`
  color: red;
  margin-bottom: 0.5rem;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 1rem;
`;

const WarnButton = styled.button`
  background-color: #ffc107;
  color: black;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
`;

const DeleteButton = styled.button`
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  cursor: ${(props) => (props.disabled ? "not-allowed" : "pointer")};
`;

const ReportReasonButton = styled.button`
  background-color: #4a90e2;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background-color: #357ae8;
  }
`;

const TabContainer = styled.div`
  display: flex;
  margin-bottom: 1rem;
`;

const Tab = styled.button<{ active: boolean }>`
  padding: 0.5rem 1rem;
  background-color: ${(props) => (props.active ? "#4a90e2" : "#f0f0f0")};
  color: ${(props) => (props.active ? "white" : "black")};
  border: none;
  cursor: pointer;
  margin-right: 0.5rem;
`;

const CompleteButton = styled.button`
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  &:hover {
    background-color: #45a049;
  }
`;

const CompletedItem = styled(ContentItem)`
  background-color: #f9f9f9;
`;

const CompletedDate = styled.div`
  font-size: 0.8rem;
  color: #666;
`;

const LoadMoreButton = styled.button`
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: #f0f0f0;
  border: none;
  cursor: pointer;
  &:hover {
    background-color: #e0e0e0;
  }
`;

export default ReportManagement;
