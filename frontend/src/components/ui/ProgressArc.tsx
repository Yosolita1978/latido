"use client";

import { useEffect, useState } from "react";

interface ProgressArcProps {
  score: number; // 0-5
  size?: number;
  strokeWidth?: number;
}

export function ProgressArc({ score, size = 180, strokeWidth = 8 }: ProgressArcProps) {
  const [animatedOffset, setAnimatedOffset] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(score, 5)) / 5;
  const targetOffset = circumference - percentage * circumference;

  // Animate on mount
  useEffect(() => {
    setAnimatedOffset(circumference);
    const timer = setTimeout(() => setAnimatedOffset(targetOffset), 100);
    return () => clearTimeout(timer);
  }, [circumference, targetOffset]);

  return (
    <div className="enfoque-glow relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--talavera-bg-card)"
          strokeWidth={strokeWidth}
          opacity={0.6}
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ring-green)" />
            <stop offset="50%" stopColor="var(--ring-yellow)" />
            <stop offset="100%" stopColor="var(--ring-blue)" />
          </linearGradient>
          {/* Outer glow filter */}
          <filter id="ring-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Glow layer */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth + 4}
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          opacity={0.2}
          filter="url(#ring-glow)"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
        {/* Main progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2rem] italic text-blanco font-[family-name:var(--font-heading)] leading-none">
          Enfoque
        </span>
        <span className="text-sm text-gris mt-1 font-[family-name:var(--font-body)]">
          {score} de 5
        </span>
      </div>
    </div>
  );
}
