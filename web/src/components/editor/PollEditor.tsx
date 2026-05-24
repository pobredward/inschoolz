'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlusCircle, Trash2, ImagePlus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Timestamp } from 'firebase/firestore'
import { useState, useRef } from 'react'
import Image from 'next/image'
import ImageCropModal from '@/components/ui/image-crop-modal'

export interface PollOption {
  id: string
  text: string
  imageUrl?: string
}

export interface PollData {
  question: string
  options: PollOption[]
}

interface PollEditorProps {
  pollData: PollData
  onChange: (data: PollData) => void
  onImageUpload?: (file: File) => Promise<string>
}

export default function PollEditor({ pollData, onChange, onImageUpload }: PollEditorProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploadingOptionId, setUploadingOptionId] = useState<string | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [currentOptionId, setCurrentOptionId] = useState<string | null>(null)

  // 새 옵션 추가
  const handleAddOption = () => {
    const newOption: PollOption = {
      id: `option-${Date.now()}`,
      text: ''
    }
    
    onChange({
      ...pollData,
      options: [...pollData.options, newOption]
    })
  }
  
  // 옵션 제거
  const handleRemoveOption = (id: string) => {
    onChange({
      ...pollData,
      options: pollData.options.filter(option => option.id !== id)
    })
  }
  
  // 질문 변경
  const handleQuestionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...pollData,
      question: e.target.value
    })
  }
  
  // 옵션 텍스트 변경
  const handleOptionChange = (id: string, text: string) => {
    onChange({
      ...pollData,
      options: pollData.options.map(option => 
        option.id === id ? { ...option, text } : option
      )
    })
  }

  // 옵션 이미지 업로드
  const handleImageUpload = async (optionId: string, file: File) => {
    if (!onImageUpload) return

    try {
      setUploadingOptionId(optionId)
      const imageUrl = await onImageUpload(file)
      
      onChange({
        ...pollData,
        options: pollData.options.map(option => 
          option.id === optionId ? { ...option, imageUrl } : option
        )
      })
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
    } finally {
      setUploadingOptionId(null)
    }
  }

  // 옵션 이미지 제거
  const handleImageRemove = (optionId: string) => {
    onChange({
      ...pollData,
      options: pollData.options.map(option => {
        if (option.id === optionId) {
          const { imageUrl, ...optionWithoutImage } = option
          return optionWithoutImage
        }
        return option
      })
    })
  }

  // 파일 선택 핸들러
  const handleFileSelect = (optionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 이미지 파일인지 확인
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드할 수 있습니다.')
        return
      }
      
      // 파일 크기 확인 (5MB 제한)
      if (file.size > 5 * 1024 * 1024) {
        alert('파일 크기는 5MB 이하여야 합니다.')
        return
      }

      // 이미지를 Data URL로 변환하여 크롭 모달에 전달
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result as string)
          setCurrentOptionId(optionId)
          setCropModalOpen(true)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // 크롭 완료 핸들러
  const handleCropComplete = async (croppedFile: File) => {
    if (!currentOptionId) return

    try {
      await handleImageUpload(currentOptionId, croppedFile)
    } catch (error) {
      console.error('크롭된 이미지 업로드 실패:', error)
    } finally {
      setSelectedImage(null)
      setCurrentOptionId(null)
    }
  }

  // 크롭 모달 닫기 핸들러
  const handleCropModalClose = () => {
    setCropModalOpen(false)
    setSelectedImage(null)
    setCurrentOptionId(null)
    
    // 파일 입력 초기화
    if (currentOptionId && fileInputRefs.current[currentOptionId]) {
      fileInputRefs.current[currentOptionId]!.value = ''
    }
  }
  
  return (
    <Card className="shadow-sm border">
      <CardHeader className="pb-3 px-3 md:px-6">
        <CardTitle className="text-base font-medium">투표 만들기</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-3 md:px-6">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <Label className="text-sm font-medium">선택지</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddOption}
              className="h-9 md:h-8 text-sm"
              disabled={pollData.options.length >= 10}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              <span>선택지 추가</span>
            </Button>
          </div>
          
          {pollData.options.map((option, index) => (
            <div key={option.id} className="border rounded-lg p-3 md:p-4 space-y-3">
              <div className="space-y-3">
                {/* 텍스트 입력과 삭제 버튼 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      value={option.text}
                      onChange={(e) => handleOptionChange(option.id, e.target.value)}
                      placeholder={`선택지 ${index + 1}`}
                      className="text-base md:text-sm h-10 md:h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOption(option.id)}
                    disabled={pollData.options.length <= 2}
                    className="h-10 w-10 md:h-8 md:w-8 flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                
                {/* 이미지 관련 */}
                <div className="space-y-3">
                  {/* 이미지 업로드 버튼 */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={(el) => { fileInputRefs.current[option.id] = el; }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(option.id, e)}
                      className="hidden"
                    />
                    
                    {!option.imageUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current[option.id]?.click()}
                        disabled={uploadingOptionId === option.id}
                        className="h-9 md:h-8 text-sm"
                      >
                        <ImagePlus className="h-4 w-4 mr-1" />
                        {uploadingOptionId === option.id ? '업로드 중...' : '이미지 추가'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleImageRemove(option.id)}
                        className="h-9 md:h-8 text-sm text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-1" />
                        이미지 제거
                      </Button>
                    )}
                  </div>
                  
                  {/* 이미지 미리보기 */}
                  {option.imageUrl && (
                    <div className="relative w-full max-w-[200px] h-[120px] md:w-[150px] md:h-[150px]">
                      <Image
                        src={option.imageUrl}
                        alt={`옵션 ${index + 1} 이미지`}
                        fill
                        sizes="(max-width: 768px) 200px, 150px"
                        className="object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleImageRemove(option.id)}
                        className="absolute -top-2 -right-2 h-7 w-7 md:h-6 md:w-6 rounded-full bg-red-500 hover:bg-red-600 text-white touch-manipulation"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {pollData.options.length < 2 && (
            <p className="text-xs text-muted-foreground px-2">최소 2개의 선택지가 필요합니다.</p>
          )}
          {pollData.options.length >= 10 && (
            <p className="text-xs text-muted-foreground px-2">최대 10개의 선택지만 등록 가능합니다.</p>
          )}
        </div>
      </CardContent>
      
      {/* 이미지 크롭 모달 */}
      {selectedImage && (
        <ImageCropModal
          open={cropModalOpen}
          onClose={handleCropModalClose}
          imageSrc={selectedImage}
          onCropComplete={handleCropComplete}
          title="투표 옵션 이미지 자르기"
        />
      )}
    </Card>
  )
} 