import { NextRequest, NextResponse } from 'next/server';

// 메모리 캐시 (프로덕션에서는 Redis 사용 권장)
interface CacheItem {
  data: BotAccount[];
  timestamp: number;
  total: number;
}

interface BotAccount {
  uid: string;
  nickname: string;
  email: string;
  schoolId: string;
  schoolName: string;
  schoolType: string;
  profileImageUrl: string;
  stats: {
    level: number;
    totalExperience: number;
    postCount: number;
    commentCount: number;
  };
  createdAt: string;
}

const cache = new Map<string, CacheItem>();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 닉네임용 검색 토큰 생성 함수 (한글 지원)
 */
function generateNicknameTokens(nickname: string): string[] {
  if (!nickname) return [];
  
  const tokens = new Set<string>();
  const cleanText = nickname.toLowerCase().trim();
  
  // 전체 닉네임
  tokens.add(cleanText);
  
  // 모든 부분 문자열 생성 (1글자부터 전체까지)
  for (let i = 0; i < cleanText.length; i++) {
    for (let j = i + 1; j <= cleanText.length; j++) {
      const substring = cleanText.substring(i, j);
      if (substring.length >= 1 && substring.length <= 8) { // 1-8글자만
        tokens.add(substring);
      }
    }
  }
  
  return Array.from(tokens);
}

/**
 * 학교명용 검색 토큰 생성 함수 (효율적인 부분 매칭)
 */
function generateSchoolTokens(schoolName: string): string[] {
  if (!schoolName) return [];
  
  const tokens = new Set<string>();
  const cleanText = schoolName.toLowerCase().trim();
  
  // 전체 학교명
  tokens.add(cleanText);
  
  // 의미있는 부분 문자열만 생성 (2글자 이상, 연속된 부분)
  for (let i = 0; i < cleanText.length; i++) {
    for (let j = i + 2; j <= Math.min(i + 5, cleanText.length); j++) { // 2-4글자만
      const substring = cleanText.substring(i, j);
      tokens.add(substring);
    }
  }
  
  return Array.from(tokens);
}

/**
 * 검색 관련성 점수 계산 함수
 */
function getRelevanceScore(bot: BotAccount, searchTerm: string): number {
  let score = 0;
  const nickname = (bot.nickname || '').toLowerCase();
  const schoolName = (bot.schoolName || '').toLowerCase();
  
  // 정확한 매치에 높은 점수
  if (nickname === searchTerm) score += 100;
  if (schoolName === searchTerm) score += 80;
  
  // 시작 부분 매치에 중간 점수
  if (nickname.startsWith(searchTerm)) score += 50;
  if (schoolName.startsWith(searchTerm)) score += 30;
  
  // 포함 매치에 낮은 점수
  if (nickname.includes(searchTerm)) score += 10;
  if (schoolName.includes(searchTerm)) score += 5;
  
  return score;
}

/**
 * Firebase Admin SDK 동적 import 및 초기화
 */
