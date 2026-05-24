'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProvider';

interface RegionSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface Region {
  id: string;
  name: string;
  sigungu: string[];
}

export function RegionSetupModal({ isOpen, onClose, onComplete }: RegionSetupModalProps) {
  const { user, refreshUser } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedSido, setSelectedSido] = useState('');
  const [selectedSigungu, setSelectedSigungu] = useState('');
  const [sigunguList, setSigunguList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);

  // 지역 데이터 로드
  useEffect(() => {
    const loadRegions = async () => {
      try {
        const regionsCol = collection(db, 'regions');
        const regionSnapshot = await getDocs(regionsCol);
        const regionData = regionSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          sigungu: doc.data().sigungu || []
        }));
        setRegions(regionData);
      } catch (error) {
        console.error('지역 데이터 로드 실패:', error);
        toast.error('지역 정보를 불러오는데 실패했습니다.');
      } finally {
        setIsLoadingRegions(false);
      }
    };

    if (isOpen) {
      loadRegions();
    }
  }, [isOpen]);

  // 시도 선택 시 시군구 업데이트
  useEffect(() => {
    if (selectedSido) {
      const selectedRegion = regions.find(region => region.name === selectedSido);
      if (selectedRegion) {
        setSigunguList(selectedRegion.sigungu);
      } else {
        setSigunguList([]);
      }
      setSelectedSigungu(''); // 시군구 선택 초기화
    }
  }, [selectedSido, regions]);

  const handleSubmit = async () => {
    if (!selectedSido || !selectedSigungu) {
      toast.error('시/도와 시/군/구를 모두 선택해주세요.');
      return;
    }

    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      setIsLoading(true);
      
      // Firestore에서 사용자 지역 정보 업데이트
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        'regions.sido': selectedSido,
        'regions.sigungu': selectedSigungu,
        'regions.address': `${selectedSido} ${selectedSigungu}`,
        updatedAt: new Date()
      });

      await refreshUser();
      
      toast.success('지역이 설정되었습니다!');
      onComplete();
      onClose();
    } catch (error) {
      console.error('지역 설정 실패:', error);
      toast.error('지역 설정에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            지역 설정
          </DialogTitle>
          <DialogDescription>
            지역 커뮤니티를 이용하기 위해 거주 지역을 설정해주세요.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">시/도</label>
            <Select value={selectedSido} onValueChange={setSelectedSido} disabled={isLoadingRegions}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingRegions ? "지역 정보 로딩 중..." : "시/도를 선택하세요"} />
              </SelectTrigger>
              <SelectContent>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.name}>
                    {region.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">시/군/구</label>
            <Select value={selectedSigungu} onValueChange={setSelectedSigungu} disabled={!selectedSido}>
              <SelectTrigger>
                <SelectValue placeholder={!selectedSido ? "먼저 시/도를 선택하세요" : "시/군/구를 선택하세요"} />
              </SelectTrigger>
              <SelectContent>
                {sigunguList.map((sigungu) => (
                  <SelectItem key={sigungu} value={sigungu}>
                    {sigungu}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={isLoading || !selectedSido || !selectedSigungu}
            >
              {isLoading ? '설정 중...' : '설정 완료'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
