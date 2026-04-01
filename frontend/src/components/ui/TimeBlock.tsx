"use client";

import { useState } from "react";

interface TimeBlockProps {
  taskId: string;
  title: string;
  projectName?: string;
  startTime: string;
  endTime: string;
  energyLevel: "low" | "medium" | "high";
  slotType: string;
  completed: boolean;
  estimatedMinutes?: number;
  deferredCount?: number;
  featured?: boolean;
  onComplete: (taskId: string, actualMinutes: number) => void;
  onDefer: (taskId: string) => void;
  onCancel: (taskId: string) => void;
}

const energyDotColors = {
  low: "bg-azul-light",
  medium: "bg-amarillo",
  high: "bg-rojo",
};

const slotLabels: Record<string, string> = {
  deep_work: "Deep work",
  admin: "Admin",
  client_work: "Client",
  learning: "Learning",
  personal: "Personal",
  maintenance: "Maintenance",
};

const timePills = [5, 15, 30, 45, 60];

export function TimeBlock({
  taskId,
  title,
  projectName,
  startTime,
  endTime,
  energyLevel,
  slotType,
  completed,
  estimatedMinutes,
  deferredCount = 0,
  featured = false,
  onComplete,
  onDefer,
  onCancel,
}: TimeBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTimePills, setShowTimePills] = useState(false);
  const [animating, setAnimating] = useState<"complete" | "defer" | null>(null);
  const [deferMsg, setDeferMsg] = useState<string | null>(null);

  if (slotType === "break") {
    return (
      <div className="flex items-center justify-center py-[var(--space-2)]">
        <span className="text-xs text-gris">— Descanso {startTime} - {endTime} —</span>
      </div>
    );
  }

  const label = slotLabels[slotType] ?? slotType;
  const minutes = estimatedMinutes ?? 0;

  function handleComplete(actualMinutes: number) {
    setAnimating("complete");
    setTimeout(() => onComplete(taskId, actualMinutes), 300);
  }

  function handleDefer() {
    const newCount = deferredCount + 1;
    if (newCount >= 3) {
      setDeferMsg(`${newCount}a vez que mueves esta tarea`);
      setTimeout(() => setDeferMsg(null), 2000);
    }
    setAnimating("defer");
    setTimeout(() => onDefer(taskId), 400);
  }

  function handleCancel() {
    onCancel(taskId);
    setExpanded(false);
  }

  return (
    <div
      className={`
        rounded-[var(--radius-lg)] overflow-hidden transition-all duration-300
        ${featured ? "bg-bg-card-elevated shadow-[var(--shadow-md)]" : "bg-bg-card"}
        ${completed ? "opacity-50 scale-[0.98]" : ""}
        ${animating === "complete" ? "opacity-40 scale-95" : ""}
        ${animating === "defer" ? "translate-x-full opacity-0" : ""}
      `}
    >
      {/* Main card — tap to expand */}
      <button
        onClick={() => !completed && setExpanded(!expanded)}
        disabled={completed}
        className="w-full text-left p-[var(--space-4)] flex items-center gap-[var(--space-3)]"
      >
        {/* Energy dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${energyDotColors[energyLevel]}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-base text-blanco font-medium ${completed ? "line-through" : ""}`}>
            {title}
          </p>
          <p className="text-xs text-gris mt-0.5">
            {projectName ?? label}
            {minutes ? ` · ${minutes} min` : ""}
          </p>
        </div>

        {/* Right indicator */}
        <div className="flex-shrink-0">
          {completed ? (
            <span className="text-verde">✓</span>
          ) : (
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`text-gris/40 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded action row */}
      {expanded && !completed && (
        <div className="px-[var(--space-4)] pb-[var(--space-4)]">
          {/* Time pills (shown after tapping Hecho) */}
          {showTimePills && (
            <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-3)] flex-wrap">
              <span className="text-xs text-gris">¿Cuánto tomó?</span>
              {timePills.map((t) => (
                <button
                  key={t}
                  onClick={() => handleComplete(t)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs transition-colors
                    ${t === minutes
                      ? "bg-verde text-bg-primary"
                      : "bg-bg-card-elevated text-gris border border-blanco/10"
                    }
                  `}
                >
                  {t}m
                </button>
              ))}
              <button
                onClick={() => handleComplete(minutes)}
                className="px-2.5 py-1 rounded-full text-xs bg-verde/20 text-verde"
              >
                como planeado
              </button>
            </div>
          )}

          {/* Action buttons */}
          {!showTimePills && (
            <div className="flex items-center gap-[var(--space-2)]">
              <button
                onClick={() => setShowTimePills(true)}
                className="flex-1 min-h-[44px] rounded-[var(--radius-md)] bg-verde/15 text-verde text-sm font-medium transition-colors active:bg-verde/25"
              >
                ✓ Hecho
              </button>
              <button
                onClick={handleDefer}
                className="flex-1 min-h-[44px] rounded-[var(--radius-md)] bg-amarillo/15 text-amarillo text-sm font-medium transition-colors active:bg-amarillo/25"
              >
                → Mañana
              </button>
              <button
                onClick={handleCancel}
                className="min-h-[44px] w-11 rounded-[var(--radius-md)] bg-blanco/5 text-gris flex items-center justify-center transition-colors active:bg-blanco/10"
                aria-label="Cancelar"
              >
                ✕
              </button>
            </div>
          )}

          {/* Defer warning */}
          {deferMsg && (
            <p className="text-xs text-amarillo/70 text-center mt-[var(--space-2)] animate-pulse">
              {deferMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
