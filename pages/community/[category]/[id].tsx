import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useRecoilValue, useRecoilState } from "recoil";
import {
  userState,
  commentsState,
  selectedCategoryState,
  categoriesState,
} from "../../../store/atoms";
import { Category, Report } from "../../../types";
import styled from "@emotion/styled";
import Layout from "../../../components/Layout";
import CategoryList from "../../../components/CategoryList";
import CommentSection from "../../../components/CommentSection";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { FaUserCircle } from "react-icons/fa";
import { updatePost } from "../../../services/postService";
import { Post } from "../../../types";
import { FaTrash, FaUpload, FaBars } from "react-icons/fa";
import { uploadImage, deleteImage } from "../../../services/imageService";
import { getCommentsForPost } from "../../../services/commentService";
import {
  scrapPost,
  unscrapPost,
  isPostScrapped,
  deletePost,
} from "../../../services/postService";
import { ImageGallery, Modal } from "../../../components/ImageGallery";
import DefaultModal from "../../../components/modal/DefaultModal";
import ReportModal from "../../../components/modal/ReportModal";
import { compressImage } from "../../../utils/imageUtils";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import DOMPurify from "dompurify";
import { GetServerSideProps } from "next";
import Head from "next/head";
import CategoryPanel from "../../../components/CategoryPanel";
import ReactPlayer from "react-player";

interface PostPageProps {
  initialPost: Post;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string };
  const postDoc = await getDoc(doc(db, "posts", id));

  if (!postDoc.exists()) {
    return { notFound: true };
  }

  const postData = postDoc.data() as Post;
  const initialPost: Post = {
    id: postDoc.id,
    ...postData,
    createdAt: postData.createdAt.toDate().toISOString(),
    updatedAt: postData.updatedAt.toDate().toISOString(),
  };

  return { props: { initialPost } };
};

