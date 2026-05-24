"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportOptions } from '@/types/admin';
import { Download, FileText, Settings } from 'lucide-react';

interface CSVExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  totalCount: number;
  selectedCount?: number;
}

export function CSVExportDialog({ 
  isOpen, 
  onClose, 
  onExport, 
  totalCount, 
  selectedCount = 0 
}: CSVExportDialogProps) {
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    fields: [],
    filters: {},
    includeStats: true,
    includeSensitiveData: false
  });

  const [selectedFields, setSelectedFields] = useState<string[]>([
    'uid', 'userName', 'email', 'role', 'status', 'schoolName', 'createdAt'
  ]);

  const [exportScope, setExportScope] = useState<'all' | 'selected' | 'filtered'>('filtered');

  // 사용 가능한 필드 정의
  const fieldCategories = {
    basic: {
      title: '기본 정보',
      fields: {
        uid: '사용자 ID',
        userName: '사용자명',
        realName: '실명',
        email: '이메일',
        role: '역할',
        status: '상태'
      }
    },
    school: {
      title: '학교/지역 정보',
      fields: {
        schoolName: '학교명',
        schoolCode: '학교 코드',
        sido: '시/도',
        sigungu: '시/군/구',
        address: '상세 주소'
      }
    },
    profile: {
      title: '프로필 정보',
      fields: {
        gender: '성별',
        birthYear: '출생년도',
        phoneNumber: '전화번호'
      }
    },
    stats: {
      title: '활동 통계',
      fields: {
        level: '레벨',
        currentExp: '현재 경험치',
        totalExperience: '총 경험치',
        postCount: '게시글 수',
        commentCount: '댓글 수',
        likeCount: '좋아요 수',
        streak: '연속 출석'
      }
    },
    warnings: {
      title: '경고/제재 정보',
      fields: {
        warningCount: '경고 횟수',
        suspensionReason: '정지 사유',
        suspendedUntil: '정지 해제일'
      }
    },
    dates: {
      title: '날짜 정보',
      fields: {
        createdAt: '가입일',
        lastLoginAt: '최근 로그인',
        updatedAt: '수정일'
      }
    }
  };

  const handleFieldToggle = (fieldKey: string, checked: boolean) => {
    if (checked) {
      setSelectedFields(prev => [...prev, fieldKey]);
    } else {
      setSelectedFields(prev => prev.filter(field => field !== fieldKey));
    }
  };

  const handleCategoryToggle = (categoryKey: string, checked: boolean) => {
    const categoryFields = Object.keys(fieldCategories[categoryKey as keyof typeof fieldCategories].fields);
    
    if (checked) {
      setSelectedFields(prev => {
        const newFields = [...prev];
        categoryFields.forEach(field => {
          if (!newFields.includes(field)) {
            newFields.push(field);
          }
        });
        return newFields;
      });
    } else {
      setSelectedFields(prev => prev.filter(field => !categoryFields.includes(field)));
    }
  };

  const isCategorySelected = (categoryKey: string): boolean => {
    const categoryFields = Object.keys(fieldCategories[categoryKey as keyof typeof fieldCategories].fields);
    return categoryFields.every(field => selectedFields.includes(field));
  };

  const isCategoryPartiallySelected = (categoryKey: string): boolean => {
    const categoryFields = Object.keys(fieldCategories[categoryKey as keyof typeof fieldCategories].fields);
    const selectedCount = categoryFields.filter(field => selectedFields.includes(field)).length;
    return selectedCount > 0 && selectedCount < categoryFields.length;
  };

  const handleExport = () => {
    const options: ExportOptions = {
      ...exportOptions,
      fields: selectedFields
    };
    
    onExport(options);
    onClose();
  };

  const getExportCount = () => {
    switch (exportScope) {
      case 'selected':
        return selectedCount;
      case 'all':
        return totalCount;
      case 'filtered':
      default:
        return totalCount; // 현재 필터링된 결과 수
    }
  };

  const resetToDefaults = () => {
    setSelectedFields(['uid', 'userName', 'email', 'role', 'status', 'schoolName', 'createdAt']);
    setExportOptions({
      format: 'csv',
      fields: [],
      filters: {},
      includeStats: true,
      includeSensitiveData: false
    });
    setExportScope('filtered');
  };

  const selectAllFields = () => {
    const allFields = Object.values(fieldCategories).flatMap(category => 
      Object.keys(category.fields)
    );
    setSelectedFields(allFields);
  };

  const selectNone = () => {
    setSelectedFields([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            CSV 내보내기 설정
          </DialogTitle>
          <DialogDescription>
            내보낼 데이터의 범위와 필드를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* 내보내기 범위 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                내보내기 범위
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scope-filtered"
                  name="exportScope"
                  checked={exportScope === 'filtered'}
                  onChange={() => setExportScope('filtered')}
                  className="w-4 h-4"
                />
                <Label htmlFor="scope-filtered" className="flex-1">
                  현재 필터 결과 ({totalCount}명)
                </Label>
              </div>
              
              {selectedCount > 0 && (
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="scope-selected"
                    name="exportScope"
                    checked={exportScope === 'selected'}
                    onChange={() => setExportScope('selected')}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="scope-selected" className="flex-1">
                    선택된 사용자 ({selectedCount}명)
                  </Label>
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scope-all"
                  name="exportScope"
                  checked={exportScope === 'all'}
                  onChange={() => setExportScope('all')}
                  className="w-4 h-4"
                />
                <Label htmlFor="scope-all" className="flex-1">
                  전체 사용자 (모든 필터 무시)
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* 내보내기 옵션 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                내보내기 옵션
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-stats"
                    checked={exportOptions.includeStats}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeStats: checked as boolean }))
                    }
                  />
                  <Label htmlFor="include-stats">활동 통계 포함</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-sensitive"
                    checked={exportOptions.includeSensitiveData}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeSensitiveData: checked as boolean }))
                    }
                  />
                  <Label htmlFor="include-sensitive">민감 정보 포함</Label>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                * 민감 정보: 이메일, 실명, 전화번호, 상세 주소
              </div>
            </CardContent>
          </Card>

          {/* 필드 선택 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">필드 선택 ({selectedFields.length}개 선택됨)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllFields}>
                  전체 선택
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  전체 해제
                </Button>
                <Button variant="outline" size="sm" onClick={resetToDefaults}>
                  기본값으로
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(fieldCategories).map(([categoryKey, category]) => (
                <div key={categoryKey} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${categoryKey}`}
                      checked={isCategorySelected(categoryKey)}
                      onCheckedChange={(checked) => handleCategoryToggle(categoryKey, checked as boolean)}
                      className={isCategoryPartiallySelected(categoryKey) ? 'data-[state=checked]:bg-gray-400' : ''}
                    />
                    <Label htmlFor={`category-${categoryKey}`} className="font-medium">
                      {category.title}
                    </Label>
                  </div>
                  
                  <div className="ml-6 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(category.fields).map(([fieldKey, fieldName]) => (
                      <div key={fieldKey} className="flex items-center space-x-2">
                        <Checkbox
                          id={`field-${fieldKey}`}
                          checked={selectedFields.includes(fieldKey)}
                          onCheckedChange={(checked) => handleFieldToggle(fieldKey, checked as boolean)}
                        />
                        <Label htmlFor={`field-${fieldKey}`} className="text-sm">
                          {fieldName}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-gray-600">
              {getExportCount()}명의 사용자, {selectedFields.length}개 필드
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                취소
              </Button>
              <Button 
                onClick={handleExport}
                disabled={selectedFields.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                내보내기
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 