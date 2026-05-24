'use client'

import React, { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './dialog'
import { Button } from './button'
import { Slider } from './slider'

interface ImageCropModalProps {
  open: boolean
  onClose: () => void
  imageSrc: string
  onCropComplete: (croppedImage: File) => void
  title?: string
}

interface Area {
  x: number
  y: number
  width: number
  height: number
}

interface Point {
  x: number
  y: number
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', error => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: Area,
  fileName: string = 'cropped-image.jpg'
): Promise<File> => {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  const { width, height } = pixelCrop

  canvas.width = width
  canvas.height = height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Canvas is empty')
      }
      const file = new File([blob], fileName, {
        type: 'image/jpeg',
        lastModified: Date.now()
      })
      resolve(file)
    }, 'image/jpeg', 0.95)
  })
}

export default function ImageCropModal({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  title = '이미지 자르기'
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropAreaChange = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleCropComplete = useCallback(async () => {
    if (!croppedAreaPixels) return

    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCropComplete(croppedImage)
      onClose()
    } catch (error) {
      console.error('이미지 크롭 오류:', error)
    }
  }, [croppedAreaPixels, imageSrc, onCropComplete, onClose])

  const handleClose = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 크롭 영역 */}
          <div className="relative h-80 bg-gray-100 rounded-lg overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1} // 정사각형 비율
              onCropChange={setCrop}
              onCropComplete={onCropAreaChange}
              onZoomChange={setZoom}
              cropShape="rect"
              showGrid={true}
            />
          </div>

          {/* 줌 조절 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">확대/축소</label>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleCropComplete} disabled={!croppedAreaPixels}>
            적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 