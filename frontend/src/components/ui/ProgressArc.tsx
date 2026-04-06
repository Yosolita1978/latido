"use client";

import { useEffect, useState } from "react";

interface EnfoqueBreakdown {
  alignment: number;
  energyMatch: number;
  priorityIntegrity: number;
}

interface ProgressArcProps {
  score: number; // 0-5
  breakdown?: EnfoqueBreakdown;
  size?: number;
  strokeWidth?: number;
}

function getContextLabel(score: number, hasCompletedTasks: boolean): string {
  if (!hasCompletedTasks) return "Completa tareas para ver tu enfoque";
  if (score <= 1) return "Vas arrancando";
  if (score <= 2) return "Prioriza tu TOP 3";
  if (score <= 3) return "Buen ritmo";
  if (score <= 4) return "Muy enfocada";
  return "Día enfocado";
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-blanco/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export function ProgressArc({ score, breakdown, size = 180, strokeWidth = 8 }: ProgressArcProps) {
  const [animatedOffset, setAnimatedOffset] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.max(0, Math.min(score, 5)) / 5;
  const targetOffset = circumference - percentage * circumference;

  const hasCompletedTasks = score > 0;

  // Animate on mount
  useEffect(() => {
    setAnimatedOffset(circumference);
    const timer = setTimeout(() => setAnimatedOffset(targetOffset), 100);
    return () => clearTimeout(timer);
  }, [circumference, targetOffset]);

  return (
    <div className="flex flex-col items-center gap-(--space-3)">
      {/* Ring — tappable */}
      <button
        onClick={() => breakdown && setShowBreakdown(!showBreakdown)}
        className="enfoque-glow relative flex items-center justify-center"
        aria-label="Ver desglose de enfoque"
      >
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
          <span className="text-xs text-gris mt-1.5 font-[family-name:var(--font-body)] max-w-[120px] text-center leading-tight">
            {getContextLabel(score, hasCompletedTasks)}
          </span>
        </div>
      </button>

      {/* Breakdown card */}
      {showBreakdown && breakdown && (
        <div className="w-full bg-bg-card rounded-(--radius-lg) p-(--space-4) flex flex-col gap-(--space-4) border border-blanco/[0.04] animate-fade-in">
          <div className="flex flex-col gap-(--space-1)">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gris font-[family-name:var(--font-body)]">Puntualidad</span>
              <span className="text-xs text-blanco/60 font-[family-name:var(--font-body)]">{Math.round(breakdown.alignment * 100)}%</span>
            </div>
            <MiniBar value={breakdown.alignment} color="bg-verde" />
            <span className="text-[10px] text-gris/50 font-[family-name:var(--font-body)]">
              Tareas completadas cerca de la hora planeada
            </span>
          </div>

          <div className="flex flex-col gap-(--space-1)">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gris font-[family-name:var(--font-body)]">Energía</span>
              <span className="text-xs text-blanco/60 font-[family-name:var(--font-body)]">{Math.round(breakdown.energyMatch * 100)}%</span>
            </div>
            <MiniBar value={breakdown.energyMatch} color="bg-amarillo" />
            <span className="text-[10px] text-gris/50 font-[family-name:var(--font-body)]">
              Trabajo pesado en la mañana, ligero en la tarde
            </span>
          </div>

          <div className="flex flex-col gap-(--space-1)">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gris font-[family-name:var(--font-body)]">Prioridades</span>
              <span className="text-xs text-blanco/60 font-[family-name:var(--font-body)]">{Math.round(breakdown.priorityIntegrity * 100)}%</span>
            </div>
            <MiniBar value={breakdown.priorityIntegrity} color="bg-azul" />
            <span className="text-[10px] text-gris/50 font-[family-name:var(--font-body)]">
              TOP 3 tareas del día completadas
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
