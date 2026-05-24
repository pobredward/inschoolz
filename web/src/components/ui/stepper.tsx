import React from 'react';
import { cn } from '@/lib/utils';
import { CheckIcon } from 'lucide-react';

interface StepProps {
  title: string;
  description?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  className?: string;
}

export function Step({
  title,
  description,
  isActive = false,
  isCompleted = false,
  className,
}: StepProps) {
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
          isActive
            ? 'border-green-600 bg-green-50 text-green-600'
            : isCompleted
            ? 'border-green-600 bg-green-600 text-white'
            : 'border-gray-300 bg-white text-gray-300'
        )}
      >
        {isCompleted ? (
          <CheckIcon className="h-4 w-4" />
        ) : (
          <span className="text-sm font-medium">{title.substring(0, 1)}</span>
        )}
      </div>
      <div className="mt-2 text-center">
        <div
          className={cn(
            'text-sm font-medium',
            isActive ? 'text-green-600' : isCompleted ? 'text-gray-900' : 'text-gray-500'
          )}
        >
          {title}
        </div>
        {description && (
          <div className="mt-0.5 text-xs text-gray-500">{description}</div>
        )}
      </div>
    </div>
  );
}

interface StepperProps {
  currentStep: number;
  children: React.ReactNode;
  className?: string;
}

export function Stepper({
  currentStep,
  children,
  className,
}: StepperProps) {
  const childrenArray = React.Children.toArray(children);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {childrenArray.map((child, index) => {
          return (
            <React.Fragment key={index}>
              {child}
              {index < childrenArray.length - 1 && (
                <div
                  className={cn(
                    'flex-1 border-t-2',
                    index < currentStep
                      ? 'border-green-600'
                      : 'border-gray-200'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
} 