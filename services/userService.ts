// services/userService.ts

import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { deleteUser as deleteFirebaseUser } from "firebase/auth";
import { db, auth, storage } from "../lib/firebase";
import { ref, listAll, deleteObject } from "firebase/storage";
import { reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { User } from "../types";

export const toggleFavoriteMinorGallery = async (
  userId: string,
  galleryId: string
): Promise<User> => {
  const userRef = doc(db, "users", userId);
  try {
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data() as User;
    const favoriteGalleries = userData.favoriteGalleries || [];

    let updatedFavoriteGalleries: string[];
    if (favoriteGalleries.includes(galleryId)) {
      updatedFavoriteGalleries = favoriteGalleries.filter(
        (id) => id !== galleryId
      );
    } else {
      updatedFavoriteGalleries = [...favoriteGalleries, galleryId];
    }

    await updateDoc(userRef, {
      favoriteGalleries: updatedFavoriteGalleries,
    });

    return {
      ...userData,
      favoriteGalleries: updatedFavoriteGalleries,
    };
  } catch (error) {
    console.error("Error toggling favorite minor gallery:", error);
    throw error;
  }
};

export const toggleFavoriteSchool = async (
  userId: string,
  schoolId: string
) => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      const favoriteSchools = userData.favoriteSchools || [];

      if (favoriteSchools.includes(schoolId)) {
        // Remove from favorites
        await updateDoc(userRef, {
          favoriteSchools: arrayRemove(schoolId),
        });
      } else {
        // Add to favorites
        await updateDoc(userRef, {
          favoriteSchools: arrayUnion(schoolId),
        });
      }
    }
  } catch (error) {
    console.error("Error toggling favorite school:", error);
    throw error;
  }
};

export const deleteUser = async (
  userId: string,
  password: string
): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not found");
    }

    // 사용자 재인증
    const credential = EmailAuthProvider.credential(user.email!, password);
    await reauthenticateWithCredential(user, credential);

    // 1. 게시글 처리
    const postsQuery = query(
      collection(db, "posts"),
      where("authorId", "==", userId)
    );
    const postsSnapshot = await getDocs(postsQuery);
    const updatePostPromises = postsSnapshot.docs.map(async (doc) => {
      // 게시글 이미지 및 vote 이미지 삭제
      const postData = doc.data();
      if (postData.imageUrls) {
        await Promise.all(
          postData.imageUrls.map(async (url) => {
            try {
              const imageRef = ref(storage, url);
              await deleteObject(imageRef);
            } catch (error) {
              console.error(`Error deleting image ${url}:`, error);
            }
          })
        );
      }
      if (postData.voteOptions) {
        await Promise.all(
          postData.voteOptions
            .filter((option) => option.imageUrl)
            .map(async (option) => {
              try {
                const imageRef = ref(storage, option.imageUrl);
                await deleteObject(imageRef);
              } catch (error) {
                console.error(
                  `Error deleting vote image ${option.imageUrl}:`,
                  error
                );
              }
            })
        );
      }

      // 게시글 업데이트
      return updateDoc(doc.ref, {
        author: "탈퇴한 회원",
        title: "삭제된 게시글",
        content: "탈퇴한 회원의 게시글입니다",
        imageUrls: [],
        voteOptions: null,
      });
    });
    await Promise.all(updatePostPromises);

    // 2. 댓글 처리
    const commentsQuery = query(
      collection(db, "comments"),
      where("authorId", "==", userId)
    );
    const commentsSnapshot = await getDocs(commentsQuery);
    const updateCommentPromises = commentsSnapshot.docs.map(async (doc) => {
      const commentData = doc.data();
      if (commentData.isReply) {
        // 대댓글인 경우
        return updateDoc(doc.ref, {
          author: "탈퇴한 회원",
          content: "탈퇴한 회원의 댓글입니다.",
        });
      } else {
        // 댓글인 경우 대댓글 여부 확인
        const repliesQuery = query(
          collection(db, "comments"),
          where("parentId", "==", doc.id)
        );
        const repliesSnapshot = await getDocs(repliesQuery);
        if (repliesSnapshot.empty) {
          // 대댓글이 없는 경우 삭제
          return deleteDoc(doc.ref);
        } else {
          // 대댓글이 있는 경우 내용 수정
          return updateDoc(doc.ref, {
            author: "탈퇴한 회원",
            content: "탈퇴한 회원의 댓글입니다.",
          });
        }
      }
    });
    await Promise.all(updateCommentPromises);

    // 3. 미니게임 점수 삭제
    const gameScoresQuery = query(
      collection(db, "gameScores"),
      where("userId", "==", userId)
    );
    const gameScoresSnapshot = await getDocs(gameScoresQuery);
    const deleteGameScorePromises = gameScoresSnapshot.docs.map((doc) =>
      deleteDoc(doc.ref)
    );
    await Promise.all(deleteGameScorePromises);

    // 3. 미니게임 점수 삭제
    await deleteDoc(doc(db, "flappyBirdScores", userId));
    await deleteDoc(doc(db, "reactionGameScores", userId));

    // 4. 사용자의 이미지 파일 삭제
    await deleteUserImages(userId);

    // 5. Firestore에서 사용자 문서 업데이트
    await updateDoc(doc(db, "users", userId), {
      name: "탈퇴한 회원",
      email: "deleted@example.com",
      userId: `deleted_${Date.now()}`, // 유니크한 값으로 변경
      phoneNumber: "",
      address1: "",
      address2: "",
      schoolId: "",
      schoolAddress: "",
      schoolName: "",
      birthYear: 0,
      birthMonth: 0,
      birthDay: 0,
      experience: 0,
      totalExperience: 0,
      level: 0,
      isDeleted: true,
      deletedAt: new Date(), // 탈퇴 시점 기록
      // 기타 민감한 정보 필드들도 초기화
      favoriteSchools: [],
      invitedBy: null,
      // gameInfo 초기화
      gameInfo: {
        reactionGamePlays: 0,
        flappyBirdPlays: 0,
        lastResetDate: null,
      },
      // 필요에 따라 다른 필드들도 초기화
    });

    // 6. Firebase Authentication에서 사용자 삭제
    await user.delete();
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
};

