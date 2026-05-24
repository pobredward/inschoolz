import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * 파일 업로드 함수
 * @param file 업로드할 파일
 * @param path 스토리지 경로
 * @returns 업로드된 파일의 URL
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    throw new Error('파일 업로드 중 오류가 발생했습니다.');
  }
};

/**
 * 프로필 이미지 업로드 함수
 * @param userId 사용자 ID
 * @param file 업로드할 이미지 파일
 * @returns 업로드된 이미지의 URL
 */
export const uploadProfileImage = async (userId: string, file: File): Promise<string> => {
  const fileExtension = file.name.split('.').pop();
  const path = `users/${userId}/profile/profile.${fileExtension}`;
  return uploadFile(file, path);
};

/**
 * 게시글 이미지 업로드 함수
 * @param postId 게시글 ID
 * @param file 업로드할 이미지 파일
 * @returns 업로드된 이미지의 URL
 */
export const uploadPostImage = async (postId: string, file: File): Promise<string> => {
  const imageId = crypto.randomUUID();
  const fileExtension = file.name.split('.').pop();
  const path = `posts/${postId}/images/${imageId}.${fileExtension}`;
  return uploadFile(file, path);
};

/**
 * 게시글 첨부파일 업로드 함수
 * @param postId 게시글 ID
 * @param file 업로드할 파일
 * @returns 업로드된 파일의 URL
 */
export const uploadPostAttachment = async (postId: string, file: File): Promise<string> => {
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const path = `posts/${postId}/attachments/${safeFileName}`;
  return uploadFile(file, path);
};

/**
 * 투표 옵션 이미지 업로드 함수
 * @param postId 게시글 ID
 * @param optionIndex 옵션 인덱스
 * @param file 업로드할 이미지 파일
 * @returns 업로드된 이미지의 URL
 */
export const uploadPollOptionImage = async (
  postId: string,
  optionIndex: number,
  file: File
): Promise<string> => {
  const imageId = crypto.randomUUID();
  const fileExtension = file.name.split('.').pop();
  const path = `posts/${postId}/poll_images/${optionIndex}_${imageId}.${fileExtension}`;
  return uploadFile(file, path);
};

/**
 * 댓글 이미지 업로드 함수
 * @param commentId 댓글 ID
 * @param file 업로드할 이미지 파일
 * @returns 업로드된 이미지의 URL
 */
export const uploadCommentImage = async (commentId: string, file: File): Promise<string> => {
  const imageId = crypto.randomUUID();
  const fileExtension = file.name.split('.').pop();
  const path = `comments/${commentId}/images/${imageId}.${fileExtension}`;
  return uploadFile(file, path);
};

/**
 * 채팅 이미지 업로드 함수
 * @param schoolId 학교 ID
 * @param messageId 메시지 ID
 * @param file 업로드할 이미지 파일
 * @returns 업로드된 이미지의 URL
 */
export const uploadChatImage = async (
  schoolId: string,
  messageId: string,
  file: File
): Promise<string> => {
  const imageId = crypto.randomUUID();
  const fileExtension = file.name.split('.').pop();
  const path = `chats/${schoolId}/messages/${messageId}/images/${imageId}.${fileExtension}`;
  return uploadFile(file, path);
};

/**
 * 파일 삭제 함수
 * @param path 삭제할 파일의 스토리지 경로
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('파일 삭제 오류:', error);
    throw new Error('파일 삭제 중 오류가 발생했습니다.');
  }
};

/**
 * 파일 URL에서 경로 추출 함수
 * @param url 파일 URL
 * @returns 스토리지 경로
 */
export const getPathFromUrl = (url: string): string => {
  try {
    // Firebase 스토리지 URL에서 경로 추출
    const baseUrl = 'https://firebasestorage.googleapis.com/v0/b/';
    const urlWithoutBase = url.replace(baseUrl, '');
    const parts = urlWithoutBase.split('/');
    parts.shift(); // 버킷 이름 제거
    const path = parts.join('/').split('?')[0];
    const decodedPath = decodeURIComponent(path);
    return decodedPath;
  } catch (error) {
    console.error('URL에서 경로 추출 오류:', error);
    throw new Error('파일 URL에서 경로를 추출하는 중 오류가 발생했습니다.');
  }
}; 