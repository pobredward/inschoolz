'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/types";
import { toast } from "sonner";
import { updateUserProfile, updateProfileImage } from '@/lib/api/users';
import { getAllRegions, getDistrictsByRegion } from '@/lib/api/schools';
import { useAuth } from "@/providers/AuthProvider";
import { useQuestTracker } from "@/hooks/useQuestTracker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageCropModal from "@/components/ui/image-crop-modal";
import { Camera, Loader2, ArrowLeft } from 'lucide-react';

// 휴대폰 번호 포맷팅 함수
const formatPhoneNumber = (value: string): string => {
  if (!value) return '';
  
  // +82 형식 처리
  if (value.startsWith('+82')) {
    const numbers = value.replace(/\D/g, '');
    const koreanNumber = numbers.slice(2); // +82 제거
    // 첫 번째 0이 없으면 추가
    const normalizedNumber = koreanNumber.startsWith('1') ? `0${koreanNumber}` : koreanNumber;
    
    if (normalizedNumber.length === 11) {
      return `${normalizedNumber.slice(0, 3)}-${normalizedNumber.slice(3, 7)}-${normalizedNumber.slice(7)}`;
    }
  }
  
  // 일반적인 숫자만 포함된 경우
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 7) {
    return numbers.replace(/(\d{3})(\d{1,4})/, '$1-$2');
  } else if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else {
    return numbers.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
  }
};

interface ProfileEditClientProps {
  userData: User;
}

