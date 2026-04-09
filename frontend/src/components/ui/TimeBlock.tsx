"use client";

import { useEffect, useRef, useState } from "react";

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
  low: "bg-[var(--energy-low)]",
  medium: "bg-amarillo",
  high: "bg-rojo",
};

const energyGlowColors = {
  low: "shadow-[0_0_8px_rgba(104,147,192,0.3)]",
  medium: "shadow-[0_0_8px_rgba(242,201,76,0.3)]",
  high: "shadow-[0_0_8px_rgba(240,96,96,0.3)]",
};

const slotLabels: Record<string, string> = {
  deep_work: "Trabajo profundo",
  admin: "Admin",
  client_work: "Cliente",
  learning: "Aprendizaje",
  personal: "Personal",
  maintenance: "Mantenimiento",
};

function getTimePills(estimatedMinutes: number): number[] {
  if (estimatedMinutes > 240) return [60, 120, 240, 480, 960];
  if (estimatedMinutes > 60) return [15, 30, 60, 120, 240];
  return [5, 15, 30, 45, 60];
}

function formatDuration(minutes: number): string {
  if (minutes >= 480) {
    const days = Math.round(minutes / 480);
    return `${days}d`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getTimeStatus(
  startTime: string,
  endTime: string,
): { label: string; color: string; isNow: boolean } | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  // Currently within the block
  if (currentMinutes >= startMin && currentMinutes < endMin) {
    return { label: "Ahora", color: "text-verde", isNow: true };
  }

  // Past — task is overdue
  if (currentMinutes >= endMin) {
    return { label: "Atrasada", color: "text-amarillo", isNow: false };
  }

  // Future — show how long until it starts
  const minsUntil = startMin - currentMinutes;
  if (minsUntil < 60) {
    return { label: `En ${minsUntil} min`, color: "text-gris/60", isNow: false };
  }
  const hoursUntil = Math.floor(minsUntil / 60);
  return { label: `En ${hoursUntil}h`, color: "text-gris/60", isNow: false };
}

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
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [animating, setAnimating] = useState<"complete" | "defer" | null>(null);
  const [hidden, setHidden] = useState(false);
  const [deferMsg, setDeferMsg] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timeStatus = slotType !== "break" ? getTimeStatus(startTime, endTime) : null;
  const isNow = timeStatus?.isNow ?? false;

  // Auto-scroll the current task into view when it's the "now" task
  useEffect(() => {
    if (isNow && cardRef.current && !completed) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // Only run on mount — don't re-scroll if status changes mid-session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (slotType === "break") {
    return (
      <div className="flex items-center gap-(--space-3) py-(--space-2)">
        <div className="flex-1 h-px bg-blanco/5" />
        <span className="text-xs text-gris/50 font-[family-name:var(--font-body)]">
          {startTime} – {endTime}
        </span>
        <div className="flex-1 h-px bg-blanco/5" />
      </div>
    );
  }

  if (hidden) return null;

  const label = slotLabels[slotType] ?? slotType;
  const minutes = estimatedMinutes ?? 0;

  function handleComplete(actualMinutes: number) {
    setAnimating("complete");
    setTimeout(() => {
      setHidden(true);
      onComplete(taskId, actualMinutes);
    }, 300);
  }

  function handleDefer() {
    const newCount = deferredCount + 1;
    if (newCount >= 3) {
      setDeferMsg(`${newCount}a vez que mueves esta tarea`);
      setTimeout(() => setDeferMsg(null), 2000);
    }
    setAnimating("defer");
    setTimeout(() => {
      setHidden(true);
      onDefer(taskId);
    }, 400);
  }

  function handleCancel() {
    onCancel(taskId);
    setExpanded(false);
  }

  return (
    <div
      ref={cardRef}
      className={`
        rounded-(--radius-lg) overflow-hidden transition-all duration-300 card-glow
        ${isNow && !completed
          ? "border-2 border-verde/40 shadow-[0_0_24px_rgba(52,211,153,0.18)]"
          : "border border-blanco/[0.04]"
        }
        ${featured ? "bg-bg-card-elevated" : "bg-bg-card"}
        ${completed ? "opacity-40 scale-[0.98]" : ""}
        ${animating === "complete" ? "opacity-30 scale-95" : ""}
        ${animating === "defer" ? "opacity-0 scale-95" : ""}
      `}
    >
      {/* Main card — tap to expand */}
      <button
        onClick={() => !completed && setExpanded(!expanded)}
        disabled={completed}
        className="w-full text-left p-(--space-4) flex items-center gap-(--space-3)"
      >
        {/* Energy dot with glow */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${energyDotColors[energyLevel]} ${featured ? energyGlowColors[energyLevel] : ""}`} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-[0.938rem] text-blanco font-medium leading-snug ${completed ? "line-through text-gris" : ""}`}>
            {title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-gris">{startTime}</span>
            {timeStatus && !completed && (
              <span className={`text-xs font-medium ${timeStatus.color}`}>
                · {timeStatus.label}
              </span>
            )}
            {projectName && (
              <>
                <span className="text-gris/30">·</span>
                <span className="text-xs text-azul/70">{projectName}</span>
              </>
            )}
            {!projectName && (
              <>
                <span className="text-gris/30">·</span>
                <span className="text-xs text-gris/60">{label}</span>
              </>
            )}
            {minutes > 0 && (
              <>
                <span className="text-gris/30">·</span>
                <span className="text-xs text-gris/60">{minutes}m</span>
              </>
            )}
          </div>
        </div>

        {/* Right indicator */}
        <div className="flex-shrink-0">
          {completed ? (
            <div className="w-5 h-5 rounded-full bg-verde/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 4" stroke="var(--talavera-verde)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`text-gris/30 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </button>

      {/* Expanded action row */}
      {expanded && !completed && (
        <div className="px-(--space-4) pb-(--space-4) animate-fade-in">
          {/* Time pills (shown after tapping Hecho) */}
          {showTimePills && (
            <div className="flex flex-col gap-(--space-3)">
              {showCustomInput ? (
                <div className="flex items-center gap-(--space-2)">
                  <span className="text-xs text-gris">Minutos:</span>
                  <input
                    type="number"
                    min="1"
                    max="4800"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    autoFocus
                    className="w-20 px-3 py-1.5 rounded-full text-xs font-medium bg-bg-card-elevated text-blanco border border-blanco/[0.06] text-center"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(customMinutes);
                        if (val > 0) handleComplete(val);
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const val = parseInt(customMinutes);
                      if (val > 0) handleComplete(val);
                    }}
                    disabled={!customMinutes || parseInt(customMinutes) <= 0}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-verde text-bg-primary disabled:opacity-40"
                  >
                    OK
                  </button>
                  <button
                    onClick={() => setShowCustomInput(false)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-card-elevated text-gris border border-blanco/[0.06]"
                  >
                    Atrás
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-(--space-2) flex-wrap">
                  <span className="text-xs text-gris">¿Cuánto tomó?</span>
                  {getTimePills(minutes).map((t) => (
                    <button
                      key={t}
                      onClick={() => handleComplete(t)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium transition-all
                        ${t === minutes
                          ? "bg-verde text-bg-primary"
                          : "bg-bg-card-elevated text-gris border border-blanco/[0.06] hover:border-blanco/10"
                        }
                      `}
                    >
                      {formatDuration(t)}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCustomInput(true)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-card-elevated text-gris border border-blanco/[0.06] hover:border-blanco/10"
                  >
                    Otro
                  </button>
                </div>
              )}
              <button
                onClick={() => handleComplete(minutes)}
                className="w-full min-h-[44px] rounded-(--radius-md) bg-verde/15 text-verde text-sm font-semibold transition-all active:bg-verde/25 border border-verde/20"
              >
                Completar{minutes > 0 ? ` (${formatDuration(minutes)} como planeado)` : ""}
              </button>
            </div>
          )}

          {/* Action buttons */}
          {!showTimePills && (
            <div className="flex items-center gap-(--space-2)">
              <button
                onClick={() => setShowTimePills(true)}
                className="flex-1 min-h-[44px] rounded-(--radius-md) bg-verde/10 text-verde text-sm font-semibold transition-all active:bg-verde/20 border border-verde/10"
              >
                Hecho
              </button>
              <button
                onClick={handleDefer}
                className="flex-1 min-h-[44px] rounded-(--radius-md) bg-amarillo/10 text-amarillo text-sm font-semibold transition-all active:bg-amarillo/20 border border-amarillo/10"
              >
                Mañana
              </button>
              <button
                onClick={handleCancel}
                className="min-h-[44px] w-11 rounded-(--radius-md) bg-blanco/[0.03] text-gris flex items-center justify-center transition-all active:bg-blanco/[0.06] border border-blanco/[0.04]"
                aria-label="Cancelar"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          {/* Defer warning */}
          {deferMsg && (
            <p className="text-xs text-amarillo/70 text-center mt-(--space-2) animate-pulse font-[family-name:var(--font-body)]">
              {deferMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
