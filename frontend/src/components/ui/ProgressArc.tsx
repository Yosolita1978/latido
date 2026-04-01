"use client";

interface ProgressArcProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

export function ProgressArc({ completed, total, size = 180, strokeWidth = 10 }: ProgressArcProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? completed / total : 0;
  const offset = circumference - percentage * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--talavera-bg-card)"
          strokeWidth={strokeWidth}
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ring-green)" />
            <stop offset="50%" stopColor="var(--ring-yellow)" />
            <stop offset="100%" stopColor="var(--ring-blue)" />
          </linearGradient>
        </defs>
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl italic text-blanco font-[family-name:var(--font-heading)]">
          Enfoque
        </span>
        <span className="text-sm text-gris">
          {completed} de {total}
        </span>
      </div>
    </div>
  );
}