const PostPage: React.FC<PostPageProps> = ({ initialPost }) => {
  const router = useRouter();
  const { id } = router.query;
  const [post, setPost] = useState<Post>(initialPost);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useRecoilState(commentsState);
  const user = useRecoilValue(userState);
  const [liked, setLiked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [commentCount, setCommentCount] = useState(0);
  const [selectedVoteOption, setSelectedVoteOption] = useState<number | null>(
    null,
  );
  const [editedImages, setEditedImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isScrapped, setIsScrapped] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentVoteImage, setCurrentVoteImage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "" });
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const categories = useRecoilValue(categoriesState);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<"post" | "comment" | null>(null);
  const [reportedItemId, setReportedItemId] = useState<string | null>(null);
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState("");
  const [editedContent, setEditedContent] = useState("");

  const [newImages, setNewImages] = useState<File[]>([]);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pageRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useRecoilState(
    selectedCategoryState,
  );

  const ProfileImage = ({ src, alt }) => {
    return src ? (
      <ProfileImageStyled src={src} alt={alt} />
    ) : (
      <DefaultProfileIcon />
    );
  };

  const getCategoryName = (categoryId: string) => {
    for (let cat of categories) {
      if (cat.subcategories) {
        for (let subcat of cat.subcategories) {
          if (subcat.id === categoryId) {
            if (cat.id === "school") {
              return `${user?.schoolName} > ${subcat.name}`;
            } else if (cat.id === "regional") {
              return `${user?.address1} ${user?.address2} > ${subcat.name}`;
            } else {
              return `${cat.name} > ${subcat.name}`;
            }
          }
          if (subcat.subcategories) {
            for (let minorGallery of subcat.subcategories) {
              if (minorGallery.id === categoryId) {
                return `${cat.name} > ${minorGallery.name} 게시판`;
              }
            }
          }
        }
      }
    }
    return "";
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (pageRef.current && !pageRef.current.contains(event.target as Node)) {
      setIsMobileMenuOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const createLinkifiedContent = (htmlContent: string) => {
    // URL 패턴 정규식
    const urlPattern =
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;

    // URL을 <a> 태그로 변환
    return htmlContent.replace(urlPattern, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  };

  const renderContent = (content: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g; // URL 패턴 (유튜브, MP4 등 모든 URL)
    const links = content.match(urlPattern);

    return (
      <>
        {links?.map((url, index) => (
          <div key={index}>
            {ReactPlayer.canPlay(url) ? (
              <ReactPlayer url={url} controls width="100%" />
            ) : null}
          </div>
        ))}
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeHTML(createLinkifiedContent(content)),
          }}
        />
      </>
    );
  };

  const sanitizeHTML = (html: string) => {
    return DOMPurify.sanitize(html);
  };

  useEffect(() => {
    const fetchPost = async () => {
      if (id) {
        const docRef = doc(db, "posts", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const postData = docSnap.data();
          const authorRef = doc(db, "users", postData.authorId);
          const authorSnap = await getDoc(authorRef);
          const authorData = authorSnap.data();

          const formattedPost: Post = {
            id: docSnap.id,
            ...postData,
            authorProfileImage: authorData?.profileImageUrl || null,
            createdAt: postData.createdAt
              ? new Date(postData.createdAt.seconds * 1000)
              : new Date(),
            updatedAt: postData.updatedAt
              ? new Date(postData.updatedAt.seconds * 1000)
              : new Date(),
          } as Post;
          setPost(formattedPost);
          setEditedTitle(formattedPost.title);
          setEditedContent(formattedPost.content);
          setCommentCount(formattedPost.comments || 0);
          setEditedImages([]);
          setPreviewImages(formattedPost.imageUrls || []);
          setExistingImages(formattedPost.imageUrls || []);
        } else {
          setPost(null);
        }
        setLoading(false);
      }
    };

    const fetchComments = async () => {
      if (id) {
        const commentsData = await getCommentsForPost(id as string);
        const commentsWithProfileImages = await Promise.all(
          commentsData.map(async (comment) => {
            const authorRef = doc(db, "users", comment.authorId);
            const authorSnap = await getDoc(authorRef);
            const authorData = authorSnap.data();
            return {
              ...comment,
              authorProfileImage: authorData?.profileImageUrl || null,
            };
          }),
        );
        setComments(commentsWithProfileImages);
        setCommentCount(commentsWithProfileImages.length);
      }
    };

    const checkIfLiked = async () => {
      if (id && user) {
        const docRef = doc(db, "posts", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().likedBy.includes(user.uid)) {
          setLiked(true);
        }
      }
    };

    const checkIfScrapped = async () => {
      if (user && post) {
        const scrapped = await isPostScrapped(user.uid, post.id);
        setIsScrapped(scrapped);
      }
    };

    fetchPost();
    fetchComments();
    checkIfLiked();
    checkIfScrapped();
  }, [initialPost.id, setComments, user]);

  useEffect(() => {
    const incrementViewCount = async () => {
      if (!id) return;

      const viewKey = `post_${id}_viewedAt`;
      const lastViewedAt = localStorage.getItem(viewKey);
      const now = new Date().getTime();

      if (lastViewedAt && now - parseInt(lastViewedAt) < 60000) {
        // 1분 이내에 동일한 사용자가 조회한 경우, 조회수를 증가시키지 않음
        return;
      }

      localStorage.setItem(viewKey, now.toString());

      const docRef = doc(db, "posts", id as string);
      await updateDoc(docRef, {
        views: increment(1),
      });
    };

    if (id) {
      incrementViewCount();
    }
  }, [initialPost.id]);

  const reportReasons = [
    "부적절한 내용",
    "혐오 발언",
    "폭력적 내용",
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
          lastReportedAt: Timestamp.now(),
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

  const handleCommentUpdate = (newCommentCount: number) => {
    setCommentCount(newCommentCount);
    setPost((prevPost: Post) => ({
      ...prevPost,
      comments: newCommentCount,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setIsUploading(true);
      setUploadProgress(0);

      const compressedImages = await Promise.all(
        filesArray.map(async (file) => {
          // 이미지 압축 로직 (필요한 경우)
          return file;
        }),
      );

      setNewImages((prevImages) => [...prevImages, ...compressedImages]);
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  const handleImageRemove = (index: number, isExisting: boolean) => {
    if (isExisting) {
      const imageUrl = existingImages[index];
      setExistingImages((prev) => prev.filter((_, i) => i !== index));
      setRemovedImages((prev) => [...prev, imageUrl]);
    } else {
      setNewImages((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveEdit = async () => {
    if (!post || !user) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // 새 이미지 업로드
      const uploadedImageUrls = await Promise.all(
        newImages.map(async (image, index) => {
          const url = await uploadImage(image, user.uid, "post", post.id);
          setUploadProgress(((index + 1) / newImages.length) * 100);
          return url;
        }),
      );

      // 삭제된 이미지 처리
      await Promise.all(removedImages.map((url) => deleteImage(url)));

      // 최종 이미지 URL 배열
      const updatedImageUrls = [...existingImages, ...uploadedImageUrls];

      const updatedPost = {
        title: editedTitle,
        content: editedContent,
        categoryId: post.categoryId,
        imageUrls: updatedImageUrls,
        updatedAt: new Date(),
      };

      await updatePost(post.id, updatedPost);

      setPost({
        ...post,
        ...updatedPost,
      });
      setIsEditing(false);
      setModalContent({
        title: "수정 완료",
        message: "게시글 수정이 완료되었습니다.",
      });
      setShowModal(true);

      // 상태 초기화
      setNewImages([]);
      setRemovedImages([]);
      setExistingImages(updatedImageUrls);
    } catch (error) {
      console.error("Error updating post:", error);
      alert("게시글 수정 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleScrap = async () => {
    if (!user || !post) return;

    try {
      if (isScrapped) {
        await unscrapPost(user.uid, post.id);
        setIsScrapped(false);
      } else {
        await scrapPost(user.uid, post.id);
        setIsScrapped(true);
      }
      // Update post state with new scrap count
      setPost((prevPost) => ({
        ...prevPost,
        scraps: isScrapped
          ? (prevPost.scraps || 1) - 1
          : (prevPost.scraps || 0) + 1,
      }));
    } catch (error) {
      console.error("Error updating scrap:", error);
    }
  };

  const openVoteImageModal = (imageUrl: string) => {
    setCurrentVoteImage(imageUrl);
    setModalOpen(true);
  };

  const handleVote = async (optionIndex: number) => {
    if (!user || post.voterIds?.includes(user.uid)) return;

    try {
      const postRef = doc(db, "posts", id as string);
      await updateDoc(postRef, {
        [`voteResults.${optionIndex}`]: increment(1),
        [`voterChoices.${user.uid}`]: optionIndex,
        voterIds: arrayUnion(user.uid),
      });

      // Update local post state
      setPost((prevPost: any) => ({
        ...prevPost,
        voteResults: {
          ...prevPost.voteResults,
          [optionIndex]: (prevPost.voteResults?.[optionIndex] || 0) + 1,
        },
        voterChoices: {
          ...prevPost.voterChoices,
          [user.uid]: optionIndex,
        },
        voterIds: [...(prevPost.voterIds || []), user.uid],
      }));
    } catch (error) {
      console.error("Error voting:", error);
    }
  };

  const getTotalVotes = () => {
    return Object.values(post.voteResults || {}).reduce(
      (sum, count) => sum + count,
      0,
    );
  };

  const getVotePercentage = (optionIndex: number) => {
    const totalVotes = getTotalVotes();
    if (totalVotes === 0) return 0;
    return ((post.voteResults?.[optionIndex] || 0) / totalVotes) * 100;
  };

  const hasUserVoted = user && post.voterIds?.includes(user.uid);
  const userChoice = user ? post.voterChoices?.[user.uid] : null;

  if (loading) {
    return (
      <Layout>
        <Container>
          <CategorySection>
            <CategoryList />
          </CategorySection>

          {/* <LoadingMessage>로딩 중...</LoadingMessage> */}
        </Container>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <ErrorMessage>게시글을 찾을 수 없습니다.</ErrorMessage>
      </Layout>
    );
  }

  const handleDelete = async () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;

    try {
      if (!user || !post) return;
      await deletePost(post.id, user.uid);
      router.push(`/community/${selectedCategory}`);
    } catch (e) {
      console.error("Error deleting post: ", e);
      alert("게시글 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedTitle(post?.title || "");
    setEditedContent(post?.content || "");
    setEditedImages([]);
    setPreviewImages(post?.imageUrls || []);
    setExistingImages(post?.imageUrls || []);
  };

  const handleBackToList = () => {
    router.back();
  };

  const handleLike = async () => {
    if (!user || !user.uid || user.uid === post.authorId) return;

    const docRef = doc(db, "posts", id as string);
    try {
      if (liked) {
        await updateDoc(docRef, {
          likes: increment(-1),
          likedBy: arrayRemove(user.uid),
        });
        setLiked(false);
      } else {
        await updateDoc(docRef, {
          likes: increment(1),
          likedBy: arrayUnion(user.uid),
        });
        setLiked(true);
      }

      const updatedPost = { ...post };
      if (liked) {
        updatedPost.likes -= 1;
        updatedPost.likedBy = updatedPost.likedBy.filter(
          (uid: string) => uid !== user.uid,
        );
      } else {
        updatedPost.likes += 1;
        updatedPost.likedBy.push(user.uid);
      }
      setPost(updatedPost);
    } catch (error) {
      console.error("Error updating likes: ", error);
    }
  };

  const formatDate = (date: any) => {
    let postDate;
    if (date instanceof Date) {
      postDate = date;
    } else if (date?.toDate) {
      postDate = date.toDate();
    } else if (date?.seconds) {
      postDate = new Date(date.seconds * 1000);
    } else {
      postDate = new Date(date);
    }
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).format(postDate);
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.inschoolz.com/community/${post.categoryId}/${post.id}`,
    },
    headline: post.title,
    description: post.content.substring(0, 200),
    image: post.imageUrls,
    author: {
      "@type": "Person",
      name: post.author,
    },
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    publisher: {
      "@type": "Organization",
      name: "인스쿨즈",
      logo: {
        "@type": "ImageObject",
        url: "https://www.inschoolz.com/logo.png",
      },
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/WatchAction",
        userInteractionCount: post.views || 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.likes || 0,
      },
    ],
  };

  return (
    <Layout>
      <Head>
        <title>{post.title} | 인스쿨즈</title>
        <meta name="description" content={post.content.substring(0, 100)} />
        <meta property="og:title" content={post.title} />
        <meta
          property="og:description"
          content={post.content.substring(0, 100)}
        />
        <meta property="og:image" content={post.imageUrls?.[0] || ""} />
        <meta
          property="og:url"
          content={`https://www.inschoolz.com/community/${post.categoryId}/${post.id}`}
        />
        <meta property="og:type" content="article" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Head>
      <Container>
        <MobileHeader>
          <HamburgerIcon onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <FaBars />
          </HamburgerIcon>
          <MobileTitle>{getCategoryName(post.categoryId)}</MobileTitle>
        </MobileHeader>
        <ContentWrapper>
          <CategoryPanel isOpen={isMobileMenuOpen} />

          <MainContent isMobileMenuOpen={isMobileMenuOpen}>
            <PostContainer>
              <PostHeader>
                <ProfileImage src={post.authorProfileImage} alt={post.author} />
                <PostInfo>
                  <PostAuthor>{post.author}</PostAuthor>
                  <UploadTime>{formatDate(post.createdAt)}</UploadTime>
                </PostInfo>
              </PostHeader>
              {isEditing ? (
                <EditForm>
                  <Label htmlFor="title">제목</Label>
                  <Input
                    type="text"
                    id="title"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    required
                  />
                  <Label htmlFor="category">카테고리</Label>
                  <Select
                    id="category"
                    value={post.categoryId}
                    onChange={(e) =>
                      setPost({ ...post, categoryId: e.target.value })
                    }
                    required
                  >
                    {categories.map((cat: Category) => (
                      <optgroup key={cat.id} label={cat.name}>
                        {cat.subcategories?.map((subcat: Category) => (
                          <option key={subcat.id} value={subcat.id}>
                            {subcat.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  <Label htmlFor="content">내용</Label>
                  <ReactQuill
                    value={editedContent}
                    onChange={setEditedContent}
                    modules={{
                      toolbar: [
                        [{ header: [1, 2, 3, false] }],
                        [
                          "bold",
                          "italic",
                          "underline",
                          "strike",
                          "link",
                          "clean",
                        ],
                      ],
                    }}
                  />
                  <Label htmlFor="image">이미지 업로드 (최대 10개)</Label>
                  <ImageUploadButton
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FaUpload /> 이미지 선택
                  </ImageUploadButton>
                  <HiddenInput
                    ref={fileInputRef}
                    type="file"
                    id="image"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                  />
                  {isUploading && <ProgressBar progress={uploadProgress} />}
                  <ImagePreviewContainer>
                    {existingImages.map((image, index) => (
                      <ImagePreviewWrapper key={`existing-${index}`}>
                        <ImagePreview
                          src={image}
                          alt={`Image preview ${index + 1}`}
                        />
                        <RemoveButton
                          type="button"
                          onClick={() => handleImageRemove(index, true)}
                          disabled={isUploading}
                        >
                          <FaTrash />
                        </RemoveButton>
                      </ImagePreviewWrapper>
                    ))}
                    {newImages.map((image, index) => (
                      <ImagePreviewWrapper key={`new-${index}`}>
                        <ImagePreview
                          src={URL.createObjectURL(image)}
                          alt={`New image preview ${index + 1}`}
                        />
                        <RemoveButton
                          type="button"
                          onClick={() => handleImageRemove(index, false)}
                          disabled={isUploading}
                        >
                          <FaTrash />
                        </RemoveButton>
                      </ImagePreviewWrapper>
                    ))}
                  </ImagePreviewContainer>
                  <ButtonContainer>
                    <SaveButton onClick={handleSaveEdit} disabled={isUploading}>
                      {isUploading ? "업로드 중..." : "저장"}
                    </SaveButton>
                    <CancelButton onClick={() => setIsEditing(false)}>
                      취소
                    </CancelButton>
                  </ButtonContainer>
                </EditForm>
              ) : (
                <>
                  <PostTitle>{post.title}</PostTitle>
                  <PostContent>{renderContent(post.content)}</PostContent>
                  {post.imageUrls && post.imageUrls.length > 0 && (
                    <ImageGallery images={post.imageUrls} />
                  )}
                  {post.isVotePost && post.voteOptions && (
                    <VoteSection>
                      <h3>투표</h3>
                      {post.voteOptions.map((option, index) => (
                        <VoteOption
                          key={index}
                          onClick={() => handleVote(index)}
                          disabled={hasUserVoted}
                          percentage={getVotePercentage(index)}
                          isSelected={userChoice === index}
                          hasVoted={hasUserVoted}
                        >
                          {option.imageUrl && (
                            <VoteOptionImage
                              src={option.imageUrl}
                              alt={`Vote option ${index + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openVoteImageModal(option.imageUrl);
                              }}
                            />
                          )}
                          <VoteOptionText>{option.text}</VoteOptionText>
                          {hasUserVoted && (
                            <VoteResult>
                              {post.voteResults?.[index] || 0}표 (
                              {getVotePercentage(index).toFixed(1)}%)
                            </VoteResult>
                          )}
                        </VoteOption>
                      ))}
                    </VoteSection>
                  )}
                  <ActionsAndButtonsContainer>
                    <PostActions>
                      <ActionItem onClick={handleLike}>
                        {liked ? "❤️ " : "🤍 "} {post.likes}
                      </ActionItem>
                      <ActionItem>💬 {post.comments}</ActionItem>
                      <ActionItem>👁️ {post.views}</ActionItem>
                      <ActionItem
                        onClick={handleScrap}
                        style={{ color: isScrapped ? "green" : "inherit" }}
                      >
                        {isScrapped ? "★ " : "☆ "} {post.scraps || 0}
                      </ActionItem>
                    </PostActions>
                    <ButtonContainer>
                      <TextButton onClick={handleBackToList}>목록</TextButton>
                      {user?.uid === post.authorId && (
                        <>
                          <EditButton onClick={handleEdit}>수정</EditButton>
                          <DeleteButton onClick={handleDelete}>
                            삭제
                          </DeleteButton>
                        </>
                      )}
                      <ReportButton
                        onClick={() => handleReportClick("post", post.id)}
                      >
                        신고
                      </ReportButton>
                    </ButtonContainer>
                  </ActionsAndButtonsContainer>
                </>
              )}
            </PostContainer>
            <CommentSection
              postId={id as string}
              comments={comments}
              setComments={setComments}
              onCommentUpdate={handleCommentUpdate}
            />
          </MainContent>
        </ContentWrapper>
      </Container>
      <DefaultModal
        title={modalContent.title}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        message={modalContent.message}
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
    </Layout>
  );
};

const Container = styled.div`
  position: relative;
  overflow-x: hidden;
`;

const ContentWrapper = styled.div`
  display: flex;
`;

const MainContent = styled.div<{ isMobileMenuOpen: boolean }>`
  flex: 1;
  padding: 1rem;
  min-width: 0;
  transition: transform 0.3s ease-in-out;

  @media (max-width: 768px) {
    padding: 0rem;
    transform: ${({ isMobileMenuOpen }) =>
      isMobileMenuOpen ? "translateX(320px)" : "translateX(0)"};
  }
`;

const MobileHeader = styled.div`
  display: none;
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    padding: 0 1rem;
    background-color: white;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    z-index: 1001;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
`;

const HamburgerIcon = styled.div`
  font-size: 1.5rem;
  cursor: pointer;
  margin-right: 1rem;
`;

const MobileTitle = styled.h2`
  margin: 0;
  font-size: 1.1rem;
`;

const CategorySection = styled.div`
  width: 250px;
  padding: 1rem;
  border-right: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  overflow-y: auto;

  @media (max-width: 768px) {
    display: none;
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  font-size: 1.2rem;
  color: #666;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ErrorMessage = styled.div`
  text-align: center;
  font-size: 1.2rem;
  color: #ff6b6b;
`;

const PostContainer = styled.div`
  padding: 1rem;
  border-radius: 4px;
  background-color: #fff;
  max-width: 100%;
  box-sizing: border-box;
  margin-bottom: 0.5rem;

  @media (max-width: 768px) {
    padding: 0rem;
  }
`;

const PostHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
`;

const ProfileImageStyled = styled.img`
  width: 40px;
  height: 40px;
  margin-right: 0.5rem;
  border-radius: 50%;
  object-fit: cover;
`;

const DefaultProfileIcon = styled(FaUserCircle)`
  width: 40px;
  height: 40px;
  margin-right: 0.5rem;
  color: #ccc;
`;

const PostInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const PostAuthor = styled.div`
  font-size: 1rem;
  font-weight: bold;
  color: #495057;
`;

const UploadTime = styled.div`
  font-size: 0.9rem;
  color: #6c757d;
`;

const PostTitle = styled.h1`
  margin: 0 0 2rem 0;
  font-size: 1.6rem;
`;

const PostContent = styled.div`
  margin-bottom: 2rem;
  line-height: 1.6;

  img {
    max-width: 100%;
    height: auto;
  }
`;

const PostActions = styled.div`
  display: flex;
  gap: 1rem;
  font-size: 1rem;

  @media (max-width: 768px) {
    display: flex;
    gap: 0.8rem;
    font-size: 0.8rem;
  }
`;

const EditForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Label = styled.label`
  font-size: 1rem;
  margin-bottom: 0.5rem;
`;

const Input = styled.input`
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
`;

const Select = styled.select`
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
`;

const ImageUploadButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  color: #333;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;

  &:hover {
    background-color: #e0e0e0;
  }

  svg {
    margin-right: 0.5rem;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const ImagePreviewContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 1rem;
`;

const ImagePreviewWrapper = styled.div`
  position: relative;
`;

const ImagePreview = styled.img`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
`;

const RemoveButton = styled.button`
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 5px;
  background-color: rgba(255, 255, 255, 0.7);
  color: #ff4d4d;
  border: none;
  border-radius: 50%;
  cursor: pointer;

  &:hover {
    background-color: rgba(255, 255, 255, 0.9);
  }

  svg {
    font-size: 0.8rem;
  }
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 0.5rem;

  @media (max-width: 768px) {
    gap: 0.3rem;
  }
`;

const ActionItem = styled.span`
  cursor: pointer;
  &:disabled {
    cursor: not-allowed;
    color: #ccc;
  }
`;

const TextButton = styled.button`
  padding: 0.2rem;
  background: none;
  color: #000;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;

  &:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
  }
`;

const EditButton = styled.button`
  padding: 0.2rem;
  background: none;
  color: var(--edit-text);
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;

  &:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
  }
`;

const DeleteButton = styled.button`
  padding: 0.2rem;
  background: none;
  color: var(--delete-text);
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;

  &:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    font-size: 0.8rem;
  }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
`;

const SaveButton = styled(Button)`
  background-color: var(--primary-button);
  color: white;

  &:hover {
    background-color: var(--primary-hover);
  }
`;

const CancelButton = styled(Button)`
  background-color: var(--delete-button);
  color: white;

  &:hover {
    background-color: var(--delete-hover);
  }
`;

const ActionsAndButtonsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;

  /* @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem; */
  }
`;

const VoteSection = styled.div`
  margin: 1rem 0;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;

  @media (max-width: 768px) {
    padding: 0.2rem;
  }
`;

const VoteOptionImage = styled.img`
  width: 180px;
  height: 180px;
  object-fit: cover;
  margin-right: 10px;

  @media (max-width: 768px) {
    width: 120px;
    height: 120px;
    margin-right: 5px;
  }
`;

const VoteOptionText = styled.span`
  flex-grow: 1;
  text-align: center;
`;

const VoteOption = styled.div<{
  percentage: number;
  isSelected: boolean;
  hasVoted: boolean;
  disabled: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 95%;
  padding: 0.5rem;
  margin: 0.5rem 0;
  background-color: white;
  border: 1px solid ${(props) => (props.isSelected ? "#4a90e2" : "#ced4da")};
  border-radius: 4px;
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};
  transition:
    background-color 0.2s,
    border-color 0.2s;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${(props) => (props.hasVoted ? `${props.percentage}%` : "0")};
    background-color: ${(props) =>
      props.isSelected
        ? "rgba(173, 216, 230, 0.5)"
        : "rgba(211, 211, 211, 0.5)"};
    z-index: 0;
    transition: width 0.5s ease-in-out;
  }

  &:hover {
    background-color: ${(props) => (props.disabled ? "inherit" : "#f1f3f5")};
  }

  ${(props) =>
    props.hasVoted &&
    `
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: ${props.isSelected ? "rgba(173, 216, 230, 0.2)" : "rgba(211, 211, 211, 0.2)"};
      z-index: 1;
    }
  `}
`;

const VoteResult = styled.span`
  font-size: 0.8rem;
  color: #6c757d;
  margin-left: 10px;
`;

const ReportButton = styled(TextButton)`
  color: #ff4d4d;
  &:hover {
    color: #ff0000;
  }
`;

const ProgressBar = styled.div<{ progress: number }>`
  width: 100%;
  height: 5px;
  background-color: #e0e0e0;
  margin-top: 10px;

  &::after {
    content: "";
    display: block;
    width: ${(props) => props.progress}%;
    height: 100%;
    background-color: var(--primary-button);
    transition: width 0.3s ease;
  }
`;

export default PostPage;
