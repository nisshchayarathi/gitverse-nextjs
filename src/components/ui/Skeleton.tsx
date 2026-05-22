import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | false
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-muted-foreground/10 rounded'
  
  const variantClasses = {
    text: 'h-4 inline-block',
    circular: 'rounded-full',
    rectangular: '',
  }[variant]

  const animationClass = animation === 'pulse' ? 'animate-pulse' : animation === 'wave' ? 'animate-shimmer' : ''

  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  }

  return (
    <span
      className={`${baseClasses} ${variantClasses} ${animationClass} ${className}`}
      style={style}
      aria-busy="true"
      role="status"
    />
  )
}
