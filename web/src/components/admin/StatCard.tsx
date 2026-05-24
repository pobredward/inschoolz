import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const statCardVariants = cva(
  "p-4 rounded-lg border flex items-start justify-between transition-all",
  {
    variants: {
      variant: {
        default: "bg-card border-border",
        blue: "bg-green-50 border-green-100 dark:bg-green-950/40 dark:border-green-900",
        green: "bg-green-50 border-green-100 dark:bg-green-950/40 dark:border-green-900",
        yellow: "bg-yellow-50 border-yellow-100 dark:bg-yellow-950/40 dark:border-yellow-900",
        red: "bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900",
        purple: "bg-purple-50 border-purple-100 dark:bg-purple-950/40 dark:border-purple-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// 아이콘 배경 변형
const iconVariants = cva(
  "p-2 rounded-md flex items-center justify-center",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary",
        blue: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
        green: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
        yellow: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400",
        red: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
        purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatCardProps extends VariantProps<typeof statCardVariants> {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  variant,
  className,
}: StatCardProps) {
  return (
    <div className={cn(statCardVariants({ variant }), className)}>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold">{value}</h3>
          {change && (
            <span 
              className={cn(
                "text-xs", 
                change.isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {change.isPositive ? '+' : ''}{change.value}%
            </span>
          )}
        </div>
      </div>
      <div className={cn(iconVariants({ variant }))}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
} 