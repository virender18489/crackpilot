import { cn } from '../../lib/cn';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  inverted?: boolean;
}

export function BrandLogo({ className, size = 'md', inverted = false }: BrandLogoProps) {
  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-7 w-7',
    lg: 'h-8 w-8',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <span className={cn('inline-flex items-center gap-2 whitespace-nowrap shrink-0 select-none', className)}>
      <svg
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className={cn(iconSizes[size], 'shrink-0')}
      >
        <rect
          x="1"
          y="1"
          width="26"
          height="26"
          rx="8"
          className={inverted ? 'fill-white/12 stroke-lavender-200/35' : 'fill-primary-500/12 stroke-primary-500/35'}
          strokeWidth="1.25"
        />
        <path
          d="M14 5.5L16.35 11.65L22.5 14L16.35 16.35L14 22.5L11.65 16.35L5.5 14L11.65 11.65L14 5.5Z"
          className={inverted ? 'fill-lavender-200' : 'fill-primary-500'}
        />
        <circle
          cx="14"
          cy="14"
          r="2.1"
          className={inverted ? 'fill-primary-700' : 'fill-navy-950 dark:fill-navy-950'}
        />
      </svg>
      <span className={cn('font-display tracking-tight leading-none', textSizes[size])}>
        <span className={cn('font-extrabold', inverted ? 'text-white' : 'text-ink')}>Crack</span>
        <span className={cn('font-bold', inverted ? 'text-lavender-200' : 'text-primary-500')}>pilot</span>
      </span>
    </span>
  );
}