async function getFirebaseAdmin() {
  const admin = await import('firebase-admin');
  
  if (admin.default.apps.length > 0) {
    return admin.default;
  }

  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL?.replace('@', '%40')}`,
    universe_domain: 'googleapis.com'
  };

  admin.default.initializeApp({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    credential: admin.default.credential.cert(serviceAccount as any),
    databaseURL: 'https://inschoolz-default-rtdb.asia-southeast1.firebasedatabase.app'
  });

  return admin.default;
}

/**
 * 최적화된 봇 계정 조회 함수 (페이지네이션 지원)
 */
async function getBotAccountsOptimized(limit: number = 50, schoolType?: string, search?: string, page: number = 1) {
  const app = await getFirebaseAdmin();
  const db = app.firestore();
  
  console.log(`🔍 봇 계정 조회 시작 (limit: ${limit}, page: ${page}, schoolType: ${schoolType || 'all'})`);
  
  // 페이지네이션을 위한 offset 계산
  const offset = (page - 1) * limit;
  
  // 쿼리 빌더 - 인덱스 최적화를 위해 orderBy 추가
  let query = db.collection('users')
    .where('fake', '==', true);
  
  // 학교 유형 필터링 (선택적)
  if (schoolType && schoolType !== 'all') {
    query = query.where('schoolType', '==', schoolType);
  }
  
  const startTime = Date.now();
  let botsSnapshot;
  let totalCount = 0;
  let hasNextPage = false;
  
  // 검색이 있는 경우: 토큰 기반 array-contains-any 쿼리 사용
  if (search && search.trim()) {
    console.log('🔍 검색 모드: 토큰 기반 array-contains-any 쿼리');
    const searchLower = search.toLowerCase().trim();
    
    // 검색어에서 토큰 생성 (닉네임 방식 사용)
    const searchTokens = generateNicknameTokens(searchLower);
    console.log(`🔤 검색 토큰 생성: ${searchTokens.slice(0, 5).join(', ')}${searchTokens.length > 5 ? '...' : ''} (총 ${searchTokens.length}개)`);
    
    // 가장 효과적인 토큰들만 선택 (긴 토큰 우선, 최대 10개)
    const effectiveTokens = searchTokens
      .filter(token => token.length >= 2) // 2글자 이상만
      .sort((a, b) => b.length - a.length) // 긴 토큰 먼저
      .slice(0, 10); // 최대 10개 (Firestore array-contains-any 제한)
    
    if (effectiveTokens.length === 0) {
      // 토큰이 없으면 빈 결과 반환
      botsSnapshot = { docs: [], size: 0 };
    } else {
      // searchTokens 필드에서 토큰 검색
      query = query
        .where('searchTokens', 'array-contains-any', effectiveTokens)
        .limit(limit * 2); // 검색 시 더 많이 가져와서 필터링
      
      botsSnapshot = await query.get();
      console.log(`🔍 토큰 검색 완료: ${effectiveTokens.length}개 토큰으로 ${botsSnapshot.size}개 문서 조회`);
    }
  } else {
    // 일반 조회: 페이지네이션 적용
    query = query.orderBy('createdAt', 'desc');
    
    // 전체 개수 조회 (페이지네이션 정보를 위해)
    const totalQuery = await query.get();
    totalCount = totalQuery.size;
    
    // offset과 limit 적용
    if (offset > 0) {
      // offset이 있는 경우 startAfter 사용 (더 효율적)
      const offsetSnapshot = await query.limit(offset).get();
      if (offsetSnapshot.docs.length > 0) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }
    
    botsSnapshot = await query.limit(limit).get();
    
    // 다음 페이지 존재 여부 확인
    hasNextPage = (offset + botsSnapshot.size) < totalCount;
    
    console.log(`📊 페이지네이션 정보: ${offset + 1}-${offset + botsSnapshot.size} / ${totalCount}, 다음 페이지: ${hasNextPage}`);
  }
  
  const queryTime = Date.now() - startTime;
  
  console.log(`⚡ Firestore 쿼리 완료: ${queryTime}ms, ${botsSnapshot.size}개 문서`);

  const botAccounts: BotAccount[] = [];
  
  botsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    
    // 봇 계정 데이터 구성 (필수 필드만)
    const botAccount = {
      uid: data.uid || doc.id,
      nickname: data.profile?.userName || data.nickname || '익명',
      email: data.email || '',
      schoolId: data.schoolId || '',
      schoolName: data.schoolName || '알 수 없는 학교',
      schoolType: data.schoolType || 'middle',
      profileImageUrl: data.profile?.profileImageUrl || '',
      stats: {
        level: data.stats?.level || 1,
        totalExperience: data.stats?.totalExperience || 0,
        postCount: data.stats?.postCount || 0,
        commentCount: data.stats?.commentCount || 0
      },
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    };
    
    botAccounts.push(botAccount);
  });

  // 추가 클라이언트 사이드 필터링 (contains 검색을 위해)
  let filteredBots = botAccounts;
  if (search && search.trim()) {
    const searchLower = search.toLowerCase();
    
    // 토큰 검색 결과를 추가로 필터링 (더 정확한 매칭)
    filteredBots = botAccounts.filter(bot => {
      const nickname = (bot.nickname || '').toLowerCase();
      const schoolName = (bot.schoolName || '').toLowerCase();
      
      return nickname.includes(searchLower) || 
             schoolName.includes(searchLower);
    });
    
    console.log(`🔍 최종 필터링 완료: Firestore ${botAccounts.length}개 → 최종 ${filteredBots.length}개 결과`);
    
    // 검색 결과 정렬 (관련성 순)
    filteredBots.sort((a, b) => {
      const aScore = getRelevanceScore(a, searchLower);
      const bScore = getRelevanceScore(b, searchLower);
      return bScore - aScore; // 높은 점수 먼저
    });
    
    // 검색 결과도 너무 많으면 제한 (성능상 이유)
    if (filteredBots.length > limit) {
      filteredBots = filteredBots.slice(0, limit);
      console.log(`📄 검색 결과 페이지네이션: ${limit}개로 제한`);
    }
  }
  
  // 페이지네이션 정보 계산
  let finalTotalCount = filteredBots.length;
  let hasNextPageResult = false;
  
  if (!search) {
    // 검색이 아닌 경우 전체 개수와 다음 페이지 정보 사용
    finalTotalCount = totalCount; // 전체 봇 개수
    hasNextPageResult = hasNextPage;
  }
  
  return {
    data: filteredBots,
    total: finalTotalCount,
    totalScanned: botAccounts.length, // 전체 스캔한 봇 수
    hasNextPage: hasNextPageResult,
    currentPage: page,
    pageSize: limit,
    queryTime,
    isSearchMode: !!search
  };
}

/**
 * GET /api/admin/bot-accounts
 * 봇 계정 목록 조회 (최적화된 버전)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const schoolType = searchParams.get('schoolType') || 'all';
    const search = searchParams.get('search') || '';
    const useCache = searchParams.get('cache') !== 'false' && !search && page === 1; // 검색 시나 1페이지가 아닐 때는 캐시 사용 안함
    
    // 캐시 키 생성 (페이지 정보 포함)
    const cacheKey = `bot_accounts_${limit}_${page}_${schoolType}`;
    
    // 캐시 확인 (검색이 없을 때만)
    if (useCache) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('💾 캐시에서 봇 계정 데이터 반환');
        return NextResponse.json({
          success: true,
          data: cached.data,
          total: cached.total,
          lastUpdated: new Date(cached.timestamp).toISOString(),
          source: 'cache',
          note: '캐시된 데이터입니다. 최대 5분 지연될 수 있습니다.'
        });
      }
    }

    // Firebase에서 최신 데이터 조회 (검색 포함, 페이지네이션)
    const result = await getBotAccountsOptimized(limit, schoolType, search, page);
    
    // 캐시에 저장 (검색이 없을 때만)
    if (useCache && !search) {
      cache.set(cacheKey, {
        data: result.data,
        timestamp: Date.now(),
        total: result.total
      });
    }

    console.log(`✅ ${result.data.length}개의 봇 계정 조회 완료 (${result.queryTime}ms)${search ? ` - 검색: "${search}"` : ` - 페이지: ${page}`}`);
    
    const response = NextResponse.json({
      success: true,
      data: result.data,
      total: result.total,
      hasNextPage: result.hasNextPage,
      currentPage: result.currentPage,
      pageSize: result.pageSize,
      totalScanned: result.totalScanned,
      queryTime: result.queryTime,
      lastUpdated: new Date().toISOString(),
      source: search ? 'token_search' : 'firebase_optimized',
      note: search ? `🔍 "${search}" 토큰 검색 결과입니다!` : '🚀 최적화된 쿼리로 조회한 봇 계정 목록입니다!',
      isSearchMode: result.isSearchMode
    });
    
    // 캐시 방지 헤더 추가 (특히 봇 삭제 후 즉시 반영을 위해)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;

  } catch (error) {
    console.error('❌ 봇 계정 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `봇 계정을 조회하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}` 
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/bot-accounts
 * 기존 봇 계정들에 검색 토큰 추가 (마이그레이션)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function PATCH(_request: NextRequest) {
  try {
    const app = await getFirebaseAdmin();
    const db = app.firestore();
    
    console.log('🔄 봇 계정 검색 토큰 마이그레이션 시작');
    
    // 모든 봇 계정 조회
    const botsSnapshot = await db.collection('users')
      .where('fake', '==', true)
      .get();
    
    console.log(`📊 총 ${botsSnapshot.size}개 봇 계정 발견`);
    
    const batch = db.batch();
    let updateCount = 0;
    
    botsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {};
      let needsUpdate = false;
      
      // 1. 검색 토큰 마이그레이션
      if (!data.searchTokens || !Array.isArray(data.searchTokens)) {
        // 검색 토큰 생성
        const allTokens = new Set<string>();
        
        // nickname 토큰 (전체 부분 문자열)
        if (data.profile?.userName) {
          const nicknameTokens = generateNicknameTokens(data.profile.userName);
          nicknameTokens.forEach(token => allTokens.add(token));
        }
        
        // schoolName 토큰 (효율적인 부분 문자열만)
        if (data.schoolName) {
          const schoolTokens = generateSchoolTokens(data.schoolName);
          schoolTokens.forEach(token => allTokens.add(token));
        }
        
        // 토큰 배열로 변환 (최대 50개로 제한)
        const searchTokens = Array.from(allTokens).slice(0, 50);
        updateData.searchTokens = searchTokens;
        needsUpdate = true;
      }
      
      // 2. school 객체 마이그레이션
      if (!data.school && data.schoolId && data.schoolName) {
        updateData.school = {
          id: data.schoolId,
          name: data.schoolName,
          grade: null,
          classNumber: null,
          studentNumber: null,
          isGraduate: false
        };
        needsUpdate = true;
      }
      
      // 업데이트가 필요한 경우에만 배치에 추가
      if (needsUpdate) {
        batch.update(doc.ref, updateData);
        updateCount++;
      }
    });
    
    // 배치 실행
    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ ${updateCount}개 봇 계정 데이터 마이그레이션 완료`);
    }
    
    return NextResponse.json({
      success: true,
      message: `${updateCount}개 봇 계정에 검색 토큰 및 school 객체를 추가했습니다.`,
      totalBots: botsSnapshot.size,
      updatedBots: updateCount,
      skippedBots: botsSnapshot.size - updateCount
    });
    
  } catch (error) {
    console.error('❌ 검색 토큰 마이그레이션 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: `검색 토큰 마이그레이션 중 오류가 발생했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}
