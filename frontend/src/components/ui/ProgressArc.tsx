interface ProgressArcProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export function ProgressArc({ percentage, size = 120, strokeWidth = 8 }: ProgressArcProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-[var(--space-2)]">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--talavera-crema)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--talavera-azul)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-2xl font-bold text-azul font-[family-name:var(--font-heading)]">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
