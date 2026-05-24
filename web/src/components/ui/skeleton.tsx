import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%]",
        "skeleton", // 커스텀 애니메이션 클래스
        className
      )}
      {...props}
    />
  )
}

// 미리 정의된 스켈레톤 컴포넌트들
function SkeletonText({ 
  lines = 1, 
  className 
}: { 
  lines?: number; 
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={cn(
            "h-4 w-full",
            i === lines - 1 && lines > 1 ? "w-3/4" : ""
          )} 
        />
      ))}
    </div>
  )
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 border rounded-lg space-y-3", className)}>
      <div className="flex items-center space-x-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}

function SkeletonButton({ 
  size = "default",
  className 
}: { 
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-20",
    default: "h-9 w-24", 
    lg: "h-10 w-32"
  }
  
  return (
    <Skeleton 
      className={cn(
        "rounded-md",
        sizeClasses[size],
        className
      )} 
    />
  )
}

function SkeletonAvatar({ 
  size = "default",
  className 
}: { 
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-8 w-8",
    default: "h-10 w-10",
    lg: "h-12 w-12"
  }
  
  return (
    <Skeleton 
      className={cn(
        "rounded-full",
        sizeClasses[size],
        className
      )} 
    />
  )
}

function SkeletonHeader({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <SkeletonAvatar />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <SkeletonButton size="sm" />
      </div>
    </div>
  )
}

function SkeletonPost({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 border rounded-lg space-y-4", className)}>
      <SkeletonHeader />
      <SkeletonText lines={4} />
      <div className="flex items-center justify-between pt-2">
        <div className="flex space-x-4">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-6 w-12" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
    </div>
  )
}

export { 
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonButton, 
  SkeletonAvatar,
  SkeletonHeader,
  SkeletonPost
}