const deleteUserImages = async (userId: string): Promise<void> => {
  const imageFolders = ["images", "vote_images"];

  for (const folder of imageFolders) {
    const userImagesRef = ref(storage, `users/${userId}/${folder}`);

    try {
      const fileList = await listAll(userImagesRef);
      await Promise.all(
        fileList.items.map(async (fileRef) => {
          try {
            await deleteObject(fileRef);
          } catch (error) {
            console.error(`Error deleting file ${fileRef.fullPath}:`, error);
          }
        })
      );
    } catch (error) {
      console.error(`Error listing files in ${folder}:`, error);
    }
  }
};

export const updateUserProfile = async (
  userId: string,
  updatedData: Partial<User>
): Promise<void> => {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, updatedData);

  // 로컬 스토리지 업데이트
  const cachedUser = localStorage.getItem(`user_${userId}`);
  if (cachedUser) {
    const updatedCachedUser = { ...JSON.parse(cachedUser), ...updatedData };
    localStorage.setItem(`user_${userId}`, JSON.stringify(updatedCachedUser));
  }

  // schoolName 또는 address가 변경된 경우, 게임 점수 테이블 업데이트
  if (updatedData.schoolName || updatedData.address1 || updatedData.address2) {
    await updateGameScores(userId, updatedData);
  }
};

async function updateGameScores(
  userId: string,
  updatedData: Partial<User>
): Promise<void> {
  const gameScoreTables = [
    "flappyBirdScores",
    "reactionGameScores",
    "tileGameScores",
  ];

  for (const table of gameScoreTables) {
    const scoreRef = doc(db, table, userId);
    const scoreDoc = await getDoc(scoreRef);

    if (scoreDoc.exists()) {
      const updateData: Partial<User> = {};
      if (updatedData.schoolName)
        updateData.schoolName = updatedData.schoolName;
      if (updatedData.address1) updateData.address1 = updatedData.address1;
      if (updatedData.address2) updateData.address2 = updatedData.address2;

      await updateDoc(scoreRef, updateData);
    }
  }
}
