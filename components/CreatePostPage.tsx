import React, { useState, useEffect, useRef } from "react";
import styled from "@emotion/styled";
import Layout from "../components/Layout";
import { useRecoilValue, useSetRecoilState, useRecoilState } from "recoil";
import { useRouter } from "next/router";
import { createPost, updatePost } from "../services/postService";
import { uploadImage } from "../services/imageService";
import {
  userState,
  userExperienceState,
  userLevelState,
  categoriesState,
  selectedCategoryState,
  selectedSchoolState,
} from "../store/atoms";
import { User } from "../types";
import { compressImage } from "../utils/imageUtils";
import { FaUpload, FaTrash, FaBars } from "react-icons/fa";
import DefaultModal from "./modal/DefaultModal";
import {
  updateUserExperience,
  getExperienceSettings,
} from "../utils/experience";
import ExperienceModal from "../components/modal/ExperienceModal";
import { FaInfoCircle } from "react-icons/fa";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
import CategoryPanel from "./CategoryPanel";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const CreatePostPage: React.FC = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const user = useRecoilValue<User | null>(userState);
  const router = useRouter();
  const { category: categoryParam } = router.query;
  const [images, setImages] = useState<File[]>([]);
  const [isVotePost, setIsVotePost] = useState(false);
  const [voteOptions, setVoteOptions] = useState<
    Array<{ text: string; image: File | null }>
  >([
    { text: "", image: null },
    { text: "", image: null },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPostId, setNewPostId] = useState<string | null>(null);
  const [showExpModal, setShowExpModal] = useState(false);
  const [expGained, setExpGained] = useState(0);
  const [newLevel, setNewLevel] = useState<number | undefined>(undefined);
  const setUserExperience = useSetRecoilState(userExperienceState);
  const setUserLevel = useSetRecoilState(userLevelState);
  const [lastLevelUp, setLastLevelUp] = useState<number | null>(null);
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const categories = useRecoilValue(categoriesState);
  const [selectedCategory] = useRecoilState(selectedCategoryState);
  const selectedSchool = useRecoilValue(selectedSchoolState);

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

  const handleContentChange = (value: string) => {
    setContent(value);
  };

  const handleNoticeOpen = () => {
    setIsNoticeOpen(true);
  };

  const handleNoticeClose = () => {
    setIsNoticeOpen(false);
  };

  const noticeContent = `
    📜 커뮤니티 이용 가이드 📜

    - 존중과 배려: 다른 사람을 존중하고 배려하는 내용만 작성해 주세요. 비방, 욕설, 차별적인 표현은 금지됩니다.
    - 관련 주제 작성: 게시글은 반드시 해당 카테고리에 맞는 주제로 작성해 주세요. 주제와 무관한 게시글은 삭제될 수 있습니다.
    - 허위 정보 금지: 허위 정보나 잘못된 정보를 유포하지 말아 주세요. 검증된 사실만을 공유해 주세요.
    - 저작권 준수: 저작권이 있는 자료를 무단으로 게시하지 말아 주세요. 창작자의 권리를 존중해 주세요.
    - 사생활 보호: 개인 정보나 사생활 침해 소지가 있는 내용을 공유하지 말아 주세요.
    - 불법 및 유해 콘텐츠 금지: 불법적이거나 유해한 콘텐츠를 게시하지 말아 주세요. 모든 사용자가 안전하게 이용할 수 있도록 해주세요.
    - 도배성 게시글 금지: 동일하거나 유사한 내용의 게시글을 반복적으로 작성하지 말아 주세요. 도배성 행위는 다른 사용자의 커뮤니티 이용에 불편을 줄 수 있으며, 경고 없이 삭제 및 제재될 수 있습니다.
  `;

  useEffect(() => {
    if (categoryParam) {
      setCategory(categoryParam as string);
    }
    if (!user) {
      router.push("/login");
    }
  }, [categoryParam, user, router]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newImages = Array.from(e.target.files);
      if (images.length + newImages.length > 10) {
        alert("최대 10개의 이미지만 첨부할 수 있습니다.");
        return;
      }
      
      // Compress each new image
      const compressedImages = await Promise.all(
        newImages.map(async (image) => {
          try {
            return await compressImage(image);
          } catch (error) {
            console.error("Error compressing image:", error);
            return image; // If compression fails, use the original image
          }
        })
      );

      setImages([...images, ...compressedImages]);
    }
  };

  const handleImageRemove = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleVoteOptionChange = (index: number, value: string) => {
    const newOptions = [...voteOptions];
    newOptions[index].text = value;
    setVoteOptions(newOptions);
  };

  const handleVoteImageChange = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const compressedFile = await compressImage(file);
      const newOptions = [...voteOptions];
      newOptions[index].image = compressedFile;
      setVoteOptions(newOptions);
    }
  };

  const handleVoteImageRemove = (index: number) => {
    const newOptions = [...voteOptions];
    newOptions[index].image = null;
    setVoteOptions(newOptions);
  };

  const handleAddVoteOption = () => {
    if (voteOptions.length < 8) {
      setVoteOptions([...voteOptions, { text: "", image: null }]);
    } else {
      alert("최대 8개의 투표 옵션만 추가할 수 있습니다.");
    }
  };

  const handleRemoveVoteOption = (index: number) => {
    if (voteOptions.length > 2) {
      setVoteOptions(voteOptions.filter((_, i) => i !== index));
    } else {
      alert("최소 2개의 투표 옵션이 필요합니다.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    try {
      // 선택된 카테고리가 school-student이고 selectedSchool이 있는 경우 
      // 선택한 학교 정보를 사용
      let schoolId = user.schoolId || "";
      let schoolName = user.schoolName || "";
      
      if (category === "school-student" && selectedSchool !== null) {
        // 선택한 학교 정보를 가져옴
        try {
          schoolId = selectedSchool.id;
          schoolName = selectedSchool.KOR_NAME;
        } catch (error) {
          console.error("학교 정보를 가져오는 중 오류 발생:", error);
        }
      }

      // 게시글 먼저 생성하여 postId를 받음
      const newPost = {
        title,
        content,
        author: user.userId,
        authorId: user.uid,
        categoryId: category,
        address1: user.address1 || "",
        address2: user.address2 || "",
        schoolId: schoolId,
        schoolName: schoolName,
        imageUrls: [], // 이미지를 나중에 추가할 것이므로 빈 배열
        isVotePost,
        voteOptions: null, // 이 부분도 나중에 추가
      };

      const createdPostId = await createPost(newPost);

      // 생성된 postId로 이미지 업로드
      const uploadedImageUrls = await Promise.all(
        images.map((image) =>
          uploadImage(image, user.uid, "post", createdPostId),
        ),
      );

      let uploadedVoteOptions;
      if (isVotePost) {
        uploadedVoteOptions = await Promise.all(
          voteOptions.map(async (option) => {
            if (option.image) {
              const imageUrl = await uploadImage(
                option.image,
                user.uid,
                "vote",
                createdPostId,
              );
              return { text: option.text, imageUrl };
            }
            return { text: option.text };
          }),
        );
      }

      // 업로드된 이미지 URL을 게시글에 업데이트
      await updatePost(createdPostId, {
        imageUrls: uploadedImageUrls,
        voteOptions: isVotePost
          ? uploadedVoteOptions.filter(
              (option: { text: string }) => option.text.trim() !== "",
            )
          : null,
      });

      setNewPostId(createdPostId);

      // 경험치 업데이트
      const settings = await getExperienceSettings();
      const result = await updateUserExperience(
        user.uid,
        settings.postCreation,
        "게시글을 작성했습니다",
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
      } else {
        router.back();
      }
    } catch (e) {
      console.error("Error adding document: ", e);
      alert(`게시글 작성에 실패했습니다: ${e.message}`);
    }
  };

  const handleExpModalClose = () => {
    setShowExpModal(false);
    setNewLevel(undefined);
    if (newPostId) {
      router.back();
    }
  };

  return (
    <Layout>
      <PageContainer>
        <MobileHeader>
          <HamburgerIcon onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <FaBars />
          </HamburgerIcon>
          <MobileTitle>{getCategoryName(selectedCategory)}</MobileTitle>
        </MobileHeader>
        <ContentWrapper>
          <CategoryPanel isOpen={isMobileMenuOpen} />
          <MainContent isMobileMenuOpen={isMobileMenuOpen}>
            <Header>
              <TitleContainer>
                <h1>게시글 작성</h1>
                <InfoIcon onClick={() => setIsNoticeOpen(true)}>
                  <FaInfoCircle />
                </InfoIcon>
              </TitleContainer>
            </Header>
            <Form onSubmit={handleSubmit}>
              <Input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                required
              />
              <ReactQuill
                value={content}
                onChange={handleContentChange}
                modules={{
                  toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline", "strike", "clean"],
                  ],
                }}
                placeholder="내용을 입력하세요"
              />
              <ImageUploadButton
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }}
              >
                <FaUpload /> 이미지 (최대 10개)
              </ImageUploadButton>
              <HiddenInput
                ref={fileInputRef}
                type="file"
                id="image"
                accept="image/*"
                multiple
                onChange={handleImageChange}
              />
              <ImagePreviewContainer>
                {images.map((image, index) => (
                  <ImagePreviewWrapper key={index}>
                    <ImagePreview
                      src={URL.createObjectURL(image)}
                      alt={`Image preview ${index + 1}`}
                    />
                    <RemoveButton
                      type="button"
                      onClick={() => handleImageRemove(index)}
                    >
                      <FaTrash />
                    </RemoveButton>
                  </ImagePreviewWrapper>
                ))}
              </ImagePreviewContainer>
              <Label>
                <input
                  type="checkbox"
                  checked={isVotePost}
                  onChange={(e) => setIsVotePost(e.target.checked)}
                />
                투표 게시글로 작성
              </Label>
              {isVotePost && (
                <VoteOptionsContainer>
                  {voteOptions.map((option, index) => (
                    <VoteOptionContainer key={index}>
                      <VoteInput
                        type="text"
                        value={option.text}
                        onChange={(e) =>
                          handleVoteOptionChange(index, e.target.value)
                        }
                        placeholder={`옵션 ${index + 1}`}
                      />
                      <VoteImageUploadButton
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          document
                            .getElementById(`vote-image-${index}`)
                            ?.click();
                        }}
                      >
                        <FaUpload />
                      </VoteImageUploadButton>
                      <HiddenInput
                        id={`vote-image-${index}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleVoteImageChange(index, e)}
                      />
                      {option.image && (
                        <ImagePreviewWrapper>
                          <ImagePreview
                            src={URL.createObjectURL(option.image)}
                            alt={`Vote option ${index + 1}`}
                          />
                          <RemoveButton
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleVoteImageRemove(index);
                            }}
                          >
                            <FaTrash />
                          </RemoveButton>
                        </ImagePreviewWrapper>
                      )}
                      <RemoveButton
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemoveVoteOption(index);
                        }}
                      >
                        <FaTrash />
                      </RemoveButton>
                    </VoteOptionContainer>
                  ))}
                  {voteOptions.length < 8 && (
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleAddVoteOption();
                      }}
                    >
                      투표 옵션 추가
                    </Button>
                  )}
                </VoteOptionsContainer>
              )}
              <ButtonContainer>
                <SubmitButton type="submit">게시</SubmitButton>
                <BackButton type="button" onClick={() => router.back()}>
                  목록
                </BackButton>
              </ButtonContainer>
            </Form>
          </MainContent>
        </ContentWrapper>
      </PageContainer>
      <DefaultModal
        isOpen={isNoticeOpen}
        onClose={() => setIsNoticeOpen(false)}
        title="📜 작성 원칙"
        message={noticeContent}
        height="500px"
      />
      <ExperienceModal
        isOpen={showExpModal}
        onClose={handleExpModalClose}
        expGained={expGained}
        newLevel={newLevel}
      />
    </Layout>
  );
};

const PageContainer = styled.div`
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
    padding: 0.5rem;
    transform: ${({ isMobileMenuOpen }) =>
      isMobileMenuOpen ? "translateX(280px)" : "translateX(0)"};
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

const Container = styled.div`
  display: flex;
  @media (max-width: 768px) {
    flex-direction: column;
  }
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

const ContentSection = styled.div`
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;

  h1 {
    @media (max-width: 768px) {
      font-size: 1.6rem;
    }
  }
`;

const TitleContainer = styled.div`
  display: flex;
  align-items: center;
`;

const InfoIcon = styled.div`
  color: #4a6dff;
  cursor: pointer;
  margin-left: 10px;
  font-size: 1.2rem;
  
  &:hover {
    color: #2a4ddf;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Label = styled.label`
  font-size: 1rem;
  margin-bottom: 0.5rem;
`;

const Select = styled.select`
  padding: 0.75rem;
  text-align: start;
  border-radius: 4px;
  font-size: 1rem;
`;

const Input = styled.input`
  padding: 0.5rem; // 기존 크기보다 작게 조정
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.8rem; // 폰트 크기 조정
  flex: 1; // flex를 사용하여 공간을 활용
  min-height: 30px;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Button = styled.button`
  padding: 0.75rem 1rem;
  background-color: var(--primary-button);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  max-width: 200px;

  &:hover {
    background-color: var(--primary-hover);
  }
`;

const SubmitButton = styled(Button)``;

const BackButton = styled(Button)`
  background-color: var(--gray-button);

  &:hover {
    background-color: var(--gray-hover);
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

const VoteOptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const VoteOptionContainer = styled.div`
  display: flex;
  /* align-items: center; */
  gap: 10px;

  /* @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  } */
`;

const VoteInput = styled.input`
  width: 300px;
  height: 60px;
  padding: 10px; // 기존 크기보다 작게 조정
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem; // 폰트 크기 조정

  @media (max-width: 768px) {
    width: 160px;
    height: 40px;
  }
`;

const ImagePreview = styled.img`
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;

  @media (max-width: 768px) {
    width: 80px;
    height: 80px;
  }
`;

const ImageUploadButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  color: #333;
  padding: 0.5rem;

  &:hover {
    background-color: #e0e0e0;
  }

  svg {
    margin-right: 0.5rem;
  }

  @media (max-width: 768px) {
    width: auto;
    padding: 0.4rem;
  }
`;

const VoteImageUploadButton = styled(Button)`
  width: 60px;
  background-color: #f0f0f0;
  color: #333;
  padding: 0.5rem;

  &:hover {
    background-color: #e0e0e0;
  }

  svg {
    margin-right: 0.5rem;
  }

  @media (max-width: 768px) {
    width: auto;
    padding: 0.4rem;
  }
`;

const RemoveButton = styled(Button)`
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 5px;
  background-color: rgba(255, 255, 255, 0.7);
  color: #ff4d4d;

  &:hover {
    background-color: rgba(255, 255, 255, 0.9);
  }

  svg {
    font-size: 0.8rem;
  }

  @media (max-width: 768px) {
    padding: 4px;
  }
`;

export default CreatePostPage;
