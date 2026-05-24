/**
 * 주제 다양성 관리자 - 전역 싱글톤으로 주제 중복 방지
 */
export class TopicDiversityManager {
  private static instance: TopicDiversityManager;
  
  // 전역 주제 사용 기록 (모든 PostService 인스턴스에서 공유)
  private globalUsedTopics: Map<string, number> = new Map(); // topic -> timestamp
  private topicVariations: Map<string, Set<string>> = new Map(); // base topic -> variations
  private categoryUsageCount: Map<string, number> = new Map(); // category -> count
  
  // 설정
  private readonly TOPIC_COOLDOWN = 2 * 60 * 60 * 1000; // 2시간
  private readonly MAX_CATEGORY_USAGE_PER_HOUR = 3; // 시간당 카테고리별 최대 사용 횟수
  private readonly SIMILARITY_THRESHOLD = 0.7; // 유사도 임계값
  
  private constructor() {
    // 1시간마다 정리 작업
    setInterval(() => this.cleanupOldRecords(), 60 * 60 * 1000);
  }
  
  public static getInstance(): TopicDiversityManager {
    if (!TopicDiversityManager.instance) {
      TopicDiversityManager.instance = new TopicDiversityManager();
    }
    return TopicDiversityManager.instance;
  }
  
  /**
   * 주제 사용 가능 여부 확인
   */
  public canUseTopic(topic: string, category: string): boolean {
    const now = Date.now();
    
    // 1. 동일 주제 쿨다운 확인
    const lastUsed = this.globalUsedTopics.get(topic);
    if (lastUsed && (now - lastUsed) < this.TOPIC_COOLDOWN) {
      return false;
    }
    
    // 2. 유사 주제 확인
    if (this.hasSimilarTopicUsed(topic)) {
      return false;
    }
    
    // 3. 카테고리 사용 빈도 확인
    const categoryCount = this.getCategoryUsageInLastHour(category);
    if (categoryCount >= this.MAX_CATEGORY_USAGE_PER_HOUR) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 주제 사용 기록
   */
  public recordTopicUsage(topic: string, category: string): void {
    const now = Date.now();
    
    // 주제 사용 기록
    this.globalUsedTopics.set(topic, now);
    
    // 카테고리 사용 기록
    const categoryKey = `${category}_${Math.floor(now / (60 * 60 * 1000))}`;
    const currentCount = this.categoryUsageCount.get(categoryKey) || 0;
    this.categoryUsageCount.set(categoryKey, currentCount + 1);
    
    // 주제 변형 기록
    const baseKeywords = this.extractKeywords(topic);
    const baseKey = baseKeywords.slice(0, 2).join('_');
    if (!this.topicVariations.has(baseKey)) {
      this.topicVariations.set(baseKey, new Set());
    }
    this.topicVariations.get(baseKey)!.add(topic);
    
    console.log(`📝 [DIVERSITY] 주제 기록: "${topic}" (카테고리: ${category})`);
  }
  
  /**
   * 유사 주제 사용 여부 확인
   */
  private hasSimilarTopicUsed(topic: string): boolean {
    const keywords = this.extractKeywords(topic);
    const baseKey = keywords.slice(0, 2).join('_');
    
    const variations = this.topicVariations.get(baseKey);
    if (!variations) return false;
    
    // 유사도 계산
    for (const usedTopic of variations) {
      if (this.calculateSimilarity(topic, usedTopic) >= this.SIMILARITY_THRESHOLD) {
        const lastUsed = this.globalUsedTopics.get(usedTopic);
        if (lastUsed && (Date.now() - lastUsed) < this.TOPIC_COOLDOWN) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * 키워드 추출
   */
  private extractKeywords(topic: string): string[] {
    return topic
      .replace(/[ㅋㅎㅠㅜ!?.,\s]+/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2)
      .filter(word => !['오늘', '요즘', '진짜', '완전', '너무', '정말', '그냥', '좀', '약간', '이번', '다음'].includes(word))
      .slice(0, 5);
  }
  
  /**
   * 주제 유사도 계산
   */
  private calculateSimilarity(topic1: string, topic2: string): number {
    const keywords1 = this.extractKeywords(topic1);
    const keywords2 = this.extractKeywords(topic2);
    
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    
    const commonKeywords = keywords1.filter(k => keywords2.includes(k));
    return (commonKeywords.length * 2) / (keywords1.length + keywords2.length);
  }
  
  /**
   * 최근 1시간 내 카테고리 사용 횟수
   */
  private getCategoryUsageInLastHour(category: string): number {
    const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
    const categoryKey = `${category}_${currentHour}`;
    return this.categoryUsageCount.get(categoryKey) || 0;
  }
  
  /**
   * 오래된 기록 정리
   */
  private cleanupOldRecords(): void {
    const now = Date.now();
    const cutoff = now - this.TOPIC_COOLDOWN;
    
    // 오래된 주제 기록 제거
    for (const [topic, timestamp] of this.globalUsedTopics.entries()) {
      if (timestamp < cutoff) {
        this.globalUsedTopics.delete(topic);
      }
    }
    
    // 오래된 카테고리 기록 제거 (24시간 이상)
    const hourCutoff = Math.floor((now - 24 * 60 * 60 * 1000) / (60 * 60 * 1000));
    for (const [key] of this.categoryUsageCount.entries()) {
      const hour = parseInt(key.split('_').pop() || '0');
      if (hour < hourCutoff) {
        this.categoryUsageCount.delete(key);
      }
    }
    
    // 주제 변형 기록도 정리
    for (const [baseKey, variations] of this.topicVariations.entries()) {
      const validVariations = new Set<string>();
      for (const variation of variations) {
        const lastUsed = this.globalUsedTopics.get(variation);
        if (lastUsed && lastUsed >= cutoff) {
          validVariations.add(variation);
        }
      }
      
      if (validVariations.size === 0) {
        this.topicVariations.delete(baseKey);
      } else {
        this.topicVariations.set(baseKey, validVariations);
      }
    }
    
    console.log(`🧹 [DIVERSITY] 정리 완료: 주제 ${this.globalUsedTopics.size}개, 변형 ${this.topicVariations.size}개`);
  }
  
  /**
   * 통계 조회
   */
  public getStats(): {
    totalUsedTopics: number;
    topicVariations: number;
    categoryUsage: Record<string, number>;
    oldestUsage: Date | null;
    newestUsage: Date | null;
  } {
    const timestamps = Array.from(this.globalUsedTopics.values());
    
    return {
      totalUsedTopics: this.globalUsedTopics.size,
      topicVariations: this.topicVariations.size,
      categoryUsage: Object.fromEntries(this.categoryUsageCount),
      oldestUsage: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      newestUsage: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null
    };
  }
  
  /**
   * 모든 기록 초기화
   */
  public clearAllRecords(): void {
    this.globalUsedTopics.clear();
    this.topicVariations.clear();
    this.categoryUsageCount.clear();
    console.log('🧹 [DIVERSITY] 모든 주제 사용 기록이 초기화되었습니다.');
  }
  
  /**
   * 대량 생성을 위한 임시 완화 모드
   */
  public enableBulkMode(): void {
    // 대량 생성 시 일시적으로 제한 완화
    const bulkCooldown = 30 * 60 * 1000; // 30분으로 단축
    const now = Date.now();
    
    // 30분 이상 된 기록들을 임시로 제거
    for (const [topic, timestamp] of this.globalUsedTopics.entries()) {
      if (now - timestamp > bulkCooldown) {
        this.globalUsedTopics.delete(topic);
      }
    }
    
    console.log('🚀 [DIVERSITY] 대량 생성 모드 활성화 - 제한 완화');
  }
}

export default TopicDiversityManager;
