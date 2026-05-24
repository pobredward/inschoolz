// 서비스 클래스들을 통합 관리하는 인덱스 파일

export { default as FirebaseService } from './firebase-service';
export { default as BotService } from './bot-service';
export { default as PostService } from './post-service';
export { default as CleanupService } from './cleanup-service';
export { default as CommentService } from './comment-service';
export { ContentTemplates } from './content-templates';

// 타입 정의
import BotService from './bot-service';
import PostService from './post-service';
import CleanupService from './cleanup-service';
import CommentService from './comment-service';

// 서비스 팩토리 함수들
export const createBotService = (): BotService => new BotService();
export const createPostService = (): PostService => new PostService();
export const createCleanupService = (): CleanupService => new CleanupService();
export const createCommentService = (): CommentService => new CommentService();

// 서비스 인스턴스 관리자
class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, unknown> = new Map();

  private constructor() {}

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  public getService<T>(serviceName: string, factory: () => T): T {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, factory());
    }
    return this.services.get(serviceName) as T;
  }

  public clearServices(): void {
    this.services.clear();
  }
}

export const serviceManager = ServiceManager.getInstance();

// 편의 함수들
export const getBotService = (): BotService => serviceManager.getService('bot', createBotService);
export const getPostService = (): PostService => serviceManager.getService('post', createPostService);
export const getCleanupService = (): CleanupService => serviceManager.getService('cleanup', createCleanupService);
export const getCommentService = (): CommentService => serviceManager.getService('comment', createCommentService);
