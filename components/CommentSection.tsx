import React, { useState, useRef, useEffect } from "react";
import styled from "@emotion/styled";
import {
  FaUserCircle,
  FaPaperPlane,
  FaTrash,
  FaPen,
  FaComment,
  FaFlag,
  FaThumbsUp,
} from "react-icons/fa";
import { useRecoilValue } from "recoil";
import { userState } from "../store/atoms";
import { useSetRecoilState } from "recoil";
import { userExperienceState, userLevelState } from "../store/atoms";
import {
  addDoc,
  collection,
  updateDoc,
  arrayUnion,
  arrayRemove,
  doc,
  increment,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { formatDate } from "../utils/dateUtils";
import {
  createComment,
  fetchComments,
  deleteComment,
} from "../services/commentService";
import {
  updateUserExperience,
  getExperienceSettings,
} from "../utils/experience";
import ExperienceModal from "../components/modal/ExperienceModal";
import ReportModal from "./modal/ReportModal";
import { Comment, CommentSectionProps, Report } from "../types";

const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  comments,
  setComments,
  onCommentUpdate,
}) => {
  const user = useRecoilValue(userState);
  const [newComment, setNewComment] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<string>("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showExpModal, setShowExpModal] = useState(false);
  const [expGained, setExpGained] = useState(0);
  const [newLevel, setNewLevel] = useState<number | undefined>(undefined);
  const setUserExperience = useSetRecoilState(userExperienceState);
  const setUserLevel = useSetRecoilState(userLevelState);
  const [lastLevelUp, setLastLevelUp] = useState<number | null>(null);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<"post" | "comment" | null>(null);
  const [reportedItemId, setReportedItemId] = useState<string | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState("");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px"; // 초기 높이로 리셋
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReplyingTo(null);
        setEditingCommentId(null);
      }
    };

    document.addEventListener("keydown", handleEscKey);

    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [newComment]);

  const linkify = (text: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;

    const parts = text.split(urlPattern);

    return parts.map((part, index) =>
      urlPattern.test(part) ? (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      ) : (
        part
      ),
    );
  };

  const reportReasons = [
    "부적절한 내용",
    "혐오 발언",
    "폭력적인 내용",
    "개인정보 노출",
    "저작권 침해",
    "도배성 문구",
  ];

  const handleReportClick = (type: "post" | "comment", id: string) => {
    setReportType(type);
    setReportedItemId(id);
    setShowReportModal(true);
  };

  const handleReasonChange = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason],
    );
  };

  const handleReportSubmit = async () => {
    if (!user || !reportType || !reportedItemId) return;

    const report: Report = {
      userId: user.userId,
      reason: selectedReasons,
      customReason: customReason.trim() || "",
      createdAt: new Date(),
    };

    try {
      if (reportType === "post") {
        await updateDoc(doc(db, "posts", reportedItemId), {
          reportCount: increment(1),
          reports: arrayUnion(report),
        });
      } else {
        await updateDoc(doc(db, "comments", reportedItemId), {
          reportCount: increment(1),
          reports: arrayUnion(report),
        });
      }

      alert("신고가 접수되었습니다.");
      setShowReportModal(false);
      setSelectedReasons([]);
      setCustomReason("");
    } catch (error) {
      console.error("Error submitting report:", error);
      alert("신고 접수 중 오류가 발생했습니다.");
    }
  };

  const handleExpModalClose = () => {
    setShowExpModal(false);
    setNewLevel(undefined);
  };

  const toggleReply = (commentId: string) => {
    setReplyingTo((prevState) => (prevState === commentId ? null : commentId));
    setReplyContent("");
  };

  const getPostId = (): string => {
    if (!postId) return '';
    return Array.isArray(postId) ? postId[0] : String(postId);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    const commentData = {
      postId: getPostId(),
      author: user.userId || "익명",
      authorId: user.uid,
      content: newComment,
      createdAt: new Date(),
      parentId: null,
      likes: 0,
      likedBy: [],
      isDeleted: false,
      reportCount: 0,
      reports: [],
    };

    try {
      const newCommentWithId = await createComment(commentData);

      // 1. 클라이언트에서 즉시 새로운 댓글 추가
      setComments((prevComments) => [...prevComments, newCommentWithId]);
      setNewComment("");
      onCommentUpdate(comments.length + 1);

      // 2. 경험치 업데이트
      const settings = await getExperienceSettings();
      const result = await updateUserExperience(
        user.uid,
        settings.commentCreation,
        "댓글을 작성했습니다",
      );

      setUserExperience(result.newExperience);
      setUserLevel(result.newLevel);
      setExpGained(result.expGained);

      if (result.levelUp && result.newLevel !== lastLevelUp) {
        setLastLevelUp(result.newLevel);
        setNewLevel(result.newLevel);
      } else {
        setNewLevel(undefined);
      }

      // 일일 제한에 도달하지 않았을 때만 경험치 모달을 표시
      if (!result.reachedDailyLimit) {
        setShowExpModal(true);
      }

      // 3. 서버에서 정렬된 전체 댓글 목록 다시 가져오기
      const updatedComments = await fetchComments(getPostId());
      setComments(updatedComments); // 상태 업데이트
    } catch (e) {
      console.error("Error adding comment: ", e);
    }
  };

  const handleReplySubmit = async (parentId: string) => {
    if (!user || !replyContent.trim()) return;

    const replyData = {
      postId: getPostId(),
      author: user.userId || "익명",
      authorId: user.uid,
      content: replyContent,
      createdAt: new Date(),
      parentId,
      likes: 0,
      likedBy: [],
      isDeleted: false,
      reportCount: 0,
      reports: [],
    };

    try {
      const docRef = await addDoc(collection(db, "comments"), replyData);
      const newComments = [...comments, { ...replyData, id: docRef.id }];
      setComments(newComments);
      setReplyContent("");
      setReplyingTo(null);
      onCommentUpdate(newComments.length);

      const postRef = doc(db, "posts", getPostId());
      await updateDoc(postRef, {
        comments: newComments.length,
      });

      const settings = await getExperienceSettings();
      const result = await updateUserExperience(
        user.uid,
        settings.commentCreation,
        "대댓글을 작성했습니다",
      );

      setUserExperience(result.newExperience);
      setUserLevel(result.newLevel);
      setExpGained(result.expGained);

      if (result.levelUp && result.newLevel !== lastLevelUp) {
        setLastLevelUp(result.newLevel);
        setNewLevel(result.newLevel);
      } else {
        setNewLevel(undefined);
      }

      // 일일 제한에 도달하지 않았을 때만 경험치 모달을 표시
      if (!result.reachedDailyLimit) {
        setShowExpModal(true);
      }

      // 3. 서버에서 정렬된 전체 댓글 목록 다시 가져오기
      const updatedComments = await fetchComments(getPostId());
      setComments(updatedComments); // 상태 업데이트
    } catch (e) {
      console.error("Error adding reply: ", e);
    }
  };

  const handleLike = async (commentId: string) => {
    if (!user) return;

    const commentRef = doc(db, "comments", commentId);
    const comment = comments.find((c) => c.id === commentId);

    if (!comment) return;

    try {
      if (comment.likedBy.includes(user.uid)) {
        await updateDoc(commentRef, {
          likes: comment.likes - 1,
          likedBy: arrayRemove(user.uid),
        });
        setComments((prevComments) =>
          prevComments.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likes: c.likes - 1,
                  likedBy: c.likedBy.filter((id) => id !== user.uid),
                }
              : c,
          ),
        );
      } else {
        await updateDoc(commentRef, {
          likes: comment.likes + 1,
          likedBy: arrayUnion(user.uid),
        });
        setComments((prevComments) =>
          prevComments.map((c) =>
            c.id === commentId
              ? { ...c, likes: c.likes + 1, likedBy: [...c.likedBy, user.uid] }
              : c,
          ),
        );
      }
    } catch (e) {
      console.error("Error updating comment likes: ", e);
    }
  };

  const handleEdit = (commentId: string, content: string) => {
    setEditingCommentId(commentId);
    setEditContent(content);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    const commentRef = doc(db, "comments", commentId);
    try {
      await updateDoc(commentRef, {
        content: editContent,
      });
      setComments((prevComments) =>
        prevComments.map((c) =>
          c.id === commentId ? { ...c, content: editContent } : c,
        ),
      );
      setEditingCommentId(null);
      setEditContent("");
    } catch (e) {
      console.error("Error updating comment: ", e);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("정말로 이 댓글을 삭제하시겠습니까?")) return;

    try {
      if (!user) return;
      await deleteComment(commentId, getPostId(), user.uid);

      const newComments = comments.filter((c) => c.id !== commentId);
      setComments(newComments);
      onCommentUpdate(newComments.length);
    } catch (e) {
      console.error("Error deleting comment: ", e);
      alert("댓글 삭제 중 오류가 발생했습니다.");
    }
  };

  const renderComments = (parentId: string | null = null, depth = 0) => {
    return comments
      .filter((comment) => comment.parentId === parentId)
      .map((comment, index) => (
        <CommentItem
          key={comment.id}
          depth={depth}
          isLast={index === comments.length - 1}
        >
          <CommentHeader>
            <ProfileWrapper>
              <ProfileIcon />
              <CommentAuthor>{comment.author}</CommentAuthor>
            </ProfileWrapper>
            <ActionsRight>
              {depth === 0 && (
                <ReplyButton onClick={() => toggleReply(comment.id)}>
                  <FaComment />
                </ReplyButton>
              )}
              {user && user.uid === comment.authorId && !comment.isDeleted && (
                <>
                  <EditButton
                    onClick={() => handleEdit(comment.id, comment.content)}
                  >
                    <FaPen />
                  </EditButton>
                  <DeleteButton onClick={() => handleDelete(comment.id)}>
                    <FaTrash />
                  </DeleteButton>
                  <ReportButton
                    onClick={() => handleReportClick("comment", comment.id)}
                  >
                    <FaFlag />
                  </ReportButton>
                </>
              )}
            </ActionsRight>
          </CommentHeader>
          {comment.isFired ? (
            <DeletedCommentContent>
              관리자에 의해 삭제된 댓글입니다
            </DeletedCommentContent>
          ) : comment.isDeleted ? (
            <DeletedCommentContent>삭제된 메시지입니다</DeletedCommentContent>
          ) : editingCommentId === comment.id ? (
            <EditForm
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEdit(comment.id);
              }}
            >
              <EditTextarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
              />
              <SaveButton type="submit">저장</SaveButton>
              <CancelButton onClick={() => setEditingCommentId(null)}>
                취소
              </CancelButton>
            </EditForm>
          ) : (
            <>
              <CommentContent>{linkify(comment.content)}</CommentContent>
              <CommentActions>
                <ActionsLeft>
                  <CommentDate>{formatDate(comment.createdAt)}</CommentDate>
                  <LikeButton onClick={() => handleLike(comment.id)}>
                    <FaThumbsUp
                      color={
                        user && comment.likedBy.includes(user.uid)
                          ? "red"
                          : "gray"
                      }
                    />
                    <LikeCount>{comment.likes}</LikeCount>
                  </LikeButton>
                </ActionsLeft>
              </CommentActions>
            </>
          )}
          {replyingTo === comment.id && (
            <ReplyForm
              onSubmit={(e) => {
                e.preventDefault();
                handleReplySubmit(comment.id);
              }}
            >
              <ReplyTextarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="답글을 입력하세요..."
              />
              <ReplySubmitButton type="submit">작성</ReplySubmitButton>
            </ReplyForm>
          )}
          {renderComments(comment.id, depth + 1)}
        </CommentItem>
      ));
  };

  return (
    <>
      <CommentSectionContainer>
        {user && (
          <CommentForm onSubmit={handleCommentSubmit}>
            <CommentInputWrapper>
              <CommentTextarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요..."
                required
              />
              <SubmitButton type="submit">
                <FaPaperPlane />
              </SubmitButton>
            </CommentInputWrapper>
          </CommentForm>
        )}
        {renderComments()}
      </CommentSectionContainer>
      <ExperienceModal
        isOpen={showExpModal}
        onClose={handleExpModalClose}
        expGained={expGained}
        newLevel={newLevel}
      />
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="신고하기"
        reportReasons={reportReasons}
        selectedReasons={selectedReasons}
        onReasonChange={handleReasonChange}
        customReason={customReason}
        onCustomReasonChange={(value) => setCustomReason(value)}
        onSubmit={handleReportSubmit}
        reportType={reportType}
        reportedItemId={reportedItemId}
        user={user}
      />
    </>
  );
};

