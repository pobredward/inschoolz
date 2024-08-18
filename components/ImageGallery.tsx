import React, { useState } from "react";
import styled from "@emotion/styled";
import { FaChevronLeft, FaChevronRight, FaTimes } from "react-icons/fa";
import Image from "next/image";

interface ImageGalleryProps {
  images: string[];
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const openModal = (index: number) => {
    setCurrentImageIndex(index);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(
      (prevIndex) => (prevIndex - 1 + images.length) % images.length,
    );
  };

  return (
    <>
      <GalleryContainer>
        {images.map((image, index) => (
          <ImagePreview key={index} onClick={() => openModal(index)}>
            <Image
              src={image}
              alt={`Preview ${index + 1}`}
              layout="fill"
              objectFit="cover"
            />
          </ImagePreview>
        ))}
      </GalleryContainer>
      <Modal isOpen={modalOpen} onClose={closeModal}>
        <ModalContent>
          <CloseButton onClick={closeModal}>
            <FaTimes />
          </CloseButton>
          <ModalImage
            src={images[currentImageIndex]}
            alt={`Full size ${currentImageIndex + 1}`}
          />
          <NavButton onClick={prevImage} style={{ left: 10 }}>
            <FaChevronLeft />
          </NavButton>
          <NavButton onClick={nextImage} style={{ right: 10 }}>
            <FaChevronRight />
          </NavButton>
        </ModalContent>
      </Modal>
    </>
  );
};

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContainer onClick={(e) => e.stopPropagation()}>
        {children}
      </ModalContainer>
    </ModalOverlay>
  );
};

const GalleryContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(200px, 1fr)
  ); // 이미지 크기를 150px로 증가
  gap: 10px;
  margin-top: 10px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr; // 모바일에서 1열로 변경
  }
`;

const ImagePreview = styled.div`
  position: relative;
  width: 100%;
  padding-bottom: 100%; // 1:1 비율 유지
  overflow: hidden;
  cursor: pointer;
  border-radius: 10px;

  @media (max-width: 768px) {
    padding-bottom: 75%; // 모바일에서 4:3 비율로 변경 (선택사항)
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContainer = styled.div`
  background-color: white;
  padding: 5px;
  border-radius: 0px;
  position: relative;
`;

const ModalContent = styled.div`
  position: relative;
`;

const ModalImage = styled.img`
  max-width: 95vw;
  max-height: 95vh;
  object-fit: contain;
`;

const NavButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  font-size: 24px;
  padding: 10px;
  cursor: pointer;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 24px;
  color: white;
  cursor: pointer;
  z-index: 1001;
`;

export { ImageGallery, Modal };
