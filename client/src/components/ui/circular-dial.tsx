import { cn } from '@/lib/utils';

interface CircularDialProps {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  title: string;
  subtitle?: string;
  color?: string;
  className?: string;
  isLoading?: boolean;
  unit?: string;
}

export function CircularDial({
  value,
  maxValue = 100,
  size = 120,
  strokeWidth = 8,
  title,
  subtitle,
  color = '#3b82f6',
  className,
  isLoading = false
}: CircularDialProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // For node count, show full circle with different visual approach
  const isNodeCount = maxValue !== 100;
  const percentage = isNodeCount ? 0.8 : Math.min(Math.max(value / maxValue, 0), 1);
  
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage * circumference);

  if (isLoading) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-4', className)} style={{ width: size + 32, height: size + 60 }}>
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-20 h-20 bg-muted rounded-full mb-3"></div>
          <div className="w-16 h-3 bg-muted rounded mb-2"></div>
          <div className="w-12 h-2 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const displayValue = isNodeCount ? value : value.toFixed(1);
  const displayUnit = isNodeCount ? '' : '%';

  return (
    <div className={cn('flex flex-col items-center justify-center p-4', className)} style={{ width: size + 32, height: size + 60 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="hsl(var(--muted-foreground) / 0.2)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-in-out"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.1))'
            }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-bold text-foreground leading-none">
            {displayValue}{displayUnit}
          </div>
          {isNodeCount && (
            <div className="text-xs text-muted-foreground mt-1">nodes</div>
          )}
        </div>
      </div>
      {/* Labels */}
      <div className="text-center mt-3 space-y-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </div>
  );
}