const DeletedCommentContent = styled.p`
  color: #888;
  margin: 0.5rem 0;
`;

const CommentForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const CommentInputWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
`;

const CommentTextarea = styled.textarea`
  flex-grow: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 20px;
  resize: none;
  overflow-y: auto;
  min-height: 30px;
  max-height: 200px;
  height: 0px;
`;

const SubmitButton = styled.button`
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 30%;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: var(--primary-hover);
  }
`;

const CommentSectionContainer = styled.div`
  padding: 0.5rem;

  @media (max-width: 768px) {
    padding: 0rem;
  }
`;

const CommentItem = styled.div<{ depth: number; isLast: boolean }>`
  border-radius: ${(props) => (props.depth > 0 ? "15px" : "0")};
  margin-left: ${(props) => props.depth * 10}px;
  padding: 0.5rem;
  margin-bottom: 0.3rem;
  background-color: ${(props) => (props.depth > 0 ? "#f8f9fa" : "transparent")};
  ${(props) =>
    props.depth === 0 &&
    !props.isLast &&
    `
    border-bottom: 1px solid #e0e0e0;
  `}
`;

const ProfileWrapper = styled.div`
  display: flex;
`;

const CommentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const ProfileIcon = styled(FaUserCircle)`
  font-size: 1.5rem;
  margin-right: 0.5rem;
  color: #ccc;
