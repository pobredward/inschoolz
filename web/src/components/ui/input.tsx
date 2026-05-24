import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // 모바일 최적화 스타일
        "min-h-touch touch-manipulation", // 터치 친화적 최소 높이
        "text-base md:text-sm", // 모바일에서 16px 이상으로 줌 방지
        // 포커스 스타일 개선
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        // 에러 상태 스타일
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // 상태별 피드백
        "data-[invalid]:border-destructive data-[invalid]:ring-destructive/20",
        "data-[success]:border-green-500 data-[success]:ring-green-500/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
