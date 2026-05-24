'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  collection, query, where, getDocs, 
  doc, setDoc, Timestamp, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { School } from '@/types';

export default function VerifySchoolPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 인증되지 않은 사용자 리디렉션
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // 학교 검색
  const searchSchools = async () => {
    if (searchTerm.length < 2) {
      setError('검색어는 최소 2자 이상 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const schoolsRef = collection(db, 'schools');
      const q = query(
        schoolsRef,
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff')
      );
      const querySnapshot = await getDocs(q);
      
      const schools: School[] = [];
      querySnapshot.forEach((doc) => {
        schools.push({ id: doc.id, ...doc.data() } as School);
      });

      setSearchResults(schools);
      
      if (schools.length === 0) {
        setError('검색 결과가 없습니다. 다른 키워드로 검색해 보세요.');
      }
    } catch (error) {
      console.error('학교 검색 오류:', error);
      setError('학교 검색 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 파일 변경 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setProofImage(file);
  };

  // 인증 요청 제출
  const submitVerification = async () => {
    if (!user) {
      setError('로그인이 필요합니다.');
      return;
    }

    if (!selectedSchool) {
      setError('학교를 선택해주세요.');
      return;
    }

    if (!proofImage) {
      setError('재학/재직 증명 사진을 업로드해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 이미지 업로드
              const storageRef = ref(storage, `verification/${user.uid}/${Date.now()}_${proofImage.name}`);
      const uploadResult = await uploadBytes(storageRef, proofImage);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      // 인증 요청 문서 생성
      const verificationId = doc(collection(db, 'verificationRequests')).id;
      await setDoc(doc(db, 'verificationRequests', verificationId), {
        id: verificationId,
        userId: user.uid,
        schoolId: selectedSchool.id,
        status: 'pending',
        proofImageUrl: downloadURL,
                  createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
      });

      router.push('/dashboard?verification=requested');
    } catch (error) {
      console.error('인증 요청 오류:', error);
      setError('인증 요청 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b py-4">
        <div className="container flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/dashboard')}
          >
            ← 대시보드로 돌아가기
          </Button>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">학교 인증</h2>
          <p className="text-muted-foreground mt-2">
            학교 구성원임을 인증하면 더 많은 기능을 이용할 수 있습니다.
          </p>
        </div>

        <div className="max-w-2xl space-y-8">
          {/* 학교 검색 */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">1. 학교 검색</h3>
            <div className="flex gap-2">
              <Input
                placeholder="학교 이름 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button onClick={searchSchools} disabled={isLoading}>
                {isLoading ? '검색 중...' : '검색'}
              </Button>
            </div>

            {/* 검색 결과 */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium">검색 결과</h4>
                <div className="max-h-60 overflow-y-auto rounded-md border">
                  {searchResults.map((school) => (
                    <div
                      key={school.id}
                      className={`cursor-pointer border-b p-3 hover:bg-accent ${
                        selectedSchool?.id === school.id
                          ? 'bg-accent'
                          : ''
                      }`}
                      onClick={() => setSelectedSchool(school)}
                    >
                      <p className="font-medium">{school.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {school.address}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 인증 증명 업로드 */}
          {selectedSchool && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">2. 인증 증명 업로드</h3>
              <p className="text-sm text-muted-foreground">
                학생증, 재학증명서, 재직증명서 등 학교 구성원임을 증명할 수 있는 사진을 업로드해주세요.
                개인정보는 인증 이외의 목적으로 사용되지 않습니다.
              </p>

              <div className="space-y-2">
                <Label htmlFor="proof">증명 사진 업로드</Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* 인증 요청 버튼 */}
          {selectedSchool && proofImage && (
            <div className="pt-4">
              <Button
                className="w-full"
                onClick={submitVerification}
                disabled={isLoading}
              >
                {isLoading ? '처리 중...' : '인증 요청하기'}
              </Button>
            </div>
          )}

          {/* 오류 메시지 */}
          {error && (
            <div className="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 