`;

const CommentAuthor = styled.span`
  font-weight: bold;
  margin-right: 0.5rem;
`;

const CommentDate = styled.span`
  color: #6c757d;
  font-size: 0.8rem;
`;

const CommentContent = styled.p`
  margin: 0.5rem 0;
  white-space: pre-wrap;
  word-break: break-word;
`;

const CommentActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 0.5rem;
`;

const ActionButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: #6c757d;
  font-size: 0.9rem;
  padding: 0.3rem;
  border-left: 1px solid #eee;

  &:first-of-type {
    border-left: none;
  }

  &:hover {
    color: #0056b3;
  }
`;

const ActionsLeft = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionsRight = styled.div`
  display: flex;
  gap: 1rem;
  border: 1px solid #eee; /* 외부 테두리 */
  border-radius: 3px; /* 둥근 테두리 */
  padding: 0.4rem; /* 내부 패딩 */
`;

const LikeButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
`;

const LikeCount = styled.span`
  margin-left: 0.25rem;
`;

const ReplyForm = styled.form`
  margin-top: 1rem;
  display: flex;
  gap: 0.5rem;
`;

const ReplyTextarea = styled.textarea`
  flex: 1;
  width: 60%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 15px;
  resize: vertical;
  max-height: 100px;
`;

const ReplySubmitButton = styled.button`
  width: 60px;
  padding: 0.5rem 1rem;
  margin-top: 1.2rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
  font-weight: bold;
`;

const EditForm = styled.form`
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const EditTextarea = styled.textarea`
  width: 95%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 20px;
  resize: vertical;
  height: 50px;
`;

const ReplyButton = styled(ActionButton)`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
`;

const EditButton = styled(ActionButton)`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
  &:hover {
    color: var(--text-color);
  }
`;

const ReportButton = styled(ActionButton)`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
  &:hover {
    color: var(--text-color);
  }
`;

const DeleteButton = styled(ActionButton)`
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0;
  &:hover {
    color: #dc3545;
  }
`;

const CancelButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
`;

const SaveButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: var(--primary-hover);
  }
`;

export default CommentSection;
