'use client'

import { useState, useRef, useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { uploadImage } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  ImageIcon,
  Undo,
  Redo,
} from 'lucide-react'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from '@/components/ui/tooltip'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { 
  Popover,
  PopoverContent,
  PopoverTrigger 
} from '@/components/ui/popover'

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  onImageUpload?: (attachment: { type: 'image'; url: string; name: string; size: number }) => void
  onImageRemove?: (imageUrl: string) => void
}

export default function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = '내용을 입력하세요...',
  onImageUpload,
  onImageRemove
}: RichTextEditorProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const [previousImages, setPreviousImages] = useState<string[]>([])

  // HTML에서 이미지 URL 추출하는 함수
  const extractImageUrls = (html: string): string[] => {
    const imgRegex = /<img[^>]+src="([^"]+)"/g
    const urls: string[] = []
    let match
    while ((match = imgRegex.exec(html)) !== null) {
      urls.push(match[1])
    }
    return urls
  }

  const editor = useEditor({
    immediatelyRender: false, // SSR 하이드레이션 미스매치 방지
    extensions: [
      StarterKit,
      Image,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right'],
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const newContent = editor.getHTML()
      onChange(newContent)
      
      // 이미지 삭제 감지
      if (onImageRemove) {
        const currentImages = extractImageUrls(newContent)
        const removedImages = previousImages.filter(url => !currentImages.includes(url))
        
        removedImages.forEach(imageUrl => {
          console.log('웹 에디터에서 이미지 삭제 감지:', imageUrl)
          onImageRemove(imageUrl)
        })
        
        setPreviousImages(currentImages)
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[250px] md:min-h-[300px] max-h-[400px] md:max-h-[600px] overflow-y-auto p-3 md:p-4 text-base md:text-sm',
      },
    },
  })

  useEffect(() => {
    // 에디터 초기화 완료 후 컨텐츠 설정
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
      // 초기 이미지 목록 설정
      const initialImages = extractImageUrls(content)
      setPreviousImages(initialImages)
    }
  }, [editor, content])

  // 에디터 컨테이너 클릭 시 포커스 설정
  const handleEditorClick = () => {
    if (editor && !editor.isFocused) {
      editor.commands.focus()
    }
  }

  // 이미지 업로드 처리
  const handleImageUpload = async () => {
    if (!selectedFile || !editor) return

    // 파일 크기 검증 (10MB 제한)
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (selectedFile.size > MAX_FILE_SIZE) {
      alert('이미지 크기는 10MB 이하여야 합니다.')
      return
    }

    // 파일 형식 검증
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      alert('JPG, PNG, GIF, WebP 형식의 이미지만 업로드 가능합니다.')
      return
    }

    setIsUploading(true)
    try {
      const imageUrl = await uploadImage(selectedFile)
      editor.chain().focus().setImage({ src: imageUrl }).run()
      
      // 상위 컴포넌트에 attachment 정보 전달
      if (onImageUpload) {
        onImageUpload({
          type: 'image',
          url: imageUrl,
          name: selectedFile.name,
          size: selectedFile.size
        })
      }
      
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      
      // 구체적인 에러 메시지 제공
      let errorMessage = '이미지 업로드에 실패했습니다.'
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage = '이미지 업로드 권한이 없습니다. 로그인을 확인해주세요.'
        } else if (error.message.includes('network')) {
          errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.'
        } else if (error.message.includes('storage/quota-exceeded')) {
          errorMessage = '저장 공간이 부족합니다. 관리자에게 문의해주세요.'
        }
      }
      alert(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  // 링크 추가
  const handleAddLink = () => {
    if (!editor || !linkUrl) return

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: linkUrl, target: '_blank' })
      .run()

    setLinkUrl('')
  }

  // 링크 제거
  const handleRemoveLink = () => {
    if (!editor) return
    
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
  }

  if (!editor) {
    return (
      <div className="border rounded-md min-h-[250px] md:min-h-[300px] bg-gray-50 animate-pulse">
        <div className="h-10 md:h-12 bg-gray-200 border-b"></div>
        <div className="p-3 md:p-4">
          <div className="h-4 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-md" ref={editorRef}>
      {/* 모바일 툴바 - 첫 번째 줄 */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/20 md:hidden">
        <TooltipProvider>
          {/* 기본 텍스트 서식 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`h-8 w-8 ${editor.isActive('bold') ? 'bg-muted' : ''}`}
              >
                <Bold className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>굵게</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`h-8 w-8 ${editor.isActive('italic') ? 'bg-muted' : ''}`}
              >
                <Italic className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>기울임</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`h-8 w-8 ${editor.isActive('underline') ? 'bg-muted' : ''}`}
              >
                <UnderlineIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>밑줄</TooltipContent>
          </Tooltip>





          {/* 이미지 업로드 */}
          <Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>이미지</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <PopoverContent className="w-72">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="mobile-image" className="text-sm">이미지 파일 선택</Label>
                  <Input
                    id="mobile-image"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0])
                      }
                    }}
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={!selectedFile || isUploading}
                  className="w-full h-9"
                  size="sm"
                >
                  {isUploading ? '업로드 중...' : '이미지 추가'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* 실행 취소/다시 실행 */}
          <div className="ml-auto flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  className="h-8 w-8"
                >
                  <Undo className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>실행 취소</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  className="h-8 w-8"
                >
                  <Redo className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>다시 실행</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* 데스크톱 툴바 */}
      <div className="hidden md:flex flex-wrap gap-1 p-2 border-b bg-muted/20">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-muted' : ''}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>굵게</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-muted' : ''}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>기울임</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={editor.isActive('underline') ? 'bg-muted' : ''}
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>밑줄</TooltipContent>
          </Tooltip>

          <Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={editor.isActive('link') ? 'bg-muted' : ''}
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>링크</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <PopoverContent className="w-80">
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="link">URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="link"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                    />
                    <Button type="button" onClick={handleAddLink}>추가</Button>
                  </div>
                </div>
                
                {editor.isActive('link') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveLink}
                  >
                    링크 제거
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>





          <Popover>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>이미지 업로드</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <PopoverContent className="w-80">
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="image">이미지 파일 선택</Label>
                  <Input
                    id="image"
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0])
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleImageUpload}
                  disabled={!selectedFile || isUploading}
                >
                  {isUploading ? '업로드 중...' : '이미지 추가'}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <div className="ml-auto flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                >
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>실행 취소</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>다시 실행</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <div 
        onClick={handleEditorClick}
        className="cursor-text touch-manipulation"
      >
        <EditorContent 
          editor={editor} 
        />
      </div>
    </div>
  )
} 