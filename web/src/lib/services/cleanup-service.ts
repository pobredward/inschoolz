import FirebaseService from './firebase-service';

interface CleanupResult {
  deletedCount: number;
  protectedCount: number;
  details: {
    aiPosts: number;
    realPosts: number;
  };
}

interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

/**
 * 데이터 정리 서비스
 * 루트 스크립트의 cleanup-fake-posts.js 로직을 통합
 */
export class CleanupService {
  private firebaseService: FirebaseService;
  private db: FirebaseFirestore.Firestore;

  constructor() {
    this.firebaseService = FirebaseService.getInstance();
    this.db = this.firebaseService.getFirestore();
  }

  /**
   * AI 생성 게시글 정리 (시간 기준)
   */
  public async cleanupFakePosts(
    hoursAgo: number = 3,
    onProgress?: ProgressCallback
  ): Promise<CleanupResult> {
    try {
      console.log('🧹 AI 생성 게시글 정리 시작...');
      
      // 기준 시간 계산
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
      console.log(`📅 기준 시간: ${cutoffTime.toLocaleString('ko-KR')} 이후 생성된 게시글`);
      
      // AI 게시글 조회 (system-auto-poster + user_로 시작하는 ID)
      const systemPostsQuery = await this.db
        .collection('posts')
        .where('authorId', '==', 'system-auto-poster')
        .get();
      
      const userPostsQuery = await this.db
        .collection('posts')
        .where('authorId', '>=', 'user_')
        .where('authorId', '<', 'user_z')
        .get();

      // 시간 필터링은 메모리에서 처리
      const allFakePosts = [...systemPostsQuery.docs, ...userPostsQuery.docs].filter(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
        return createdAt >= cutoffTime;
      });
      
      if (allFakePosts.length === 0) {
        console.log('✅ 삭제할 AI 게시글이 없습니다.');
        return {
          deletedCount: 0,
          protectedCount: 0,
          details: { aiPosts: 0, realPosts: 0 }
        };
      }

      console.log(`🔍 ${allFakePosts.length}개의 AI 게시글을 찾았습니다.`);
      
      // AI 게시글 구분: tags가 있는 게시글 = AI 생성, tags가 없는 게시글 = 실제 게시글
      const aiPosts: Array<{id: string, title: string, authorId: string, tags: string[], createdAt: string}> = [];
      const realPosts: Array<{id: string, title: string, authorId: string}> = [];
      
      for (const doc of allFakePosts) {
        const data = doc.data();
        const hasTags = data.tags && Array.isArray(data.tags) && data.tags.length > 0;
        
        if (hasTags) {
          // tags가 있으면 AI 게시글
          aiPosts.push({
            id: doc.id,
            title: data.title,
            authorId: data.authorId,
            tags: data.tags,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          });
        } else {
          // tags가 없으면 실제 게시글 (보호)
          realPosts.push({
            id: doc.id,
            title: data.title,
            authorId: data.authorId
          });
        }
      }

      if (realPosts.length > 0) {
        console.log('⚠️  실제 게시글로 보이는 항목들 (tags 없음 - 삭제하지 않음):');
        realPosts.forEach((post, index) => {
          console.log(`   ${index + 1}. ${post.title} (${post.authorId})`);
        });
      }

      if (aiPosts.length === 0) {
        console.log('✅ 삭제할 AI 게시글이 없습니다.');
        return {
          deletedCount: 0,
          protectedCount: realPosts.length,
          details: { aiPosts: 0, realPosts: realPosts.length }
        };
      }

      console.log(`\n🗑️  삭제 예정 AI 게시글 (${aiPosts.length}개):`);
      aiPosts.slice(0, 10).forEach((post, index) => {
        console.log(`   ${index + 1}. ${post.title} (${post.authorId}) [tags: ${post.tags.join(', ')}]`);
      });
      
      if (aiPosts.length > 10) {
        console.log(`   ... 외 ${aiPosts.length - 10}개`);
      }

      // 배치 삭제 실행
      console.log('\n🔥 AI 게시글 삭제 중...');
      let deletedCount = 0;
      
      await this.firebaseService.executeBatch(
        aiPosts,
        500, // Firestore 배치 제한
        async (batchPosts) => {
          const batch = this.db.batch();
          
          for (const post of batchPosts) {
            batch.delete(this.db.collection('posts').doc(post.id));
          }
          
          await batch.commit();
          deletedCount += batchPosts.length;
        },
        (processed, total) => {
          console.log(`   ✅ ${processed}/${total} 삭제 완료`);
          if (onProgress) {
            onProgress(processed, total, `AI 게시글 삭제 중... (${processed}/${total})`);
          }
        }
      );

      console.log(`\n🎉 AI 게시글 정리 완료!`);
      console.log(`   - 삭제된 AI 게시글: ${deletedCount}개`);
      console.log(`   - 보호된 실제 게시글: ${realPosts.length}개`);
      
      return {
        deletedCount,
        protectedCount: realPosts.length,
        details: {
          aiPosts: deletedCount,
          realPosts: realPosts.length
        }
      };
      
    } catch (error) {
      console.error('❌ AI 게시글 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 모든 AI 게시글 삭제 (시간 제한 없음)
   */
  public async cleanupAllFakePosts(onProgress?: ProgressCallback): Promise<CleanupResult> {
    try {
      console.log('🧹 모든 AI 생성 게시글 정리 시작...');
      
      // AI 게시글 조회 (system-auto-poster + user_로 시작하는 ID)
      const systemPostsQuery = await this.db
        .collection('posts')
        .where('authorId', '==', 'system-auto-poster')
        .get();
      
      const userPostsQuery = await this.db
        .collection('posts')
        .where('authorId', '>=', 'user_')
        .where('authorId', '<', 'user_z')
        .get();

      const allFakePosts = [...systemPostsQuery.docs, ...userPostsQuery.docs];
      
      if (allFakePosts.length === 0) {
        console.log('✅ 삭제할 AI 게시글이 없습니다.');
        return {
          deletedCount: 0,
          protectedCount: 0,
          details: { aiPosts: 0, realPosts: 0 }
        };
      }

      console.log(`🔍 ${allFakePosts.length}개의 AI 게시글을 찾았습니다.`);
      
      // AI 게시글 구분: tags가 있는 게시글 = AI 생성, tags가 없는 게시글 = 실제 게시글
      const aiPosts: Array<{id: string, title: string, authorId: string, tags?: string[]}> = [];
      const realPosts: Array<{id: string, title: string, authorId: string}> = [];
      
      for (const doc of allFakePosts) {
        const data = doc.data();
        const hasTags = data.tags && Array.isArray(data.tags) && data.tags.length > 0;
        
        if (hasTags) {
          // tags가 있으면 AI 게시글
          aiPosts.push({
            id: doc.id,
            title: data.title,
            authorId: data.authorId,
            tags: data.tags
          });
        } else {
          // tags가 없으면 실제 게시글 (보호)
          realPosts.push({
            id: doc.id,
            title: data.title,
            authorId: data.authorId
          });
        }
      }

      if (realPosts.length > 0) {
        console.log('⚠️  실제 게시글로 보이는 항목들 (tags 없음 - 삭제하지 않음):');
        realPosts.slice(0, 10).forEach((post, index) => {
          console.log(`   ${index + 1}. ${post.title} (${post.authorId})`);
        });
        if (realPosts.length > 10) {
          console.log(`   ... 외 ${realPosts.length - 10}개`);
        }
      }

      if (aiPosts.length === 0) {
        console.log('✅ 삭제할 AI 게시글이 없습니다.');
        return {
          deletedCount: 0,
          protectedCount: realPosts.length,
          details: { aiPosts: 0, realPosts: realPosts.length }
        };
      }

      console.log(`\n🗑️  삭제 예정 AI 게시글 (${aiPosts.length}개):`);
      aiPosts.slice(0, 10).forEach((post, index) => {
        console.log(`   ${index + 1}. ${post.title} (${post.authorId}) [tags: ${post.tags?.join(', ') || 'none'}]`);
      });
      
      if (aiPosts.length > 10) {
        console.log(`   ... 외 ${aiPosts.length - 10}개`);
      }

      // 배치 삭제 실행
      console.log('\n🔥 AI 게시글 삭제 중...');
      let deletedCount = 0;
      
      await this.firebaseService.executeBatch(
        aiPosts,
        500, // Firestore 배치 제한
        async (batchPosts) => {
          const batch = this.db.batch();
          
          for (const post of batchPosts) {
            batch.delete(this.db.collection('posts').doc(post.id));
          }
          
          await batch.commit();
          deletedCount += batchPosts.length;
        },
        (processed, total) => {
          console.log(`   ✅ ${processed}/${total} 삭제 완료`);
          if (onProgress) {
            onProgress(processed, total, `AI 게시글 삭제 중... (${processed}/${total})`);
          }
        }
      );

      console.log(`\n🎉 AI 게시글 정리 완료!`);
      console.log(`   - 삭제된 AI 게시글: ${deletedCount}개`);
      console.log(`   - 보호된 실제 게시글: ${realPosts.length}개`);
      
      return {
        deletedCount,
        protectedCount: realPosts.length,
        details: {
          aiPosts: deletedCount,
          realPosts: realPosts.length
        }
      };
      
    } catch (error) {
      console.error('❌ AI 게시글 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 날짜 이전의 AI 게시글 삭제
   */
  public async cleanupFakePostsByDate(
    olderThanDays: number,
    onProgress?: ProgressCallback
  ): Promise<CleanupResult> {
    try {
      console.log(`🧹 ${olderThanDays}일 이전 AI 게시글 정리 시작...`);
      
      // 기준 시간 계산
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - (olderThanDays * 24 * 60 * 60 * 1000));
      console.log(`📅 기준 시간: ${cutoffTime.toLocaleString('ko-KR')} 이전 생성된 게시글`);
      
      // AI 게시글 조회
      const systemPostsQuery = await this.db
        .collection('posts')
        .where('authorId', '==', 'system-auto-poster')
        .get();
      
      const userPostsQuery = await this.db
        .collection('posts')
        .where('authorId', '>=', 'user_')
        .where('authorId', '<', 'user_z')
        .get();

      // 날짜 필터링은 메모리에서 처리
      const allFakePosts = [...systemPostsQuery.docs, ...userPostsQuery.docs].filter(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
        return createdAt <= cutoffTime;
      });
      
      if (allFakePosts.length === 0) {
        console.log(`✅ ${olderThanDays}일 이전 AI 게시글이 없습니다.`);
        return {
          deletedCount: 0,
          protectedCount: 0,
          details: { aiPosts: 0, realPosts: 0 }
        };
      }

      console.log(`🔍 ${allFakePosts.length}개의 오래된 AI 게시글을 찾았습니다.`);
      
      // AI 게시글 구분
      const aiPosts: Array<{id: string, title: string, authorId: string, tags?: string[]}> = [];
      const realPosts: Array<{id: string, title: string, authorId: string}> = [];
      
      for (const doc of allFakePosts) {
        const data = doc.data();
        const hasTags = data.tags && Array.isArray(data.tags) && data.tags.length > 0;
        
        if (hasTags) {
          aiPosts.push({
            id: doc.id,
            title: data.title,
            authorId: data.authorId,
            tags: data.tags
          });
        } else {
          realPosts.push({
            id: doc.id,
            title: data.title,
            authorId: data.authorId
          });
        }
      }

      if (aiPosts.length === 0) {
        console.log(`✅ ${olderThanDays}일 이전 삭제할 AI 게시글이 없습니다.`);
        return {
          deletedCount: 0,
          protectedCount: realPosts.length,
          details: { aiPosts: 0, realPosts: realPosts.length }
        };
      }

      // 배치 삭제 실행
      console.log(`\n🔥 ${olderThanDays}일 이전 AI 게시글 삭제 중...`);
      let deletedCount = 0;
      
      await this.firebaseService.executeBatch(
        aiPosts,
        500,
        async (batchPosts) => {
          const batch = this.db.batch();
          
          for (const post of batchPosts) {
            batch.delete(this.db.collection('posts').doc(post.id));
          }
          
          await batch.commit();
          deletedCount += batchPosts.length;
        },
        (processed, total) => {
          if (onProgress) {
            onProgress(processed, total, `오래된 AI 게시글 삭제 중... (${processed}/${total})`);
          }
        }
      );

      console.log(`\n🎉 오래된 AI 게시글 정리 완료!`);
      console.log(`   - 삭제된 AI 게시글: ${deletedCount}개`);
      console.log(`   - 보호된 실제 게시글: ${realPosts.length}개`);
      
      return {
        deletedCount,
        protectedCount: realPosts.length,
        details: {
          aiPosts: deletedCount,
          realPosts: realPosts.length
        }
      };
      
    } catch (error) {
      console.error(`❌ ${olderThanDays}일 이전 AI 게시글 정리 실패:`, error);
      throw error;
    }
  }

  /**
   * AI 댓글 정리
   */
  public async cleanupFakeComments(onProgress?: ProgressCallback): Promise<number> {
    try {
      console.log('💬 AI 댓글 정리 시작...');
      
      const commentsQuery = await this.db
        .collection('comments')
        .where('fake', '==', true)
        .get();

      if (commentsQuery.empty) {
        console.log('✅ 삭제할 AI 댓글이 없습니다.');
        return 0;
      }

      const totalComments = commentsQuery.size;
      console.log(`🔍 ${totalComments}개의 AI 댓글을 찾았습니다.`);

      let deletedCount = 0;

      await this.firebaseService.executeBatch(
        commentsQuery.docs,
        500,
        async (batchDocs) => {
          const batch = this.db.batch();
          
          batchDocs.forEach(doc => {
            batch.delete(doc.ref);
          });

          await batch.commit();
          deletedCount += batchDocs.length;
        },
        (processed, total) => {
          if (onProgress) {
            onProgress(processed, total, `AI 댓글 삭제 중... (${processed}/${total})`);
          }
        }
      );

      console.log(`✅ ${deletedCount}개의 AI 댓글이 삭제되었습니다.`);
      return deletedCount;

    } catch (error) {
      console.error('❌ AI 댓글 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 전체 데이터 정리 (봇, 게시글, 댓글 모두)
   */
  public async cleanupAllFakeData(onProgress?: ProgressCallback): Promise<{
    deletedBots: number;
    deletedPosts: number;
    deletedComments: number;
    protectedPosts: number;
  }> {
    try {
      console.log('🧹 전체 AI 데이터 정리 시작...\n');

      // 1단계: AI 게시글 정리
      const postResult = await this.cleanupAllFakePosts(onProgress);

      // 2단계: AI 댓글 정리
      const deletedComments = await this.cleanupFakeComments(onProgress);

      // 3단계: 봇 계정 정리 (BotService 사용)
      const { BotService } = await import('./bot-service');
      const botService = new BotService();
      const botResult = await botService.deleteAllBots(onProgress);

      console.log('\n🎉 전체 AI 데이터 정리 완료!');
      console.log('📊 최종 정리 결과:');
      console.log(`   - 삭제된 봇 계정: ${botResult.deletedCount}개`);
      console.log(`   - 삭제된 AI 게시글: ${postResult.deletedCount}개`);
      console.log(`   - 삭제된 AI 댓글: ${deletedComments}개`);
      console.log(`   - 보호된 실제 게시글: ${postResult.protectedCount}개`);

      return {
        deletedBots: botResult.deletedCount,
        deletedPosts: postResult.deletedCount,
        deletedComments,
        protectedPosts: postResult.protectedCount
      };

    } catch (error) {
      console.error('❌ 전체 AI 데이터 정리 실패:', error);
      throw error;
    }
  }
}

export default CleanupService;