export default function ProfileEditClient({ userData }: ProfileEditClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { trackNicknameChange } = useQuestTracker();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  
  // 이미지 크롭 관련 상태
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');
  
  const [formData, setFormData] = useState({
    userName: userData.profile?.userName || '',
    realName: userData.profile?.realName || '',
    birthYear: userData.profile?.birthYear?.toString() || '',
    birthMonth: userData.profile?.birthMonth?.toString() || '',
    birthDay: userData.profile?.birthDay?.toString() || '',
    gender: userData.profile?.gender || '',
    phoneNumber: userData.profile?.phoneNumber || '',
    profileImageUrl: userData.profile?.profileImageUrl || '',
    sido: userData.regions?.sido || '',
    sigungu: userData.regions?.sigungu || '',
    address: userData.regions?.address || '',
  });

  // 시/도 목록 불러오기
  useEffect(() => {
    const fetchProvinces = async () => {
      setRegionsLoading(true);
      try {
        const regions = await getAllRegions();
        setProvinces(regions);
      } catch (error) {
        console.error('시/도 목록 불러오기 오류:', error);
      } finally {
        setRegionsLoading(false);
      }
    };

    fetchProvinces();
  }, []);

  // 시/군/구 목록 불러오기
  useEffect(() => {
    const fetchCities = async () => {
      if (!formData.sido) {
        setCities([]);
        return;
      }

      setRegionsLoading(true);
      try {
        const districts = await getDistrictsByRegion(formData.sido);
        setCities(districts);
      } catch (error) {
        console.error('시/군/구 목록 불러오기 오류:', error);
      } finally {
        setRegionsLoading(false);
      }
    };

    fetchCities();
  }, [formData.sido]);

  // 폼 입력값 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Select 컴포넌트 값 변경 핸들러
  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // 시/도 변경 시 시/군/구 초기화
      if (name === 'sido') {
        newData.sigungu = '';
      }
      
      return newData;
    });
  };

  // 파일 업로드 버튼 클릭 핸들러
  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  // 뒤로가기 핸들러
  const handleGoBack = () => {
    router.back();
  };

  // 파일 변경 핸들러 (크롭 모달 열기)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일인지 확인
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 파일 크기 체크 (10MB 제한)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    // FileReader로 이미지 미리보기 생성
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageSrc = event.target?.result as string;
      setSelectedImageSrc(imageSrc);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);

    // 파일 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 크롭된 이미지 업로드 처리
  const handleCropComplete = async (croppedImageFile: File) => {
    if (!user) return;

    // 크롭된 이미지 미리보기 생성
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(croppedImageFile);

    // 이미지 업로드 처리
    setUploadingImage(true);
    try {
      const result = await updateProfileImage(user.uid, croppedImageFile);
      if (result.success && result.url) {
        setFormData(prev => ({ 
          ...prev, 
          profileImageUrl: result.url || prev.profileImageUrl 
        }));
        toast.success('프로필 이미지가 업데이트되었습니다.');
      } else {
        toast.error(result.error || '이미지 업로드에 실패했습니다.');
        // 미리보기 제거
        setImagePreview(null);
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      toast.error('이미지 업로드 중 오류가 발생했습니다.');
      // 미리보기 제거
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // 크롭 모달 닫기
  const handleCropModalClose = () => {
    setCropModalOpen(false);
    setSelectedImageSrc('');
  };

  // 프로필 저장 함수
  const handleSaveProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 유효성 검사
      if (!formData.userName) {
        toast.error('닉네임은 필수입니다.');
        setLoading(false);
        return;
      }

      // 닉네임 변경 여부 확인 (기존 닉네임과 다르거나, 기존에 없었던 경우)
      const originalUserName = userData.profile?.userName || '';
      const isNicknameChanged = formData.userName !== originalUserName;

      // 생년월일 숫자 변환
      const birthYear = formData.birthYear ? parseInt(formData.birthYear) : undefined;
      const birthMonth = formData.birthMonth ? parseInt(formData.birthMonth) : undefined;
      const birthDay = formData.birthDay ? parseInt(formData.birthDay) : undefined;

      // 프로필 업데이트
      await updateUserProfile(user.uid, {
        userName: formData.userName,
        realName: formData.realName || undefined,
        birthYear,
        birthMonth, 
        birthDay,
        gender: formData.gender || undefined,
        phoneNumber: formData.phoneNumber || undefined,
        sido: formData.sido || undefined,
        sigungu: formData.sigungu || undefined,
        address: formData.address || undefined,
      });
      
      // 퀘스트 트래킹: 닉네임 변경/설정 (1단계)
      // 닉네임이 변경되었거나, 닉네임이 있는 상태에서 저장하면 트래킹
      // (신규 유저: 닉네임 처음 설정, 기존 유저: 닉네임 변경)
      if (isNicknameChanged || formData.userName.trim().length > 0) {
        console.log('📍 퀘스트 트래킹: 닉네임 변경/설정', { 
          isNicknameChanged, 
          userName: formData.userName,
          originalUserName 
        });
        await trackNicknameChange();
      }
      
      toast.success('프로필이 성공적으로 업데이트되었습니다.');
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      toast.error('프로필 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* 헤더 섹션 */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleGoBack}
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold">프로필 수정</h1>
      </div>
      
      {/* 프로필 이미지 섹션 */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm">
        <CardHeader className="px-4 sm:px-6 pb-4 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">프로필 사진</CardTitle>
          <CardDescription className="text-sm">프로필 사진을 변경할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex flex-col items-center gap-3">
            <div className="relative group">
              <Avatar className="w-24 h-24 sm:w-32 sm:h-32">
                <AvatarImage 
                  src={imagePreview || formData.profileImageUrl} 
                  alt={formData.userName} 
                />
                <AvatarFallback className="text-lg sm:text-xl">
                  {formData.userName?.substring(0, 2) || 'ME'}
                </AvatarFallback>
              </Avatar>
              
              <button
                type="button"
                onClick={handleUploadButtonClick}
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 active:opacity-100"
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                )}
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              이미지를 클릭하여 프로필 사진 변경
            </p>
          </div>
        </CardContent>
      </Card>
      
      {/* 기본 정보 섹션 */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm">
        <CardHeader className="px-4 sm:px-6 pb-4 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">기본 정보</CardTitle>
          <CardDescription className="text-sm">프로필 기본 정보를 수정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-5">
          {/* 닉네임과 실명 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userName" className="text-sm font-medium flex items-center gap-1">
                닉네임 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="userName"
                name="userName"
                value={formData.userName}
                onChange={handleChange}
                placeholder="닉네임을 입력하세요"
                className="h-11 sm:h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="realName" className="text-sm font-medium">실명</Label>
              <Input
                id="realName"
                name="realName"
                value={formData.realName}
                onChange={handleChange}
                placeholder="실명을 입력하세요"
                className="h-11 sm:h-10"
              />
            </div>
          </div>
          
          {/* 성별과 전화번호 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-sm font-medium">성별</Label>
              <Select value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="성별 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">남성</SelectItem>
                  <SelectItem value="female">여성</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber" className="text-sm font-medium">전화번호</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                type="text"
                inputMode="numeric"
                value={formatPhoneNumber(formData.phoneNumber)}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 11) {
                    handleChange({
                      target: { name: 'phoneNumber', value }
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
                placeholder="010-1234-5678"
                maxLength={13}
                className="h-11 sm:h-10"
              />
            </div>
          </div>
          
          {/* 생년월일 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">생년월일</Label>
            <div className="grid grid-cols-3 gap-3">
              <Input
                id="birthYear"
                name="birthYear"
                type="text"
                inputMode="numeric"
                value={formData.birthYear}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 4) {
                    handleChange({
                      target: { name: 'birthYear', value }
                    } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
                placeholder="YYYY"
                maxLength={4}
                className="h-11 sm:h-10"
              />
              
              <Select value={formData.birthMonth} onValueChange={(value) => handleSelectChange('birthMonth', value)}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="월" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <SelectItem key={month} value={month.toString()}>
                      {month}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={formData.birthDay} onValueChange={(value) => handleSelectChange('birthDay', value)}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="일" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <SelectItem key={day} value={day.toString()}>
                      {day}일
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 지역 정보 섹션 */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm">
        <CardHeader className="px-4 sm:px-6 pb-4 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">지역 정보</CardTitle>
          <CardDescription className="text-sm">거주 지역 정보를 수정합니다.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sido" className="text-sm font-medium">시/도</Label>
              <Select 
                value={formData.sido} 
                onValueChange={(value) => handleSelectChange('sido', value)}
                disabled={regionsLoading}
              >
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="시/도 선택" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sigungu" className="text-sm font-medium">시/군/구</Label>
              <Select 
                value={formData.sigungu} 
                onValueChange={(value) => handleSelectChange('sigungu', value)}
                disabled={regionsLoading || !formData.sido}
              >
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="시/군/구 선택" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium">상세주소</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="상세주소를 입력하세요 (선택사항)"
              className="h-11 sm:h-10"
            />
          </div>
        </CardContent>
      </Card>
      
      {/* 저장 버튼 */}
      <div className="sticky bottom-4 sm:static sm:bottom-auto flex justify-end pt-4">
        <Button 
          onClick={handleSaveProfile} 
          disabled={loading}
          className="w-full sm:w-auto h-12 sm:h-10 px-8 font-medium shadow-lg sm:shadow-sm"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            '저장하기'
          )}
        </Button>
      </div>

      {/* 이미지 크롭 모달 */}
      <ImageCropModal
        open={cropModalOpen}
        onClose={handleCropModalClose}
        imageSrc={selectedImageSrc}
        onCropComplete={handleCropComplete}
        title="프로필 사진 편집"
      />
    </div>
  );
} 