import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-20 w-full rounded-md border bg-transparent px-3 py-3 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        // 모바일 최적화 스타일
        "touch-manipulation resize-y", // 터치 친화적 및 세로 리사이즈만 허용
        "text-base md:text-sm", // 모바일에서 16px 이상으로 줌 방지
        // 상태별 피드백
        "data-[invalid]:border-destructive data-[invalid]:ring-destructive/20",
        "data-[success]:border-green-500 data-[success]:ring-green-500/20",
        // 스크롤 최적화
        "scrollbar-hide optimized-scroll",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
