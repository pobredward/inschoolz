import React, { useState, useRef } from "react";
import styled from "@emotion/styled";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { getCroppedImg } from "../../utils/imageUtils";
import { uploadImage, deleteImage } from "../../services/imageService";
import { updateUserProfile } from "../../services/userService";
import { FaImage, FaTrashAlt, FaRedo } from "react-icons/fa";

const ImageCropModal = ({ user, setProfileImageUrl, onClose }) => {
  const [crop, setCrop] = useState<PixelCrop>({
    unit: "px",
    width: 100,
    height: 100,
    x: 0,
    y: 0,
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
    }
  };

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imageRef.current = e.currentTarget;
  };

  const handleCropComplete = async (crop: PixelCrop) => {
    if (imageRef.current && crop.width && crop.height) {
      const croppedBlob = await getCroppedImg(imageRef.current, crop);
      setCroppedBlob(croppedBlob);
    }
  };

  const handleApplyCrop = async () => {
    if (croppedBlob) {
      const croppedFile = new File([croppedBlob], "cropped-image.jpeg", {
        type: "image/jpeg",
      });
      const imageUrl = await uploadImage(croppedFile, user!.uid, "profile");
      setProfileImageUrl(imageUrl);
      await updateUserProfile(user!.uid, { profileImageUrl: imageUrl });
      onClose(); // 모달 닫기
    }
  };

  const handleResetToDefault = async () => {
    if (user?.profileImageUrl) {
      await deleteImage(user.profileImageUrl);
    }
    await updateUserProfile(user!.uid, { profileImageUrl: undefined });
    setProfileImageUrl(null);
    onClose();
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        {/* <Title>프로필 사진</Title> */}

        {selectedImage && (
          <CropContainer>
            <ReactCrop
              crop={crop}
              onChange={(newCrop) => setCrop(newCrop)}
              onComplete={handleCropComplete}
            >
              <img
                src={selectedImage}
                onLoad={handleImageLoaded}
                alt="Crop me"
              />
            </ReactCrop>
          </CropContainer>
        )}

        <ButtonGroup>
          <TextButton
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <FaImage />
            {selectedImage ? "다시 선택하기" : "사진 선택"}
          </TextButton>
          <FileInput
            id="fileInput"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />

          {!selectedImage && (
            <TextButton onClick={handleResetToDefault} red>
              <FaTrashAlt />
              기본 이미지로 변경
            </TextButton>
          )}
        </ButtonGroup>

        <ButtonWrapper>
          <CloseButton onClick={onClose}>닫기</CloseButton>
          {selectedImage && (
            <ApplyButton onClick={handleApplyCrop}>완료</ApplyButton>
          )}
        </ButtonWrapper>
      </ModalContent>
    </ModalOverlay>
  );
};

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: white;
  padding: 2rem;
  border-radius: 10px;
  text-align: left;
  max-width: 90%;
  width: 400px;
  max-height: 90vh;
  overflow-y: auto;

  @media (max-width: 768px) {
    width: 80%;
    padding: 1.5rem;
  }
`;

const Title = styled.h2`
  margin-bottom: 1rem;
  text-align: center;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const FileInput = styled.input`
  display: none;
`;

const TextButton = styled.span<{ red?: boolean }>`
  color: ${(props) => (props.red ? `var(--delete-text)` : "#000")};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 1.1rem;
  padding: 1rem;

  &:hover {
    text-decoration: underline;
  }

  svg {
    font-size: 1.2rem;
  }
`;

const CropContainer = styled.div`
  max-width: 100%;
  max-height: 50vh;
  overflow: hidden;
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;

  & > div {
    max-width: 100%;
    max-height: 100%;
  }

  img {
    max-width: 100%;
    max-height: 50vh;
    object-fit: contain;
  }
`;

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
`;

const CloseButton = styled(Button)`
  background-color: #f0f0f0;
  color: #333;

  &:hover {
    background-color: #e0e0e0;
  }
`;

const ApplyButton = styled(Button)`
  background-color: #0070f3;
  color: white;

  &:hover {
    background-color: #0056b3;
  }
`;

export default ImageCropModal;
