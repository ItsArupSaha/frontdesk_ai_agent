interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
}

export default function LoadingSpinner({ size = 'md', className = '' }: Props) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`animate-spin rounded-full border-gray-200 border-t-brand-500 ${sizeMap[size]} ${className}`}
    />
  )
}
