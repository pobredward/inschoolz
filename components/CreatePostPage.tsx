import React, { useState, useEffect, useRef } from "react";
import styled from "@emotion/styled";
import Layout from "../components/Layout";
import { useRecoilState } from "recoil";
import { useRouter } from "next/router";
import { createPost } from "../services/postService";
import {
  userState,
  User,
  selectedCategoryState,
  categoriesState,
} from "../store/atoms";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "../utils/imageUtils";
import { FaUpload, FaTrash } from "react-icons/fa";

const CreatePostPage: React.FC = () => {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [user] = useRecoilState<User | null>(userState);
  const [categories] = useRecoilState(categoriesState);
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
      const compressedImages = await Promise.all(newImages.map(compressImage));
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

    const uploadedImageUrls = await Promise.all(
      images.map(async (image) => {
        const storageRef = ref(storage, `images/${Date.now()}_${image.name}`);
        await uploadBytes(storageRef, image);
        return getDownloadURL(storageRef);
      }),
    );

    let uploadedVoteOptions;
    if (isVotePost) {
      uploadedVoteOptions = await Promise.all(
        voteOptions.map(async (option) => {
          if (option.image) {
            const storageRef = ref(
              storage,
              `vote_images/${Date.now()}_${option.image.name}`,
            );
            await uploadBytes(storageRef, option.image);
            const imageUrl = await getDownloadURL(storageRef);
            return { text: option.text, imageUrl };
          }
          return { text: option.text };
        }),
      );
    }

    const newPost = {
      title,
      content,
      author: user.userId,
      authorId: user.uid,
      categoryId: category,
      address1: user.address1 || "",
      address2: user.address2 || "",
      schoolId: user.schoolId || "",
      schoolName: user.schoolName || "",
      imageUrls: uploadedImageUrls,
      isVotePost,
      voteOptions: isVotePost
        ? uploadedVoteOptions.filter(
            (option: { text: string }) => option.text.trim() !== "",
          )
        : null,
    };

    try {
      await createPost(newPost);
      router.push(`/community/${category}`);
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("게시글 작성에 실패했습니다.");
    }
  };

  return (
    <Layout>
      <Container>
        <ContentSection>
          <h1>게시글 작성</h1>
          <Form onSubmit={handleSubmit}>
            <Label htmlFor="title">제목</Label>
            <Input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Label htmlFor="category">카테고리</Label>
            <Select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">카테고리 선택</option>
              {categories.map((cat) => (
                <optgroup key={cat.id} label={cat.name}>
                  {cat.subcategories?.map((subcat) => (
                    <option key={subcat.id} value={subcat.id}>
                      {subcat.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Label htmlFor="content">내용</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <Label htmlFor="image">이미지 업로드 (최대 10개)</Label>
            <ImageUploadButton
              type="button"
              onClick={(e) => {
                e.preventDefault();
                fileInputRef.current?.click();
              }}
            >
              <FaUpload /> 이미지 선택
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
                    <Input
                      type="text"
                      value={option.text}
                      onChange={(e) =>
                        handleVoteOptionChange(index, e.target.value)
                      }
                      placeholder={`투표 옵션 ${index + 1}`}
                    />
                    <ImageUploadButton
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(`vote-image-${index}`)?.click();
                      }}
                    >
                      <FaUpload /> 이미지 선택
                    </ImageUploadButton>
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
                            handleVoteImageChange(index, {
                              target: { files: null },
                            } as any);
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
              <SubmitButton type="submit">작성하기</SubmitButton>
              <BackButton type="button" onClick={() => router.back()}>
                목록으로 돌아가기
              </BackButton>
            </ButtonContainer>
          </Form>
        </ContentSection>
      </Container>
    </Layout>
  );
};

const Container = styled.div`
  display: flex;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const ContentSection = styled.div`
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
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

const Textarea = styled.textarea`
  padding: 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  min-height: 200px;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  background-color: #0070f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;

  &:hover {
    background-color: #0056b3;
  }
`;

const SubmitButton = styled(Button)``;

const BackButton = styled(Button)`
  background-color: #ccc;

  &:hover {
    background-color: #aaa;
  }
`;

const ImageUploadButton = styled(Button)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  color: #333;

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
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
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
`;

const VoteOptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const VoteOptionContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

export default CreatePostPage;
